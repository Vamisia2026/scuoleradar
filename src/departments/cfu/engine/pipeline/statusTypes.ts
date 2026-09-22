/**
 * ScuoleRadar.it — Dipartimento CFU · engine/pipeline/statusTypes.
 *
 * CONTRATTO dell'aggregazione di stato (vocabolario + operazioni sul singolo
 * requisito). Nessuna regola di precedenza finale qui: l'autorità di stato della
 * pipeline è in `status.ts` (regole R0-R10), che ri-esporta questo contratto.
 *
 * FASE 5 — i requisiti entrano nell'aggregazione con i propri FATTI (A5):
 * natura e integrabilità sono dichiarate alla risoluzione del requisito, non
 * dedotte dall'elenco delle regole applicabili. Il CONTESTO dichiara invece la
 * CAUSA per cui l'eventuale contesto normativo non è risolto, così che
 * `INSUFFICIENT_DATA` resti riservato ai soli dati utente mancanti (R0) e ogni
 * incertezza normativa produca MANUAL_VERIFICATION_REQUIRED (R1/R1b).
 *
 * VOCABOLARIO PER REQUISITO:
 *  - SODDISFATTO                 requisito positivamente soddisfatto;
 *  - NON_SODDISFATTO             requisito non soddisfatto (deficit certo);
 *  - NON_SODDISFATTO_INTEGRABILE deficit che la FONTE dichiara integrabile;
 *  - DATO_UTENTE_MANCANTE        manca un dato dell'utente (CFU non numerici,
 *                                SSD, classe del titolo, codice disciplinare);
 *  - DATO_NORMATIVO_MANCANTE     manca o non è dichiarata un'informazione
 *                                NORMATIVA (integrabilità non dichiarata,
 *                                ammissibilità della classe di laurea non provata);
 *  - INCERTO                     calcolo non affidabile (mappature, OCR…);
 *  - NON_VALUTABILE              nessuna strategia / natura non dichiarata.
 */
import type {
  EsitoValutazione,
  IntegrabilitaStatus,
  NaturaRequisitoAggregato,
} from './resultTypes';
import type { StatoRequisito } from './requirementTypes';

export type StatoRequisitoAggregato =
  | 'SODDISFATTO'
  | 'NON_SODDISFATTO'
  | 'NON_SODDISFATTO_INTEGRABILE'
  | 'DATO_UTENTE_MANCANTE'
  | 'DATO_NORMATIVO_MANCANTE'
  | 'INCERTO'
  | 'NON_VALUTABILE';

/** Natura del requisito: cambia il trattamento nell'aggregazione (fatto di requisito). */
export type { NaturaRequisitoAggregato };

/** Ramo di una disgiunzione "A oppure B" (esito del singolo ramo). */
export interface RamoDisgiunzione {
  readonly id: string;
  readonly stato: StatoRequisitoAggregato;
}

export interface RequisitoAggregato {
  readonly id: string;
  readonly natura: NaturaRequisitoAggregato;
  readonly stato: StatoRequisitoAggregato;
  /** Integrabilità dichiarata dalla fonte PER questo requisito (A5). */
  readonly integrabilita: IntegrabilitaStatus;
  /** Tipo dichiarato dal requisito strutturato (solo tracciabilità). */
  readonly tipo?: string;
  /**
   * Rami della disgiunzione (A3), presi dall'esito del requisito. Un ramo
   * `SODDISFATTO` stabilisce l'OR da solo; uno stato rischioso del requisito
   * (dato mancante, incerto, non valutabile) prevale SEMPRE sui rami.
   */
  readonly opzioni?: readonly RamoDisgiunzione[];
}

/**
 * Causa per cui il contesto normativo NON è risolto (fase 5 — R0/R1).
 *  - 'risolta'     contesto normativo risolto;
 *  - 'dato-utente' il candidato può risolverla (data della procedura mancante);
 *  - 'normativa'   nessuna norma utilizzabile o contesti normativi in conflitto:
 *                  richiede verifica manuale, MAI "dati insufficienti".
 */
export type CausaContestoNormativo = 'risolta' | 'dato-utente' | 'normativa';

export interface ContestoAggregazione {
  readonly requisiti: readonly RequisitoAggregato[];
  /** Id dei conflitti fra fonti registrati (mai risolti in automatico). */
  readonly conflitti: readonly string[];
  /** Causa dell'eventuale contesto normativo non risolto (R0/R1). */
  readonly causaContesto: CausaContestoNormativo;
  /** Numero di regole verificate applicabili (0 = nessuna fonte utilizzabile). */
  readonly regoleApplicabili: number;
}

export interface EsitoAggregazione {
  readonly stato: EsitoValutazione;
  /** Id della regola di precedenza applicata (tracciabilità della decisione). */
  readonly regola: string;
  /** Motivazione sintetica della regola applicata (audit). */
  readonly dettaglio: string;
  readonly percorso: readonly string[];
}

/** Stati che rendono il verdetto intrinsecamente NON positivo. */
export const STATI_RISCHIOSI: readonly StatoRequisitoAggregato[] = [
  'DATO_UTENTE_MANCANTE',
  'DATO_NORMATIVO_MANCANTE',
  'INCERTO',
  'NON_VALUTABILE',
];

/**
 * Gravità crescente degli stati, allineata all'ordine delle regole R0-R10.
 * Usata per collassare i rami di una disgiunzione: lo stato collassato è quello
 * la cui regola scatterebbe per prima (A2: il dato normativo prevale sull'utente).
 */
export const GRAVITA_STATO: Readonly<Record<StatoRequisitoAggregato, number>> = {
  SODDISFATTO: 0,
  NON_SODDISFATTO: 1,
  NON_SODDISFATTO_INTEGRABILE: 2,
  DATO_UTENTE_MANCANTE: 3,
  DATO_NORMATIVO_MANCANTE: 4,
  INCERTO: 5,
  NON_VALUTABILE: 6,
};

export function verdettoPositivo(stato: EsitoValutazione): boolean {
  return stato === 'ELIGIBLE' || stato === 'CONDITIONALLY_ELIGIBLE';
}

/**
 * Stato di aggregazione di UN requisito dai suoi FATTI (A5): esito della
 * valutazione + integrabilità dichiarata dalla fonte per quel requisito.
 * Un deficit dichiarato integrabile diventa `NON_SODDISFATTO_INTEGRABILE`:
 * l'aggregazione non rilegge più l'integrabilità dalle regole applicabili.
 */
export function statoAggregatoDaRequisito(
  stato: StatoRequisito,
  integrabilita: IntegrabilitaStatus,
): StatoRequisitoAggregato {
  switch (stato) {
    case 'SODDISFATTO':
      return 'SODDISFATTO';
    case 'NON_SODDISFATTO':
      return integrabilita === 'ALLOWED' ? 'NON_SODDISFATTO_INTEGRABILE' : 'NON_SODDISFATTO';
    case 'COMPUTAZIONE_INCERTA':
      return 'INCERTO';
    case 'DATI_INSUFFICIENTI':
      return 'DATO_UTENTE_MANCANTE';
    case 'NON_VALUTABILE':
      return 'NON_VALUTABILE';
  }
}

/**
 * Causa del contesto non risolto (R0/R1): `INSUFFICIENT_DATA` è riservato ai dati
 * UTENTE mancanti/incompleti; ogni causa NORMATIVA (nessuna norma applicabile,
 * contesti in conflitto, fonti non verificabili) richiede verifica manuale.
 */
export function causaContestoNormativoDa(parametri: {
  readonly normativaRisolta: boolean;
  /** Data della procedura dichiarata dall'utente (ISO) — null se assente. */
  readonly dataProcedura: string | null;
}): CausaContestoNormativo {
  if (parametri.normativaRisolta) return 'risolta';
  return parametri.dataProcedura ? 'normativa' : 'dato-utente';
}

/**
 * Collasso di una disgiunzione (A3). Un requisito "A oppure B" è SODDISFATTO
 * SOLO se almeno un ramo lo stabilisce da solo (`SODDISFATTO`: soglia raggiunta
 * sui dati affidabili, non ribaltabile da informazioni mancanti). Un ramo
 * "completibile" (NON_SODDISFATTO_INTEGRABILE), incerto o non valutabile NON
 * soddisfa la disgiunzione: si propaga lo stato più grave, così la regola di
 * precedenza applicata resta tracciabile.
 */
export function esitoDisgiunzione(
  rami: readonly RamoDisgiunzione[],
): StatoRequisitoAggregato {
  if (rami.length === 0) return 'NON_VALUTABILE';
  if (rami.some((ramo) => ramo.stato === 'SODDISFATTO')) return 'SODDISFATTO';
  return rami
    .map((ramo) => ramo.stato)
    .reduce((peggiore, stato) =>
      GRAVITA_STATO[stato] > GRAVITA_STATO[peggiore] ? stato : peggiore,
    );
}
