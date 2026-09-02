-- ============================================================
-- FREE FOREVER — piano PRO gratuito a vita con rinnovo annuale automatico
--
-- Obiettivi:
--  1. Modello dati: `profiles.piano` accetta 'free_forever' (PRO a vita €0).
--  2. Notifiche: gli utenti free_forever hanno notifiche ILLIMITATE
--     (come 'pro'), senza limite di 3/anno scolastico.
--  3. Nessun avviso "a pagamento": i cron di scadenza PRO/Stripe restano
--     ancorati a piano='pro', quindi i free_forever NON ricevono MAI
--     solleciti di rinnovo a pagamento, promemoria Stripe o warning di
--     pagamento fallito.
--  4. Trigger di attivazione: al passaggio a piano='pro' oppure
--     'free_forever' viene inviata EMAIL 2 "Conferma attivazione/rinnovo"
--     (Edge send-notification → tipo 'conferma_attivazione'). Per i
--     free_forever viene ancorata la scadenza annuale se assente.
--  5. Rinnovo annuale automatico free_forever (cron quotidiano):
--       · 7 giorni prima della scadenza → EMAIL 1 "Scadenza → rinnovo
--         gratuito" (tipo 'free_forever_preavviso')
--       · giorno della scadenza (Day 0) → abbonamento_scade_il +365 giorni
--         + EMAIL 2 "Conferma attivazione/rinnovo" (tipo 'conferma_attivazione')
--
-- APPLICAZIONE: eseguire nel SQL Editor di Supabase (project
-- gwdmsgsshvdnfrplbjiv). File: 20260902010000_free_forever_plan.sql
-- ============================================================

-- ============================================================
-- 1. Vincolo sul piano: base | pro | free_forever
-- ============================================================
alter table public.profiles drop constraint if exists profiles_piano_check;
alter table public.profiles add constraint profiles_piano_check
  check (piano in ('base', 'pro', 'free_forever'));

comment on column public.profiles.piano is
  'Piano utente: base | pro | free_forever (PRO gratuito a vita, rinnovo annuale automatico a 0€)';

-- ============================================================
-- 2. RPC contatore notifiche: free_forever illimitate come pro
--    (versione con reset su anno scolastico italiano — identica alla
--    migrazione ...31150000 con il piano 'free_forever' ammesso)
-- ============================================================
create or replace function public.incrementa_notifiche_utente(p_user_id uuid)
returns table (consentito boolean, notifiche_usate integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_piano text;
  v_usate integer;
  v_anno integer;
  v_anno_scolastico integer := (
    extract(year from now()) -
    case when extract(month from now()) < 9 then 1 else 0 end
  )::int;
begin
  -- Guardia condizionale: i client autenticati operano solo sul proprio profilo.
  if auth.uid() is not null and auth.uid() <> p_user_id then
    return query select false::boolean, 0::integer;
    return;
  end if;

  select p.piano, p.notifiche_usate, p.notifiche_anno
    into v_piano, v_usate, v_anno
    from public.profiles p
   where p.id = p_user_id
     for update;

  if v_piano is null then
    return query select false::boolean, 0::integer;
    return;
  end if;

  -- Reset all'inizio dell'anno scolastico (1 settembre).
  if v_anno is null or v_anno <> v_anno_scolastico then
    v_usate := 0;
    update public.profiles
       set notifiche_usate          = 0,
           notifiche_anno           = v_anno_scolastico,
           notifiche_blocco_inviato = false,
           notifiche_recap_inviato  = false
     where id = p_user_id;
  end if;

  -- PRO e FREE FOREVER → sempre consentiti (contatore comunque aggiornato).
  if v_piano in ('pro', 'free_forever') then
    update public.profiles
       set notifiche_usate = v_usate + 1
     where id = p_user_id;

    return query select true::boolean, v_usate + 1;
    return;
  end if;

  -- BASE → limite di 3 notifiche per anno scolastico.
  if v_usate >= 3 then
    return query select false::boolean, v_usate;
    return;
  end if;

  update public.profiles
     set notifiche_usate = v_usate + 1
   where id = p_user_id;

  return query select true::boolean, v_usate + 1;
end;
$$;

grant execute on function public.incrementa_notifiche_utente(uuid) to authenticated;
grant execute on function public.incrementa_notifiche_utente(uuid) to service_role;

-- ============================================================
-- 3. Trigger EMAIL 2 — conferma attivazione/rinnovo
--    Scatta quando profiles.piano diventa 'pro' o 'free_forever'.
-- ============================================================
create or replace function public.send_conferma_attivazione()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_url text;
  v_secret text;
begin
  -- Solo transizioni verso piani PRO/Free Forever.
  if new.piano not in ('pro', 'free_forever') then
    return new;
  end if;
  if old is not null and old.piano = new.piano then
    return new;
  end if;

  -- Free Forever: ancora annuale (ora + 365 giorni) se non già presente.
  if new.piano = 'free_forever' then
    update public.profiles
       set abbonamento_scade_il = coalesce(
             abbonamento_scade_il,
             now() + interval '365 days'
           ),
           scadenza_avviso_stadio = coalesce(scadenza_avviso_stadio, 'free_confermato')
     where id = new.id;
  end if;

  select value into v_url from public.app_settings where key = 'send_notification_url';
  select value into v_secret from public.app_settings where key = 'send_notification_secret';
  if v_url is null or v_secret is null then
    raise notice 'app_settings mancanti: email di conferma non inviata';
    return new;
  end if;

  perform net.http_post(
    v_url,
    jsonb_build_object(
      'tipo', 'conferma_attivazione',
      'userId', new.id,
      'email', coalesce(new.email, ''),
      'nome', coalesce(new.nome, ''),
      'piano', new.piano
    ),
    '{}'::jsonb,
    jsonb_build_object('Content-Type', 'application/json', 'x-send-secret', v_secret)
  );
  return new;
end;
$$;

drop trigger if exists trg_profiles_conferma_attivazione on public.profiles;
create trigger trg_profiles_conferma_attivazione
  after insert or update of piano on public.profiles
  for each row execute function public.send_conferma_attivazione();

-- ============================================================
-- 4. Cron annuale free_forever: EMAIL 1 (preavviso) + rinnovo EMAIL 2
-- ============================================================
create or replace function public.rinnova_free_forever_annuale()
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
    select p.id, p.email, p.nome, p.genere, p.abbonamento_scade_il, p.scadenza_avviso_stadio
      from public.profiles p
     where p.piano = 'free_forever'
       and p.abbonamento_scade_il is not null
       and (
         (
           (p.scadenza_avviso_stadio is null or p.scadenza_avviso_stadio = 'free_confermato')
           and p.abbonamento_scade_il > now()
           and p.abbonamento_scade_il <= now() + interval '7 days'
         )
         or
         (
           p.scadenza_avviso_stadio = 'free_preavviso'
           and p.abbonamento_scade_il <= now()
         )
       )
  loop
    if v_user.abbonamento_scade_il <= now() then
      -- DAY 0: rinnovo automatico di un altro anno + EMAIL 2.
      update public.profiles
         set abbonamento_scade_il  = v_user.abbonamento_scade_il + interval '365 days',
             scadenza_avviso_stadio = 'free_confermato'
       where id = v_user.id;

      perform net.http_post(
        v_url,
        jsonb_build_object(
          'tipo', 'conferma_attivazione',
          'userId', v_user.id,
          'email', coalesce(v_user.email, ''),
          'nome', coalesce(v_user.nome, ''),
          'genere', coalesce(v_user.genere, ''),
          'piano', 'free_forever'
        ),
        '{}'::jsonb,
        jsonb_build_object('Content-Type', 'application/json', 'x-send-secret', v_secret)
      );
    else
      -- 7 giorni prima: EMAIL 1 (rassicurazione rinnovo gratuito automatico).
      perform net.http_post(
        v_url,
        jsonb_build_object(
          'tipo', 'free_forever_preavviso',
          'userId', v_user.id,
          'email', coalesce(v_user.email, ''),
          'nome', coalesce(v_user.nome, ''),
          'genere', coalesce(v_user.genere, ''),
          'scadenza', to_char(v_user.abbonamento_scade_il, 'DD/MM/YYYY')
        ),
        '{}'::jsonb,
        jsonb_build_object('Content-Type', 'application/json', 'x-send-secret', v_secret)
      );
      update public.profiles
         set scadenza_avviso_stadio = 'free_preavviso'
       where id = v_user.id;
    end if;

    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

grant execute on function public.rinnova_free_forever_annuale() to postgres;

select cron.unschedule('free-forever-rinnovo-annuale')
  where exists (select 1 from cron.job where jobname = 'free-forever-rinnovo-annuale');
select cron.schedule('free-forever-rinnovo-annuale', '30 8 * * *', $$ select public.rinnova_free_forever_annuale(); $$);

-- ============================================================
-- 5. (OPZIONALE) Backfill / conversioni — scommenta le righe che servono.
--    Esempio 1: trasforma in Free Forever chi è già Beta Tester PRO.
--    Esempio 2: trasforma un singolo utente (email) in Free Forever.
-- ============================================================

-- update public.profiles
--    set piano = 'free_forever',
--        abbonamento_scade_il = coalesce(
--          abbonamento_scade_il,
--          greatest(coalesce(created_at, now()) + interval '365 days', now() + interval '365 days')
--        ),
--        scadenza_avviso_stadio = coalesce(scadenza_avviso_stadio, 'free_confermato')
--  where is_beta_tester = true
--    and piano = 'pro';

-- update public.profiles
--    set piano = 'free_forever',
--        abbonamento_scade_il = greatest(coalesce(created_at, now()) + interval '365 days', now() + interval '365 days'),
--        scadenza_avviso_stadio = coalesce(scadenza_avviso_stadio, 'free_confermato')
--  where email = 'bartoloansaldi@gmail.com';
