/**
 * ScuoleRadar.it — Dipartimento CFU · engine/pipeline/conflicts.
 *
 * RILEVAZIONE DEI CONFLITTI FRA FONTI AUTOREVOLI.
 * Un conflitto non viene MAI risolto in autonomia: viene registrato con le fonti
 * coinvolte e produce `MANUAL_VERIFICATION_REQUIRED` (vedi `status.ts`).
 *
 * Conflitti rilevati (nessuna inferenza, solo confronto fra dati strutturati):
 *  1. `soglia-incompatibile`        → stesso requisito logico dichiarato con
 *     parametri quantitativi diversi;
 *  2. `integrabilita-incompatibile` → regole applicabili che dichiarano sia
 *     ALLOWED sia PROHIBITED per l'integrazione dei CFU mancanti;
 *  3. `contesto-temporale-multiplo` → più contesti di vigenza ammessi dalla
 *     data della procedura.
 * L'assenza di dichiarazione (NOT_SPECIFIED) NON è un conflitto.
 */
import type { NormativeRuleEntry, StatoContestoNormativa, VoceAudit } from '../types';
import { voceAuditPipeline } from './audit';
import type { GruppoRequisiti } from './requirements';
import type { ConflittoNormativo } from './requirementTypes';

export interface ParametriConflitti {
  readonly gruppi: readonly GruppoRequisiti[];
  readonly regoleApplicabili: readonly NormativeRuleEntry[];
  readonly contestiInVigore: readonly string[];
  readonly statoTemporale: StatoContestoNormativa;
  readonly ora?: string;
}

export interface EsitoConflitti {
  readonly conflitti: readonly ConflittoNormativo[];
  readonly audit: readonly VoceAudit[];
}

/** Rileva i conflitti fra fonti autorevoli (mai risolti automaticamente). */
export function rilevaConflitti(parametri: ParametriConflitti): EsitoConflitti {
  const conflitti: ConflittoNormativo[] = [];
  const audit: VoceAudit[] = [];
  let progressivo = 0;
  const prossimoId = (): string => {
    progressivo += 1;
    return `conflitto-${progressivo}`;
  };

  for (const gruppo of parametri.gruppi) {
    if (gruppo.impronte.length < 2) continue;
    conflitti.push({
      id: prossimoId(),
      tipo: 'soglia-incompatibile',
      chiave: gruppo.chiave,
      dettaglio:
        `Lo stesso requisito è dichiarato con parametri diversi da ${gruppo.sourceIds.length} ` +
        `fonte/i (${gruppo.sourceIds.join(', ')}): nessuna regola di prevalenza utilizzabile.`,
      sourceIds: gruppo.sourceIds,
      risolvibileAutomaticamente: false,
    });
  }

  const statiIntegrabilita = new Set(
    parametri.regoleApplicabili
      .map((regola) => regola.integrabilita)
      .filter((stato): stato is 'ALLOWED' | 'PROHIBITED' => stato === 'ALLOWED' || stato === 'PROHIBITED'),
  );
  if (statiIntegrabilita.has('ALLOWED') && statiIntegrabilita.has('PROHIBITED')) {
    const coinvolte = parametri.regoleApplicabili
      .filter((regola) => regola.integrabilita === 'ALLOWED' || regola.integrabilita === 'PROHIBITED')
      .map((regola) => regola.id);
    conflitti.push({
      id: prossimoId(),
      tipo: 'integrabilita-incompatibile',
      chiave: 'integrabilita::cfu-mancanti',
      dettaglio:
        'Regole applicabili dichiarano integrazione sia ammessa sia esclusa: il deficit non è ' +
        `pubblicabile senza verifica manuale (${coinvolte.join(', ')}).`,
      sourceIds: coinvolte,
      risolvibileAutomaticamente: false,
    });
  }

  if (parametri.contestiInVigore.length > 1) {
    conflitti.push({
      id: prossimoId(),
      tipo: 'contesto-temporale-multiplo',
      chiave: 'contesto::vigenza',
      dettaglio:
        'Più contesti normativi risultano in vigore alla data della procedura senza regola di ' +
        `prevalenza dichiarata: ${parametri.contestiInVigore.join(', ')}.`,
      sourceIds: parametri.contestiInVigore,
      risolvibileAutomaticamente: false,
    });
  }

  for (const conflitto of conflitti) {
    audit.push(
      voceAuditPipeline('requirement-resolution', 'errore', `Conflitto ${conflitto.id} (${conflitto.tipo}): ${conflitto.dettaglio}`, {
        now: parametri.ora,
      }),
    );
  }

  return { conflitti, audit };
}
