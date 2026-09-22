-- ============================================================
-- ANAGRAFICA COMPLETA dal wizard nel trigger di benvenuto
--
-- PROBLEMA (segnalato in produzione): un Guest compilava il wizard Radar
-- (nome, cognome, genere, età, provincia) e al momento della registrazione il
-- COGNOME (e genere/età/provincia) non finiva nel profilo: `send_step1_welcome`
-- leggeva da `user_metadata` solo `nome` e `genere`. Risultato: nome «perso» o
-- ridotto, e il mini-onboarding (`DatiProfiloModal`) che richiedeva di nuovo gli
-- stessi dati perché `profiles.cognome` risultava vuoto.
--
-- FIX: la funzione legge TUTTI i campi inviati da `signUp` (`nome`, `cognome`,
-- `genere`, `eta`, `provincia`) rispettando i vincoli della tabella:
--   · `eta` solo se numerica e tra 14 e 100 (check `profiles_eta_check`);
--   · `provincia` solo se codice di 2 lettere, normalizzato in MAIUSCOLO (check
--     `profiles_provincia_check` da 20260922120000).
-- All'upsert si COMPLETANO solo i campi vuoti (coalesce sul valore esistente):
-- un dato già impostato (admin, OAuth, modifica dell'utente) non viene toccato.
--
-- APPLICAZIONE: SQL Editor Supabase (project gwdmsgsshvdnfrplbjiv).
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
  v_meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  v_nome text;
  v_cognome text;
  v_genere text;
  v_eta text;
  v_eta_num integer;
  v_provincia text;
  v_scadenza timestamptz := now() + interval '30 days';
begin
  -- Anagrafica dal form di registrazione (options.data nel signUp del frontend).
  -- Per Google/One Tap si ripiega sui campi del provider.
  v_nome := coalesce(
    nullif(btrim(coalesce(v_meta->>'nome', '')), ''),
    nullif(btrim(coalesce(v_meta->>'name', '')), ''),
    nullif(btrim(coalesce(v_meta->>'full_name', '')), '')
  );
  -- Il COGNOME non si ricava spezzando il full_name: resta solo se dichiarato
  -- (dal wizard o dal provider), mai troncato da un nome «composito».
  v_cognome := nullif(btrim(coalesce(v_meta->>'cognome', v_meta->>'family_name', '')), '');
  v_genere := nullif(btrim(coalesce(v_meta->>'genere', '')), '');
  v_eta := nullif(btrim(coalesce(v_meta->>'eta', '')), '');
  v_eta_num := case
                 when v_eta ~ '^[0-9]{1,3}$' and v_eta::integer between 14 and 100
                   then v_eta::integer
                 else null
               end;
  v_provincia := case
                   when coalesce(v_meta->>'provincia', '') ~ '^[A-Za-z]{2}$'
                     then upper(v_meta->>'provincia')
                   else null
                 end;

  -- Onboarding: account BASE con trial PRO 30 giorni già attivo.
  -- Il piano si applica SOLO a righe nuove ancora 'base'/null: le assegnazioni
  -- esplicite successive (admin FFE/Base, checkout) non vengono mai sovrascritte.
  insert into public.profiles (
    id, email, nome, cognome, genere, eta, provincia,
    piano, abbonamento_scade_il, current_period_end, subscription_tier, subscription_status
  )
  values (
    new.id, new.email, v_nome, v_cognome, v_genere, v_eta_num, v_provincia,
    'pro', v_scadenza, v_scadenza, 'pro_annuale', 'trialing'
  )
  on conflict (id) do update set
    nome = coalesce(public.profiles.nome, excluded.nome),
    cognome = coalesce(public.profiles.cognome, excluded.cognome),
    genere = coalesce(public.profiles.genere, excluded.genere),
    eta = coalesce(public.profiles.eta, excluded.eta),
    provincia = coalesce(public.profiles.provincia, excluded.provincia),
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
      'nome', v_nome,
      'cognome', v_cognome
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
