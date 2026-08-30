-- ============================================================
-- Ciclo notifiche a 5 step — scheduling automatico
--  · step1 (welcome) inviato all'iscrizione (trigger su auth.users)
--  · step5 (conversione PRO) schedulato 2 ore dopo il passo 4 (extra)
-- Infrastruttura: pg_cron + pg_net → Edge Function `send-notification`.
-- ============================================================

-- 1. Colonne di stato del ciclo
alter table public.profiles add column if not exists step4_inviata_at timestamptz;
alter table public.profiles add column if not exists step5_inviata boolean not null default false;

-- 2. Impostazioni condivise (URL + secret dell'Edge Function)
create table if not exists public.app_settings (key text primary key, value text not null);
insert into public.app_settings (key, value) values
  ('send_notification_url', 'https://gwdmsgsshvdnfrplbjiv.supabase.co/functions/v1/send-notification'),
  ('send_notification_secret', 'SR-9f3c7e1a-4b8d-4c6f-9a2e-7d1b5f8c3e9a')
on conflict (key) do update set value = excluded.value;

-- 3. dispatch_step5_due(): invia il passo 5 agli utenti in scadenza
create or replace function public.dispatch_step5_due()
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
    raise notice 'app_settings mancanti';
    return 0;
  end if;

  for v_user in
    select id from public.profiles
     where piano = 'base'
       and step4_inviata_at is not null
       and step5_inviata = false
       and step4_inviata_at + interval '2 hours' <= now()
  loop
    perform net.http_post(
      v_url,
      jsonb_build_object('tipo', 'step5', 'userId', v_user.id),
      '{}'::jsonb,
      jsonb_build_object('Content-Type', 'application/json', 'x-send-secret', v_secret)
    );
    update public.profiles set step5_inviata = true where id = v_user.id;
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

grant execute on function public.dispatch_step5_due() to postgres;

-- 4. Cron ogni minuto
select cron.schedule('step5-notifiche', '* * * * *', $$ select public.dispatch_step5_due(); $$);

-- 5. Welcome (step1) all'iscrizione
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
begin
  insert into public.profiles (id, email) values (new.id, new.email) on conflict (id) do nothing;
  select value into v_url from public.app_settings where key = 'send_notification_url';
  select value into v_secret from public.app_settings where key = 'send_notification_secret';
  if v_url is null or v_secret is null then
    return new;
  end if;
  select telegram_chat_id into v_chat from public.profiles where id = new.id;
  perform net.http_post(
    v_url,
    jsonb_build_object('tipo', 'step1', 'userId', new.id, 'email', new.email, 'chatId', v_chat),
    '{}'::jsonb,
    jsonb_build_object('Content-Type', 'application/json', 'x-send-secret', v_secret)
  );
  return new;
end;
$$;

drop trigger if exists trg_auth_users_step1_welcome on auth.users;
create trigger trg_auth_users_step1_welcome
  after insert on auth.users
  for each row execute function public.send_step1_welcome();
