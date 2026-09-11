-- ============================================================
-- CICLO DI VITA ABBONAMENTO — PROMEMORIA DI RINNOVO (finestra 3–5 giorni)
--
-- POLICY TRIAL (già attiva da 20260903040000_new_user_pro_trial_30gg):
--   · Un NUOVO utente nasce con piano 'pro', status 'trialing' e scadenza a
--     now() + 30 giorni (= 1 mese gratuito sponsorizzato PureFocus).
--   · Alla scadenza la prova rientra NATURALMENTE su Base
--     (cron 'revert-prove-pro-scadute' + self-heal client refreshProfilo).
--
-- NUOVO — PROMEMORIA DI RINNOVO (questo file):
--   cron giornaliero 'rinnovo-preavvisi-3-5g' → public.invia_preavvisi_rinnovo()
--   che individua TUTTI gli utenti (trial PRO in scadenza O PRO a pagamento in
--   scadenza) la cui abbonamento_scade_il cade tra 3 e 5 giorni e invia un
--   promemoria su ENTRAMBI i canali tramite l'Edge Function send-notification
--   (email Resend + Telegram, se telegram_chat_id è collegato):
--     · status 'trialing'      → tipo 'rinnovo_preavviso_prova' (fine mese gratis)
--     · qualsiasi altro status → tipo 'rinnovo_preavviso_pro'   (rinnovo PRO)
--
-- IDEMPOTENZA: profiles.preavviso_rinnovo_inviato_at (una sola comunicazione
-- per ciclo di vita). Al rinnovo (nuova scadenza fuori finestra) o al cambio
-- piano il flag viene azzerato dalla funzione stessa (self-heal), così il
-- promemoria si riarma per il ciclo successivo.
--
-- ESCLUSIONI: beta tester (flusso dedicato 'GRATIS A VITA') e piano
-- 'free_forever' (rinnovo automatico a 0€, gestito da 20260902234800).
--
-- APPLICAZIONE: supabase db push / SQL Editor (project gwdmsgsshvdnfrplbjiv).
-- ============================================================

-- ============================================================
-- 1. Flag di idempotenza del promemoria di rinnovo
-- ============================================================
alter table public.profiles
  add column if not exists preavviso_rinnovo_inviato_at timestamptz;

comment on column public.profiles.preavviso_rinnovo_inviato_at is
  'Ultimo invio del promemoria di rinnovo (finestra 3-5 giorni prima della scadenza trial/PRO). NULL = promemoria ancora da inviare.';

-- ============================================================
-- 2. invia_preavvisi_rinnovo()
-- ============================================================
create or replace function public.invia_preavvisi_rinnovo()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_url     text;
  v_secret  text;
  v_count   integer := 0;
  v_user    record;
  v_giorni  integer;
  v_tipo    text;
begin
  select value into v_url from public.app_settings where key = 'send_notification_url';
  select value into v_secret from public.app_settings where key = 'send_notification_secret';
  if v_url is null or v_secret is null then
    raise notice 'app_settings mancanti (send_notification_url / send_notification_secret): preavvisi di rinnovo non inviati';
    return 0;
  end if;

  -- Self-heal: se il rinnovo è già avvenuto (scadenza riportata fuori finestra)
  -- o il piano non è più PRO, il flag si azzera → il promemoria si riarma per
  -- il prossimo ciclo di vita.
  update public.profiles
     set preavviso_rinnovo_inviato_at = null
   where preavviso_rinnovo_inviato_at is not null
     and (
       piano <> 'pro'
       or abbonamento_scade_il is null
       or abbonamento_scade_il > now() + interval '5 days'
     );

  -- Finestra: scadenza tra 3 e 5 giorni (estremi inclusi). Il cron gira ogni
  -- giorno, quindi ogni utente viene intercettato almeno una volta; il flag di
  -- idempotenza evita invii ripetuti negli altri giorni della finestra.
  for v_user in
    select
      p.id,
      p.email,
      p.nome,
      p.genere,
      p.abbonamento_scade_il,
      lower(coalesce(p.subscription_status, '')) as stato
      from public.profiles p
     where p.piano = 'pro'
       and coalesce(p.is_beta_tester, false) = false
       and p.abbonamento_scade_il is not null
       and p.abbonamento_scade_il >= now() + interval '3 days'
       and p.abbonamento_scade_il <= now() + interval '5 days'
       and p.preavviso_rinnovo_inviato_at is null
  loop
    -- Giorni rimanenti arrotondati per eccesso (3, 4 o 5): usati nella copy.
    v_giorni := greatest(
      0,
      ceil(extract(epoch from (v_user.abbonamento_scade_il - now())) / 86400.0)::integer
    );

    -- Trial PRO (mese gratuito) vs PRO a pagamento: copy distinta lato Edge.
    v_tipo := case
                when v_user.stato = 'trialing' then 'rinnovo_preavviso_prova'
                else 'rinnovo_preavviso_pro'
              end;

    perform net.http_post(
      v_url,
      jsonb_build_object(
        'tipo', v_tipo,
        'userId', v_user.id,
        'email', coalesce(v_user.email, ''),
        'nome', coalesce(v_user.nome, ''),
        'genere', coalesce(v_user.genere, ''),
        'piano', 'pro',
        'scadenza', to_char(v_user.abbonamento_scade_il, 'DD/MM/YYYY'),
        'giorni', v_giorni::text
      ),
      '{}'::jsonb,
      jsonb_build_object('Content-Type', 'application/json', 'x-send-secret', v_secret)
    );

    -- Una sola comunicazione per ciclo di vita.
    update public.profiles
       set preavviso_rinnovo_inviato_at = now()
     where id = v_user.id;

    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

grant execute on function public.invia_preavvisi_rinnovo() to postgres;
grant execute on function public.invia_preavvisi_rinnovo() to service_role;

-- ============================================================
-- 3. Cron giornaliero (idempotente): 09:00 — stesso slot degli avvisi
--    multistep, così il promemoria parte prima del downgrade a Base (03:30)
--    e in orario di lettura.
-- ============================================================
select cron.unschedule('rinnovo-preavvisi-3-5g')
  where exists (select 1 from cron.job where jobname = 'rinnovo-preavvisi-3-5g');

select cron.schedule('rinnovo-preavvisi-3-5g', '0 9 * * *', $$ select public.invia_preavvisi_rinnovo(); $$);
