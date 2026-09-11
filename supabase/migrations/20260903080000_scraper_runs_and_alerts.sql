-- ============================================================
-- Diagnostica remota ADMIN — run dello scraper + storico alert
--
-- Supporta i comandi diagnostici del bot admin (Edge
-- `telegram-admin-webhook`):
--   · `/status`  → statistiche run recenti, conteggi attivi, tasso errori
--   · `/ultimi`  → ultimi interpelli importati
-- e l'helper di ALERT (invio a ADMIN_TELEGRAM_ID su fallimenti critici dello
-- scraper o anomalie di routing).
--
-- Sicurezza: entrambe le tabelle sono di servizio → RLS abilitata, accesso
-- SOLO via service_role (nessuna policy per anon/authenticated).
-- Idempotente: eseguibile più volte senza errori.
-- ============================================================

-- 1) Run dello scraper (una riga per esecuzione reale).
create table if not exists public.scraper_runs (
  id uuid primary key default gen_random_uuid(),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  durata_ms integer,
  -- 'reali' | 'fixture'
  modalita text not null default 'reali',
  province text[] not null default '{}',
  trovati integer not null default 0,
  nuovi integer not null default 0,
  upsert_ok boolean not null default true,
  telegram_attesi integer not null default 0,
  telegram_riusciti integer not null default 0,
  errori integer not null default 0,
  -- 'ok' | 'warn' | 'error'
  esito text not null default 'ok',
  messaggio text,
  created_at timestamptz not null default now()
);

create index if not exists scraper_runs_created_idx on public.scraper_runs (created_at desc);
create index if not exists scraper_runs_esito_idx on public.scraper_runs (esito);

comment on table public.scraper_runs is
  'Una riga per esecuzione dello scraper interpelli (statistiche + esito, per la diagnostica admin)';

-- 2) Storico degli ALERT inviati all'admin (helper Edge inviaAlerta).
create table if not exists public.admin_telegram_alerts (
  id uuid primary key default gen_random_uuid(),
  -- 'critical' | 'warning' | 'info'
  severity text not null default 'warning',
  category text not null default 'generale',
  title text not null,
  message text not null,
  meta jsonb,
  -- true = invio a ADMIN_TELEGRAM_ID riuscito
  inviato boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists admin_telegram_alerts_created_idx
  on public.admin_telegram_alerts (created_at desc);
create index if not exists admin_telegram_alerts_severity_idx
  on public.admin_telegram_alerts (severity);

comment on table public.admin_telegram_alerts is
  'Storico degli alert inviati al bot Telegram admin (Edge telegram-admin-webhook)';

-- Sicurezza: nessun accesso pubblico, solo service_role.
alter table public.scraper_runs enable row level security;
grant all on table public.scraper_runs to service_role;

alter table public.admin_telegram_alerts enable row level security;
grant all on table public.admin_telegram_alerts to service_role;
