/**
 * ScuoleRadar.it — LA RIGA DI RIPIEGO DELLA BACHECA (modulo PURO, §26.106 · §26.125).
 *
 * Estratto da `lib/bachecaInterpelli` il 31/10/2026 (il file era oltre il tetto di
 * 250 righe del gate strutturale): qui vive ciò che riguarda il RIPIEGO — la forma
 * del risultato della pipeline (`EsitoBacheca`, conti per log e guardie) e il
 * costruttore della riga che il paracadute «5 osso-da-mordere» porta in vetrina.
 *
 * `bachecaInterpelli` li importa e riesporta il tipo: gli import esistenti non
 * cambiano. Il GRADINO (`livelloRipiego`, §26.125) arriva dalla scala
 * `lib/scalaParacadute` e serve solo all'ordine e alla diagnostica — non è copy:
 * la card continua a dichiarare `ETICHETTA_RIPIEGO` per ogni ripiego.
 */
import type { Interpello, LivelloRipiego } from '../data/interpelli';
import type { ValutazioneCompatibilita } from './compatibilitaGraduata';
import { riempitivoNonPertinente } from './riempitivi';

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
  /** Riempitivi NON pertinenti esclusi a monte (§26.60: nessun cap, nessuna quota). */
  riempitiviEsclusi: number;
  /** Riempitivi tolti dal cap dinamico. */
  riempitiviNascosti: number;
  /** Righe scartate perché la classe non ha rapporto con le proprie (§26.120):
   *  fuori dalla bacheca e fuori dalla scorta del paracadute. */
  senzaAffinitaClasse: number;
  /**
   * Righe scartate dal DIVIETO della scala (§26.125): sostegno o alternativa alla
   * Religione in una provincia che l'utente non ha scelto. Non è una priorità, è
   * un'esclusione — nemmeno il paracadute le ripesca.
   */
  sostegnoFuoriProvincia: number;
  /**
   * Righe scartate perché parlano di sostegno senza dichiarare un RECLUTAMENTO
   * (§26.131: «piano di sostegno didattico», «progetto sostegno», «misure di
   * sostegno agli alunni»). Il terzo stato del classificatore non è una cattedra:
   * non entra in bacheca e non entra nella scorta. Lo scarto è contato, mai silenzioso.
   */
  sostegnoAmbiguoScartato: number;
  /**
   * Righe entrate con il PARACADUTE «5 osso-da-mordere» (§26.106): la vetrina era sotto
   * `MINIMO_BACHECA` e la coda è stata completata dalla scorta. Sono dichiarate `ripiego`.
   */
  ripieghiInBacheca: number;
  /**
   * §26.141 — righe in bacheca grazie a un GRADO AFFINE (82 · 72), non a un match:
   * la materia o l'ordine di scuola si toccano, la classe di concorso no. Sono
   * dichiarate nel `motivoCompatibilita` («grado affine: …»), mai spacciate per match.
   */
  affiniInBacheca: number;
  /**
   * §26.141 — voci del SERBATOIO DI DEFAULT (personale ATA 52 · sostegno di un altro
   * ordine 58) messe nella SOLA scorta: entrano in vetrina solo con il paracadute,
   * marcate `ripiego`. Contate a parte, mai silenziose.
   */
  serbatoioInScorta: number;
}


/** Candidato di RIPIEGO (§26.106): opportunità vera non agganciata dal Radar, marcata `ripiego`. */
export function candidatoRipiego(
  i: Interpello,
  valutazione: ValutazioneCompatibilita,
  livello: LivelloRipiego,
): Interpello {
  return {
    ...i,
    compatibilita: valutazione.punteggio,
    motivoCompatibilita: valutazione.motivi.join(' · ') || undefined,
    ripiego: true,
    // §26.125 — il gradino con cui la riga è entrata: decide l'ORDINE della scorta.
    livelloRipiego: livello,
  };
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
 * RIGA DI BACHECA (§26.63 · §26.64 · §26.141): il voto, i motivi e ciò che la card
 * dichiara. Estratta da `bachecaInterpelli` per rispettare il tetto di 250 righe del
 * gate strutturale: il cablaggio resta uno solo e la forma della riga vive qui.
 *
 * `motivoInPiu` è il gradino quando la riga entra per GRADO AFFINE («grado affine: …»):
 * finisce accanto agli altri motivi, così la card non spaccia mai un ponte per un match.
 */
export function rigaInBacheca(
  i: Interpello,
  valutazione: ValutazioneCompatibilita,
  opts: { punteggio: number; scuolaPreferita: boolean; motivoInPiu?: string },
): Interpello {
  return {
    ...i,
    compatibilita: opts.punteggio,
    motivoCompatibilita:
      [...valutazione.motivi, opts.motivoInPiu].filter((m): m is string => Boolean(m)).join(' · ') ||
      undefined,
    scuolaPreferita: opts.scuolaPreferita,
    // LIVELLO SECONDARIO (§26.63): la competenza che ha SFUMATO il punteggio.
    competenzaSecondaria: valutazione.competenzaSecondaria?.etichetta ?? null,
    // JOLLY SEMANTICO (§26.64): la competenza riconosciuta PER INTERO.
    jollySemantico: valutazione.jollySemantico,
  };
}

/**
 * RIGA DI SERBATOIO (§26.141): la voce di paracadute (ATA 52 · sostegno 58) entra
 * nella SOLA scorta, sempre `ripiego` e al gradino `ultima-spiaggia`. Il punteggio
 * del serbatoio sostituisce quello del motore, il motivo lo dichiara.
 */
export function candidatoSerbatoio(
  i: Interpello,
  valutazione: ValutazioneCompatibilita,
  voce: { punteggio: number; etichetta: string },
): Interpello {
  return candidatoRipiego(
    i,
    {
      ...valutazione,
      punteggio: voce.punteggio,
      motivi: [voce.etichetta, ...valutazione.motivi],
    },
    'ultima-spiaggia',
  );
}

/** Dove finisce una riga dopo la valutazione: in bacheca, in scorta o fuori. */
export type EsitoRiga =
  | { esito: 'fuori' }
  | { esito: 'scorta'; riga: Interpello }
  | { esito: 'bacheca'; riga: Interpello; affine: boolean };

/**
 * DECISIONE DI UNA RIGA (§26.60 · §26.106 · §26.141), in un solo posto.
 *
 * Ordine dei giudizi — quello della pipeline, nessuna eccezione nascosta:
 *   1. **serbatoio** (§26.141): ATA/sostegno d'altro ordine → SOLA scorta, sempre;
 *   2. **escluso** (§26.120): fuori raggio o sostegno respinto dal motore → fuori;
 *   3. **pavimento del grado affine** (§26.141): il voto è almeno quello del ponte;
 *   4. punteggio `0` = nessuna modale applicabile → la riga resta com'è dal DB;
 *   5. **riempitivo non pertinente** (§26.60) → scorta, col gradino della scala;
 *   6. altrimenti in bacheca, col motivo del grado quando c'è.
 */
export function esitoRiga(
  i: Interpello,
  valutazione: ValutazioneCompatibilita,
  ctx: {
    /** Pavimento del grado affine (82 · 76 · 72 · 70) o `null`. */
    punteggioGrado: number | null;
    /** Etichetta del grado affine, scritta nel motivo della card. */
    gradoEtichetta?: string;
    /** Voce del serbatoio di default (`null` = non è un paracadute). */
    serbatoio: { punteggio: number; etichetta: string } | null;
    /** Pertinenza PRIMARIA della riga (motore o jolly, §26.63). */
    pertinente: boolean;
    /** Whitelist scuole (Modalità 5): inclusione d'ufficio. */
    forzata: boolean;
    /** Gradino della scala del paracadute (§26.125). */
    livelloScala: LivelloRipiego;
  },
): EsitoRiga {
  if (ctx.serbatoio !== null) {
    return { esito: 'scorta', riga: candidatoSerbatoio(i, valutazione, ctx.serbatoio) };
  }
  if (valutazione.escluso) return { esito: 'fuori' };
  const punteggio = Math.max(valutazione.punteggio, ctx.punteggioGrado ?? 0);
  if (punteggio === 0) return { esito: 'bacheca', riga: i, affine: false };
  const riempitivo = riempitivoNonPertinente(
    { compatibilita: punteggio },
    { pertinente: ctx.pertinente, forzata: ctx.forzata },
  );
  if (riempitivo) {
    return { esito: 'scorta', riga: candidatoRipiego(i, { ...valutazione, punteggio }, ctx.livelloScala) };
  }
  return {
    esito: 'bacheca',
    riga: rigaInBacheca(i, valutazione, {
      punteggio,
      scuolaPreferita: ctx.forzata,
      motivoInPiu: ctx.gradoEtichetta,
    }),
    // §26.141 — `affine` = la riga è in bacheca DOVE IL GRADO È STATO DECISIVO: il grado
    // esiste solo quando la classe non fa match (§26.120), quindi senza di lui la riga non
    // avrebbe né la porta d'ingresso né il pavimento. Misurato su AT il 04/11/2026: due
    // righe senza classe a 78 (motore) sarebbero uscite; il conto le dichiara affini.
    affine: ctx.gradoEtichetta !== undefined,
  };
}
