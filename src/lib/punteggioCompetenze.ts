/**
 * ScuoleRadar.it — LIVELLO SECONDARIO del punteggio: le competenze e le parole chiave
 * del profilo trovate nel testo dell'avviso («In cosa puoi lavorare oltre la classe»,
 * Modalità 3), modulo PURO.
 *
 * IL PUNTEGGIO HA DUE LIVELLI (§26.63):
 *
 *   1. **PRIMARIO (100%)** — le preferenze DICHIARATE: ordine di scuola, classi di
 *      concorso, provincia. È l'unico livello che FA il match, e vive altrove
 *      (`compatibilitaGraduata.ts`, media ponderata di `mediaModali.ts`);
 *   2. **SECONDARIO (max 25%)** — le competenze: `materie_id` del catalogo (anche
 *      inferite da PNRR/PON) e parole chiave libere (`materie_custom`). NON assegna il
 *      voto: sfuma quello del livello primario di al massimo `CAP_COMPETENZE` punti.
 *
 * L'OVERRIDE della Modalità 3 (90 parola chiave piena · 85 match vicino, §26.58) NON
 * esiste più: una competenza trovata non può da sola portare il voto al livello del
 * match, e nemmeno aprire la porta della bacheca — nessun avviso «in Radar» per una
 * parola chiave, nessun avviso di una classe lontana promosso da un tag.
 *
 * Gradi del match (il PIÙ FORTE vince):
 *   · `esatta`        → TUTTI i token significativi della competenza sono nel testo → 25;
 *   · `vicina`        → alcuni token (match semantico vicino)                        → 20;
 *   · `riconducibile` → stessa area disciplinare o ponte curato fra le aree          → 10.
 * Ogni corrispondenza AGGIUNTIVA vale `INCREMENTO_JOLLY` (3) punti in più, sempre DENTRO
 * il tetto: la sfumatura è DETERMINISTICA (dipende dalle corrispondenze trovate, non dal
 * caso) e quindi spiegabile all'utente e verificabile da una guardia. Se non c'è alcuna
 * corrispondenza il livello secondario non ha nulla da dire e non altera il punteggio.
 *
 * Il perimetro resta quello dichiarato: un match va provato dai TOKEN del testo o dalle
 * aree disciplinari, mai da un giudizio a caso. Nessuna provenienza speciale: competenze
 * di catalogo e parole chiave libere valgono allo stesso modo.
 */
import { areeDi, areeInComune, ponteTraAree } from './areeDisciplinari';
import { etichetteCompetenzeProfilo, tokenCompetenza } from './matchingEngine';

/**
 * TETTO del livello SECONDARIO (punti %): le competenze non pesano più di così. È lo
 * stesso numero del motore quando il profilo non ha classi (`PUNTEGGIO_MATCH_SECONDARIO`,
 * `matchingEngine.ts`): il secondo livello da solo non raggiunge mai il match pieno —
 * guardia `npm run test:scoring`.
 */
export const CAP_COMPETENZE = 25;
/** Competenza del profilo presente nell'avviso con TUTTI i suoi token significativi. */
export const PUNTEGGIO_COMPETENZA_ESATTA = CAP_COMPETENZE;
/** Competenza riconosciuta solo in parte (match semantico vicino). */
export const PUNTEGGIO_COMPETENZA_VICINA = 20;
/** Stessa area disciplinare o ponte curato fra le aree. */
export const PUNTEGGIO_COMPETENZA_RICONDUCIBILE = 10;
/** Punti aggiunti per ogni corrispondenza AGGIUNTIVA, sempre dentro `CAP_COMPETENZE`. */
export const INCREMENTO_JOLLY = 3;

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

/**
 * Esito del livello SECONDARIO (§26.63): punti sfumati, competenza riconosciuta, grado.
 * `punteggio: 0` = nessuna competenza del profilo nel testo: il livello secondario non ha
 * nulla da dire e non altera il voto del livello primario.
 */
export interface EsitoCompetenze {
  /**
   * Punti da aggiungere al punteggio del livello PRIMARIO (0 … `CAP_COMPETENZE`). Non è mai
   * un voto: è una sfumatura, misurata dal grado del match + `INCREMENTO_JOLLY` per ogni
   * corrispondenza aggiuntiva, sempre dentro il tetto.
   */
  punteggio: number;
  /** La competenza del profilo riconosciuta nell'avviso (`null` = nessuna). */
  competenza: string | null;
  /** Grado del match prevalente (`null` = nessuna corrispondenza). */
  grado: GradoCompetenza | null;
  /** Corrispondenze AGGIUNTIVE contate oltre la prevalente (0 = una sola). */
  incrementi: number;
  /** Motivi leggibili (competenza riconosciuta, ponte, conteggi, tetto). */
  motivi: string[];
}

/** Grado di un match fra una competenza del profilo e il testo dell'avviso. */
export type GradoCompetenza = 'esatta' | 'vicina' | 'riconducibile';

/** Match di UNA competenza del profilo col testo dell'avviso. */
interface MatchKeyword {
  keyword: string;
  grado: GradoCompetenza;
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
  const ordine: GradoCompetenza[] = ['esatta', 'vicina', 'riconducibile'];
  return [...matches].sort(
    (a, b) =>
      ordine.indexOf(a.grado) - ordine.indexOf(b.grado) || a.keyword.localeCompare(b.keyword),
  )[0];
}

/** Motivo leggibile del match (le altre corrispondenze restano nel conteggio). */
function motivoDi(match: MatchKeyword): string {
  if (match.grado === 'esatta') return `competenza: ${match.keyword}`;
  if (match.grado === 'vicina') {
    return `competenza vicina: «${match.keyword}» (${match.dettaglio})`;
  }
  return `competenza riconducibile: «${match.keyword}» (${match.dettaglio})`;
}

/** Punti del grado di un match (il tetto resta `CAP_COMPETENZE`). */
function punteggioGrado(grado: GradoCompetenza): number {
  if (grado === 'esatta') return PUNTEGGIO_COMPETENZA_ESATTA;
  if (grado === 'vicina') return PUNTEGGIO_COMPETENZA_VICINA;
  return PUNTEGGIO_COMPETENZA_RICONDUCIBILE;
}

/**
 * LIVELLO SECONDARIO (§26.63) di un avviso rispetto al profilo: `punteggio` = punti da
 * aggiungere al punteggio del livello PRIMARIO, sempre dentro `CAP_COMPETENZE`. Non assegna
 * mai il voto, che resta del livello primario (`valutaCompatibilita`, `compatibilitaGraduata.ts`).
 *
 * `punteggio: 0` = nessuna competenza/parola chiave del profilo compare nel testo: il livello
 * secondario non altera il voto. Altrimenti vale il grado del match PIÙ FORTE (`esatta` 25 ·
 * `vicina` 20 · `riconducibile` 10) più `INCREMENTO_JOLLY` per ogni corrispondenza AGGIUNTIVA,
 * con il tetto che resta fermo.
 */
export function punteggioCompetenze(
  profilo: ProfiloCompetenze,
  avviso: AvvisoCompetenze,
): EsitoCompetenze {
  const competenze = etichetteCompetenzeProfilo(profilo);
  const nessuno: EsitoCompetenze = {
    punteggio: 0,
    competenza: null,
    grado: null,
    incrementi: 0,
    motivi: [],
  };
  if (competenze.length === 0) return nessuno;
  const testoAvviso = `${avviso.materia ?? ''} ${avviso.titolo ?? ''}`;
  const tokenAvviso = new Set(tokenCompetenza(testoAvviso));
  const areeAvviso = areeDi(testoAvviso);
  const matches = competenze
    .map((k) => valutaKeyword(k, tokenAvviso, areeAvviso))
    .filter((m): m is MatchKeyword => m !== null);
  if (matches.length === 0) return nessuno;

  const prevalente = matchPrevalente(matches);
  // Ogni corrispondenza OLTRE la prevalente sfuma di `INCREMENTO_JOLLY` punti: il totale
  // resta DENTRO il tetto del livello secondario (mai una promozione arbitraria).
  const incrementi = matches.length - 1;
  const punteggio = Math.min(
    CAP_COMPETENZE,
    punteggioGrado(prevalente.grado) + incrementi * INCREMENTO_JOLLY,
  );
  const motivi = [
    motivoDi(prevalente),
    matches.length > 1 ? `${matches.length} competenze riconosciute` : null,
    `livello secondario: +${punteggio} punti (tetto ${CAP_COMPETENZE}%)`,
  ].filter((m): m is string => m !== null);

  return {
    punteggio,
    competenza: prevalente.keyword,
    grado: prevalente.grado,
    incrementi,
    motivi,
  };
}
