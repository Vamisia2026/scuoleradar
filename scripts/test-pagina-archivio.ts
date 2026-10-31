/**
 * GUARDIA — PAGINE-CONTENITORE, VOCI DI MENU E PDF DIRETTO (§26.122).
 * -----------------------------------------------------------------------------------
 * PERCHÉ ESISTE. Tre segnalazioni del cliente, un solo difetto di fondo: la pagina
 * non è l'avviso.
 *   1. «la-segreteria-comunica» e le pagine di archivio/comunicazioni sono
 *      CONTENITORI caotici: vanno scartati come avviso, oppure — se portano un
 *      solo bando in PDF — il link da pubblicare è il PDF (assoluto);
 *   2. la parola «interpello» nel MENU del sito non è un bando (Orvieto-Montecchio):
 *      senza scadenza e senza classe un contenitore non è un'opportunità;
 *   3. gli aggregatori privati (interpelloweb.it) non sono fonti: la lista è una
 *      sola (`AGGREGATORI_PRIVATI`), la usa anche il discovery, e nel registro
 *      fonti la voce è SPENTA con il motivo.
 *
 * Uso: npm run test:pagina-archivio  (incluso in `npm test`)
 */
import { readFileSync } from 'node:fs';
import {
  documentoUnicoDaContenitore,
  eEtichettaMenu,
  motivoPaginaContenitore,
} from '../src/scraper/paginaArchivio.ts';
import { AGGREGATORI_PRIVATI } from '../src/lib/dominiIstituzionali.ts';

declare const process: { exitCode?: number };

let errori = 0;
function check(nome: string, atteso: unknown, ottenuto: unknown): void {
  const ok = JSON.stringify(atteso) === JSON.stringify(ottenuto);
  if (!ok) errori += 1;
  console.log(`${ok ? '✓' : '✗'} ${nome}: atteso=${JSON.stringify(atteso)} ottenuto=${JSON.stringify(ottenuto)}`);
}
const leggi = (p: string): string => readFileSync(p, 'utf8');

/* -------------------- 1) LE VOCI DI MENU NON SONO AVVISI --------------------- */

console.log('\n— 1. Etichette di menu: «Interpelli» in testa alla pagina non è un bando —');
for (const etichetta of ['Interpelli', 'Interpelli e supplenze', 'Comunicazioni', 'La segreteria comunica', 'Archivio', 'Circolari', 'Albo pretorio']) {
  check(`menu: «${etichetta}»`, true, eEtichettaMenu(etichetta));
}
check('non-menu: un titolo di bando resta', false, eEtichettaMenu('Interpello supplenza A-24 lingua inglese'));
check('non-menu: titolo con classe e ore', false, eEtichettaMenu('Interpello A022 supplenza 6 ore'));

console.log('\n— 2. Scarto: contenitore senza scadenza e senza classe —');
check(
  '«La segreteria comunica» → scartata',
  true,
  /pagina-contenitore|voce di menu/i.test(motivoPaginaContenitore({ titolo: 'La segreteria comunica' }) ?? ''),
);
check(
  'percorso di archivio senza segnale nel titolo → scartato',
  true,
  /pagina-contenitore di archivio/i.test(
    motivoPaginaContenitore({
      titolo: 'Comunicazioni alle famiglie e al personale',
      url: 'https://www.orvietomontecchio.edu.it/la-segreteria-comunica/',
    }) ?? '',
  ),
);
check(
  'un contenitore CON scadenza è un bando: non si scarta',
  null,
  motivoPaginaContenitore({ titolo: 'La segreteria comunica', scadenza: '2026-11-10' }),
);
check(
  'un contenitore CON classe è un bando: non si scarta',
  null,
  motivoPaginaContenitore({ titolo: 'Comunicazioni', classi: ['A-24'] }),
);
check(
  'titolo con segnale di reclutamento su percorso di archivio → non si scarta',
  null,
  motivoPaginaContenitore({ titolo: 'Interpello supplenza A-24', url: 'https://www.x.edu.it/albo/' }),
);

/* ---------------------- 3) IL PDF DIRETTO, SE È UNO SOLO -------------------- */

console.log('\n— 3. Contenitore con UN bando dentro: si pubblica il PDF —');
const base = 'https://www.orvietomontecchio.edu.it/la-segreteria-comunica/';
const htmlUno = `<html><body>
  <nav><a href="/">Home</a><a href="/interpelli/">Interpelli</a></nav>
  <p>La segreteria comunica: avviso di interpello per la classe A022.</p>
  <a href="/wp-content/uploads/2026/10/bando-A022.pdf">Scarica</a>
</body></html>`;
check(
  'un solo allegato pertinente → URL assoluto del PDF',
  'https://www.orvietomontecchio.edu.it/wp-content/uploads/2026/10/bando-A022.pdf',
  documentoUnicoDaContenitore(htmlUno, base),
);

const htmlDue = `<html><body>
  <a href="/wp-content/uploads/2026/10/bando-A022.pdf">bando A022</a>
  <a href="/wp-content/uploads/2026/10/bando-A026.pdf">bando A026</a>
</body></html>`;
check('due allegati pertinenti → nessuna scelta a caso', null, documentoUnicoDaContenitore(htmlDue, base));
check('nessun allegato → nessun documento', null, documentoUnicoDaContenitore('<html><body>solo testo</body></html>', base));
check('HTML assente → nessun documento', null, documentoUnicoDaContenitore(null, base));

/* -------------------- 4) AGGREGATORI: UNA SOLA LISTA, SPENTI ----------------- */

console.log('\n— 4. Aggregatori privati: lista unica e nessuna fonte attiva —');
check('interpelloweb.it è nella blacklist dei domini', true, AGGREGATORI_PRIVATI.includes('interpelloweb.it'));
const discovery = leggi('scripts/discovery-engine.ts');
check('il discovery usa la lista unica', true, /AGGREGATORI_PRIVATI/.test(discovery));
const whitelist = leggi('src/scraper/fontiWhitelist2610.ts');
check('la whitelist fonti non ha più aggregatori attivi', false, /AGGREGATORI: TuplaAggregatore/.test(whitelist));
check('la voce spenta è dichiarata con il motivo', true, /aggregatore privato concorrente/i.test(whitelist));
check(
  'il registro la espone con `attiva: false`',
  true,
  /AGGREGATORI_ESCLUSI\.map[\s\S]{0,400}attiva: false/.test(whitelist),
);
// §26.123 — BLOCCO A MONTE: l'aggregatore concorrente non è una fonte, e non
// basta spegnere il flag: qualunque voce con host in `AGGREGATORI_PRIVATI` è
// esclusa dal registro E dal connettore, che non la scarica nemmeno.
const registroFonti = leggi('src/scraper/fonti.ts');
const aggregatori = leggi('src/scraper/fontiAggregatori.ts');
check(
  'le voci dell\'aggregatore sono registrate e SPENTE, con il motivo',
  true,
  /AGGREGATORI_SPENTI[\s\S]{0,1200}?attiva: false[\s\S]{0,1200}?note: MOTIVO_AGGREGATORE/.test(aggregatori),
);
check(
  'il registro riversa il blocco spento e non lo riaccende',
  true,
  /\.\.\.AGGREGATORI_SPENTI/.test(registroFonti),
);
check(
  'il registro filtra i domini aggregatore a monte (`fontiAttive`)',
  true,
  /fontiAttive\(\)[\s\S]{0,200}eAggregatorePrivato/.test(registroFonti),
);
const connettore = leggi('src/scraper/index.ts');
check(
  'il connettore ignora una fonte aggregatore invece di scaricarla',
  true,
  /eAggregatorePrivato\(fonte\.url\)[\s\S]{0,200}continue/.test(connettore),
);
const seed = leggi('scripts/clean-and-sync-targets.ts');
check('il seme dei target non reinserisce l’aggregatore', false, /url: 'https:\/\/interpelloweb/.test(seed));
check(
  'la pulizia elimina record e target degli aggregatori (lista unica)',
  true,
  /AGGREGATORI_PRIVATI\.map\(\(d\) => `source_url\.ilike/.test(seed) && /deleteInterpelliDaAggregatori/.test(seed),
);

/* ----------------------------- 5) CABLAGGIO --------------------------------- */

console.log('\n— 5. Le regole sono cablate nel flusso di ingestione —');
const qualita = leggi('src/scraper/qualitaOpportunita.ts');
check('la conformità chiama la guardia dei contenitori', true, /motivoPaginaContenitore\(/.test(qualita));
const crawl = leggi('src/scraper/deepCrawlScuole.ts');
check('il deep crawl usa il PDF unico del contenitore', true, /documentoUnicoDaContenitore\(/.test(crawl));
check('e lo dichiara come pagina-guscio', true, /soloAllegati: true/.test(crawl));
// §26.123 — SPOONFEEDING: il PDF unico già risolto (`allegatoUnico`) arriva al
// runner, che NON ri-scandisce i link della pagina. Nessun passaggio intermedio.
check('il deep crawl passa il PDF unico (`allegatoUnico`)', true, /allegatoUnico: documento\.url/.test(crawl));
const reporter = leggi('scripts/table-reporter.ts');
check(
  'il runner usa l’URL già risolto invece di ri-scandire i link',
  true,
  /pagina\.allegatoUnico[\s\S]{0,200}linkAllegatiInterpello/.test(reporter),
);

const pkg = JSON.parse(leggi('package.json')) as { scripts: Record<string, string> };
check('script dedicato', true, 'test:pagina-archivio' in pkg.scripts);
check('guardia nella catena', true, (pkg.scripts.test ?? '').includes('scripts/test-pagina-archivio.ts'));

console.log('\n' + '─'.repeat(70));
if (errori === 0) {
  console.log('✅ CONTENITORI: il menu non è un bando, l’archivio non è un avviso, il PDF è la fonte.');
} else {
  console.log(`❌ CONTENITORI: ${errori} controllo/i fallito/i`);
  process.exitCode = 1;
}
