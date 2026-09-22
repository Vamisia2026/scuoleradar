/**
 * ScuoleRadar.it — Dipartimento CFU · engine/pipeline/audit.
 *
 * Fabbrica delle voci di Audit Trail della pipeline universale. Riusa la
 * struttura `VoceAudit` del motore (nessun nuovo formato di audit) e mappa ogni
 * stage della pipeline su una fase ufficiale già consumata dal report:
 *  identificazione/fonti → 'normative', normalizzazione → 'normalize',
 *  requisiti/valutazione/deficit → 'solve', stato/payload → 'report'.
 */
import type { FaseAudit, NormativaApplicata, VoceAudit } from '../types';

let progressivo = 0;

/** Mappa gli stage della pipeline sulle fasi di audit ufficiali. */
export const FASE_AUDIT_PER_STAGE = {
  identification: 'normative',
  'normative-source': 'normative',
  normalization: 'normalize',
  'requirement-resolution': 'solve',
  'requirement-evaluation': 'solve',
  deficit: 'solve',
  'final-status': 'report',
  'creative-payload': 'report',
} as const satisfies Record<string, FaseAudit>;

export type StagePipeline = keyof typeof FASE_AUDIT_PER_STAGE;

export interface ExtraVoceAudit {
  readonly normativa?: NormativaApplicata | null;
  readonly now?: string;
}

/** Costruisce una voce di audit tracciabile per uno stage della pipeline. */
export function voceAuditPipeline(
  stage: StagePipeline,
  tipo: VoceAudit['tipo'],
  messaggio: string,
  extras: ExtraVoceAudit = {},
): VoceAudit {
  progressivo += 1;
  return {
    id: `pipeline-${progressivo}`,
    fase: FASE_AUDIT_PER_STAGE[stage],
    tipo,
    messaggio: `[${stage}] ${messaggio}`,
    normativa: extras.normativa ?? undefined,
    createdAt: extras.now ?? new Date().toISOString(),
  };
}
