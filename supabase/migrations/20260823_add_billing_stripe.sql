-- ============================================================
-- FASE 6 — Monetizzazione Stripe
-- Estende profiles con piano/crediti/contatore notifiche
-- + RPC atomica per il limite server-side delle notifiche.
-- ============================================================

alter table public.profiles add column if not exists piano text not null default 'base';
alter table public.profiles add column if not exists stripe_customer_id text;
alter table public.profiles add column if not exists stripe_subscription_id text;
alter table public.profiles add column if not exists abbonamento_scade_il timestamptz;
alter table public.profiles add column if not exists crediti integer not null default 0;
alter table public.profiles add column if not exists notifiche_usate integer not null default 0;
alter table public.profiles add column if not exists notifiche_mese text not null default to_char(now(), 'YYYY-MM');

-- Vincoli di integrità
alter table public.profiles add constraint profiles_piano_check check (piano in ('base', 'pro'));
alter table public.profiles add constraint profiles_crediti_check check (crediti >= 0);
alter table public.profiles add constraint profiles_notifiche_check check (notifiche_usate >= 0);

-- Indice per il lookup del customer Stripe
create unique index if not exists profiles_stripe_customer_idx
  on public.profiles (stripe_customer_id) where stripe_customer_id is not null;

comment on column public.profiles.piano is 'Piano utente: base | pro (FASE 6)';
comment on column public.profiles.stripe_customer_id is 'Customer ID Stripe';
comment on column public.profiles.stripe_subscription_id is 'ID abbonamento Stripe';
comment on column public.profiles.abbonamento_scade_il is 'Data scadenza abbonamento (current_period_end)';
comment on column public.profiles.crediti is 'Sblocchi A la Carte disponibili';
comment on column public.profiles.notifiche_usate is 'Notifiche usate nel mese corrente (reset via RPC)';
comment on column public.profiles.notifiche_mese is 'Mese di riferimento del contatore (YYYY-MM)';

-- ============================================================
-- RPC atomica: incrementa il contatore notifiche con guardia
-- - pro      → consentito sempre
-- - base     → max 3 al mese (reset automatico su notifiche_mese)
-- ============================================================
create or replace function public.incrementa_notifiche_utente(p_user_id uuid)
returns table (consentito boolean, notifiche_usate integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_mese   text := to_char(now(), 'YYYY-MM');
  v_piano  text;
  v_usate  integer;
  v_mese_c text;
begin
  select piano, notifiche_usate, notifiche_mese
    into v_piano, v_usate, v_mese_c
    from public.profiles
   where id = p_user_id
     for update;

  -- utente inesistente
  if v_piano is null then
    return query select false::boolean, 0::integer;
    return;
  end if;

  -- reset mensile
  if v_mese_c <> v_mese then
    v_usate  := 0;
    v_mese_c := v_mese;
  end if;

  -- guardia: base al limite
  if v_piano <> 'pro' and v_usate >= 3 then
    return query select false::boolean, v_usate;
    return;
  end if;

  update public.profiles
     set notifiche_usate = v_usate + 1,
         notifiche_mese   = v_mese_c
   where id = p_user_id;

  return query select true::boolean, v_usate + 1;
end;
$$;

grant execute on function public.incrementa_notifiche_utente(uuid) to authenticated;
grant execute on function public.incrementa_notifiche_utente(uuid) to service_role;
