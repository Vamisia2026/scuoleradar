-- ============================================================
-- Filtri Avanzati Scuole — Whitelist/Blacklist
-- Esegui questo script nel SQL Editor di Supabase.
-- Aggiunge le liste scuole preferite/escluse alla tabella profiles.
-- ============================================================

alter table public.profiles add column if not exists favorite_schools text[] default '{}';
alter table public.profiles add column if not exists ignored_schools text[] default '{}';
