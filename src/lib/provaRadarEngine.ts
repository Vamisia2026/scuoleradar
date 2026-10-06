/**
 * ScuoleRadar.it — MOTORE del box «Prova il Radar» (simulatore pubblico) — puro.
 *
 * SI PROVA CON LA SOLA PROVINCIA: il selettore di classe di concorso non esiste
 * più e NON esiste alcun ripiego nazionale. La prova mostra TUTTE le opportunità
 * ATTIVE della provincia scelta, di ogni categoria — supplenze, PON/POR, PNRR,
 * CPIA, ATA/bidelli, esperti esterni — e si ferma lì: un avviso di un'altra
 * provincia non entra MAI nel responso, mai spacciato per locale e mai mostrato
 * «per riempire» l'elenco.
 *
 * Se la provincia non ha nulla di vivo il responso resta vuoto (`gruppo: 'vuoto'`)
 * e prende la parola `messaggioRadarInScansione`: «Appena esce un avviso su
 * <provincia> te lo diciamo noi». È una promessa vera — il Radar personale
 * sorveglia quella provincia — e la prova resta onesta.
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
export type GruppoProvaRadar = 'provincia' | 'vuoto';

/** Responso della prova: righe da mostrare e provenienza (sempre la provincia provata). */
export interface EsitoProvaRadar {
  gruppo: GruppoProvaRadar;
  righe: RigaProvaRadar[];
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
 * Compone il responso a partire dalla PROVINCIA provata: TUTTE le opportunità
 * attive di quella provincia, in ordine, entro il limite dello schermo. La firma
 * ha un SOLO ingresso — non si può passare un pool di altre province, quindi la
 * chiusura della prova non ha modo di mostrare un avviso non locale. Se la
 * provincia non ha nulla di attivo il gruppo è `vuoto`.
 */
export function selezionaRisultatiProva(
  righeProvincia: readonly RigaProvaRadar[],
  limite: number = LIMITE_RISULTATI_PROVA,
): EsitoProvaRadar {
  const righe = righeAttive(righeProvincia).slice(0, limite);
  if (righe.length === 0) return { gruppo: 'vuoto', righe: [] };
  return { gruppo: 'provincia', righe };
}

/** Coda di conversione: identica in ogni responso (promessa PRO, nessuna via d'uscita). */
export const CODA_CONVERSIONE_PROVA =
  "Attiva ora il tuo radar personalizzato. Ti offriamo un mese PRO con notifiche Telegram in tempo reale e un'email di riepilogo ogni giorno alle 17.00";

/** Numero di righe in italiano corretto (`1 opportunità attiva`, `5 opportunità attive`). */
function contaOpportunita(n: number): string {
  return `${n} ${n === 1 ? 'opportunità attiva' : 'opportunità attive'}`;
}

/**
 * Messaggio SOTTO i risultati della prova: quante opportunità della PROVINCIA
 * scelta sono state trovate oggi. Il conteggio è esatto — le righe mostrate sono
 * tutte della provincia, quindi non si dichiara mai una provenienza che non c'è;
 * se non c'è nulla di vivo si promette il Radar (`messaggioRadarInScansione`).
 */
export function messaggioConversione(esito: EsitoProvaRadar, provincia: string): string {
  if (esito.gruppo === 'vuoto' || esito.righe.length === 0) {
    return messaggioRadarInScansione(provincia);
  }
  const oggi = contaOpportunita(esito.righe.length);
  return `Abbiamo trovato ${oggi} oggi su ${provincia}. ${CODA_CONVERSIONE_PROVA}`;
}

/** Messaggio quando il database non ha nessun avviso vivo: mai «zero risultati». */
export function messaggioRadarInScansione(provincia: string): string {
  return `Appena esce un avviso su ${provincia} te lo diciamo noi. ${CODA_CONVERSIONE_PROVA}`;
}
