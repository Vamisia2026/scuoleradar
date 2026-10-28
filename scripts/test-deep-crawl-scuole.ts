/**
 * TEST — DEEP CRAWL DEGLI ISTITUTI (`src/scraper/deepCrawlScuole.ts`,
 * `src/scraper/linkScuola.ts`).
 *
 * Perché serve: gli hub USR/USP dicono CHE una scuola assume; l'albo della
 * scuola dice TUTTO ciò che ha pubblicato. Questa guardia fissa il contratto di
 * §26.94:
 *   1. dalla home si prendono SOLO i link pertinenti (interpelli, supplenze,
 *      albo) e dello STESSO istituto;
 *   2. menu, login (Argo/Nuvola), file e siti esterni non sono pagine-elenco;
 *   3. l'ordine premia «interpelli/supplenze» prima di «albo/avvisi»;
 *   4. senza sito dichiarato dall'anagrafica non si fa NESSUNA richiesta;
 *   5. un sito che non risponde produce un motivo, non un'eccezione;
 *   6. il runner usa il modulo come FASE 2 del giro e in catena c'è la guardia;
 *   7. gli allegati PDF (§26.95) si leggono solo se pertinenti e dello stesso
 *      istituto, e un albo VERIFICATO diventa fonte permanente della coda.
 *
 * Uso: npm run test:deep-crawl  (incluso in `npm test`)
 */
import { readFileSync } from 'node:fs';
import { leggiPagineInterpelli } from '../src/scraper/deepCrawlScuole.ts';
import { linkAllegatiInterpello, linkInterpelliScuola } from '../src/scraper/linkScuola.ts';

declare const process: { exitCode?: number };

let errori = 0;
function check(nome: string, atteso: unknown, ottenuto: unknown): void {
  const ok = JSON.stringify(atteso) === JSON.stringify(ottenuto);
  if (!ok) errori += 1;
  console.log(`${ok ? '✓' : '✗'} ${nome}: atteso=${JSON.stringify(atteso)} ottenuto=${JSON.stringify(ottenuto)}`);
}

const leggi = (p: string): string => readFileSync(p, 'utf8');
const HOME = 'https://www.icmanzoni.edu.it/';

/* ------------------- 1) DALLA HOME AI LINK PERTINENTI -------------------- */

const HOME_HTML = `<html><body>
  <nav class="menu">
    <a href="/">Home</a>
    <a href="/contatti/">Contatti</a>
    <a href="/privacy/">Privacy</a>
    <a href="/albo/">Albo pretorio</a>
    <a href="/interpelli/">Interpelli e supplenze</a>
    <a href="https://www.portaleargo.it/argoweb/login">Registro Argo</a>
    <a href="https://altroistituto.edu.it/albo/">Albo di un'altra scuola</a>
    <a href="/documenti/interpello-a022.pdf">Interpello A022 (PDF)</a>
  </nav>
</body></html>`;

console.log('\n— 1. Solo link pertinenti e dello stesso istituto —');
const link = linkInterpelliScuola(HOME_HTML, HOME, 3);
check('due link pertinenti al massimo tre', 2, link.length);
check('interpelli prima di albo', '/interpelli/', new URL(link[0].url).pathname);
check('albo incluso', true, link.some((l) => new URL(l.url).pathname === '/albo/'));
check('login Argo escluso', false, link.some((l) => /argo/i.test(l.url)));
check('sito esterno escluso', false, link.some((l) => /altroistituto/.test(l.url)));
check('PDF escluso', false, link.some((l) => /\.pdf$/i.test(l.url)));
check('la home non è un elenco', false, link.some((l) => new URL(l.url).pathname === '/'));

console.log('\n— 2. La pertinenza è nel testo o nel percorso —');
const ALTRI = `<ul>
  <li><a href="/supplenze/">Supplenze</a></li>
  <li><a href="/avvisi/">Avvisi</a></li>
  <li><a href="/graduatorie/">Graduatorie</a></li>
  <li><a href="/orario/">Orario scolastico</a></li>
  <li><a href="/servizio/invio-interpelli/">Invio interpelli (servizio)</a></li>
  <li><a href="/2026/02/10/avviso-pubblico-tutor/">Avviso pubblico tutor (permalink)</a></li>
  <li><a href="/notizie/122-graduatorie-definitive-di-istituto/">Graduatorie (articolo)</a></li>
</ul>`;
const ordinati = linkInterpelliScuola(ALTRI, HOME, 5).map((l) => new URL(l.url).pathname);
check('pertinenti in ordine di punteggio', ['/supplenze/', '/avvisi/', '/graduatorie/'], ordinati);

/* ------------------- 3) VISITA CON SCARICATORE FINTO --------------------- */

console.log('\n— 3. Visita: due pagine, nessuna URL inventata —');
const richieste: string[] = [];
const scarica = async (url: string) => {
  richieste.push(url);
  if (url === HOME) return { status: 200, contentType: 'text/html', html: HOME_HTML };
  if (url.endsWith('/interpelli/')) {
    return {
      status: 200,
      contentType: 'text/html',
      html: '<li><a href="/interpelli/a022/">Interpello A022</a></li>',
    };
  }
  return { status: 200, contentType: 'text/html', html: '<li><a href="/x/">x</a></li>' };
};

async function visitaFinta(): Promise<void> {
  const visita = await leggiPagineInterpelli(
    { codice: 'MIIC8AB00C', nome: 'IC MANZONI', home: HOME },
    scarica,
    { maxPagine: 2 },
  );
  check('pagine lette', 2, visita.pagine.length);
  check('prima richiesta: la home', HOME, richieste[0]);
  check('nessuna URL costruita a mano', false, richieste.some((u) => u === `${HOME}interpelli`));
  check('nessun errore di rete', [], visita.errori);

  console.log('\n— 4. Senza sito dichiarato non si scarica nulla —');
  const prima = richieste.length;
  const nessunaRichiesta = await leggiPagineInterpelli(
    { codice: 'MIIC8AB00C', nome: 'IC MANZONI', home: null },
    scarica,
  );
  check('nessuna pagina', 0, nessunaRichiesta.pagine.length);
  check('nessuna richiesta di rete', prima, richieste.length);
  check('motivo dichiarato', true, nessunaRichiesta.errori.some((e) => /sito non dichiarato/.test(e)));

  console.log('\n— 5. Un sito rotto è un motivo, non un’eccezione —');
  const rotto = await leggiPagineInterpelli(
    { codice: 'MIIC8AB00C', nome: 'IC MANZONI', home: HOME },
    async () => {
      throw new Error('ENOTFOUND');
    },
  );
  check('nessuna pagina dal sito rotto', 0, rotto.pagine.length);
  check('errore registrato', true, rotto.errori.some((e) => /non raggiungibile/.test(e)));
}

/* ------------------- 5b) ALBO CHE ELENCA SOLO ALLEGATI PDF ---------------- */

console.log('\n— 5b. Albo di soli file: si leggono solo gli allegati pertinenti —');
const ALBO_SOLO_FILE = `<div class="allegati">
  <a href="/wp-content/uploads/2026/11/interpello-a022-supplenza.pdf">Interpello A022</a>
  <a href="/wp-content/uploads/2026/11/supplenza-a013.pdf">Supplenza A013</a>
  <a href="/wp-content/uploads/2026/11/interpello-a022-supplenza.pdf">Interpello A022 (copia)</a>
  <a href="https://altroistituto.edu.it/albo/interpello-a022.pdf">Interpello altra scuola</a>
  <a href="/documenti/informativa-privacy.pdf">Informativa privacy</a>
  <a href="/albo/">Albo pretorio</a>
</div>`;
const allegati = linkAllegatiInterpello(
  ALBO_SOLO_FILE,
  'https://www.icmanzoni.edu.it/albo/',
  2,
);
check('due allegati al massimo', 2, allegati.length);
check('primo allegato pertinente', true, /interpello-a022/.test(allegati[0].url));
check('duplicato rimosso', 2, new Set(allegati.map((a) => a.url)).size);
check('PDF di altra scuola escluso', false, allegati.some((a) => /altroistituto/.test(a.url)));
check('allegato non pertinente escluso', false, allegati.some((a) => /privacy/.test(a.url)));
check('pagina HTML non è un allegato', false, allegati.some((a) => !/\.pdf$/i.test(a.url)));

// §26.96 — l'albo di Arezzo elenca righe con il solo link al PDF su Gecodoc:
// quel file è l'avviso vero e vive fuori dall'host della scuola.
const ALBO_GECODOC = `<table><tr>
  <td>Interpello A022</td>
  <td><a href="https://aric81200p.gecodoc.it/documento/1234">Avviso interpello A022</a></td>
</tr><tr>
  <td>Interpello A013</td>
  <td><a href="https://www.portaleargo.it/argoweb/allegati/interpello-a013.pdf">Avviso interpello A013</a></td>
</tr></table>`;
const allegatiPiattaforma = linkAllegatiInterpello(
  ALBO_GECODOC,
  'https://www.icmanzoni.edu.it/albo/',
  3,
);
check('due allegati di piattaforma', 2, allegatiPiattaforma.length);
check('Gecodoc ammesso fuori dall’host della scuola', true, /gecodoc/.test(allegatiPiattaforma[0].url));
check('PDF Argo ammesso (è un documento, non un login)', true, /portaleargo/.test(allegatiPiattaforma[1].url));
check(
  'la HOME della piattaforma resta esclusa',
  0,
  linkAllegatiInterpello(
    '<a href="https://web.spaggiari.eu/home/app.wp">Registro</a>',
    'https://www.icmanzoni.edu.it/albo/',
    3,
  ).length,
);


await visitaFinta();

/* --------------------------- 6) PUREZZA E CABLAGGIO ---------------------- */

console.log('\n— 6. Il runner lo usa come fase 2, e la guardia è in catena —');
const sorgente = leggi('src/scraper/deepCrawlScuole.ts');
const codiceEseguibile = sorgente
  .split('\n')
  .filter((riga) => !riga.trim().startsWith('//') && !riga.trim().startsWith('*'))
  .join('\n');
check('nessun database', false, /supabase/i.test(sorgente));
check('nessun URL costruito a mano', false, /home\s*\+\s*['"`]/i.test(codiceEseguibile));
check('sotto 300 righe', true, sorgente.split('\n').length <= 300);

const sorgenteLink = leggi('src/scraper/linkScuola.ts');
check('regole link estratte in linkScuola.ts', true, /export function linkAllegatiInterpello/.test(sorgenteLink));
check('linkScuola sotto 250 righe', true, sorgenteLink.split('\n').length <= 250);

const reporter = leggi('scripts/table-reporter.ts');
check('deep crawl nel runner', true, /deepCrawlScuole\(/.test(reporter));
check('tetto per istituto', true, /MAX_SCUOLE_DEEP/.test(reporter));
check('chiamata dopo il giro sui target', true, /await deepCrawlScuole\(scuoleDaVisitare\);/.test(reporter));
check('allegati PDF letti nel deep crawl', true, /linkAllegatiInterpello\(/.test(reporter));
check('albo verificato promosso in coda', true, /promuoviPaginaAlbo\(/.test(reporter));
check('promozione come active_crawler', true, /active_crawler/.test(reporter));

const pkg = JSON.parse(leggi('package.json')) as { scripts: Record<string, string> };
check('script dedicato', true, 'test:deep-crawl' in pkg.scripts);
check('guardia nella catena', true, (pkg.scripts.test ?? '').includes('scripts/test-deep-crawl-scuole.ts'));

console.log(
  errori === 0
    ? '\n✅ DEEP CRAWL: dalla scuola citata al suo albo, senza URL inventate.'
    : `\n❌ DEEP CRAWL: ${errori} errore/i`,
);
process.exitCode = errori === 0 ? 0 : 1;
