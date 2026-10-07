-- ============================================================
-- Coda di scansione regionale — RICHIESTE su una città ESISTENTE
-- (`request_scan_target`)
--
-- La coda nasce come strumento dei worker (`20260929102443`): le righe sono i 21
-- target del seed e il giro periodico li ri-visita a intervalli. Restava scoperto
-- il caso in cui è l'UTENTE a chiedere una scansione ADESSO:
--   · prova il Radar su una provincia (box pubblico dell'hero);
--   · salva le sue province di interesse (wizard / profilo).
-- In quei due momenti la città va ri-scansionata subito, non fra sei ore.
--
-- Questa migrazione aggiunge UNA funzione, `request_scan_target`, con tre
-- proprietà:
--   · BUMP-ONLY: può solo ANTICIPARE (`next_run_at = now()`) e ALZARE la priorità
--     di una città GIÀ in `scan_targets` (`lower(btrim(city))`); NON inserisce
--     righe (nessuna città arbitraria entra in coda), NON restituisce dati del
--     target (solo un boolean) e NON tocca i `disabled`;
--   · THROTTLE: richieste ripetute entro `p_throttle_minutes` sono assorbite —
--     una pagina pubblica non deve poter martellare la coda;
--   · ESPOSTA ad `anon`/`authenticated`, perché è il pubblico a chiederla. Le tre
--     RPC dei worker (`claim_scan_target`, `finish_scan_target`, `reap_stuck_scans`)
--     restano RISERVATE al `service_role`.
--
-- Idempotente: eseguibile più volte senza errori.
-- ============================================================

-- ------------------------------------------------------------
-- 1) Telemetria della richiesta (idempotente)
-- ------------------------------------------------------------
alter table public.scan_targets
  add column if not exists requested_at timestamptz;

alter table public.scan_targets
  add column if not exists request_count bigint not null default 0;

alter table public.scan_targets
  add column if not exists last_request_source text;

comment on column public.scan_targets.requested_at is
  'Ultima richiesta esplicita di scansione (request_scan_target): la usano il throttle e la diagnosi. NULL = nessuno l''ha chiesta.';

comment on column public.scan_targets.request_count is
  'Quante volte il target è stato chiesto esplicitamente (prova del Radar, salvataggio preferenze).';

comment on column public.scan_targets.last_request_source is
  'Fonte dell''ultima richiesta esplicita (prova-radar, preferenze, ...).';

-- Nota: NESSUN indice. La tabella ha 21 righe (il seed) e la ricerca è su
-- `lower(btrim(city))`: un indice funzionale costerebbe manutenzione per un
-- guadagno nullo. Da rivedere solo se la coda crescerà di ordini di grandezza.

-- ------------------------------------------------------------
-- 2) RPC `request_scan_target`
-- ------------------------------------------------------------
create or replace function public.request_scan_target(
  p_city text,
  p_source text default 'sconosciuta',
  p_priority smallint default 10,
  p_throttle_minutes int default 5
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_righe int;
begin
  -- Una città IGNOTA non crea un target: la coda resta il seed dei 21 capoluoghi
  -- (la chiave anon non deve poter inserire righe arbitrarie nella coda).
  update public.scan_targets
     set status              = case
                                 when status in ('idle', 'queued', 'error')
                                   then 'queued'::public.scan_status
                                 else status
                               end,
         next_run_at         = least(next_run_at, now()),
         priority            = least(priority, p_priority),
         request_count       = request_count + 1,
         requested_at        = now(),
         last_request_source = coalesce(nullif(btrim(p_source), ''), 'sconosciuta'),
         metadata            = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
                                 'ultima_richiesta_il', now(),
                                 'ultima_richiesta_da',
                                 coalesce(nullif(btrim(p_source), ''), 'sconosciuta')
                               )
   where btrim(p_city) <> ''
     and lower(btrim(city)) = lower(btrim(p_city))
     and status <> 'disabled'
     and (
       requested_at is null
       -- throttle: 0 minuti = richiesta sempre registrata
       or requested_at < now() - make_interval(mins => greatest(p_throttle_minutes, 0))
     );

  get diagnostics v_righe = row_count;
  return v_righe > 0;
end;
$$;

comment on function public.request_scan_target(text, text, smallint, int) is
  'Anticipa la scansione di una città GIA'' presente in scan_targets (stato queued, next_run_at = now(), priorità alzata), con throttle sulle richieste ripetute e nessun inserimento di righe. Ritorna true se la richiesta è stata registrata.';

-- ------------------------------------------------------------
-- 3) Permessi — l'UNICA RPC di coda aperta al pubblico
-- ------------------------------------------------------------
revoke execute on function public.request_scan_target(text, text, smallint, int) from public;
grant execute on function public.request_scan_target(text, text, smallint, int)
  to anon, authenticated, service_role;
