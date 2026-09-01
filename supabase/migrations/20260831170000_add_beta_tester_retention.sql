-- ============================================================
-- Beta Tester: retention & "Rinnovo Omaggio a Vita"
-- 1) Colonne su profiles:
--      · is_beta_tester            → true per gli utenti con codice beta (omaggio)
--      · beta_rinnovo_email_inviata → true dopo l'invio della email di rinnovo
--    (Lifetime = abbonamento_scade_il IS NULL: niente più scadenza.)
-- 2) attiva_codice_promo aggiornata: un codice con tipo='beta' porta anche
--    is_beta_tester = true.
-- 3) Backfill: chi ha già attivato un codice beta risulta Beta Tester.
-- 4) Helper schedulato beta_rinnovo_omaggio_vita(): ogni giorno, per i Beta
--    Tester con PRO in scadenza (entro 30 giorni) e non ancora avvisati,
--    invia via Edge Function send-notification (→ Resend) la email
--    "Rinnovo Omaggio a Vita" e converte l'accesso a LIFETIME
--    (abbonamento_scade_il = NULL): il servizio non si interrompe mai.
-- ============================================================

-- ============================================================
-- 1. Colonne di stato Beta Tester
-- ============================================================
alter table public.profiles
  add column if not exists is_beta_tester boolean not null default false;

alter table public.profiles
  add column if not exists beta_rinnovo_email_inviata boolean not null default false;

comment on column public.profiles.is_beta_tester is
  'Beta Tester: accesso PRO omaggio. Non retrocedere mai con i webhook Stripe; a fine periodo scatta il Rinnovo Omaggio a Vita.';

comment on column public.profiles.beta_rinnovo_email_inviata is
  'True dopo l invio della email "Rinnovo Omaggio a Vita" (una tantum per ciclo beta).';

comment on column public.profiles.abbonamento_scade_il is
  'Data scadenza abbonamento (NULL = lifetime / Rinnovo Omaggio a Vita per i Beta Tester).';

-- ============================================================
-- 2. attiva_codice_promo: marca i Beta Tester
--    (stessa firma/return type → CREATE OR REPLACE senza DROP)
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
  --   durata '1anno'    → scadenza = now() + 1 anno (poi scatta il rinnovo omaggio)
  --   durata 'lifetime' → nessuna scadenza (abbonamento_scade_il = NULL)
  -- I codici con tipo='beta' marcano l'utente come Beta Tester (mai retrocedere).
  update public.profiles
     set piano = v_pc.piano,
         abbonamento_scade_il = case
           when v_pc.durata = '1anno' then now() + interval '1 year'
           else null
         end,
         is_beta_tester = case
           when v_pc.tipo = 'beta' then true
           else is_beta_tester
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
-- 3. Backfill: chi ha già attivato un codice beta risulta Beta Tester
-- ============================================================
update public.profiles p
   set is_beta_tester = true
  from public.promo_codes pc
 where pc.usato_da = p.id
   and pc.tipo = 'beta'
   and p.is_beta_tester = false;

-- ============================================================
-- 4. beta_rinnovo_omaggio_vita()
-- Helper schedulato (pg_cron): per ogni Beta Tester con PRO in
-- scadenza (entro 30 giorni) e non ancora avvisato:
--   · chiama l'Edge Function `send-notification` (tipo 'beta_rinnovo')
--     che invia la email "Rinnovo Omaggio a Vita" via Resend;
--   · converte subito l'accesso a LIFETIME (abbonamento_scade_il = NULL)
--     e segna beta_rinnovo_email_inviata = true.
-- Il flusso è identico a dispatch_step5_due (pg_net + secret in app_settings).
-- ============================================================
create or replace function public.beta_rinnovo_omaggio_vita()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_url text;
  v_secret text;
  v_count integer := 0;
  v_user record;
begin
  select value into v_url from public.app_settings where key = 'send_notification_url';
  select value into v_secret from public.app_settings where key = 'send_notification_secret';
  if v_url is null or v_secret is null then
    raise notice 'app_settings mancanti (send_notification_url / send_notification_secret)';
    return 0;
  end if;

  for v_user in
    select p.id, p.email, p.nome, p.abbonamento_scade_il
      from public.profiles p
     where p.is_beta_tester = true
       and p.piano = 'pro'
       and p.abbonamento_scade_il is not null
       and p.abbonamento_scade_il <= now() + interval '30 days'
       and p.beta_rinnovo_email_inviata = false
  loop
    perform net.http_post(
      v_url,
      jsonb_build_object(
        'tipo', 'beta_rinnovo',
        'userId', v_user.id,
        'email', coalesce(v_user.email, ''),
        'nome', coalesce(v_user.nome, ''),
        'scadenza', to_char(v_user.abbonamento_scade_il, 'DD/MM/YYYY')
      ),
      '{}'::jsonb,
      jsonb_build_object('Content-Type', 'application/json', 'x-send-secret', v_secret)
    );

    -- Rinnovo Omaggio a Vita: l'accesso diventa permanente (niente più scadenza).
    update public.profiles
       set beta_rinnovo_email_inviata = true,
           abbonamento_scade_il = null
     where id = v_user.id;

    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

grant execute on function public.beta_rinnovo_omaggio_vita() to postgres;

-- Programma il controllo ogni giorno alle 09:00 (fuso italiano).
-- Idempotente: rimuove un eventuale job precedente con lo stesso nome.
select cron.unschedule('beta-rinnovo-omaggio-vita')
  where exists (select 1 from cron.job where jobname = 'beta-rinnovo-omaggio-vita');

select cron.schedule('beta-rinnovo-omaggio-vita', '0 9 * * *', $$ select public.beta_rinnovo_omaggio_vita(); $$);
