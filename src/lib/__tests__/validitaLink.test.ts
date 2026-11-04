/**
 * TEST — VALIDITÀ DI UN LINK prima della pubblicazione (`src/lib/validitaLink.ts`).
 *
 * Direttiva cliente 22/10/2026: sul tabellone NON devono esistere link morti.
 * Il controllo HTTP (`scraper/verificaLinkHttp.ts`) produce un DATO — status o
 * motivo del fallimento — e questo modulo decide. La guardia fissa:
 *   1. la CLASSIFICAZIONE degli esiti, compresi i casi in cui un 4xx NON significa
 *      «pagina sparita» (401/403/405/429: il server rifiuta i client automatici);
 *   2. la DECISIONE: avviso, home ufficiale `.edu.it` (solo quando l'avviso è
 *      sparito), oppure riga fuori;
 *   3. §26.140 — il FILTRO RIGIDO ANTI-HOMEPAGE: una home dell'istituto, una
 *      sezione di albo/interpelli, un archivio o un contenitore per ambito non
 *      sono avvisi e non entrano MAI, nemmeno se rispondono `200`;
 *   4. il principio «non controllato ≠ morto»: senza esito la riga resta;
 *   5. il cablaggio in `npm test`.
 *
 * Uso: npm run test:validita-link  (incluso in `npm test`)
 */
import { readFileSync } from 'node:fs';
import { decidiPubblicazione, statoLink, urlPubblicabile } from '../validitaLink.ts';

/** Interfaccia minima per l'ambiente (come gli altri test di prodotto). */
declare const process: { exitCode?: number };

let errori = 0;
function check(nome: string, atteso: unknown, ottenuto: unknown): void {
  const ok = JSON.stringify(atteso) === JSON.stringify(ottenuto);
  if (!ok) errori += 1;
  console.log(`${ok ? '✓' : '✗'} ${nome}: atteso=${JSON.stringify(atteso)} ottenuto=${JSON.stringify(ottenuto)}`);
}

const AVVISO = 'https://www.iccarducci.edu.it/albo/avviso-1.pdf';
const HOME = 'https://iccarducci.edu.it';

/** Solo i campi che la riga di test verifica (il resto è documentazione). */
const scelta = (d: ReturnType<typeof decidiPubblicazione>) => ({
  azione: d.azione,
  stato: d.stato,
  url: d.url,
});

/* ---------------- 1) CLASSIFICAZIONE DELL'ESITO ---------------- */

console.log('— 1. Dall’esito HTTP allo stato del link —');
const stati: ReadonlyArray<readonly [string, Parameters<typeof statoLink>[0], string]> = [
  ['nessun controllo eseguito', undefined, 'non-verificabile'],
  ['200', { status: 200, errore: null }, 'ok'],
  ['301 dopo i redirect', { status: 301 }, 'ok'],
  ['404', { status: 404 }, 'assente'],
  ['410 (rimosso)', { status: 410 }, 'assente'],
  ['401: richiede credenziali', { status: 401 }, 'bloccato'],
  ['403: WAF anti-bot', { status: 403 }, 'bloccato'],
  ['429: troppe richieste', { status: 429 }, 'bloccato'],
  ['500', { status: 500 }, 'instabile'],
  ['422 non riconosciuto', { status: 422 }, 'instabile'],
  ['timeout', { status: null, errore: 'timeout' }, 'instabile'],
  ['DNS inesistente', { status: null, errore: 'dns' }, 'instabile'],
  ['certificato scaduto', { status: null, errore: 'tls' }, 'instabile'],
  ['status illeggibile', { status: Number.NaN }, 'non-verificabile'],
];
for (const [nome, esito, atteso] of stati) check(nome, atteso, statoLink(esito));


/* ---------------- 2) LA DECISIONE DI PUBBLICAZIONE ---------------- */

console.log('\n— 2. Cosa pubblicare: l’avviso, la home della scuola o niente —');
check(
  'link raggiungibile → resta l’avviso',
  { azione: 'tieni', stato: 'ok', url: AVVISO },
  scelta(decidiPubblicazione({ link: AVVISO, esito: { status: 200 } })),
);
check(
  'link non controllato → la riga resta (un controllo mancato non è una prova)',
  { azione: 'tieni', stato: 'non-verificabile', url: AVVISO },
  scelta(decidiPubblicazione({ link: AVVISO })),
);
check(
  '403 (il server rifiuta i client automatici) → la riga resta',
  { azione: 'tieni', stato: 'bloccato', url: AVVISO },
  scelta(decidiPubblicazione({ link: AVVISO, esito: { status: 403 } })),
);
check(
  '404 + home ufficiale → si pubblica la home',
  { azione: 'home-istituzionale', stato: 'assente', url: HOME },
  scelta(
    decidiPubblicazione({ link: AVVISO, esito: { status: 404 }, home: 'www.iccarducci.edu.it' }),
  ),
);
check(
  'timeout + home da recapito → si pubblica la home',
  { azione: 'home-istituzionale', stato: 'instabile', url: HOME },
  scelta(
    decidiPubblicazione({
      link: AVVISO,
      esito: { status: null, errore: 'timeout' },
      home: 'segreteria@iccarducci.edu.it',
    }),
  ),
);
check(
  '404 e nessuna home → riga fuori',
  { azione: 'scarta', stato: 'assente', url: null },
  scelta(decidiPubblicazione({ link: AVVISO, esito: { status: 404 } })),
);
check(
  'home non `.edu.it` → vale come assente, riga fuori',
  'scarta',
  decidiPubblicazione({ link: AVVISO, esito: { status: 404 }, home: 'https://gmail.com' }).azione,
);
check(
  'il link è la HOME dell’istituto → riga fuori (una home non è un bando)',
  { azione: 'scarta', stato: 'assente', url: null },
  scelta(decidiPubblicazione({ link: HOME, esito: { status: 404 }, home: 'www.iccarducci.edu.it' })),
);

/* -------- 2-bis) §26.140 — FILTRO RIGIDO ANTI-HOMEPAGE -------- */

console.log('\n— 2-bis. Home e contenitori non sono avvisi (nemmeno se rispondono 200) —');
const SCARTATA = { azione: 'scarta', url: null };
const soloEsito = (d: ReturnType<typeof decidiPubblicazione>) => ({ azione: d.azione, url: d.url });
check(
  'home dell’istituto che risponde 200 → riga fuori',
  SCARTATA,
  soloEsito(decidiPubblicazione({ link: 'https://www.polovolta.edu.it/', esito: { status: 200 } })),
);
check(
  'home senza barra finale → riga fuori',
  SCARTATA,
  soloEsito(
    decidiPubblicazione({ link: 'https://istitutocomprensivoperugia3.edu.it', esito: { status: 200 } }),
  ),
);
check(
  'sezione «Interpelli» di un istituto → riga fuori (è un elenco)',
  SCARTATA,
  soloEsito(decidiPubblicazione({ link: 'https://www.liceo.edu.it/interpelli/', esito: { status: 200 } })),
);
check(
  'contenitore per ambito (`/servizio/interpello-nazionale/`) → riga fuori',
  SCARTATA,
  soloEsito(
    decidiPubblicazione({
      link: 'https://www.omnicomprensivoorsiniamelia.edu.it/servizio/interpello-nazionale/',
      esito: { status: 200 },
    }),
  ),
);
check(
  'home non controllata → riga fuori lo stesso (la destinazione non dipende dal server)',
  SCARTATA,
  soloEsito(decidiPubblicazione({ link: 'https://www.liceo.edu.it/' })),
);
check(
  'home di un istituto con timeout → riga fuori, non «instabile ma tenuta»',
  SCARTATA,
  soloEsito(
    decidiPubblicazione({
      link: 'https://www.liceo.edu.it/',
      esito: { status: null, errore: 'timeout' },
      home: 'www.liceo.edu.it',
    }),
  ),
);
check(
  'il motivo dichiara che è una home/indice',
  true,
  /home o pagina indice/.test(
    decidiPubblicazione({ link: 'https://www.liceo.edu.it/', esito: { status: 200 } }).motivo,
  ),
);
check(
  'l’avviso SPECIFICO resta anche quando la home è nota',
  { azione: 'tieni', url: AVVISO },
  soloEsito(decidiPubblicazione({ link: AVVISO, esito: { status: 200 }, home: 'www.iccarducci.edu.it' })),
);
check(
  'un avviso con id nella query non è una home',
  { azione: 'tieni', url: 'https://www.liceo.edu.it/?p=1234' },
  soloEsito(decidiPubblicazione({ link: 'https://www.liceo.edu.it/?p=1234', esito: { status: 200 } })),
);
check('link assente → riga fuori', 'scarta', decidiPubblicazione({}).azione);
check(
  'protocollo non http(s) → riga fuori',
  'scarta',
  decidiPubblicazione({ link: 'javascript:alert(1)' }).azione,
);
check(
  'il motivo è sempre dichiarato (mai una riga sparita in silenzio)',
  true,
  decidiPubblicazione({ link: AVVISO, esito: { status: 404 } }).motivo.length > 10,
);

/* ---------------- 3) SOLO http(s) È PUBBLICABILE ---------------- */

console.log('\n— 3. Solo link http(s) —');
check('https', true, urlPubblicabile('https://iccarducci.edu.it/albo'));
check('http (maiuscolo)', true, urlPubblicabile('HTTP://ICCARDUCCI.EDU.IT/ALBO'));
check('ftp', false, urlPubblicabile('ftp://ftp.iccarducci.edu.it/a.pdf'));
check('javascript:', false, urlPubblicabile('javascript:alert(1)'));
check('schema senza host', false, urlPubblicabile('https://'));
check('vuoto', false, urlPubblicabile('   '));

/* ---------------- 4) IL CABLAGGIO ---------------- */

console.log('\n— 4. Cablaggio: script dedicato e catena di `npm test` —');
const pkg = JSON.parse(readFileSync('package.json', 'utf8')) as { scripts: Record<string, string> };
check('script dedicato', true, 'test:validita-link' in pkg.scripts);
check(
  'guardia nella catena di `npm test`',
  true,
  (pkg.scripts.test ?? '').includes('src/lib/__tests__/validitaLink.test.ts'),
);

console.log(
  errori === 0
    ? '\n✅ VALIDITÀ LINK: solo avvisi specifici (mai home o indici); se l’avviso sparisce, la home ufficiale della scuola.'
    : `\n❌ VALIDITÀ LINK: ${errori} errore/i`,
);
process.exitCode = errori === 0 ? 0 : 1;
