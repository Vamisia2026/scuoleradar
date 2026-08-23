-- ============================================================
-- FASE 2 — Estensione tabella profiles (Matching Engine)
-- Esegui questo script nel SQL Editor di Supabase.
-- Aggiunge le colonne richieste per il Matching Engine e lo
-- storico dei moduli scaricati. `classi_concorso` esiste già
-- (creata in 20260822_create_profiles.sql).
-- ============================================================

alter table public.profiles add column if not exists ordini_scuola text[] default '{}';
alter table public.profiles add column if not exists province_interesse text[] default '{}';
alter table public.profiles add column if not exists moduli_scaricati text[] default '{}';

comment on column public.profiles.ordini_scuola is
  'Ordini di scuola di interesse (stessa semantica della colonna legacy "ordini")';
comment on column public.profiles.province_interesse is
  'Province di interesse per il Matching Engine (stessa semantica di "province_attive")';
comment on column public.profiles.moduli_scaricati is
  'IDs dei moduli scaricati di recente dall utente (sezione Profilo > Modelli Scaricati)';
