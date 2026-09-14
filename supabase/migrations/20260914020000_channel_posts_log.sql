-- ============================================================
-- CHANNEL_POSTS_LOG — ledger anti-duplicato per i POST sui canali Telegram
--
-- Risolve il bug dei messaggi ripetuti sui canali regionali/ATA: prima della
-- registrazione, un avviso già pubblicato veniva ripubblicato a ogni run dello
-- scraper (es. quando l'upsert su `interpelli` veniva ignorato o falliva).
-- Ora ogni pubblicazione è tracciata per (interpello, canale): se la coppia è
-- già presente, l'invio viene saltato.
--
-- Scrittura/lettura SOLO lato server (service_role: scraper/Edge): nessun
-- accesso client. Idempotente.
-- ============================================================

create table if not exists public.channel_posts_log (
  interpello_hash  text not null,
  canale           text not null,
  sent_at          timestamptz not null default now(),
  primary key (interpello_hash, canale)
);

create index if not exists channel_posts_log_canale_idx
  on public.channel_posts_log (canale);

comment on table public.channel_posts_log is
  'Ledger dei post pubblicati sui canali Telegram (interpello × canale): impedisce la ripubblicazione dello stesso avviso.';

-- Sicurezza: nessun accesso pubblico/anon; solo service_role.
alter table public.channel_posts_log enable row level security;
revoke all on public.channel_posts_log from anon, authenticated;
grant all on public.channel_posts_log to service_role;
