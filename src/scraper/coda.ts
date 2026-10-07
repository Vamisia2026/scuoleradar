/**
 * ScuoleRadar.it — CONSUMATORE della coda di scansione regionale (Node-only).
 *
 * I target di `public.scan_targets` (seed `20260929102443`) sono CITTÀ; una run
 * dello scraper lavora su UNA PROVINCIA. Questo modulo chiude il cerchio:
 *
 *   1. libera i lock dei worker morti (`reapStuckScans`);
 *   2. prende in carico i target dovuti (`claimScanTarget`, priorità crescente);
 *   3. traduce la città nella provincia da scansionare (`provinciaDaCitta`);
 *   4. invoca la callback del chiamante UNA volta per target — in
 *      `src/scraper/index.ts` è `eseguiRun()`, la pipeline completa di una provincia;
 *   5. chiude SEMPRE il target (`finishScanTarget`): ok → prossimo giro fra sei
 *      ore, errore → `error` con backoff. Un target chiuso male resta `running`
 *      fino al reap successivo, quindi la chiusura non si salta mai.
 *
 * Ogni target è una PROVINCIA: `Torino` scansiona TO, `Asti` scansiona AT (il
 * target pilota), `Roma` scansiona RM. Attivare una provincia qualunque della
 * regione fa ri-scansionare il capoluogo di quella regione
 * (`src/lib/scanTargets.ts`): la copertura delle fonti è regionale.
 *
 * NON conosce il database oltre `lib/queue.ts` e NON conosce la pipeline: riceve
 * una callback, quindi è verificabile senza rete (`npm run test:coda:sync`) e
 * riusabile da qualunque worker futuro.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  claimScanTarget,
  finishScanTarget,
  reapStuckScans,
  type TargetScan,
} from '../lib/queue.ts';
import { provinciaDaCitta } from '../lib/scanTargets.ts';

/** Target presi in carico in un giro, se il chiamante non dice altro. */
export const MAX_TARGET_PER_GIRO = 5;

/** Parametri di `consumaCodaScansioni`. */
export interface OpzioniCodaScansione {
  /** Client `service_role`; `null` = coda non configurata (nessun claim). */
  client: SupabaseClient | null;
  /** Identificativo del worker (finisce in `scan_targets.locked_by`). */
  worker: string;
  /** Scansiona UNA provincia: lancia se il run è fallito (il target va in errore). */
  scansiona: (provincia: string, target: TargetScan) => Promise<void>;
  /** Massimo numero di target per giro (default `MAX_TARGET_PER_GIRO`). */
  maxTarget?: number;
  /** Log diagnostico (default `console.log`). */
  log?: (messaggio: string) => void;
}

/** Esito di un giro del consumatore (log del run e test). */
export interface EsitoCodaScansione {
  /** Lock recuperati dal reap a inizio giro. */
  liberati: number;
  /** Target presi in carico. */
  presi: number;
  /** Target chiusi con successo. */
  riusciti: number;
  /** Target chiusi in errore (run fallito o città senza provincia). */
  falliti: number;
  /** Città SENZA provincia nel catalogo: il giro prosegue, il target chiude in errore. */
  scartati: string[];
}

/** Numero di target da prendere in carico: un valore non valido ricade sul default. */
function quantiTarget(richiesti: number | undefined): number {
  if (typeof richiesti !== 'number' || !Number.isFinite(richiesti) || richiesti < 1) {
    return MAX_TARGET_PER_GIRO;
  }
  return Math.floor(richiesti);
}

/**
 * Esegue UN giro del consumatore e ritorna l'esito (il chiamante lo logga).
 *
 * Ordine deliberato: il reap precede SEMPRE il claim (un lock lasciato da un worker
 * morto non deve nascondere un target dovuto) e il primo `claimScanTarget` che
 * torna `null` chiude il giro — niente da fare, non si insiste.
 *
 * Se la CHIUSURA di un target fallisce (database irraggiungibile) l'errore risale e
 * il giro si ferma: continuare a prendere in carico target che non si riescono a
 * chiudere accumulerebbe solo lock da recuperare. Le righe rimaste `running` le
 * libera il reap del giro successivo.
 */
export async function consumaCodaScansioni(
  opzioni: OpzioniCodaScansione,
): Promise<EsitoCodaScansione> {
  const { client, worker, scansiona } = opzioni;
  const log = opzioni.log ?? ((messaggio: string) => console.log(messaggio));
  const max = quantiTarget(opzioni.maxTarget);
  const esito: EsitoCodaScansione = { liberati: 0, presi: 0, riusciti: 0, falliti: 0, scartati: [] };

  if (!client) return esito;

  esito.liberati = await reapStuckScans(client);

  for (let i = 0; i < max; i++) {
    const target = await claimScanTarget(client, { worker });
    if (!target) break;
    esito.presi += 1;

    const provincia = provinciaDaCitta(target.city);
    if (!provincia) {
      const messaggio =
        `Città «${target.city}» senza provincia nel catalogo (src/data/province.ts): ` +
        'nessuna scansione possibile per questo target.';
      log(`⚠ ${messaggio}`);
      esito.falliti += 1;
      esito.scartati.push(target.city);
      await finishScanTarget(client, { id: target.id, success: false, error: messaggio });
      continue;
    }

    try {
      await scansiona(provincia, target);
    } catch (err) {
      const messaggio = (err as Error)?.message ?? 'run non riuscita';
      log(`✗ Target ${target.city} (${provincia}) in errore: ${messaggio}`);
      esito.falliti += 1;
      await finishScanTarget(client, { id: target.id, success: false, error: messaggio });
      continue;
    }

    esito.riusciti += 1;
    await finishScanTarget(client, { id: target.id, success: true });
  }

  return esito;
}
