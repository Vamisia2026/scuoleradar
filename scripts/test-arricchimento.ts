/**
 * GUARDIA · ARRICCHIMENTO dell'avviso (scadenza + recapiti) — `src/scraper/arricchimento.ts`
 * e `src/scraper/contattiHtml.ts` (estratto dal monolite `index.ts`, §26.90).
 *
 * Le due promesse di prodotto che qui si bloccano:
 *   · una SCADENZA si scrive solo se la pagina la dichiara («scadenza/entro il/
 *     termine»): una data nuda non basta, e se la pagina non risponde l'avviso
 *     resta senza data (GATE 2 lo considera attivo);
 *   · un RECAPITO si sceglie tra quelli REALI della fonte, scartando le caselle
 *     personali (gmail…) e usando la convenzione MIM sul codice meccanografico
 *     solo come ultima ratio.
 *
 * Nessuna rete: il downloader è iniettato (`ScaricaPagina`), le pagine sono finte.
 *
 * Uso: npm run test:arricchimento
 */
import {
  SOGLIA_EMAIL_AFFIDABILE,
  arricchisciContatti,
  arricchisciScadenze,
  cercaEmailNelleFonti,
  emailIstituzionaleDaCodice,
  type ScaricaPagina,
} from '../src/scraper/arricchimento.ts';
import {
  emailDaHtml,
  eDocumentoBinario,
  sottolinkCandidati,
  testoLeggibile,
} from '../src/scraper/contattiHtml.ts';
import type { InterpelloParsato } from '../src/scraper/parser.ts';

let errori = 0;
function check(nome: string, atteso: unknown, ottenuto: unknown): void {
  const ok = JSON.stringify(atteso) === JSON.stringify(ottenuto);
  if (!ok) errori += 1;
  console.log(`${ok ? '✓' : '✗'} ${nome}: atteso=${JSON.stringify(atteso)} ottenuto=${JSON.stringify(ottenuto)}`);
}

/* ------------------------------- Fixtures ------------------------------- */

const PAGINA = 'https://www.icferrara.edu.it/avvisi/interpello-a042/';

/** Pagina di dettaglio realistica: codice in tabella, email nel testo, allegato. */
const PAGINA_AVVISO = `<html><body>
  <h1>Interpello per la classe di concorso A042</h1>
  <table>
    <tr><td>Istituzione scolastica</td><td>I.C. «Dante Alighieri» Ferrara</td></tr>
    <tr><td>Codice meccanografico</td><td>FEIC81200Q</td></tr>
  </table>
  <p>Le domande vanno inviate a <a href="mailto:segreteria@icferrara.edu.it?subject=Interpello">segreteria@icferrara.edu.it</a>.</p>
  <p>Domande entro il 30/10/2026.</p>
  <p><a href="/wp-content/uploads/2026/10/bando-a042.pdf">Bando (PDF)</a></p>
  <p><a href="/circolari/circolare-nomina-docenti/">Circolare nomina</a></p>
  <p><a href="/docenti/formazione/">Formazione docenti</a></p>
  <p><a href="/">Home</a> · <a href="#top">Torna su</a></p>
</body></html>`;

/** Pagina che NON dichiara una scadenza: solo la data di pubblicazione. */
const PAGINA_SOLO_PUBBLICAZIONE = `<html><body><p>Avviso pubblicato il 21/10/2026.</p></body></html>`;

/** Pagina che offre solo una casella personale (mai usata come recapito). */
const PAGINA_GMAIL = `<html><body>
  <p>Per informazioni scrivere a <a href="mailto:prof.rossi@gmail.com">prof.rossi@gmail.com</a>.</p>
</body></html>`;

function scaricatore(pagine: Record<string, string>): { scarica: ScaricaPagina; chiamate: string[] } {
  const chiamate: string[] = [];
  const scarica: ScaricaPagina = async (url) => {
    chiamate.push(url);
    const html = pagine[url];
    if (html === undefined) throw new Error(`offline: ${url}`);
    return html;
  };
  return { scarica, chiamate };
}

function avviso(parziale: Partial<InterpelloParsato>): InterpelloParsato {
  return {
    title: 'Interpello A042',
    link: PAGINA,
    province: 'FE',
    classCodes: ['A-042'],
    publishedAt: '2026-10-21',
    expirationDate: null,
    hashId: 'hash-test',
    source: 'https://www.icferrara.edu.it/',
    schoolName: null,
    schoolCode: null,
    materia: null,
    contactEmail: null,
    ...parziale,
  };
}

/* ---------------------------- A. Lettura HTML ---------------------------- */

console.log('— A. Testo, email e link da una pagina HTML —');
const testo = testoLeggibile(
  '<p>Contatti: <a href="mailto:x@y.it">scrivici</a></p><p>Domande entro il 30/10/2026</p>',
);
check('i blocchi restano SEPARATI («scrivici Domande»)', true, testo.includes('scrivici Domande'));
check(
  'email dal testo (tabella) + dai link mailto:, minuscole',
  ['icferrara@istruzione.it', 'protocollo@icferrara.edu.it', 'segreteria@icferrara.edu.it'],
  emailDaHtml(
    `<table><tr><td>Email</td><td>Segreteria@ICFerrara.edu.it</td></tr></table>` +
      `<a href="mailto:icferrara@istruzione.it?subject=Interpello">scrivi</a>` +
      `<a href="mailto:protocollo&#64;icferrara.edu.it">protocollo</a>`,
  ).sort(),
);
const sottolink = sottolinkCandidati(PAGINA_AVVISO, PAGINA);
check('sottolink documentali (max 2, assoluti)', 2, sottolink.length);
check(
  'primo sottolink = allegato PDF',
  true,
  (sottolink[0] ?? '').endsWith('/wp-content/uploads/2026/10/bando-a042.pdf'),
);
check('niente pagine generiche fra i sottolink', false, sottolink.some((u) => u.endsWith('/docenti/formazione/')));
check('PDF (anche con query) è un documento binario', [true, true, false], [
  eDocumentoBinario('https://www.ic.it/bando.pdf'),
  eDocumentoBinario('https://www.ic.it/bando.PDF?dl=1'),
  eDocumentoBinario('https://www.ic.it/avvisi/123'),
]);

/* ------------------------------ B. Scadenze ------------------------------ */

console.log('\n— B. Scadenza arricchita dalla pagina ufficiale —');
const b = scaricatore({
  [PAGINA]: PAGINA_AVVISO,
  [`${PAGINA}pubblicato/`]: PAGINA_SOLO_PUBBLICAZIONE,
});
const senzaData = avviso({});
const soloPubblicazione = avviso({ link: `${PAGINA}pubblicato/` });
const irraggiungibile = avviso({ link: 'https://www.icferrara.edu.it/avvisi/sparito/' });
check(
  'arricchite: 1 su 3',
  1,
  await arricchisciScadenze([senzaData, soloPubblicazione, irraggiungibile], {
    scarica: b.scarica,
    max: 5,
  }),
);
check('data dichiarata → scritta', '2026-10-30', senzaData.expirationDate);
check('solo pubblicazione → nessuna scadenza inventata', null, soloPubblicazione.expirationDate);
check('pagina irraggiungibile → nessuna scadenza inventata', null, irraggiungibile.expirationDate);
const max1 = scaricatore({ [PAGINA]: PAGINA_AVVISO });
await arricchisciScadenze([avviso({}), avviso({}), avviso({})], { scarica: max1.scarica, max: 1 });
check('max = limite di richieste', 1, max1.chiamate.length);
const giaData = scaricatore({});
await arricchisciScadenze([avviso({ expirationDate: '2026-11-05' })], { scarica: giaData.scarica });
check('chi ha già la scadenza non fa richieste', 0, giaData.chiamate.length);

/* ------------------------------ C. Contatti ------------------------------ */

console.log('\n— C. Email di candidatura: fonti reali, mai inventata —');
check('soglia di affidabilità dichiarata', 30, SOGLIA_EMAIL_AFFIDABILE);
check('convenzione MIM dal codice valido', 'astf01000x@istruzione.it', emailIstituzionaleDaCodice('ASTF01000X'));
check('codice malformato → nessuna email', null, emailIstituzionaleDaCodice('NON-VALIDO'));

const c = scaricatore({ [PAGINA]: PAGINA_AVVISO });
const daPagina = avviso({});
check('migliorati dalle pagine: 1', 1, await arricchisciContatti([daPagina], { scarica: c.scarica }));
check('email istituzionale trovata nella pagina', 'segreteria@icferrara.edu.it', daPagina.contactEmail);
check('codice meccanografico recuperato dalla pagina', 'FEIC81200Q', daPagina.schoolCode);

const offline = scaricatore({});
const dalCodice = avviso({ schoolCode: 'ASTF01000X', link: 'https://www.ic.it/avvisi/999/' });
await arricchisciContatti([dalCodice], { scarica: offline.scarica });
check('pagina offline + codice → PEO ufficiale', 'astf01000x@istruzione.it', dalCodice.contactEmail);

const gmail = scaricatore({ [PAGINA]: PAGINA_GMAIL });
const soloPersonale = avviso({ schoolCode: 'LTIS00100A' });
await arricchisciContatti([soloPersonale], { scarica: gmail.scarica });
check('casella personale (gmail) mai usata come recapito', 'ltis00100a@istruzione.it', soloPersonale.contactEmail);

const usaCodiceOff = scaricatore({ [PAGINA]: PAGINA_GMAIL });
const disattivato = avviso({ schoolCode: 'LTIS00100A' });
await arricchisciContatti([disattivato], { scarica: usaCodiceOff.scarica, usaCodice: false });
check('usaCodice=false → nessuna email inventata', null, disattivato.contactEmail);

const forte = scaricatore({});
const giaBuona = avviso({ contactEmail: 'segreteria@icferrara.edu.it', schoolCode: 'FEIC81200Q' });
check(
  'email già solida: nessun miglioramento',
  0,
  await arricchisciContatti([giaBuona], { scarica: forte.scarica }),
);
check('email già solida: nessuna richiesta di rete', 0, forte.chiamate.length);

const esito = await cercaEmailNelleFonti(avviso({}), c.scarica);
check(
  'cercaEmailNelleFonti: email + codice',
  { email: 'segreteria@icferrara.edu.it', codice: 'FEIC81200Q' },
  esito,
);
const esitoSenzaCodice = await cercaEmailNelleFonti(avviso({}), c.scarica, false);
check(
  'usaCodice=false: email della fonte, codice solo informativo',
  { email: 'segreteria@icferrara.edu.it', codice: 'FEIC81200Q' },
  esitoSenzaCodice,
);

console.log(`\n${errori === 0 ? '✅' : '❌'} ARRICCHIMENTO: ${errori} errore/i`);
if (errori > 0) process.exitCode = 1;
