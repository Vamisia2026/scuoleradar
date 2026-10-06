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

/* -------------------------------------------------------------------------- */
/* AMBITO PROVINCIALE delle due liste (§26.62)                                */
/*                                                                            */
/* Il feed degli avvisi è raccolto sulle province dell'utente PIÙ il raggio   */
/* dei 60 km (`provinceDiRicerca`, Modalità 4): le scuole che compaiono nei   */
/* suggerimenti del campo potevano quindi appartenere a una provincia NON     */
/* seguita. Qui la stessa sorgente viene letta con la provincia accanto:      */
/*   · i SUGGERIMENTI del campo si limitano alle province seguite;            */
/*   · una scuola di un'altra provincia resta scrivibile a mano, ma la        */
/*     forzatura è DICHIARATA (avviso sotto il campo + badge sulla pill).    */
/* Sono funzioni pure: nessuna query, nessuno stato.                          */
/* -------------------------------------------------------------------------- */

/** Scuola riconosciuta nel feed, con la provincia da cui proviene. */
export interface ScuolaNota {
  nome: string;
  /** Sigla della provincia della scuola (`AT`, `TO`, …); vuota se la fonte non la espone. */
  provinciaCodice: string;
  /** Nome leggibile della provincia (per l'avviso di forzatura). */
  provinciaNome: string;
}

/** Avviso del feed con la provincia risolta (il tipo `Interpello` la espone sempre). */
export interface AvvisoConProvincia extends AvvisoScuola {
  provinciaCodice?: string | null;
  provinciaNome?: string | null;
}

/** Sigla di provincia in forma confrontabile. */
function siglaProvincia(codice?: string | null): string {
  return (codice ?? '').trim().toUpperCase();
}

/**
 * Scuole riconoscibili nel feed (`NOME` + provincia), senza doppioni: la mappa
 * che serve a dire se una scuola è delle province seguite o di un'altra.
 */
export function scuoleNote(avvisi: readonly AvvisoConProvincia[] | null | undefined): ScuolaNota[] {
  const note: ScuolaNota[] = [];
  const viste = new Set<string>();
  for (const avviso of avvisi ?? []) {
    const nome = (avviso.istituto ?? '').trim();
    if (!nome) continue;
    const codice = siglaProvincia(avviso.provinciaCodice);
    const chiave = `${nome.toLowerCase()}|${codice}`;
    if (viste.has(chiave)) continue;
    viste.add(chiave);
    note.push({
      nome,
      provinciaCodice: codice,
      provinciaNome: (avviso.provinciaNome ?? '').trim() || codice,
    });
  }
  return note;
}

/**
 * Suggerimenti del campo scuola: SOLO le scuole delle province che l'utente
 * segue. Senza province scelte non c'è ambito da proporre (lista vuota: il campo
 * resta a testo libero e ogni nome digitato è una forzatura dichiarata).
 */
export function suggerimentiScuole(
  note: readonly ScuolaNota[] | null | undefined,
  provinceCodici: readonly string[] | null | undefined,
): ScuolaNota[] {
  const seguite = new Set((provinceCodici ?? []).map(siglaProvincia).filter(Boolean));
  return (note ?? []).filter((n) => seguite.has(n.provinciaCodice));
}

/** Esito dell'ambito provinciale di un nome di scuola. */
export type AmbitoScuola = 'dentro' | 'fuori' | 'sconosciuta';

export interface AmbitoScolastico {
  stato: AmbitoScuola;
  /** Provincia della scuola riconosciuta (valorizzata solo con `stato: 'fuori'`). */
  provincia?: string;
}

/**
 * Ambito provinciale di un nome di scuola: `dentro` (provincia seguita),
 * `fuori` (scuola nota, ma di un'altra provincia: forzatura dichiarata) oppure
 * `sconosciuta` (non compare nel feed corrente: forzatura manuale).
 * Il confronto è quello onesto delle liste (nome intero, poi `includes`).
 */
export function ambitoScuola(
  note: readonly ScuolaNota[] | null | undefined,
  provinceCodici: readonly string[] | null | undefined,
  nome: string,
): AmbitoScolastico {
  const testo = (nome ?? '').trim().toLowerCase();
  if (!testo) return { stato: 'sconosciuta' };
  const elenco = note ?? [];
  const trovata =
    elenco.find((n) => n.nome.toLowerCase() === testo) ??
    elenco.find((n) => n.nome.toLowerCase().includes(testo) || testo.includes(n.nome.toLowerCase()));
  if (!trovata) return { stato: 'sconosciuta' };
  const seguite = new Set((provinceCodici ?? []).map(siglaProvincia).filter(Boolean));
  if (seguite.has(trovata.provinciaCodice)) return { stato: 'dentro' };
  return { stato: 'fuori', provincia: trovata.provinciaNome };
}

/**
 * Testo dell'avviso mostrato sotto il campo scuola e in testa a un elenco:
 * una sola copy per entrambe le liste.
 */
export function messaggioAmbitoScuola(ambito: AmbitoScolastico): string {
  if (ambito.stato === 'dentro') {
    return 'Scuola delle tue province (o entro 60 km): entra nelle liste senza forzature.';
  }
  if (ambito.stato === 'fuori') {
    return `Scuola di ${ambito.provincia}: fuori dalle tue province e dal raggio di 60 km — la forzatura è dichiarata.`;
  }
  return 'Scuola non presente nel feed: forzatura manuale dichiarata.';
}
