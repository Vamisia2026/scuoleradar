/**
 * ScuoleRadar.it — DOM FINTO per i test dell'«Editor Testi Rapido» (DEV Toolbar).
 *
 * La scansione (`src/lib/testiDomNodi.ts`) lavora su un sottoinsieme MINIMO di DOM: questi
 * costruttori permettono di ESEGUIRE i test negli script Node, senza jsdom né browser, e di
 * scrivere a mano i casi difficili (pannelli DEV da ignorare, testi identici, spazi di bordo…).
 *
 * Uso: `import { con, el, paginaProva, scan, scritto } from './lib/dom-finto.ts'`.
 */
import { scansionaTestiDom, type NodoDom, type TestoDomRilevato } from '../../src/lib/testiDom.ts';

/** Elemento del DOM finto (il cast a `NodoDom` lo fa `scan`, una volta sola). */
export interface FintoElemento {
  nodeType: number;
  nodeValue: string | null;
  tagName: string;
  id: string;
  parentElement: FintoElemento | null;
  childNodes: FintoNodo[];
  hasAttribute?(nome: string): boolean;
  getAttribute?(nome: string): string | null;
}

/** Nodo di testo del DOM finto. */
export interface FintoTesto {
  nodeType: number;
  nodeValue: string;
  parentElement: FintoElemento | null;
}

export type FintoNodo = FintoElemento | FintoTesto;

/** Nodo di testo: `el('p', 'ciao')` lo usa per te, ma serve anche da solo. */
export const testo = (valore: string): FintoTesto => ({
  nodeType: 3,
  nodeValue: valore,
  parentElement: null,
});

/** Elemento con figli testuali o elementi: `el('section', el('h2', 'Titolo'))`. */
export function el(tag: string, ...figli: Array<FintoNodo | string>): FintoElemento {
  const nodo: FintoElemento = {
    nodeType: 1,
    nodeValue: null,
    tagName: tag.toUpperCase(),
    id: '',
    parentElement: null,
    childNodes: [],
  };
  nodo.childNodes = figli.map((figlio) => (typeof figlio === 'string' ? testo(figlio) : figlio));
  for (const figlio of nodo.childNodes) figlio.parentElement = nodo;
  return nodo;
}

/** Elemento con attributi: serve per i casi IGNORATI (pannelli DEV, id, aria-label…). */
export function con(
  tag: string,
  attributi: Record<string, string>,
  ...figli: Array<FintoNodo | string>
): FintoElemento {
  const nodo = el(tag, ...figli);
  nodo.getAttribute = (nome) => attributi[nome] ?? null;
  nodo.hasAttribute = (nome) => Object.prototype.hasOwnProperty.call(attributi, nome);
  return nodo;
}

/** La scansione lavora su un DOM finto: un solo cast, qui. */
export const scan = (radice: FintoElemento): TestoDomRilevato[] =>
  scansionaTestiDom(radice as unknown as NodoDom);

/** Testo attualmente scritto nell'n-esimo nodo di un elemento finto. */
export const scritto = (padre: FintoElemento, indice = 0): string =>
  String((padre.childNodes[indice] as FintoTesto).nodeValue);

/** Pagina di prova: copy vera, contenuti tecnici e pannelli DEV da non elencare. */
export function paginaProva(): FintoElemento {
  return el(
    'main',
    el(
      'section',
      el('h1', 'Trova la tua cattedra'),
      el('p', '  Interpelli su misura per te.  '),
      el('ul', el('li', 'Filtri per provincia'), el('li', 'Notifiche via email')),
    ),
    el('script', 'const copy = "non e copy"'),
    el('style', '.classe { color: red }'),
    el('textarea', 'testo dentro la casella'),
    el('p', '42'), // numeri: fuori dall'editor
    el('p', 'x'), // una sola lettera: fuori
    con('section', { 'data-sr-dev-toolbar': '' }, el('p', 'Editor Testi Rapido')),
    con('aside', { 'aria-label': 'DevToolbar' }, el('p', 'Reset dati / LocalStorage')),
  );
}
