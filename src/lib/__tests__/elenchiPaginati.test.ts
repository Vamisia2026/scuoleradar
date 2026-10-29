/**
 * TEST — ITERAZIONE DELLE PAGINE 2…N DI UN ELENCO (`pagineSuccessiveElenco`, §26.103).
 *
 * Perché serve: il worker di ingestione (`src/scraper/index.ts`) leggeva UNA
 * pagina per elenco. Gli hub USR/USP su WordPress mostrano 10 voci per pagina e
 * ne tengono centinaia in archivio, quindi la prima pagina è il 5% dell'elenco.
 * Il giro nazionale del 29/10/2026 ha misurato cosa si guadagnava a seguirle:
 * 70 pagine oltre la prima, 408 voci d'elenco che nessun giro aveva mai visto.
 *
 * Questa guardia fissa il contratto dell'iteratore:
 *   1. si segue SOLO la pagina successiva DICHIARATA dalla pagina (`rel="next"`,
 *      «successiva» dentro la paginazione): nessuna URL costruita a mano;
 *   2. la catena si ferma al tetto, alla riserva di rete, a un ciclo o a una
 *      pagina che non si scarica (mai un'eccezione, mai un ciclo infinito);
 *   3. le pagine tornano in ORDINE, con la prima in testa e `extra` contato.
 *
 * Uso: npm run test:elenchi:paginati  (incluso in `npm test`)
 */
import { readFileSync } from 'node:fs';
import { PAGINE_ELENCO_DEFAULT, pagineSuccessiveElenco } from '../elenchiPaginati.ts';

declare const process: { exitCode?: number };

let errori = 0;
function check(nome: string, atteso: unknown, ottenuto: unknown): void {
  const ok = JSON.stringify(atteso) === JSON.stringify(ottenuto);
  if (!ok) errori += 1;
  console.log(`${ok ? '✓' : '✗'} ${nome}: atteso=${JSON.stringify(atteso)} ottenuto=${JSON.stringify(ottenuto)}`);
}

const BASE = 'https://www.uat-napoli.it/tag/interpelli-personale-docente/';

/** Pagina d'elenco in stile WordPress: voci + (facoltativa) paginazione. */
function pagina(voci: string[], successiva?: string): string {
  return `<!doctype html>
<html><head><title>Interpelli – UAT Napoli</title></head>
<body><main>
  <ul>${voci.map((v) => `<li><a href="${v}">${v}</a></li>`).join('')}</ul>
  ${
    successiva
      ? `<nav class="pagination"><span class="current">1</span><a class="next" rel="next" href="${successiva}">Successiva ›</a></nav>`
      : ''
  }
</main></body></html>`;
}

/** Downloader finto: registra le URL chieste e serve il dizionario. */
function rete(pagine: Record<string, string>): {
  scarica: (url: string) => Promise<string>;
  chieste: string[];
} {
  const chieste: string[] = [];
  const scarica = async (url: string): Promise<string> => {
    chieste.push(url);
    const html = pagine[url];
    if (html === undefined) throw new Error(`HTTP 404 ${url}`);
    return html;
  };
  return { scarica, chieste };
}

/* ------------------- 1) LA CATENA SEGUE LE PAGINE DICHIARATE ---------------- */
console.log('\n— 1. La catena segue le pagine che la pagina dichiara —');
const P2 = `${BASE}page/2/`;
const P3 = `${BASE}page/3/`;
{
  const { scarica, chieste } = rete({
    [P2]: pagina(['/avviso-d.pdf'], '/tag/interpelli-personale-docente/page/3/'),
    [P3]: pagina(['/avviso-e.pdf']),
  });
  const esito = await pagineSuccessiveElenco(
    { url: BASE, html: pagina(['/avviso-a.pdf'], '/tag/interpelli-personale-docente/page/2/') },
    { max: 4, scarica },
  );
  check('tre pagine in ordine', [BASE, P2, P3], esito.pagine.map((p) => p.url));
  check('pagine oltre la prima contate', 2, esito.extra);
  check("stop: l'elenco è finito (nessun rel=next in pagina 3)", 'fine', esito.fermato);
  check('due download, uno per pagina extra', [P2, P3], chieste);
}
{
  const { scarica } = rete({
    [P2]: pagina(['/avviso-b.pdf'], '/tag/interpelli-personale-docente/page/3/'),
    [P3]: pagina([]),
  });
  const esito = await pagineSuccessiveElenco(
    { url: BASE, html: pagina(['/avviso-a.pdf'], '/tag/interpelli-personale-docente/page/2/') },
    { max: 2, scarica },
  );
  check('tetto a 2 pagine: stop per tetto', 'tetto', esito.fermato);
  check('tetto a 2 pagine: una sola pagina extra', 1, esito.extra);
}

/* ------------------- 2) I TETTI: NESSUNA RETE SE NON SERVE ------------------ */
console.log('\n— 2. Tetti e riserve: nessuna rete sprecata —');
{
  const { scarica, chieste } = rete({ [P2]: pagina([]) });
  const esito = await pagineSuccessiveElenco(
    { url: BASE, html: pagina(['/avviso-a.pdf'], 'page/2/') },
    { max: 1, scarica },
  );
  check('max=1: paginazione spenta, zero download', [], chieste);
  check('max=1: resta solo la prima pagina', 0, esito.extra);
  check('max=1: stop per tetto', 'tetto', esito.fermato);
}
{
  const { scarica, chieste } = rete({ [P2]: pagina([]) });
  const esito = await pagineSuccessiveElenco(
    { url: BASE, html: pagina(['/avviso-a.pdf'], 'page/2/') },
    { max: 3, riserva: 0, scarica },
  );
  check('riserva esaurita: nessun download', [], chieste);
  check('riserva esaurita: stop per budget', 'budget', esito.fermato);
}
{
  const { scarica } = rete({
    [P2]: pagina([], '/tag/interpelli-personale-docente/page/3/'),
    [P3]: pagina([]),
  });
  const esito = await pagineSuccessiveElenco(
    { url: BASE, html: pagina(['/avviso-a.pdf'], 'page/2/') },
    { max: 3, riserva: 1, scarica },
  );
  check('riserva 1: una sola pagina extra', 1, esito.extra);
  check('riserva 1: stop per budget', 'budget', esito.fermato);
}
{
  const { scarica } = rete({});
  const esito = await pagineSuccessiveElenco(
    { url: BASE, html: pagina(['/avviso-a.pdf']) },
    { max: 3, scarica },
  );
  check('nessuna dichiarazione: stop per fine', 'fine', esito.fermato);
  check('nessuna dichiarazione: solo la prima pagina', 1, esito.pagine.length);
}
{
  const { scarica } = rete({ [P2]: pagina([]) });
  const esito = await pagineSuccessiveElenco(
    { url: BASE, html: pagina(['/avviso-a.pdf'], 'page/2/') },
    { max: Number.NaN, scarica },
  );
  check('tetto non numerico → si usa il default (la catena continua)', 2, esito.pagine.length);
}

/* --------------- 3) CICLI, ERRORI E DOCUMENTI NON HTML -------------------- */
console.log('\n— 3. Cicli, errori di rete e documenti non HTML —');
{
  const { scarica } = rete({ [P2]: pagina([], '/tag/interpelli-personale-docente/') });
  const esito = await pagineSuccessiveElenco(
    { url: BASE, html: pagina(['/avviso-a.pdf'], 'page/2/') },
    { max: 5, scarica },
  );
  check('ritorno alla prima pagina: stop per ciclo', 'ciclo', esito.fermato);
  check('ciclo: nessuna pagina doppia', 2, esito.pagine.length);
}
{
  // `page/2` e `page/2/` sono la stessa pagina: la dichiarazione è scartata a
  // monte (`urlPaginaSuccessiva` non propone mai sé stessi) e non si scarica nulla.
  const senzaSlash = `${BASE}page/2`;
  const { scarica, chieste } = rete({ [P2]: pagina([]) });
  const esito = await pagineSuccessiveElenco(
    { url: senzaSlash, html: pagina(['/avviso-b.pdf'], '/tag/interpelli-personale-docente/page/2/') },
    { max: 5, scarica },
  );
  check('slash finale: la stessa pagina non è una pagina nuova', 'fine', esito.fermato);
  check('slash finale: nessun download inutile', [], chieste);
}
{
  const { scarica } = rete({});
  const esito = await pagineSuccessiveElenco(
    { url: BASE, html: pagina(['/avviso-a.pdf'], 'page/2/') },
    { max: 3, scarica },
  );
  check('pagina 2 non raggiungibile: stop per errore', 'errore', esito.fermato);
  check('errore: la prima pagina resta letta', 1, esito.pagine.length);
}
{
  const { scarica } = rete({ [P2]: '%PDF-1.7\n1 0 obj' });
  const esito = await pagineSuccessiveElenco(
    { url: BASE, html: pagina(['/avviso-a.pdf'], 'page/2/') },
    { max: 3, scarica },
  );
  check('un PDF non è una pagina d’elenco', 'errore', esito.fermato);
  check('un PDF non entra nella catena', 1, esito.pagine.length);
}

/* ------------------------ 4) IL LOG E IL DEFAULT -------------------------- */
console.log('\n— 4. Diagnostica e default —');
{
  const righe: string[] = [];
  const { scarica } = rete({
    [P2]: pagina([], '/tag/interpelli-personale-docente/page/3/'),
    [P3]: pagina([]),
  });
  await pagineSuccessiveElenco(
    { url: BASE, html: pagina(['/avviso-a.pdf'], 'page/2/') },
    { max: 3, scarica, log: (riga) => righe.push(riga) },
  );
  check('una riga di log per pagina letta', 2, righe.length);
  check('il log dice QUALE pagina', true, righe[0].includes(P2));
}
check('PAGINE_ELENCO_DEFAULT = 3', 3, PAGINE_ELENCO_DEFAULT);

/* ------------------- 5) IL WORKER DI CODA USA L'ITERATORE ------------------ */
console.log('\n— 5. Cablaggio nel worker di ingestione (`src/scraper/index.ts`) —');
const worker = readFileSync('src/scraper/index.ts', 'utf8');
const iteratore = readFileSync('src/lib/elenchiPaginati.ts', 'utf8');
check(
  'il worker importa l’iteratore',
  true,
  /import\s*\{[^}]*pagineSuccessiveElenco[^}]*\}\s*from\s*'\.\.\/lib\/elenchiPaginati\.ts'/.test(worker),
);
check('gira sulle SEZIONI dell’hub', true, worker.includes('{ url: pagina, html: paginaHtml }'));
check('gira sugli INDICI raccolti', true, worker.includes('{ url: link, html }'));
check('tetto configurabile da ambiente', true, worker.includes('SCRAPER_PAGINE_ELENCO'));
check(
  'il tetto scende a hub ed elenchi',
  true,
  /raccogliDaHub\(fonte, stats, maxPost, maxPagine\)/.test(worker) &&
    /espandiElenchi\(\s*trovati,\s*Number\(env\.SCRAPER_ELENCHI_MAX \?\? 25\),\s*Number\(env\.SCRAPER_POST_MAX \?\? 8\),\s*pagineElenco,/.test(
      worker,
    ),
);
check(
  'il giro dichiara quante pagine extra ha letto',
  true,
  worker.includes('pagineExtra') && worker.includes('Elenchi su più pagine'),
);
check(
  'nessuna pagina d’elenco si scarica due volte per hub',
  true,
  worker.includes('pagineViste') && /import\s*\{[^}]*chiaveElenco[^}]*\}/.test(worker),
);
check(
  'nessuna URL di paginazione costruita a mano',
  false,
  /\/page\/\$\{/.test(worker) || /\?paged=/.test(worker),
);
check('la regola di lettura resta centralizzata', true, iteratore.includes('urlPaginaSuccessiva'));

console.log(
  errori === 0
    ? '\n✅ ELENCHI PAGINATI: la catena segue solo le pagine dichiarate, dentro i tetti.'
    : `\n❌ ELENCHI PAGINATI: ${errori} errore/i`,
);
process.exitCode = errori === 0 ? 0 : 1;

