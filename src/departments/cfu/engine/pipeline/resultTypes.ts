/**
 * ScuoleRadar.it — Dipartimento CFU · engine/pipeline/resultTypes.
 *
 * MODULO FOGLIA (leaf) del motore CFU: vocabolario condiviso e record canonici.
 * NON importa nulla — nemmeno `engine/types.ts` — così può essere usato dal
 * motore, dalla pipeline e dalle superfici di routing/report senza dipendenze
 * circolari (vincolo `E-CICLO` del gate strutturale).
 *
 * Contenuto:
 *  §1 esito semantico (i 5 stati ufficiali)   §4 riferimenti normativi e date
 *  §2 provenienza documentale (page/line)     §5 audit trail
 *  §3 record accademici canonici              §6 stadi della pipeline (`stageTypes.ts`)
 *
 * Le dichiarazioni di questo modulo sono riesportate da `engine/types.ts`, quindi
 * gli import storici del motore continuano a funzionare: qui non cambia alcuna
 * forma, cambia solo la collocazione (necessaria a rompere il ciclo).
 */

/* --------------------------- §1 Esito semantico (5 stati) --------------------------- */

/** Sostituisce l'esito binario idoneo/non-idoneo con 5 stati valutativi. */
export type EsitoValutazione =
  | 'ELIGIBLE' // tutti i vincoli soddisfatti
  | 'CONDITIONALLY_ELIGIBLE' // ammissibile se si integrano X CFU (percorso what-if)
  | 'INSUFFICIENT_DATA' // dati mancanti per esprimere un giudizio
  | 'MANUAL_VERIFICATION_REQUIRED' // OCR/riconoscimento non affidabile: serve verifica
  | 'NOT_ELIGIBLE'; // vincolo duro non soddisfatto (titolo/requisito irrecuperabile)

/* ---------------------------- §2 Provenienza (page/line) ---------------------------- */

/** Riferimento fisico a un documento sorgente (pagina e riga). */
export interface RiferimentoDocumento {
  documentId: string;
  /** Numero pagina (1-based) nel documento caricato. */
  pagina: number;
  /** Numero riga (1-based) nella pagina, quando disponibile. */
  riga?: number;
  /** Testo grezzo della riga (per il controllo umano). */
  testo?: string;
}

/**
 * STATO EPISTEMICO di un'informazione (fase 6 — «che cosa sappiamo di questo dato?»),
 * distinto dalla FONTE (dove è stato preso): un dato può arrivare da un documento
 * (`estratto`) e restare non verificato; una stima (`inferito`) non è mai verificata.
 */
export type StatoDato =
  | 'dichiarato' | 'estratto' // utente senza evidenza | documento con evidenza fisica
  | 'normalizzato' | 'inferito' // derivazione meccanica | STIMA da regola (mai verificata)
  | 'verificato' | 'non-disponibile'; // revisione umana esplicita | informazione assente

/** Provenienza di una singola informazione usata nella valutazione. */
export interface Provenienza {
  fonte?: RiferimentoDocumento;
  /** Confidenza qualitativa 0..1 (affidabilità OCR × match della riga × regola). */
  confidenza: number;
  metodo:
    | 'ocr'
    | 'testo-incollato'
    | 'manuale'
    | 'normalizzazione'
    | 'riconoscimento'
    | 'inferenza';
  /** Stato epistemico (assente = deducibile dal `metodo`); campo coperto (null = intero record). */
  stato?: StatoDato;
  campo?: string | null;
  /** Spiegazione del passaggio (es. regola di stima applicata, motivo della revisione). */
  nota?: string;
}

/* --------------------------- §3 Record accademici canonici --------------------------- */

/** Codice SSD canonico (es. MAT/05) oppure GSD 2024 (es. MATH-01/A, DM 639/2024). */
export type SsdCode = string;
export type GsdCode = string;

export type FonteEsame = 'manuale' | 'ocr-documento' | 'testo-incollato';

/** Esame accademico in forma canonica. I dati grezzi dell'utente NON vengono alterati. */
export interface EsameCanonico {
  id: string;
  denominazione: string;
  /** CFU/ECTS maturati. */
  cfu: number;
  voto?: number | null;
  anno?: string | null;
  /** SSD canonico normalizzato (es. "MAT/05"). */
  ssd?: SsdCode | null;
  /** SSD come scritto dall'utente/OCR (immutato). */
  ssdOrigine?: string | null;
  /** GSD 2024 (DM 639/2024) assegnato dal normalizer, se disponibile. */
  gsd?: GsdCode | null;
  fonte: FonteEsame;
  /** Flag impostato SOLO dopo verifica umana esplicita. */
  manualVerified?: boolean;
  affidabilita?: 'alta' | 'media' | 'bassa' | null;
  /**
   * Codice dell'insegnamento/verbalizzazione (fase 6.5): input di deduplica fra
   * documenti diversi; assente se il documento non lo espone.
   */
  codice?: string | null;
  /** Periodo didattico (semestre/anno di corso) dichiarato dal documento. */
  periodo?: string | null;
  /** Ateneo/istituzione che ha verbalizzato l'esame (utile per le carriere miste). */
  istituzione?: string | null;
  provenienza: Provenienza[];
}

/** Titolo di studio accademico in forma canonica (dati originali preservati in `raw`). */
export interface TitoloAccademicoCanonico {
  denominazione: string;
  /** Classe di laurea / vecchio ordinamento originale, se riconosciuta. */
  classe?: string | null;
  classeLegacy?: string | null;
  istituzione?: string | null;
  /** null/Italia = titolo nazionale; altrimenti paese estero. */
  paese?: string | null;
  titoloEstero?: boolean;
  dataInizio?: string | null;
  dataLaurea?: string | null;
  /** Payload originale dell'utente: mai modificato dal motore. */
  raw?: unknown;
  /**
   * Provenienza dei dati del titolo (fase 6 — allineata a `EsameCanonico.provenienza`).
   * Assente sui titoli inseriti prima di questa fase: il consumatore deve trattarla
   * come «non dichiarata», mai come «verificata».
   */
  provenienza?: Provenienza[];
}


/* ---------------------------- §4 Riferimenti normativi e date ---------------------------- */

export type DecretoNormativo =
  | 'DPR 19/2016'
  | 'DM 259/2017'
  | 'DM 22/12/2023'
  | 'DM 639/2024';

export type TabellaNormativa = 'A' | 'B';

/** Riferimento normativo esatto di un requisito valutato. */
export interface NormativaApplicata {
  decreto: DecretoNormativo;
  tabella: TabellaNormativa;
  nota?: string;
  /** Es. periodo transitorio Riforma 2024 (nuovi GSD vs vecchie tabelle A/B). */
  periodoTransitorio?: string | null;
  /** Normative freshness date: data di aggiornamento della versione usata. */
  dataAggiornamentoNormativa: string;
}

/** Stato della risoluzione temporale del contesto normativo. */
export type StatoContestoNormativa = 'applicabile' | 'transitorio' | 'non-risolto';

/** Date rilevanti per la risoluzione temporale della normativa. */
export interface DateRilevanza {
  /** @deprecated usa `enrollmentDate`. */
  dataInizioCorso?: string | null;
  /** @deprecated usa `awardedDate`. */
  dataLaurea?: string | null;
  /** @deprecated usa `dataDomanda`. */
  dataDomanda?: string;

  /** Data di immatricolazione/inizio corso del titolo (ISO). */
  enrollmentDate?: string | null;
  /** Data di conseguimento del titolo (ISO). */
  awardedDate?: string | null;
  /** Data della procedura (domanda/concorso) (ISO, sempre richiesta). */
  procedureDate?: string;
}

/** Stato dell'integrazione dei CFU mancanti, come dichiarato dalla norma. */
export type IntegrabilitaStatus = 'ALLOWED' | 'PROHIBITED' | 'NOT_SPECIFIED';

/**
 * Natura di aggregazione dichiarata dal TIPO di requisito (fase 5): stabilisce
 * come il requisito partecipa al verdetto aggregato. Modulo foglia perché serve
 * sia al modello del requisito sia all'aggregazione di stato, senza cicli.
 */
export type NaturaRequisitoAggregato = 'cfu' | 'titolo' | 'accesso';

/* --------------------------- §6 Audit trail (fase/stato/voce) --------------------------- */


export type FaseAudit = 'document' | 'normalize' | 'normative' | 'solve' | 'report';
export type TipoAudit = 'info' | 'warning' | 'errore';

export interface VoceAudit {
  id: string;
  fase: FaseAudit;
  tipo: TipoAudit;
  messaggio: string;
  normativa?: NormativaApplicata;
  provenienza?: Provenienza[];
  createdAt: string;
}

/* ---------------------------- §6 Audit trail (fase/stato/voce) ---------------------------- */
