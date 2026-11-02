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
