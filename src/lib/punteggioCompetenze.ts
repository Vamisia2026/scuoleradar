/**
 * ScuoleRadar.it — MODALITÀ 3 «In cosa puoi lavorare oltre la classe» (parole
 * chiave/competenze), modulo PURO.
 *
 *   · parola chiave TROVATA nel testo dell'avviso          → 90% (d'ufficio,
 *     qualunque sia l'ordine di scuola);
 *   · match SEMANTICO VICINO (alcuni token della parola
 *     chiave, es. «Didattica multimediale»)                → 85%;
 *   · RUOLO JOLLY: **se non c'è alcuna corrispondenza la modale esce dal calcolo
 *     della media** (non azzera l'offerta); se invece ci sono corrispondenze
 *     parziali o parole chiave RICONDUCIBILI (stessa area disciplinare o ponte
 *     curato), ognuna vale **+3%** sul punteggio finale (93%, 87%…).
 *
 * La sfumatura del 3% è DETERMINISTICA (dipende dalle corrispondenze trovate, non
 * dal caso): un punteggio casuale non sarebbe né spiegabile all'utente né
 * verificabile da una guardia. Il «jolly» resta quindi: esclusione dalla media
 * quando non c'è nulla da dire, incremento misurabile quando c'è.
 */
import { areeDi, areeInComune, ponteTraAree } from './areeDisciplinari';
import { etichetteCompetenzeProfilo, tokenCompetenza } from './matchingEngine';

/** Parola chiave presente nell'avviso con TUTTI i suoi token significativi. */
export const PUNTEGGIO_KEYWORD_ESATTA = 90;
/** Parola chiave riconosciuta solo in parte (match semantico vicino). */
export const PUNTEGGIO_KEYWORD_VICINA = 85;
/** Incremento (punti %) per ogni corrispondenza parziale o riconducibile. */
export const INCREMENTO_JOLLY = 3;
/** Massimo numero di incrementi jolly (→ +9%: mai una promozione arbitraria). */
export const JOLLY_MASSIMO = 3;

/** Profilo minimo per la modale (parole chiave e competenze dichiarate). */
export interface ProfiloCompetenze {
  materieId?: readonly string[] | null;
  materieCustom?: readonly string[] | null;
}

/** Avviso minimo per la modale (materia inferita + titolo). */
export interface AvvisoCompetenze {
  materia?: string | null;
  titolo?: string | null;
}

/** Esito della modale: punteggio (o esclusione) + incrementi jolly + motivi. */
export interface EsitoCompetenze {
  /** 90 | 85 | `null` = nessuna corrispondenza → modale esclusa dalla media. */
  punteggio: number | null;
  /** Incrementi del 3% da sommare al punteggio finale (0 … `JOLLY_MASSIMO`). */
  incrementi: number;
  /** Motivi leggibili (parola chiave riconosciuta, ponte, conteggi). */
  motivi: string[];
}

/** Classificazione di una singola parola chiave rispetto al testo dell'avviso. */
type Grado = 'esatta' | 'vicina' | 'riconducibile';

interface MatchKeyword {
  keyword: string;
  grado: Grado;
  dettaglio: string;
}

/** Valuta UNA parola chiave del profilo: token, aree disciplinari, ponte. */
function valutaKeyword(
  keyword: string,
  tokenAvviso: ReadonlySet<string>,
  areeAvviso: ReadonlySet<string>,
): MatchKeyword | null {
  const tokens = tokenCompetenza(keyword);
  if (tokens.length === 0) {
    // Parola chiave troppo corta/generica per i token: conta solo l'area.
    const comuni = areeInComune(areeDi(keyword), areeAvviso);
    return comuni.length > 0
      ? { keyword, grado: 'riconducibile', dettaglio: comuni.join(', ') }
      : null;
  }
  const trovati = tokens.filter((t) => tokenAvviso.has(t)).length;
  if (trovati === tokens.length) return { keyword, grado: 'esatta', dettaglio: keyword };
  if (trovati > 0) {
    return { keyword, grado: 'vicina', dettaglio: `${trovati}/${tokens.length} parole` };
  }
  const comuni = areeInComune(areeDi(keyword), areeAvviso);
  if (comuni.length > 0) return { keyword, grado: 'riconducibile', dettaglio: comuni.join(', ') };
  const ponte = ponteTraAree(areeDi(keyword), areeAvviso);
  return ponte ? { keyword, grado: 'riconducibile', dettaglio: ponte.etichetta } : null;
}


/** Motivo leggibile del match più forte (le altre frasi restano nel conteggio). */
function motivoPrevalente(matches: readonly MatchKeyword[]): string {
  const ordine: Grado[] = ['esatta', 'vicina', 'riconducibile'];
  const forte = [...matches].sort(
    (a, b) =>
      ordine.indexOf(a.grado) - ordine.indexOf(b.grado) || a.keyword.localeCompare(b.keyword),
  )[0];
  if (forte.grado === 'esatta') return `parola chiave: ${forte.keyword}`;
  if (forte.grado === 'vicina') {
    return `parola chiave vicina: «${forte.keyword}» (${forte.dettaglio})`;
  }
  return `parola chiave riconducibile: «${forte.keyword}» (${forte.dettaglio})`;
}

/**
 * Punteggio della modale «Parole chiave» (Modalità 3). Nessuna corrispondenza →
 * `punteggio: null` + `incrementi: 0` (ruolo Jolly: la modale esce dalla media e
 * non altera il totale).
 */
export function punteggioCompetenze(
  profilo: ProfiloCompetenze,
  avviso: AvvisoCompetenze,
): EsitoCompetenze {
  const paroleChiave = etichetteCompetenzeProfilo(profilo);
  if (paroleChiave.length === 0) return { punteggio: null, incrementi: 0, motivi: [] };
  const testoAvviso = `${avviso.materia ?? ''} ${avviso.titolo ?? ''}`;
  const tokenAvviso = new Set(tokenCompetenza(testoAvviso));
  const areeAvviso = areeDi(testoAvviso);
  const matches = paroleChiave
    .map((k) => valutaKeyword(k, tokenAvviso, areeAvviso))
    .filter((m): m is MatchKeyword => m !== null);
  if (matches.length === 0) return { punteggio: null, incrementi: 0, motivi: [] };

  const esatte = matches.filter((m) => m.grado === 'esatta').length;
  const vicini = matches.filter((m) => m.grado === 'vicina').length;
  const riconducibili = matches.filter((m) => m.grado === 'riconducibile').length;
  const punteggio =
    esatte > 0 ? PUNTEGGIO_KEYWORD_ESATTA : vicini > 0 ? PUNTEGGIO_KEYWORD_VICINA : null;
  const motivi = [motivoPrevalente(matches)];
  if (matches.length > 1) motivi.push(`${matches.length} parole chiave riconosciute`);

  return {
    // Un match solo «riconducibile» non produce punteggio: è materia del jolly.
    punteggio,
    incrementi: Math.min(Math.max(0, esatte - 1) + vicini + riconducibili, JOLLY_MASSIMO),
    motivi,
  };
}
