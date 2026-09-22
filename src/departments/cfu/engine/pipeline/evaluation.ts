/**
 * ScuoleRadar.it — Dipartimento CFU · engine/pipeline/evaluation.
 *
 * STAGE 5 — VALUTAZIONE DEI REQUISITI (esecuzione).
 * Ogni requisito produce un esito AUDITABILE: stato, evidenze, valori calcolati,
 * valori mancanti, fonti e percorso logico. Un tipo di requisito senza strategia
 * registrata non produce giudizi: resta `NON_VALUTABILE` e blocca l'esito
 * positivo a valle (mai ELIGIBLE per requisiti non verificabili).
 */
import type { VoceAudit } from '../types';
import { voceAuditPipeline } from './audit';
import type { ContestoValutazioneRequisito, RegistroStrategieRequisito } from './strategies';
import type { RiferimentoFonte } from './types';
import type {
  DefinizioneRequisito,
  EsitoValutazioneRequisito,
  StatoRequisito,
} from './requirementTypes';

/** Stati che impediscono un giudizio automatico su un requisito. */
export const STATI_REQUISITO_BLOCCANTI: readonly StatoRequisito[] = [
  'COMPUTAZIONE_INCERTA',
  'DATI_INSUFFICIENTI',
  'NON_VALUTABILE',
];

export interface ParametriValutazioneRequisiti {
  readonly requisiti: readonly DefinizioneRequisito[];
  readonly fonti: readonly RiferimentoFonte[];
  readonly contesto: ContestoValutazioneRequisito;
  readonly registro: RegistroStrategieRequisito;
  readonly ora?: string;
}

export interface EsitoValutazioneRequisiti {
  readonly valutazioni: readonly EsitoValutazioneRequisito[];
  /** Id dei requisiti il cui esito non consente un giudizio automatico. */
  readonly bloccanti: readonly string[];
  readonly audit: readonly VoceAudit[];
}

function richiestaNonValutabile(
  requisito: DefinizioneRequisito,
): Pick<EsitoValutazioneRequisito, 'valori' | 'datiUsati' | 'provenienzaDati' | 'spiegazione' | 'rami'> & {
  stato: StatoRequisito;
} {
  return {
    stato: 'NON_VALUTABILE',
    valori: { cfuRichiesti: null, cfuPosseduti: null, cfuMancanti: null },
    datiUsati: [],
    provenienzaDati: [],
    spiegazione: [
      `Nessuna strategia registrata per il tipo "${requisito.tipo}": nessun giudizio automatico.`,
    ],
  };
}

/** Valuta i requisiti risolti e produce esiti + audit per requisito. */
export function valutaRequisiti(
  parametri: ParametriValutazioneRequisiti,
): EsitoValutazioneRequisiti {
  const valutazioni: EsitoValutazioneRequisito[] = [];
  const bloccanti: string[] = [];
  const audit: VoceAudit[] = [];

  for (const requisito of parametri.requisiti) {
    const valutatore = parametri.registro.valutatore(requisito.tipo);
    const grezza = valutatore
      ? valutatore(requisito, parametri.contesto)
      : richiestaNonValutabile(requisito);
    const fonti = parametri.fonti.filter((fonte) =>
      requisito.sourceIds.includes(fonte.sourceId),
    );

    valutazioni.push({
      requisitoId: requisito.id,
      tipo: requisito.tipo,
      stato: grezza.stato,
      fonti,
      evidenze: requisito.evidenze,
      valori: grezza.valori,
      datiUsati: grezza.datiUsati,
      provenienzaDati: grezza.provenienzaDati,
      spiegazione: grezza.spiegazione,
      rami: grezza.rami,
    });
    if (STATI_REQUISITO_BLOCCANTI.includes(grezza.stato)) bloccanti.push(requisito.id);

    audit.push(
      voceAuditPipeline(
        'requirement-evaluation',
        grezza.stato === 'SODDISFATTO' ? 'info' : grezza.stato === 'NON_SODDISFATTO' ? 'warning' : 'errore',
        `Requisito ${requisito.id} (${requisito.tipo}) → ${grezza.stato}` +
          ` [fonti: ${requisito.sourceIds.join(', ') || 'nessuna'}]` +
          ` — ${grezza.spiegazione[grezza.spiegazione.length - 1] ?? ''}`,
        { now: parametri.ora },
      ),
    );
  }

  return { valutazioni, bloccanti, audit };
}
