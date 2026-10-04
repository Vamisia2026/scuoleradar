/**
 * ScuoleRadar.it — CLICK-TO-EDIT («Visual Editor», solo sviluppo): REGOLE dei blocchi.
 *
 * Primo pezzo del sistema, accanto a `src/lib/visualEditorStore.ts` (persistenza per rotta) e
 * a `src/hooks/useVisualEditor.ts` (ponte con React). Qui non si sa nulla di React né di
 * `localStorage`: si stabilisce COSA è un blocco di testo editabile e come si legge/riscrive.
 *
 * Il punto delicato è la CONTIGUITÀ. Un paragrafo con dentro un grassetto o un link
 * (`<p>Vedi <strong>qui</strong> ora</p>`) è UN SOLO blocco: cliccando un punto qualsiasi si
 * modifica l'intero testo contiguo, non i micro-pezzi (non nascono tre caselle per
 * `Vedi `, `qui`, ` ora`). Un elemento è un blocco quando il suo sottoalbero contiene solo
 * testo e tag inline (`TAG_INLINE`): appena compare un figlio di blocco (p, div, li…) la
 * contiguità si spezza e i blocchi sono i figli — così `<div><p>a</p><p>b</p></div>` è due caselle.
 *
 * Eredita dall'«Editor Testi Rapido» (`testiDomRegole`/`testiDomNodi`): stessa normalizzazione
 * del testo, stesso `etichettaDove`, stessa idea di contenitori tecnici da ignorare. I due
 * strumenti restano indipendenti (storage e UX diversi) ma parlano la stessa lingua.
 *
 * ESCLUSIONI: sottoalberi tecnici (`TAG_TECNICI`), i pannelli DEV (`data-sr-dev-toolbar`), il
 * pannello di questo stesso editor (`data-sr-visual-editor`) e — importante — tutto ciò che è
 * marcato `contenteditable="false"`, cioè il monitor «Radar Live» di
 * `departments/radar/FlightBoardInterpelli.tsx`: le sue righe ruotano da sole e non vanno riscritte.
 *
 * Modulo PURO e isomorfo: nessun React, nessun accesso al `document` globale (il DOM vero lo
 * passa chi lo usa), così i test girano su un DOM finto (`scripts/lib/dom-finto.ts`), senza jsdom.
 */
import { etichettaDove, type NodoDom } from './testiDomNodi.ts';
import { normalizzaTesto } from './testiDomRegole.ts';

// Riesporto il sottoinsieme di DOM usato qui: chi consuma questo modulo non deve conoscere
// l'«Editor Testi Rapido» per parlare di nodi.
export type { NodoDom } from './testiDomNodi.ts';

/** Contenitori tecnici: dentro non c'è copy da modificare. */
export const TAG_TECNICI = new Set([
  'SCRIPT', 'STYLE', 'NOSCRIPT', 'TITLE', 'TEMPLATE',
  'SVG', 'CANVAS', 'IFRAME', 'VIDEO', 'AUDIO',
  'TEXTAREA', 'INPUT', 'SELECT', 'OPTION',
]);

/** Elementi invisibili alla contiguità: non spezzano il blocco e non portano testo. */
export const TAG_NEUTRI = new Set(['BR', 'WBR', 'IMG', 'PICTURE', 'SOURCE', 'TRACK', 'HR']);

/** Tag inline: stanno DENTRO un blocco senza spezzarlo. */
export const TAG_INLINE = new Set([
  'A', 'SPAN', 'STRONG', 'EM', 'B', 'I', 'U', 'S', 'SMALL', 'MARK', 'SUB', 'SUP',
  'ABBR', 'CITE', 'Q', 'TIME', 'BDI', 'BDO', 'DEL', 'INS', 'LABEL', 'CODE', 'KBD', 'SAMP',
  'VAR', 'FONT',
]);

/** Tag che possono ESSERE un blocco di testo (fra i contigui vince il più esterno). */
export const TAG_BLOCCO = new Set([
  'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'P', 'SPAN', 'STRONG', 'EM', 'B', 'I', 'U', 'SMALL',
  'MARK', 'A', 'BUTTON', 'LABEL', 'LI', 'TD', 'TH', 'CAPTION', 'DT', 'DD', 'BLOCKQUOTE',
  'FIGCAPTION', 'SUMMARY', 'LEGEND', 'DIV', 'CITE', 'Q', 'TIME', 'ADDRESS',
]);

/** Marche che escludono un sottoalbero dalla scansione e dai click dell'editor. */
export const MARCHI_ESCLUSI = ['data-sr-dev-toolbar', 'data-sr-visual-editor'] as const;

/** Un blocco di testo individuato nella pagina (prima che scattino gli override salvati). */
export interface BloccoTrovato {
  /** Elemento che contiene il testo contiguo. */
  elemento: NodoDom;
  /** Tag del blocco (`P`, `H2`, `BUTTON`…). */
  tag: string;
  /** Punto della pagina in parole: «sezione · Paragrafo». */
  dove: string;
  /** Testo contiguo letto adesso, con gli spazi collassati. */
  testo: string;
}

/** True se il sottoalbero non va toccato: tecnico, pannello DEV o `contenteditable="false"`. */
export function escluso(elemento: NodoDom): boolean {
  const tag = elemento.tagName ?? '';
  if (tag === '' || TAG_TECNICI.has(tag)) return true;
  // Il monitor «Radar Live» si protegge così: le sue celle ruotano da sole, riscriverle
  // farebbe litigare React con il DOM.
  if ((elemento.getAttribute?.('contenteditable') ?? '').toLowerCase() === 'false') return true;
  for (const marchio of MARCHI_ESCLUSI) if (elemento.hasAttribute?.(marchio)) return true;
  return /visual editor|visual-editor|devtoolbar/i.test(
    `${elemento.id ?? ''} ${elemento.getAttribute?.('aria-label') ?? ''}`,
  );
}

/** True se il testo merita una casella: almeno 2 lettere e almeno 3 caratteri. */
function promettente(testo: string): boolean {
  if (testo.length < 3) return false;
  const lettere = testo.match(/\p{L}/gu);
  return lettere !== null && lettere.length >= 2;
}

/** Accumula il testo dei nodi di testo del sottoalbero (tecnici e neutri esclusi). */
function raccogliTesto(elemento: NodoDom, out: string[]): void {
  const figli = elemento.childNodes;
  if (!figli) return;
  for (let i = 0; i < figli.length; i += 1) {
    const figlio = figli[i];
    if (figlio.nodeType === 3) {
      out.push(figlio.nodeValue ?? '');
      continue;
    }
    if (figlio.nodeType !== 1) continue;
    const tag = figlio.tagName ?? '';
    if (TAG_TECNICI.has(tag) || TAG_NEUTRI.has(tag)) continue;
    raccogliTesto(figlio, out);
  }
}

/**
 * Testo CONTIGUO di un blocco: i nodi si incollano senza separatore (gli spazi del JSX sono già
 * dentro i nodi) e gli spazi inutili si collassano — «Vedi qui ora» da tre nodi di testo.
 */
export function testoContiguo(elemento: NodoDom): string {
  const parti: string[] = [];
  raccogliTesto(elemento, parti);
  return normalizzaTesto(parti.join(''));
}

/** True se nel sottoalbero ci sono solo testo e tag inline: la contiguità non si spezza. */
function soloInline(elemento: NodoDom): boolean {
  const figli = elemento.childNodes;
  if (!figli) return true;
  for (let i = 0; i < figli.length; i += 1) {
    const figlio = figli[i];
    if (figlio.nodeType !== 1) continue;
    const tag = figlio.tagName ?? '';
    if (TAG_TECNICI.has(tag) || TAG_NEUTRI.has(tag)) continue;
    if (!TAG_INLINE.has(tag)) return false;
    if (!soloInline(figlio)) return false;
  }
  return true;
}

/** True se l'elemento è un blocco di testo contiguo e modificabile. */
export function contiguo(elemento: NodoDom | null): boolean {
  if (!elemento) return false;
  if (escluso(elemento)) return false;
  if (!TAG_BLOCCO.has(elemento.tagName ?? '')) return false;
  if (!soloInline(elemento)) return false;
  return promettente(testoContiguo(elemento));
}

/**
 * True se l'elemento è il blocco PIÙ ESTERNO: la sua contiguità non è già raccolta da un
 * antenato. È così che un `<strong>` dentro un `<p>` non diventa una casella a sé.
 */
export function eBlocco(elemento: NodoDom): boolean {
  return contiguo(elemento) && !contiguo(elemento.parentElement ?? null);
}

/** Visita l'albero e raccoglie i blocchi in ordine di lettura, senza entrare nei blocchi. */
export function raccogliBlocchi(radice: NodoDom, out: BloccoTrovato[]): void {
  const figli = radice.childNodes;
  if (!figli) return;
  for (let i = 0; i < figli.length; i += 1) {
    const figlio = figli[i];
    if (figlio.nodeType !== 1 || escluso(figlio)) continue;
    if (eBlocco(figlio)) {
      out.push({
        elemento: figlio,
        tag: figlio.tagName ?? '',
        dove: etichettaDove(figlio),
        testo: testoContiguo(figlio),
      });
    } else {
      raccogliBlocchi(figlio, out);
    }
  }
}

/**
 * Blocco a cui appartiene un elemento cliccato: risale fino al primo antenato presente
 * nell'indice dell'ultima scansione. Un click su `<strong>` dentro un paragrafo trova il
 * paragrafo (nessun micro-blocco: l'indice contiene solo i blocchi, che non sono annidati).
 */
export function antenatoBlocco<B extends BloccoTrovato>(
  elemento: NodoDom | null,
  indice: WeakMap<object, B>,
): B | null {
  let corrente = elemento;
  for (let livelli = 0; corrente && livelli < 12; livelli += 1) {
    const trovato = indice.get(corrente as object);
    if (trovato) return trovato;
    corrente = corrente.parentElement ?? null;
  }
  return null;
}

/** Nodi di testo NON vuoti del blocco, in ordine di lettura: sono quelli che si riscrivono. */
export function nodiTesto(elemento: NodoDom, out: NodoDom[] = []): NodoDom[] {
  const figli = elemento.childNodes;
  if (!figli) return out;
  for (let i = 0; i < figli.length; i += 1) {
    const figlio = figli[i];
    if (figlio.nodeType === 3) {
      if (normalizzaTesto(figlio.nodeValue ?? '') !== '') out.push(figlio);
      continue;
    }
    if (figlio.nodeType !== 1 || escluso(figlio)) continue;
    nodiTesto(figlio, out);
  }
  return out;
}

/**
 * Riscrive il testo CONTIGUO di un blocco senza toccare la struttura: il testo nuovo va nel
 * primo nodo di testo (spazi di bordo del JSX conservati) e gli altri si svuotano. Nessun nodo
 * viene aggiunto o rimosso: è la condizione per cui una ri-renderizzazione di React non trova
 * il DOM «sorpreso» e non genera errori in sviluppo.
 */
export function scriviBlocco(elemento: NodoDom, valore: string): void {
  // Niente scritture inutili: così l'osservatore delle mutazioni non entra in ciclo.
  if (normalizzaTesto(testoContiguo(elemento)) === normalizzaTesto(valore)) return;
  const nodi = nodiTesto(elemento);
  if (nodi.length === 0) return;
  const primo = nodi[0];
  const attuale = primo.nodeValue ?? '';
  const prima = /^\s*/.exec(attuale)?.[0] ?? '';
  const dopo = /\s*$/.exec(attuale)?.[0] ?? '';
  primo.nodeValue = `${prima}${valore}${dopo}`;
  for (let i = 1; i < nodi.length; i += 1) nodi[i].nodeValue = '';
}
