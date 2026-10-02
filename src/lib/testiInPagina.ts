/**
 * ScuoleRadar.it — REGISTRO DEI TESTI «A SCHERMO» (DEV Toolbar).
 *
 * Terza parte del sistema dei testi modificabili, accanto a:
 *   · `src/data/editableTexts.ts`   → il DIZIONARIO (`chiave → testo di default`);
 *   · `src/lib/testiModificabili.ts` → gli OVERRIDE scritti nell'editor (`localStorage`).
 * Qui c'è la VISTA ATTIVA: quali chiavi i componenti montati stanno rendendo in
 * questo momento. Non è una mappa rotta → chiavi da tenere allineata: l'iscrizione
 * la fa l'hook con cui le pagine LEGGONO i testi
 * (`src/hooks/useTestiEditabili.ts` → una chiave letta durante il render entra nel
 * registro, il componente che si smonta la fa uscire). Cambiare rotta, aprire una
 * modale o montare una sezione aggiorna l'elenco da sé.
 *
 * È ciò che rende CONTESTUALE l'«Editor Testi Rapido»: il pannello mostra solo i
 * testi che l'utente ha davanti, senza elenchi di pagine cablati.
 *
 * Contratto (identico allo store degli override): snapshot a riferimento STABILE
 * per `useSyncExternalStore`, notifica agli ascoltatori SOLO al cambiamento reale,
 * ordine del registro (`CHIAVI_TESTO`) — mai ordine di montaggio, così la lista
 * non si rimescola navigando.
 *
 * Modulo PURO e isomorfo: nessun React, nessun accesso a DOM/storage → importabile
 * da frontend, script Node e test.
 */
import { CHIAVI_TESTO, type ChiaveTesto } from '../data/editableTexts.ts';

/** Componenti montati che leggono testi: uno per vista (l'insieme è lo STESSO ref). */
const viste = new Set<ReadonlySet<ChiaveTesto>>();
const ascoltatori = new Set<() => void>();

/** Snapshot corrente: riferimento stabile finché l'insieme delle chiavi non cambia. */
let snapshot: ChiaveTesto[] = [];

/** Chiavi a schermo ADESSO, in ordine di registro: è ciò che l'editor mostra. */
export function testiInPagina(): ChiaveTesto[] {
  return snapshot;
}

/** Iscrive un ascoltatore del cambio vista (ritorna la funzione di annullamento). */
export function sottoscriviTestiInPagina(ascoltatore: () => void): () => void {
  ascoltatori.add(ascoltatore);
  return () => {
    ascoltatori.delete(ascoltatore);
  };
}

/** Unione delle viste, riportata all'ordine del registro (dedup implicito). */
function calcolaSnapshot(): ChiaveTesto[] {
  const aSchermo = new Set<ChiaveTesto>();
  for (const vista of viste) for (const chiave of vista) aSchermo.add(chiave);
  return CHIAVI_TESTO.filter((chiave) => aSchermo.has(chiave));
}

function stessoElenco(a: ChiaveTesto[], b: ChiaveTesto[]): boolean {
  return a.length === b.length && a.every((chiave, i) => chiave === b[i]);
}

/**
 * Riallinea lo snapshot al registro: notifica SOLO se le chiavi a schermo sono
 * cambiate (una vista che si ri-renderizza con le stesse chiavi non sveglia nulla).
 * L'hook la chiama dopo OGNI render dei componenti che leggono testi.
 */
export function sincronizzaTestiInPagina(): void {
  const prossimo = calcolaSnapshot();
  if (stessoElenco(snapshot, prossimo)) return;
  snapshot = prossimo;
  for (const ascoltatore of [...ascoltatori]) ascoltatore();
}

/**
 * Registra l'insieme di chiavi di UN componente montato: da qui in poi le sue
 * chiavi contano come «a schermo». Idempotente sullo stesso insieme (StrictMode
 * monta/smonta due volte l'effetto, che ri-registra lo stesso oggetto); la
 * funzione ritornata lo toglie dal registro (= navigazione via).
 */
export function registraTestiInPagina(chiavi: Set<ChiaveTesto>): () => void {
  viste.add(chiavi);
  sincronizzaTestiInPagina();
  return () => {
    viste.delete(chiavi);
    sincronizzaTestiInPagina();
  };
}

/**
 * Svuota il registro (nessuna vista montata). Usato dal reset DEV e dai test:
 * nell'app basta smontare i componenti.
 */
export function azzeraTestiInPagina(): void {
  if (viste.size === 0 && snapshot.length === 0) return;
  viste.clear();
  sincronizzaTestiInPagina();
}
