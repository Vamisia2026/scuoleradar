/**
 * ScuoleRadar.it — CLICK-TO-EDIT («Visual Editor», solo sviluppo): SCANSIONE della vista.
 *
 * Quarto pezzo del sistema, fra le regole (`src/lib/visualEditorRegole.ts`) e l'hook
 * (`src/hooks/useVisualEditor.ts`): prende la vista, la lista dei blocchi trovati e le modifiche
 * salvate della rotta, applica le modifiche al DOM e restituisce l'elenco pronto per il pannello
 * più i due indici che servono ai click e all'evidenziazione.
 *
 * Sta qui, e non dentro l'hook, per una ragione pratica: è tutta logica deterministica su un
 * albero DOM, quindi si verifica su un DOM finto senza montare React.
 *
 * Due dettagli che rendono stabili le modifiche:
 *   · la CHIAVE di un blocco si calcola sul testo di DEFAULT del codice, non su quello a schermo:
 *     senza la memoria dei blocchi già toccati, una modifica cambierebbe la chiave di se stessa e
 *     la modifica andrebbe persa al reload;
 *   · i blocchi si numerano per occorrenza (`p#impronta#0`, `#1`…) così due testi identici nella
 *     stessa pagina restano due blocchi distinti.
 *
 * Modulo PURO e isomorfo: nessun React, il DOM lo passa chi chiama.
 */
import { chiaveTestoDom, impronta } from './testiDomRegole.ts';
import {
  raccogliBlocchi,
  scriviBlocco,
  type BloccoTrovato,
  type NodoDom,
} from './visualEditorRegole.ts';
import type { OverrideRotta } from './visualEditorStore.ts';

/** Un blocco come lo vede il pannello: testo di default, testo attuale, se è modificato. */
export interface BloccoEditabile {
  /** Identità stabile del blocco: `tag#impronta(testo di default)#occorrenza`. */
  chiave: string;
  /** Tag del blocco (`P`, `H2`, `BUTTON`…). */
  tag: string;
  /** Punto della pagina in parole: «sezione · Paragrafo». */
  dove: string;
  /** Testo di default scritto nel codice. */
  originale: string;
  /** Testo che si vede adesso (default, oppure la modifica salvata). */
  testo: string;
  /** True se per questo blocco esiste una modifica salvata. */
  modificato: boolean;
}

/** Blocco trovato con la sua chiave: è ciò che l'indice di scansione restituisce al click. */
export type BloccoInPagina = BloccoTrovato & { chiave: string };

/** Memoria dei blocchi già toccati: elemento → chiave e testo di DEFAULT. */
export type MemoriaTocchi = WeakMap<object, { chiave: string; originale: string }>;

/** Esito di una scansione: elenco per il pannello + indici per click ed evidenziazione. */
export interface EsitoScansione {
  /** Blocchi di testo della vista, in ordine di lettura. */
  blocchi: BloccoEditabile[];
  /** Elemento → blocco (per risalire dal click al blocco giusto). */
  indice: WeakMap<object, BloccoInPagina>;
  /** Chiave → elemento (per sapere dov'è il blocco selezionato). */
  elementi: Map<string, NodoDom>;
}

/** Memoria vuota dei blocchi toccati (una per sessione di scansione). */
export function nuovaMemoriaTocchi(): MemoriaTocchi {
  return new WeakMap<object, { chiave: string; originale: string }>();
}

/**
 * Scansiona la vista, riscrive i testi modificati e restituisce elenco e indici.
 * `radice` è di norma `document.body` (il provider DEV, i test un DOM finto).
 */
export function scansionaVista(
  radice: NodoDom,
  salvati: OverrideRotta,
  toccati: MemoriaTocchi,
): EsitoScansione {
  const trovati: BloccoTrovato[] = [];
  raccogliBlocchi(radice, trovati);
  const occorrenze = new Map<string, number>();
  const indice = new WeakMap<object, BloccoInPagina>();
  const elementi = new Map<string, NodoDom>();
  const blocchi: BloccoEditabile[] = [];
  for (const blocco of trovati) {
    const noto = toccati.get(blocco.elemento as object);
    // Il testo di default viene dal codice: se il blocco è già stato toccato lo conserviamo in
    // memoria, altrimenti è quello letto adesso.
    const originale = noto?.originale ?? blocco.testo;
    const base = `${blocco.tag.toLowerCase()}#${impronta(originale)}`;
    const occorrenza = occorrenze.get(base) ?? 0;
    occorrenze.set(base, occorrenza + 1);
    const chiave = noto?.chiave ?? chiaveTestoDom(blocco.tag, originale, occorrenza);
    const salvato = salvati[chiave];
    if (salvato) {
      scriviBlocco(blocco.elemento, salvato.v); // riflessione della modifica salvata
      toccati.set(blocco.elemento as object, { chiave, originale });
    } else if (noto) {
      scriviBlocco(blocco.elemento, noto.originale); // modifica tolta: torna il testo del codice
      toccati.delete(blocco.elemento as object);
    }
    const testo = salvato ? salvato.v : originale;
    blocchi.push({
      chiave,
      tag: blocco.tag,
      dove: blocco.dove,
      originale,
      testo,
      modificato: Boolean(salvato),
    });
    indice.set(blocco.elemento as object, { ...blocco, testo, chiave });
    elementi.set(chiave, blocco.elemento);
  }
  return { blocchi, indice, elementi };
}

/** True se due elenchi di blocchi descrivono la stessa vista (evita ri-render inutili). */
export function stessiBlocchi(precedenti: BloccoEditabile[], prossimi: BloccoEditabile[]): boolean {
  if (precedenti.length === prossimi.length) {
    for (let i = 0; i < prossimi.length; i += 1) {
      const a = precedenti[i];
      const b = prossimi[i];
      if (a.chiave !== b.chiave || a.testo !== b.testo) return false;
      if (a.originale !== b.originale || a.modificato !== b.modificato) return false;
      if (a.dove !== b.dove) return false;
    }
    return true;
  }
  return false;
}

/**
 * Testo su una riga sola: la casella di modifica non introduce a capo, perché il contenuto vive
 * in UN nodo di testo e gli a capo scritti a mano finirebbero appiattiti nel DOM senza che il
 * codice sorgente lo mostri. Spazi inutili collassati, come nel resto dell'editor.
 */
export function suUnaRiga(valore: string): string {
  return valore.replace(/\s+/g, ' ').trim();
}
