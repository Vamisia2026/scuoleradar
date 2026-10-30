/**
 * TEST — IL BANDO VIVE NEL PDF (`src/scraper/allegatiBando.ts`,
 * `src/scraper/datiBando.ts`, §26.115).
 *
 * Perché serve: due pagine diverse, un solo problema. La notizia è una pagina
 * HTML vuota che contiene solo il link al PDF (Piacenza), oppure un elenco di
 * file senza contesto (il «cimitero»). L'HTML non dice niente: data, classe,
 * ore e requisiti stanno DENTRO il documento. Questa guardia fissa il contratto:
 *   1. `ePaginaSenzaContenuto` riconosce il guscio (menu e titoli, nessuna frase)
 *      e NON accusa una pagina con contenuto vero;
 *   2. `allegatiBando` sceglie i PDF di bando (bando > avviso/interpello >
 *      domanda), del SITUO istituto, senza duplicati e mai da un aggregatore;
 *   3. `titoloDaAllegato` produce un titolo leggibile (link, altrimenti nome del
 *      file) e non restituisce mai una stringa vuota;
 *   4. `datiBando` legge ore e requisiti SOLO dalle forme dichiarate, e il
 *      titolo della riga porta classe e ore senza duplicarle;
 *   5. il deep crawl restituisce la home come pagina-guscio (`soloAllegati`) e il
 *      runner legge il documento intero, con i recapiti dal codice
 *      meccanografico (modello Liguria).
 *
 * Uso: npm run test:allegati-bando  (incluso in `npm test`)
 */
import { readFileSync } from 'node:fs';
import {
  MINIMO_TESTO_PAGINA,
  allegatiBando,
  allegatiDaGuscio,
  ePaginaSenzaContenuto,
  punteggioAllegato,
  testoPagina,
  titoloDaAllegato,
} from '../src/scraper/allegatiBando.ts';
import { eAggregatorePrivato } from '../src/lib/dominiIstituzionali.ts';
import {
  oreSettimanaliDaTesto,
  requisitiDaTesto,
  titoloBandoDaDocumento,
} from '../src/scraper/datiBando.ts';
import { emailDaCodiceMeccanografico } from '../src/lib/emailScuola.ts';

declare const process: { exitCode?: number };

let errori = 0;
function check(nome: string, atteso: unknown, ottenuto: unknown): void {
  const ok = JSON.stringify(atteso) === JSON.stringify(ottenuto);
  if (!ok) errori += 1;
  console.log(`${ok ? '✓' : '✗'} ${nome}: atteso=${JSON.stringify(atteso)} ottenuto=${JSON.stringify(ottenuto)}`);
}

const leggi = (p: string): string => readFileSync(p, 'utf8');
const HOME = 'https://www.icmanzoni.edu.it/';
const ALBO = 'https://www.icmanzoni.edu.it/albo/';

/* ---------------------- 1) GUSCIO VUOTO vs CONTENUTO -------------------- */

console.log('\n— 1. Il guscio si riconosce dal testo, non dal numero di link —');
const GUSCIO = `<html><head><style>body{color:#333}</style></head><body>
  <nav><a href="/">Home</a><a href="/albo/">Albo</a><a href="/contatti/">Contatti</a></nav>
  <h1>Interpelli</h1><p>Allegati</p>
  <script>console.log('menu');</script>
</body></html>`;
check('menu e titoli, nessuna frase → guscio', true, ePaginaSenzaContenuto(GUSCIO));
const FRASE =
  'L’istituto comprensivo Manzoni pubblica l’avviso di interpello per la copertura della classe di concorso A022 con contratto a tempo determinato fino al termine delle attività didattiche e invita i docenti interessati a presentare domanda.';
const PAGINA_PIENA = `<html><body><nav><a href="/">Home</a></nav><p>${FRASE}</p><p>${FRASE}</p></body></html>`;
check('pagina con contenuto vero → non è un guscio', false, ePaginaSenzaContenuto(PAGINA_PIENA));
check('il testo leggibile ignora script e stile', false, /color|console/.test(testoPagina(GUSCIO)));
check('entità HTML risolte', 'Albo & avvisi', testoPagina('<p>Albo&nbsp;&amp;&nbsp;avvisi</p>'));
check('soglia dichiarata', true, MINIMO_TESTO_PAGINA >= 200);
check('html vuoto → guscio', true, ePaginaSenzaContenuto(''));

/* --------------------- 2) QUALI FILE SONO BANDI ------------------------- */

console.log('\n— 2. Si leggono i PDF di bando, mai quelli di contorno —');
const ALLEGATI = `<div class="allegati">
  <a href="/wp-content/uploads/2026/11/avviso-a013.pdf">Avviso A013</a>
  <a href="/wp-content/uploads/2026/11/bando-a022-supplenza.pdf">Bando A022</a>
  <a href="/wp-content/uploads/2026/11/interpello-a022.pdf">Interpello A022</a>
  <a href="/documenti/informativa-privacy.pdf">Informativa privacy</a>
  <a href="https://altroistituto.edu.it/albo/bando-a022.pdf">Bando di un’altra scuola</a>
  <a href="/albo/">Albo pretorio</a>
</div>`;
const due = allegatiBando(ALLEGATI, ALBO, 2);
check('massimo due allegati', 2, due.length);
check('il bando vince sull’avviso', true, /bando-a022-supplenza/.test(due[0].url));
check('secondo allegato: l’avviso', true, /avviso-a013/.test(due[1].url));
check('niente privacy', false, due.some((a) => /privacy/.test(a.url)));
check('niente altra scuola', false, due.some((a) => /altroistituto/.test(a.url)));
check('niente pagine HTML', false, due.some((a) => !/\.pdf$/i.test(a.url)));
check(
  'tre allegati, in ordine di pertinenza',
  ['bando-a022-supplenza', 'avviso-a013', 'interpello-a022'],
  allegatiBando(ALLEGATI, ALBO, 3).map((a) => (a.url.split('/').pop() ?? '').replace('.pdf', '')),
);
check('pertinenza: bando > allegato', true, punteggioAllegato('Bando A022', '/x/bando.pdf') > punteggioAllegato('allegato', '/x/a.pdf'));
check('aggregatore privato riconosciuto', true, eAggregatorePrivato('https://www.scuolainterpelli.it/wp-content/uploads/bando-a022.pdf'));
// La regola degli aggregatori è DENTRO la scelta: il modulo la applica a ogni
// candidato (`linkScuola` esclude già gli host terzi; questa è la seconda rete).
const sorgenteAllegati = leggi('src/scraper/allegatiBando.ts');
check('la scelta applica il divieto aggregatori', true, /eAggregatorePrivato\(/.test(sorgenteAllegati));

console.log('\n— 3. Guscio con allegato: la domanda del deep crawl —');
check('guscio con bando → allegati', 2, allegatiDaGuscio(`${GUSCIO}${ALLEGATI}`, HOME, 2).length);
check('pagina piena → nessun allegato da guscio', 0, allegatiDaGuscio(PAGINA_PIENA, HOME, 2).length);
check('guscio senza allegati → niente', 0, allegatiDaGuscio(GUSCIO, HOME, 2).length);

/* ------------------------ 4) TITOLO DELL'ALLEGATO ----------------------- */

console.log('\n— 4. Il titolo dell’allegato è leggibile, mai vuoto —');
check('testo del link usato quando dice qualcosa', 'Bando A022 supplenza', titoloDaAllegato('Bando A022 supplenza', '/x/bando-a022.pdf'));
check(
  'link «Scarica» → nome del file ripulito',
  'Bando A022 supplenza',
  titoloDaAllegato('Scarica', 'https://www.icmanzoni.edu.it/wp-content/uploads/bando_A022_supplenza.pdf'),
);
check('nome con %20 decodificato', 'Avviso A013', titoloDaAllegato('', 'https://www.icmanzoni.edu.it/x/Avviso%20A013.pdf'));
check('nessun titolo → «Allegato»', 'Allegato', titoloDaAllegato('', ''));
check('prima lettera maiuscola', 'Interpello a022', titoloDaAllegato('', '/x/interpello-a022.pdf'));

/* ------------------- 5) DATI DEL BANDO: ORE E REQUISITI ---------------- */

console.log('\n— 5. Ore e requisiti SOLO dalle forme dichiarate —');
check('«18 ore settimanali»', 18, oreSettimanaliDaTesto('Supplenza A022: 18 ore settimanali fino al 30/06/2027'));
check('«orario settimanale di 12 ore»', 12, oreSettimanaliDaTesto('Orario settimanale di 12 ore su cinque giorni'));
check('«n. 6 ore» con etichetta', 6, oreSettimanaliDaTesto('Attribuzione di n. 6 ore settimanali di insegnamento'));
check('un corso di 30 ore NON è un orario', null, oreSettimanaliDaTesto('Corso di formazione della durata complessiva di 30 ore'));
check('orario implausibile (45) scartato', null, oreSettimanaliDaTesto('45 ore settimanali'));
check('testo assente', null, oreSettimanaliDaTesto(''));

const DOCUMENTO = `AVVISO DI SELEZIONE PER LA COPERTURA DI N. 1 POSTO CLASSE A022.
Requisiti: possesso del titolo di studio di laurea magistrale in Matematica.
È richiesta l'abilitazione all'insegnamento per la classe di concorso A022.
Si valuta esperienza documentata di almeno 24 mesi nella scuola secondaria.`;
const requisiti = requisitiDaTesto(DOCUMENTO);
check('tre requisiti al massimo', 3, requisiti.length);
check('il primo requisito è il titolo di studio', true, /titolo di studio/.test(requisiti[0] ?? ''));
check('nessun duplicato', requisiti.length, new Set(requisiti.map((r) => r.toLowerCase())).size);
check('documento senza requisiti', 0, requisitiDaTesto('Avviso di interpello A022, presentare domanda entro il 12/11/2026.').length);

console.log('\n— 6. Il titolo della riga: etichetta, classe e ore —');
check(
  'titolo che dichiara già il reclutamento non si tocca',
  'bando a022 supplenza',
  titoloBandoDaDocumento({ fallback: 'bando a022 supplenza' }),
);
check(
  'titolo neutro → etichetta «Interpello»',
  'Interpello avviso a013',
  titoloBandoDaDocumento({ fallback: 'avviso a013' }),
);
check(
  'classe aggiunta dal documento',
  'avviso di supplenza — A013',
  titoloBandoDaDocumento({ fallback: 'avviso di supplenza', classi: ['A013'] }),
);
check(
  'classe già nel titolo (anche minuscola): nessun doppione',
  'Interpello avviso a013',
  titoloBandoDaDocumento({ fallback: 'avviso a013', classi: ['A013'] }),
);
check(
  'classe già nel titolo: nessun doppione',
  'supplenza A022 — 18 ore',
  titoloBandoDaDocumento({ fallback: 'supplenza A022', classi: ['A022'], ore: 18 }),
);
check(
  'intestazione del documento vince sul nome del file',
  // L'intestazione non dichiara un reclutamento («SELEZIONE» non basta al gate
  // della riga): l'etichetta «Interpello» è quella che fa passare il record.
  'Interpello AVVISO DI SELEZIONE PER LA COPERTURA DI N. 1 POSTO CLASSE A022',
  titoloBandoDaDocumento({
    testo: `${DOCUMENTO}\nProt. 1234`,
    fallback: 'bando-1.pdf',
    classi: [],
  }),
);
check('mai vuoto', 'Interpello', titoloBandoDaDocumento({}));
check('lunghezza sotto controllo', true, titoloBandoDaDocumento({ fallback: 'x'.repeat(400) }).length <= 180);

/* ------------- 7) CABLAGGIO: DEEP CRAWL, RUNNER, RECAPITI -------------- */

console.log('\n— 7. Il guscio entra nel deep crawl e il PDF diventa la riga —');
const crawl = leggi('src/scraper/deepCrawlScuole.ts');
check('il deep crawl chiede gli allegati del guscio', true, /allegatiDaGuscio\(/.test(crawl));
check('la home-guscio è dichiarata (`soloAllegati`)', true, /soloAllegati: true/.test(crawl));
check('gli allegati sono contati, non silenziosi', true, /allegatiTrovati/.test(crawl));
check('deep crawl sotto 300 righe', true, crawl.split('\n').length <= 300);

const reporter = leggi('scripts/table-reporter.ts');
check('il runner rispetta la pagina-guscio', true, /pagina\.soloAllegati/.test(reporter));
check('il PDF si legge INTERO (non solo la data)', true, /leggiAvvisoCompleto\(allegato\.url/.test(reporter));
check('il titolo della riga viene dal documento', true, /titoloBandoDaDocumento\(/.test(reporter));
check('la classe del PDF diventa quella della riga', true, /classCodes: documento\.classi/.test(reporter));

console.log('\n— 8. Recapiti dal codice meccanografico (modello Liguria) —');
check(
  'PEO e PEC della convenzione MIM',
  { peo: 'astf01000x@istruzione.it', pec: 'astf01000x@pec.istruzione.it' },
  emailDaCodiceMeccanografico('ASTF01000X'),
);
check('codice non valido → nessun indirizzo', null, emailDaCodiceMeccanografico('ABC'));
check('il runner scrive il recapito nella riga', true, /contact_email: contactEmail/.test(reporter));
check('il runner scrive la PEC', true, /school_pec: schoolPec/.test(reporter));
check('lo stato dell’anagrafica è dichiarato', true, /stato_arricchimento: statoArricchimento\(/.test(reporter));

/* ---------------------- 9) PUREZZA, DIMENSIONE, CATENA ----------------- */

console.log('\n— 9. Moduli puri, brevi, e in catena —');
for (const percorso of ['src/scraper/allegatiBando.ts', 'src/scraper/datiBando.ts']) {
  const sorgente = leggi(percorso);
  const codice = sorgente
    .split('\n')
    .filter((riga) => !riga.trim().startsWith('//') && !riga.trim().startsWith('*'))
    .join('\n');
  const nome = percorso.split('/').pop();
  check(`${nome}: nessuna rete`, false, /\bfetch\(|axios/i.test(codice));
  check(`${nome}: nessun node:* (gira anche nel browser)`, false, /from\s+'node:/i.test(codice));
  check(`${nome}: nessun database`, false, /supabase/i.test(codice));
  check(`${nome}: sotto 250 righe`, true, sorgente.split('\n').length <= 250);
}

const pkg = JSON.parse(leggi('package.json')) as { scripts: Record<string, string> };
check('script dedicato', true, 'test:allegati-bando' in pkg.scripts);
check('guardia nella catena', true, (pkg.scripts.test ?? '').includes('scripts/test-allegati-bando.ts'));

console.log(
  errori === 0
    ? '\n✅ ALLEGATI DI BANDO: il guscio porta al PDF, e il PDF porta i dati.'
    : `\n❌ ALLEGATI DI BANDO: ${errori} errore/i`,
);
process.exitCode = errori === 0 ? 0 : 1;
