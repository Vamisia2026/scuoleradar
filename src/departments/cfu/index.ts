/**
 * ScuoleRadar.it — Dipartimento CFU.
 *
 * Punto di ingresso pubblico del dipartimento isolato `src/departments/cfu/`.
 * Espone solo la superficie necessaria al resto dell'app (router e pagine):
 *  - `CalcolatoreCfuApp`     → tool privato in dashboard (Dipartimento CFU);
 *  - `CalcolatoreCfuLanding` → landing pubblica SEO / funnel di registrazione.
 * La logica interna (classi coperte, valutazione V1, adapter dell'esito) resta
 * incapsulata.
 */
export { CalcolatoreCfuApp } from './calcolatore/CalcolatoreCfuApp';
export { CalcolatoreCfuLanding } from './landing/CalcolatoreCfuLanding';

/** Motore di calcolo isolato (moduli: documentParser, normalizer, normativeResolver, requirementSolver, reportEngine). */
export * as engine from './engine';

export type {
  AmbitoDisciplinare,
  ClasseDiConcorso,
  CoperturaAmbito,
  DiagnosiCFU,
  Esame,
  EsitoClasse,
  SSD,
} from './shared/types';
export { ETICHETTE_AMBITI } from './shared/types';
