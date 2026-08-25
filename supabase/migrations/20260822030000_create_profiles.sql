-- ============================================================
-- FASE 2 — Tabella profiles (Profilo Utente e Preferenze)
-- Esegui questo script nel SQL Editor di Supabase.
-- Crea la tabella dei profili con province di interesse e
-- classi di concorso scelte, usate dallo scraper e dall'app.
-- ============================================================

create table if not exists public.profiles (
  id                uuid primary key references auth.users (id) on delete cascade,
  email             text,
  nome              text,
  cognome           text,
  ordini            text[]      default '{}',
  classi_concorso   text[]      default '{}',
  materie_id        text[]      default '{}',
  materie_custom    text[]      default '{}',
  province_attive   text[]      default '{}',
  favorite_schools  text[]      default '{}',
  ignored_schools   text[]      default '{}',
  telegram_username text        default '',
  email_notifica    text        default '',
  onboarded         boolean     default false,
  created_at        timestamptz default now(),
  updated_at        timestamptz default now()
);

-- Permessi
alter table public.profiles enable row level security;
grant all on table public.profiles to service_role;
grant select on table public.profiles to anon;
grant select, insert, update on table public.profiles to authenticated;

-- RLS: ogni utente legge e modifica solo il proprio profilo
drop policy if exists "read own profile" on public.profiles;
create policy "read own profile" on public.profiles
  for select to authenticated using (auth.uid() = id);
drop policy if exists "insert own profile" on public.profiles;
create policy "insert own profile" on public.profiles
  for insert to authenticated with check (auth.uid() = id);
drop policy if exists "update own profile" on public.profiles;
create policy "update own profile" on public.profiles
  for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);

-- Trigger per aggiornare updated_at
create or replace function public.handle_profiles_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_profiles_updated_at on public.profiles;
create trigger set_profiles_updated_at
  before update on public.profiles
  for each row execute function public.handle_profiles_updated_at();
