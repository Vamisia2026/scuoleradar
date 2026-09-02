-- ============================================================
-- ACCOUNT BRIDGE — allineato al piano Free Forever (FFE)
-- Aggiunge le colonne esplicite di abbonamento (Subscription Tier/Status e
-- current_period_end, alias "piano_scadenza") consentendo il valore
-- 'free_forever' nella subscription_tier, e marca gli utenti FFE come
-- subscription_status = 'active'. Crea la RPC get_user_pro_status che tratta
-- Free Forever come accesso PRO permanente (is_pro = true).
-- APPLICAZIONE: SQL Editor Supabase (project gwdmsgsshvdnfrplbjiv).
-- Da eseguire PRIMA della migrazione del cron FFE renewal.
-- ============================================================

alter table public.profiles add column if not exists subscription_tier text not null default 'base';
alter table public.profiles add column if not exists subscription_status text not null default 'inactive';
alter table public.profiles add column if not exists current_period_end timestamptz;

-- Vincoli: il tier accetta anche 'free_forever' (special variant di PRO).
alter table public.profiles drop constraint if exists profiles_subscription_tier_check;
alter table public.profiles add constraint profiles_subscription_tier_check
  check (subscription_tier in ('base', 'pro_annuale', 'pro_mensile', 'a_consumo', 'free_forever'));

alter table public.profiles drop constraint if exists profiles_subscription_status_check;
alter table public.profiles add constraint profiles_subscription_status_check
  check (subscription_status in (
    'inactive', 'active', 'trialing', 'canceled',
    'past_due', 'unpaid', 'incomplete', 'incomplete_expired', 'paused'
  ));

comment on column public.profiles.subscription_tier is
  'Tier abbonamento esplicito (Account Bridge): base | pro_annuale | pro_mensile | a_consumo | free_forever';
comment on column public.profiles.subscription_status is
  'Stato abbonamento (active|trialing|canceled|past_due|unpaid|…): i Free Forever risultano sempre active';
comment on column public.profiles.current_period_end is
  'Fine periodo corrente (alias piano_scadenza): per i Free Forever indica il prossimo rinnovo annuale automatico';

-- Backfill: Free Forever = tier dedicato, stato active, scadenza ancorata.
update public.profiles
   set subscription_tier   = 'free_forever',
       subscription_status = 'active',
       current_period_end  = coalesce(current_period_end, abbonamento_scade_il, now() + interval '365 days')
 where piano = 'free_forever';

-- Backfill prudente dai campi legacy (pro pagante attivo, base inattivo).
update public.profiles
   set subscription_tier   = case when piano = 'pro' then 'pro_annuale' else 'base' end,
       subscription_status = case
                               when piano = 'pro' and (abbonamento_scade_il is null or abbonamento_scade_il > now())
                                 then 'active'
                               else 'inactive'
                             end,
       current_period_end  = abbonamento_scade_il
 where piano <> 'free_forever'
   and subscription_status = 'inactive';

-- RPC get_user_pro_status: Free Forever è sempre PRO (is_pro=true).
create or replace function public.get_user_pro_status(p_user_id uuid)
returns table (is_pro boolean, expires_at timestamptz, tier text)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  -- Un utente autenticato può interrogare SOLO il proprio stato.
  if auth.uid() is not null and auth.uid() <> p_user_id then
    return query select false::boolean, null::timestamptz, 'base'::text;
    return;
  end if;

  return query
    select
      (p.piano = 'free_forever'
        or (p.subscription_status in ('active', 'trialing')
            and (p.current_period_end is null or p.current_period_end > now()))) as is_pro,
      p.current_period_end as expires_at,
      p.subscription_tier   as tier
    from public.profiles p
    where p.id = p_user_id;
end;
$$;

grant execute on function public.get_user_pro_status(uuid) to authenticated;
grant execute on function public.get_user_pro_status(uuid) to service_role;
grant execute on function public.get_user_pro_status(uuid) to anon;
