/**
 * GUARDIA — Scansione dinamica: registro province ↔ seed della coda ↔ RPC di
 * richiesta.
 * -----------------------------------------------------------------------
 * Perché esiste: la scansione dinamica è fatta di tre anelli che si rompono in
 * silenzio, ognuno con una conseguenza precisa:
 *   · REGISTRO ↔ SEED — ogni città di `public.scan_targets` deve avere una
 *     provincia in `src/data/province.ts`: senza, il consumatore non sa quale
 *     provincia scansionare e il target va in errore a ogni giro. È così che è
 *     emersa la provincia mancante `PZ` (Potenza), che rendeva il target di
 *     Potenza non scansionabile;
 *   · MIGRAZIONE — `request_scan_target` deve restare BUMP-ONLY (anticipa una
 *     città ESISTENTE, non ne inserisce di nuove), con throttle, e deve restare
 *     l'UNICA RPC di coda aperta al pubblico (`anon`): le tre dei worker no;
 *   · WRAPPER — i nomi di RPC e di parametri di `src/lib/queueRichieste.ts` (il
 *     lato pubblico) e di `src/lib/queue.ts` (i worker) devono combaciare con le
 *     firme SQL: un rename su un lato solo compila e fallisce a runtime, cioè
 *     quando l'utente prova il Radar.
 *
 * Il cablaggio del worker (consumatore → pipeline → CLI) è nella guardia dedicata
 * `scripts/test-coda-worker.ts` (`npm run test:coda:worker`): questo file ha già
 * il tetto delle 250 righe a un passo.
 *
 * Il controllo è STATICO + in memoria: gira in CI senza database.
 *
 * Esecuzione: npm run test:coda:sync
 */

import { readFileSync } from 'node:fs';
import {
  CAPOLUOGHI_REGIONE,
  TARGET_AGGIUNTIVI,
  capoluogoDaProvincia,
  cittaTargetDaProvince,
  provinciaDaCitta,
} from '../src/lib/scanTargets.ts';
import { province } from '../src/data/province.ts';

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

const SEED = 'supabase/migrations/20260929102443_create_scan_targets_queue.sql';
const RICHIESTE = 'supabase/migrations/20261006120000_scan_targets_richieste.sql';
const sqlSeed = leggi(SEED);
const sqlRichieste = leggi(RICHIESTE);
const wrapper = leggi('src/lib/queueRichieste.ts');
const wrapperWorker = leggi('src/lib/queue.ts');

console.log('— Scansione dinamica: registro ↔ coda ↔ RPC —');

// 1) SEED DELLA CODA ↔ CATALOGO PROVINCE
// Le città del seed si leggono dall'SQL (stessa estrazione di `test:coda`):
// nessun elenco duplicato a mano che possa divergere dal database.
const righeSeed = Array.from(sqlSeed.matchAll(/^\s*\('((?:[^']|'')+)',\s*'((?:[^']|'')+)'\)/gm));
const cittaSeed = righeSeed.map((m) => (m[1] ?? '').replaceAll("''", "'"));
const regioniSeed = righeSeed.map((m) => (m[2] ?? '').replaceAll("''", "'"));

check('seed della coda letto (21 città)', 21, cittaSeed.length);
check('catalogo province completo (107)', 107, province.length);
check(
  'ogni città del seed ha una provincia nel catalogo',
  [],
  cittaSeed.filter((citta) => !provinciaDaCitta(citta)),
);
check(
  'ogni città del seed sta nella regione dichiarata dal seed',
  [],
  cittaSeed
    .map((citta, i) => ({ citta, regione: regioniSeed[i] }))
    .filter(
      ({ citta, regione }) =>
        province.find((p) => p.codice === provinciaDaCitta(citta))?.regione !== regione,
    )
    .map(({ citta }) => citta),
);
check(
  'ogni regione del catalogo ha il capoluogo registrato',
  Array.from(new Set(province.map((p) => p.regione))).sort(),
  Object.keys(CAPOLUOGHI_REGIONE).sort(),
);
check(
  'i capoluoghi sono le città del seed senza i target aggiuntivi',
  cittaSeed.filter((citta) => !TARGET_AGGIUNTIVI.includes(citta)).sort(),
  Object.values(CAPOLUOGHI_REGIONE).sort(),
);
check(
  'scansionare una regione copre la sua città del seed',
  [],
  cittaSeed.filter((citta, i) => {
    const codici = province.filter((p) => p.regione === regioniSeed[i]).map((p) => p.codice);
    return !cittaTargetDaProvince(codici).includes(citta);
  }),
);

// 2) TRADUZIONI PROVINCIA ↔ CITTÀ
check('Potenza è nel catalogo con il codice PZ (regressione)', 'PZ', provinciaDaCitta('Potenza'));
check('Cuneo → Torino (la scansione è regionale, non per provincia)', ['Torino'], cittaTargetDaProvince(['CN']));
check('Asti (target pilota) → Asti + Torino', ['Asti', 'Torino'], cittaTargetDaProvince(['AT']));
check('province di due regioni → un capoluogo ciascuna', ['Milano', 'Torino'], cittaTargetDaProvince(['MI', 'TO', 'CN']));
check('codici ignoti ignorati (nessun target inventato)', [], cittaTargetDaProvince(['ZZ', '']));
check('apostrofo tipografico riconosciuto (L’Aquila)', 'AQ', provinciaDaCitta('L\u2019Aquila'));
check('città fuori catalogo → null (mai indovinare)', null, provinciaDaCitta('Zugo'));
check('codice ignoto → nessun capoluogo', null, capoluogoDaProvincia('ZZ'));

// 3) MIGRAZIONE DELLE RICHIESTE (`request_scan_target`)
console.log('— Migrazione 20261006120000: RPC di richiesta —');
check('file presente e non vuoto', true, sqlRichieste.trim().length > 0);
check(
  'nome del file conforme (timestamp + snake_case)',
  true,
  /^20261006120000_[a-z0-9_]+\.sql$/.test(RICHIESTE.split('/').pop() ?? ''),
);
check(
  'colonne di telemetria idempotenti',
  true,
  ['requested_at', 'request_count', 'last_request_source'].every((col) =>
    new RegExp(`add column if not exists ${col}\\b`, 'i').test(sqlRichieste),
  ),
);
check(
  'RPC definita con guardia (create or replace)',
  true,
  /create or replace function public\.request_scan_target\(/i.test(sqlRichieste),
);
check(
  'RPC blindata (security definer + search_path)',
  true,
  /security definer/i.test(sqlRichieste) && /set search_path = public/i.test(sqlRichieste),
);
check('RPC ritorna un boolean (nessun dato del target)', true, /returns boolean/i.test(sqlRichieste));
check(
  'BUMP-ONLY: aggiorna una città esistente e non ne inserisce',
  true,
  /update public\.scan_targets/i.test(sqlRichieste) && !/insert into public\.scan_targets/i.test(sqlRichieste),
);
check(
  'match esatto sulla città (case e spazi, nessun fuzzy)',
  true,
  /lower\(btrim\(city\)\) = lower\(btrim\(p_city\)\)/i.test(sqlRichieste),
);
check('i target disabilitati restano fuori', true, /status <> 'disabled'/i.test(sqlRichieste));
check(
  'anticipa il giro e alza la priorità (mai rimandare)',
  true,
  /least\(next_run_at, now\(\)\)/i.test(sqlRichieste) && /least\(priority, p_priority\)/i.test(sqlRichieste),
);
check(
  'throttle server-side sulle richieste ripetute',
  true,
  /make_interval\(mins => greatest\(p_throttle_minutes, 0\)\)/i.test(sqlRichieste),
);
check(
  'ritorna true solo se ha registrato la richiesta',
  true,
  /get diagnostics v_righe = row_count/i.test(sqlRichieste) && /return v_righe > 0/i.test(sqlRichieste),
);
check(
  'permessi: revoca a public e grant ad anon/authenticated/service_role',
  true,
  /revoke execute on function public\.request_scan_target\(text, text, smallint, int\) from public;/i.test(
    sqlRichieste,
  ) &&
    /grant execute on function public\.request_scan_target\(text, text, smallint, int\)\s+to anon, authenticated, service_role;/i.test(
      sqlRichieste,
    ),
);
check(
  'le RPC dei worker NON sono aperte al pubblico',
  true,
  !/grant execute on function public\.(claim_scan_target|finish_scan_target|reap_stuck_scans)[^;]*\banon\b/i.test(
    sqlRichieste,
  ),
);

// 4) WRAPPER TypeScript ↔ firma SQL
check('wrapper: chiama request_scan_target', true, wrapper.includes("'request_scan_target'"));
check(
  'wrapper: parametri allineati alla firma SQL',
  true,
  ['p_city', 'p_source', 'p_priority', 'p_throttle_minutes'].every((p) => wrapper.includes(`${p}:`)),
);
check(
  'wrapper: le due sorgenti pubbliche sono distinte',
  true,
  wrapper.includes("FONTE_RICHIESTA_PROVA = 'prova-radar'") &&
    wrapper.includes("FONTE_RICHIESTA_PREFERENZE = 'preferenze'"),
);

// 5) SEPARAZIONE DEI DUE LATI DELLA CODA (lato pubblico ↔ worker)
check(
  'wrapper: le tre RPC dei worker restano in src/lib/queue.ts',
  [],
  ['claim_scan_target', 'finish_scan_target', 'reap_stuck_scans'].filter(
    (rpc) => !wrapperWorker.includes(`'${rpc}'`),
  ),
);
check(
  'lato pubblico: non tocca la coda (nessun claim/finish/reap)',
  true,
  !/claim_scan_target|finish_scan_target|reap_stuck_scans/.test(wrapper),
);

console.log(errori === 0 ? '\n✅ SCANSIONE DINAMICA: nessun problema' : `\n❌ SCANSIONE DINAMICA: ${errori} errore/i`);
process.exitCode = errori === 0 ? 0 : 1;
