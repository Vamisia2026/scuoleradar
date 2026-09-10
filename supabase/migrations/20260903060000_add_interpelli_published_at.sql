-- ============================================================
-- interpelli — data di PUBBLICAZIONE distinta dalla SCADENZA
-- La data rilevata nell'intestazione/contesto (es. post giornaliero)
-- NON deve più essere confusa con la scadenza del bando:
--   · published_at    → data di pubblicazione dell'avviso (dalla fonte)
--   · expiration_date → scadenza REALE del bando (solo se dichiarata/calcolata)
-- Idempotente: eseguibile più volte senza errori.
-- ============================================================

alter table public.interpelli
  add column if not exists published_at timestamptz;

create index if not exists interpelli_published_idx on public.interpelli (published_at);
