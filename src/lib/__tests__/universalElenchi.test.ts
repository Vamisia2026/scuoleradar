/**
 * TEST — LETTURA ADATTIVA DI ELENCHI E CARD (`src/lib/universalElenchi.ts`).
 *
 * Perché serve: i portali senza `<table>` non erano letti da nessuno. Questa
 * guardia fissa il contratto di §26.93:
 *   1. liste `<li>`, card, post WordPress e archivi paginati producono voci con
 *      URL apribile e titolo vero;
 *   2. `expirationDate` esiste SOLO con un'etichetta di scadenza: una data di
 *      pubblicazione non diventa mai un termine (§26.75);
 *   3. menu, link a home e ricerche non sono avvisi;
 *   4. le date italiane si leggono davvero e il 31 febbraio non esiste;
 *   5. modulo PURO (nessuna rete/dipendenza) e cablato nell'euristica universale
 *      e in `npm test`.
 *
 * Uso: npm run test:universal-elenchi  (incluso in `npm test`)
 */
import { readFileSync } from 'node:fs';
import {
  MAX_VOCI_ELENCO,
  dateNelTesto,
  vociDaElenco,
  type VoceElenco,
} from '../universalElenchi.ts';
import { parseUniversalHtml } from '../universalEuristica.ts';

declare const process: { exitCode?: number };

let errori = 0;
function check(nome: string, atteso: unknown, ottenuto: unknown): void {
  const ok = JSON.stringify(atteso) === JSON.stringify(ottenuto);
  if (!ok) errori += 1;
  console.log(`${ok ? '✓' : '✗'} ${nome}: atteso=${JSON.stringify(atteso)} ottenuto=${JSON.stringify(ottenuto)}`);
}

const leggi = (p: string): string => readFileSync(p, 'utf8');
const BASE = 'https://www.icmanzoni.edu.it/avvisi/';
const prima = (voci: VoceElenco[]): VoceElenco => voci[0];

/* --------------------- 1) LISTA WORDPRESS (ul > li > a) ------------------- */

const LISTA_WP = `<html><body><ul class="wp-block-latest-posts">
  <li>
    <a href="/2027/11/interpello-a022-matematica/">Interpello supplenza A022 matematica</a>
    <time class="entry-date">12 novembre 2027</time>
  </li>
  <li>
    <a href="/2027/11/disponibilita-ata/">Disponibilità personale ATA – collaboratore scolastico</a>
    <span class="data">13/11/2027</span>
  </li>
  <li><a href="/categoria/interpelli/">Categoria: interpelli</a></li>
</ul></body></html>`;

console.log('\n— 1. Lista WordPress: la voce è il link, la data è accanto —');
const wp = vociDaElenco(LISTA_WP, BASE);
check('due voci vere', 2, wp.length);
check('titolo dal link', 'Interpello supplenza A022 matematica', prima(wp).title);
check('URL assoluto', 'https://www.icmanzoni.edu.it/2027/11/interpello-a022-matematica/', prima(wp).directUrl);
check('data italiana → ISO', '2027-11-12', prima(wp).publicationDate);
check('nessuna scadenza inventata', undefined, prima(wp).expirationDate);
check('seconda voce', '2027-11-13', wp[1].publicationDate);

/* ------------------- 2) CARD DI AVVISI CON ETICHETTA --------------------- */

const CARD = `<html><body><div class="cards">
  <div class="card avviso">
    <h3><a href="/avvisi/interpello-sostegno-adee/">Interpello sostegno ADEE – posto intero</a></h3>
    <span class="data">Pubblicato il 14/11/2027</span>
    <p class="scadenza">Scadenza: 21/11/2027 ore 12:00</p>
  </div>
  <div class="card avviso">
    <h3><a href="/avvisi/graduatoria-provvisoria/">Graduatoria provvisoria d'istituto</a></h3>
    <span class="data">15/11/2027</span>
  </div>
</div></body></html>`;

console.log('\n— 2. Card: la scadenza esiste solo se la pagina la dichiara —');
const card = vociDaElenco(CARD, BASE);
check('due card lette', 2, card.length);
check('scadenza dichiarata', '2027-11-21', prima(card).expirationDate);
check('pubblicazione distinta', '2027-11-14', prima(card).publicationDate);

/* -------- 2-bis) SCADENZA DAL TESTO E DAI METADATI DEL LINK (§26.94) ------ */

const CON_TESTO = `<html><body><ul>
  <li>
    <a href="/avvisi/interpello-a022/">Interpello supplenza A022 – matematica</a>
    <p>Le domande vanno presentate entro le ore 12:00 del 20/11/2027.</p>
  </li>
  <li>
    <a href="/avvisi/interpello-adee/">Interpello sostegno ADEE</a>
    <p>Termine per la presentazione delle domande: 22/11/2027.</p>
  </li>
  <li>
    <a href="/documenti/interpello-a001.pdf" title="Interpello A001 – scadenza 25/11/2027">Interpello A001 – scienze</a>
  </li>
  <li>
    <a href="/avvisi/pubblicazione-graduatoria/">Pubblicazione graduatoria d'istituto</a>
    <p>Pubblicato il 10/11/2027 – prot. n. 1234 del 10/11/2027.</p>
  </li>
</ul></body></html>`;

console.log('\n— 2-bis. La scadenza si legge nel testo dell’avviso e nei metadati —');
const conTesto = vociDaElenco(CON_TESTO, BASE);
check('«entro le ore … del» è una scadenza', '2027-11-20', conTesto[0]?.expirationDate);
check('«termine per la presentazione» è una scadenza', '2027-11-22', conTesto[1]?.expirationDate);
check('scadenza dal `title` del link', '2027-11-25', conTesto[2]?.expirationDate);
check('pubblicazione + protocollo non sono scadenze', undefined, conTesto[3]?.expirationDate);
check('la pubblicazione resta distinta', '2027-11-10', conTesto[3]?.publicationDate);
check('senza etichetta: nessuna scadenza', undefined, card[1].expirationDate);

/* ------------------- 3) ARCHIVIO PAGINATO SENZA WRAPPER ------------------ */

const PAGINATO = `<html><body><main>
  <h2><a href="/interpelli/2027/interpello-1/">Interpello per supplenza classe A012</a></h2>
  <p class="meta"><span class="date">16/11/2027</span> · Scadenza: 23/11/2027</p>
  <h2><a href="/interpelli/2027/interpello-2/">Interpello per supplenza classe A026</a></h2>
  <p class="meta"><span class="date">17/11/2027</span></p>
</main><nav><ul class="menu">
  <li><a href="/didattica/">Didattica</a></li>
  <li><a href="/">Home</a></li>
  <li><a href="/cerca?q=interpello">Cerca interpelli</a></li>
</ul></nav></body></html>`;

console.log('\n— 3. Archivio: data nel contesto, menu escluso —');
const paginato = vociDaElenco(PAGINATO, BASE);
check('due voci (menu escluso)', 2, paginato.length);
check('scadenza dal contesto', '2027-11-23', prima(paginato).expirationDate);
check('seconda senza scadenza', undefined, paginato[1].expirationDate);

/* ------------------------- 4) DATE E VALIDAZIONE ------------------------- */

console.log('\n— 4. Date italiane: lette davvero, mai inventate —');
check('gg/mm/aaaa', '2027-11-12', dateNelTesto('pubblicato il 12/11/2027')[0]?.iso);
check('gg-mm-aaaa', '2027-11-12', dateNelTesto('12-11-2027')[0]?.iso);
check('aaaa-mm-gg', '2027-11-12', dateNelTesto('2027-11-12')[0]?.iso);
check('mese per esteso', '2027-11-02', dateNelTesto('2 novembre 2027')[0]?.iso);
check('31 febbraio non esiste', [], dateNelTesto('31/02/2027'));
check('mese 13 non esiste', [], dateNelTesto('12/13/2027'));
check('anno fuori scala', [], dateNelTesto('12/11/1800'));
check('senza date', [], dateNelTesto('nessuna data in questa riga'));

/* -------------------- 5) COSE CHE NON SONO AVVISI ------------------------ */

const SOLO_NAV = `<html><body><nav><ul class="menu">
  <li><a href="/scuola/">La nostra scuola</a></li>
  <li><a href="/modulistica/">Modulistica</a></li>
</ul></nav><p>Nessun avviso.</p></body></html>`;

console.log('\n— 5. Navigazione e home non sono avvisi —');
check('menu: nessuna voce', 0, vociDaElenco(SOLO_NAV, BASE).length);
check('HTML vuoto', 0, vociDaElenco('   ', BASE).length);
check('URL non valido', 0, vociDaElenco(LISTA_WP, 'non-un-url').length);
check(
  'solo link alla home: nessuna voce',
  0,
  vociDaElenco('<li><a href="/">Interpello supplenza A022</a></li>', BASE).length,
);
check(
  'categoria/tag non sono avvisi',
  0,
  vociDaElenco('<li><a href="/category/interpelli/">Interpello supplenza A022</a></li>', BASE).length,
);
check(
  'paginazione non è un avviso',
  0,
  vociDaElenco('<li><a href="/avvisi/lista?page=2">Interpello supplenza A022</a></li>', BASE).length,
);

/* ------------------- 6) CABLAGGIO NELL'EURISTICA UNIVERSALE --------------- */

console.log('\n— 6. Layout `link_list` nell’euristica e tetto delle voci —');
const universale = parseUniversalHtml(LISTA_WP, BASE);
check('layout riconosciuto', 'link_list', universale.layoutDetected);
check('voci passate all’euristica', 2, universale.items.length);
check('tetto dichiarato', 200, MAX_VOCI_ELENCO);
check('HTML malformato: non lancia', 0, vociDaElenco('<div class="card"><a href="/x', BASE).length);

console.log('\n— 7. Modulo puro, compatto e in catena —');
const sorgente = leggi('src/lib/universalElenchi.ts');
check('nessuna rete o LLM', false, /fetch\s*\(|axios|openai|anthropic|supabase|XMLHttpRequest/i.test(sorgente));
check('nessuna dipendenza esterna', false, /from '[^.]/i.test(sorgente));
check(
  'import solo dai moduli condivisi',
  true,
  (sorgente.match(/^import .*$/gm) ?? []).every((riga) => /from '\.\/(?:pdfDeterminist|scadenzaTesto|universalHtml)'/.test(riga)),
);
const righe = (p: string): number => leggi(p).split('\n').length;
check('universalElenchi sotto 250 righe', true, righe('src/lib/universalElenchi.ts') <= 250);
check('universalEuristica sotto 250 righe', true, righe('src/lib/universalEuristica.ts') <= 250);

const euristica = leggi('src/lib/universalEuristica.ts');
check('l’euristica importa il lettore', true, /from '\.\/universalElenchi'/.test(euristica));
check('l’euristica espone il layout', true, /layoutDetected: 'link_list'/.test(euristica));

const reporter = leggi('scripts/table-reporter.ts');
check('il runner usa il lettore adattivo', true, /recordsDaElencoAdattivo\(/.test(reporter));
check('nessuna scadenza inventata nel runner', true, /voce\.expirationDate \?\? null/.test(reporter));

const pkg = JSON.parse(leggi('package.json')) as { scripts: Record<string, string> };
check('script dedicato', true, 'test:universal-elenchi' in pkg.scripts);
check('guardia nella catena', true, (pkg.scripts.test ?? '').includes('src/lib/__tests__/universalElenchi.test.ts'));

console.log(
  errori === 0
    ? '\n✅ ELENCHI ADATTIVI: liste, card e archivi letti senza inventare scadenze.'
    : `\n❌ ELENCHI ADATTIVI: ${errori} errore/i`,
);
process.exitCode = errori === 0 ? 0 : 1;
