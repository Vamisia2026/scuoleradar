-- ============================================================
-- Beta Tester: colonna + View dedicata per segmentazione campagne
--  1) is_beta_tester BOOLEAN NOT NULL DEFAULT FALSE (idempotente)
--     (colonna già presente dalla migrazione ...31170000, qui resa sicura)
--  2) View public.beta_testers → id, email, full_name, plan_type, created_at
--     per gli utenti con is_beta_tester = TRUE.
--     full_name = nome + cognome; plan_type = profiles.piano.
-- ============================================================

alter table public.profiles
  add column if not exists is_beta_tester boolean not null default false;

comment on column public.profiles.is_beta_tester is
  'Beta Tester: segmentazione campagne email e accesso PRO omaggio';

-- View con SECURITY INVOKER: rispetta le policy RLS della tabella profiles
-- (il service_role vede tutte le righe, l'utente autenticato solo la propria).
create or replace view public.beta_testers
with (security_invoker = true)
as
select
  p.id,
  p.email,
  trim(coalesce(p.nome, '') || ' ' || coalesce(p.cognome, '')) as full_name,
  p.piano as plan_type,
  p.created_at
from public.profiles p
where p.is_beta_tester = true;

comment on view public.beta_testers is
  'Beta Tester attivi (is_beta_tester = true): id, email, full_name, plan_type, created_at';

grant select on public.beta_testers to anon;
grant select on public.beta_testers to authenticated;
grant select on public.beta_testers to service_role;
