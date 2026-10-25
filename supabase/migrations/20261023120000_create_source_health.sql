-- ============================================================
-- Telemetria delle fonti — `source_health` (quarantena automatica, §26.85)
--
-- Una riga per URL di fonte (pagina USR, griglia regionale, lista WordPress di
-- un istituto). Il runner di ingestione (`scripts/table-reporter.ts`) registra
-- l'esito di ogni run e il discovery (`scripts/discovery-engine.ts`) registra i
-- fallimenti di fetch sulla fonte che ha espanso:
--
--   · `consecutive_failures` → run consecutivi senza voci o con errore;
--   · `is_quarantined`       → la fonte è esclusa dai giri ordinari;
--   · `quarantine_reason`    → `layout_changed` | `timeout` | `zero_items`.
--
-- La logica sta in `src/lib/sourceTelemetry.ts` (regole pure + ponte Supabase):
-- qui c'è solo la persistenza. Un `success` azzera i fallimenti e toglie la
-- quarantena — la ri-validazione è automatica, non serve un intervento umano.
--
-- Sicurezza: tabella di SERVIZIO. RLS abilitata con la sola policy
-- `service_role` (stesso schema di `scan_targets`): il browser non deve leggere
-- né scrivere la telemetria delle fonti.
-- Idempotente: eseguibile più volte senza errori.
-- ============================================================

-- ------------------------------------------------------------
-- 1) Tabella
-- ------------------------------------------------------------
create table if not exists public.source_health (
  -- chiave naturale: l'URL esatto con cui la fonte entra in `discovered_links`
  source_url           text primary key,

  status               text not null default 'unknown',
  consecutive_failures int  not null default 0,

  -- quarantena
  is_quarantined       boolean not null default false,
  quarantine_reason    text,
  quarantined_at       timestamptz,

  -- ultimo run
  layout_detected      text,
  items_count          int     not null default 0,
  last_run_at          timestamptz,
  last_success_at      timestamptz,
  last_error           text,
  total_runs           bigint  not null default 0,

  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),

  constraint source_health_status_valid
    check (status in ('unknown', 'success', 'empty', 'quarantine')),
  constraint source_health_reason_valid
    check (quarantine_reason is null
           or quarantine_reason in ('layout_changed', 'timeout', 'zero_items')),
  constraint source_health_failures_nonneg check (consecutive_failures >= 0),
  constraint source_health_items_nonneg    check (items_count >= 0)
);

comment on table public.source_health is
  'Telemetria per fonte di interpelli: esito dell''ultimo run, fallimenti consecutivi e quarantena automatica (§26.85).';
comment on column public.source_health.is_quarantined is
  'TRUE = la fonte è saltata dai giri ordinari finché un run riuscito (o un reset manuale) non la riabilita.';
comment on column public.source_health.quarantine_reason is
  'Perché è stata isolata: layout_changed (struttura non riconosciuta), timeout (trasporto), zero_items (pagina letta, elenco vuoto).';
comment on column public.source_health.layout_detected is
  'Layout dell''ultima lettura: table | aria_grid | wp_posts | unknown (euristica universale, §26.84).';

-- ------------------------------------------------------------
-- 2) Indici
-- ------------------------------------------------------------
-- Il giro ordinario chiede sempre la stessa cosa: «quali fonti sono isolate?».
create index if not exists source_health_quarantine_idx
  on public.source_health (quarantined_at desc)
  where is_quarantined;

-- Diagnosi: le fonti che continuano a fallire senza essere ancora isolate.
create index if not exists source_health_failures_idx
  on public.source_health (consecutive_failures desc)
  where consecutive_failures > 0;

-- ------------------------------------------------------------
-- 3) Trigger `updated_at`
-- ------------------------------------------------------------
-- Funzione DEDICATA alla tabella (convenzione `handle_*_updated_at`), niente
-- `security definer`: tocca solo `new`.
create or replace function public.handle_source_health_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_source_health_updated_at on public.source_health;
create trigger set_source_health_updated_at
  before update on public.source_health
  for each row execute function public.handle_source_health_updated_at();

-- ------------------------------------------------------------
-- 4) RLS — accesso riservato al `service_role`
-- ------------------------------------------------------------
alter table public.source_health enable row level security;

drop policy if exists "service_role_full_access" on public.source_health;
create policy "service_role_full_access"
  on public.source_health
  for all
  to service_role
  using (true)
  with check (true);
