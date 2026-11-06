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
 *
 * §26.145 — `SEQUENZA_ORDINI` e `distanzaOrdini` sono la FONTE UNICA della
 * sequenza: le modali qui sopra e le penalità severe della cascata
 * (`lib/distanzaProfilo`) leggono la stessa scala, così «adiacente» significa la
 * stessa cosa in tutta l'app.
 */
import { ordiniScuola, type OrdineScuola } from '../data/ordiniMaterie';

/** Ordine di scuola selezionato dall'utente: match pieno. */
export const PUNTEGGIO_ORDINE_ESATTO = 100;
/** Ordine immediatamente precedente o successivo. */
export const PUNTEGGIO_ORDINE_ADIACENTE = 90;
/** Ordine distante (o tipologia diversa): opportunità generica, non scartata. */
export const PUNTEGGIO_ORDINE_DISTANTE = 70;

/** Sequenza degli ordini scolastici (dal più basso al più alto): FONTE UNICA (§26.145). */
export const SEQUENZA_ORDINI: readonly OrdineScuola[] = [
  'infanzia',
  'primaria',
  'secondaria1',
  'secondaria2',
];

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

/**
 * DISTANZA fra due ordini nella sequenza scolastica (§26.145):
 * `0` = stesso ordine · `1` = adiacenti · `2` · `3` = agli estremi (infanzia ↔
 * secondaria II). `-1` = FUORI SEQUENZA (CPIA, serali, PON, ATA) oppure dato
 * assente: la scala non si applica e non si inventa una distanza.
 */
export function distanzaOrdini(a?: OrdineScuola | null, b?: OrdineScuola | null): number {
  const ia = a ? SEQUENZA_ORDINI.indexOf(a) : -1;
  const ib = b ? SEQUENZA_ORDINI.indexOf(b) : -1;
  return ia < 0 || ib < 0 ? -1 : Math.abs(ia - ib);
}

/** True se i due ordini sono consecutivi nella sequenza scolastica. */
export function ordiniAdiacenti(a?: OrdineScuola | null, b?: OrdineScuola | null): boolean {
  return distanzaOrdini(a, b) === 1;
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
