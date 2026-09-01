-- ============================================================
-- Avvisi di scadenza MULTI-STEP (utenti standard + Beta Tester)
--
-- Timeline utenti STANDARD (PRO a pagamento):
--   · 7 giorni prima della scadenza → scadenza_preavviso_7d
--   · 3 giorni prima               → scadenza_preavviso_3d
--   · 1 giorno prima               → scadenza_preavviso_1d
--   · giorno della scadenza (Day 0) → scadenza_finale (downgrade a BASE)
--
-- Timeline BETA TESTER ("Gratis a Vita"):
--   · 7 giorni prima della scadenza → beta_rinnovo_preavviso
--     (thank-you: "Sei tra i primi a sostenerci: il tuo account PRO
--      verrà rinnovato GRATIS A VITA")
--   · giorno della scadenza (Day 0) → abbonamento_scade_il = NULL (lifetime)
--     + beta_rinnovo_conferma ("Congratulazioni, il tuo account PRO è stato
--       rinnovato con successo!")
--
-- Lo stato di avanzamento è tracciato in profiles.scadenza_avviso_stadio:
--   utenti standard: null → '7d' → '3d' → '1d' → 'finale'
--   beta tester:     null → 'beta_preavviso' → 'beta_conferma'
-- ============================================================

-- ============================================================
-- 1. Tracker dello stadio + backfill dal vecchio flusso
-- ============================================================
alter table public.profiles
  add column if not exists scadenza_avviso_stadio text;

comment on column public.profiles.scadenza_avviso_stadio is
  'Stadio degli avvisi di scadenza inviati (standard: 7d/3d/1d/finale; beta: beta_preavviso/beta_conferma)';

-- Backfill: chi aveva già ricevuto il vecchio "Rinnovo Omaggio a Vita" risulta confermato.
update public.profiles
   set scadenza_avviso_stadio = 'beta_conferma'
 where is_beta_tester = true
   and beta_rinnovo_email_inviata = true
   and scadenza_avviso_stadio is null;

-- ============================================================
-- 2. invia_avvisi_scadenza_abbonamento()
-- Scheduler unico per la timeline di scadenza:
--   · Beta Tester: preavviso a 7 giorni (thank-you) e al Day 0
--     conversione a LIFETIME + email di conferma.
--   · Utenti standard: avvisi a 7/3/1 giorni e finale al Day 0
--     (downgrade a piano BASE).
-- Flusso identico a dispatch_step5_due / beta_rinnovo_omaggio_vita:
-- pg_net → Edge Function send-notification (secret in app_settings).
-- ============================================================
create or replace function public.invia_avvisi_scadenza_abbonamento()
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
    select p.id, p.email, p.nome, p.is_beta_tester, p.abbonamento_scade_il, p.scadenza_avviso_stadio
      from public.profiles p
     where p.piano = 'pro'
       and p.abbonamento_scade_il is not null
       and (
         (p.is_beta_tester = true and (
             (p.scadenza_avviso_stadio is null and p.abbonamento_scade_il <= now() + interval '7 days')
          or (p.scadenza_avviso_stadio = 'beta_preavviso' and p.abbonamento_scade_il <= now())
         ))
         or
         (p.is_beta_tester = false and (
             (p.scadenza_avviso_stadio is null and p.abbonamento_scade_il <= now() + interval '7 days')
          or (p.scadenza_avviso_stadio = '7d' and p.abbonamento_scade_il <= now() + interval '3 days')
          or (p.scadenza_avviso_stadio in ('7d','3d') and p.abbonamento_scade_il <= now() + interval '1 day')
          or (p.scadenza_avviso_stadio in ('7d','3d','1d') and p.abbonamento_scade_il <= now())
         ))
       )
  loop

    if v_user.is_beta_tester then
      if v_user.abbonamento_scade_il <= now() then
        -- DAY 0 beta: accesso a vita + email di conferma rinnovo.
        perform net.http_post(
          v_url,
          jsonb_build_object(
            'tipo', 'beta_rinnovo_conferma',
            'userId', v_user.id,
            'email', coalesce(v_user.email, ''),
            'nome', coalesce(v_user.nome, '')
          ),
          '{}'::jsonb,
          jsonb_build_object('Content-Type', 'application/json', 'x-send-secret', v_secret)
        );
        update public.profiles
           set abbonamento_scade_il = null,
               beta_rinnovo_email_inviata = true,
               scadenza_avviso_stadio = 'beta_conferma'
         where id = v_user.id;
      elsif v_user.scadenza_avviso_stadio is null then
        -- 7 giorni beta: thank-you "Gratis a Vita" (preavviso).
        perform net.http_post(
          v_url,
          jsonb_build_object(
            'tipo', 'beta_rinnovo_preavviso',
            'userId', v_user.id,
            'email', coalesce(v_user.email, ''),
            'nome', coalesce(v_user.nome, ''),
            'scadenza', to_char(v_user.abbonamento_scade_il, 'DD/MM/YYYY')
          ),
          '{}'::jsonb,
          jsonb_build_object('Content-Type', 'application/json', 'x-send-secret', v_secret)
        );
        update public.profiles
           set scadenza_avviso_stadio = 'beta_preavviso'
         where id = v_user.id;
      end if;
    else
      -- Utente standard (PRO a pagamento).
      if v_user.abbonamento_scade_il <= now() then
        -- DAY 0: avviso finale + downgrade a BASE.
        perform net.http_post(
          v_url,
          jsonb_build_object('tipo', 'scadenza_finale', 'userId', v_user.id, 'email', coalesce(v_user.email, ''), 'nome', coalesce(v_user.nome, '')),
          '{}'::jsonb,
          jsonb_build_object('Content-Type', 'application/json', 'x-send-secret', v_secret)
        );
        update public.profiles
           set piano = 'base',
               scadenza_avviso_stadio = 'finale'
         where id = v_user.id;
      elsif v_user.scadenza_avviso_stadio in ('7d','3d') and v_user.abbonamento_scade_il <= now() + interval '1 day' then
        perform net.http_post(v_url, jsonb_build_object('tipo', 'scadenza_preavviso_1d', 'userId', v_user.id, 'email', coalesce(v_user.email, ''), 'nome', coalesce(v_user.nome, ''), 'scadenza', to_char(v_user.abbonamento_scade_il, 'DD/MM/YYYY')), '{}'::jsonb, jsonb_build_object('Content-Type', 'application/json', 'x-send-secret', v_secret));
        update public.profiles set scadenza_avviso_stadio = '1d' where id = v_user.id;
      elsif v_user.scadenza_avviso_stadio = '7d' and v_user.abbonamento_scade_il <= now() + interval '3 days' then
        perform net.http_post(v_url, jsonb_build_object('tipo', 'scadenza_preavviso_3d', 'userId', v_user.id, 'email', coalesce(v_user.email, ''), 'nome', coalesce(v_user.nome, ''), 'scadenza', to_char(v_user.abbonamento_scade_il, 'DD/MM/YYYY')), '{}'::jsonb, jsonb_build_object('Content-Type', 'application/json', 'x-send-secret', v_secret));
        update public.profiles set scadenza_avviso_stadio = '3d' where id = v_user.id;
      elsif v_user.scadenza_avviso_stadio is null and v_user.abbonamento_scade_il <= now() + interval '7 days' then
        perform net.http_post(v_url, jsonb_build_object('tipo', 'scadenza_preavviso_7d', 'userId', v_user.id, 'email', coalesce(v_user.email, ''), 'nome', coalesce(v_user.nome, ''), 'scadenza', to_char(v_user.abbonamento_scade_il, 'DD/MM/YYYY')), '{}'::jsonb, jsonb_build_object('Content-Type', 'application/json', 'x-send-secret', v_secret));
        update public.profiles set scadenza_avviso_stadio = '7d' where id = v_user.id;
      end if;
    end if;

    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

grant execute on function public.invia_avvisi_scadenza_abbonamento() to postgres;


-- ============================================================
-- 3. Wrapper retro-compatibile: beta_rinnovo_omaggio_vita() delega
--    al nuovo scheduler (invocabile anche a mano dagli operatori).
-- ============================================================
create or replace function public.beta_rinnovo_omaggio_vita()
returns integer
language plpgsql
security definer
set search_path = public
as $$
begin
  return public.invia_avvisi_scadenza_abbonamento();
end;
$$;

grant execute on function public.beta_rinnovo_omaggio_vita() to postgres;

-- ============================================================
-- 4. Cron: due esecuzioni al giorno (09:00 e 18:00, ora italiana)
--    per rispettare il Day 0. Rimuove i job precedenti (idempotente).
-- ============================================================
select cron.unschedule('beta-rinnovo-omaggio-vita')
  where exists (select 1 from cron.job where jobname = 'beta-rinnovo-omaggio-vita');
select cron.unschedule('scadenza-avvisi-multistep')
  where exists (select 1 from cron.job where jobname = 'scadenza-avvisi-multistep');
select cron.schedule('scadenza-avvisi-multistep', '0 9,18 * * *', $$ select public.invia_avvisi_scadenza_abbonamento(); $$);

