-- ============================================================
-- Codici promo Beta Tester / 100% (PRO 1 anno · PRO lifetime)
-- 1) tabella promo_codes: codici speciali gestiti manualmente
--    (accessibili SOLO via RPC security definer o service_role,
--    mai in lettura diretta dal client).
-- 2) valida_codice_promo estesa: prima controlla promo_codes,
--    poi i referral. Ritorna anche gratuito/piano/durata.
-- 3) RPC attiva_codice_promo: attivazione ATOMICA del piano PRO
--    senza passare da Stripe (evita errori HTTP 400/500 di Stripe
--    su sessioni a importo zero) + consumo monouso del codice.
--
-- Esempio di creazione di un nuovo codice (SQL Editor):
--   insert into public.promo_codes (codice, tipo, percentuale, piano, durata, monouso, scade_il)
--   values ('BETA1ANNO', 'beta', 100, 'pro', '1anno', true, '2027-12-31T23:59:59Z');
-- ============================================================

create table if not exists public.promo_codes (
  id           uuid primary key default gen_random_uuid(),
  codice       text not null unique,
  tipo         text not null default 'beta',
  percentuale  integer,
  piano        text not null default 'pro',
  durata       text,
  monouso      boolean not null default true,
  usato_da     uuid references public.profiles (id) on delete set null,
  usato_il     timestamptz,
  scade_il     timestamptz,
  attivo       boolean not null default true,
  creato_il    timestamptz not null default now(),
  constraint promo_codes_tipo_check        check (tipo in ('beta', 'sconto')),
  constraint promo_codes_piano_check       check (piano in ('base', 'pro')),
  constraint promo_codes_durata_check      check (durata is null or durata in ('1anno', 'lifetime')),
  constraint promo_codes_percentuale_check check (percentuale is null or percentuale between 0 and 100)
);

alter table public.promo_codes enable row level security;
grant all on table public.promo_codes to service_role;

comment on table public.promo_codes is
  'Codici promo speciali (Beta Tester / 100%): accessibili solo via RPC security definer o service_role';

-- ============================================================
-- RPC valida_codice_promo estesa
-- Ritorna anche gratuito/piano/durata oltre ai campi storici.
-- Ordine di ricerca:
--   1. promo_codes (Beta Tester / 100%) se attivo, non scaduto
--      e non ancora consumato (se monouso);
--   2. profiles.referral_code (programma referral, -10€);
--   3. nessun match → valido = false.
--
-- NB: la funzione preesistente aveva un RETURNS TABLE con OUT
-- parameters diversi: PostgreSQL NON permette a CREATE OR REPLACE
-- FUNCTION di cambiarne il tipo di ritorno (SQLSTATE 42P13). Prima
-- di ricrearla con la nuova firma serve quindi un DROP esplicito.
-- ============================================================
drop function if exists public.valida_codice_promo(p_codice text);
create or replace function public.valida_codice_promo(p_codice text)
returns table (
  valido boolean,
  gratuito boolean,
  referrer_id uuid,
  codice text,
  sconto numeric,
  piano text,
  durata text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v record;
begin
  -- 1) Codici promo speciali (promo_codes): 100% / Beta Tester
  select pc.codice, pc.piano, pc.durata
    into v
    from public.promo_codes pc
   where lower(pc.codice) = lower(p_codice)
     and pc.attivo = true
     and (pc.scade_il is null or pc.scade_il > now())
     and (pc.monouso = false or pc.usato_il is null)
   limit 1;

  if found then
    return query select
      true::boolean, true::boolean, null::uuid,
      v.codice, 100.00::numeric, v.piano, v.durata;
    return;
  end if;

  -- 2) Codici referral (programma "Invita un Collega"): sconto -10€
  select p.id, p.referral_code
    into v
    from public.profiles p
   where lower(p.referral_code) = lower(p_codice)
   limit 1;

  if found then
    return query select
      true::boolean, false::boolean, v.id,
      v.referral_code, 10.00::numeric, null::text, null::text;
    return;
  end if;

  -- 3) Codice non trovato
  return query select
    false::boolean, false::boolean, null::uuid,
    null::text, 0.00::numeric, null::text, null::text;
end;
$$;

grant execute on function public.valida_codice_promo(text) to authenticated;
grant execute on function public.valida_codice_promo(text) to service_role;

-- ============================================================
-- RPC attiva_codice_promo
-- Valida (in modo ATOMICO con FOR UPDATE) un codice promo Beta/100%,
-- porta il profilo dell'utente su piano = 'pro' e marca il codice
-- come usato se monouso. Nessuna chiamata a Stripe: la Edge Function
-- checkout non deve quindi mai incappare in un errore HTTP di Stripe
-- per i codici a sconto totale.
-- ============================================================
create or replace function public.attiva_codice_promo(p_codice text, p_user_id uuid)
returns table (ok boolean, errore text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pc public.promo_codes%rowtype;
  v_utente uuid;
begin
  -- Guardia condizionale: i client autenticati possono attivare solo il
  -- proprio profilo; il server (service_role, auth.uid() = NULL) passa.
  if auth.uid() is not null and auth.uid() <> p_user_id then
    return query select false::boolean, 'Non autorizzato'::text;
    return;
  end if;

  -- L'utente deve esistere
  select p.id into v_utente
    from public.profiles p
   where p.id = p_user_id;
  if v_utente is null then
    return query select false::boolean, 'Utente non trovato'::text;
    return;
  end if;

  -- Lock della riga del codice: impedisce doppie attivazioni concorrenti
  select pc.* into v_pc
    from public.promo_codes pc
   where lower(pc.codice) = lower(p_codice)
   for update;

  if not found then
    return query select false::boolean, 'Codice promo inesistente'::text;
    return;
  end if;
  if not v_pc.attivo then
    return query select false::boolean, 'Codice promo disattivato'::text;
    return;
  end if;
  if v_pc.scade_il is not null and v_pc.scade_il <= now() then
    return query select false::boolean, 'Codice promo scaduto'::text;
    return;
  end if;
  if v_pc.monouso and v_pc.usato_il is not null then
    return query select false::boolean, 'Codice promo gia utilizzato'::text;
    return;
  end if;

  -- Attiva il piano PRO:
  --   durata '1anno'    → scadenza = now() + 1 anno
  --   durata 'lifetime' → nessuna scadenza (abbonamento_scade_il = NULL)
  update public.profiles
     set piano = v_pc.piano,
         abbonamento_scade_il = case
           when v_pc.durata = '1anno' then now() + interval '1 year'
           else null
         end
   where id = p_user_id;

  -- Consumo del codice (se monouso)
  if v_pc.monouso then
    update public.promo_codes
       set usato_da = p_user_id,
           usato_il = now()
     where id = v_pc.id;
  end if;

  return query select true::boolean, null::text;
end;
$$;

grant execute on function public.attiva_codice_promo(text, uuid) to authenticated;
grant execute on function public.attiva_codice_promo(text, uuid) to service_role;

-- ============================================================
-- Seed demo: codici Beta Tester (sostituiscili/eliminali a piacere)
-- BETA1ANNO    → PRO 1 anno gratuito (monouso)
-- BETALIFETIME → PRO lifetime gratuito (monouso)
-- ============================================================
insert into public.promo_codes (codice, tipo, percentuale, piano, durata, monouso, scade_il)
values
  ('BETA1ANNO',    'beta', 100, 'pro', '1anno',    true, '2027-12-31T23:59:59Z'),
  ('BETALIFETIME', 'beta', 100, 'pro', 'lifetime', true, '2027-12-31T23:59:59Z')
on conflict (codice) do nothing;
