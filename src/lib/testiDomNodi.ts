/**
 * ScuoleRadar.it — «EDITOR TESTI RAPIDO» (DEV Toolbar): LETTURA del DOM.
 *
 * Secondo pezzo della scansione universale: dato l'albero DOM della pagina attiva, trova i
 * NODI DI TESTO che l'editor può mostrare e riscrivere, in ordine di lettura.
 *
 *   · `NodoDom` è il sottoinsieme di DOM usato qui: tipizzare così (invece che con `Node`)
 *     permette di ESEGUIRE la scansione su un DOM finto negli script Node, senza jsdom;
 *   · si contano solo i testi con almeno 2 lettere (fuori numeri, «€ 9», simboli e spazi);
 *   · si saltano i contenitori tecnici (`TAG_IGNORATI`) e i pannelli DEV (`data-sr-dev-toolbar`
 *     oppure `id`/`aria-label` che parla di DevToolbar): l'editor non elenca se stesso;
 *   · `etichettaDove` dà il nome umano del punto della pagina («sezione · Paragrafo»);
 *   · `scriviTesto` riscrive un nodo conservando gli spazi di inizio/fine (testi inline in JSX).
 *
 * Modulo PURO e isomorfo: nessun React, nessun accesso al `document` globale.
 */
import { TAG_IGNORATI, campoDi, contenitoreDi, normalizzaTesto } from './testiDomRegole.ts';

/** Tipi di nodo visitati: 3 = testo, 1 = elemento (gli altri si saltano). */
const TESTO = 3;
const ELEMENTO = 1;

/**
 * Sottoinsieme di DOM usato dalla scansione: `childNodes`/`parentElement` bastano per
 * attraversare l'albero, `nodeValue` è il testo che si riscrive.
 */
export interface NodoDom {
  nodeType: number;
  nodeValue: string | null;
  readonly childNodes?: ArrayLike<NodoDom>;
  readonly tagName?: string;
  readonly parentElement?: NodoDom | null;
  readonly id?: string;
  hasAttribute?(nome: string): boolean;
  getAttribute?(nome: string): string | null;
}

/** Un incontro della scansione: il nodo di testo con il suo contesto (prima degli override). */
export interface OccorrenzaDom {
  nodo: NodoDom;
  tag: string;
  dove: string;
}

/** True se il testo merita una casella nell'editor: almeno 2 lettere e almeno 3 caratteri. */
function promettente(testo: string): boolean {
  if (testo.length < 3) return false;
  const lettere = testo.match(/\p{L}/gu);
  return lettere !== null && lettere.length >= 2;
}

/** True se il sottoalbero è tecnico (script, svg, codice) o appartiene a un pannello DEV. */
function ignorato(elemento: NodoDom): boolean {
  if (TAG_IGNORATI.has(elemento.tagName ?? '')) return true;
  if (elemento.hasAttribute?.('data-sr-dev-toolbar')) return true;
  return /devtoolbar/i.test(`${elemento.id ?? ''} ${elemento.getAttribute?.('aria-label') ?? ''}`);
}

/** Etichetta umana del punto della pagina: «sezione · Paragrafo». */
export function etichettaDove(genitore: NodoDom): string {
  const campo = campoDi(genitore.tagName ?? '');
  let sopra = genitore.parentElement ?? null;
  for (let livelli = 0; livelli < 6 && sopra; livelli += 1) {
    const contenitore = contenitoreDi(sopra.tagName ?? '');
    if (contenitore) return `${contenitore} · ${campo}`;
    sopra = sopra.parentElement ?? null;
  }
  return campo;
}

/** Visita i NODI DI TESTO in ordine di lettura, saltando i sottoalberi ignorati. */
export function raccogli(radice: NodoDom, out: OccorrenzaDom[]): void {
  const figli = radice.childNodes;
  if (!figli) return;
  const tag = radice.tagName ?? '';
  for (let i = 0; i < figli.length; i += 1) {
    const figlio = figli[i];
    if (figlio.nodeType === TESTO) {
      const testo = normalizzaTesto(figlio.nodeValue ?? '');
      if (tag !== '' && promettente(testo)) out.push({ nodo: figlio, tag, dove: etichettaDove(radice) });
    } else if (figlio.nodeType === ELEMENTO && !ignorato(figlio)) {
      raccogli(figlio, out);
    }
  }
}

/** Scrive il testo nel nodo conservando gli spazi di bordo del JSX (`" ciao "`). */
export function scriviTesto(nodo: NodoDom, valore: string): void {
  const attuale = nodo.nodeValue ?? '';
  if (normalizzaTesto(attuale) === normalizzaTesto(valore)) return;
  const prima = /^\s*/.exec(attuale)?.[0] ?? '';
  const dopo = /\s*$/.exec(attuale)?.[0] ?? '';
  nodo.nodeValue = `${prima}${valore}${dopo}`;
}
