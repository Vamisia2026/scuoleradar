-- ============================================================
-- RADAR ATTIVO / IN PAUSA
-- Colonna `profiles.radar_attivo` per il toggle utente:
--  true  = il Radar cerca e invia notifiche (default dopo l'onboarding)
--  false = "In pausa": si CONSERVANO province/classi/preferenze ma le
--          notifiche vengono sospese (matching engine esclude questi utenti).
-- APPLICAZIONE: SQL Editor Supabase (project gwdmsgsshvdnfrplbjiv).
-- ============================================================

alter table public.profiles add column if not exists radar_attivo boolean not null default false;

comment on column public.profiles.radar_attivo is
  'Stato Radar Scuole: true = attivo (invio notifiche), false = in pausa (preferenze conservate)';

-- Backfill: chi ha completato l''onboarding ha il Radar attivo.
update public.profiles
   set radar_attivo = true
 where onboarded = true
   and radar_attivo = false;
