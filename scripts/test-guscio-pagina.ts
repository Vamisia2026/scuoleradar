/**
 * TEST — PAGINE GUSCIO: SI ENTRA NEL FRAME (`src/scraper/guscioPagina.ts`, §26.113).
 *
 * Perché serve: molti siti di istituto non pubblicano l'albo nella pagina che
 * l'anagrafica dichiara. La home è un `frameset` (o un `<iframe>` a tutta pagina)
 * che carica il vero portale, oppure una pagina con solo un `<meta refresh>`.
 * In quei casi il deep crawl (§26.94) leggeva la home, non trovava un solo link
 * «Interpelli/Albo» e chiudeva la scuola con `linkTrovati: 0`: zero avvisi,
 * senza che nessuno sapesse che la pagina non era vuota — era un guscio.
 * Questa guardia fissa il contratto:
 *   1. si legge SOLO ciò che è scritto nella pagina (iframe/frame, poi meta);
 *   2. gli URL relativi si risolvono sulla pagina, non si inventano;
 *   3. pubblicità e social non sono «il contenuto» della scuola;
 *   4. un frame che punta a sé è un anello, non un contenuto: mai restituito;
 *   5. una pagina normale non produce nulla (nessun falso guscio);
 *   6. il modulo è PURO, e il deep crawl lo segue UNA volta sola.
 *
 * Uso: npm run test:guscio-pagina  (incluso in `npm test`)
 */
import { readFileSync } from 'node:fs';
import { urlGuscio } from '../src/scraper/guscioPagina.ts';

declare const process: { exitCode?: number };

let errori = 0;
function check(nome: string, atteso: unknown, ottenuto: unknown): void {
  const ok = JSON.stringify(atteso) === JSON.stringify(ottenuto);
  if (!ok) errori += 1;
  console.log(`${ok ? '✓' : '✗'} ${nome}: atteso=${JSON.stringify(atteso)} ottenuto=${JSON.stringify(ottenuto)}`);
}

const leggi = (p: string): string => readFileSync(p, 'utf8');
const HOME = 'https://www.icmanzoni.edu.it/';

/* ---------------------- 1) IL CONTENUTO VERO È NEL FRAME ---------------- */

console.log('\n— 1. Un iframe/frameset è un guscio: si segue il src —');
check(
  'iframe a tutta pagina',
  'https://www.portaleargo.it/argoweb/portale.jsp',
  urlGuscio('<html><body><iframe src="https://www.portaleargo.it/argoweb/portale.jsp"></iframe></body></html>', HOME),
);
check(
  'frame dei frameset',
  'https://www.icmanzoni.edu.it/portale/',
  urlGuscio('<html><frameset rows="100%"><frame src="/portale/" title="portale"></frameset></html>', HOME),
);
check(
  'attributi in ordine diverso',
  'https://www.icmanzoni.edu.it/portale/',
  urlGuscio('<iframe width="100%" height="800" src="/portale/" frameborder="0"></iframe>', HOME),
);
check(
  'apici singoli',
  'https://www.icmanzoni.edu.it/portale/',
  urlGuscio("<iframe src='/portale/'></iframe>", HOME),
);
check(
  'path relativo senza barra iniziale',
  'https://www.icmanzoni.edu.it/portale/index.php',
  urlGuscio('<iframe src="portale/index.php"></iframe>', HOME),
);
check('frame vuoto: nessun contenuto', null, urlGuscio('<iframe src=""></iframe>', HOME));

/* ------------------------- 2) META REFRESH ------------------------------ */

console.log('\n— 2. Anche un meta refresh è un guscio —');
check(
  'refresh con url',
  'https://www.icmanzoni.edu.it/portale/',
  urlGuscio('<html><head><meta http-equiv="refresh" content="0;url=/portale/"></head></html>', HOME),
);
check(
  'refresh con URL assoluto e apici singoli',
  'https://www.icasti.edu.it/albo/',
  urlGuscio("<meta http-equiv='refresh' content='0; URL=https://www.icasti.edu.it/albo/'>", HOME),
);
check(
  'meta senza refresh ignorato',
  null,
  urlGuscio('<meta name="description" content="url=/portale/">', HOME),
);
check(
  'refresh senza url: nessun contenuto',
  null,
  urlGuscio('<meta http-equiv="refresh" content="0">', HOME),
);

console.log('\n— 3. Il frame vince sul meta, e un iframe vuoto non blocca il meta —');
check(
  'iframe prima del meta',
  'https://www.icasti.edu.it/portale/',
  urlGuscio(
    '<html><head><meta http-equiv="refresh" content="0;url=/vecchio/"></head>' +
      '<body><iframe src="https://www.icasti.edu.it/portale/"></iframe></body></html>',
    HOME,
  ),
);
check(
  'iframe pubblicitario scartato, vale il meta',
  'https://www.icmanzoni.edu.it/portale/',
  urlGuscio(
    '<iframe src="https://www.youtube.com/embed/xyz"></iframe>' +
      '<meta http-equiv="refresh" content="0;url=/portale/">',
    HOME,
  ),
);


/* ------------------ 4) CONTORNI E ANELLI NON SONO CONTENUTO -------------- */

console.log('\n— 4. Pubblicità, social e self-frame non sono il contenuto —');
for (const host of ['www.youtube.com', 'www.facebook.com', 'www.instagram.com', 'www.google.com', 'doubleclick.net']) {
  check(`iframe ${host} scartato`, null, urlGuscio(`<iframe src="https://${host}/embed/x"></iframe>`, HOME));
}
check('about:blank scartato', null, urlGuscio('<iframe src="about:blank"></iframe>', HOME));
check('javascript: scartato', null, urlGuscio('<iframe src="javascript:void(0)"></iframe>', HOME));
check(
  'frame che punta alla pagina stessa: anello',
  null,
  urlGuscio('<iframe src="https://www.icmanzoni.edu.it/"></iframe>', HOME),
);
check('stessa pagina scritta in altro modo', null, urlGuscio('<iframe src="/"></iframe>', HOME));
check(
  'stessa pagina con ancora diversa',
  null,
  urlGuscio('<iframe src="https://www.icmanzoni.edu.it/#top"></iframe>', HOME),
);
check(
  'un link interno NON è un contenuto (niente falsi gusci)',
  null,
  urlGuscio('<a href="/albo/">Albo pretorio</a><a href="/interpelli/">Interpelli</a>', HOME),
);

console.log('\n— 5. Ingressi sporchi: si esce senza eccezioni —');
check('html vuoto', null, urlGuscio('', HOME));
check('html non stringa', null, urlGuscio(null as unknown as string, HOME));
check('base URL illeggibile', null, urlGuscio('<iframe src="/portale/"></iframe>', 'non-un-url'));
check('html senza guscio', null, urlGuscio('<html><body><h1>Istituto</h1></body></html>', HOME));
check(
  'ancora rimossa dall’URL del contenuto',
  'https://www.icasti.edu.it/albo/',
  urlGuscio('<iframe src="/albo/#avvisi"></iframe>', 'https://www.icasti.edu.it/'),
);

/* --------------------------- 6) PUREZZA E CABLAGGIO ---------------------- */

console.log('\n— 6. Modulo puro, e il deep crawl lo segue una volta sola —');
const sorgente = leggi('src/scraper/guscioPagina.ts');
const codiceEseguibile = sorgente
  .split('\n')
  .filter((r) => !r.trim().startsWith('//') && !r.trim().startsWith('*'))
  .join('\n');
check('nessuna rete', false, /\bfetch\(|axios/i.test(codiceEseguibile));
check('nessun node:* (gira anche nel browser)', false, /from\s+'node:/i.test(codiceEseguibile));
check('nessun database', false, /supabase/i.test(codiceEseguibile));
check('nessun URL costruito a mano', false, /baseUrl\s*\+/.test(codiceEseguibile));
check('modulo breve e leggibile', true, sorgente.split('\n').length <= 150);

const crawl = leggi('src/scraper/deepCrawlScuole.ts');
check('il deep crawl conosce il guscio', true, /urlGuscio\(/.test(crawl));
check('scatta solo quando la home non produce link', true, /candidati\.length === 0/.test(crawl));
check('un errore è dichiarato, non ignorato', true, crawl.includes('guscio ${dentro}: HTTP'));
check('sotto 300 righe', true, crawl.split('\n').length <= 300);

const pkg = JSON.parse(leggi('package.json')) as { scripts: Record<string, string> };
check('script dedicato', true, 'test:guscio-pagina' in pkg.scripts);
check('guardia nella catena', true, (pkg.scripts.test ?? '').includes('scripts/test-guscio-pagina.ts'));

console.log(
  errori === 0
    ? '\n✅ GUSCIO PAGINA: se la home è un frame, si entra nel contenuto vero.'
    : `\n❌ GUSCIO PAGINA: ${errori} errore/i`,
);
process.exitCode = errori === 0 ? 0 : 1;
