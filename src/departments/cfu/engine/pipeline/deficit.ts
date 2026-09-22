/**
 * ScuoleRadar.it — Dipartimento CFU · engine/pipeline/deficit.
 *
 * STAGE 6 — ANALISI DEL DEFICIT.
 * Il deficit (CFU/SSD mancanti) viene calcolato SOLO quando la regola normativa
 * è stabilita e il calcolo è verificabile:
 *  - nessun conflitto fra fonti;
 *  - contesto normativo risolto e requisiti CFU computabili;
 *  - esito del decisore che ammette un deficit (NOT_ELIGIBLE / CONDITIONALLY_*).
 * In ogni altro caso `cfuMancantiTotali` è `null`: MAI `0` di comodo.
 */
import type { EsitoValutazione } from '../types';
import type { GruppoRequisiti } from './requirements';
import type {
  AnalisiDeficit,
  ConflittoNormativo,
  EsitoValutazioneRequisito,
  VoceDeficit,
} from './requirementTypes';

const TIPI_CFU: readonly string[] = ['cfu.ssd.singolo', 'cfu.ssd.gruppo', 'cfu.ssd.disgiunzione'];

export interface ParametriDeficit {
  readonly stato: EsitoValutazione;
  /** Aggregato del decisore normativo; null/NaN = non utilizzabile. */
  readonly cfuMancantiSolutore: number | null;
  readonly valutazioni: readonly EsitoValutazioneRequisito[];
  readonly gruppi: readonly GruppoRequisiti[];
  readonly conflitti: readonly ConflittoNormativo[];
}

function nonCalcolabile(motivo: string, causa: AnalisiDeficit['causaDeterminante'] = 'nessuna'): AnalisiDeficit {
  return { calcolabile: false, cfuMancantiTotali: null, perRequisito: [], causaDeterminante: causa, motivo };
}

/** Analizza il deficit con le sole informazioni normativamente stabilite. */
export function analizzaDeficit(parametri: ParametriDeficit): AnalisiDeficit {
  if (parametri.conflitti.length > 0) {
    return nonCalcolabile(
      'Conflitto fra fonti autorevoli non risolto: nessun deficit pubblicabile.',
      'cfu',
    );
  }
  if (parametri.stato === 'INSUFFICIENT_DATA') {
    return nonCalcolabile('Dati o contesto normativo insufficienti: deficit non calcolabile.');
  }
  if (parametri.stato === 'MANUAL_VERIFICATION_REQUIRED') {
    return nonCalcolabile('Verifica manuale richiesta: nessun deficit pubblicabile.');
  }
  if (parametri.stato === 'ELIGIBLE') {
    return {
      calcolabile: true,
      cfuMancantiTotali: 0,
      perRequisito: [],
      causaDeterminante: 'nessuna',
      motivo: 'Tutti i requisiti risultano soddisfatti: nessun deficit.',
    };
  }

  const valutazioniCfu = parametri.valutazioni.filter((valutazione) =>
    TIPI_CFU.includes(valutazione.tipo),
  );
  const nonComputabili = valutazioniCfu.filter(
    (valutazione) => valutazione.valori.cfuMancanti === null,
  );
  if (nonComputabili.length > 0) {
    return nonCalcolabile(
      `Requisiti CFU non computabili (${nonComputabili
        .map((valutazione) => valutazione.requisitoId)
        .join(', ')}): nessun deficit pubblicato.`,
      'cfu',
    );
  }

  const perRequisito: VoceDeficit[] = [];
  for (const gruppo of parametri.gruppi) {
    if (!TIPI_CFU.includes(gruppo.tipo)) continue;
    const rappresentante = gruppo.requisitoIds
      .map((id) => parametri.valutazioni.find((valutazione) => valutazione.requisitoId === id))
      .find((valutazione) => (valutazione?.valori.cfuMancanti ?? 0) > 0);
    if (!rappresentante) continue;
    perRequisito.push({
      requisitoId: rappresentante.requisitoId,
      tipo: rappresentante.tipo,
      cfuMancanti: rappresentante.valori.cfuMancanti as number,
      nota: gruppo.chiave,
    });
  }

  const totale = parametri.cfuMancantiSolutore;
  if (totale === null) {
    return nonCalcolabile(
      "L'aggregato del decisore non è numerico: nessun deficit pubblicato.",
      'cfu',
    );
  }
  const somma = perRequisito.reduce((acc, voce) => acc + voce.cfuMancanti, 0);
  const notaDifferenza =
    Math.abs(somma - totale) > 1e-9
      ? ` Nota di audit: la somma per requisito (${somma}) differisce dall'aggregato (${totale}).`
      : '';

  if (perRequisito.length === 0) {
    return {
      calcolabile: true,
      cfuMancantiTotali: totale,
      perRequisito,
      causaDeterminante: 'titolo',
      motivo:
        "Nessun deficit di CFU fra i requisiti valutati: l'esito dipende da un requisito " +
        `non-CFU (titolo/accesso).${notaDifferenza}`,
    };
  }

  return {
    calcolabile: true,
    cfuMancantiTotali: totale,
    perRequisito,
    causaDeterminante: 'cfu',
    motivo:
      `Deficit calcolato dai ${perRequisito.length} requisito/i non soddisfatto/i sui dati ` +
      `conteggiati.${notaDifferenza}`,
  };
}
