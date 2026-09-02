-- ============================================================
-- FREE FOREVER — EMAIL DI RINNOVO AUTOMATICO + ESTENSIONE +1 ANNO
-- Cron giornaliero: individua gli utenti con piano 'free_forever' la cui
-- scadenza (abbonamento_scade_il / current_period_end, alias "piano_scadenza")
-- è entro 7 giorni (o già passata, per recuperi) e:
--   1) invia l'email dedicata di rinnovo automatico (Edge send-notification,
--      tipo 'free_forever_scadenza' — nessun sollecito di pagamento Stripe);
--   2) estende automaticamente la scadenza di +365 giorni.
-- APPLICAZIONE: DOPO la migrazione 20260902234600_free_forever_account_bridge.
-- ============================================================

create or replace function public.rinnova_free_forever_scadenza()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_url text;
  v_secret text;
  v_conteggio integer := 0;
  v_utente record;
begin
  select value into v_url from public.app_settings where key = 'send_notification_url';
  select value into v_secret from public.app_settings where key = 'send_notification_secret';
  if v_url is null or v_secret is null then
    raise notice 'app_settings mancanti: email rinnovo FFE non inviata';
    return 0;
  end if;

  -- Finestra: scadenza entro 7 giorni (o già scaduta: l'estensione rende la
  -- routine idempotente — dopo l'invio la nuova scadenza esce dalla finestra).
  for v_utente in
    select p.id, p.email, p.nome, p.genere, p.abbonamento_scade_il
      from public.profiles p
     where p.piano = 'free_forever'
       and p.abbonamento_scade_il is not null
       and p.abbonamento_scade_il <= now() + interval '7 days'
  loop
    perform net.http_post(
      v_url,
      jsonb_build_object(
        'tipo', 'free_forever_scadenza',
        'userId', v_utente.id,
        'email', coalesce(v_utente.email, ''),
        'nome', coalesce(v_utente.nome, ''),
        'genere', coalesce(v_utente.genere, ''),
        'piano', 'free_forever'
      ),
      '{}'::jsonb,
      jsonb_build_object('Content-Type', 'application/json', 'x-send-secret', v_secret)
    );

    -- Rinnovo automatico: +1 anno da oggi (mai indietro nel tempo).
    update public.profiles
       set abbonamento_scade_il = greatest(now() + interval '365 days', abbonamento_scade_il + interval '365 days'),
           subscription_status  = 'active',
           current_period_end   = greatest(now() + interval '365 days', coalesce(current_period_end, abbonamento_scade_il) + interval '365 days'),
           scadenza_avviso_stadio = 'free_rinnovato'
     where id = v_utente.id;

    v_conteggio := v_conteggio + 1;
  end loop;

  return v_conteggio;
end;
$$;

grant execute on function public.rinnova_free_forever_scadenza() to postgres;

select cron.unschedule('free-forever-rinnovo-annuale')
  where exists (select 1 from cron.job where jobname = 'free-forever-rinnovo-annuale');
select cron.schedule('free-forever-rinnovo-annuale', '30 8 * * *', $$ select public.rinnova_free_forever_scadenza(); $$);
