-- ============================================================
-- Flag notifiche_recap_inviato su profiles
-- Marcatore "una tantum" per l'email riepilogativa del blocco
-- definitivo (dopo l'invio della notifica EXTRA post-prova):
-- garantisce che il messaggio venga inviato una sola volta in
-- assoluto per ogni utente, anche tra esecuzioni dello scraper.
-- ============================================================

alter table public.profiles
  add column if not exists notifiche_recap_inviato boolean not null default false;

comment on column public.profiles.notifiche_recap_inviato is
  'True quando la email riepilogativa del blocco definitivo e gia stata inviata (una tantum)';
