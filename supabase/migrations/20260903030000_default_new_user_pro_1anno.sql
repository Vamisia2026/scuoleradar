-- ============================================================
-- DEFAULT PIANO ONBOARDING NUOVI UTENTI: PRO 1 ANNO (365 gg)
--
-- Obiettivo (cambio di prodotto):
--   ⚠️ DEPRECATO / SUPERATO: questo file è stato sostituito da
--      20260903040000_new_user_pro_trial_30gg.sql
--      (nuovo utente = Base + TRIAL PRO 30 giorni sponsorizzato PureFocus).
--      Se eseguito comunque prima di 03040000, le funzioni trigger vengono poi
--      ridefinite da 03040000: il default finale resta il trial di 30 giorni.
--   · Nuovo utente registrato (email, Google OAuth, admin) → riceve
--     automaticamente il piano PRO per 1 ANNO (365 giorni dalla registrazione),
--     NON più un piano "lifetime free" / Free Forever implicito.
--   · Free Forever (FFE) resta una concessione ESCLUSIVA e manuale del pannello
--     admin / edge function per account VIP specifici (mai default automatico).
--
-- Implementazione: i trigger esistenti su `auth.users` (che creano la riga
-- profiles all'iscrizione) vengono aggiornati perché la nuova riga nasca già
-- con piano='pro', subscription_tier='pro_annuale', subscription_status='active'
-- e scadenza abbonamento_scade_il = current_period_end = now()+365 giorni.
-- Le assegnazioni esplicite fatte DOPO la creazione (admin → Free Forever/Base,
-- checkout Stripe, edge function) sovrascrivono questo default: la migrazione
-- NON tocca gli utenti già esistenti.
--
-- APPLICAZIONE: SQL Editor Supabase (project gwdmsgsshvdnfrplbjiv), DOPO le
-- migrazioni 20260902234600 (account bridge) e 20260902230000 (sync oauth).
-- ============================================================

-- ============================================================
-- 1. send_step1_welcome (auth.users AFTER INSERT) — profilo + piano PRO 1 anno
--    (versione 20260901010000 + piano onboarding).
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
  v_scadenza timestamptz := now() + interval '365 days';
begin
  -- Nome e genere arrivano da user_metadata (options.data nel signUp del frontend).
  -- Per Google One Tap si ripiega su name/full_name forniti dal provider.
  v_nome := coalesce(
    nullif(new.raw_user_meta_data->>'nome', ''),
    nullif(new.raw_user_meta_data->>'name', ''),
    nullif(new.raw_user_meta_data->>'full_name', '')
  );
  v_genere := nullif(new.raw_user_meta_data->>'genere', '');

  -- Piano onboarding di default per i NUOVI utenti: PRO 1 anno (365 gg).
  -- In caso di conflitto (riga creata nello stesso INSERT da sync_profilo_oauth)
  -- si aggiorna il piano SOLO se non è ancora stato assegnato (null/'base'),
  -- così non si toccano mai assegnazioni esplicite di admin/checkout.
  insert into public.profiles (
    id, email, nome, genere,
    piano, abbonamento_scade_il, current_period_end, subscription_tier, subscription_status
  )
  values (
    new.id, new.email, v_nome, v_genere,
    'pro', v_scadenza, v_scadenza, 'pro_annuale', 'active'
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
--    — stessa logica: la riga profilo (se creata qui prima di step1) nasce
--    già col piano PRO 1 anno. `on conflict do nothing`: nessun downgrade dei
--    piani già assegnati.
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
  v_scadenza timestamptz := now() + interval '365 days';
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
  -- nuovo utente → default PRO 1 anno; utente esistente → nessuna modifica.
  insert into public.profiles (
    id, email,
    piano, abbonamento_scade_il, current_period_end, subscription_tier, subscription_status
  )
  values (
    new.id, new.email,
    'pro', v_scadenza, v_scadenza, 'pro_annuale', 'active'
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
-- NOTA: nessun backfill su utenti esistenti — il nuovo default vale SOLO
-- per le nuove iscrizioni. Free Forever resta assegnabile a mano (admin).
-- ============================================================

