/**
 * ScuoleRadar.it — Dipartimento CFU · engine/pipeline/strategyTypes.
 *
 * CONTRATTO DELLE STRATEGIE DI VALUTAZIONE DEI REQUISITI.
 * Tipi condivisi da `strategiesCfu`, `strategiesTitoli` e `strategies` (registro).
 * Nessuna implementazione normativa qui: solo il contratto dati.
 */
import type {
  EsameCanonico,
  NormativeRuleEntry,
  Provenienza,
  SsdMappingRuleEntry,
  TitoloAccademicoCanonico,
} from '../types';
import type { ContestoValutazione } from '../requirementSolver';
import type {
  DefinizioneRequisito,
  RamoRequisitoValutato,
  StatoRequisito,
  ValoriRequisito,
} from './requirementTypes';

export interface ContestoValutazioneRequisito {
  readonly esami: readonly EsameCanonico[];
  readonly mappature: readonly SsdMappingRuleEntry[];
  readonly provisioni: readonly string[];
  readonly regole: readonly NormativeRuleEntry[];
  readonly titolo: TitoloAccademicoCanonico | null;
  readonly now: string;
  /** True se almeno un CFU non è normalizzabile: i calcoli sono inaffidabili. */
  readonly cfuNonValidi: boolean;
  /** True se almeno un esame è privo di codice disciplinare riconosciuto. */
  readonly codiciMancanti: boolean;
}

export interface ValutazioneGrezzaRequisito {
  readonly stato: StatoRequisito;
  readonly valori: ValoriRequisito;
  readonly datiUsati: readonly string[];
  readonly provenienzaDati: readonly Provenienza[];
  readonly spiegazione: readonly string[];
  /** Rami valutati della disgiunzione, quando il tipo li prevede (A3). */
  readonly rami?: readonly RamoRequisitoValutato[];
}

export type ValutatoreRequisito = (
  requisito: DefinizioneRequisito,
  contesto: ContestoValutazioneRequisito,
) => ValutazioneGrezzaRequisito;

export interface RegistroStrategieRequisito {
  readonly valutatori: Readonly<Record<string, ValutatoreRequisito>>;
  readonly tipiRegistrati: readonly string[];
  readonly valutatore: (tipo: string) => ValutatoreRequisito | undefined;
}

/** Valori per i requisiti non-CFU: nessun credito da conteggiare. */
export const VALORI_NON_CFU: ValoriRequisito = {
  cfuRichiesti: null,
  cfuPosseduti: null,
  cfuMancanti: null,
};

/** Adatta il contesto della pipeline al contesto primitivo del solver. */
export function contestoSolver(contesto: ContestoValutazioneRequisito): ContestoValutazione {
  return {
    esami: [...contesto.esami],
    mappature: [...contesto.mappature],
    provisioni: [...contesto.provisioni],
    now: contesto.now,
  };
}

/** Esito non valutabile (dato/fonte insufficiente): nessun conteggio. */
export function nonValutabile(
  stato: StatoRequisito,
  spiegazione: readonly string[],
  valori: ValoriRequisito = VALORI_NON_CFU,
): ValutazioneGrezzaRequisito {
  return { stato, valori, datiUsati: [], provenienzaDati: [], spiegazione };
}
