-- ============================================================
-- FASE 2 — Tabella interpelli (Matching Engine)
-- Esegui questo script nel SQL Editor di Supabase.
-- Nuova tabella "interpelli" con hash_id univoco per evitare
-- duplicati e colonne dedicate alla scuola (school_name/code),
-- usate dal Matching Engine per il feed della Dashboard.
-- NOTA: la tabella legacy `notices` resta per compatibilità con
-- lo scraper esistente; l'app tenta prima `interpelli`, poi
-- fallback su `notices`, poi sui dati di esempio.
-- ============================================================

create table if not exists public.interpelli (
  id uuid primary key default gen_random_uuid(),
  -- Hash univoco (SHA-256 di provincia + titolo + data) per l'upsert anti-duplicati
  hash_id text unique not null,
  title text not null,
  -- Codice provincia, es. 'AT'
  province text not null,
  -- Array di classi di concorso, es. ['A-22', 'ADEE']
  class_codes text[] not null default '{}',
  school_name text,
  school_code text,
  source_url text not null,
  expiration_date timestamptz,
  created_at timestamptz default now()
);

-- Indici per il Matching Engine (filtri su province e class_codes)
create index if not exists interpelli_province_idx on public.interpelli (province);
create index if not exists interpelli_class_codes_idx on public.interpelli using gin (class_codes);
create index if not exists interpelli_expiration_idx on public.interpelli (expiration_date);

-- Permessi e sicurezza
alter table public.interpelli enable row level security;
grant all on table public.interpelli to service_role;
grant select on table public.interpelli to anon;
grant select on table public.interpelli to authenticated;

-- Gli interpelli sono dati pubblici (lettura consentita a tutti)
create policy "read interpelli" on public.interpelli
  for select using (true);
