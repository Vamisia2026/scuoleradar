/**
 * ScuoleRadar.it — Dipartimento CFU · engine/pipeline/strategiesCfu.
 *
 * STRATEGIA DEI REQUISITI CFU (singolo SSD, gruppo SSD, disgiunzione esplicita).
 * Riusa le primitive del solver (`valutaVincolo`, `creditiPerCodiceRichiesto`):
 * nessuna duplicazione della semantica di conteggio.
 */
import { creditiPerCodiceRichiesto, valutaVincolo } from '../requirementSolver';
import { vincoloDaRequisito } from './conversions';
import type { DefinizioneRequisito } from './requirementTypes';
import {
  contestoSolver,
  nonValutabile,
  type ContestoValutazioneRequisito,
  type ValutatoreRequisito,
} from './strategyTypes';

/** Requisiti disciplinari (codici SSD o prefissi macro) del requisito. */
function requisitiSsdDelRequisito(requisito: DefinizioneRequisito): string[] {
  const p = requisito.parametri;
  switch (p.tipo) {
    case 'cfu.ssd.singolo':
      return [p.ssd];
    case 'cfu.ssd.gruppo':
      return [...p.ssd];
    case 'cfu.ssd.disgiunzione':
      return p.opzioni.flatMap((opzione) => [...opzione.ssd]);
    default:
      return [];
  }
}

/**
 * Esami utente che hanno concorso al requisito. Usa la stessa primitiva di
 * conteggio del solver (`creditiPerCodiceRichiesto`): nessuna euristica.
 * Per le disgiunzioni l'elenco è l'unione degli esami che rispondono a una
 * qualsiasi opzione (il deficit si riferisce all'opzione migliore, spiegata).
 */
export function esamiConteggiati(
  requisito: DefinizioneRequisito,
  contesto: ContestoValutazioneRequisito,
): string[] {
  const targets = requisitiSsdDelRequisito(requisito);
  if (targets.length === 0) return [];
  const mappature = [...contesto.mappature];
  const provisioni = [...contesto.provisioni];
  return contesto.esami
    .filter((esame) =>
      targets.some(
        (target) => creditiPerCodiceRichiesto(target, [esame], mappature, provisioni).cfu > 0,
      ),
    )
    .map((esame) => esame.id);
}

/** Strategia unica per i requisiti CFU (singolo, gruppo, disgiunzione). */
export const valutaRequisitoCfu: ValutatoreRequisito = (requisito, contesto) => {
  const vincolo = vincoloDaRequisito(requisito);
  if (!vincolo) {
    return nonValutabile('NON_VALUTABILE', [
      'Requisito senza vincolo computabile né estratto di fonte: nessun giudizio automatico.',
    ]);
  }
  const { esito, bloccatoDaMappatura, rami } = valutaVincolo(vincolo, contestoSolver(contesto));
  const parametri = requisito.parametri;
  const richiesti =
    parametri.tipo === 'cfu.ssd.singolo' || parametri.tipo === 'cfu.ssd.gruppo'
      ? parametri.min
      : null;
  const datiUsati = esamiConteggiati(requisito, contesto);
  const spiegazione = [
    `Requisito ${requisito.id} sui ${contesto.esami.length} esami canonici; fonti: ${requisito.sourceIds.join(', ')}.`,
    esito.dettaglio ?? `${esito.cfuPosseduti} CFU conteggiati.`,
  ];

  if (contesto.cfuNonValidi) {
    return nonValutabile(
      'DATI_INSUFFICIENTI',
      [...spiegazione, 'CFU non normalizzabili presenti: nessun conteggio affidabile.'],
      { cfuRichiesti: richiesti, cfuPosseduti: null, cfuMancanti: null },
    );
  }
  if (bloccatoDaMappatura) {
    return nonValutabile(
      'COMPUTAZIONE_INCERTA',
      [
        ...spiegazione,
        'Mappatura SSD/GSD presente ma non dichiarata applicabile alla provisione: deficit non calcolabile.',
      ],
      { cfuRichiesti: richiesti, cfuPosseduti: esito.cfuPosseduti, cfuMancanti: null },
    );
  }
  if (!esito.soddisfatto && contesto.codiciMancanti) {
    return nonValutabile(
      'DATI_INSUFFICIENTI',
      [...spiegazione, 'Esami senza codice disciplinare: il deficit non è escludibile.'],
      { cfuRichiesti: richiesti, cfuPosseduti: esito.cfuPosseduti, cfuMancanti: null },
    );
  }

  return {
    stato: esito.soddisfatto ? 'SODDISFATTO' : 'NON_SODDISFATTO',
    valori: {
      cfuRichiesti: richiesti,
      cfuPosseduti: esito.cfuPosseduti,
      cfuMancanti: esito.cfuMancanti,
    },
    datiUsati,
    provenienzaDati: esito.contributi,
    // Rami della disgiunzione (A3): misurati dal solver, esposti all'aggregazione.
    rami: rami?.map((ramo) => ({
      id: ramo.id,
      stato: ramo.soddisfatto ? ('SODDISFATTO' as const) : ('NON_SODDISFATTO' as const),
    })),
    spiegazione: [
      ...spiegazione,
      esito.soddisfatto
        ? 'Soglia raggiunta con i soli dati conteggiati.'
        : `Deficit calcolato sui dati conteggiati: ${esito.cfuMancanti} CFU.`,
    ],
  };
};
