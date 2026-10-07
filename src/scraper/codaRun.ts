/**
 * ScuoleRadar.it — WORKER della coda di scansione regionale (§26.69).
 * -------------------------------------------------------------------
 * Entry point Node che fa girare UN giro del consumatore (`consumaCodaScansioni`,
 * `src/scraper/coda.ts`) sulla pipeline vera: per ogni città presa in carico
 * esegue il run completo della provincia che quella città copre (`eseguiRun`,
 * `src/scraper/index.ts`).
 *
 * Qui NON c'è logica di coda (reap/claim/chiusura stanno nel consumatore, che è
 * verificato senza rete da `npm run test:coda:consumer`) e NON c'è logica di
 * scansione: questo file è solo il CABLAGGIO fra database, consumatore e pipeline.
 *
 * Uso:
 *   npm run scrape:coda                # un giro (fino a 5 città dovute)
 *   npm run scrape:coda -- --loop      # giri consecutivi finché la coda ha lavoro
 *   npm run scrape:coda -- --max=1     # un solo target (prova mirata, es. Asti)
 *   npm run scrape:coda -- --dry-run   # nessun claim: controllo di configurazione
 *
 * Requisiti: `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` (le tre RPC dei worker
 * sono revocate ad `anon`/`authenticated`) e la migrazione di `scan_targets`
 * applicata. Senza client la coda NON è un errore: il giro esce pulito e lo dice.
 */
import process from 'node:process';
import type { SupabaseClient } from '@supabase/supabase-js';
import { MAX_TARGET_PER_GIRO, consumaCodaScansioni, type EsitoCodaScansione } from './coda.ts';
import { caricaEnv, clientSupabase, eseguiRun } from './index.ts';
import { ledgerLocaleSalva } from '../lib/ledgerLocale.ts';

/** Tetto ai giri consecutivi di `--loop`: rete di sicurezza, mai un ciclo infinito. */
export const MAX_GIRI_LOOP = 50;

/** Parametri di un giro (default: ambiente, worker di questo processo, 5 target). */
export interface OpzioniGiroCoda {
  /** Client `service_role`; `null` = coda non configurata. Omesso = letto dall'ambiente. */
  client?: SupabaseClient | null;
  /** Identificativo del worker (`scan_targets.locked_by`). Omesso = generato. */
  worker?: string;
  /** Massimo numero di target nel giro (default `MAX_TARGET_PER_GIRO`). */
  maxTarget?: number;
  /** Log diagnostico (default `console.log`). */
  log?: (messaggio: string) => void;
}

function workerId(): string {
  const nome = process.env.SCRAPER_WORKER_ID?.trim();
  if (nome) return nome;
  const run = process.env.GITHUB_RUN_ID?.trim();
  return run ? `gha-${run}-${process.pid}` : `worker-${process.pid}`;
}

/** Client `service_role` per la coda, oppure `null` se l'ambiente non lo prevede. */
export function clientCoda(): SupabaseClient | null {
  const env = caricaEnv();
  const url = env.SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  return url && key ? clientSupabase(url, key) : null;
}

/** Numero di target del giro: un valore non valido ricade sul default (mai `NaN`). */
function maxDelGiro(valore: number | undefined): number {
  if (typeof valore !== 'number' || !Number.isFinite(valore) || valore < 1) {
    return MAX_TARGET_PER_GIRO;
  }
  return Math.floor(valore);
}

/**
 * UN giro: reap → claim dei target dovuti → per ognuno la pipeline della provincia
 * → chiusura del target. L'esito è dichiarato SEMPRE (mai un giro silenzioso):
 * è la telemetria che il log del workflow mostra.
 *
 * Se il client manca (ambiente di sviluppo senza `service_role`) il giro esce
 * subito e pulito: la coda è un'anticipazione, non una dipendenza.
 */
export async function eseguiGiroCoda(opzioni: OpzioniGiroCoda = {}): Promise<EsitoCodaScansione> {
  const log = opzioni.log ?? ((messaggio: string) => console.log(messaggio));
  const client = opzioni.client !== undefined ? opzioni.client : clientCoda();
  const worker = opzioni.worker ?? workerId();

  log(`━━ Coda di scansione · worker ${worker} ━━`);
  if (!client) {
    log(
      '⚠ Coda non configurata (SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY): ' +
        'nessun target preso in carico.',
    );
    return { liberati: 0, presi: 0, riusciti: 0, falliti: 0, scartati: [] };
  }

  const esito = await consumaCodaScansioni({
    client,
    worker,
    maxTarget: opzioni.maxTarget,
    log,
    scansiona: (provincia) => eseguiRun(provincia),
  });

  log(
    `• Giro concluso: lock liberati ${esito.liberati} · presi ${esito.presi} · ` +
      `riusciti ${esito.riusciti} · falliti ${esito.falliti}` +
      (esito.scartati.length > 0 ? ` · città senza provincia: ${esito.scartati.join(', ')}` : ''),
  );
  return esito;
}

/**
 * Giri consecutivi finché la coda ha lavoro: un giro che si chiude sul limite ha
 * lasciato target dovuti in coda, quindi se ne fa un altro (mai più di
 * `MAX_GIRI_LOOP`, per non restare appesi se il database non si svuota mai).
 */
export async function eseguiGiriCoda(opzioni: OpzioniGiroCoda = {}): Promise<EsitoCodaScansione> {
  const max = maxDelGiro(opzioni.maxTarget);
  const totale: EsitoCodaScansione = {
    liberati: 0,
    presi: 0,
    riusciti: 0,
    falliti: 0,
    scartati: [],
  };

  for (let giro = 1; giro <= MAX_GIRI_LOOP; giro++) {
    const esito = await eseguiGiroCoda(opzioni);
    totale.liberati += esito.liberati;
    totale.presi += esito.presi;
    totale.riusciti += esito.riusciti;
    totale.falliti += esito.falliti;
    totale.scartati.push(...esito.scartati);
    if (esito.presi < max) break;
  }
  return totale;
}

/**
 * Esegue il worker SOLO quando il file è invocato come CLI (`npm run scrape:coda`),
 * mai quando il modulo viene importato da un test.
 */
const eseguitoComeCli = process.argv
  .slice(1)
  .some((a) => /[\\/]codaRun\.(?:ts|js|mjs|cjs)$/i.test(a));

if (eseguitoComeCli) {
  // RETE DI SICUREZZA (stessa ragione di `index.ts`): il ledger anti-duplicato
  // deve salvarsi anche se il worker viene ucciso a metà giro.
  process.on('exit', () => ledgerLocaleSalva());

  const maxTarget = maxDelGiro(
    (() => {
      const arg = process.argv.find((a) => a.startsWith('--max='));
      const numero = Number(arg?.slice('--max='.length).trim());
      return arg ? numero : undefined;
    })(),
  );

  if (process.argv.includes('--dry-run')) {
    console.log('• Dry-run: nessun claim e nessuna scrittura — la coda non viene toccata.');
    console.log(
      `• Worker ${workerId()} · coda ${clientCoda() ? 'configurata' : 'NON configurata'} · ` +
        `max ${maxTarget} target per giro · modalità ${process.argv.includes('--loop') ? 'loop' : 'giro singolo'}`,
    );
  } else {
    const opzioni = { maxTarget };
    const esegui = process.argv.includes('--loop') ? eseguiGiriCoda : eseguiGiroCoda;
    esegui(opzioni).catch((err: unknown) => {
      console.error('✗ Errore imprevisto nel worker della coda:', err);
      process.exitCode = 1;
    });
  }
}
