-- ============================================================
-- NOTIFICATIONS_LOG — ledger anti-duplicato (utente × interpello × canale)
--
-- Serve al DISPATCH IMMEDIATO (`notificaInterpelliPerUtente`): consente di
-- notificare ogni opportunità ATTIVA compatibile col profilo (anche già
-- presente in DB) SENZA rimandare due volte la stessa segnalazione.
--
-- Scrittura/lettura SOLO lato server (service_role: scraper/Edge/script admin):
-- nessun accesso client. Idempotente.
-- ============================================================

create table if not exists public.notifications_log (
  user_id          uuid not null references public.profiles(id) on delete cascade,
  interpello_hash  text not null,
  canale           text not null,               -- 'email' | 'telegram'
  sent_at          timestamptz not null default now(),
  primary key (user_id, interpello_hash, canale)
);

create index if not exists notifications_log_user_idx
  on public.notifications_log (user_id);

comment on table public.notifications_log is
  'Ledger delle notifiche inviate (utente × interpello × canale): evita duplicati nel dispatch immediato e nel backfill.';

-- Sicurezza: nessun accesso pubblico/anon; solo service_role.
alter table public.notifications_log enable row level security;
revoke all on public.notifications_log from anon, authenticated;
grant all on public.notifications_log to service_role;
