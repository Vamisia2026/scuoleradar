/**
 * ScuoleRadar.it — DOM FINTO per i test dei testi (VISUAL EDITOR, §26.37).
 *
 * I moduli dei testi lavorano su un sottoinsieme MINIMO di DOM: questi costruttori permettono
 * di ESEGUIRE i test negli script Node, senza jsdom né browser, e di scrivere a mano i casi
 * difficili (pannelli DEV da ignorare, testi identici, spazi di bordo…).
 *
 * Uso: `import { con, el } from './lib/dom-finto.ts'`.
 */

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

