/**
 * ScuoleRadar.it — MODALITÀ 1 «Dove vuoi lavorare» (ordine di scuola), modulo PURO.
 *
 * L'ordine di scuola NON è un filtro on/off: è una modale del punteggio.
 *
 *   · ordine SELEZIONATO                          → 100%
 *   · ordine SUBITO PRIMA o SUBITO DOPO           → 90%   (Secondaria I ↔ II)
 *   · salto generico (es. Primaria per chi cerca
 *     la Secondaria)                              → 70%
 *
 * `null` = modale NON applicabile (il profilo non ha ordini selezionati, oppure
 * l'avviso non dichiara l'ordine): in quel caso la modale **non entra nella
 * media** — è il «ruolo Jolly» che evita di azzerare un'opportunità per un dato
 * che non c'è.
 *
 * La sequenza è quella degli ordini scolastici (infanzia → secondaria II). Le
 * tipologie fuori sequenza (CPIA, corsi serali, progetti PON, personale ATA) non
 * hanno un «prima/dopo»: valgono 100 solo se selezionate, altrimenti 70.
 */
import { ordiniScuola, type OrdineScuola } from '../data/ordiniMaterie';

/** Ordine di scuola selezionato dall'utente: match pieno. */
export const PUNTEGGIO_ORDINE_ESATTO = 100;
/** Ordine immediatamente precedente o successivo. */
export const PUNTEGGIO_ORDINE_ADIACENTE = 90;
/** Ordine distante (o tipologia diversa): opportunità generica, non scartata. */
export const PUNTEGGIO_ORDINE_DISTANTE = 70;

/** Sequenza degli ordini scolastici (dal più basso al più alto). */
const SEQUENZA: readonly OrdineScuola[] = ['infanzia', 'primaria', 'secondaria1', 'secondaria2'];

/** Esito della modale: punteggio + motivo leggibile per il tooltip della card. */
export interface EsitoOrdine {
  punteggio: number;
  motivo: string;
}

/** Nome ufficiale e leggibile di un ordine di scuola. */
export function etichettaOrdine(ordine?: OrdineScuola | null): string {
  if (!ordine) return 'ordine non indicato';
  return ordiniScuola.find((o) => o.id === ordine)?.nome ?? ordine;
}

/** True se i due ordini sono consecutivi nella sequenza scolastica. */
export function ordiniAdiacenti(a?: OrdineScuola | null, b?: OrdineScuola | null): boolean {
  const ia = a ? SEQUENZA.indexOf(a) : -1;
  const ib = b ? SEQUENZA.indexOf(b) : -1;
  return ia >= 0 && ib >= 0 && Math.abs(ia - ib) === 1;
}

/**
 * Punteggio di ordine di un'opportunità (Modalità 1) o `null` se la modale non è
 * applicabile. Il motivo è già la frase mostrata all'utente nel tooltip.
 */
export function punteggioOrdine(
  ordini: readonly OrdineScuola[] | null | undefined,
  ordineAvviso?: OrdineScuola | null,
): EsitoOrdine | null {
  const selezionati = (ordini ?? []).filter(Boolean);
  if (selezionati.length === 0) return null;
  if (!ordineAvviso) return null;
  if (selezionati.includes(ordineAvviso)) {
    return { punteggio: PUNTEGGIO_ORDINE_ESATTO, motivo: `ordine di scuola: ${etichettaOrdine(ordineAvviso)}` };
  }
  const vicino = selezionati.find((o) => ordiniAdiacenti(o, ordineAvviso));
  if (vicino) {
    return {
      punteggio: PUNTEGGIO_ORDINE_ADIACENTE,
      motivo: `ordine adiacente: ${etichettaOrdine(vicino)} → ${etichettaOrdine(ordineAvviso)}`,
    };
  }
  return {
    punteggio: PUNTEGGIO_ORDINE_DISTANTE,
    motivo: `salto di ordine: ${etichettaOrdine(selezionati[0])} → ${etichettaOrdine(ordineAvviso)}`,
  };
}
