/**
 * ScuoleRadar.it — L'ESITO E LA RIGA DELLA BACHECA (modulo PURO, §26.106 → §26.144).
 *
 * Estratto da `lib/bachecaInterpelli` il 31/10/2026 (il file era oltre il tetto di 250 righe
 * del gate strutturale) con il nome «riga di ripiego». Dalla direttiva del 04/11/2026 il
 * RIPIEGO NON ESISTE PIÙ come canale: la cascata generosa (`lib/cascataGenerosa`) fa entrare
 * tutto ciò che è geograficamente pertinente, quindi non c'è una scorta da pescare né righe
 * da spacciare per opportunità. Il nome del file resta — gli import e le guardie non
 * cambiano — ma qui vivono solo due cose:
 *
 *   · `EsitoBacheca` — la lista pronta per la dashboard e i CONTI per log e guardie
 *     (ogni scarto è dichiarato, nessuno è silenzioso);
 *   · `rigaInBacheca` — la forma della riga mostrata: voto, motivi, flag della scuola
 *     preferita, competenza del livello secondario (§26.63) e jolly semantico (§26.64).
 *
 * I campi `ripiego`/`livelloRipiego` restano nel modello (`data/interpelli`) perché le righe
 * già in database e la card li conoscono: nessuno li scrive più da qui.
 */
import type { Interpello } from '../data/interpelli';
import type { ValutazioneCompatibilita } from './compatibilitaGraduata';

/** Esito della pipeline: lista pronta per la dashboard + conti per log/guardie. */
export interface EsitoBacheca {
  lista: Interpello[];
  /** Righe di contorno scartate a monte: non sono avvisi (§26.65). */
  righeNonOpportunita: number;
  /**
   * Righe senza una scadenza dichiarata e valida: NON sono opportunità (§26.71) e
   * non entrano nel feed (pagine di archivio, regolamenti, indici di classi).
   */
  senzaScadenza: number;
  /** Avvisi scartati dalla blacklist scuole. */
  esclusiBlacklist: number;
  /** Avvisi inclusi d'ufficio dalla whitelist scuole. */
  forzate: number;
  /**
   * §26.144 — l'UNICO scarto di merito: incompatibilità semantica evidente (due temi
   * riconosciuti che non si toccano, es. Musica vs Spagnolo). Non è un punteggio basso:
   * è un'assenza di ponte, e la riga non entra né in bacheca né altrove.
   */
  senzaAffinitaClasse: number;
  /**
   * §26.144 — righe fuori dal PERIMETRO geografico (province scelte + raggio dei 60 km):
   * l'unico sbarramento rigido della bacheca. Contate, mai silenziose.
   */
  fuoriPerimetro: number;
  /**
   * §26.148 — righe SBARRATE dal TERZO gradino di ordine (infanzia ↔ secondaria di II grado,
   * nei due sensi): non sono un voto basso, sono un altro mestiere, e non entrano in bacheca.
   * Contate, mai silenziose — è la differenza fra «filtrata» e «sparita».
   */
  esclusiOrdineEstremo: number;
  /**
   * Righe scartate perché parlano di sostegno senza dichiarare un RECLUTAMENTO
   * (§26.131: «piano di sostegno didattico», «progetto sostegno»). Il terzo stato del
   * classificatore non è una cattedra: non entra in bacheca.
   */
  sostegnoAmbiguoScartato: number;
  /** §26.144 — righe entrate per MERITO: sostegno/ATA nell'ordine scelto, classe ≥ 85. */
  meritoInBacheca: number;
  /** §26.144 — righe entrate per TOLLERANZA: grado affine o ponte disciplinare. */
  tolleranzaInBacheca: number;
  /** §26.144 — righe entrate di RISERVA: sostegno/ATA d'altro ordine, classe non riconosciuta. */
  riserveInBacheca: number;
  /**
   * §26.145 — righe in bacheca che la DISTANZA DAL PROFILO ha portato sotto la soglia del
   * fondo (`SOGLIA_FONDO_CONVENTO`): restano — sono nella zona dell'utente — ma la card le
   * dichiara «Fondo Convento / Ripiego». Contate, non nascoste.
   */
  fondoInBacheca: number;
}

/** Avviso minimo per le modali, derivato dall'interpello della bacheca. */
export function avvisoDaInterpello(i: Interpello) {
  return {
    province: i.provinciaCodice,
    classi: i.classiCodes,
    materia: i.materia,
    titolo: i.titolo,
    ordine: i.ordine,
  };
}

/**
 * RIGA DI BACHECA (§26.63 · §26.64 · §26.144): il voto, i motivi e ciò che la card dichiara.
 *
 * `motivoInPiu` è la dichiarazione della CASCATA («sostegno / alternativa alla Religione:
 * entra d'ufficio…», «tolleranza ampia: area affine…»): finisce accanto agli altri motivi,
 * così la card non spaccia mai una riserva per un match. `motivi` sostituisce i motivi del
 * motore quando quel verdetto non vale più per la bacheca (un'esclusione superata dalla
 * cascata non va raccontata nel tooltip).
 */
export function rigaInBacheca(
  i: Interpello,
  valutazione: ValutazioneCompatibilita,
  opts: {
    punteggio: number;
    scuolaPreferita: boolean;
    motivoInPiu?: string;
    /** Motivi al posto di quelli del motore (`undefined` = quelli del motore). */
    motivi?: readonly string[];
  },
): Interpello {
  const motivi = opts.motivi ?? valutazione.motivi;
  return {
    ...i,
    compatibilita: opts.punteggio,
    motivoCompatibilita:
      [...motivi, opts.motivoInPiu].filter((m): m is string => Boolean(m)).join(' · ') ||
      undefined,
    scuolaPreferita: opts.scuolaPreferita,
    // LIVELLO SECONDARIO (§26.63): la competenza che ha SFUMATO il punteggio.
    competenzaSecondaria: valutazione.competenzaSecondaria?.etichetta ?? null,
    // JOLLY SEMANTICO (§26.64): la competenza riconosciuta PER INTERO.
    jollySemantico: valutazione.jollySemantico,
  };
}
