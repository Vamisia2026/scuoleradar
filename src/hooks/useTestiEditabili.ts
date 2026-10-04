/**
 * ScuoleRadar.it — hook dei testi modificabili (DEV Toolbar).
 *
 * UNA API, una sola verità (lo store `@/lib/testiModificabili`):
 *   · `useTestiEditabili()` → per le PAGINE che rendono i testi PER CHIAVE.
 *
 * API dei testi:
 *   · `testo(chiave)`             → override della DEV Toolbar se presente, altrimenti
 *                                   il default del registro (`src/data/editableTexts.ts`);
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
 *
 * Nota (§26.38, 03/10/2026). L'API `useTestiInPagina()` e il registro delle viste
 * (`@/lib/testiInPagina`) esistevano SOLO per il pannello «Editor Testi Rapido»
 * della DEV Toolbar: rimosso il pannello, sono spariti con lui. La copy per chiave
 * resta quella di FAQ, /prezzi e vetrina PRO e si modifica col VISUAL EDITOR
 * click-to-edit (§26.37).
 */
import { useCallback, useSyncExternalStore } from 'react';
import { testoDiDefault, type ChiaveTesto } from '@/data/editableTexts';
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
  /** Testo da mostrare per una chiave (override DEV se presente, altrimenti il default). */
  testo: (chiave: ChiaveTesto) => string;
  /** Imposta il testo di una chiave (stringa vuota = ripristina il default). */
  imposta: (chiave: ChiaveTesto, valore: string) => void;
  /** Riporta tutti i testi ai default del codice. */
  azzera: () => void;
  /** Numero di testi attualmente modificati. */
  modificati: number;
}

/** Snapshot degli override, con gli override SPENTI fuori dallo sviluppo. */
function useOverrideTesti(): OverrideTesti {
  const snapshot = useSyncExternalStore(sottoscriviTesti, overrideTesti, overrideTesti);
  // DEV-only: la copy di produzione è sempre quella del registro.
  return import.meta.env.DEV === true ? snapshot : NESSUN_OVERRIDE;
}

/**
 * Testi modificabili per le PAGINE: `testo(chiave)` restituisce l'override scritto
 * in sviluppo (se c'è), altrimenti il default del registro.
 */
export function useTestiEditabili(): ApiTestiEditabili {
  const testi = useOverrideTesti();
  const testo = useCallback(
    (chiave: ChiaveTesto) => testi[chiave] ?? testoDiDefault(chiave),
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
