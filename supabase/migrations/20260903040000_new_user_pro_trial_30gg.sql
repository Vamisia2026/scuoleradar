-- ============================================================
-- REVISIONE ONBOARDING: ACCOUNT BASE + TRIAL PRO 30 GIORNI
-- (sponsorizzato da PureFocus)
--
-- Sostituisce il default "PRO 1 anno" introdotto da 20260903030000
-- (funzioni dei trigger ridefinite qui): un NUOVO utente nasce con:
--   · piano                    = 'pro'   (durante i 30 giorni di trial)
--   · subscription_status      = 'trialing'
--   · subscription_tier        = 'pro_annuale'
--   · abbonamento_scade_il / current_period_end = now() + 30 giorni
--
-- Alla scadenza dei 30 giorni l'utente torna NATURALMENTE su Base grazie a:
--   · helper DB `reverti_prove_pro_scadute()` schedulato ogni giorno (cron),
--   · self-heal client (refreshProfilo): una prova scaduta viene riportata su
--     'base' al primo accesso successivo.
--
-- Il piano Free Forever (FFE) resta ESCLUSIVO e manuale (pannello admin /
-- edge function) per account VIP/beta: MAI assegnato automaticamente.
--
-- APPLICAZIONE: SQL Editor Supabase (project gwdmsgsshvdnfrplbjiv).
-- Può essere applicata anche se 20260903030000 è già stata eseguita
-- (le funzioni vengono semplicemente ridefinite).
-- ============================================================

-- ============================================================
-- 1. send_step1_welcome (auth.users AFTER INSERT): crea il profilo
--    con Base+trial PRO 30 giorni (stato trialing).
-- ============================================================
create or replace function public.send_step1_welcome()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_url text;
  v_secret text;
  v_chat text;
  v_nome text;
  v_genere text;
  v_scadenza timestamptz := now() + interval '30 days';
begin
  -- Nome e genere arrivano da user_metadata (options.data nel signUp del frontend).
  -- Per Google One Tap si ripiega su name/full_name forniti dal provider.
  v_nome := coalesce(
    nullif(new.raw_user_meta_data->>'nome', ''),
    nullif(new.raw_user_meta_data->>'name', ''),
    nullif(new.raw_user_meta_data->>'full_name', '')
  );
  v_genere := nullif(new.raw_user_meta_data->>'genere', '');

  -- Onboarding: account BASE ma con trial PRO 30 giorni già attivo.
  -- Il piano si applica SOLO a righe di nuova creazione ancora 'base'/null:
  -- le assegnazioni esplicite successive (admin FFE/Base, checkout) non vengono
  -- mai sovrascritte.
  insert into public.profiles (
    id, email, nome, genere,
    piano, abbonamento_scade_il, current_period_end, subscription_tier, subscription_status
  )
  values (
    new.id, new.email, v_nome, v_genere,
    'pro', v_scadenza, v_scadenza, 'pro_annuale', 'trialing'
  )
  on conflict (id) do update set
    nome = coalesce(excluded.nome, public.profiles.nome),
    genere = coalesce(excluded.genere, public.profiles.genere),
    piano = case
              when public.profiles.piano is null or public.profiles.piano = 'base'
                then 'pro'
              else public.profiles.piano
            end,
    abbonamento_scade_il = case
                              when public.profiles.piano is null or public.profiles.piano = 'base'
                                then excluded.abbonamento_scade_il
                              else public.profiles.abbonamento_scade_il
                            end,
    current_period_end = case
                            when public.profiles.piano is null or public.profiles.piano = 'base'
                              then excluded.current_period_end
                            else public.profiles.current_period_end
                          end,
    subscription_tier = case
                          when public.profiles.piano is null or public.profiles.piano = 'base'
                            then excluded.subscription_tier
                          else public.profiles.subscription_tier
                        end,
    subscription_status = case
                            when public.profiles.piano is null or public.profiles.piano = 'base'
                              then excluded.subscription_status
                            else public.profiles.subscription_status
                          end;

  select value into v_url from public.app_settings where key = 'send_notification_url';
  select value into v_secret from public.app_settings where key = 'send_notification_secret';
  if v_url is null or v_secret is null then
    return new;
  end if;

  select telegram_chat_id into v_chat from public.profiles where id = new.id;

  perform net.http_post(
    v_url,
    jsonb_build_object(
      'tipo', 'step1',
      'userId', new.id,
      'email', new.email,
      'chatId', v_chat,
      'genere', v_genere,
      'nome', v_nome
    ),
    '{}'::jsonb,
    jsonb_build_object('Content-Type', 'application/json', 'x-send-secret', v_secret)
  );
  return new;
end;
$$;

-- Il trigger resta lo stesso (punta alla funzione send_step1_welcome)
drop trigger if exists trg_auth_users_step1_welcome on auth.users;
create trigger trg_auth_users_step1_welcome
  after insert on auth.users
  for each row execute function public.send_step1_welcome();

-- ============================================================
-- 2. sync_profilo_oauth (auth.users INSERT/UPDATE raw_user_meta_data)
--    — stessa logica: riga profilo nuova → Base + trial PRO 30 giorni.
--    `on conflict do nothing`: nessuna modifica ai piani già assegnati.
-- ============================================================
create or replace function public.sync_profilo_oauth()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  v_given  text := nullif(btrim(coalesce(meta->>'given_name', '')), '');
  v_family text := nullif(btrim(coalesce(meta->>'family_name', '')), '');
  v_full   text := nullif(btrim(coalesce(meta->>'full_name', '')), '');
  v_avatar text := nullif(btrim(coalesce(meta->>'avatar_url', meta->>'picture', '')), '');
  v_nome    text := null;
  v_cognome text := null;
  v_spazio  integer;
  v_scadenza timestamptz := now() + interval '30 days';
begin
  -- Preferenza: given_name + family_name (dati Google più affidabili).
  if v_given is not null and v_family is not null then
    v_nome := v_given;
    v_cognome := v_family;
  elsif v_full is not null then
    -- full_name monolitico (es. "Giuseppe Pampararo") → primo token = nome.
    v_spazio := position(' ' in v_full);
    if v_spazio > 0 then
      v_nome := left(v_full, v_spazio - 1);
      v_cognome := btrim(substr(v_full, v_spazio + 1));
    else
      v_nome := v_full;
    end if;
  end if;

  -- Riga profilo garantita anche se l'utente non è ancora stato on-boardizzato:
  -- nuovo utente → trial PRO 30 giorni; utente esistente → nessuna modifica.
  insert into public.profiles (
    id, email,
    piano, abbonamento_scade_il, current_period_end, subscription_tier, subscription_status
  )
  values (
    new.id, new.email,
    'pro', v_scadenza, v_scadenza, 'pro_annuale', 'trialing'
  )
  on conflict (id) do nothing;

  -- Coalesce: sincronizza SOLO i campi ancora vuoti.
  update public.profiles
     set nome      = coalesce(nome, nullif(v_nome, '')),
         cognome   = coalesce(cognome, nullif(v_cognome, '')),
         avatar_url = coalesce(avatar_url, nullif(v_avatar, ''))
   where id = new.id;

  return new;
end;
$$;

-- Il trigger resta lo stesso (punta alla funzione sync_profilo_oauth)
drop trigger if exists trg_auth_users_sync_oauth on auth.users;
create trigger trg_auth_users_sync_oauth
  after insert or update of raw_user_meta_data on auth.users
  for each row execute function public.sync_profilo_oauth();

-- ============================================================
-- 3. RITORNO NATURALE A BASE dopo la scadenza del trial PRO 30 gg
--    (i VIP/beta con assegnazione esplicita non vengono mai toccati).
-- ============================================================
create or replace function public.reverti_prove_pro_scadute()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer := 0;
begin
  update public.profiles
     set piano                 = 'base',
         subscription_tier     = 'base',
         subscription_status   = 'inactive',
         current_period_end    = null,
         abbonamento_scade_il  = null
   where piano = 'pro'
     and subscription_status = 'trialing'
     and abbonamento_scade_il is not null
     and abbonamento_scade_il < now()
     and coalesce(is_beta_tester, false) = false;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

grant execute on function public.reverti_prove_pro_scadute() to postgres;
grant execute on function public.reverti_prove_pro_scadute() to service_role;

-- Cron giornaliero (idempotente): alle 03:30 ogni notte riporta su Base i
-- trial PRO scaduti (tranne beta/VIP gestiti a mano come Free Forever).
select cron.unschedule('revert-prove-pro-scadute')
  where exists (select 1 from cron.job where jobname = 'revert-prove-pro-scadute');

select cron.schedule('revert-prove-pro-scadute', '30 3 * * *', $$ select public.reverti_prove_pro_scadute(); $$);

-- ============================================================
-- NOTA: nessun backfill sugli utenti esistenti. FFE = solo manuale (admin).
-- ============================================================

