-- ============================================================
-- Tabella `school_deadlines` — Deadlines Engine (Override dinamico)
--
-- Sorgente remota del widget Revolver Scadenze: la master list
-- locale (src/data/deadlinesFallback.json) può essere sovrascritta /
-- aggiornata da questa tabella, popolata da cron-scraper o feed RSS
-- che monitorano le fonti istituzionali (MIM, INVALSI, INPS, ARAN,
-- Gazzetta Ufficiale). Script di sincronizzazione:
--   npm run scadenze:sync   (scripts/sync-deadlines.ts, service role)
--
-- Convenzione date (stringhe, parse lato motore):
--   · "MM-DD"      → ricorrenza annuale proiettata nell'anno scolastico
--                    attivo (rollover automatico);
--   · "YYYY-MM-DD" → data assoluta (vale per quell'anno finché non
--                    viene aggiornata dal cron).
-- `type` = 'exact' (usa `date`) oppure 'window' (usa start_date/end_date).
-- ============================================================

create table if not exists public.school_deadlines (
  id text primary key,
  category text not null,
  title text not null,
  type text not null check (type in ('exact', 'window')),
  date text,
  start_date text,
  end_date text,
  -- Fase operativa (es. "Somministrazione prove CBT", "Iscrizione piattaforma")
  phase text,
  -- Destinatari (es. "Tutti i Gradi", "Docenti e ATA")
  target text,
  -- Istituzione di riferimento (es. "MIM", "INVALSI", "INPS", "ARAN")
  source text,
  official_source_url text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Indici utili per il cron di aggiornamento e le letture pubbliche.
create index if not exists school_deadlines_active_idx
  on public.school_deadlines (active);
create index if not exists school_deadlines_type_idx
  on public.school_deadlines (type);

-- Permessi: i dati delle scadenze sono pubblici (lettura a tutti),
-- la scrittura avviene solo via service_role (cron/script di sync).
alter table public.school_deadlines enable row level security;

grant all on table public.school_deadlines to service_role;
grant select on table public.school_deadlines to anon;
grant select on table public.school_deadlines to authenticated;

drop policy if exists "read school_deadlines" on public.school_deadlines;
create policy "read school_deadlines" on public.school_deadlines
  for select using (true);
