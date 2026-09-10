-- ============================================================
-- Bot Telegram ADMIN — tabella di AUDIT dei comandi ricevuti
--
-- Log di ogni messaggio/comando ricevuto dalla Edge Function
-- `telegram-admin-webhook` (bot di controllo amministrativo, SEPARATO
-- dal bot pubblico degli interpelli). Registra anche i tentativi NON
-- autorizzati (autorizzato = false) per diagnostica/security.
--
-- Sicurezza: tabella di AUDIT riservata → RLS abilitata, accesso SOLO
-- via service_role (nessuna policy per anon/authenticated).
-- Idempotente: eseguibile più volte senza errori.
-- ============================================================

create table if not exists public.admin_telegram_log (
  id uuid primary key default gen_random_uuid(),
  -- ID Telegram del mittente (può superare il range di int4 → bigint).
  telegram_id bigint not null,
  chat_id bigint,
  username text,
  -- Comando normalizzato (es. "/stato"); per il testo libero è il primo token.
  command text not null,
  -- Testo integrale del messaggio (troncato lato funzione a 2000 caratteri).
  payload text,
  -- true = mittente == ADMIN_TELEGRAM_ID; false = tentativo rifiutato.
  autorizzato boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists admin_telegram_log_created_idx
  on public.admin_telegram_log (created_at desc);
create index if not exists admin_telegram_log_telegram_idx
  on public.admin_telegram_log (telegram_id);

comment on table public.admin_telegram_log is
  'Audit dei comandi ricevuti dal bot Telegram admin (Edge telegram-admin-webhook)';

-- Sicurezza: nessun accesso pubblico, solo service_role.
alter table public.admin_telegram_log enable row level security;
grant all on table public.admin_telegram_log to service_role;
