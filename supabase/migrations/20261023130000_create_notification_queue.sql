-- ============================================================
-- CODA DELLE NOTIFICHE — `notification_queue` (producer/consumer, §26.86)
--
-- Perché esiste: finché la consegna di una notifica è una chiamata sincrona
-- dentro il run di scraping, un timeout di Telegram o di Resend può far fallire
-- (o allungare a dismisura) un'ingestione che aveva già scritto le righe giuste.
-- Qui la consegna diventa un MESSAGGIO:
--
--   PRODUTTORE  `scripts/table-reporter.ts` → upsert su `interpelli` + una riga
--               READY in questa coda. Nessun invio.
--   CONSUMATORE `scripts/process-notifications.ts` (`npm run notifiche:processa`)
--               → prende in carico, consegna, registra l'esito.
--
-- Stati (una sola direzione; `NOTIFIED` è terminale):
--
--   READY ──► PROCESSING ──► NOTIFIED        consegna riuscita (o niente da inviare)
--     ▲            │
--     └────────────┘  fallimento 1-2 → READY con backoff (`next_retry_at`)
--                  └──► FAILED_NOTIF        terzo fallimento: si smette e si segnala
--
-- Perché il terzo fallimento è definitivo: un avviso con il recapito sbagliato o
-- una chat_id revocata non si aggiusta ritentando; la voce resta visibile per la
-- diagnosi invece di consumare invii per sempre.
--
-- L'EMAIL NON passa di qui per opportunità: la regola immutabile resta «una sola
-- email di riepilogo al giorno» (`inviaDigestGiornaliero`,
-- `comunicazione/01_email_riepilogo/checklist_email.md`). La colonna
-- `canali_inviati` traccia anche `email` per i percorsi che la consegnano
-- davvero (digest), non per invii per singolo avviso.
--
-- Sicurezza: tabella di SERVIZIO. RLS con la sola policy `service_role`, come
-- `scan_targets` e `source_health`: la coda non si legge né si scrive dal browser.
-- Idempotente: eseguibile più volte senza errori.
-- ============================================================

-- ------------------------------------------------------------
-- 1) Tabella
-- ------------------------------------------------------------
create table if not exists public.notification_queue (
  -- chiave naturale: una voce per interpello (la riga di `interpelli`)
  interpello_id   uuid primary key references public.interpelli(id) on delete cascade,
  -- copia dell'hash: leggibile nelle diagnosi anche se l'interpello cambia id
  interpello_hash text,

  stato           text not null default 'READY',
  tentativi       int  not null default 0,
  canali_inviati  text[] not null default '{}',

  -- ultimo tentativo
  ultimo_canale   text,
  ultimo_errore   text,
  next_retry_at   timestamptz,
  notificata_il   timestamptz,

  -- concorrenza (più consumer in parallelo)
  locked_at       timestamptz,
  locked_by       text,

  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  constraint notification_queue_stato_valid
    check (stato in ('READY', 'PROCESSING', 'NOTIFIED', 'FAILED_NOTIF')),
  constraint notification_queue_tentativi_nonneg check (tentativi >= 0),
  constraint notification_queue_canali_valid
    check (canali_inviati <@ array['telegram', 'email']::text[])
);

comment on table public.notification_queue is
  'Coda di consegna delle notifiche: una voce per interpello, scritta dal produttore (scraper) e consumata da `npm run notifiche:processa` (§26.86).';
comment on column public.notification_queue.stato is
  'READY = da consegnare, PROCESSING = presa in carico da un consumer, NOTIFIED = consegnata (terminale), FAILED_NOTIF = abbandonata dopo 3 fallimenti.';
comment on column public.notification_queue.tentativi is
  'Fallimenti accumulati (non i successi): al terzo la voce diventa FAILED_NOTIF.';
comment on column public.notification_queue.next_retry_at is
  'Prima del timestamp la voce non è ritentabile (backoff esponenziale sui fallimenti).';

-- ------------------------------------------------------------
-- 2) Indici
-- ------------------------------------------------------------
-- Il consumer chiede sempre la stessa cosa: «le voci pronte, dalla più vecchia».
create index if not exists notification_queue_pending_idx
  on public.notification_queue (next_retry_at nulls first, created_at)
  where stato = 'READY';

-- Diagnosi: che cosa è stato abbandonato e perché.
create index if not exists notification_queue_failed_idx
  on public.notification_queue (updated_at desc)
  where stato = 'FAILED_NOTIF';

-- Recupero dei lock lasciati da un worker morto.
create index if not exists notification_queue_stuck_idx
  on public.notification_queue (locked_at)
  where stato = 'PROCESSING';


-- ------------------------------------------------------------
-- 3) Trigger `updated_at`
-- ------------------------------------------------------------
-- Funzione DEDICATA alla tabella (convenzione `handle_*_updated_at`), niente
-- `security definer`: tocca solo `new`.
create or replace function public.handle_notification_queue_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_notification_queue_updated_at on public.notification_queue;
create trigger set_notification_queue_updated_at
  before update on public.notification_queue
  for each row execute function public.handle_notification_queue_updated_at();

-- ------------------------------------------------------------
-- 4) RLS — accesso riservato al `service_role`
-- ------------------------------------------------------------
alter table public.notification_queue enable row level security;

drop policy if exists "service_role_full_access" on public.notification_queue;
create policy "service_role_full_access"
  on public.notification_queue
  for all
  to service_role
  using (true)
  with check (true);

grant all on table public.notification_queue to service_role;
-- Nessun accesso dal client: la coda la scrivono e la leggono solo i worker.
revoke all on table public.notification_queue from anon, authenticated;

-- ------------------------------------------------------------
-- 5) Nessun backfill voluto
-- ------------------------------------------------------------
-- Gli interpelli già in tabella NON vengono accodati: sarebbero centinaia di
-- avvisi storici spediti in blocco. La coda parte vuota e si riempie con le
-- righe che i runner inseriscono da qui in avanti (gli id arrivano dall'upsert
-- `ignoreDuplicates`, quindi solo gli inserimenti reali).
