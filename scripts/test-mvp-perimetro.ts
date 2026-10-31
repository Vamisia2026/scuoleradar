/**
 * GUARDIA — PERIMETRO DELL'MVP E DOMANDA REALE (§26.126).
 * -----------------------------------------------------------------------------------
 * PERCHÉ ESISTE. L'MVP non ingerisce più «tutto il Paese»: parte da una BASE
 * NAZIONALE minima (i 20 capoluoghi di regione + Asti) e INTENSIFICA le province
 * che gli utenti hanno cercato («Prova il Radar») o salvato nel profilo. Questa
 * guardia fissa le tre cose che possono rompersi in silenzio:
 *   1. il PERIMETRO — 20 regioni coperte, Asti dentro, nessun codice inventato;
 *   2. la DOMANDA — finestra di 7 giorni, dedup, richieste scadute e codici
 *      sconosciuti dichiarati (mai una provincia fantasma);
 *   3. il CABLAGGIO — migrazione con RPC, registrazione dal browser (prova +
 *      profilo), script e workflow che leggono il registro.
 *
 * Esecuzione: `npm run test:mvp-perimetro` (inclusa in `npm test`).
 */
import { existsSync, readFileSync } from 'node:fs';
import { province } from '../src/data/province.ts';
import { regioneDiProvincia } from '../src/lib/ambitoProvincia.ts';
import {
  GIORNI_DOMANDA,
  PROVINCE_BASELINE,
  TUTTE_LE_SCUOLE,
  eProvinciaBaseline,
  nomeProvincia,
  pianoScansione,
  richiestaInFinestra,
  tettoScuole,
} from '../src/lib/mvpPerimetro.ts';
import { GIORNI_MONITORAGGIO_PROVA } from '../src/lib/provaRadar.ts';
import { RPC_RICHIESTA_PROVINCIA, normalizzaProvinciaRichiesta } from '../src/lib/queueRichieste.ts';

declare const process: { exitCode?: number };

let errori = 0;
function check(nome: string, atteso: unknown, ottenuto: unknown): void {
  const ok = JSON.stringify(atteso) === JSON.stringify(ottenuto);
  if (!ok) errori += 1;
  console.log(`${ok ? '✓' : '✗'} ${nome}: atteso=${JSON.stringify(atteso)} ottenuto=${JSON.stringify(ottenuto)}`);
}
const leggi = (p: string): string => readFileSync(p, 'utf8');

/* ------------------------- 1) Il perimetro nazionale --------------------- */

console.log('\n— 1. Baseline: 20 capoluoghi di regione + Asti —');
check('21 province di baseline (20 capoluoghi + Asti)', 21, PROVINCE_BASELINE.length);
check(
  'tutte le regioni sono coperte',
  20,
  new Set(PROVINCE_BASELINE.map((c) => regioneDiProvincia(c)).filter(Boolean)).size,
);
check('Asti è nella baseline (provincia pilota)', true, eProvinciaBaseline('at'));
check('Torino è nella baseline (capoluogo del Piemonte)', true, eProvinciaBaseline('TO'));
check('Cuneo NON è nella baseline (nessun capoluogo)', false, eProvinciaBaseline('CN'));
check('codice sconosciuto → fuori', false, eProvinciaBaseline('ZZ'));
check(
  'ogni codice della baseline esiste nel catalogo (nessun codice inventato)',
  true,
  PROVINCE_BASELINE.every((c) => province.some((p) => p.codice === c)),
);
check('la finestra della domanda è quella del monitoraggio della prova', GIORNI_MONITORAGGIO_PROVA, GIORNI_DOMANDA);

/* ---------------------------- 2) Piano del giro -------------------------- */

console.log('\n— 2. pianoScansione: la domanda allarga il perimetro, non lo sostituisce —');
const adesso = new Date('2026-11-01T08:00:00.000Z');
const fresco = (province: string) => ({ province, ultima_richiesta: '2026-10-31T08:00:00.000Z' });

const piano = pianoScansione([fresco('CN'), fresco('cn'), fresco('ZZ'), { province: 'RM', ultima_richiesta: '2026-01-01T00:00:00.000Z' }], { adesso });
check('domanda dentro finestra, deduplicata', ['CN'], piano.domanda);
check('la domanda non toglie la baseline', 21, piano.baseline.length);
check('province fuori baseline portate dentro dalla domanda', ['CN'], piano.fuoriBaseline);
check('la domanda è in testa al giro', 'CN', piano.tutte[0]);
check('la somma è baseline + domanda fuori baseline', 22, piano.tutte.length);
check('richiesta scaduta: dichiarata, non accende nulla', ['RM'], piano.scadute);
check('codice fuori catalogo: dichiarato, mai inventato', ['ZZ'], piano.sconosciute);
check('senza richieste: solo baseline', 21, pianoScansione([], { adesso }).tutte.length);
check('richiesta senza data: non vale', false, richiestaInFinestra({ province: 'CN' }, adesso));
check(
  'confine della finestra: 7 giorni passati → scaduta',
  false,
  richiestaInFinestra({ province: 'CN', ultima_richiesta: '2026-10-25T07:59:00.000Z' }, adesso),
);
check(
  'data nel futuro (orologi diversi) → valida',
  true,
  richiestaInFinestra({ province: 'CN', ultima_richiesta: '2026-11-01T12:00:00.000Z' }, adesso),
);
check(
  'tetto: la provincia richiesta legge TUTTE le scuole dell’anagrafica',
  'tutte',
  tettoScuole('CN', piano, { domanda: TUTTE_LE_SCUOLE, fondo: 8 }),
);
check(
  'tetto: la provincia di fondo legge un campione',
  8,
  tettoScuole('TO', piano, { domanda: TUTTE_LE_SCUOLE, fondo: 8 }),
);
check('tetto zero non diventa negativo', 0, tettoScuole('TO', piano, { domanda: 0, fondo: 0 }));
check(
  'un tetto numerico esplicito resta un numero (campagna manuale)',
  60,
  tettoScuole('CN', piano, { domanda: 60, fondo: 8 }),
);

/* --------------- 2-bis) Il capoluogo chiesto sale di regime --------------- */

console.log('\n— 2-bis. Una ricerca su un capoluogo lo promuove a «domanda» —');
const conCapoluogo = pianoScansione([fresco('TO')], { adesso });
check('Torino (baseline) chiesta → densità «domanda»', ['TO'], conCapoluogo.domanda);
check('…non è più nel giro di fondo (una volta sola)', 1, conCapoluogo.tutte.filter((c) => c === 'TO').length);
check('…e legge il 100% delle sue scuole', 'tutte', tettoScuole('TO', conCapoluogo, {
  domanda: TUTTE_LE_SCUOLE,
  fondo: 8,
}));
check('…senza uscire dalla baseline (21 province)', 21, conCapoluogo.baseline.length);

check('nome leggibile della provincia', 'Asti', nomeProvincia('at'));
check('nome di un codice ignoto: il codice stesso', 'ZZ', nomeProvincia('ZZ'));


/* ------------------------ 3) Cablaggio domanda ↔ crawler ----------------- */

console.log('\n— 3. Cablaggio: RPC pubblica, registro, script e workflow —');
check(
  'migrazione del registro della domanda',
  true,
  existsSync('supabase/migrations/20261101120000_province_domanda.sql'),
);
const migrazione = existsSync('supabase/migrations/20261101120000_province_domanda.sql')
  ? leggi('supabase/migrations/20261101120000_province_domanda.sql')
  : '';
check('la tabella si chiama `province_domanda`', true, /create table if not exists public\.province_domanda/i.test(migrazione));
check('RPC `request_province_scan` definita', true, /function public\.request_province_scan/i.test(migrazione));
check(
  'solo codici di due lettere (nessuna riga arbitraria dalla chiave anon)',
  true,
  /\^\[A-Z\]\{2\}\$/.test(migrazione),
);
check('RLS abilitata sul registro', true, /enable row level security/i.test(migrazione));
check(
  'il registro è del worker (mai leggibile dal browser)',
  true,
  /revoke all on table public\.province_domanda from anon, authenticated/i.test(migrazione),
);
check('nome della RPC allineato nel client', 'request_province_scan', RPC_RICHIESTA_PROVINCIA);
check('normalizzazione del codice richiesto', 'AT', normalizzaProvinciaRichiesta(' at '));
check('codice non valido → null', null, normalizzaProvinciaRichiesta('ASTI'));

const prova = leggi('src/departments/radar/services/provaRadarQuery.ts');
check(
  '«Prova il Radar» registra la PROVINCIA oltre alla città',
  true,
  /richiediDomandaProvince\(supabase, \[provincia\], FONTE_RICHIESTA_PROVA\)/.test(prova),
);
const profilo = leggi('src/contexts/app/useAnagraficaProfilo.ts');
check(
  'il salvataggio del profilo registra le province scelte',
  true,
  /richiediDomandaProvince\(supabase, dati\.provinceCodici, FONTE_RICHIESTA_PREFERENZE\)/.test(profilo),
);
const script = existsSync('scripts/crawl-mvp.ts') ? leggi('scripts/crawl-mvp.ts') : '';
const domandaMod = existsSync('scripts/lib/domandaProvincia.ts')
  ? leggi('scripts/lib/domandaProvincia.ts')
  : '';
check(
  'lo script legge il registro della domanda',
  true,
  /from\('province_domanda'\)/.test(domandaMod) && /leggiDomanda/.test(script),
);
check(
  'lo script usa l’anagrafica MIM per ogni provincia',
  true,
  /'--scuole-provincia'/.test(leggi('scripts/lib/giroMvp.ts')) &&
    /scripts\/table-reporter\.ts/.test(leggi('scripts/lib/giroMvp.ts')),
);
check(
  'due giri con densità diverse (domanda e fondo)',
  true,
  /MAX_SCUOLE_DOMANDA/.test(script) && /MAX_SCUOLE_FONDO/.test(script),
);
check(
  'la provincia in domanda non ha tetto (100% dell’anagrafica, §26.127)',
  true,
  /tettoDaArgomento\('max-scuole-domanda'\) \?\? TUTTE_LE_SCUOLE/.test(script),
);
check('il giro legge il termostato degli avvisi attivi', true, /leggiTermostato\(/.test(script));

const workflow = existsSync('.github/workflows/crawl-mvp.yml')
  ? leggi('.github/workflows/crawl-mvp.yml')
  : '';
check('workflow periodico del giro MVP', true, /crawl:mvp/.test(workflow) && /cron:/.test(workflow));
check(
  'workflow con `--apply` dalla dispatch (promozione delle sole province richieste)',
  true,
  /inputs\.apply/.test(workflow),
);

const pkg = leggi('package.json');
check('script npm `crawl:mvp`', true, /"crawl:mvp": "tsx scripts\/crawl-mvp\.ts"/.test(pkg));
check('guardia dedicata al perimetro', true, /"test:mvp-perimetro": "tsx scripts\/test-mvp-perimetro\.ts"/.test(pkg));
check('guardia dedicata ai profili ATA', true, /"test:profili-ata": "tsx scripts\/test-profili-ata\.ts"/.test(pkg));
check('guardia dedicata al termostato', true, /"test:termostato-crawl": "tsx scripts\/test-termostato-crawl\.ts"/.test(pkg));
check('guardia dedicata ai bandi commerciali', true, /"test:bandi-commerciali": "tsx scripts\/test-bandi-commerciali\.ts"/.test(pkg));
check(
  'tutte nella catena di `npm test`',
  true,
  /test-mvp-perimetro\.ts/.test(pkg) &&
    /test-profili-ata\.ts/.test(pkg) &&
    /test-termostato-crawl\.ts/.test(pkg) &&
    /test-bandi-commerciali\.ts/.test(pkg),
);

console.log('\n' + '─'.repeat(70));
if (errori === 0) {
  console.log('✅ MVP DEMAND-DRIVEN: capoluoghi + Asti sempre letti, la domanda accende il resto.');
} else {
  console.log(`❌ MVP DEMAND-DRIVEN: ${errori} controllo/i fallito/i`);
  process.exitCode = 1;
}
