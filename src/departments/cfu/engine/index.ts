/**
 * ScuoleRadar.it — Dipartimento CFU · Motore di calcolo (engine).
 *
 * Punto di ingresso pubblico del motore isolato `src/departments/cfu/engine/`.
 * Espone i 5 moduli specialistici, il modello dati condiviso e la PIPELINE
 * UNIVERSALE DEI REQUISITI (`pipeline/`), che orchestra gli stadi:
 * identificazione → fonti (Source Gate v2) → normalizzazione → requisiti
 * strutturati → valutazione → deficit → stato semantico → payload assistente.
 */
export * from './types';
export * from './sourceGate';
export * from './normativeDatabase';
export * from './documentParser';
export * from './normalizer';
export * from './normativeResolver';
export * from './requirementSolver';
export * from './reportEngine';
export * from './pipeline/pipeline';
export * from './pipeline/types';
export * from './pipeline/requirementTypes';
export * from './pipeline/audit';
export * from './pipeline/identification';
export * from './pipeline/normativeSources';
export * from './pipeline/normalization';
export * from './pipeline/conversions';
export * from './pipeline/requirements';
export * from './pipeline/strategies';
export * from './pipeline/evaluation';
export * from './pipeline/conflicts';
export * from './pipeline/deficit';
export * from './pipeline/status';
export * from './pipeline/creativePayload';
