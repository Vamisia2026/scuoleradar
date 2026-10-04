/**
 * Test — «VISUAL EDITOR» (click-to-edit, solo sviluppo): regole, riscrittura e scansione.
 *
 * Guardia del sistema click-to-edit, che vive accanto all'«Editor Testi Rapido» ma con UX e
 * storage propri (`sr_visual_editor:*`, una chiave per ROTTA):
 *
 *  1. REGOLE: un blocco è un testo CONTIGUO — `<p>Vedi <strong>qui</strong> ora</p>` resta UNA
 *     casella, `<div><p>a</p><p>b</p></div>` sono DUE — e restano fuori i sottoalberi tecnici, i
 *     pannelli DEV e il monitor «Radar Live» (`contenteditable="false"`);
 *  2. RISCRITTURA: `scriviBlocco` cambia il valore dei nodi di testo senza aggiungere o rimuovere
 *     nodi (React non trova il DOM «sorpreso»), conserva gli spazi di bordo del JSX e non scrive
 *     quando il testo non cambia (così l'osservatore delle mutazioni non entra in ciclo);
 *  3. SCANSIONE: la chiave nasce dal testo di DEFAULT (sopravvive a un re-render), due testi
 *     identici restano occorrenze distinte, gli override salvati si riflettono al reload e la
 *     modifica tolta rimette la copy del codice.
 *
 * Lo STORE per rotta (persistenza, letture tolleranti, azzeramento, esportazione) e il CABLAGGIO
 * dei file (App, provider, hook, pannello) hanno la loro guardia dedicata:
 * `scripts/test-visual-editor-store.ts`.
 *
 * Uso: npm run test:visual-editor (primo script della catena; incluso in `npm test`)
 */
import process from 'node:process';
import { chiaveTestoDom } from '../src/lib/testiDomRegole.ts';
import {
  antenatoBlocco,
  contiguo,
  eBlocco,
  raccogliBlocchi,
  scriviBlocco,
  testoContiguo,
  type BloccoTrovato,
  type NodoDom,
} from '../src/lib/visualEditorRegole.ts';
import {
  nuovaMemoriaTocchi,
  scansionaVista,
  stessiBlocchi,
  suUnaRiga,
} from '../src/lib/visualEditorScansione.ts';
import { con, el, type FintoElemento } from './lib/dom-finto.ts';

let errori = 0;
function check(nome: string, atteso: unknown, ottenuto: unknown): void {
  const ok = JSON.stringify(atteso) === JSON.stringify(ottenuto);
  if (!ok) errori += 1;
  console.log(`${ok ? '✓' : '✗'} ${nome}: atteso=${JSON.stringify(atteso)} ottenuto=${JSON.stringify(ottenuto)}`);
}

/** Testo dell'n-esimo nodo di un elemento finto. */
const testoDi = (nodo: FintoElemento, indice = 0): string => String(nodo.childNodes[indice].nodeValue);

/** Vista di prova della scansione (i cast al DOM minimo si fanno solo qui). */
const come = (nodo: FintoElemento): NodoDom => nodo as unknown as NodoDom;

interface PaginaBlocchi {
  radice: FintoElemento;
  forte: FintoElemento;
  paragrafo: FintoElemento;
  dueParagrafi: FintoElemento;
  radar: FintoElemento;
}

/**
 * Pagina di prova: contiguità (`<strong>` dentro un paragrafo), blocchi annidati (div con due
 * paragrafi) e le tre esclusioni che contano — il monitor «Radar Live»
 * (`contenteditable="false"`), il pannello di questo editor (`data-sr-visual-editor`) e la DEV
 * Toolbar (`data-sr-dev-toolbar`).
 */
function paginaBlocchi(): PaginaBlocchi {
  const forte = el('strong', 'Vedi');
  const paragrafo = el('p', forte, ' qui ora');
  const dueParagrafi = el('div', el('p', 'Primo blocco'), el('p', 'Secondo blocco'));
  const radar = con('div', { contenteditable: 'false' }, el('p', 'Riga del Radar Live'));
  const radice = el(
    'main',
    el('section', el('h1', 'Trova la tua cattedra'), paragrafo, dueParagrafi),
    radar,
    con('aside', { 'data-sr-visual-editor': '' }, el('p', 'Scrivi qui il testo')),
    con('section', { 'data-sr-dev-toolbar': '' }, el('p', 'Editor Testi Rapido')),
  );
  return { radice, forte, paragrafo, dueParagrafi, radar };
}

console.log('— 1. Regole: contiguità, blocchi, esclusioni —');
const pagina1 = paginaBlocchi();
const trovati: BloccoTrovato[] = [];
raccogliBlocchi(come(pagina1.radice), trovati);
check(
  'una casella per blocco contiguo, in ordine di lettura',
  ['Trova la tua cattedra', 'Vedi qui ora', 'Primo blocco', 'Secondo blocco'],
  trovati.map((blocco) => blocco.testo),
);
check('tag dei blocchi', ['H1', 'P', 'P', 'P'], trovati.map((blocco) => blocco.tag));
check(
  'etichetta umana del punto della pagina',
  ['sezione · Titolo', 'sezione · Paragrafo', 'sezione · Paragrafo', 'sezione · Paragrafo'],
  trovati.map((blocco) => blocco.dove),
);
check(
  'fuori il monitor Radar Live, il pannello dell’editor e la DEV Toolbar',
  [false, false, false],
  ['Riga del Radar Live', 'Scrivi qui il testo', 'Editor Testi Rapido'].map((testo) =>
    trovati.some((blocco) => blocco.testo === testo),
  ),
);
check(
  'contiguità: il paragrafo con il grassetto è UN blocco, non tre',
  ['Vedi qui ora', true, false, false, true],
  [
    testoContiguo(come(pagina1.paragrafo)),
    contiguo(come(pagina1.forte)),
    eBlocco(come(pagina1.forte)),
    contiguo(come(pagina1.dueParagrafi)),
    eBlocco(come(pagina1.paragrafo)),
  ],
);

console.log('— 2. Riscrittura: nodi stabili, spazi di bordo, nessun ciclo —');
const scrittura = paginaBlocchi();
const forteScritto = scrittura.paragrafo.childNodes[0] as FintoElemento;
scriviBlocco(come(scrittura.paragrafo), 'Guarda qui adesso');
check(
  'testo riscritto senza toccare la struttura (React non trova il DOM «sorpreso»)',
  ['Guarda qui adesso', 2, 1, 'Guarda qui adesso', ''],
  [
    testoContiguo(come(scrittura.paragrafo)),
    scrittura.paragrafo.childNodes.length,
    forteScritto.childNodes.length,
    testoDi(forteScritto),
    testoDi(scrittura.paragrafo, 1),
  ],
);
scriviBlocco(come(scrittura.paragrafo), '  Guarda   qui adesso  '); // identico a meno degli spazi
check(
  'testo identico ⇒ nessuna scrittura inutile (i nodi restano come sono)',
  ['Guarda qui adesso', ''],
  [testoDi(forteScritto), testoDi(scrittura.paragrafo, 1)],
);
scriviBlocco(come(scrittura.paragrafo), 'Vedi qui ora');
check(
  'ripristino: si torna al testo del codice, nodi sempre gli stessi',
  ['Vedi qui ora', 2],
  [testoContiguo(come(scrittura.paragrafo)), scrittura.paragrafo.childNodes.length],
);
const spaziato = el('p', '  Ciao mondo  ');
scriviBlocco(come(spaziato), 'Ciao mondo'); // identico a meno degli spazi
check('spazi di bordo del JSX conservati (nessuna riscrittura)', '  Ciao mondo  ', testoDi(spaziato));
scriviBlocco(come(spaziato), 'Ciao mondo nuovo');
check('riscrittura con spazi di bordo intatti', '  Ciao mondo nuovo  ', testoDi(spaziato));

console.log('— 3. Scansione: chiavi stabili, occorrenze, override riflessi —');
const pagina2 = paginaBlocchi();
const primaScansione = scansionaVista(come(pagina2.radice), {}, nuovaMemoriaTocchi());
check(
  'elenco per il pannello: testo a schermo = default, nessuna modifica',
  [['Trova la tua cattedra', false], ['Vedi qui ora', false]],
  [
    [primaScansione.blocchi[0].testo, primaScansione.blocchi[0].modificato],
    [primaScansione.blocchi[1].testo, primaScansione.blocchi[1].modificato],
  ],
);
const chiave = primaScansione.blocchi[1].chiave;
check('chiave del blocco: tag + impronta + occorrenza', chiaveTestoDom('P', 'Vedi qui ora', 0), chiave);
check(
  'impronta a prova di spazi inutili: stessa chiave per lo stesso testo',
  chiave,
  chiaveTestoDom('P', '  Vedi   qui ora  ', 0),
);
const doppia = el('main', el('section', el('p', 'Stessa frase'), el('p', 'Stessa frase')));
const occorrenze = scansionaVista(come(doppia), {}, nuovaMemoriaTocchi());
check(
  'due testi identici restano due blocchi distinti',
  [true, true, true],
  [
    occorrenze.blocchi[0].chiave !== occorrenze.blocchi[1].chiave,
    occorrenze.blocchi[0].chiave.endsWith('#0'),
    occorrenze.blocchi[1].chiave.endsWith('#1'),
  ],
);

const salvati = { [chiave]: { t: 'Vedi qui ora', v: 'Guarda qui adesso' } };
const dopoReload = scansionaVista(come(paginaBlocchi().radice), salvati, nuovaMemoriaTocchi());
check(
  'pagina ricaricata: l’override torna a schermo con la stessa chiave',
  ['Guarda qui adesso', true, chiave, 'Vedi qui ora'],
  [
    dopoReload.blocchi[1].testo,
    dopoReload.blocchi[1].modificato,
    dopoReload.blocchi[1].chiave,
    dopoReload.blocchi[1].originale,
  ],
);

const pagina3 = paginaBlocchi();
const memoria3 = nuovaMemoriaTocchi();
scansionaVista(come(pagina3.radice), salvati, memoria3);
const conModifica = scansionaVista(come(pagina3.radice), salvati, memoria3);
check(
  're-render con modifica attiva: chiave, default e testo non si perdono',
  [chiave, 'Vedi qui ora', 'Guarda qui adesso'],
  [
    conModifica.blocchi[1].chiave,
    conModifica.blocchi[1].originale,
    testoContiguo(come(pagina3.paragrafo)),
  ],
);
const senzaModifica = scansionaVista(come(pagina3.radice), {}, memoria3);
check(
  'modifica tolta: torna la copy del codice, stessa chiave',
  ['Vedi qui ora', false, chiave],
  [senzaModifica.blocchi[1].testo, senzaModifica.blocchi[1].modificato, senzaModifica.blocchi[1].chiave],
);

const pagina4 = paginaBlocchi();
const esito = scansionaVista(come(pagina4.radice), {}, nuovaMemoriaTocchi());
check(
  'dal click su un figlio inline si risale al blocco giusto',
  esito.blocchi[1].chiave,
  antenatoBlocco(come(pagina4.forte), esito.indice)?.chiave ?? null,
);
check(
  'la chiave porta all’elemento (per l’anello di evidenziazione)',
  true,
  esito.elementi.get(esito.blocchi[1].chiave) === come(pagina4.paragrafo),
);
check(
  'il monitor Radar Live resta fuori dagli indici (niente click sulle righe che ruotano)',
  null,
  antenatoBlocco(pagina4.radar.childNodes[0] as FintoElemento, esito.indice),
);
check(
  'stessiBlocchi: vista identica ⇒ nessun ri-render inutile',
  [true, false],
  [stessiBlocchi(esito.blocchi, esito.blocchi), stessiBlocchi(esito.blocchi, dopoReload.blocchi)],
);
check('suUnaRiga: il testo resta su una riga sola', 'Ciao mondo', suUnaRiga('  Ciao\n  mondo '));

console.log(
  errori === 0
    ? '\n✅ VISUAL EDITOR (blocchi + scansione): nessun problema'
    : `\n❌ VISUAL EDITOR (blocchi + scansione): ${errori} errore/i`,
);
process.exitCode = errori === 0 ? 0 : 1;
