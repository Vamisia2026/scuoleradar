/**
 * ScuoleRadar.it — IL JOLLY SEMANTICO DELLA MODALITÀ 3 (§26.64), modulo PURO.
 *
 * «In cosa puoi lavorare oltre la classe» non è un filtro: è un INTERESSE dichiarato. Il
 * jolly semantico lo interpreta in modo ASIMMETRICO — verso l'alto è un acceleratore, verso
 * il basso non toglie nulla:
 *
 *   · MATCH PIENO (`grado = 'esatta'`: tutti i token significativi della competenza sono nel
 *     testo dell'avviso)
 *       → PUNTEGGIO D'ECCELLENZA garantito: `PUNTEGGIO_JOLLY_PIENO` (90) fa da PAVIMENTO al
 *         voto delle preferenze primarie, mai da sostituto: se le preferenze valgono di più,
 *         resta il loro valore (un match pieno non declassa nulla);
 *       → i VINCOLI GEOGRAFICI SECONDARI (il raggio dei 60 km, Modalità 4) non escludono più
 *         l'avviso: oltre il raggio entra D'UFFICIO al pavimento `PUNTEGGIO_JOLLY_OLTRE_RAGGIO`
 *         (60 — lo stesso dell'inclusione d'ufficio dell'area sostegno, §26.45). La geografia
 *         resta sovrana sul GRADO del match, non sull'inclusione;
 *   · MATCH PARZIALE (`vicina` | `riconducibile`)
 *       → BONUS PROPORZIONALE al grado misurato, dentro `BONUS_JOLLY_PARZIALE` (15): si somma
 *         al voto primario come la sfumatura della §26.63, con un tetto più stretto. Nessun
 *         pavimento e nessun bypass: un match parziale non apre e non scavalca niente;
 *   · NESSUN MATCH (`punteggio 0` dal rilevatore)
 *       → zero punti e ZERO PENALIZZAZIONI: il voto resta esattamente quello delle preferenze.
 *         Non trovare la competenza non è un demerito.
 *
 * SOSPENSIONI — il jolly NON interviene e vale la §26.63:
 *   · `forzata` (§26.45/§26.62): la scuola preferita ha già la sua inclusione d'ufficio, col
 *     voto delle preferenze e la sua sfumatura: il jolly non la tocca;
 *   · `tettoMotore` (§26.63): profilo senza classi di concorso → il verdetto del motore sul
 *     livello secondario resta il tetto del punteggio mostrato;
 *   · `sostegno` (§26.45): il pavimento dell'inclusione d'ufficio dell'area sostegno non si
 *     sconta con un secondo pavimento: resta 60 e il jolly tace.
 *
 * CHI FA COSA. Il GRADO e i PUNTI del match li misura `punteggioCompetenze.ts` (§26.63): qui
 * non si rilegge il testo, si INTERPRETA una rilevazione già fatta — una sola verità, due
 * decisioni. Guardie: `npm run test:jolly` (+ `test:scoring`, `test:compatibilita:graduata`).
 */
import type { EsitoProvincia } from './prossimitaGeografica';
import {
  punteggioCompetenze,
  type AvvisoCompetenze,
  type EsitoCompetenze,
  type ProfiloCompetenze,
} from './punteggioCompetenze';

/** Pavimento d'ECCELLENZA di un match PIENO nelle proprie province (sopra la soglia verde). */
export const PUNTEGGIO_JOLLY_PIENO = 90;
/** Pavimento d'inclusione d'ufficio di un match PIENO oltre il raggio (§26.45, come il sostegno). */
export const PUNTEGGIO_JOLLY_OLTRE_RAGGIO = 60;
/** Tetto del bonus di un match PARZIALE: più stretto della sfumatura della §26.63. */
export const BONUS_JOLLY_PARZIALE = 15;

/** Fascia del jolly: pieno (pavimento/bypass) · parziale (bonus) · assente (niente da dire). */
export type FasciaJolly = 'pieno' | 'parziale' | 'assente';

/** Esito del jolly: cosa fa — e quanto vale — la competenza trovata nell'avviso. */
export interface EsitoJollySemantico {
  fascia: FasciaJolly;
  /** Punteggio d'ufficio del match PIENO (`null` = nessun pavimento: parziale o assente). */
  punteggio: number | null;
  /** true = match PIENO oltre il raggio: l'esclusione geografica secondaria è scavalcata. */
  bypassRaggio: boolean;
  /** Bonus del match PARZIALE, dentro `BONUS_JOLLY_PARZIALE` (0 = niente da aggiungere). */
  bonus: number;
  /** Competenza del profilo riconosciuta (`null` = nessuna: fascia assente). */
  etichetta: string | null;
  /** Punti misurati dalla §26.63: base del bonus proporzionale. */
  punti: number;
  /** Riga leggibile (tooltip della card + sintesi del motivo). */
  motivo: string | null;
}

/** Contesto del jolly: la geografia già giudicata e le tre sospensioni. */
export interface ContestoJolly {
  /** Stato geografico dell'avviso (`punteggioProvincia`, `src/lib/prossimitaGeografica.ts`). */
  statoGeo: EsitoProvincia['stato'];
  /** Whitelist (Modalità 5) o consegna: l'inclusione d'ufficio vince sul jolly. */
  forzata?: boolean;
  /** Profilo senza classi: il verdetto del motore (§26.63) resta il tetto del punteggio. */
  tettoMotore?: boolean;
  /** Area sostegno fuori dalle proprie classi: il pavimento del sostegno non si sconta (§26.45). */
  sostegno?: boolean;
}

/** Nessuna azione del jolly: zero punti, zero penalizzazioni. */
const NIENTE: EsitoJollySemantico = {
  fascia: 'assente',
  punteggio: null,
  bypassRaggio: false,
  bonus: 0,
  etichetta: null,
  punti: 0,
  motivo: null,
};

/**
 * Interpreta la rilevazione del livello secondario (§26.63) come jolly semantico (§26.64):
 * `grado = 'esatta'` → match PIENO (pavimento d'eccellenza; oltre il raggio, inclusione
 * d'ufficio al pavimento), `vicina` | `riconducibile` → match PARZIALE (bonus proporzionale),
 * nessuna competenza trovata o rilevazione SOSPESA → niente da dire.
 */
export function esitoJollySemantico(
  profilo: ProfiloCompetenze,
  avviso: AvvisoCompetenze,
  contesto: ContestoJolly,
): EsitoJollySemantico {
  if (contesto.forzata === true || contesto.tettoMotore === true || contesto.sostegno === true) {
    return NIENTE;
  }
  const rilevato = punteggioCompetenze(profilo, avviso);
  const etichetta = rilevato.competenza;
  if (!etichetta || rilevato.punteggio <= 0) return NIENTE;

  if (rilevato.grado === 'esatta') {
    // MATCH PIENO: oltre il raggio l'inclusione è d'ufficio (la geografia secondaria non
    // esclude più); dentro il raggio il pavimento d'eccellenza accompagna il voto primario.
    const oltre = contesto.statoGeo === 'fuori';
    const punteggio = oltre ? PUNTEGGIO_JOLLY_OLTRE_RAGGIO : PUNTEGGIO_JOLLY_PIENO;
    return {
      fascia: 'pieno',
      punteggio,
      bypassRaggio: oltre,
      bonus: 0,
      etichetta,
      punti: rilevato.punteggio,
      motivo: oltre
        ? `interesse pieno (Modalità 3): «${etichetta}» fuori dalle tue province → inclusione d'ufficio al ${punteggio}%`
        : `interesse pieno (Modalità 3): «${etichetta}» → punteggio d'eccellenza (almeno ${punteggio}%)`,
    };
  }

  // MATCH PARZIALE: bonus proporzionale al grado misurato, dentro il tetto del jolly.
  const bonus = Math.min(BONUS_JOLLY_PARZIALE, rilevato.punteggio);
  return {
    fascia: 'parziale',
    punteggio: null,
    bypassRaggio: false,
    bonus,
    etichetta,
    punti: rilevato.punteggio,
    motivo: `interesse parziale (Modalità 3): «${etichetta}» → +${bonus} punti`,
  };
}

/**
 * Applica il jolly alla somma dei DUE LIVELLI (§26.64), senza rileggere il testo — la misura
 * resta della §26.63. Il match PIENO dentro le proprie province FA DA PAVIMENTO al voto
 * (mai una decurtazione); oltre il raggio invece il voto È quello d'inclusione
 * (`PUNTEGGIO_JOLLY_OLTRE_RAGGIO`, 60): l'ingresso d'ufficio non deve mostrarsi come un 100%
 * a chi l'avviso ce l'ha a 200 km — la distanza resta dichiarata nel numero. Il match PARZIALE
 * stringe il tetto del contributo delle competenze (`BONUS_JOLLY_PARZIALE`, 15), l'assenza
 * restituisce la somma intatta: zero punti, zero penalizzazioni. Una sola espressione, una
 * sola verità: la usano l'aggregatore e le guardie.
 */
export function punteggioConJolly(
  esito: EsitoJollySemantico,
  base: number,
  secondario: number,
): number {
  if (esito.fascia === 'pieno') {
    if (esito.bypassRaggio) return PUNTEGGIO_JOLLY_OLTRE_RAGGIO;
    return Math.max(secondario, esito.punteggio ?? PUNTEGGIO_JOLLY_PIENO);
  }
  if (esito.fascia === 'parziale') return Math.min(secondario, base + esito.bonus);
  return secondario;
}

/**
 * Riga leggibile del jolly per i motivi del punteggio (`[]` = il jolly non ha agito: parla la
 * §26.63). Card, tooltip e guardie leggono la stessa frase.
 */
export function motivoJolly(esito: EsitoJollySemantico): string[] {
  return esito.motivo ? [esito.motivo] : [];
}

/** Cosa della §26.63 va dichiarato accanto al voto (`null` = parla il jolly, o nessuno). */
export interface PuntiSecondari {
  etichetta: string;
  punteggio: number;
}

/**
 * Il livello secondario DICHIARATO accanto al voto, con una sola verità per card e dettaglio:
 * col match PIENO parla la riga del jolly (qui `null`); col PARZIALE il badge porta il bonus
 * DAVVERO applicato (`BONUS_JOLLY_PARZIALE`), non il grado più alto misurato dalla §26.63 —
 * altrimenti dichiarerebbe punti che il voto non ha ricevuto; senza jolly resta la sfumatura
 * classica delle competenze.
 */
export function secondarioDaDichiarare(
  jolly: EsitoJollySemantico,
  competenze: EsitoCompetenze,
): PuntiSecondari | null {
  if (jolly.fascia === 'pieno') return null;
  if (jolly.fascia === 'parziale' && jolly.etichetta) {
    return { etichetta: jolly.etichetta, punteggio: jolly.bonus };
  }
  if (competenze.punteggio <= 0 || !competenze.competenza) return null;
  return { etichetta: competenze.competenza, punteggio: competenze.punteggio };
}
