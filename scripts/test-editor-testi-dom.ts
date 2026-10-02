/**
 * Test — «EDITOR TESTI RAPIDO» UNIVERSALE: scansione del DOM, override e persistenza.
 *
 * Terza metà della catena `test-editor-testi` (registro + store del dizionario, vista attiva):
 * qui si ESEGUE la scansione di `src/lib/testiDom.ts` su un DOM finto, senza jsdom né browser,
 * e si verificano le promesse dell'editor universale:
 *
 *  1. RILEVAZIONE: finiscono nell'editor solo i blocchi di testo con almeno 2 lettere, in
 *     ordine di lettura e con etichetta umana del punto della pagina; fuori script/style/
 *     textarea/codice, numeri, simboli e i pannelli DEV (l'editor non elenca se stesso);
 *  2. IDENTITÀ STABILE: la chiave di un'occorrenza (tag + impronta del testo + n° occorrenza)
 *     non dipende dalla posizione nel DOM e distingue due testi identici;
 *  3. SCRITTURA: il nodo cambia sul posto (spazi di bordo del JSX compresi) e l'override va in
 *     `localStorage: sr_dom_text_overrides` come `chiave → { t, v }`;
 *  4. RE-RENDER E RICARICA: React che rimette la copy del codice non cancella l'override (la
 *     scansione lo riapplica su nodi nuovi) e su una pagina ricaricata l'override torna a
 *     schermo perché si rilegge dallo storage;
 *  5. RESET: tutti i testi tornano ai default del codice e la chiave salvata sparisce.
 *
 * Il CABLAGGIO dei file (libreria pura, hook con l'osservatore del DOM, DEV Toolbar che monta
 * la scansione sempre attiva in DEV, pannello senza elenchi cablati) ha la sua guardia
 * dedicata: `scripts/test-editor-testi-dom-cablaggio.ts`.
 *
 * Uso: npm run test:editor-testi (catena di quattro script; inclusa in `npm test`)
 */
import process from 'node:process';
import {
  STORAGE_KEY_TESTI_DOM,
  overrideDomSalvatiDaStorage,
} from '../src/lib/testiDomOverride.ts';
import {
  azzeraTestiDom,
  impostaTestoDom,
  sottoscriviTestiDom,
  testiDomInPagina,
} from '../src/lib/testiDom.ts';
import { chiaveTestoDom, impronta, normalizzaTesto } from '../src/lib/testiDomRegole.ts';
import { el, paginaProva, scan, scritto } from './lib/dom-finto.ts';

let errori = 0;
function check(nome: string, atteso: unknown, ottenuto: unknown): void {
  const ok = JSON.stringify(atteso) === JSON.stringify(ottenuto);
  if (!ok) errori += 1;
  console.log(`${ok ? '✓' : '✗'} ${nome}: atteso=${JSON.stringify(atteso)} ottenuto=${JSON.stringify(ottenuto)}`);
}

/**
 * Stub di `localStorage` installato PRIMA della prima lettura dello store (che poi tiene la
 * cache): serve a provare che la digitazione nell'editor scrive DAVVERO la chiave concordata.
 */
const fintoStorage = {
  dati: new Map<string, string>(),
  getItem(chiave: string): string | null {
    return this.dati.get(chiave) ?? null;
  },
  setItem(chiave: string, valore: string): void {
    this.dati.set(chiave, valore);
  },
  removeItem(chiave: string): void {
    this.dati.delete(chiave);
  },
};
(globalThis as unknown as { localStorage: typeof fintoStorage }).localStorage = fintoStorage;

console.log('— 1. Rilevazione: cosa finisce nell’editor e cosa no —');
let notifiche = 0;
const annullaAscoltatore = sottoscriviTestiDom(() => {
  notifiche += 1;
});

const pagina = paginaProva();
const rilevati = scan(pagina);
check(
  'solo i blocchi di testo veri, in ordine di lettura',
  ['Trova la tua cattedra', 'Interpelli su misura per te.', 'Filtri per provincia', 'Notifiche via email'],
  rilevati.map((voce) => voce.testo),
);
check(
  'etichetta umana del punto della pagina',
  ['sezione · Titolo', 'sezione · Paragrafo', 'elenco · Voce', 'elenco · Voce'],
  rilevati.map((voce) => voce.dove),
);
check(
  'fuori script/style/textarea, numeri, simboli e pannelli DEV',
  false,
  /non e copy|color: red|casella|Editor Testi Rapido|Reset dati/.test(JSON.stringify(rilevati)),
);
check(
  'nessun override attivo: a schermo c’è la copy del codice',
  [],
  rilevati.filter((voce) => voce.modificato).map((voce) => voce.chiave),
);
check('snapshot a riferimento STABILE fra due letture', true, testiDomInPagina() === testiDomInPagina());

console.log('\n— 2. Identità stabile dell’occorrenza —');
check('chiave = tag + impronta del testo + n° occorrenza', true, /^h1#[0-9a-z]+#0$/.test(rilevati[0].chiave));
check(
  'impronta: stabile fra chiamate e diversa per testi diversi',
  [true, true],
  [impronta('ciao') === impronta('ciao'), impronta('ciao') !== impronta('mondo')],
);
check(
  'la chiave ignora gli spazi inutili (testo normalizzato)',
  [true, 'ciao mondo'],
  [
    chiaveTestoDom('p', '  ciao   mondo  ', 0) === chiaveTestoDom('p', 'ciao mondo', 0),
    normalizzaTesto('  ciao   mondo '),
  ],
);

const dupl = el('div', el('p', 'Scopri di più'), el('p', 'Scopri di più'));
const chiaviDupl = scan(dupl).map((voce) => voce.chiave);
console.log('\n— 3. Scrittura: nodo aggiornato + sr_dom_text_overrides —');
const chiaveParagrafo = scan(pagina)[1].chiave; // l'editor agisce su ciò che è a schermo ADESSO
impostaTestoDom(chiaveParagrafo, 'Interpelli cuciti su misura per te.');
const dopo = scan(pagina);
check('il testo cambia sul posto, senza reload', 'Interpelli cuciti su misura per te.', dopo[1].testo);
check(
  'spazi di bordo del JSX conservati nel nodo',
  '  Interpelli cuciti su misura per te.  ',
  scritto((pagina.childNodes[0] as FintoElemento).childNodes[1] as FintoElemento),
);
check('default del codice conservato per il reset', 'Interpelli su misura per te.', dopo[1].originale);
check('solo la voce scritta risulta modificata', [[true], []], [
  [dopo[1].modificato],
  dopo.filter((voce) => voce.modificato && voce.chiave !== chiaveParagrafo).map((voce) => voce.chiave),
]);
check(
  'salvataggio in sr_dom_text_overrides come chiave → { t, v }',
  { t: 'Interpelli su misura per te.', v: 'Interpelli cuciti su misura per te.' },
  overrideDomSalvatiDaStorage()[chiaveParagrafo],
);
check('la chiave scritta è proprio sr_dom_text_overrides', true, fintoStorage.dati.has(STORAGE_KEY_TESTI_DOM));
const notifichePrima = notifiche;
scan(pagina);
check('scansione ripetuta: nessuna notifica in più, snapshot stabile', [notifichePrima, true], [
  notifiche,
  testiDomInPagina() === dopo,
]);

console.log('\n— 4. Re-render di React e ricarica della pagina —');
const rirender = paginaProva(); // nodi NUOVI con la copy del codice: come dopo un render di React
const dopoTutto = scan(rirender);
check(
  're-render: l’override torna a schermo su nodi nuovi',
  ['Trova la tua cattedra', 'Interpelli cuciti su misura per te.', 'Filtri per provincia', 'Notifiche via email'],
  dopoTutto.map((voce) => voce.testo),
);
check('re-render: default intatto e voce segnata modificata', ['Interpelli su misura per te.', true], [
  dopoTutto[1].originale,
  dopoTutto[1].modificato,
]);
check('ricarica: l’override si rilegge dallo storage', true, chiaveParagrafo in overrideDomSalvatiDaStorage());

console.log('\n— 5. Reset: tutti i testi tornano ai default del codice —');
azzeraTestiDom();
check('reset: storage svuotato', [null, {}], [
  fintoStorage.getItem(STORAGE_KEY_TESTI_DOM),
  overrideDomSalvatiDaStorage(),
]);
const dopoReset = scan(rirender);
check(
  'reset: i nodi già riscritti tornano al default (senza reload)',
  '  Interpelli su misura per te.  ',
  scritto((rirender.childNodes[0] as FintoElemento).childNodes[1] as FintoElemento),
);
check('reset: nessun testo risulta modificato', [], dopoReset.filter((voce) => voce.modificato).map((voce) => voce.chiave));
scan(dupl);
check('reset: vale anche per l’altra occorrenza identica', ['Scopri di più', 'Scopri di più'], [
  scritto(dupl.childNodes[0] as FintoElemento),
  scritto(dupl.childNodes[1] as FintoElemento),
]);
annullaAscoltatore();

console.log(errori === 0 ? '\n✅ EDITOR TESTI (DOM): nessun problema' : `\n❌ EDITOR TESTI (DOM): ${errori} errore/i`);
process.exitCode = errori === 0 ? 0 : 1;

check(
  'due testi identici = due occorrenze distinte',
  [true, true],
  [chiaviDupl[0] !== chiaviDupl[1], chiaviDupl[0].endsWith('#0') && chiaviDupl[1].endsWith('#1')],
);
impostaTestoDom(chiaviDupl[0], 'Scopri ora');
scan(dupl);
check(
  'si scrive SOLO l’occorrenza scelta',
  ['Scopri ora', 'Scopri di più'],
  [scritto(dupl.childNodes[0] as FintoElemento), scritto(dupl.childNodes[1] as FintoElemento)],
);

