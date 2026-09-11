-- ============================================================
-- interpelli — materia/settore inferito + email di candidatura
-- Servono a mostrare, per gli avvisi generici "DOCENTE", la materia/settore
-- (es. "Matematica", "Sostegno") e l'eventuale EMAIL per l'invio delle domande,
-- invece della sola etichetta "Docente".
-- Idempotente: eseguibile più volte senza errori.
-- ============================================================

alter table public.interpelli
  add column if not exists materia text;

alter table public.interpelli
  add column if not exists contact_email text;

comment on column public.interpelli.materia is
  'Materia/settore inferito dal testo quando manca una classe di concorso esplicita';
comment on column public.interpelli.contact_email is
  'Email di candidatura trovata nella fonte (invio domande), se presente';
