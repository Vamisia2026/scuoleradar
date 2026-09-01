-- ============================================================
-- Genere dell'utente (declinazione email: Cara/Caro, stata/stato)
-- Valori ammessi: 'M' | 'F' | NULL (non dichiarato)
-- ============================================================

alter table public.profiles
  add column if not exists genere text;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'profiles_genere_check'
  ) then
    alter table public.profiles
      add constraint profiles_genere_check check (genere is null or genere in ('M', 'F'));
  end if;
end $$;

comment on column public.profiles.genere is
  'Genere dell utente (M/F/null): usato per la declinazione (Cara/Caro, stata/stato) nelle email automatiche';
