/**
 * ScuoleRadar.it — Dipartimento CFU · engine/pipeline/requirementTypes.
 *
 * MODELLO UNIVERSALE DEL REQUISITO: requisito strutturato (con i fatti di
 * aggregazione: natura + integrabilità), esito per requisito (con i rami),
 * conflitti fra fonti, deficit, payload assistente, risultato e metadati.
 *
 * Dipende SOLO da `resultTypes` (foglia) e `stageTypes`: nessun import dal motore,
 * così può essere importato senza cicli. Vincoli non negoziabili:
 *  - requisito = DATO STRUTTURATO (id, tipo, parametri, fonti, vigenza, strategia,
 *    natura, integrabilità): nessuna funzione per classe;
 *  - ogni valore è `null` quando NON è calcolabile: MAI `0` di comodo;
 *  - gli stati semantici restano i 5 ufficiali (`EsitoValutazione`).
 */
import type {
  EsitoValutazione,
  IntegrabilitaStatus,
  NaturaRequisitoAggregato,
  Provenienza,
  VoceAudit,
} from './resultTypes';
import type {
  ContestoIdentificazione,
  DatiAccademiciNormalizzati,
  RiferimentoFonte,
  RisoluzioneFonti,
} from './stageTypes';
/* ========================== 4. Requisito strutturato ========================== */

/**
 * Tipi di requisito riconosciuti dal motore: aggiungere un tipo significa
 * registrare una STRATEGIA (`strategies.ts`), mai riscrivere la pipeline.
 */
export type TipoRequisito =
  | 'cfu.ssd.singolo'
  | 'cfu.ssd.gruppo'
  | 'cfu.ssd.disgiunzione'
  | 'titolo.abilitante'
  | 'titolo.accesso.classe';

/** Opzione di una disgiunzione SSD (crediti NON cumulabili fra opzioni). */
export interface OpzioneSsdRequisito {
  readonly id: string;
  readonly ssd: readonly string[];
  readonly min: number;
  readonly nota?: string;
}

/** Parametri del requisito (discriminati dal tipo: nessun testo libero). */
export type ParametriRequisito =
  | {
      readonly tipo: 'cfu.ssd.singolo';
      readonly ssd: string;
      readonly min: number;
      readonly max: number | null;
      readonly nota: string | null;
    }
  | {
      readonly tipo: 'cfu.ssd.gruppo';
      readonly ssd: readonly string[];
      readonly min: number;
      readonly minPerSsd: number | null;
      readonly minUnoDeiSsd: number | null;
      readonly max: number | null;
      readonly distribuzione: string | null;
    }
  | {
      readonly tipo: 'cfu.ssd.disgiunzione';
      readonly opzioni: readonly OpzioneSsdRequisito[];
      readonly disgiunzioneEsplicita: string;
    }
  | {
      readonly tipo: 'titolo.abilitante';
      readonly denominazione: string;
      readonly necessario: boolean;
      readonly alternativoA: readonly string[];
    }
  | {
      readonly tipo: 'titolo.accesso.classe';
      readonly classiAmmesse: readonly string[];
    };

/** Estratto verbatim della fonte che sostiene il requisito (Source Gate). */
export interface EvidenzaRequisito {
  readonly sourceId: string;
  readonly estrattoVerbatim: string;
  readonly posizioneFonte: string;
}

/** Requisito in forma strutturata e tracciabile. */
export interface DefinizioneRequisito {
  readonly id: string;
  readonly tipo: TipoRequisito;
  readonly parametri: ParametriRequisito;
  readonly classeCodice: string;
  /** Id del vincolo dichiarato dalla regola di origine (tracciabilità 1:1). */
  readonly vincoloId: string | null;
  /** Id delle regole autorevoli che dichiarano il requisito. */
  readonly sourceIds: readonly string[];
  readonly evidenze: readonly EvidenzaRequisito[];
  readonly effectiveFrom: string | null;
  readonly effectiveTo: string | null;
  /** Strategia di valutazione risolta dal registro (mai per classe). */
  readonly strategiaId: string;
/** Natura di aggregazione dichiarata alla risoluzione (A5): `null` = non mappata. */
  readonly natura: NaturaRequisitoAggregato | null;
  /** Integrabilità dei CFU mancanti dichiarata dalla fonte per QUESTO requisito. */
  readonly integrabilita: IntegrabilitaStatus;
  readonly nota?: string;
}
/* ==================== 5. Esito della valutazione del requisito ==================== */

export type StatoRequisito =
  | 'SODDISFATTO'
  | 'NON_SODDISFATTO'
  | 'COMPUTAZIONE_INCERTA'
  | 'DATI_INSUFFICIENTI'
  | 'NON_VALUTABILE';

/** Valori numerici del requisito: null = non calcolabile (mai 0 di comodo). */
export interface ValoriRequisito {
  readonly cfuRichiesti: number | null;
  readonly cfuPosseduti: number | null;
  readonly cfuMancanti: number | null;
}

/**
 * Esito di UN RAMO di una disgiunzione (A3), prodotto dalla strategia: l'aggregazione lo collassa con `esitoDisgiunzione`.
 */
export interface RamoRequisitoValutato {
  readonly id: string;
  readonly stato: StatoRequisito;
}

/** Risultato verificabile e spiegabile di UN requisito. */
export interface EsitoValutazioneRequisito {
  readonly requisitoId: string;
  readonly tipo: TipoRequisito;
  readonly stato: StatoRequisito;
  readonly fonti: readonly RiferimentoFonte[];
  readonly evidenze: readonly EvidenzaRequisito[];
  readonly valori: ValoriRequisito;
  /** Identificativi dei dati utente effettivamente usati nel calcolo. */
  readonly datiUsati: readonly string[];
  readonly provenienzaDati: readonly Provenienza[];
  /** Percorso logico esplicito: requisito → dati → calcolo → stato. */
  readonly spiegazione: readonly string[];
  /** Rami valutati di una disgiunzione (assente per gli altri tipi di requisito). */
  readonly rami?: readonly RamoRequisitoValutato[];
}
/* ============================== 6. Conflitti ============================== */

export type TipoConflitto =
  | 'soglia-incompatibile'
  | 'integrabilita-incompatibile'
  | 'contesto-temporale-multiplo';

/** Conflitto fra fonti autorevoli: registrato, MAI risolto in autonomia. */
export interface ConflittoNormativo {
  readonly id: string;
  readonly tipo: TipoConflitto;
  readonly chiave: string;
  readonly dettaglio: string;
  readonly sourceIds: readonly string[];
  /** Sempre false: il motore non sceglie fra fonti autorevoli incompatibili. */
  readonly risolvibileAutomaticamente: false;
}
/* ============================== 7. Deficit ============================== */

export interface VoceDeficit {
  readonly requisitoId: string;
  readonly tipo: TipoRequisito;
  readonly cfuMancanti: number;
  readonly nota: string;
}

/** Analisi del deficit: calcolata SOLO se norma stabilita e computabile. */
export interface AnalisiDeficit {
  readonly calcolabile: boolean;
  /** null quando il deficit NON è calcolabile (mai 0 di comodo). */
  readonly cfuMancantiTotali: number | null;
  readonly perRequisito: readonly VoceDeficit[];
  readonly causaDeterminante: 'cfu' | 'titolo' | 'nessuna';
  readonly motivo: string;
}
/* =============== 8. Payload per il futuro Assistente Creativo =============== */

/** Fotografia in SOLA LETTURA per l'Assistente Creativo: nessun potere su esito o deficit. */
export interface PayloadAssistantCreativo {
  readonly autorita: 'NORMATIVE_ENGINE';
  readonly classeCodice: string;
  readonly denominazioneClasse: string | null;
  readonly stato: EsitoValutazione;
  readonly deficit: AnalisiDeficit;
  readonly fonti: readonly RiferimentoFonte[];
  readonly evidenze: readonly EvidenzaRequisito[];
  readonly noteTracciabilita: readonly string[];
  readonly puoCreareEsito: false;
  readonly puoModificareEsito: false;
  readonly notaSeparazione: string;
}
/* ============================= 9. Risultato ============================= */

/**
 * Risultato della pipeline universale — VISTA FOGLIA (auditabile end-to-end).
 * Il parametro `EsitoAggregato` è lo snapshot del decisore normativo aggregato
 * (specializzato in `engine/types.ts` come `RisultatoPipeline`).
 *
 * `stato` è l'aggregazione AUTOREVOLE DENTRO LA PIPELINE (R0-R10 di `status.ts`);
 * fuori dalla pipeline i consumatori leggono `statoSolutore`/`valutazioneClasse`.
 */
export interface RisultatoPipelineBase<EsitoAggregato = unknown> {
  readonly classeCodice: string;
  /** Stato semantico finale calcolato dalla pipeline (autorità interna della pipeline). */
  readonly stato: EsitoValutazione;
  /** Stato emesso dal decisore normativo aggregato (autorità per i consumatori legacy). */
  readonly statoSolutore: EsitoValutazione | null;
  /** Divergenze dichiarate rispetto al decisore legacy + conflitti fra fonti. */
  readonly escalations: readonly string[];
  readonly identificazione: ContestoIdentificazione;
  readonly fonti: RisoluzioneFonti;
  readonly dati: DatiAccademiciNormalizzati;
  readonly requisiti: readonly DefinizioneRequisito[];
  readonly valutazioniRequisito: readonly EsitoValutazioneRequisito[];
  readonly deficit: AnalisiDeficit;
  readonly conflitti: readonly ConflittoNormativo[];
  /** Snapshot del decisore normativo aggregato (motore esistente, riusato). */
  readonly valutazioneClasse: EsitoAggregato | null;
  readonly auditTrail: readonly VoceAudit[];
  readonly payloadAssistantCreativo: PayloadAssistantCreativo;
}
/* ==================== 10. Metadati per le superfici esterne ==================== */

/** Metadati strutturati esposti da bridge/routing/report senza cambiare il verdetto. */
export interface MetadatiPipeline {
  /** Risultato completo della pipeline universale, quando disponibile. */
  readonly pipeline?: RisultatoPipelineBase;
  /** Fonti autorevoli applicate (identità, vigenza dichiarata, Source Gate v2). */
  readonly fonti?: readonly RiferimentoFonte[];
  /** Conflitti fra fonti registrati (mai risolti in autonomia). */
  readonly conflitti?: readonly ConflittoNormativo[];
  /** Esiti auditabili per singolo requisito strutturato. */
  readonly valutazioniRequisito?: readonly EsitoValutazioneRequisito[];
  /** Analisi del deficit (`cfuMancantiTotali: null` = non pubblicabile). */
  readonly deficit?: AnalisiDeficit;
  /** Payload di sola lettura per l'Assistente Creativo (non autorevole). */
  readonly payloadAssistantCreativo?: PayloadAssistantCreativo;
}
