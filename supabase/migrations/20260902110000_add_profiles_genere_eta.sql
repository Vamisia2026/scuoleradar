-- ============================================================
-- Dati anagrafici profilo: genere (M/F) + età in anni.
--  · genere: colonna già prevista (migrazione ...31200000), qui resa idempotente;
--  · eta:    numero intero 14–100, opzionale (dato per il pannello admin).
-- ============================================================

alter table public.profiles add column if not exists genere text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'profiles_genere_check' and conrelid = 'public.profiles'::regclass
  ) then
    alter table public.profiles
      add constraint profiles_genere_check check (genere is null or genere in ('M', 'F'));
  end if;
end $$;

alter table public.profiles add column if not exists eta integer;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'profiles_eta_check' and conrelid = 'public.profiles'::regclass
  ) then
    alter table public.profiles
      add constraint profiles_eta_check check (eta is null or (eta >= 14 and eta <= 100));
  end if;
end $$;

comment on column public.profiles.genere is
  'Genere dell utente (M/F/null): usato per la declinazione (Cara/Caro, stata/stato) nelle email automatiche';
comment on column public.profiles.eta is
  'Eta in anni (14-100, opzionale): dato anagrafico mostrato nel pannello admin';
