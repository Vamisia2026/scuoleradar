-- ============================================================
-- COUPON RADAR50 (50% PRO annuale) + FLOW GUARD DRIP PRO
--
-- 1) coupon_radar50_usage: uso monouso per utente (anti-abuso).
-- 2) valida_coupon_radar50(user_id): dinamico — valido SOLO se l'account ha
--    meno di 40 giorni (dalla registrazione), mai usato prima, e nessun ALTRO
--    account con lo stesso Telegram ID o email secondaria (email_notifica)
--    l'ha già usato.
-- 3) registra_uso_coupon_radar50(user_id, session): chiamata dal webhook dopo
--    il pagamento riuscito (doppia sicurezza anti-replay).
-- 4) cancella_drip_pro(user_id) + trigger: al passaggio a PRO (o Free Forever)
--    tutte le email drip/promozionali/scadenza pendenti vengono annullate
--    (flag di sequenza chiusi) → parte lo stato/email di benvenuto PRO.
--
-- APPLICAZIONE: SQL Editor Supabase (project gwdmsgsshvdnfrplbjiv).
-- ============================================================

-- ============================================================
-- 1. Tabella utilizzi (monouso reale per utente)
-- ============================================================
create table if not exists public.coupon_radar50_usage (
  user_id             uuid primary key references auth.users (id) on delete cascade,
  used_at             timestamptz not null default now(),
  checkout_session_id text,
  coupon              text not null default 'RADAR50'
);

comment on table public.coupon_radar50_usage is
  'Uso monouso del coupon RADAR50 (50% PRO annuale). Una riga per utente = sconto già consumato.';

alter table public.coupon_radar50_usage enable row level security;
grant all on table public.coupon_radar50_usage to service_role;
grant select on table public.coupon_radar50_usage to authenticated;
grant insert on table public.coupon_radar50_usage to authenticated;

create policy "read own radar50 usage" on public.coupon_radar50_usage
  for select to authenticated using (auth.uid() = user_id);

create policy "insert own radar50 usage" on public.coupon_radar50_usage
  for insert to authenticated with check (auth.uid() = user_id);

-- ============================================================
-- 2. Validazione dinamica RADAR50
--    · solo piano PRO ANNUALE (controllo lato Edge checkout);
--    · finestra: created_at utente + 40 giorni (dalla registrazione iniziale);
--    · monouso per utente;
--    · anti-abuso: blocca se lo stesso Telegram ID / email secondaria è già
--      associato a un altro account che ha usato il coupon.
-- ============================================================
create or replace function public.valida_coupon_radar50(p_user_id uuid)
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
    -- Profilo non ancora creato: ricava dal solo auth.users.
    select created_at into v_creato from auth.users where id = p_user_id;
  end if;

  if v_creato is null then
    return query select false::boolean, 'Account non trovato'::text, 50::integer;
    return;
  end if;

  -- Finestra dinamica: 40 giorni dalla registrazione iniziale.
  if now() > v_creato + interval '40 days' then
    return query select false::boolean,
      'Il coupon RADAR50 è valido solo nei primi 40 giorni dalla registrazione.'::text,
      50::integer;
    return;
  end if;

  -- Monouso per lo stesso utente.
  if exists (select 1 from public.coupon_radar50_usage u where u.user_id = p_user_id) then
    return query select false::boolean, 'Hai già utilizzato il coupon RADAR50.'::text, 50::integer;
    return;
  end if;

  -- Anti-abuso: stesso Telegram ID / email secondaria già usati da un ALTRO account.
  select p.telegram_chat_id, p.email_notifica, p.email
    into v_telegram, v_email_secondaria, v_email_primaria
    from public.profiles p
   where p.id = p_user_id;

  if v_telegram is not null and btrim(v_telegram) <> ''
     and exists (
       select 1
         from public.coupon_radar50_usage u
         join public.profiles o on o.id = u.user_id
        where o.id <> p_user_id
          and o.telegram_chat_id is not null
          and o.telegram_chat_id = v_telegram
     ) then
    return query select false::boolean,
      'Il coupon RADAR50 è già stato usato da un altro account collegato allo stesso Telegram.'::text,
      50::integer;
    return;
  end if;

  if v_email_secondaria is not null and btrim(v_email_secondaria) <> ''
     and exists (
       select 1
         from public.coupon_radar50_usage u
         join public.profiles o on o.id = u.user_id
        where o.id <> p_user_id
          and o.email_notifica is not null
          and lower(o.email_notifica) = lower(v_email_secondaria)
     ) then
    return query select false::boolean,
      'Il coupon RADAR50 è già stato usato da un altro account con la stessa email di backup.'::text,
      50::integer;
    return;
  end if;

  if v_email_primaria is not null and btrim(v_email_primaria) <> ''
     and exists (
       select 1
         from public.coupon_radar50_usage u
         join auth.users oa on oa.id = u.user_id
        where oa.id <> p_user_id
          and oa.email is not null
          and lower(oa.email) = lower(v_email_primaria)
     ) then
    return query select false::boolean,
      'Il coupon RADAR50 è già stato usato da un altro account con la stessa email.'::text,
      50::integer;
    return;
  end if;

  return query select true::boolean, 'Coupon valido'::text, 50::integer;
end;
$$;

grant execute on function public.valida_coupon_radar50(uuid) to authenticated;
grant execute on function public.valida_coupon_radar50(uuid) to service_role;


-- ============================================================
-- 3. Registrazione uso (webhook, DOPO pagamento riuscito)
--    Idempotente: ritorna false se già usato da questo utente o da un account
--    con lo stesso Telegram/email (doppia sicurezza anti-replay).
-- ============================================================
create or replace function public.registra_uso_coupon_radar50(
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
  -- Riusa la stessa validazione della fase checkout (finestra 40gg + anti-abuso).
  select ok into v_ok from public.valida_coupon_radar50(p_user_id);
  if not coalesce(v_ok, false) then
    return false;
  end if;

  insert into public.coupon_radar50_usage (user_id, checkout_session_id, coupon)
  values (p_user_id, p_checkout_session_id, 'RADAR50')
  on conflict (user_id) do nothing;

  return found;
end;
$$;

grant execute on function public.registra_uso_coupon_radar50(uuid, text) to service_role;
grant execute on function public.registra_uso_coupon_radar50(uuid, text) to postgres;

-- ============================================================
-- 4. FLOW GUARD: al passaggio a PRO (o Free Forever) annulla ogni email
--    drip/promozionale/scadenza pendente → stato di benvenuto PRO.
-- ============================================================
create or replace function public.cancella_drip_pro(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.profiles
     set notifiche_blocco_inviato = true,
         notifiche_recap_inviato  = true,
         step4_inviata_at         = coalesce(step4_inviata_at, now()),
         scadenza_avviso_stadio   = coalesce(scadenza_avviso_stadio, 'nessuno')
   where id = p_user_id;
end;
$$;

grant execute on function public.cancella_drip_pro(uuid) to service_role;
grant execute on function public.cancella_drip_pro(uuid) to postgres;

-- Trigger automatico: qualunque percorso porti il piano a 'pro'/'free_forever'
-- chiude subito le sequenze drip (i cron step4/5/6 e gli avvisi di scadenza
-- non selezioneranno più l'utente; l'email di benvenuto parte dal webhook/trigger
-- di attivazione già esistente).
create or replace function public.stop_drip_on_pro_trigger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.piano in ('pro', 'free_forever') then
    new.notifiche_blocco_inviato := true;
    new.notifiche_recap_inviato  := true;
    new.step4_inviata_at         := coalesce(new.step4_inviata_at, now());
    new.scadenza_avviso_stadio   := coalesce(new.scadenza_avviso_stadio, 'nessuno');
  end if;
  return new;
end;
$$;

drop trigger if exists trg_profiles_stop_drip_on_pro on public.profiles;
create trigger trg_profiles_stop_drip_on_pro
  before update of piano on public.profiles
  for each row execute function public.stop_drip_on_pro_trigger();

-- ============================================================
-- Nota: nessun backfill automatico. Gli utenti già PRO attivi oggi non vengono
-- toccati; il guard vale per ogni futura attivazione/upgrade.
-- ============================================================

