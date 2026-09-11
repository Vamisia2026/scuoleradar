-- ============================================================
-- PROTEZIONE PIANI & UPSERT AUTH PER EMAIL
--
-- Problema: una registrazione spontanea o un login successivo NON deve MAI
-- sovrascrivere/declassare un piano assegnato dall'Admin (Free Forever / beta).
-- Inoltre, se un account viene creato con la STESSA email di un profilo
-- esistente (provider diverso), i trigger di Auth devono UNIRE l'account
-- (ereditando piano + configurazione Radar) invece di creare un doppione
-- "vuoto" ripartito da Base/Trial.
--
-- Interventi:
--   1. Helper `public.piano_protetto(piano, is_free_forever, is_beta_tester)`:
--      true per i piani assegnati dall'Admin (FFE / beta tester).
--   2. `sync_profilo_oauth` (auth.users INSERT/UPDATE meta): MERGE per email
--      (copia piano + preferenze Radar dal profilo esistente) + `do nothing`
--      sui profili già presenti (mai downgrade).
--   3. `send_step1_welcome` (auth.users INSERT): stessa logica di MERGE per
--      email; la riga già esistente NON viene mai declassata.
--   4. `reverti_prove_pro_scadute`: il revert trial→base NON tocca i piani
--      protetti (FFE/beta) né i PRO marcati (pro_tipo/Stripe).
--
-- APPLICAZIONE: SQL Editor Supabase (project gwdmsgsshvdnfrplbjiv).
-- Idempotente (create or replace).
-- ============================================================

-- ============================================================
-- 1. Helper: piano "protetto" (assegnato dall'Admin)
-- ============================================================
create or replace function public.piano_protetto(
  p_piano text,
  p_is_free_forever boolean,
  p_is_beta_tester boolean
)
returns boolean
language sql
immutable
as $$
  select coalesce(p_is_free_forever, false)
      or coalesce(p_is_beta_tester, false)
      or p_piano = 'free_forever';
$$;

comment on function public.piano_protetto(text, boolean, boolean) is
  'True se il piano è assegnato dall''Admin (Free Forever / beta tester) e non deve essere declassato dai trigger di Auth.';

-- ============================================================
-- 2. sync_profilo_oauth — MERGE per email + nessun downgrade
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
  v_donor   uuid;
  v_cols    text;
  v_scadenza timestamptz := now() + interval '30 days';
begin
  -- Preferenza: given_name + family_name; altrimenti full_name monolitico.
  if v_given is not null and v_family is not null then
    v_nome := v_given;
    v_cognome := v_family;
  elsif v_full is not null then
    v_spazio := position(' ' in v_full);
    if v_spazio > 0 then
      v_nome := left(v_full, v_spazio - 1);
      v_cognome := btrim(substr(v_full, v_spazio + 1));
    else
      v_nome := v_full;
    end if;
  end if;

  -- MERGE per EMAIL: profilo esistente con la stessa email (id diverso).
  -- Priorità: Radar configurato/attivo → piano protetto → più recente.
  select p.id into v_donor
    from public.profiles p
   where lower(coalesce(p.email, '')) = lower(coalesce(new.email, ''))
     and p.id <> new.id
   order by (coalesce(p.radar_attivo, false))::int desc,
            (case when public.piano_protetto(p.piano, p.is_free_forever, p.is_beta_tester) then 1 else 0 end) desc,
            coalesce(p.updated_at, p.created_at) desc nulls last
   limit 1;

  if v_donor is not null then
    -- Unione account: copia dinamica di TUTTE le colonne utili (piano, flag,
    -- preferenze Radar, stato abbonamento), escludendo identità/billing/notifiche
    -- che appartengono al singolo account e non vanno duplicate.
    select string_agg(quote_ident(column_name), ', ')
      into v_cols
      from information_schema.columns
     where table_schema = 'public'
       and table_name = 'profiles'
       and column_name not in (
         'id', 'email', 'created_at', 'updated_at', 'referral_code',
         'stripe_customer_id', 'stripe_subscription_id',
         'telegram_chat_id', 'telegram_username',
         'notifiche_usate', 'notifiche_anno', 'notifiche_blocco_inviato', 'notifiche_recap_inviato',
         'preavviso_rinnovo_inviato_at', 'beta_rinnovo_email_inviata', 'is_free_forever'
       );

    if v_cols is not null then
      execute format(
        'insert into public.profiles (id, email, %s) select $1, $2, %s from public.profiles where id = $3 on conflict (id) do nothing',
        v_cols, v_cols
      ) using new.id, new.email, v_donor;
    end if;
  end if;

  -- Nessun donor (o colonne non disponibili): riga minima nuovo utente (Base+trial).
  insert into public.profiles (
    id, email, piano, abbonamento_scade_il, current_period_end, subscription_tier, subscription_status
  )
  values (new.id, new.email, 'pro', v_scadenza, v_scadenza, 'pro_annuale', 'trialing')
  on conflict (id) do nothing;

  -- Coalesce: sincronizza SOLO i campi ancora vuoti (mai sovrascrive).
  update public.profiles
     set nome      = coalesce(nome, nullif(v_nome, '')),
         cognome   = coalesce(cognome, nullif(v_cognome, '')),
         avatar_url = coalesce(avatar_url, nullif(v_avatar, ''))
   where id = new.id;

  return new;
end;
$$;

-- ============================================================
-- 3. send_step1_welcome — MERGE per email + nessun downgrade
--    (crea il profilo Base+trial PRO 30gg solo se NON esiste un account
--     con la stessa email; in quel caso lo UNISCE ereditandone piano/Radar).
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
  v_donor uuid;
  v_cols text;
  v_scadenza timestamptz := now() + interval '30 days';
begin
  v_nome := coalesce(
    nullif(new.raw_user_meta_data->>'nome', ''),
    nullif(new.raw_user_meta_data->>'name', ''),
    nullif(new.raw_user_meta_data->>'full_name', '')
  );
  v_genere := nullif(new.raw_user_meta_data->>'genere', '');

  -- MERGE per EMAIL (stessa logica di sync_profilo_oauth).
  select p.id into v_donor
    from public.profiles p
   where lower(coalesce(p.email, '')) = lower(coalesce(new.email, ''))
     and p.id <> new.id
   order by (coalesce(p.radar_attivo, false))::int desc,
            (case when public.piano_protetto(p.piano, p.is_free_forever, p.is_beta_tester) then 1 else 0 end) desc,
            coalesce(p.updated_at, p.created_at) desc nulls last
   limit 1;

  if v_donor is not null then
    select string_agg(quote_ident(column_name), ', ')
      into v_cols
      from information_schema.columns
     where table_schema = 'public'
       and table_name = 'profiles'
       and column_name not in (
         'id', 'email', 'created_at', 'updated_at', 'referral_code',
         'stripe_customer_id', 'stripe_subscription_id',
         'telegram_chat_id', 'telegram_username',
         'notifiche_usate', 'notifiche_anno', 'notifiche_blocco_inviato', 'notifiche_recap_inviato',
         'preavviso_rinnovo_inviato_at', 'beta_rinnovo_email_inviata', 'is_free_forever'
       );
    if v_cols is not null then
      execute format(
        'insert into public.profiles (id, email, %s) select $1, $2, %s from public.profiles where id = $3 on conflict (id) do nothing',
        v_cols, v_cols
      ) using new.id, new.email, v_donor;
    end if;
  end if;

  -- Default: account NUOVO (Base + trial PRO 30 giorni). La riga esistente non
  -- viene MAI declassata: piano/scadenza/status restano correnti se non 'base'/null
  -- (Free Forever e assegnazioni Admin sono preservati).
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

-- I trigger restano gli stessi (puntano alle funzioni ridefinite).
drop trigger if exists trg_auth_users_step1_welcome on auth.users;
create trigger trg_auth_users_step1_welcome
  after insert on auth.users
  for each row execute function public.send_step1_welcome();

drop trigger if exists trg_auth_users_sync_oauth on auth.users;
create trigger trg_auth_users_sync_oauth
  after insert or update of raw_user_meta_data on auth.users
  for each row execute function public.sync_profilo_oauth();

-- ============================================================
-- 4. reverti_prove_pro_scadute — non declassa i piani PROTETTI
--    (Free Forever / beta) né i PRO marcati (pro_tipo o Stripe).
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
     and coalesce(is_beta_tester, false) = false
     and coalesce(is_free_forever, false) = false
     and pro_tipo is null
     and stripe_subscription_id is null;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

grant execute on function public.reverti_prove_pro_scadute() to postgres;
grant execute on function public.reverti_prove_pro_scadute() to service_role;

-- ============================================================
-- NOTE OPERATIVE
--  - I piani assegnati dall'Admin (Free Forever / beta) NON vengono mai
--    sovrascritti dai trigger di Auth né declassati dal cron dei trial.
--  - Il MERGE per email fa EREDITARE piano e preferenze Radar a un nuovo
--    accesso con email già presente (niente doppioni "vuoti" da Base/Trial).
--    Le eventuali righe unite si consolidano con:
--      npx tsx scripts/admin-profiles-manutenzione.ts --apply
--  - APPLICAZIONE: SQL Editor Supabase (project gwdmsgsshvdnfrplbjiv).
-- ============================================================


