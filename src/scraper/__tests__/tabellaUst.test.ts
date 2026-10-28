/**
 * TEST — TABELLE UST: lettura PROFONDA + gate semantico (`src/scraper/tabellaUst.ts`).
 *
 * Perché serve: sulle tabelle degli UST (Arezzo, Grosseto) il riconoscitore di
 * layout non trova le colonne e la pagina finiva `disqualified` con zero avvisi,
 * pur contenendo decine di interpelli veri. La guardia fissa:
 *   1. LINK della riga: il documento apribile, mai il login di Argo/Nuvola — se la
 *      fonte non ha altro si tiene ciò che ha scritto (l'identità resta);
 *   2. SCADENZA: conta solo con un'etichetta («scadenza», «entro», «chiusura»),
 *      mai la prima data anonima della riga;
 *   3. LETTURA: intestazioni e duplicati esclusi, codice, nome, classi, data;
 *   4. GATE nell'ordine dichiarato (rumore → chiuso → data → scaduto → finestra →
 *      segnale di insegnamento), con un motivo leggibile per ogni scarto;
 *   5. in catena in `npm test`, e `table-reporter` la usa davvero.
 *
 * Uso: npm run test:tabella-ust  (incluso in `npm test`)
 */
import { readFileSync } from 'node:fs';
import * as cheerio from 'cheerio';
import {
  leggiRigheTabellaUst,
  leggiTabellaUst,
  scadenzaDaRiga,
  scegliLinkRiga,
  valutaRigaUst,
  type RigaTabellaUst,
} from '../tabellaUst.ts';

let errori = 0;
function check(nome: string, atteso: unknown, ottenuto: unknown): void {
  const ok = JSON.stringify(atteso) === JSON.stringify(ottenuto);
  if (!ok) errori += 1;
  console.log(`${ok ? '✓' : '✗'} ${nome}: atteso=${JSON.stringify(atteso)} ottenuto=${JSON.stringify(ottenuto)}`);
}

const BASE = 'https://www.ustarezzo.it/avvisi/';

/** Una riga isolata, letta come la leggerebbe `leggiRigheTabellaUst`. */
function rigaDa(html: string): { url: string; testo: string } | null {
  const $ = cheerio.load(`<table><tbody><tr>${html}</tr></tbody></table>`);
  const tr = $('tr').get(0);
  return tr ? scegliLinkRiga($, tr, BASE) : null;
}

/* ------------------- 1) IL LINK DELLA RIGA: MAI UN LOGIN ----------------- */

console.log('\n— 1. Il click porta all’avviso, non a una pagina di login —');
/** Riga tipica delle tabelle UST: prima l'icona del registro, poi il PDF vero. */
const RIGA_ARGO_PDF =
  '<td><a href="https://www.portaleargo.it/argoweb">Registro</a></td>' +
  '<td><a href="/documenti/interpello-1.pdf">Avviso interpello</a></td>';
check(
  'PDF accanto all’icona del registro: vince il PDF',
  'https://www.ustarezzo.it/documenti/interpello-1.pdf',
  rigaDa(RIGA_ARGO_PDF)?.url ?? null,
);
check(
  'solo piattaforma: si tiene ciò che la fonte ha scritto',
  'https://www.portaleargo.it/argoweb',
  rigaDa('<td><a href="https://www.portaleargo.it/argoweb">Registro</a></td>')?.url ?? null,
);
check(
  'ancora interna, `javascript:` e `mailto:` non sono link',
  null,
  rigaDa('<td><a href="#elenco">Elenco</a> <a href="javascript:void(0)">Apri</a> <a href="mailto:x@y.it">Scrivi</a></td>'),
);
check('riga senza link', null, rigaDa('<td>Interpello senza documento</td>'));
check(
  'link relativo risolto sull’URL della pagina',
  'https://www.ustarezzo.it/documenti/allegato-2',
  rigaDa('<td><a href="/documenti/allegato-2">Allegato</a></td>')?.url ?? null,
);

/* -------------------- 2) LA SCADENZA HA BISOGNO DI UN’ETICHETTA ---------- */

console.log('\n— 2. Una data anonima NON è una scadenza —');
check('etichetta «Scadenza»', '2026-11-20', scadenzaDaRiga('Scadenza: 20/11/2026'));
check('«entro il» in forma testuale', '2026-11-20', scadenzaDaRiga('entro il 20 novembre 2026'));
check('«entro e non oltre»', '2026-11-20', scadenzaDaRiga('entro e non oltre il 20/11/2026'));
check('data senza etichetta: nessuna scadenza', null, scadenzaDaRiga('Data 20/11/2026'));
check('sola data ISO: nessuna scadenza', null, scadenzaDaRiga('2026-11-20'));

/* --------------------- 3) LETTURA DI UNA PAGINA UST --------------------- */

console.log('\n— 3. Celle unite, etichette di colonna, righe ripetute —');
/** Riga REALE (celle unite, icona del registro, PDF): la pagina la ripete due volte. */
const RIGA_UST = `<tr>
      <td>20/11/2026</td>
      <td>ARIC82300X</td>
      <td><span>ISTITUTO COMPRENSIVO</span><span>VASARI</span></td>
      <td>Interpello supplenza A022 scuola primaria</td>
      <td><a href="https://www.portaleargo.it/argoweb">Registro</a> <a href="/documenti/interpello-1.pdf">Avviso interpello primaria</a></td>
    </tr>`;
const PAGINA = `
<table>
  <thead>
    <tr><th>Data chiusura avviso</th><th>Codice</th><th>Istituzione scolastica</th><th>Oggetto</th><th>Documento</th></tr>
  </thead>
  <tbody>${RIGA_UST}${RIGA_UST}</tbody>
</table>`;
const righe = leggiRigheTabellaUst(cheerio.load(PAGINA), BASE);
check('una sola riga-dati (intestazione e duplicato esclusi)', 1, righe.length);
check('data dalla colonna «Data chiusura avviso»', '2026-11-20', righe[0]?.data ?? null);
check('codice meccanografico della riga', 'ARIC82300X', righe[0]?.codice ?? null);
check('nome dell’istituto dalla riga (celle unite)', 'ISTITUTO COMPRENSIVO VASARI', righe[0]?.scuola ?? null);
check('classe di concorso normalizzata', ['A-022'], righe[0]?.classi ?? []);
check(
  'link scelto: il documento, non il login',
  'https://www.ustarezzo.it/documenti/interpello-1.pdf',
  righe[0]?.link ?? null,
);
check('titolo leggibile (non «Avviso»)', true, (righe[0]?.titolo ?? '').length >= 12);

const PAGINA_SENZA_DATA =
  '<table><thead><tr><th>Codice</th><th>Oggetto</th><th>Data</th></tr></thead>' +
  '<tbody><tr><td>ARIC82300X</td><td>Interpello supplenza scuola primaria</td><td>20/11/2026</td></tr></tbody></table>';
check(
  'colonna «Data» (anonima): la scadenza non si indovina',
  null,
  leggiRigheTabellaUst(cheerio.load(PAGINA_SENZA_DATA), BASE)[0]?.data ?? null,
);

/* ------------------- 4) IL GATE, NELL’ORDINE DICHIARATO ----------------- */

console.log('\n— 4. Il gate: un motivo per ogni scarto —');
/** «Oggi» FISSO: il gate non dipende dall’orologio del computer. */
const OGGI = new Date(2026, 10, 10);
/** Riga candidabile di partenza; ogni caso ne cambia solo un campo. */
const riga = (patch: Partial<RigaTabellaUst> = {}): RigaTabellaUst => ({
  titolo: 'Interpello supplenza scuola primaria',
  testo: 'Interpello supplenza scuola primaria posto comune ARIC82300X',
  data: '2026-11-20',
  codice: 'ARIC82300X',
  scuola: 'ISTITUTO COMPRENSIVO VASARI',
  classi: [],
  link: 'https://www.ustarezzo.it/documenti/interpello-1.pdf',
  ...patch,
});
const esito = (patch: Partial<RigaTabellaUst> = {}, finestra?: number) => {
  const e = valutaRigaUst(
    riga(patch),
    finestra ? { oggi: OGGI, giorniFinestra: finestra } : { oggi: OGGI },
  );
  return [e.stato, e.motivo];
};
check('entro la finestra di 15 giorni', ['candidabile', null], esito());
check('data passata: bando scaduto', ['scartato', 'bando scaduto'], esito({ data: '2026-11-05' }));
check(
  'data oltre la finestra',
  ['scartato', 'scadenza oltre la finestra di 15 giorni'],
  esito({ data: '2026-12-01' }),
);
check('stessa data con finestra più larga', ['candidabile', null], esito({ data: '2026-12-01' }, 30));
check('scadenza non dichiarata', ['scartato', 'scadenza non dichiarata'], esito({ data: null }));
check('riga vuota', ['scartato', 'riga vuota'], esito({ testo: '   ' }));
check(
  'avviso chiuso/revocato',
  ['scartato', 'avviso chiuso/revocato'],
  esito({ testo: 'Interpello supplenza scuola primaria AVVISO CONCLUSO' }),
);
check(
  'sciopero: rumore amministrativo',
  ['scartato', 'sciopero'],
  esito({ titolo: 'Sciopero del personale docente', testo: 'Sciopero del personale docente 12 novembre' }),
);
check(
  'assemblea sindacale',
  ['scartato', 'assemblea sindacale'],
  esito({ titolo: 'Assemblea sindacale del 12 novembre', testo: 'Assemblea sindacale del 12 novembre' }),
);
check(
  'un elenco di documenti non è un interpello',
  ['scartato', 'non è un interpello di supplenza'],
  esito({ titolo: 'Elenco dei documenti pubblicati', testo: 'Elenco dei documenti pubblicati nell’albo', classi: [] }),
);
check(
  'classe di concorso riconosciuta: nessun bisogno di altre parole chiave',
  ['candidabile', null],
  esito({ testo: 'Avviso per la copertura di cattedre', titolo: 'Avviso di selezione esperti', classi: ['A-022'] }),
);


/* --------------------- 5) PAGINA → ESITI (END TO END) ------------------- */

console.log('\n— 5. Dalla pagina agli esiti, con i motivi —');
const PAGINA_TRE = `
<table>
  <thead><tr><th>Scadenza</th><th>Codice</th><th>Oggetto</th><th>Documento</th></tr></thead>
  <tbody>
    <tr>
      <td>20/11/2026</td><td>ARIC82300X</td>
      <td>Interpello supplenza scuola primaria</td>
      <td><a href="/documenti/valido.pdf">Avviso interpello</a></td>
    </tr>
    <tr>
      <td>05/11/2026</td><td>ARIC82300X</td>
      <td>Interpello supplenza scuola dell’infanzia</td>
      <td><a href="/documenti/scaduto.pdf">Avviso interpello</a></td>
    </tr>
    <tr>
      <td>30/11/2026</td><td>ARIC82300X</td>
      <td>Interpello supplenza scuola secondaria</td>
      <td><a href="/documenti/lontano.pdf">Avviso interpello</a></td>
    </tr>
  </tbody>
</table>`;
const esiti = leggiTabellaUst(cheerio.load(PAGINA_TRE), BASE, { oggi: OGGI });
check('tre righe lette', 3, esiti.length);
check(
  'stato e motivo di ogni riga',
  [
    ['candidabile', null],
    ['scartato', 'bando scaduto'],
    ['scartato', 'scadenza oltre la finestra di 15 giorni'],
  ],
  esiti.map((e) => [e.stato, e.motivo]),
);

/* ------------------- 6) PUREZZA, CABLAGGIO E CATENA --------------------- */

console.log('\n— 6. Modulo puro, usato dall’ingestione, in catena —');
const sorgente = readFileSync('src/scraper/tabellaUst.ts', 'utf8');
check('nessuna chiamata di rete nel modulo', false, /fetch\s*\(|axios|supabase/i.test(sorgente));
check(
  'l’orologio entra solo dal parametro dichiarato',
  true,
  /opts\.oggi \?\? new Date\(\)/.test(sorgente),
);
const reporter = readFileSync('scripts/table-reporter.ts', 'utf8');
check('table-reporter importa il modulo', true, /from '\.\.\/src\/scraper\/tabellaUst\.ts'/.test(reporter));
check('table-reporter legge le righe UST', true, /leggiRigheTabellaUst\(/.test(reporter));
check('table-reporter applica il gate', true, /valutaRigaUst\(/.test(reporter));
const pkg = JSON.parse(readFileSync('package.json', 'utf8')) as { scripts: Record<string, string> };
check('script dedicato', true, 'test:tabella-ust' in pkg.scripts);
check(
  'guardia nella catena',
  true,
  (pkg.scripts.test ?? '').includes('src/scraper/__tests__/tabellaUst.test.ts'),
);

console.log(
  errori === 0
    ? '\n✅ TABELLE UST: righe lette per davvero, gate stretto, motivi nei log.'
    : `\n❌ TABELLE UST: ${errori} errore/i`,
);
process.exitCode = errori === 0 ? 0 : 1;
