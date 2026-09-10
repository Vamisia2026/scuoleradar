/**
 * ScuoleRadar.it — Dipartimento CFU · Motore di calcolo (engine).
 *
 * Punto di ingresso pubblico del motore isolato `src/departments/cfu/engine/`.
 * Espone i 5 moduli specialistici + il modello dati condiviso.
 */
export * from './types';
export * from './sourceGate';
export * from './normativeDatabase';
export * from './documentParser';
export * from './normalizer';
export * from './normativeResolver';
export * from './requirementSolver';
export * from './reportEngine';
