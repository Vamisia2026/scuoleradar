/**
 * ScuoleRadar.it — hook dei testi modificabili (DEV Toolbar).
 *
 * DUE API, una sola verità (lo store `@/lib/testiModificabili`):
 *   · `useTestiEditabili()` → per le PAGINE che rendono i testi. Oltre a leggere
 *     (`testo`), SCRIVE e aggiorna (`imposta`), azzera (`azzera`) e dichiara al
 *     registro `@/lib/testiInPagina` quali chiavi sono «a schermo»: è ciò che
 *     rende CONTESTUALE l'editor della DEV Toolbar, senza mappe rotta → chiavi;
 *   · `useTestiInPagina()` → per l'«Editor Testi Rapido»: gli stessi override più
 *     `chiavi` (le chiavi a schermo ADESSO). `testo()` lì non registra nulla,
 *     altrimenti il pannello conterebbe se stesso come vista.
 *
 * API dei testi:
 *   · `testo(chiave)`             → override dell'editor se presente, altrimenti il
 *                                   default del registro (`src/data/editableTexts.ts`);
 *   · `imposta(chiave, valore)`   → salva l'override e aggiorna SUBITO tutte le
 *                                   superfici che rendono quella chiave (store
 *                                   condiviso sottoscritto, nessun reload);
 *   · `azzera()`                  → riporta tutti i testi ai default del codice;
 *   · `testi` / `modificati`      → snapshot corrente (evidenzia le voci cambiate).
 *
 * Gli override contano SOLO in ambiente di sviluppo: in build di produzione le
 * pagine usano sempre la copy ufficiale del registro (nessun testo modificato in
 * locale può finire davanti a un utente reale).
 *
 * Lo stato vive nello store esterno (`@/lib/testiModificabili`) sottoscritto con
 * `useSyncExternalStore`: tutti i componenti condividono la stessa verità.
 */
import { useCallback, useEffect, useRef, useSyncExternalStore } from 'react';
import { testoDiDefault, type ChiaveTesto } from '@/data/editableTexts';
import {
  registraTestiInPagina,
  sincronizzaTestiInPagina,
  sottoscriviTestiInPagina,
  testiInPagina,
} from '@/lib/testiInPagina';
import {
  azzeraTesti,
  impostaTesto,
  overrideTesti,
  sottoscriviTesti,
  type OverrideTesti,
} from '@/lib/testiModificabili';

/** Snapshot "nessun override": riferimento stabile usato in produzione. */
const NESSUN_OVERRIDE: OverrideTesti = {};

export interface ApiTestiEditabili {
  /** Override correnti, per chiave (solo le voci modificate). */
  testi: OverrideTesti;
  /** Testo da mostrare per una chiave (e segnala la chiave come «a schermo»). */
  testo: (chiave: ChiaveTesto) => string;
  /** Imposta il testo di una chiave (stringa vuota = ripristina il default). */
  imposta: (chiave: ChiaveTesto, valore: string) => void;
  /** Riporta tutti i testi ai default del codice. */
  azzera: () => void;
  /** Numero di testi attualmente modificati. */
  modificati: number;
}

/** API dell'editor contestuale: elenco «a schermo» + lettura/scrittura override. */
export interface ApiTestiInPagina extends ApiTestiEditabili {
  /** Chiavi che la vista attiva sta rendendo ADESSO (ordine di registro). */
  chiavi: ChiaveTesto[];
}

/** Snapshot degli override, con gli override SPENTI fuori dallo sviluppo. */
function useOverrideTesti(): OverrideTesti {
  const snapshot = useSyncExternalStore(sottoscriviTesti, overrideTesti, overrideTesti);
  // DEV-only: la copy di produzione è sempre quella del registro.
  return import.meta.env.DEV === true ? snapshot : NESSUN_OVERRIDE;
}

/**
 * Testi modificabili per le PAGINE: `testo(chiave)` restituisce il testo E
 * registra la chiave fra quelle «a schermo» (`@/lib/testiInPagina`), così la
 * DEV Toolbar sa cosa l'utente ha davanti senza nessuna mappa rotta → chiavi.
 * L'effetto senza dipendenze riallinea il registro dopo ogni render (una chiave
 * letta solo a dati caricati conta come le altre); lo smontaggio la toglie.
 */
export function useTestiEditabili(): ApiTestiEditabili {
  const testi = useOverrideTesti();
  const lette = useRef<Set<ChiaveTesto>>(new Set());
  useEffect(() => {
    const chiavi = lette.current;
    return registraTestiInPagina(chiavi);
  }, []);
  useEffect(() => {
    sincronizzaTestiInPagina();
  });
  const testo = useCallback(
    (chiave: ChiaveTesto) => {
      lette.current.add(chiave); // registrazione passiva: nessun re-render, nessun I/O
      return testi[chiave] ?? testoDiDefault(chiave);
    },
    [testi],
  );
  return {
    testi,
    testo,
    imposta: impostaTesto,
    azzera: azzeraTesti,
    modificati: Object.keys(testi).length,
  };
}

/**
 * Testi modificabili per l'«Editor Testi Rapido» (DEV Toolbar): gli stessi
 * override, più l'elenco CONTESTUALE (`chiavi`) di ciò che è a schermo.
 * `testo()` qui NON registra nulla: il pannello non deve contare come vista,
 * altrimenti si alimenterebbe da solo con le chiavi che sta mostrando.
 */
export function useTestiInPagina(): ApiTestiInPagina {
  const testi = useOverrideTesti();
  const chiavi = useSyncExternalStore(sottoscriviTestiInPagina, testiInPagina, testiInPagina);
  const testo = useCallback(
    (chiave: ChiaveTesto) => testi[chiave] ?? testoDiDefault(chiave),
    [testi],
  );
  return {
    chiavi,
    testi,
    testo,
    imposta: impostaTesto,
    azzera: azzeraTesti,
    modificati: Object.keys(testi).length,
  };
}
