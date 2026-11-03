/**
 * TEST — WHITELIST NAZIONALE DEI TARGET (`src/scraper/whitelistTargets.ts`).
 *
 * Perché serve: il registro fonti contiene le URL VERIFICATE di 17 regioni, ma
 * la coda `discovered_links` ne conosceva 23 (quattro regioni). Questa guardia
 * fissa il contratto di §26.93:
 *   1. ogni fonte ATTIVA diventa un target, una sola volta per URL;
 *   2. le fonti spente restano fuori (nessuna URL inventata, nessuna riesumata);
 *   3. `soliHub` esclude gli aggregatori di post (li legge `src/scraper/index.ts`);
 *   4. il riepilogo (regioni, province, hub) è coerente con la lista;
 *   5. il modulo è PURO e il seminatore parla con `discovered_links` come
 *      `pending` (la coda che il discovery engine consuma).
 *
 * Uso: npm run test:whitelist  (incluso in `npm test`)
 */
import { readFileSync } from 'node:fs';
import { FONTI_INTERPELLI, type FonteInterpelli } from '../src/scraper/fonti.ts';
import {
  chiaveTarget,
  normalizzaUrl,
  riepilogoWhitelist,
  targetWhitelist,
} from '../src/scraper/whitelistTargets.ts';
import { ALIAS_SCARTATI, RIEPILOGO_WHITELIST_2610 } from '../src/scraper/fontiWhitelist2610.ts';
import { SONDE_DISCOVERY, slugProvincia, sondePerProvincia, urlSonda } from '../src/scraper/fontiAggregatori.ts';
import { eAggregatorePrivato, valutaDominio } from '../src/lib/dominiIstituzionali.ts';

declare const process: { exitCode?: number };

let errori = 0;
function check(nome: string, atteso: unknown, ottenuto: unknown): void {
  const ok = JSON.stringify(atteso) === JSON.stringify(ottenuto);
  if (!ok) errori += 1;
  console.log(`${ok ? '✓' : '✗'} ${nome}: atteso=${JSON.stringify(atteso)} ottenuto=${JSON.stringify(ottenuto)}`);
}

const leggi = (p: string): string => readFileSync(p, 'utf8');

/* --------------------- 1) LA WHITELIST REALE DEL REGISTRO ---------------- */

console.log('\n— 1. Whitelist reale: tutte le fonti verificate, una volta sola —');
const target = targetWhitelist();
const riepilogo = riepilogoWhitelist(target);
const url = target.map((t) => t.url);
check('almeno 90 fonti', true, riepilogo.totale >= 90);
check('almeno 70 hub USR/USP', true, riepilogo.hub >= 70);
check('almeno 15 regioni', true, riepilogo.regioni.length >= 15);
check('almeno 50 province', true, riepilogo.province.length >= 50);
check('URL uniche', url.length, new Set(url).size);
check('solo http(s)', [], url.filter((u) => !/^https?:\/\//i.test(u)));
check(
  'ogni hub ha una regione',
  [],
  target.filter((t) => t.tipo === 'hub-istituzionale' && !t.region).map((t) => t.url),
);
check('ogni target ha un dominio', [], target.filter((t) => !t.domain.includes('.')).map((t) => t.url));
check(
  'nessuna fonte spenta',
  [],
  target.filter((t) => !FONTI_INTERPELLI.find((f) => f.id === t.fonte)?.attiva).map((t) => t.url),
);

/* -------------------------- 2) IL RIEPILOGO TORNA ------------------------ */

console.log('\n— 2. Riepilogo coerente con la lista —');
const sommaRegioni = riepilogo.perRegione.reduce((n, voce) => n + voce.totale, 0);
check('totale = regioni + nazionali', riepilogo.totale, sommaRegioni + riepilogo.nazionali);
check('hub = somma hub per regione', riepilogo.hub, riepilogo.perRegione.reduce((n, v) => n + v.hub, 0));
check('nazionale: solo aggregatori', true, target.filter((t) => !t.region).every((t) => t.tipo === 'aggregatore'));
check('regioni ordinate', [...riepilogo.regioni].sort((a, b) => a.localeCompare(b, 'it')), riepilogo.regioni);

/* --------------------- 3) FILTRI E NORMALIZZAZIONE ----------------------- */

console.log('\n— 3. Fonti spente fuori, hub separati dagli aggregatori —');
const finta = (
  id: string,
  urlFonte: string,
  attiva: boolean,
  tipo: FonteInterpelli['tipo'],
): FonteInterpelli => ({
  id,
  etichetta: id,
  url: urlFonte,
  tipo,
  regioni: tipo === 'aggregatore' ? [] : ['Lazio'],
  capoluogo: tipo === 'aggregatore' ? null : 'RM',
  nazionale: tipo === 'aggregatore',
  attiva,
  verificata: attiva ? '2026-10-26' : null,
});
const finte = [
  finta('h1', 'https://www.mim.gov.it/web/roma/interpelli', true, 'hub-istituzionale'),
  finta('h1-bis', 'https://www.mim.gov.it/web/roma/interpelli/', true, 'hub-istituzionale'),
  finta('spenta', 'https://esempio.it/spenta', false, 'hub-istituzionale'),
  finta('agg', 'https://www.scuolainterpelli.it/interpelli-lazio/', true, 'aggregatore'),
];
const daFinte = targetWhitelist(finte);
check('dedup per URL canonica', 2, daFinte.length);
check('fonte spenta esclusa', ['h1', 'agg'], daFinte.map((t) => t.fonte));
check('soli hub', ['h1'], targetWhitelist(finte, { soliHub: true }).map((t) => t.fonte));
check('regione e provincia dalla fonte', ['Lazio', 'RM'], [daFinte[0].region, daFinte[0].province]);
check('aggregatore senza regione', null, daFinte[1].region);

check('URL canonica senza ancora', 'https://esempio.it/a', normalizzaUrl('https://esempio.it/a#x'));
check('schema non apribile', null, normalizzaUrl('mailto:segreteria@esempio.it'));
check('URL invalida', null, normalizzaUrl('non-un-url'));
check('chiave ignora slash e query', chiaveTarget('https://A.it/x/?p=1'), chiaveTarget('https://a.it/x'));

/* --------------------------- 4) PUREZZA E CABLAGGIO --------------------- */

console.log('\n— 4. Modulo puro e seminatore collegato —');
const sorgente = leggi('src/scraper/whitelistTargets.ts');
check('nessun database o rete', false, /supabase|fetch\s*\(|axios/i.test(sorgente));
check(
  'import solo dal registro fonti',
  true,
  (sorgente.match(/^import .*$/gm) ?? []).every((riga) => /from '\.\/fonti\.ts'/.test(riga)),
);
check('sotto 250 righe', true, sorgente.split('\n').length <= 250);

const seminatore = leggi('scripts/sync-targets-whitelist.ts');
const coda = leggi('scripts/lib/codaTargets.ts');
check('scrive su discovered_links', true, /\.from\('discovered_links'\)/.test(coda));
check('semina come pending', true, /STATO_PENDING = 'pending'/.test(coda));
check('dry-run per default', true, /if \(!APPLY\)/.test(seminatore));
check('riattivazione opt-in', true, /--riattiva/.test(seminatore));
check(
  'promozione opt-in da `pending` ad `active_crawler`',
  true,
  /--attiva/.test(seminatore) && /STATO_ATTIVO = 'active_crawler'/.test(coda),
);
check(
  'domini morti spenti con la prova del DNS',
  true,
  /--disabilita-morti/.test(seminatore) && /ENOTFOUND/.test(coda) && /STATO_SPENTO = 'disabled'/.test(coda),
);
check('seminatore sotto 250 righe', true, seminatore.split('\n').length <= 250);
check('modulo di coda sotto 250 righe', true, coda.split('\n').length <= 250);

const reporter = leggi('scripts/table-reporter.ts');
check('giro nazionale nel runner', true, /--nazionale/.test(reporter) && /targetDaWhitelist\(\)/.test(reporter));
check('riepilogo per regione', true, /stampaRiepilogoRegioni\(stats\)/.test(reporter));
check(
  'le fonti verificate non vengono disattivate',
  true,
  /CHIAVI_WHITELIST/.test(reporter) && /target\.verificata/.test(reporter),
);

const pkg = JSON.parse(leggi('package.json')) as { scripts: Record<string, string> };
check('script dedicato', true, 'test:whitelist' in pkg.scripts);
check('seminatore in npm', true, 'targets:whitelist' in pkg.scripts);
check('promozione in npm', true, 'targets:whitelist:attiva' in pkg.scripts);
check('giro nazionale in npm', true, 'ingest:nazionale' in pkg.scripts);
check('guardia nella catena', true, (pkg.scripts.test ?? '').includes('scripts/test-whitelist-targets.ts'));

/* -------- F · Whitelist UST/USR del 26/10/2026 (§26.97) -------- */

const whitelist2610 = leggi('src/scraper/fontiWhitelist2610.ts');
const esclusi2610 = leggi('src/scraper/fontiEsclusiWhitelist2610.ts');
check(
  'blocco 26/10: numeri dichiarati = fonti nel registro',
  {
    attive: FONTI_INTERPELLI.filter((f) => f.id.startsWith('w26-') && f.attiva).length,
    spente: FONTI_INTERPELLI.filter((f) => f.id.startsWith('w26-') && !f.attiva).length,
  },
  { attive: RIEPILOGO_WHITELIST_2610.attive, spente: RIEPILOGO_WHITELIST_2610.spente },
);
check(
  'blocco 26/10: ogni fonte spenta dichiara il motivo',
  [],
  FONTI_INTERPELLI.filter((f) => f.id.startsWith('w26-') && !f.attiva && (f.note ?? '').length < 40).map((f) => f.id),
);
check('blocco 26/10: gli alias scartati NON entrano nel registro', [], [...ALIAS_SCARTATI]
  .map((voce) => chiaveTarget(voce.split(' ')[0]))
  .filter((chiave) => targetWhitelist(FONTI_INTERPELLI).some((t) => chiaveTarget(t.url) === chiave)));
check('blocco 26/10 sotto 250 righe', true, whitelist2610.split('\n').length <= 250);
check('esclusi 26/10 sotto 250 righe', true, esclusi2610.split('\n').length <= 250);
// La riattivazione è parte del giro standard: senza `--riattiva` una fonte
// verificata che il runner ha spento resterebbe fuori per sempre.
check('npm: il giro standard riattiva', true, /--riattiva/.test(pkg.scripts['targets:whitelist:attiva'] ?? ''));
// «Daily exploration routine»: la scoperta gira da sé, oltre la whitelist.
const discoveryWf = leggi('.github/workflows/discovery.yml');
check('npm: scoperta dei target', true, 'scopri:target' in pkg.scripts);
check('workflow di scoperta giornaliero', true, /cron: '0 9 \* \* \*'/.test(discoveryWf) && /--max-target=/.test(discoveryWf));

/* ------- G · SONDE DI DISCOVERY (§26.138): segnalano, NON pubblicano ------- */

console.log('\n— 4. Sonde di discovery: fuori dal registro e fuori dalla coda —');
const sonda = (id: string) => SONDE_DISCOVERY.find((s) => s.id === id);
const hostSonda = (s: { template: string }): string =>
  new URL(s.template).hostname.replace(/^www\./, '').toLowerCase();
check('due sonde dichiarate (docenti.it, scuolago.it)', ['sonda-docenti-it', 'sonda-scuolago'], SONDE_DISCOVERY.map((s) => s.id).sort());
check('ogni sonda ha un template con {provincia}', [], SONDE_DISCOVERY.filter((s) => !s.template.includes('{provincia}')).map((s) => s.id));
check(
  'ogni sonda dichiara data ISO e misura (≥ 80 caratteri)',
  [],
  SONDE_DISCOVERY.filter((s) => !/^\d{4}-\d{2}-\d{2}$/.test(s.verificata) || s.note.length < 80).map((s) => s.id),
);
check('host delle sonde in `AGGREGATORI_PRIVATI`', [], SONDE_DISCOVERY.filter((s) => !eAggregatorePrivato(s.template)).map((s) => s.id));
check(
  '`valutaDominio` respinge un link di sonda (mai in bacheca)',
  [],
  SONDE_DISCOVERY.filter((s) => valutaDominio(s.template.replace('{provincia}', 'asti')).ammesso).map((s) => s.id),
);
check(
  'nessuna sonda nel registro delle fonti',
  [],
  FONTI_INTERPELLI.filter((f) => SONDE_DISCOVERY.some((s) => f.url.toLowerCase().includes(hostSonda(s)))).map((f) => f.id),
);
check(
  'nessuna sonda nella whitelist della coda (nessun target da crawler)',
  [],
  targetWhitelist(FONTI_INTERPELLI).filter((t) => SONDE_DISCOVERY.some((s) => t.domain.endsWith(hostSonda(s)))).map((t) => t.url),
);
// Le due URL qui sotto sono quelle MISURATE il 03/11/2026, non due stringhe scelte a mano.
check('URL misurata su Asti (scuolago.it)', 'https://scuolago.it/interpelli/asti', urlSonda(sonda('sonda-scuolago')!, 'AT'));
check('URL misurata su Asti (docenti.it)', 'https://www.docenti.it/interpelli/interpelli-asti.html', urlSonda(sonda('sonda-docenti-it')!, 'asti'));
check('slug delle province composte', ['l-aquila', 'forli-cesena', 'verbano-cusio-ossola'], [
  slugProvincia("L'Aquila"), slugProvincia('FC'), slugProvincia('VB'),
]);
check('provincia sconosciuta: nessuna URL inventata', null, urlSonda(sonda('sonda-scuolago')!, '   '));
check('sonde per provincia: 2 URL per Torino', 2, sondePerProvincia('TO').length);

console.log(
  errori === 0
    ? '\n✅ WHITELIST NAZIONALE: fonti verificate, coda pronta, nessuna URL inventata.'
    : `\n❌ WHITELIST NAZIONALE: ${errori} errore/i`,
);
process.exitCode = errori === 0 ? 0 : 1;
