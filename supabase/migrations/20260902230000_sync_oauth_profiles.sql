-- ============================================================
-- SYNC GOOGLE OAUTH → profiles (nome/cognome/avatar_url)
--  1. Nuova colonna `public.profiles.avatar_url`
--  2. Trigger su auth.users (INSERT e UPDATE di raw_user_meta_data):
--     estrae full_name (o given_name+family_name) → nome/cognome
--     e avatar_url/picture → avatar_url, SOLO se il campo è null
--     (non sovrascrive mai dati già inseriti dall'utente).
--  3. Backfill retroattivo degli utenti esistenti senza nome/cognome.
-- APPLICAZIONE: SQL Editor Supabase (project gwdmsgsshvdnfrplbjiv)
-- ============================================================

alter table public.profiles add column if not exists avatar_url text;

comment on column public.profiles.avatar_url is
  'URL avatar dell utente (sincronizzato da OAuth Google: avatar_url o picture)';

-- ============================================================
-- Trigger function: sync oauth metadata → profiles
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

  -- Riga profilo garantita anche se l'utente non è ancora stato on-boardizzato.
  insert into public.profiles (id, email)
  values (new.id, new.email)
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

drop trigger if exists trg_auth_users_sync_oauth on auth.users;
create trigger trg_auth_users_sync_oauth
  after insert or update of raw_user_meta_data on auth.users
  for each row execute function public.sync_profilo_oauth();

-- ============================================================
-- Backfill retroattivo: utenti OAuth già esistenti con nome/cognome vuoti
-- ============================================================
do $$
declare
  r record;
  meta jsonb;
  v_given  text; v_family text; v_full text; v_avatar text;
  v_nome   text; v_cognome text; v_spazio integer;
begin
  for r in
    select p.id, p.nome, p.cognome, p.avatar_url, a.email, a.raw_user_meta_data as meta
      from public.profiles p
      join auth.users a on a.id = p.id
     where p.nome is null or btrim(coalesce(p.nome, '')) = ''
        or p.cognome is null or btrim(coalesce(p.cognome, '')) = ''
        or p.avatar_url is null
  loop
    meta := coalesce(r.meta, '{}'::jsonb);
    v_given  := nullif(btrim(coalesce(meta->>'given_name', '')), '');
    v_family := nullif(btrim(coalesce(meta->>'family_name', '')), '');
    v_full   := nullif(btrim(coalesce(meta->>'full_name', '')), '');
    v_avatar := nullif(btrim(coalesce(meta->>'avatar_url', meta->>'picture', '')), '');

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
        v_cognome := null;
      end if;
    else
      v_nome := null;
      v_cognome := null;
    end if;

    if (r.nome is null or btrim(coalesce(r.nome, '')) = '') and v_nome is not null then
      update public.profiles set nome = v_nome where id = r.id;
    end if;
    if (r.cognome is null or btrim(coalesce(r.cognome, '')) = '') and v_cognome is not null then
      update public.profiles set cognome = v_cognome where id = r.id;
    end if;
    if r.avatar_url is null and v_avatar is not null then
      update public.profiles set avatar_url = v_avatar where id = r.id;
    end if;
  end loop;
end $$;
