/**
 * ScuoleRadar.it — hook dell'«Editor Testi Rapido» UNIVERSALE (DEV Toolbar).
 *
 * Due API, una sola verità (la scansione `@/lib/testiDom`):
 *   · `useScansioneTestiDom()` → da montare UNA volta sola, sempre attiva in DEV (la
 *     monta la DEV Toolbar): scandisce la vista appena compare, RIAPPLICA gli override
 *     salvati dopo ogni ricarica e osserva il DOM (`MutationObserver`), così una
 *     ri-renderizzazione di React non cancella il testo scritto a mano;
 *   · `useTestiDomInPagina()` → per il pannello dell'editor: elenco dei blocchi di testo
 *     a schermo (snapshot stabile) + scrittura (`imposta`) e reset.
 *
 * Nessun cablaggio nei componenti delle pagine: si scrive dalla DEV Toolbar e il testo
 * cambia dove è usato, in qualunque pagina — chiave di registro o copy cablata nel JSX.
 *
 * Gli override valgono SOLO in sviluppo: a montare la scansione è la DEV Toolbar
 * (`import.meta.env.DEV`), quindi in produzione nessun testo viene riscritto.
 */
import { useCallback, useEffect, useSyncExternalStore } from 'react';
import {
  azzeraTestiDom,
  impostaTestoDom,
  scansionaTestiDom,
  sottoscriviTestiDom,
  testiDomInPagina,
  type NodoDom,
  type TestoDomRilevato,
} from '@/lib/testiDom';

/** Attesa prima di riscansionare dopo un cambio del DOM: raggruppa le mutazioni di un render. */
const ATTESA_MS = 60;

/** La pagina come la vede la scansione (null in SSR/Node: nessun DOM da toccare). */
function radicePagina(): NodoDom | null {
  return typeof document === 'undefined' ? null : (document.body as unknown as NodoDom);
}

/** Rilegge il DOM adesso (dopo un cambio di testo o una navigazione). */
function scandisciOra(): void {
  const radice = radicePagina();
  if (radice) scansionaTestiDom(radice);
}

/**
 * Tiene il DOM allineato agli override salvati: da montare una volta sola (DEV Toolbar).
 * Una ri-renderizzazione di React rimette la copy del codice, l'osservatore se ne accorge e
 * la scansione riapplica il testo scritto a mano. Le NOSTRE scritture non riaprono il giro:
 * la seconda scansione non cambia nulla, quindi nessuna notifica e nessun ciclo infinito.
 */
export function useScansioneTestiDom(): void {
  useEffect(() => {
    scandisciOra();
    if (typeof MutationObserver === 'undefined') return undefined;
    const radice = radicePagina();
    if (!radice) return undefined;

    let attesa: number | null = null;
    const programma = (): void => {
      if (attesa !== null) return;
      attesa = window.setTimeout(() => {
        attesa = null;
        scandisciOra();
      }, ATTESA_MS);
    };
    const osservatore = new MutationObserver(programma);
    osservatore.observe(radice as unknown as Node, {
      childList: true,
      subtree: true,
      characterData: true,
    });
    return () => {
      osservatore.disconnect();
      if (attesa !== null) window.clearTimeout(attesa);
    };
  }, []);
}

/** API dell'editor universale: elenco dei testi a schermo + scrittura/reset degli override. */
export interface ApiTestiDom {
  /** Blocchi di testo presenti ADESSO nella vista, in ordine di lettura. */
  testi: TestoDomRilevato[];
  /** Scrive il testo di un'occorrenza: effetto immediato sul DOM + salvataggio in localStorage. */
  imposta: (chiave: string, valore: string) => void;
  /** Riporta tutti i testi ai default del codice (store E schermo). */
  azzera: () => void;
}

/** Hook del pannello: legge l'elenco pubblicato dalla scansione e scrive gli override. */
export function useTestiDomInPagina(): ApiTestiDom {
  const testi = useSyncExternalStore(sottoscriviTestiDom, testiDomInPagina, testiDomInPagina);
  const imposta = useCallback((chiave: string, valore: string) => {
    impostaTestoDom(chiave, valore);
    scandisciOra(); // il testo cambia all'istante, senza aspettare l'osservatore
  }, []);
  const azzera = useCallback(() => {
    azzeraTestiDom();
    scandisciOra();
  }, []);
  return { testi, imposta, azzera };
}
