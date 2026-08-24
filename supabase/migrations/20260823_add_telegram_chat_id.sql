-- ============================================================
-- FASE 5 — Telegram Chat ID nel profilo utente
-- Esegui questo script nel SQL Editor di Supabase.
-- Aggiunge alla tabella profiles il campo per il Chat ID Telegram
-- usato dal bot @ScuoleRadar_bot per le notifiche in tempo reale.
-- ============================================================

alter table public.profiles add column if not exists telegram_chat_id text;

comment on column public.profiles.telegram_chat_id is
  'Chat ID Telegram dell utente per le notifiche del bot @ScuoleRadar_bot (nullable)';
