/**
 * ScuoleRadar.it — MOTORE del box «Prova il Radar» (simulatore pubblico) — puro.
 *
 * SI PROVA CON LA SOLA PROVINCIA: il selettore di classe di concorso non esiste
 * più. La prova deve restituire SEMPRE un responso vivo e tangibile: se la maglia
 * fosse «provincia + codice classe esatto», un utente che prova una provincia con
 * poco flusso vedrebbe «zero risultati» e concluderebbe che il servizio è vuoto.
 *
 * Qui vivono le regole, in ordine di pertinenza:
 *   1. PROVINCIA — TUTTE le opportunità ATTIVE della provincia scelta, di ogni
 *      categoria: supplenze, PON/POR, PNRR, CPIA, ATA/bidelli, esperti esterni;
 *   2. COMPLETAMENTO NAZIONALE — se la provincia non basta a riempire l'elenco (o
 *      è momentaneamente ferma) si aggiungono gli avvisi appena usciti in Italia:
 *      mai un elenco vuoto, mai una riga duplicata, mai un avviso spacciato per
 *      locale (`daProvincia` dichiara quante righe mostrate sono della provincia).
 *
 * «Attivo» = senza scadenza oppure con scadenza non ancora passata (`scadenza.ts`):
 * niente date inventate, nessun dato di esempio — solo righe reali di `interpelli`.
 *
 * Il messaggio di chiusura del responso vive qui (`messaggioConversione`): stesso
 * testo per UI e test, conteggio esatto e nessuna via d'uscita verso altri piani.
 */
import type { RigaBoard } from './liveBoard';
import { eInterpelloAttivo } from './scadenza';

/** Riga di `interpelli` servita al simulatore (sottoinsieme di quella del tabellone). */
export interface RigaProvaRadar extends RigaBoard {
  /** Classi di concorso citate dall'avviso (formato delle fonti: `A-022`, `ADEE`…). */
  class_codes?: string[] | null;
  /** Materia inferita dallo scraper (es. «Sostegno», «Matematica»). */
  materia?: string | null;
}

/** Perché sono state mostrate queste righe (serve alla copy del responso). */
export type GruppoProvaRadar = 'provincia' | 'nazionale' | 'vuoto';

/** Responso della prova: righe da mostrare, provenienza e quante sono locali. */
export interface EsitoProvaRadar {
  gruppo: GruppoProvaRadar;
  righe: RigaProvaRadar[];
  /** Righe mostrate che arrivano DAVVERO dalla provincia provata (mai un numero inventato). */
  daProvincia: number;
}

/** Righe mostrate nel responso: un elenco compatto, dentro un solo schermo. */
export const LIMITE_RISULTATI_PROVA = 5;

/** Solo gli avvisi ancora attivi (senza scadenza = attivi). */
export function righeAttive(
  righe: readonly RigaProvaRadar[],
  oggi?: Date,
): RigaProvaRadar[] {
  return (righe ?? []).filter((r) => eInterpelloAttivo(r.expiration_date, oggi));
}

/**
 * Compone il responso a partire dalla PROVINCIA provata: prima tutte le
 * opportunità attive della provincia, poi — solo se servono a riempire l'elenco —
 * quelle nazionali (dedup per `id`: il pool nazionale contiene anche la
 * provincia). Se non c'è nulla di attivo da nessuna parte il gruppo è `vuoto`.
 */
export function selezionaRisultatiProva(
  righeProvincia: readonly RigaProvaRadar[],
  righeNazionali: readonly RigaProvaRadar[] = [],
  limite: number = LIMITE_RISULTATI_PROVA,
): EsitoProvaRadar {
  const locali = righeAttive(righeProvincia);
  const righe = locali.slice(0, limite);
  if (righe.length < limite) {
    const mostrate = new Set(righe.map((r) => r.id));
    for (const r of righeAttive(righeNazionali)) {
      if (righe.length >= limite) break;
      if (mostrate.has(r.id)) continue;
      mostrate.add(r.id);
      righe.push(r);
    }
  }
  if (righe.length === 0) return { gruppo: 'vuoto', righe: [], daProvincia: 0 };
  // Le righe della provincia stanno sempre in testa: il conteggio è esatto.
  return {
    gruppo: locali.length > 0 ? 'provincia' : 'nazionale',
    righe,
    daProvincia: Math.min(locali.length, limite),
  };
}

/** Coda di conversione: identica in ogni responso (promessa PRO, nessuna via d'uscita). */
export const CODA_CONVERSIONE_PROVA =
  "Attiva ora il tuo radar personalizzato. Ti offriamo un mese PRO con notifiche Telegram in tempo reale e un'email di riepilogo ogni giorno alle 17.00";

/** Numero di righe in italiano corretto (`1 opportunità attiva`, `5 opportunità attive`). */
function contaOpportunita(n: number): string {
  return `${n} ${n === 1 ? 'opportunità attiva' : 'opportunità attive'}`;
}

/**
 * Messaggio SOTTO i risultati della prova: quante opportunità sono state trovate
 * oggi e da dove arrivano (`su <provincia>`, misto con `di cui N su <provincia>`,
 * oppure `in Italia` quando la provincia è momentaneamente ferma).
 */
export function messaggioConversione(esito: EsitoProvaRadar, provincia: string): string {
  const trovate = esito.righe.length;
  const oggi = contaOpportunita(trovate);
  if (esito.gruppo === 'nazionale') {
    return `Abbiamo trovato ${oggi} oggi in Italia. ${CODA_CONVERSIONE_PROVA}`;
  }
  const testa =
    esito.daProvincia === trovate
      ? `Abbiamo trovato ${oggi} oggi su ${provincia}.`
      : `Abbiamo trovato ${oggi} oggi, di cui ${esito.daProvincia} su ${provincia}.`;
  return `${testa} ${CODA_CONVERSIONE_PROVA}`;
}

/** Messaggio quando il database non ha nessun avviso vivo: mai «zero risultati». */
export function messaggioRadarInScansione(provincia: string): string {
  return `Appena esce un avviso su ${provincia} te lo diciamo noi. ${CODA_CONVERSIONE_PROVA}`;
}
