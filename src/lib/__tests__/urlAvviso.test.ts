/**
 * TEST — «UN AVVISO SI APRE SU UN AVVISO» (`src/lib/urlAvviso.ts`).
 *
 * La regola distingue la pagina INDICE/LANDING di un portale (la sezione
 * «Interpelli» di un USP/USR, la home di un sito, un archivio, una ricerca)
 * dall'URL SPECIFICO di un avviso (il post o il PDF). È la regola che tiene
 * fuori dalla bacheca le righe che non scadono e che aprono un elenco.
 *
 * La guardia fissa:
 *   1. i CINQUE portali aggregati segnalati dal cliente (Arezzo, Bari, Livorno,
 *      Cagliari, FVG) come indici — con i loro URL REALI;
 *   2. gli AVVISI VERI che devono restare specifici (PDF, Joomla con id,
 *      Liferay del MIM, WordPress con data): nessun falso positivo;
 *   3. home, archivi, paginazione, ricerche e filtri = elenco;
 *   4. gli input non interpretabili (vuoto, non-URL, protocollo non http):
 *      `false`, mai un'eccezione — la regola non deve svuotare la bacheca;
 *   5. la PROPRIETÀ della regola: una sola dichiarazione, importata dai due
 *      consumatori (tabellone e ingestione) e in catena in `npm test`.
 *
 * Uso: npm run test:url-avviso  (incluso in `npm test`)
 */
import { readFileSync } from 'node:fs';
import { eUrlIndicePortale } from '../urlAvviso.ts';

/** Interfaccia minima per l'ambiente (come gli altri test di prodotto). */
declare const process: { exitCode?: number };

let errori = 0;
function check(nome: string, atteso: unknown, ottenuto: unknown): void {
  const ok = JSON.stringify(atteso) === JSON.stringify(ottenuto);
  if (!ok) errori += 1;
  console.log(`${ok ? '✓' : '✗'} ${nome}: atteso=${JSON.stringify(atteso)} ottenuto=${JSON.stringify(ottenuto)}`);
}

const leggi = (p: string): string => readFileSync(p, 'utf8');

/** Tabella [nome, url, atteso]: una riga per caso, nessuna ripetizione. */
function tabella(righe: ReadonlyArray<readonly [string, string, boolean]>): void {
  for (const [nome, url, atteso] of righe) check(nome, atteso, eUrlIndicePortale(url));
}

/* ---------------- 1) I CINQUE PORTALI AGGREGATI SONO INDICI ---------------- */

console.log('— 1. Portali aggregati: la pagina che CONTIENE gli avvisi —');
tabella([
  [
    'USP Arezzo — sezione interpelli (Joomla)',
    'https://www.arezzoistruzione.it/usparezzo/index.php/interpelli',
    true,
  ],
  ['USP Arezzo — radice del sottosito', 'https://www.arezzoistruzione.it/usparezzo/', true],
  [
    'USR Puglia — reclutamento docenti (Bari)',
    'http://www.pugliausr.gov.it/index.php/docenti/reclutamento',
    true,
  ],
  ['USR Puglia — reclutamento ATA', 'http://www.pugliausr.gov.it/index.php/ata/reclutamento', true],
  [
    'USP Livorno — interpelli docenti',
    'https://www.ustli.it/usp_livorno/index.php/docenti/interpelli',
    true,
  ],
  ['USP Livorno — radice del sottosito', 'https://www.ustli.it/usp_livorno/', true],
  ['ATP Cagliari — sezione territoriale MIM', 'https://www.mim.gov.it/web/cagliari', true],
  [
    'ATP Cagliari — interpelli docenti e personale educativo',
    'https://www.mim.gov.it/web/cagliari/interpelli-docenti-e-personale-educativo',
    true,
  ],
  [
    'UST Trieste — interpelli (USR FVG)',
    'https://usrfvg.gov.it/it/home/menu/uffici/ufficio-territoriale-di-trieste/Interpelli/',
    true,
  ],
  [
    'UST Udine — interpelli (USR FVG)',
    'https://usrfvg.gov.it/it/home/menu/uffici/ufficio-territoriale-di-udine/Interpelli/',
    true,
  ],
]);

/* ------------ 2) GLI AVVISI VERI RESTANO SPECIFICI (no falsi positivi) ------------ */

console.log('\n— 2. Avvisi veri: mai scambiati per indice —');
tabella([
  [
    'USP Arezzo — tabella avvisi O.M. 27/2026 (articolo Joomla)',
    'https://www.arezzoistruzione.it/usparezzo/index.php/interpelli/2159-tabella-degli-avvisi-di-interpello-o-m-n-27-2026-art-14-comma-22',
    false,
  ],
  [
    'e-portfolio MIM — post di interpello (Liferay)',
    'https://www.mim.gov.it/web/bergamo/-/asset_publisher/abc/content/interpelli-docenti',
    false,
  ],
  [
    'WordPress — articolo con data nel percorso',
    'https://fe.istruzioneer.gov.it/2026/10/23/interpello-a042/',
    false,
  ],
  [
    'PDF del bando sul sito della scuola',
    'https://www.liceoaugustomonti.edu.it/albo/avviso-1.pdf',
    false,
  ],
  [
    'PDF in una cartella «documenti» del portale',
    'https://www.ustarezzo.it/documenti/interpello-1.pdf',
    false,
  ],
  ['avviso con id nella query (PHP)', 'https://www.liceo.edu.it/albo/a.php?id=1', false],
  ['avviso con id e altri parametri', 'https://www.liceo.edu.it/albo/a.php?anno=2026&id=1', false],
  ['Typo3: news con uid', 'https://www.usrliguria.it/?tx_news_pi1[news]=42', false],
  ['Joomla: view=article con id', 'https://www.usp.it/index.php?option=com_content&view=article&id=7', false],
  ['avviso con slug parlante', 'https://www.itibarsanti.edu.it/avvisi/interpello-informatica', false],
  ['avviso con classe e anno nello slug', 'https://www.liceovirgilio.edu.it/interpelli/a012-2026', false],
  ['avviso con data nello slug', 'https://www.icverdi.edu.it/avvisi/pubblicazione-18-10-2026', false],
  ['avviso con id numerico finale', 'https://www.liceo.edu.it/avvisi/98765', false],
]);

/* ---------------------- 3) HOME, ARCHIVI, RICERCHE, FILTRI ---------------------- */

console.log('\n— 3. Home, archivi, paginazione, ricerche: elenchi —');
tabella([
  ['radice del dominio', 'https://www.liceo.edu.it/', true],
  ['home senza `www.`', 'http://sardegna.istruzione.it/', true],
  ['cartella di indice senza query', 'https://www.usp.it/index.php', true],
  ['sezione albo', 'https://www.iccarducci.edu.it/albo', true],
  ['sezione avvisi con barra finale', 'https://www.liceo.edu.it/avvisi/', true],
  ['archivio per mese', 'https://fe.istruzioneer.gov.it/2026/10/', true],
  ['archivio per anno', 'https://fe.istruzioneer.gov.it/2026/', true],
  ['pagina 2 di una sezione', 'https://www.liceo.edu.it/avvisi/page/2/', true],
  ['categoria WordPress', 'https://fe.istruzioneer.gov.it/category/interpelli_docenti/', true],
  ['ricerca interna', 'https://www.liceo.edu.it/?s=interpello', true],
  [
    'Joomla: view=category (elenco)',
    'https://www.usp.it/index.php?option=com_content&view=category&Itemid=101',
    true,
  ],
  ['filtro per anno su una sezione', 'https://www.usp.it/avvisi/?anno=2026', true],
]);

/* ------------------------- 4) INPUT NON INTERPRETABILI ------------------------- */

console.log('\n— 4. Ciò che la regola non sa leggere non è un indice —');
tabella([
  ['stringa vuota', '', false],
  ['solo spazi', '   ', false],
  ['protocollo non http(s)', 'ftp://ftp.liceo.edu.it/avvisi', false],
  ['link `javascript:`', 'javascript:alert(1)', false],
  ['testo che non è un URL', 'vai all’avviso', false],
]);

/* -------------------- 5) UNA SOLA REGOLA, DUE CONSUMATORI -------------------- */

console.log('\n— 5. Regola unica: tabellone e ingestione la importano —');
const MODULO = 'src/lib/urlAvviso.ts';
const linkFonte = leggi('src/departments/radar/flightBoard/linkFonte.ts');
check(
  'tabellone: importa la regola condivisa',
  true,
  /from '@\/lib\/urlAvviso'/.test(linkFonte) && /eUrlIndicePortale\(/.test(linkFonte),
);
const scrape = leggi('src/scraper/index.ts');
check(
  'ingestione: non salva mai una pagina indice',
  true,
  /urlAvviso/.test(scrape) && /eUrlIndicePortale\(/.test(scrape),
);
const espansione = leggi('src/scraper/postRaccolta.ts');
check(
  'espansione dei post: scarta le voci che sono indici',
  true,
  /from '\.\.\/lib\/urlAvviso\.ts'/.test(espansione) && /eUrlIndicePortale\(p\.url\)/.test(espansione),
);
check('nessuna seconda tabella di sezioni nel tabellone', false, linkFonte.includes('PAROLE_SEZIONE'));
check('il modulo non importa nulla (regola pura e condivisibile)', false, /^import /m.test(leggi(MODULO)));

const pkg = JSON.parse(leggi('package.json')) as { scripts: Record<string, string> };
check('script dedicato', true, 'test:url-avviso' in pkg.scripts);
check(
  'guardia nella catena di `npm test`',
  true,
  (pkg.scripts.test ?? '').includes('src/lib/__tests__/urlAvviso.test.ts'),
);

console.log(
  errori === 0
    ? '\n✅ URL AVVISO: in bacheca solo avvisi specifici — nessun indice, nessun falso positivo.'
    : `\n❌ URL AVVISO: ${errori} errore/i`,
);
process.exitCode = errori === 0 ? 0 : 1;
