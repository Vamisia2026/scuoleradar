/**
 * ScuoleRadar.it — Dipartimento CFU · engine/pipeline/stageTypes.
 *
 * MODELLI DEGLI STADI DELLA PIPELINE UNIVERSALE — identificazione, risoluzione
 * delle fonti normative, normalizzazione accademica.
 *
 * Dipende SOLO dal modulo foglia `resultTypes` (nessun import dal motore):
 * può quindi essere importato da `engine/types.ts` senza cicli.
 */
import type {
  DateRilevanza,
  DecretoNormativo,
  EsameCanonico,
  NormativaApplicata,
  StatoContestoNormativa,
  TabellaNormativa,
  TitoloAccademicoCanonico,
  VoceAudit,
} from './resultTypes';

/* ============================ 1. Identificazione ============================ */

/** Sistema accademico di riferimento del titolo dichiarato dall'utente. */
export type SistemaAccademico = 'italiano' | 'estero' | 'non-dichiarato';

/** Chi viene valutato, per quale classe, con quali date e in quale sistema. */
export interface ContestoIdentificazione {
  readonly classeCodice: string;
  readonly denominazioneClasse: string | null;
  readonly titolo: TitoloAccademicoCanonico | null;
  /** Date rilevanti conservate integralmente (procedure/enrollment/awarded). */
  readonly dateRilevanza: DateRilevanza;
  readonly sistemaAccademico: SistemaAccademico;
  /** Dati di identificazione assenti: elencati, mai colmati a valle. */
  readonly datiMancanti: readonly string[];
}

/* ==================== 2. Risoluzione delle fonti normative ==================== */

/** Fonte autorevole con identità, versione e finestra di vigenza DICHIARATA. */
export interface RiferimentoFonte {
  /** Id della regola autorevole nel database normativo. */
  readonly sourceId: string;
  /** Riferimento ufficiale testuale (G.U., decreto, tabella, classe). */
  readonly fonte: string;
  readonly decreto: DecretoNormativo;
  readonly tabella: TabellaNormativa;
  readonly provisione: string | null;
  readonly articoloTabellaNota: string | null;
  readonly rawSourceFilePath: string | null;
  readonly rawSourceSha256: string | null;
  readonly dataAggiornamentoNormativa: string | null;
  /** Inizio vigenza dichiarato dal contesto normativo; null = non dichiarato. */
  readonly effectiveFrom: string | null;
  /** Fine vigenza dichiarata dal contesto normativo; null = non dichiarata. */
  readonly effectiveTo: string | null;
  /** Esito del Source Gate v2 (SHA-256 del file raw + citazioni atomiche). */
  readonly verificata: boolean;
  readonly problemi: readonly string[];
}

/** Finestra di vigenza dichiarata dalla fonte (null = non dichiarata). */
export interface FinestraVigenzaDichiarata {
  readonly validFrom: string;
  readonly validUntil: string | null;
}

/** Esito della risoluzione delle fonti applicabili alla valutazione. */
export interface RisoluzioneFonti {
  /** null = contesto non risolto: nessun giudizio normativo possibile. */
  readonly normativa: NormativaApplicata | null;
  readonly statoTemporale: StatoContestoNormativa;
  readonly motivazione: string;
  /**
   * True quando il contesto (decreto/tabella) è stato DICHIARATO dal chiamante
   * (es. bridge con registro non temporalizzato): la vigenza non è stata
   * risolta dal registro e resta `null`, senza inventare date.
   */
  readonly contestoDichiaratoDalChiamante: boolean;
  /** Finestra di vigenza del contesto risolto; null = non dichiarata. */
  readonly finestraVigenza: FinestraVigenzaDichiarata | null;
  readonly fonti: readonly RiferimentoFonte[];
  /** Id dei contesti di vigenza ammessi dalla data della procedura. */
  readonly contestiInVigore: readonly string[];
  /** Regole scartate in fase di risoluzione (es. Source Gate non superato). */
  readonly regoleEscluse: readonly { readonly regolaId: string; readonly motivo: string }[];
  readonly audit: readonly VoceAudit[];
}

/* ========================= 3. Normalizzazione accademica ========================= */

/** Legame fra dato utente e dato normalizzato (i dati grezzi sono immutati). */
export interface MappaturaDatoNormalizzato {
  readonly esameId: string;
  /** CFU come dichiarati dall'utente (immutati). */
  readonly cfuGrezzo: number;
  /** CFU normalizzato; null = non numerico/non valido (mai corretto d'ufficio). */
  readonly cfuNormalizzato: number | null;
  readonly ssdOrigine: string | null;
  readonly ssdCanonico: string | null;
  readonly gsd: string | null;
  readonly tipoCodice: 'ssd' | 'gsd' | 'non-classificato';
  readonly avvisi: readonly string[];
}

/** Dati accademici normalizzati (esami/titolo) + mappature + anomalie. */
export interface DatiAccademiciNormalizzati {
  readonly esami: readonly EsameCanonico[];
  readonly titolo: TitoloAccademicoCanonico | null;
  readonly mappature: readonly MappaturaDatoNormalizzato[];
  /** Somma dei soli CFU validi (mai incrementata con valori non validi). */
  readonly cfuTotali: number;
  /** True se almeno un CFU non è normalizzabile: i calcoli sono inaffidabili. */
  readonly cfuNonValidi: boolean;
  /** True se almeno un esame è privo di codice disciplinare riconosciuto. */
  readonly codiciMancanti: boolean;
  readonly anomalie: readonly string[];
}
