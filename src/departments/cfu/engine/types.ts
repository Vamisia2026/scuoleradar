/**
 * ScuoleRadar.it — Dipartimento CFU · Motore di calcolo (engine).
 *
 * Modello dati condiviso dai 5 moduli isolati del motore:
 *  - documentParser     → estrazione OCR → Fascicolo Accademico Canonico;
 *  - normalizer         → normalizzazione SSD/GSD e titoli (mai su dati grezzi);
 *  - normativeResolver  → risoluzione temporale decreto/tabella in vigore;
 *  - requirementSolver  → constraint solver sui vincoli CFU (AUTORITÀ del verdetto);
 *  - reportEngine       → outcome strutturato, Audit Trail, orientamento.
 *
 * NOTA DI ARCHITETTURA (fase 3 — foglia dei tipi; fase 4 — autorità interna):
 * il vocabolario di esito/audit e i record canonici vivono nel modulo foglia
 * `pipeline/resultTypes.ts` (che non importa nulla) per rendere
 * `RisultatoPipelineBase` e `MetadatiPipeline` utilizzabili QUI senza cicli di
 * import. Le dichiarazioni sono riesportate, quindi gli import storici del
 * motore restano validi.
 *
 * CONFINE DI AUTORITÀ (fase 4): `RisultatoPipeline.stato` è l'aggregazione
 * autorevole DENTRO la pipeline (regole R0-R10 in `pipeline/status.ts`); il
 * verdetto usato da bridge, routing, report e UI resta quello del decisore
 * aggregato legacy `valutaRequisitoClasse` (`RisultatoPipeline.statoSolutore`).
 */
import type {
  DecretoNormativo,
  EsitoValutazione,
  EsameCanonico,
  GsdCode,
  IntegrabilitaStatus,
  NormativaApplicata,
  Provenienza,
  SsdCode,
  StatoContestoNormativa,
  TabellaNormativa,
  TitoloAccademicoCanonico,
  VoceAudit,
} from './pipeline/resultTypes';

export type {
  DateRilevanza,
  DecretoNormativo,
  EsameCanonico,
  EsitoValutazione,
  FaseAudit,
  FonteEsame,
  GsdCode,
  IntegrabilitaStatus,
  NaturaRequisitoAggregato,
  NormativaApplicata,
  Provenienza,
  RiferimentoDocumento,
  SsdCode,
  StatoContestoNormativa,
  StatoDato,
  TabellaNormativa,
  TipoAudit,
  TitoloAccademicoCanonico,
  VoceAudit,
} from './pipeline/resultTypes';
export type {
  AmbiguitaIdentita,
  ConservazioneDocumento,
  DiscrepanzaDato,
  DossierAccademico,
  DocumentoCaricato,
  EsitoEstrazioneDocumento,
  TipoDocumento,
  ValoreInDiscrepanza,
} from './pipeline/dossierTypes';
export type { MetadatiPipeline, RisultatoPipelineBase } from './pipeline/requirementTypes';
import type { MetadatiPipeline, RisultatoPipelineBase } from './pipeline/requirementTypes';

/**
 * RISULTATO DELLA PIPELINE UNIVERSALE — vista completa per il motore:
 * specializza il modello foglia con lo snapshot del decisore normativo
 * aggregato (`valutazioneClasse`), che resta l'AUTORITÀ per i consumatori legacy
 * (bridge, routing, report, UI). Il campo `stato` è l'aggregazione autorevole
 * DENTRO la pipeline (R0-R10 di `pipeline/status.ts`).
 */
export type RisultatoPipeline = RisultatoPipelineBase<ValutazioneRequisito>;

/* ------------------------------ 3. Academic Record ------------------------------ */

/** Fascicolo accademico canonico prodotto dal documentParser. */
export interface FascicoloAccademicoCanonico {
  documentId: string;
  esami: EsameCanonico[];
  titolo?: TitoloAccademicoCanonico | null;
  pagineAnalizzate: number;
  /** Data (ISO) di estrazione. */
  estrattoIl: string;
}

/* ------------------------------ 4. Normativa ------------------------------ */
/*
 * `DecretoNormativo`, `TabellaNormativa`, `NormativaApplicata`, `DateRilevanza`
 * e `StatoContestoNormativa` sono nel modulo foglia `pipeline/resultTypes.ts`
 * (riesportati sopra): il vocabolario è condiviso con la pipeline universale.
 */

/* ------------------------------ 5. Requisiti ------------------------------ */

/**
 * Vincolo CFU (constraint) con supporto a singoli SSD, gruppi (inclusi i
 * PREFIX PATTERN macro di area CUN, es. "L-FIL-LET/"), disgiunzioni esplicite
 * ("OR" formale) e distribuzioni strutturate.
 *
 * Nota di modellazione PREFIX WILDCARD: gli elementi dell'array `ssd` di un
 * vincolo 'gruppoSsd' (o di una `opzione.ssd` di una disgiunzione) possono
 * essere un codice SSD esatto (es. "L-LIN/01") OPPURE un prefisso macro
 * registrato nella tassonomia CUN (es. "L-FIL-LET/"), che copre ogni codice
 * che inizia con quel prefisso. Nessuna enumerazione manuale di sottocodici è
 * richiesta (e non è ammessa): il match è risolto da engine/ssdTaxonomy.
 */
export type VincoloCfu =
  | {
      id: string;
      tipo: 'singoloSsd';
      ssd: SsdCode;
      min: number;
      max?: number;
      nota?: string;
      /** Frase/periodo atomico della fonte che giustifica QUESTO vincolo. */
      sourceExcerpt: string;
      /** Posizione nella fonte (es. "Tavola A — riga A-11 — Nota 1"). */
      sourceLocation: string;
    }
  | {
      id: string;
      tipo: 'gruppoSsd';
      /**
       * Requisiti disciplinari: codici SSD esatti E/O prefissi macro CUN
       * (terminanti con "/", es. "L-FIL-LET/"). Il solver somma i crediti in
       * UNIONE (nessun doppio conteggio tra requisiti sovrapposti).
       */
      ssd: SsdCode[];
      /** Crediti richiesti complessivamente nel gruppo. */
      min: number;
      /** Minimo richiesto in ciascun SSD del gruppo (note di distribuzione). */
      minPerSsd?: number;
      /**
       * Minimo richiesto in ALMENO UNO degli SSD del gruppo (es. "12 CFU in
       * L-ANT/02 oppure L-ANT/03"). Se presente, il solver verifica il
       * miglior SSD singolo del gruppo.
       */
      minUnoDeiSsd?: number;
      max?: number;
      distribuzione?: string;
      sourceExcerpt: string;
      sourceLocation: string;
    }
  | {
      id: string;
      tipo: 'disgiunzioneSsd';
      /**
       * DISGIUNZIONE ESPLICITA (EXPLICIT_OR_CONDITION): il vincolo è soddisfatto
       * se ALMENO UNA opzione raggiunge il proprio minimo. Le opzioni sono
       * alternative — i crediti NON si sommano tra opzioni (es. "12 CFU in
       * L-ANT/02 O L-ANT/03" NON è soddisfatto da 6+6).
       */
      opzioni: {
        id: string;
        /** Codici esatti e/o prefissi macro CUN dell'opzione (unione interna). */
        ssd: SsdCode[];
        /** Crediti minimi che l'opzione deve raggiungere singolarmente. */
        min: number;
        nota?: string;
      }[];
      /** Frase formale esposta nell'audit (es. "At least 12 CFU required in EITHER L-ANT/02 OR L-ANT/03"). */
      disgiunzioneEsplicita: string;
      sourceExcerpt: string;
      sourceLocation: string;
    }
  | {
      id: string;
      tipo: 'titoloAbilitante';
      denominazione: string;
      /** True = vincolo duro: senza questo titolo la classe è irraggiungibile. */
      necessario: boolean;
      alternativoA?: SsdCode[];
      sourceExcerpt: string;
      sourceLocation: string;
    };

/** Requisito completo di una classe di concorso (tabella, note, vincoli). */
export interface RequisitoClasse {
  codice: string;
  denominazione: string;
  tabella: TabellaNormativa;
  nota?: string;
  vincoli: VincoloCfu[];
  /** Classi di laurea (nuovo ordinamento) ammesse in ingresso. */
  classiLaureaAmmesse?: string[];
  decreto: DecretoNormativo;
}

/* ------------------------------ 6. Valutazione ------------------------------ */

export interface EsitoVincolo {
  vincoloId: string;
  tipo: 'singoloSsd' | 'gruppoSsd' | 'disgiunzioneSsd' | 'titoloAbilitante';
  soddisfatto: boolean;
  cfuPosseduti: number;
  cfuMancanti: number;
  dettaglio?: string;
  /** Esami che hanno contribuito (provenienza page/line). */
  contributi: Provenienza[];
}

/** Valutazione di un singolo requisito/classe. */
export interface ValutazioneRequisito {
  codiceClasse: string;
  stato: EsitoValutazione;
  esitiVincoli: EsitoVincolo[];
  cfuMancantiTotali: number;
  motivazione?: string;
  normativa?: NormativaApplicata | null;
  /** Id delle regole normative esplicite che hanno sostenuto la valutazione. */
  regoleApplicate?: string[];
  audit: VoceAudit[];
}

/* ------------------------------ 7. Audit Trail ------------------------------ */
/*
 * `FaseAudit`, `TipoAudit` e `VoceAudit` sono nel modulo foglia
 * `pipeline/resultTypes.ts` (riesportati sopra): la pipeline universale usa lo
 * STESSO formato di audit del motore, senza nuovi modelli.
 */


/* ------------------------------ 8. Career & What-If ------------------------------ */

export interface PassoWhatIf {
  vincoloId?: string;
  ssd?: SsdCode | null;
  gruppo?: SsdCode[] | null;
  cfuConsigliati: number;
  nota?: string;
}

/** Percorso "What If": crediti minimi per sbloccare la classe obiettivo. */
export interface PercorsoWhatIf {
  classeObiettivo: string;
  cfuMinimiDaAggiungere: number;
  passi: PassoWhatIf[];
  classiSbloccabili: string[];
}

/** Crediti eccedenti riallocabili verso percorsi alternativi. */
export interface RiallocazioneProposta {
  da: string;
  a: string;
  cfu: number;
  nota?: string;
}

export interface SuggerimentoRiallocazione {
  cfuEccedentiRiallocabili: number;
  proposte: RiallocazioneProposta[];
}

/* ------------------------------ 9. Titoli esteri (MUR) ------------------------------ */

export interface ProfiloTitoloEstero {
  titolo: TitoloAccademicoCanonico;
  paese: string;
  haTraduzioneGiurata?: boolean;
  haDichiarazioneDiValore?: boolean;
  haAttestatoComparabilita?: boolean;
  dataRilascio?: string | null;
}

export interface GuidaRiconoscimentoMUR {
  richiesto: boolean;
  ente: 'MUR' | 'Università' | 'Scuola (USR)';
  passi: string[];
  documenti: string[];
}

export interface EsitoTitoloEstero {
  stato:
    | 'RICONOSCIMENTO_MUR_RICHIESTO'
    | 'CONFRONTO_SSD_AMMISSIBILE'
    | 'DATI_INSUFFICIENTI';
  valutazioneParziale?: ValutazioneRequisito | null;
  guidaMUR: GuidaRiconoscimentoMUR;
  audit: VoceAudit[];
}

/* ------------------------------ 10. Report finale ------------------------------ */

/**
 * Esito di classe arricchito per il report (denominazione + what-if).
 *
 * Fase 3: la superficie di report espone anche i metadati strutturati della
 * pipeline universale (fonti, conflitti, esiti per requisito, deficit, payload).
 * Il verdetto resta però `stato` (autorità: `valutaRequisitoClasse`): il campo
 * candidato è `pipeline.stato` e non è usato dall'UI.
 */
export interface EsitoClasseReport extends ValutazioneRequisito, MetadatiPipeline {
  denominazioneClasse: string;
  percorsoWhatIf?: PercorsoWhatIf;
  /** Risultato completo della pipeline universale per questa classe. */
  pipeline?: RisultatoPipeline;
}

export interface ReportCarriera {
  id: string;
  generatoIl: string;
  /** Null quando il contesto temporale non è risolvibile dal database normativo. */
  normativa?: NormativaApplicata | null;
  statoNormativa: StatoContestoNormativa;
  esiti: EsitoClasseReport[];
  classiEligibili: string[];
  classiCondizionali: string[];
  percorsiWhatIf: PercorsoWhatIf[];
  suggerimentoRiallocazione: SuggerimentoRiallocazione;
  raccomandazioni: string[];
  auditTrail: VoceAudit[];
  esitoEstero?: EsitoTitoloEstero | null;
}


/* -------------------- 11. Database normativo (authoritative) -------------------- */

/** Finestra di vigenza di un decreto/tabella (fonte: database normativo ufficiale). */
export interface NormativaTemporalContext {
  id: string;
  decreto: DecretoNormativo;
  tabella: TabellaNormativa;
  /** Data ISO da cui la versione è in vigore. */
  validFrom: string;
  /** Data ISO di cessazione; null/assente = ancora in vigore. */
  validUntil?: string | null;
  /** Riferimento ufficiale (es. G.U. n. x). */
  fonte: string;
  dataAggiornamentoNormativa: string;
  note?: string;
}

export interface EsitoRisoluzioneNormativa {
  stato: StatoContestoNormativa;
  normativa?: NormativaApplicata | null;
  contesto?: NormativaTemporalContext | null;
  motivazione: string;
}

/** Stato dell'integrazione dei CFU mancanti: vocabolario foglia (vedi `pipeline/resultTypes`). */

/**
 * Regola normativa dichiarata: trasposizione FEDELE del testo di legge.
 * Il motore NON interpreta testi liberi: usa solo questi campi strutturati.
 * Una conclusione ELIGIBLE è valida solo se ogni requisito risale a una di
 * queste regole (`id`, `fonte`, `dataAggiornamentoNormativa`).
 */
export interface NormativeRuleEntry {
  id: string;
  /** Percorso relativo del file raw in `sources/raw/` (obbligatorio, Source Gate). */
  rawSourceFilePath: string;
  /** SHA-256 (esadecimale) calcolato sull'INTERO file raw (Source Gate v2). */
  rawSourceSha256: string;
  /** Estratto verbatim copiato STRETTAMENTE dal raw file (mai parafrasato). */
  estrattoVerbatim: string;
  /** Stato di verifica della fonte: SOLO 'VERIFIED' può entrare nel DB attivo. */
  sourceStatus: 'UNVERIFIED' | 'VERIFIED';
  /** Identificativo della disposizione (es. "Tabella A — Nota 3"). */
  provisione: string;
  decreto: DecretoNormativo;
  tabella: TabellaNormativa;
  classeCodice: string;
  denominazioneClasse?: string;
  /** Riferimento esatto: articolo/tabella/nota/riga (es. "Tavola A — Nota 3 — riga A-11"). */
  articoloTabellaNota?: string;
  vincoli: VincoloCfu[];
  /** Classi di laurea ammesse SOLO se dichiarate espressamente dalla norma. */
  classiLaureaAmmesse?: string[];
  /**
   * Stato dell'integrazione dei CFU mancanti dichiarato dalla norma:
   *  - 'ALLOWED'     → la norma consente espressamente l'integrazione;
   *  - 'PROHIBITED'  → la norma la esclude espressamente (deficit → NOT_ELIGIBLE);
   *  - 'NOT_SPECIFIED' (o assente) → nessuna deduzione: verifica manuale.
   */
  integrabilita?: IntegrabilitaStatus;
  nota?: string;
  fonte: string;
  dataAggiornamentoNormativa: string;
}

/**
 * Mappatura SSD storico / GSD (es. DM 639/2024). NON equivale ad equivalenza
 * legale automatica: la mappatura è utilizzabile solo per la provisione
 * indicata in `applicabileAProvisioni` (se l'elenco è assente → non applicare).
 */
export interface SsdMappingRuleEntry {
  id: string;
  tipo: 'ssd-storico' | 'gsd-2024';
  da: SsdCode | GsdCode;
  a: SsdCode | GsdCode;
  applicabileAProvisioni?: string[];
  fonte: string;
  dataAggiornamentoNormativa: string;
}

/** Corrispondenza di classe di laurea (vecchio ordinamento), se dichiarata. */
export interface LegacyTitleMappingEntry {
  id: string;
  denominazioneContiene?: string;
  classe: string;
  classeLegacy?: string;
  fonte: string;
  dataAggiornamentoNormativa: string;
}

