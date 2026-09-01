-- ============================================================
-- ACCOUNT BRIDGE — ScuoleRadar PRO ↔ PureFocus PRO
-- Esposizione esplicita dello stato abbonamento (subscription_tier,
-- subscription_status, current_period_end) + funzione
-- get_user_pro_status(user_id uuid) per la validazione cross-app.
-- ============================================================

-- 1. Colonne esplicite
alter table public.profiles add column if not exists subscription_tier text not null default 'base';
alter table public.profiles add column if not exists subscription_status text not null default 'inactive';
alter table public.profiles add column if not exists current_period_end timestamptz;

-- 2. Vincoli di integrità
alter table public.profiles drop constraint if exists profiles_subscription_tier_check;
alter table public.profiles add constraint profiles_subscription_tier_check
  check (subscription_tier in ('base', 'pro_annuale', 'pro_mensile', 'a_consumo'));

alter table public.profiles drop constraint if exists profiles_subscription_status_check;
alter table public.profiles add constraint profiles_subscription_status_check
  check (subscription_status in (
    'inactive', 'active', 'trialing', 'canceled',
    'past_due', 'unpaid', 'incomplete', 'incomplete_expired', 'paused'
  ));

-- 3. Commenti
comment on column public.profiles.subscription_tier is
  'Tier abbonamento esplicito per l''Account Bridge: base | pro_annuale | pro_mensile | a_consumo';
comment on column public.profiles.subscription_status is
  'Stato Stripe dell''abbonamento (active|trialing|canceled|past_due|unpaid|…) — mantenuto real-time dal webhook';
comment on column public.profiles.current_period_end is
  'Fine periodo corrente (current_period_end di Stripe): la scadenza casca automaticamente su is_pro=false';

-- 4. Backfill dai campi legacy (piano / abbonamento_scade_il)
update public.profiles
   set subscription_tier   = case when piano = 'pro' then 'pro_annuale' else 'base' end,
       subscription_status = case
                               when piano = 'pro' and (abbonamento_scade_il is null or abbonamento_scade_il > now())
                                 then 'active'
                               else 'inactive'
                             end,
       current_period_end  = abbonamento_scade_il
 where subscription_status = 'inactive';

-- 5. Funzione get_user_pro_status(user_id uuid)
--    Ritorna { is_pro, expires_at, tier }: is_pro è vero SOLO se lo stato è
--    active|trialing E la scadenza non è passata → l'expiration casca da sola.
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
      (subscription_status in ('active', 'trialing')
        and (current_period_end is null or current_period_end > now())
      ) as is_pro,
      current_period_end as expires_at,
      subscription_tier   as tier
    from public.profiles
    where id = p_user_id;
end;
$$;

-- 6. Permessi
grant execute on function public.get_user_pro_status(uuid) to authenticated;
grant execute on function public.get_user_pro_status(uuid) to service_role;
grant execute on function public.get_user_pro_status(uuid) to anon;
