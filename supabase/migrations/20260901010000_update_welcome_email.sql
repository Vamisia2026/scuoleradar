-- ============================================================
-- WELCOME EMAIL BASE — concordanza di genere (Benvenuto/Benvenuta)
-- Aggiorna il trigger step1 (auth.users → Edge send-notification):
-- salva genere E NOME nel profilo e li passa nel payload, così la email
-- di benvenuto usa "Benvenuta/Benvenuto" e "Cara/Caro [Nome]".
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
begin
  -- Nome e genere arrivano da user_metadata (options.data nel signUp del frontend).
  -- Per Google One Tap si ripiega su name/full_name forniti dal provider.
  v_nome := coalesce(
    nullif(new.raw_user_meta_data->>'nome', ''),
    nullif(new.raw_user_meta_data->>'name', ''),
    nullif(new.raw_user_meta_data->>'full_name', '')
  );
  v_genere := nullif(new.raw_user_meta_data->>'genere', '');

  insert into public.profiles (id, email, nome, genere)
    values (new.id, new.email, v_nome, v_genere)
    on conflict (id) do update set
      nome = coalesce(excluded.nome, public.profiles.nome),
      genere = coalesce(excluded.genere, public.profiles.genere);

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
