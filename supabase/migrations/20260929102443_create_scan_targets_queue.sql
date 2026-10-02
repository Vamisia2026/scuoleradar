-- ============================================================
-- Coda di scansione regionale — `scan_targets` + RPC per i worker
--
-- Blueprint di riferimento (DeepSeek, 2026-09-29): una riga per città da
-- scansionare (i 20 capoluoghi di regione + Asti) distribuita su più worker
-- concorrenti, con presa in carico atomica, lock del worker e backoff
-- esponenziale sui fallimenti.
--
--   · `claim_scan_target`  → claim atomico (FOR UPDATE SKIP LOCKED)
--   · `finish_scan_target` → esito ok/errore + pianificazione del prossimo giro
--   · `reap_stuck_scans`   → recupero dei lock lasciati da worker morti
--
-- Sicurezza: tabella e RPC sono di SERVIZIO (servono ai worker batch, non al
-- browser). RLS abilitata con la sola policy `service_role` e `execute`
-- REVOCATO da `public`/`anon`/`authenticated`: le funzioni sono
-- `security definer`, quindi senza revoca la chiave anon potrebbe consumare la
-- coda dall'esterno. I worker usano `SUPABASE_SERVICE_ROLE_KEY`
-- (wrapper TypeScript: `src/lib/queue.ts`).
--
-- Idempotente: eseguibile più volte senza errori.
-- ============================================================

-- ------------------------------------------------------------
-- 1) Enum di stato del target
-- ------------------------------------------------------------
-- `create type` non ha `if not exists`: guardia esplicita sul catalogo.
do $$
begin
  if not exists (
    select 1
      from pg_type t
      join pg_namespace n on n.oid = t.typnamespace
     where t.typname = 'scan_status'
       and n.nspname = 'public'
  ) then
    create type public.scan_status as enum ('idle', 'queued', 'running', 'error', 'disabled');
  end if;
end;
$$;

comment on type public.scan_status is
  'Stato di un target di scansione: idle = pronto, queued = in coda, running = in carico a un worker, error = ultimo run fallito, disabled = escluso dal giro.';

-- ------------------------------------------------------------
-- 2) Tabella
-- ------------------------------------------------------------
create table if not exists public.scan_targets (
  id                   uuid primary key default gen_random_uuid(),
  city                 text not null,
  region               text not null,
  slug                 text generated always as (lower(replace(city, ' ', '-'))) stored,

  status               public.scan_status not null default 'idle',
  priority             smallint not null default 100,

  -- pianificazione / telemetria
  next_run_at          timestamptz not null default now(),
  last_checked_at      timestamptz,
  last_success_at      timestamptz,
  last_error           text,
  consecutive_failures int not null default 0,
  total_runs           bigint not null default 0,

  -- concorrenza
  locked_at            timestamptz,
  locked_by            text,

  metadata             jsonb not null default '{}'::jsonb,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),

  constraint scan_targets_city_key unique (city),
  constraint scan_targets_failures_nonneg check (consecutive_failures >= 0)
);

comment on table public.scan_targets is
  'Coda di scansione: una riga per città (20 capoluoghi di regione + Asti) con stato, lock del worker e pianificazione del prossimo giro.';

comment on column public.scan_targets.locked_by is
  'Worker che ha preso in carico la riga (`claim_scan_target`); NULL quando la riga è libera.';

-- ------------------------------------------------------------
-- 3) Indici
-- ------------------------------------------------------------
-- Indice del claim: copre la WHERE esatta di `claim_scan_target`.
create index if not exists scan_targets_claim_idx
  on public.scan_targets (priority, next_run_at)
  where status in ('idle', 'queued');

-- Indice del reaper: trova i lock più vecchi della soglia.
create index if not exists scan_targets_running_idx
  on public.scan_targets (locked_at)
  where status = 'running';

create index if not exists scan_targets_region_idx on public.scan_targets (region);

-- ------------------------------------------------------------
-- 4) Trigger `updated_at`
-- ------------------------------------------------------------
-- Funzione DEDICATA alla tabella (non un helper generico in `public`): stesso
-- schema di `handle_profiles_updated_at` / `handle_generated_modules_updated_at`.
-- Niente `security definer`: la funzione tocca solo `new`, non legge tabelle.
create or replace function public.handle_scan_targets_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_scan_targets_updated_at on public.scan_targets;
create trigger set_scan_targets_updated_at
  before update on public.scan_targets
  for each row execute function public.handle_scan_targets_updated_at();

-- ------------------------------------------------------------
-- 5) Claim atomico (ingresso dei worker)
-- ------------------------------------------------------------
-- Due passi, entrambi nella STESSA transazione della chiamata:
--   1. `select ... for update skip locked` sceglie il prossimo target dovuto e
--      ne prende il lock di riga: un worker concorrente SALTA quella riga
--      (`skip locked`) invece di aspettarla, quindi non può ricevere lo
--      stesso target;
--   2. `update ... returning ... into` la marca `running` e restituisce al
--      worker i valori aggiornati.
-- Il lock del passo 1 è tenuto fino al commit: fra i due passi nessun altro
-- worker può infilarsi, quindi la presa in carico resta atomica.
-- Il passo 2 riusa `returning ... into` (stesso schema di
-- `consuma_credito_utente`) invece di `return query <update>`: `return query`
-- in questo progetto è sempre e solo su `select`.
--
-- NOTA su `p_lock_seconds`: è nel contratto del blueprint ma NON è applicato
-- qui (la riga resta `running` finché il worker non chiama
-- `finish_scan_target`). La scadenza effettiva del lock è decisa dal reaper
-- (`reap_stuck_scans`, parametro `p_stale_seconds`).
create or replace function public.claim_scan_target(
  p_worker       text,
  p_lock_seconds int default 300
)
returns setof public.scan_targets
language plpgsql
security definer
set search_path = public
as $$
declare
  v_target public.scan_targets;
begin
  select *
    into v_target
    from public.scan_targets
   where status in ('idle', 'queued')
     and next_run_at <= now()
   order by priority asc, next_run_at asc
   limit 1
     for update skip locked;

  -- coda vuota o nessun target dovuto: nessuna riga, il worker chiude il giro
  if not found then
    return;
  end if;

  update public.scan_targets
     set status     = 'running',
         locked_at  = now(),
         locked_by  = p_worker,
         total_runs = total_runs + 1
   where id = v_target.id
  returning * into v_target;

  return next v_target;
  return;
end;
$$;

comment on function public.claim_scan_target(text, int) is
  'Presa in carico atomica (FOR UPDATE SKIP LOCKED) del prossimo target dovuto: ritorna la riga marcata running o nessuna riga se la coda è vuota.';

-- ------------------------------------------------------------
-- 6) Chiusura del run + backoff esponenziale
-- ------------------------------------------------------------
-- Successo  → `idle`, prossimo giro fra `p_base_interval_min`.
-- Fallimento → `error`, prossimo giro a base × 2^fallimenti (tetto
-- `p_max_backoff_min`) con `consecutive_failures` incrementato.
--
-- La formula del backoff è calcolata in `numeric` con esponente limitato: la
-- stessa espressione in `int` andava in overflow (ERROR 22003 «integer out of
-- range») dal 31° fallimento in poi — cioè su una fonte morta da settimane,
-- esattamente il caso che il backoff deve gestire. I valori restituiti sono
-- identici in ogni caso in cui il risultato non supera il tetto.
create or replace function public.finish_scan_target(
  p_id                uuid,
  p_success           boolean,
  p_error             text default null,
  p_base_interval_min int  default 360,   -- 6h dopo un run riuscito
  p_max_backoff_min   int  default 1440   -- tetto del backoff (24h)
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_failures int;
  v_delay    int;
begin
  select consecutive_failures
    into v_failures
    from public.scan_targets
   where id = p_id
     for update;

  if p_success then
    update public.scan_targets
       set status               = 'idle',
           last_checked_at      = now(),
           last_success_at      = now(),
           last_error           = null,
           consecutive_failures = 0,
           next_run_at          = now() + make_interval(mins => p_base_interval_min),
           locked_at            = null,
           locked_by            = null
     where id = p_id;
  else
    v_failures := coalesce(v_failures, 0) + 1;
    v_delay := least(
      p_base_interval_min::numeric * (2::numeric ^ least(v_failures, 30)),
      p_max_backoff_min::numeric
    )::int;

    update public.scan_targets
       set status               = 'error',
           last_checked_at      = now(),
           last_error           = p_error,
           consecutive_failures = v_failures,
           next_run_at          = now() + make_interval(mins => v_delay),
           locked_at            = null,
           locked_by            = null
     where id = p_id;
  end if;
end;
$$;

comment on function public.finish_scan_target(uuid, boolean, text, int, int) is
  'Chiude il run di un target: successo → idle con prossimo giro fra p_base_interval_min; fallimento → error con backoff esponenziale (tetto p_max_backoff_min).';

-- ------------------------------------------------------------
-- 7) Reaper dei worker morti
-- ------------------------------------------------------------
-- Riporta in coda i target rimasti `running` oltre `p_stale_seconds`: è la
-- rete di sicurezza per un worker che crasha dopo il claim e prima di
-- `finish_scan_target` (altrimenti il target non verrebbe mai più scansionato).
create or replace function public.reap_stuck_scans(p_stale_seconds int default 900)
returns int
language sql
security definer
set search_path = public
as $$
  with reaped as (
    update public.scan_targets
       set status     = 'queued',
           locked_at  = null,
           locked_by  = null,
           last_error = coalesce(last_error, 'reaped: worker timeout')
     where status = 'running'
       and locked_at < now() - make_interval(secs => p_stale_seconds)
    returning 1
  )
  select count(*)::int from reaped;
$$;

comment on function public.reap_stuck_scans(int) is
  'Riporta in coda (queued) i target rimasti running oltre la soglia: recupera i lock dei worker morti. Ritorna il numero di righe liberate.';

-- ------------------------------------------------------------
-- 8) RLS — accesso riservato al `service_role`
-- ------------------------------------------------------------
alter table public.scan_targets enable row level security;

drop policy if exists "service_role_full_access" on public.scan_targets;
create policy "service_role_full_access"
  on public.scan_targets
  for all
  to service_role
  using (true)
  with check (true);

grant all on table public.scan_targets to service_role;
-- Nessun accesso dal client: la coda la scrivono solo i worker.
revoke all on table public.scan_targets from anon, authenticated;

-- Le RPC sono `security definer`: l'`execute` di default a PUBLIC le
-- esporrebbe alla chiave anon (coda consumabile dall'esterno). Si revoca da
-- PUBLIC/anon/authenticated e si concede al solo `service_role`.
revoke execute on function public.claim_scan_target(text, int) from public, anon, authenticated;
grant execute on function public.claim_scan_target(text, int) to service_role;

revoke execute on function public.finish_scan_target(uuid, boolean, text, int, int) from public, anon, authenticated;
grant execute on function public.finish_scan_target(uuid, boolean, text, int, int) to service_role;

revoke execute on function public.reap_stuck_scans(int) from public, anon, authenticated;
grant execute on function public.reap_stuck_scans(int) to service_role;

-- ------------------------------------------------------------
-- 9) Seed — 20 capoluoghi di regione + Asti (21 target)
-- ------------------------------------------------------------
-- `on conflict (city) do nothing`: rieseguire la migrazione non azzera lo stato
-- della coda (un target già scansionato NON torna `idle`).
-- `priority` (default 100) si abbassa per far passare avanti una città nel
-- claim; `next_run_at` nasce a `now()`, quindi al primo run i 21 target sono
-- tutti dovuti e vengono distribuiti ai worker in ordine di priorità.
insert into public.scan_targets (city, region) values
  ('Roma',       'Lazio'),
  ('Milano',     'Lombardia'),
  ('Napoli',     'Campania'),
  ('Palermo',    'Sicilia'),
  ('Torino',     'Piemonte'),
  ('Bari',       'Puglia'),
  ('Firenze',    'Toscana'),
  ('Catanzaro',  'Calabria'),
  ('Cagliari',   'Sardegna'),
  ('Genova',     'Liguria'),
  ('Bologna',    'Emilia-Romagna'),
  ('Venezia',    'Veneto'),
  ('L''Aquila',  'Abruzzo'),
  ('Perugia',    'Umbria'),
  ('Ancona',     'Marche'),
  ('Potenza',    'Basilicata'),
  ('Campobasso', 'Molise'),
  ('Trento',     'Trentino-Alto Adige'),
  ('Trieste',    'Friuli-Venezia Giulia'),
  ('Aosta',      'Valle d''Aosta'),
  ('Asti',       'Piemonte')
on conflict (city) do nothing;


