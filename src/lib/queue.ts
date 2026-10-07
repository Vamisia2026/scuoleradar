/**
 * ScuoleRadar.it — Coda di scansione regionale (`public.scan_targets`).
 *
 * I worker batch (scraper, GitHub Actions) non devono conoscere i nomi delle
 * funzioni SQL né la forma dei parametri: questo modulo è l'unico punto di
 * contatto con la coda. Le tre RPC avvolte sono definite in
 * `supabase/migrations/20260929102443_create_scan_targets_queue.sql`:
 *
 *   · `claimScanTarget`  → presa in carico atomica del prossimo target dovuto;
 *   · `finishScanTarget` → esito del run (ok/errore) + pianificazione del giro;
 *   · `reapStuckScans`   → libera i lock lasciati dai worker morti.
 *
 * REGOLA DI ROBUSTEZZA (come `automazioniEmailDb`): `client === null` significa
 * «coda non configurata» (dry-run, test, ambiente demo) → `claimScanTarget`
 * restituisce `null` esattamente come per una coda vuota, e le altre due non
 * fanno nulla. Un ERRORE della RPC, invece, viene lanciato: un worker che
 * confonde «database irraggiungibile» con «niente da fare» si spegne in
 * silenzio, e il guasto resta invisibile nel log del run.
 *
 * Le RPC sono di SERVIZIO: passare un client con `SUPABASE_SERVICE_ROLE_KEY`
 * (la chiave anon non ha `execute` sulla coda). Il lato PUBBLICO — la richiesta
 * di scansione, l'unica RPC aperta ad `anon` — vive in `./queueRichieste.ts`.
 */
import type { SupabaseClient } from '@supabase/supabase-js';

/** Stati di un target (enum SQL `public.scan_status`). */
export type StatoScan = 'idle' | 'queued' | 'running' | 'error' | 'disabled';

/** Lease richiesto al claim, in secondi (vedi nota in `claimScanTarget`). */
export const LEASE_CLAIM_SECONDI = 300;

/** Oltre questa soglia un lock è di un worker morto, in secondi. */
export const SOGLIA_LOCK_MORTO_SECONDI = 900;

/** Intervallo base fra due giri dello stesso target, in minuti (6 ore). */
export const INTERVALLO_BASE_MIN = 360;

/** Tetto del backoff esponenziale sui fallimenti, in minuti (24 ore). */
export const BACKOFF_MASSIMO_MIN = 1440;

/** Riga di `public.scan_targets` (nomi così come li restituisce PostgREST). */
export interface TargetScan {
  id: string;
  city: string;
  region: string;
  slug: string;
  status: StatoScan;
  priority: number;
  next_run_at: string;
  last_checked_at: string | null;
  last_success_at: string | null;
  last_error: string | null;
  consecutive_failures: number;
  total_runs: number;
  locked_at: string | null;
  locked_by: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

/** Parametri di `claimScanTarget`. */
export interface OpzioniClaimScan {
  /** Identificativo del worker: finisce in `locked_by` (visibile in diagnosi). */
  worker: string;
  /** Lease richiesto alla RPC, in secondi (default `LEASE_CLAIM_SECONDI`). */
  lockSeconds?: number;
}

/** Parametri di `finishScanTarget`. */
export interface OpzioniFinishScan {
  /** `id` del target restituito da `claimScanTarget`. */
  id: string;
  /** `true` = run riuscito (torna `idle`), `false` = fallito (`error` + backoff). */
  success: boolean;
  /** Messaggio d'errore da registrare in `last_error` (solo se il run fallisce). */
  error?: string | null;
  /** Minuti di attesa dopo un successo (default `INTERVALLO_BASE_MIN`). */
  baseIntervalMin?: number;
  /** Tetto in minuti del backoff sui fallimenti (default `BACKOFF_MASSIMO_MIN`). */
  maxBackoffMin?: number;
}

/** Errore RPC con l'azione della coda che l'ha generato. */
function erroreCoda(azione: string, messaggio: string): Error {
  return new Error(`Coda scansione: ${azione} non riuscita (${messaggio}).`);
}

/** Prima riga di un `setof` PostgREST (`null` se il set è vuoto). */
function primaRiga(data: unknown): TargetScan | null {
  if (Array.isArray(data)) return (data[0] as TargetScan | undefined) ?? null;
  return (data as TargetScan | null) ?? null;
}

/**
 * Presa in carico atomica del prossimo target dovuto (`claim_scan_target`).
 *
 * Ritorna `null` quando non c'è nulla da fare (coda vuota o target non ancora
 * dovuti) oppure quando il client non è configurato.
 *
 * NOTA sul lease: la RPC accetta `p_lock_seconds`, ma è il reaper a decidere
 * quando un lock è scaduto (`reapStuckScans`): il worker DEVE chiudere il run
 * con `finishScanTarget`, altrimenti la riga resta bloccata fino al reap.
 */
export async function claimScanTarget(
  client: SupabaseClient | null,
  opzioni: OpzioniClaimScan,
): Promise<TargetScan | null> {
  if (!client) return null;
  const worker = (opzioni?.worker ?? '').trim();
  if (!worker) throw new Error("Coda scansione: serve l'identificativo del worker (opzioni.worker).");

  const { data, error } = await client.rpc('claim_scan_target', {
    p_worker: worker,
    p_lock_seconds: opzioni.lockSeconds ?? LEASE_CLAIM_SECONDI,
  });
  if (error) throw erroreCoda('claim_scan_target', error.message);
  return primaRiga(data);
}

/**
 * Chiude il run di un target (`finish_scan_target`).
 *
 * Successo → `idle` con prossimo giro fra `baseIntervalMin`; fallimento →
 * `error` con backoff esponenziale (base × 2^fallimenti, tetto
 * `maxBackoffMin`) e `consecutive_failures` incrementato.
 *
 * La RPC ritorna `void` e non segnala un `id` inesistente: con un id sbagliato
 * la chiamata è un no-op silenzioso (nessuna riga aggiornata).
 */
export async function finishScanTarget(
  client: SupabaseClient | null,
  opzioni: OpzioniFinishScan,
): Promise<void> {
  if (!client) return;
  const id = (opzioni?.id ?? '').trim();
  if (!id) throw new Error("Coda scansione: serve l'id del target (opzioni.id).");

  const { error } = await client.rpc('finish_scan_target', {
    p_id: id,
    p_success: Boolean(opzioni.success),
    p_error: opzioni.success ? null : (opzioni.error ?? null),
    p_base_interval_min: opzioni.baseIntervalMin ?? INTERVALLO_BASE_MIN,
    p_max_backoff_min: opzioni.maxBackoffMin ?? BACKOFF_MASSIMO_MIN,
  });
  if (error) throw erroreCoda('finish_scan_target', error.message);
}

/**
 * Riporta in coda (`queued`) i target rimasti `running` oltre la soglia
 * (`reap_stuck_scans`): recupera i lock dei worker morti. Ritorna il numero di
 * righe liberate. Da chiamare all'avvio del run, PRIMA del claim.
 */
export async function reapStuckScans(
  client: SupabaseClient | null,
  staleSeconds: number = SOGLIA_LOCK_MORTO_SECONDI,
): Promise<number> {
  if (!client) return 0;
  const { data, error } = await client.rpc('reap_stuck_scans', {
    p_stale_seconds: staleSeconds,
  });
  if (error) throw erroreCoda('reap_stuck_scans', error.message);
  return typeof data === 'number' ? data : 0;
}
