/**
 * TEST — PAGINAZIONE DI UN ELENCO (`urlPaginaSuccessiva`, §26.102).
 *
 * Perché serve: il 29/10/2026 il giro nazionale su 219 hub ha dichiarato 4.341
 * voci d'elenco senza scadenza, ma leggeva UNA pagina per target. Gli hub
 * WordPress mostrano 10 voci per pagina e ne tengono 200 in archivio: le pagine
 * 2…N non esistevano per il radar. La sonda sulle fonti vere l'ha misurato —
 * `https://www.uat-napoli.it/tag/interpelli-personale-docente/page/2/` dà altre
 * 12 voci apribili, la pagina 3 ne dà 12 con 1 scadenza dichiarata.
 *
 * Questa guardia fissa la regola di lettura:
 *   1. si segue solo la pagina successiva DICHIARATA dalla pagina stessa;
 *   2. `rel="next"` vale sempre, `<link rel="next">` anche;
 *   3. un'ancora «successiva / next / ›» vale solo dentro un contenitore di
 *      paginazione (fuori è un avviso che si chiama così, non una pagina);
 *   4. mai sé stessi, mai indietro (`rel="prev"`), mai schemi non-http.
 *
 * Uso: npm run test:paginazione  (incluso in `npm test`)
 */
import { readFileSync } from 'node:fs';
import { urlPaginaSuccessiva } from '../paginaSuccessiva.ts';

declare const process: { exitCode?: number };

let errori = 0;
function check(nome: string, atteso: unknown, ottenuto: unknown): void {
  const ok = JSON.stringify(atteso) === JSON.stringify(ottenuto);
  if (!ok) errori += 1;
  console.log(`${ok ? '✓' : '✗'} ${nome}: atteso=${JSON.stringify(atteso)} ottenuto=${JSON.stringify(ottenuto)}`);
}

const leggi = (p: string): string => readFileSync(p, 'utf8');
const BASE = 'https://www.uat-napoli.it/tag/interpelli-personale-docente/';

/* ------------------- 1) LE DICHIARAZIONI ESPLICITE ------------------------ */
console.log('\n— 1. rel="next": la pagina dice da sola dove si continua —');
check(
  'link rel="next" relativo → URL assoluta',
  'https://www.uat-napoli.it/tag/interpelli-personale-docente/page/2/',
  urlPaginaSuccessiva('<head><link rel="next" href="/tag/interpelli-personale-docente/page/2/"></head>', BASE),
);
check(
  'ancora rel="next"',
  'https://www.uspistruzione.fr.it/wp2/tag/interpello-nazionale/page/2/',
  urlPaginaSuccessiva('<a rel="next" class="next" href="/wp2/tag/interpello-nazionale/page/2/">Avanti</a>', 'https://www.uspistruzione.fr.it/wp2/tag/interpello-nazionale'),
);
check(
  'rel="prev" NON si segue (mai indietro)',
  undefined,
  urlPaginaSuccessiva('<a rel="prev" href="/tag/interpelli/page/0/">Indietro</a>', BASE),
);
check(
  'paginazione a query (?paged=2)',
  'https://www.uspistruzione.fr.it/wp2/tag/interpello-nazionale?paged=2',
  urlPaginaSuccessiva('<a rel="next" href="?paged=2">2</a>', 'https://www.uspistruzione.fr.it/wp2/tag/interpello-nazionale'),
);

/* ------------------- 2) LE ANCORE DI NAVIGAZIONE -------------------------- */
console.log('\n— 2. «successiva» vale solo dentro la paginazione —');
check(
  'ancora ‹› di WordPress dentro nav.pagination',
  'https://www.uat-napoli.it/tag/interpelli-personale-docente/page/2/',
  urlPaginaSuccessiva(
    '<nav class="navigation pagination"><div class="nav-links"><a class="next page-numbers" href="/tag/interpelli-personale-docente/page/2/">»</a></div></nav>',
    BASE,
  ),
);
check(
  'wp-pagenavi con testo «Pagina successiva»',
  'https://www.atavellino.it/interpelli/page/3/',
  urlPaginaSuccessiva('<div class="wp-pagenavi"><a class="page" href="/interpelli/page/2/">2</a><a href="/interpelli/page/3/">Pagina successiva »</a></div>', 'https://www.atavellino.it/interpelli/'),
);
check(
  '«successiva» FUORI dalla paginazione: non è una pagina',
  undefined,
  urlPaginaSuccessiva('<article><a href="/avvisi/graduatoria-successiva.pdf">Graduatoria successiva</a></article>', BASE),
);
check(
  'nessuna paginazione → nessuna pagina inventata',
  undefined,
  urlPaginaSuccessiva('<ul><li><a href="/avvisi/1.pdf">Interpello 1</a></li></ul>', BASE),
);

/* ------------- 2-bis) LA PAGINAZIONE È SOLO NUMERICA (RT / WP) ------------- */
console.log('\n— 2-bis. Etichette «1 2 3 … N» senza «successiva» —');
const PIEMONTE = 'https://www.istruzionepiemonte.it/avvisi-pubblici-3/';
/** Markup reale dell'hub USR Piemonte (`rt-pagination`, nessun rel=next). */
const paginazioneNumerica = (corrente: number, totale: number): string =>
  `<div class='rt-pagination-wrap' data-total-pages='${totale}' data-type='pagination'><div class="rt-pagination">` +
  `<ul class="pagination-list">${Array.from({ length: totale }, (_, i) => {
    const n = i + 1;
    return n === corrente
      ? `<li class="active"><span>${n}</span></li>`
      : `<li><a data-paged='${n}' href='${PIEMONTE}page/${n}/'>${n}</a></li>`;
  }).join('')}</ul></div></div>`;
check(
  'prima pagina: si segue l’etichetta 2 (mai la 3)',
  `${PIEMONTE}page/2/`,
  urlPaginaSuccessiva(paginazioneNumerica(1, 8), PIEMONTE),
);
check(
  'pagina 3: si segue la 4 (numero dall’URL, non dal marcatore)',
  `${PIEMONTE}page/4/`,
  urlPaginaSuccessiva(paginazioneNumerica(1, 8), `${PIEMONTE}page/3/`),
);
check(
  'ultima pagina: nessuna successiva inventata',
  undefined,
  urlPaginaSuccessiva(paginazioneNumerica(8, 8), `${PIEMONTE}page/8/`),
);
check(
  'numeri SENZA pagina corrente dichiarata → non si indovina',
  undefined,
  urlPaginaSuccessiva(
    '<div class="pagination"><a href="/avvisi-pubblici-3/page/2/">2</a><a href="/avvisi-pubblici-3/page/3/">3</a></div>',
    PIEMONTE,
  ),
);
check(
  'un «2» in un menu non è una pagina (si legge solo dentro la paginazione)',
  `${PIEMONTE}page/2/`,
  urlPaginaSuccessiva(
    `<div class="menu"><a href="/altro/">2</a></div>${paginazioneNumerica(1, 3)}`,
    PIEMONTE,
  ),
);

/* ------------------- 3) NIENTE CICLI, NIENTE SCHEMI STRANI --------------- */
console.log('\n— 3. Mai sé stessi, mai schemi non-http —');
check(
  'rel="next" verso la pagina stessa → undefined (niente ciclo)',
  undefined,
  urlPaginaSuccessiva('<link rel="next" href="/tag/interpelli-personale-docente/">', BASE),
);
check(
  'schema non navigabile (mailto) scartato',
  undefined,
  urlPaginaSuccessiva('<a rel="next" href="mailto:usp@istruzione.it">scrivi</a>', BASE),
);
check(
  'ancora interna scartata',
  undefined,
  urlPaginaSuccessiva('<a rel="next" href="#contenuto">vai</a>', BASE),
);
check('base non valida → nessuna pagina', undefined, urlPaginaSuccessiva('<a rel="next" href="/page/2/">', 'non-un-url'));

/* --------------------------- 4) CABLAGGIO -------------------------------- */
console.log('\n— 4. Il runner usa la regola, non una copia —');
const reporter = leggi('scripts/table-reporter.ts');
check('il runner chiede la pagina successiva', true, /urlPaginaSuccessiva\(html, url\)/.test(reporter));
check('la riserva del giro esiste', true, /PAGINE_ELENCO_RUN/.test(reporter));
check('tetto per target dalla politica', true, /LIMITI\.pagineElenco/.test(reporter));

const pkg = JSON.parse(leggi('package.json')) as { scripts: Record<string, string> };
check('script dedicato', true, 'test:paginazione' in pkg.scripts);
check(
  'guardia nella catena',
  true,
  (pkg.scripts.test ?? '').includes('src/lib/__tests__/paginaSuccessiva.test.ts'),
);

console.log(
  errori === 0
    ? '\n✅ PAGINAZIONE: gli elenchi si leggono oltre la prima pagina, senza inventare URL.'
    : `\n❌ PAGINAZIONE: ${errori} errore/i`,
);
process.exitCode = errori === 0 ? 0 : 1;
