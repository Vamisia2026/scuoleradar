/**
 * GUARDIA — Worker della coda di scansione (§26.69): il PONTE fra coda e pipeline.
 * ------------------------------------------------------------------------------
 * Perché esiste: la coda ha già tre anelli coperti — la migrazione (`test:coda`),
 * registro ↔ seed ↔ RPC (`test:coda:sync`) e il comportamento del consumatore
 * (`test:coda:consumer`). Mancava il quarto: il CABLAGGIO di
 * `src/scraper/codaRun.ts`, dove un errore non si vede finché la coda non gira
 * davvero. I tre modi in cui si rompe in silenzio:
 *   · `eseguiRun` sparisce (o `main` torna a leggere `profiles`): il worker chiama
 *     una funzione che non è la pipeline, oppure ignora la provincia chiesta dal
 *     target e ri-scansiona sempre le stesse province;
 *   · il worker reimplementa la coda (claim/finish propri): due strade per la
 *     stessa coda, che divergono alla prima modifica;
 *   · senza `service_role` il worker prende comunque in carico dei target: la coda
 *     è un'anticipazione, il worker non deve dipendere dal database per esistere.
 *
 * Il controllo è STATICO + in memoria (client `null`, nessuna rete, nessun DB).
 *
 * Esecuzione: npm run test:coda:worker
 */
import { readFileSync } from 'node:fs';
import { MAX_GIRI_LOOP, eseguiGiroCoda, eseguiGiriCoda } from '../src/scraper/codaRun.ts';

declare const process: { exitCode?: number };

let errori = 0;
function check(nome: string, atteso: unknown, ottenuto: unknown): void {
  const ok = JSON.stringify(atteso) === JSON.stringify(ottenuto);
  if (!ok) errori += 1;
  console.log(`${ok ? '✓' : '✗'} ${nome}: atteso=${JSON.stringify(atteso)} ottenuto=${JSON.stringify(ottenuto)}`);
}

/** Legge un file del progetto (percorso relativo alla radice `project/`). */
function leggi(percorso: string): string {
  return readFileSync(new URL(`../${percorso}`, import.meta.url), 'utf8');
}

const indice = leggi('src/scraper/index.ts');
const workerCoda = leggi('src/scraper/codaRun.ts');
const pkg = leggi('package.json');

const VUOTO = { liberati: 0, presi: 0, riusciti: 0, falliti: 0, scartati: [] };
console.log('— Coda di scansione: cablaggio del worker —');

// 1) LA PIPELINE ESPONE IL RUN DI UNA PROVINCIA
check(
  'pipeline: `eseguiRun(provincia)` è esportato e ritorna una Promise',
  true,
  /export async function eseguiRun\(provincia: string\): Promise<void>/.test(indice),
);
check(
  'pipeline: `main` accetta la provincia imposta e SALTA la lettura dei profili',
  true,
  /async function main\(provinceOverride\?: string\[\]\)/.test(indice) &&
    /provinceOverride\?\.length\s*\?\s*provinceOverride\s*:\s*await ottieniProvinceAttive/.test(
      indice,
    ),
);
check(
  'pipeline: il run mirato da CLI (`--provincia=`) è cablato',
  true,
  /startsWith\('--provincia='\)/.test(indice) && /main\(provinciaDaArgv\(\)\)/.test(indice),
);
check(
  'pipeline: l\'import di `index.ts` da parte di un test NON lancia un run',
  true,
  /const eseguitoComeCli = process\.argv/.test(indice),
);

// 2) IL WORKER È UN PONTE (nessuna seconda coda, nessun claim proprio)
check(
  'worker: usa il consumatore e la pipeline, non le RPC di coda',
  true,
  /from '\.\/coda\.ts'/.test(workerCoda) &&
    workerCoda.includes('consumaCodaScansioni(') &&
    workerCoda.includes('scansiona: (provincia) => eseguiRun(provincia)') &&
    /from '\.\/index\.ts'/.test(workerCoda) &&
    !/claimScanTarget|finishScanTarget|reapStuckScans/.test(workerCoda),
);
check('worker: entry point registrato in package.json', true, /"scrape:coda": "tsx src\/scraper\/codaRun\.ts"/.test(pkg));
check(
  'worker: il dry-run non tocca la coda (nessun claim, nessuna scrittura)',
  true,
  /--dry-run/.test(workerCoda) && /nessun claim e nessuna scrittura/.test(workerCoda),
);
check('worker: sotto il tetto delle 250 righe', true, workerCoda.split('\n').length <= 250);
check(
  'worker: il ciclo di `--loop` ha un tetto finito e positivo',
  true,
  Number.isFinite(MAX_GIRI_LOOP) && MAX_GIRI_LOOP >= 1 && MAX_GIRI_LOOP <= 1000,
);

// 3) COMPORTAMENTO SENZA CODA (sviluppo, `service_role` assente)
const logSingolo: string[] = [];
const esito = await eseguiGiroCoda({ client: null, worker: 'guardia', log: (m) => logSingolo.push(m) });
check('coda non configurata: nessun target preso in carico', VUOTO, esito);
check(
  'coda non configurata: dichiarata nel log (mai un giro silenzioso)',
  true,
  logSingolo.some((m) => m.includes('Coda non configurata')),
);

const logLoop: string[] = [];
const totale = await eseguiGiriCoda({
  client: null,
  maxTarget: Number.NaN,
  log: (m) => logLoop.push(m),
});
check('`--loop` con `maxTarget` non valido: un solo giro, nessun ciclo infinito', 1, logLoop.filter((m) => m.includes('Coda di scansione')).length);
check('`--loop` senza coda: totale a zero', VUOTO, totale);

console.log(errori === 0 ? '\n✅ WORKER CODA: nessun problema' : `\n❌ WORKER CODA: ${errori} errore/i`);
process.exitCode = errori === 0 ? 0 : 1;
