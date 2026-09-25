-- ============================================================
-- COUPON UNICO SCUOLERADAR50 (50% PRO annuale) — RADAR50 DISMESSO
--
-- Regole TASSATIVE (unico coupon di sconto attivo):
--   1. 50% di sconto sulla sottoscrizione ANNUALE del piano PRO;
--   2. MONOUSO PER EMAIL: una sola volta per utente e nessun altro account con la
--      stessa email / email di notifica / Telegram ID può riutilizzarlo (anti-replay);
--   3. valido 40 giorni dalla REGISTRAZIONE iniziale, cioè dalla data che ha
--      attivato il mese PRO gratuito (finestra dinamica su auth.users.created_at);
--   4. case-insensitive: `scuoleradar50`, `ScuoleRadar50`, `SCUOLERADAR-50` sono lo
--      stesso codice (normalizzazione lato client `normalizzaCodicePromo` e lato
--      Edge `checkout`, stesso criterio A-Z0-9).
--
-- Cosa fa questa migrazione:
--   A) rimuove DEFINITIVAMENTE RADAR50 da promo_codes e le sue funzioni dedicate;
--   B) registra SCUOLERADAR50 in promo_codes (50%, pro, 1anno, monouso);
--   C) crea valida_coupon_scuoleradar50(p_user_id) → [ok, motivo, sconto_percent];
--   D) crea registra_uso_coupon_scuoleradar50(p_user_id, session) per il webhook;
--   E) generalizza la tabella di tracciamento utilizzi (coupon_usage).
--
-- Le Edge Function `checkout` (validazione) e `webhook` (consumo dopo il pagamento)
-- chiamano le funzioni C e D: vanno deployate INSIEME a questa migrazione.
--
-- APPLICAZIONE: SQL Editor Supabase (project gwdmsgsshvdnfrplbjiv) o `supabase db push`.
-- ============================================================

-- ============================================================
-- A. RADAR50 dismesso (rimozione definitiva del codice della campagna)
-- ============================================================
delete from public.promo_codes where upper(codice) = 'RADAR50';

-- Le funzioni dedicate al vecchio codice non devono restare raggiungibili: nessun
-- percorso applicativo le usa più (checkout/webhook usano quelle create sotto).
drop function if exists public.valida_coupon_radar50(uuid);
drop function if exists public.registra_uso_coupon_radar50(uuid, text);

-- ============================================================
-- B. SCUOLERADAR50: codice unico di sconto attivo
-- ============================================================
insert into public.promo_codes (codice, tipo, percentuale, piano, durata, monouso, scade_il, attivo)
values ('SCUOLERADAR50', 'sconto', 50, 'pro', '1anno', true, null, true)
on conflict (codice) do update
  set tipo        = 'sconto',
      percentuale = 50,
      piano       = 'pro',
      durata      = '1anno',
      monouso     = true,
      -- Nessuna scadenza ASSOLUTA: la finestra è per-utente (40 giorni dalla sua
      -- registrazione, calcolata in valida_coupon_scuoleradar50).
      scade_il    = null,
      attivo      = true;

-- ============================================================
-- E. Tabella utilizzi: da `coupon_radar50_usage` a `coupon_usage`
--    (una riga per utente = sconto già consumato, per qualsiasi codice).
-- ============================================================
do $$
begin
  if exists (
    select 1 from information_schema.tables
     where table_schema = 'public' and table_name = 'coupon_radar50_usage'
  ) and not exists (
    select 1 from information_schema.tables
     where table_schema = 'public' and table_name = 'coupon_usage'
  ) then
    alter table public.coupon_radar50_usage rename to coupon_usage;
  end if;
end $$;

create table if not exists public.coupon_usage (
  user_id             uuid primary key references auth.users (id) on delete cascade,
  used_at             timestamptz not null default now(),
  checkout_session_id text,
  coupon              text not null default 'SCUOLERADAR50'
);

comment on table public.coupon_usage is
  'Uso monouso per email dei coupon di sconto (SCUOLERADAR50). Una riga per utente = sconto già consumato.';

alter table public.coupon_usage enable row level security;
grant all on table public.coupon_usage to service_role;
grant select on table public.coupon_usage to authenticated;
grant insert on table public.coupon_usage to authenticated;

-- Policy rinominate (le vecchie portavano il nome della campagna RADAR50).
drop policy if exists "read own radar50 usage" on public.coupon_usage;
drop policy if exists "insert own radar50 usage" on public.coupon_usage;
drop policy if exists "read own coupon usage" on public.coupon_usage;
drop policy if exists "insert own coupon usage" on public.coupon_usage;

create policy "read own coupon usage" on public.coupon_usage
  for select to authenticated using (auth.uid() = user_id);

create policy "insert own coupon usage" on public.coupon_usage
  for insert to authenticated with check (auth.uid() = user_id);

-- ============================================================
-- C. Validazione dinamica SCUOLERADAR50
--    · 50% (il controllo sul piano PRO ANNUALE resta lato Edge checkout);
--    · finestra: creazione account + 40 giorni;
--    · monouso per utente;
--    · anti-abuso: stessa email, email di notifica o Telegram ID già usati da un
--      ALTRO account che ha consumato il coupon.
-- ============================================================
create or replace function public.valida_coupon_scuoleradar50(p_user_id uuid)
returns table (ok boolean, motivo text, sconto_percent integer)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_creato timestamptz;
  v_telegram text;
  v_email_secondaria text;
  v_email_primaria text;
begin
  if p_user_id is null then
    return query select false::boolean, 'Utente non valido'::text, 50::integer;
    return;
  end if;

  -- Data di registrazione iniziale (auth.users.created_at; fallback profiles).
  select coalesce(a.created_at, p.created_at)
    into v_creato
    from public.profiles p
    left join auth.users a on a.id = p.id
   where p.id = p_user_id;

  if v_creato is null then
    select created_at into v_creato from auth.users where id = p_user_id;
  end if;

  if v_creato is null then
    return query select false::boolean, 'Account non trovato'::text, 50::integer;
    return;
  end if;

  -- Finestra dinamica: 40 giorni dalla registrazione iniziale (mese PRO gratuito).
  if now() > v_creato + interval '40 days' then
    return query select false::boolean,
      'Il coupon SCUOLERADAR50 è valido solo nei primi 40 giorni dalla registrazione.'::text,
      50::integer;
    return;
  end if;

  -- Monouso per lo stesso utente.
  if exists (select 1 from public.coupon_usage u where u.user_id = p_user_id) then
    return query select false::boolean, 'Hai già utilizzato il coupon SCUOLERADAR50.'::text, 50::integer;
    return;
  end if;

  -- Anti-abuso: stessa email / email di notifica / Telegram già usati da un ALTRO account.
  select p.telegram_chat_id, p.email_notifica, p.email
    into v_telegram, v_email_secondaria, v_email_primaria
    from public.profiles p
   where p.id = p_user_id;

  if v_telegram is not null and btrim(v_telegram) <> ''
     and exists (
       select 1
         from public.coupon_usage u
         join public.profiles o on o.id = u.user_id
        where o.id <> p_user_id
          and o.telegram_chat_id is not null
          and o.telegram_chat_id = v_telegram
     ) then
    return query select false::boolean,
      'Il coupon SCUOLERADAR50 è già stato usato da un altro account collegato allo stesso Telegram.'::text,
      50::integer;
    return;
  end if;

  if v_email_secondaria is not null and btrim(v_email_secondaria) <> ''
     and exists (
       select 1
         from public.coupon_usage u
         join public.profiles o on o.id = u.user_id
        where o.id <> p_user_id
          and o.email_notifica is not null
          and lower(o.email_notifica) = lower(v_email_secondaria)
     ) then
    return query select false::boolean,
      'Il coupon SCUOLERADAR50 è già stato usato da un altro account con la stessa email di notifica.'::text,
      50::integer;
    return;
  end if;

  if v_email_primaria is not null and btrim(v_email_primaria) <> ''
     and exists (
       select 1
         from public.coupon_usage u
         join public.profiles o on o.id = u.user_id
        where o.id <> p_user_id
          and o.email is not null
          and lower(o.email) = lower(v_email_primaria)
     ) then
    return query select false::boolean,
      'Il coupon SCUOLERADAR50 è già stato usato da un altro account con la stessa email.'::text,
      50::integer;
    return;
  end if;

  -- Codice presente e attivo in promo_codes (fonte informativa/amministrativa).
  if not exists (
    select 1 from public.promo_codes c
     where upper(c.codice) = 'SCUOLERADAR50' and c.attivo
  ) then
    return query select false::boolean, 'Coupon non attivo'::text, 50::integer;
    return;
  end if;

  return query select true::boolean, ''::text, 50::integer;
end;
$$;

grant execute on function public.valida_coupon_scuoleradar50(uuid) to authenticated;
grant execute on function public.valida_coupon_scuoleradar50(uuid) to service_role;

-- ============================================================
-- D. Consumo del coupon (chiamata dal webhook dopo un pagamento riuscito)
--    Riusa la stessa validazione della fase checkout: monouso reale anche se
--    l'utente abbandona prima di pagare e riprova in un secondo momento.
-- ============================================================
create or replace function public.registra_uso_coupon_scuoleradar50(
  p_user_id uuid,
  p_checkout_session_id text default null
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ok boolean;
begin
  select v.ok into v_ok from public.valida_coupon_scuoleradar50(p_user_id) v;
  if not coalesce(v_ok, false) then
    return false;
  end if;

  insert into public.coupon_usage (user_id, checkout_session_id, coupon)
  values (p_user_id, p_checkout_session_id, 'SCUOLERADAR50')
  on conflict (user_id) do nothing;

  return true;
end;
$$;

grant execute on function public.registra_uso_coupon_scuoleradar50(uuid, text) to service_role;
grant execute on function public.registra_uso_coupon_scuoleradar50(uuid, text) to postgres;
