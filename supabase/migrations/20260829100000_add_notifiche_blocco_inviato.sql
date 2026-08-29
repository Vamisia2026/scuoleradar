-- ============================================================
-- Flag notifiche_blocco_inviato su profiles
-- Marcatore "una tantum": diventa true dopo l'invio del messaggio
-- di blocco (limite notifiche di prova raggiunto), per garantire
-- che la comunicazione venga inviata una sola volta in assoluto
-- per ogni utente, anche tra esecuzioni diverse dello scraper.
-- ============================================================

alter table public.profiles
  add column if not exists notifiche_blocco_inviato boolean not null default false;

comment on column public.profiles.notifiche_blocco_inviato is
  'True quando il messaggio di blocco notifiche e gia stato inviato (una tantum)';
