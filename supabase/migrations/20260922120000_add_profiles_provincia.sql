-- ============================================================
-- Provincia di RESIDENZA dell'utente (dato demografico di base)
--
-- Distinta dalle province del Radar (`province_attive` / `province_interesse`,
-- array di codici = dove l'utente VUOLE lavorare): qui è la provincia in cui
-- risiede, raccolta in registrazione / mini-onboarding anagrafico.
-- Formato: CODICE provincia a 2 lettere ('RM', 'AT'), come `interpelli.provincia`.
-- Facoltativa: NULL = non dichiarata.
-- ============================================================

alter table public.profiles
  add column if not exists provincia text;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'profiles_provincia_check'
  ) then
    alter table public.profiles
      add constraint profiles_provincia_check
      check (provincia is null or provincia ~ '^[A-Z]{2}$');
  end if;
end $$;

comment on column public.profiles.provincia is
  'Provincia di residenza (codice a 2 lettere, es. RM; NULL = non dichiarata). Dato demografico, distinto dalle province attive del Radar';
