/**
 * ScuoleRadar.it — MODALITÀ 3 «In cosa puoi lavorare oltre la classe» (parole
 * chiave/competenze), modulo PURO.
 *
 *   · parola chiave TROVATA nel testo dell'avviso          → 90% (OVERRIDE:
 *     il voto è ASSEGNATO d'ufficio, non mediato);
 *   · match SEMANTICO VICINO (alcuni token della parola
 *     chiave, es. «Didattica multimediale»)                → 85% (OVERRIDE);
 *   · RUOLO JOLLY: **se non c'è alcuna corrispondenza la modale esce dal calcolo
 *     della media** (non azzera l'offerta); se invece ci sono corrispondenze
 *     parziali o parole chiave RICONDUCIBILI (stessa area disciplinare o ponte
 *     curato), ognuna vale **+3%** sul punteggio MEDIATO dalle altre modali.
 *
 * L'OVERRIDE è la regola ad ALTA PRIORITÀ della Modalità 3: quando scatta (90 o
 * 85) il voto finale è quello, qualunque cosa dicano ordine di scuola, classi e
 * distanza. La PROVINCIA resta l'unica condizione (fuori dal raggio l'avviso è
 * escluso d'ufficio). Il perimetro resta quello dichiarato: un match va provato
 * dai TOKEN del testo o dalle aree disciplinari, mai da un giudizio a caso.
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

/** Esito della modale: OVERRIDE del voto (o niente) + incrementi jolly + motivi. */
export interface EsitoCompetenze {
  /**
   * Voto ASSEGNATO d'ufficio — 90 (parola chiave piena) o 85 (match vicino) — con
   * la parola chiave che l'ha assegnato. `null` = la modale non aggancia nulla:
   * resta il ruolo JOLLY (esce dalla media e non altera il totale).
   */
  override: OverrideModale3 | null;
  /** Incrementi del 3% da sommare al punteggio MEDIATO (0 … `JOLLY_MASSIMO`). */
  incrementi: number;
  /** Motivi leggibili (parola chiave riconosciuta, ponte, conteggi). */
  motivi: string[];
}

/** Voto ASSEGNATO d'ufficio dalla Modale 3 «parole chiave»: nessuna media. */
export interface OverrideModale3 {
  /** `esatta` = nella parola chiave è stato trovato TUTTO il testo · `vicina` = match parziale. */
  grado: 'esatta' | 'vicina';
  /** La parola chiave del profilo che ha assegnato il voto. */
  parolaChiave: string;
  /** Voto d'ufficio (90 | 85). */
  punteggio: number;
}

/** Grado di un match fra una parola chiave del profilo e il testo dell'avviso. */
type Grado = 'esatta' | 'vicina' | 'riconducibile';

/** Match di UNA parola chiave del profilo col testo dell'avviso. */
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


/** Match più FORTE fra quelli trovati (esatta → vicina → riconducibile). */
function matchPrevalente(matches: readonly MatchKeyword[]): MatchKeyword {
  const ordine: Grado[] = ['esatta', 'vicina', 'riconducibile'];
  return [...matches].sort(
    (a, b) =>
      ordine.indexOf(a.grado) - ordine.indexOf(b.grado) || a.keyword.localeCompare(b.keyword),
  )[0];
}

/** Motivo leggibile del match (le altre frasi restano nel conteggio). */
function motivoDi(match: MatchKeyword): string {
  if (match.grado === 'esatta') return `parola chiave: ${match.keyword}`;
  if (match.grado === 'vicina') {
    return `parola chiave vicina: «${match.keyword}» (${match.dettaglio})`;
  }
  return `parola chiave riconducibile: «${match.keyword}» (${match.dettaglio})`;
}

/**
 * Punteggio della modale «Parole chiave» (Modalità 3): `override` presente = voto
 * ASSEGNATO d'ufficio (90 parola chiave piena · 85 match vicino) con la parola che
 * l'ha assegnato; `override: null` = ruolo JOLLY (la modale esce dalla media;
 * `incrementi` sfuma il voto mediato).
 */
export function punteggioCompetenze(
  profilo: ProfiloCompetenze,
  avviso: AvvisoCompetenze,
): EsitoCompetenze {
  const paroleChiave = etichetteCompetenzeProfilo(profilo);
  const nessuno: EsitoCompetenze = { override: null, incrementi: 0, motivi: [] };
  if (paroleChiave.length === 0) return nessuno;
  const testoAvviso = `${avviso.materia ?? ''} ${avviso.titolo ?? ''}`;
  const tokenAvviso = new Set(tokenCompetenza(testoAvviso));
  const areeAvviso = areeDi(testoAvviso);
  const matches = paroleChiave
    .map((k) => valutaKeyword(k, tokenAvviso, areeAvviso))
    .filter((m): m is MatchKeyword => m !== null);
  if (matches.length === 0) return nessuno;

  const prevalente = matchPrevalente(matches);
  const esatte = matches.filter((m) => m.grado === 'esatta').length;
  const vicini = matches.filter((m) => m.grado === 'vicina').length;
  const riconducibili = matches.filter((m) => m.grado === 'riconducibile').length;
  const motivi = [motivoDi(prevalente)];
  if (matches.length > 1) motivi.push(`${matches.length} parole chiave riconosciute`);
  // Un match solo «riconducibile» non assegna il voto: è materia del jolly.
  const override: OverrideModale3 | null =
    esatte > 0
      ? { grado: 'esatta', parolaChiave: prevalente.keyword, punteggio: PUNTEGGIO_KEYWORD_ESATTA }
      : vicini > 0
        ? { grado: 'vicina', parolaChiave: prevalente.keyword, punteggio: PUNTEGGIO_KEYWORD_VICINA }
        : null;

  return {
    override,
    incrementi: Math.min(Math.max(0, esatte - 1) + vicini + riconducibili, JOLLY_MASSIMO),
    motivi,
  };
}
