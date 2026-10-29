/**
 * TEST — SGRANATURA DEGLI ELENCHI E TETTI DELL'ATTACCO DI MASSA (§26.101–102).
 *
 * Il 29/10/2026 il database aveva **109** interpelli vivi su un Paese che ne
 * pubblica molti di più. Il collo di bottiglia non era il registro delle fonti
 * né i parser: erano i **tetti** — 10 documenti per pagina-elenco, 12 fonti per
 * giro, 6 hub per regione — la regola che apre i documenti senza distinguere un
 * avviso da una sezione, e l'elenco letto solo in prima pagina. Questa guardia fissa:
 *   1. si aprono gli AVVISI, mai la pagina stessa, la home o una sezione (§26.99);
 *   2. l'ordine della pagina si conserva e ogni URL si apre una volta sola;
 *   3. i tetti hanno default dichiarati e override d'ambiente VALIDATI;
 *   4. la finestra rotante copre un elenco lungo in più giri;
 *   5. la tabella dentro il documento dà una riga (un avviso) per istituto;
 *   6. il giro nazionale legge TUTTI gli hub verificati.
 *
 * Uso: npm run test:sgranatura  (incluso in `npm test`)
 */
import { readFileSync } from 'node:fs';
import {
  AMBIENTE_SGRANATURA,
  LIMITI_SGRANATURA,
  TETTO_MASSIMO_MS_ELENCO,
  TETTO_MASSIMO_SGRANATURA,
  finestraElenco,
  limitiSgranatura,
  vociDaSgranare,
} from '../src/scraper/sgranatura.ts';
import { MAX_FONTI_PER_RUN, MAX_HUB_PER_REGIONE, fontiAttive, fontiPerRun } from '../src/scraper/fonti.ts';
import { dataIsoItaliana, righeTabellaInterpelli } from '../src/scraper/tabellaInterpelliPdf.ts';
import { eAvvisoSuPiattaforma, eFileDocumento } from '../src/scraper/allegatiPiattaforma.ts';
import { targetWhitelist } from '../src/scraper/whitelistTargets.ts';

declare const process: { exitCode?: number };

let errori = 0;
function check(nome: string, atteso: unknown, ottenuto: unknown): void {
  const ok = JSON.stringify(atteso) === JSON.stringify(ottenuto);
  if (!ok) errori += 1;
  console.log(`${ok ? '✓' : '✗'} ${nome}: atteso=${JSON.stringify(atteso)} ottenuto=${JSON.stringify(ottenuto)}`);
}
const leggi = (p: string): string => readFileSync(p, 'utf8');

/* ------------------- 1) QUALI VOCI DI UN ELENCO SI APRONO ------------------ */
console.log('\n— 1. Si apre un avviso, mai un elenco —');
const pagina = 'https://www.usparezzo.it/usparezzo/index.php/interpelli';
const voci = [
  { title: 'Interpello A022 sostegno — IC 1 Arezzo', directUrl: 'https://www.usparezzo.it/avvisi/12345-interpello-a022.pdf' },
  { title: 'Interpelli della sezione', directUrl: pagina },
  { title: 'Home dell’ufficio', directUrl: 'https://www.usparezzo.it/' },
  { title: 'Sezione interpelli', directUrl: 'https://www.usparezzo.it/interpelli/' },
  { title: 'Doppione', directUrl: 'https://www.usparezzo.it/avvisi/12345-interpello-a022.pdf#pagina=2' },
  { title: 'Interpello A001 — IC 2 Arezzo', directUrl: 'https://www.usparezzo.it/avvisi/67890-interpello-a001' },
  { title: 'Senza URL', directUrl: null },
  { title: 'Non http', directUrl: 'mailto:usp@example.it' },
];
const aperte = vociDaSgranare(voci, { paginaUrl: pagina });
check('si aprono solo i due avvisi veri', 2, aperte.length);
const aperteUrl = aperte.map((v) => v.directUrl);
check(
  'gli avvisi restano, nell’ordine della pagina',
  ['https://www.usparezzo.it/avvisi/12345-interpello-a022.pdf', 'https://www.usparezzo.it/avvisi/67890-interpello-a001'],
  aperteUrl,
);
check('la pagina stessa, la home e la sezione non si aprono', [], aperteUrl.filter((u) => !/\/avvisi\//.test(u)));
check('il doppione con ancora non raddoppia', 2, new Set(aperte.map((v) => v.directUrl)).size);
check('una voce senza URL non entra', [], aperte.filter((v) => !/^https?:/i.test(v.directUrl)));
check('il tetto vale anche qui', 1, vociDaSgranare(voci, { paginaUrl: pagina, max: 1 }).length);
check('tetto 0 = nessuna apertura', 0, vociDaSgranare(voci, { paginaUrl: pagina, max: 0 }).length);
check(
  'l’e-portfolio MIM («/web/<territorio>») resta fuori',
  [],
  vociDaSgranare([{ title: 'ATP Cagliari', directUrl: 'https://www.mim.gov.it/web/cagliari' }], {}),
);
check(
  'il POST del MIM («/web/x/-/slug») si apre',
  1,
  vociDaSgranare([{ title: 'Interpello', directUrl: 'https://www.mim.gov.it/web/milano/-/interpello-a022' }], {}).length,
);
check('il titolo e gli altri campi della voce si conservano', 'Interpello A022 sostegno — IC 1 Arezzo', aperte[0]?.title);

/* ------------- 1-bis) LA TABELLA DENTRO IL DOCUMENTO: UNA RIGA = UN AVVISO -- */
console.log('\n— 1-bis. Le righe della tabella d’avviso (codice, classe, termine, link) —');
// Testo reale (estratto) del PDF «Interpelli n. 72.pdf» dell’ATP Bergamo.
const tabellaPdf = [
  'Istituzione scolastica',
  'Classe di concorso',
  'Inizio incarico',
  'Fine incarico',
  'Scadenza interpello',
  'Link dell’avviso',
  'BGIS033008 - ISTITUTO DI ISTR. SUP. "ZENALE E BUTINONE" TREVIGLIO',
  'A026 - MATEMATICA',
  'Interpelli per le supplenze',
  '1 - 18 ore',
  '2/11/2026',
  '22/12/2026',
  '29/10/2026',
  'https://www.zenale.edu.it/pagine/interpelli',
  'BGIC85100N - I. C. "SORELLE DE MARCHI" - GROMO',
  'AAAA - SCUOLA DELL’INFANZIA',
  'Interpelli per le supplenze',
  '1- 25 ore',
  '30/10/2026',
  '21/12/2026',
  '29/10/2026',
  'https://nuvola.madisoft.it/bacheca-digitale/bacheca/BGIC85100N/4/IN_PUBBLICAZIONE/abc',
  'BGIC80700G - I. C. "DE AMICIS" - BERGAMO',
  'ADAA - SOSTEGNO SCUOLA DELL’INFANZIA',
  '3/11/2026',
  '30/6/2027',
].join('\n');
const righe = righeTabellaInterpelli(tabellaPdf);
check('una riga per istituto (non un avviso solo)', 3, righe.length);
check('codice, classe e materia del primo blocco', ['BGIS033008', 'A026', 'MATEMATICA'], [
  righe[0]?.schoolCode,
  righe[0]?.classCode,
  righe[0]?.subject,
]);
check('il TERMINE è la terza data (non l’inizio né la fine)', '2026-10-29', righe[0]?.deadline);
check('il link è quello dell’avviso di quella scuola', 'https://www.zenale.edu.it/pagine/interpelli', righe[0]?.sourceUrl);
check('tipologia di posto (AAAA) letta come classe', 'AAAA', righe[1]?.classCode);
check('bacheca su piattaforma come link dell’avviso', true, /nuvola\.madisoft\.it\/bacheca-digitale/.test(righe[1]?.sourceUrl ?? ''));
check('con due sole date non si indovina il termine', null, righe[2]?.deadline);
check('documento non tabellare → nessuna riga', [], righeTabellaInterpelli('Nessun allegato, solo testo.'));
check('testo vuoto → nessuna riga', [], righeTabellaInterpelli(''));
check('data inesistente rifiutata', null, dataIsoItaliana('32', '13', '2026'));
check('data valida in ISO', '2026-11-02', dataIsoItaliana('2', '11', '2026'));

// §26.101 — il documento del MIM è un repository Liferay: `.pdf` PRIMA della fine
// del percorso (`…/Interpelli+n.+72.pdf/<uuid>`). Senza questo, 200 avvisi per
// ufficio restavano «senza scadenza» perché l'allegato non era riconosciuto.
check(
  'allegato Liferay del MIM riconosciuto',
  true,
  eFileDocumento('https://www.mim.gov.it/documents/9081047/10244555/Interpelli+n.+72.pdf/541c9fbd?version=1.0'),
);
check('la pagina dell’ufficio NON è un documento', false, eFileDocumento('https://www.mim.gov.it/web/bergamo/interpelli-ricerca-supplenti'));
check(
  'bacheca profonda su piattaforma = avviso',
  true,
  eAvvisoSuPiattaforma('https://nuvola.madisoft.it/bacheca-digitale/bacheca/BGIC85100N/4/IN_PUBBLICAZIONE/abc'),
);
check('login di piattaforma NON è un avviso', false, eAvvisoSuPiattaforma('https://www.portaleargo.it/argoweb/login'));
check('home di piattaforma NON è un avviso', false, eAvvisoSuPiattaforma('https://www.portaleargo.it/'));
check('sito di scuola NON è piattaforma', false, eAvvisoSuPiattaforma('https://www.zenale.edu.it/pagine/interpelli'));

/* --------------------- 2) TETTI: DEFAULT E OVERRIDE ------------------------ */
console.log('\n— 2. Tetti dichiarati, override validati —');
check('default e override coincidono a ambiente vuoto', LIMITI_SGRANATURA, limitiSgranatura({}));
check('documenti per elenco: 10 → 40', true, LIMITI_SGRANATURA.perElenco >= 40);
check('documenti per giro ≥ 800', true, LIMITI_SGRANATURA.perGiro >= 800);
check('pagine per albo ≥ 3', true, LIMITI_SGRANATURA.paginePerAlbo >= 3);
check('istituti per giro ≥ 150', true, LIMITI_SGRANATURA.istitutiPerGiro >= 150);
check('documenti per istituto ≥ 10', true, LIMITI_SGRANATURA.documentiPerIstituto >= 10);
check('pagine per elenco ≥ 3 (le pagine 2…N esistono, §26.102)', true, LIMITI_SGRANATURA.pagineElenco >= 3);
check('tempo per elenco ≥ 60 s (un portale lento non ferma il giro)', true, LIMITI_SGRANATURA.millisecondiElenco >= 60_000);
const daAmbiente = limitiSgranatura({
  [AMBIENTE_SGRANATURA.perElenco]: '120',
  [AMBIENTE_SGRANATURA.pagineElenco]: '8',
  [AMBIENTE_SGRANATURA.perGiro]: '2000',
  [AMBIENTE_SGRANATURA.millisecondiElenco]: '90000',
  [AMBIENTE_SGRANATURA.paginePerAlbo]: '5',
  [AMBIENTE_SGRANATURA.istitutiPerGiro]: '60',
  [AMBIENTE_SGRANATURA.documentiPerIstituto]: '2',
});
const attesoDaAmbiente = {
  perElenco: 120, pagineElenco: 8, perGiro: 2000, millisecondiElenco: 90_000,
  paginePerAlbo: 5, istitutiPerGiro: 60, documentiPerIstituto: 2,
};
check('override letto dall’ambiente', attesoDaAmbiente, daAmbiente);
check(
  'valore rotto → default (mai zero per sbaglio)',
  LIMITI_SGRANATURA,
  limitiSgranatura({
    [AMBIENTE_SGRANATURA.perElenco]: 'trenta',
    [AMBIENTE_SGRANATURA.perGiro]: '-5',
    [AMBIENTE_SGRANATURA.paginePerAlbo]: '',
    [AMBIENTE_SGRANATURA.istitutiPerGiro]: 'NaN',
    [AMBIENTE_SGRANATURA.documentiPerIstituto]: undefined,
  }),
);
check('zero è un valore legittimo (spegne la sgranatura)', 0, limitiSgranatura({ [AMBIENTE_SGRANATURA.perElenco]: '0' }).perElenco);
check('tetto massimo rispettato', TETTO_MASSIMO_SGRANATURA, limitiSgranatura({ [AMBIENTE_SGRANATURA.perGiro]: '999999' }).perGiro);
const msFolli = limitiSgranatura({ [AMBIENTE_SGRANATURA.millisecondiElenco]: '99999999' }).millisecondiElenco;
check('tetto massimo del TEMPO per elenco (30 min, non 5 s)', TETTO_MASSIMO_MS_ELENCO, msFolli);

/* ------------- 2-bis) LA FINESTRA ROTANTE SUGLI ELENCHI LUNGHI -------------- */
console.log('\n— 2-bis. Finestra rotante: nessuna riga resta invisibile per sempre —');
check('elenco corto: tutta la lista', { da: 0, a: 7 }, finestraElenco(7, 40));
check('elenco vuoto: nessuna finestra', { da: 0, a: 0 }, finestraElenco(0, 40));
check('prima finestra: le prime 40', { da: 0, a: 40 }, finestraElenco(200, 40, 0));
check('seconda finestra: le 40 successive', { da: 40, a: 80 }, finestraElenco(200, 40, 1));
check('la finestra non esce dalla lista', { da: 160, a: 200 }, finestraElenco(200, 40, 4));
check('completato il giro si riparte da capo', { da: 0, a: 40 }, finestraElenco(200, 40, 5));
const coperte = [0, 1, 2, 3, 4].flatMap((giro) => {
  const f = finestraElenco(200, 40, giro);
  return Array.from({ length: f.a - f.da }, (_, i) => f.da + i);
});
check('un elenco da 200 voci è coperto in 5 giri', 200, new Set(coperte).size);

/* ------------------ 3) IL GIRO NAZIONALE LEGGE TUTTI GLI HUB --------------- */
console.log('\n— 3. Nessun portale verificato resta fuori dal giro —');
const hubAttivi = fontiAttive().filter((f) => f.tipo === 'hub-istituzionale');
const dalGiroNazionale = targetWhitelist(undefined, { soliHub: true });
check('il giro nazionale porta tutti gli hub attivi', hubAttivi.length, dalGiroNazionale.length);
check(
  'nessun hub verificato è filtrato per strada',
  [],
  hubAttivi.filter((f) => !dalGiroNazionale.some((t) => t.fonte === f.id)).map((f) => f.id),
);
check('almeno 80 portali ufficiali nel giro', true, dalGiroNazionale.length >= 80);
check('budget fonti per giro ≥ 20 (era 12)', true, MAX_FONTI_PER_RUN >= 20);
check('hub per regione ≥ 10 (era 6)', true, MAX_HUB_PER_REGIONE >= 10);
const giro = fontiPerRun(['MI', 'TO', 'BA', 'NA']);
check('il run rispetta il tetto globale', true, giro.length <= MAX_FONTI_PER_RUN);
check('il run non è più un campione di dodici fonti', true, giro.length > 12);
check('il run resta deduplicato', giro.length, new Set(giro.map((f) => f.url)).size);

/* --------------------------- 4) CABLAGGIO NEL RUNNER ----------------------- */
console.log('\n— 4. Il runner usa la regola, non una copia —');
const reporter = leggi('scripts/table-reporter.ts');
check('importa il modulo di sgranatura', true, /from '\.\.\/src\/scraper\/sgranatura\.ts'/.test(reporter));
check('seleziona le voci con `vociDaSgranare`', true, /vociDaSgranare\(/.test(reporter));
check('i tetti vengono dalla politica', true, /limitiSgranatura\(process\.env\)/.test(reporter));
check('nessun tetto di 10 documenti scritto a mano', false, /MAX_APPROFONDIMENTI_TARGET = 10;/.test(reporter));
check('nessun tetto di 2 pagine scritto a mano', false, /MAX_PAGINE_SCUOLA = 2;/.test(reporter));
check('deep crawl ancora nel runner', true, /await deepCrawlScuole\(scuoleDaVisitare\);/.test(reporter));

const pkg = JSON.parse(leggi('package.json')) as { scripts: Record<string, string> };
check('script dedicato', true, 'test:sgranatura' in pkg.scripts);
check('guardia nella catena', true, (pkg.scripts.test ?? '').includes('scripts/test-sgranatura.ts'));
check('attacco di massa in un comando', true, 'ingest:massa' in pkg.scripts);
check(
  'l’attacco di massa attiva la whitelist e poi ingerisce',
  true,
  /targets:whitelist:attiva/.test(pkg.scripts['ingest:massa'] ?? '') &&
    /ingest:nazionale:apply/.test(pkg.scripts['ingest:massa'] ?? ''),
);

const workflow = leggi('.github/workflows/scraper.yml');
check('il workflow alza il budget di fonti', true, /SCRAPER_FONTI_MAX/.test(workflow));
check('il workflow lascia tempo al giro più largo', true, /timeout-minutes: (?:3[0-9]|[4-9][0-9])/.test(workflow));

console.log(
  errori === 0
    ? '\n✅ SGRANATURA: si aprono gli avvisi (mai gli elenchi) e i tetti non fermano più il Paese.'
    : `\n❌ SGRANATURA: ${errori} errore/i`,
);
process.exitCode = errori === 0 ? 0 : 1;
