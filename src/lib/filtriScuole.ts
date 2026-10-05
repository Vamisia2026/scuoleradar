/**
 * ScuoleRadar.it — MODALITÀ 5 «Filtri Avanzati Scuole» (whitelist/blacklist), PURO.
 *
 * Le due liste dell'utente non sono un punteggio: sono un GIUDIZIO.
 *
 *   · BLACKLIST (scuole escluse)  → l'avviso viene **oscurato e scartato**, a
 *     prescindere dal punteggio e da ogni altra modale. Vince su tutto.
 *   · WHITELIST (scuole preferite) → l'avviso **entra nel radar a prescindere dal
 *     punteggio**, anche fuori dal raggio abituale: è una scelta esplicita
 *     dell'utente («tieni d'occhio questa scuola»). La card lo dichiara con
 *     l'etichetta dedicata `ETICHETTA_SCUOLA_PREFERITA` quando il match col
 *     profilo è insufficiente, e la evidenzia quando il match è buono.
 *
 * Il confronto è lo stesso di sempre (`istituto + titolo` in minuscolo,
 * `includes`): le fonti reali non hanno un campo scuola affidabile, quindi il
 * match testuale è l'unica regola onesta. Scuola in entrambe le liste →
 * prevale la BLACKLIST (un divieto esplicito non si annulla con una preferenza).
 */
import type { Interpello } from '../data/interpelli';

/** Avviso minimo per il confronto con le liste scuole. */
export interface AvvisoScuola {
  istituto?: string | null;
  titolo?: string | null;
}

/** Testo su cui si confrontano le liste scuole (`istituto + titolo`, minuscolo). */
export function testoScuola(avviso: AvvisoScuola): string {
  return `${avviso.istituto ?? ''} ${avviso.titolo ?? ''}`.toLowerCase();
}

/** True se almeno una voce della lista compare nel testo della scuola/avviso. */
export function scuolaInElenco(
  elenco: readonly string[] | null | undefined,
  testo: string,
): boolean {
  return (elenco ?? []).some((voce) => Boolean(voce) && testo.includes(voce.toLowerCase()));
}

/** True se l'avviso appartiene a una scuola della BLACKLIST (da scartare). */
export function scuolaEsclusa(
  ignoredSchools: readonly string[] | null | undefined,
  avviso: AvvisoScuola,
): boolean {
  return scuolaInElenco(ignoredSchools, testoScuola(avviso));
}

/**
 * True se l'avviso appartiene a una scuola della WHITELIST (da includere
 * d'ufficio). Il confronto usa lo stesso testo della blacklist: una sola regola.
 */
export function scuolaPreferita(
  favoriteSchools: readonly string[] | null | undefined,
  avviso: AvvisoScuola,
): boolean {
  return scuolaInElenco(favoriteSchools, testoScuola(avviso));
}

/**
 * Giudizio completo della Modalità 5 su un interpello: `escluso` = blacklist,
 * `preferita` = whitelist (la blacklist ha la precedenza).
 */
export function giudizioScuole(
  preferenze: { favoriteSchools?: readonly string[] | null; ignoredSchools?: readonly string[] | null },
  interpello: Interpello,
): { escluso: boolean; preferita: boolean } {
  const testo = testoScuola(interpello);
  const escluso = scuolaInElenco(preferenze.ignoredSchools, testo);
  return { escluso, preferita: !escluso && scuolaInElenco(preferenze.favoriteSchools, testo) };
}
