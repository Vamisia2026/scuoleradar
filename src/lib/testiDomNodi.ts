/**
 * ScuoleRadar.it — TESTI DEL DOM: LETTURA (tipo minimo e nomi umani).
 *
 * Era il secondo pezzo della scansione dell'«Editor Testi Rapido» (rimosso il 03/10/2026,
 * §26.38); del suo lavoro resta il minimo che serve al VISUAL EDITOR click-to-edit (§26.37):
 *
 *   · `NodoDom` è il sottoinsieme di DOM usato dai moduli dei testi: tipizzare così (invece
 *     che con `Node`) permette di ESEGUIRE i testi su un DOM finto negli script Node,
 *     senza jsdom;
 *   · `etichettaDove` dà il nome umano del punto della pagina («sezione · Paragrafo»).
 *
 * Modulo PURO e isomorfo: nessun React, nessun accesso al `document` globale.
 */
import { campoDi, contenitoreDi } from './testiDomRegole.ts';

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
