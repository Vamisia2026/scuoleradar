/**
 * ScuoleRadar.it — Dipartimento CFU.
 *
 * Punto di ingresso pubblico del dipartimento isolato `src/departments/cfu/`.
 * Espone solo la superficie necessaria al resto dell'app (router e pagine):
 *  - `CalcolatoreCfuApp`     → tool privato in dashboard (Dipartimento CFU);
 *  - `CalcolatoreCfuLanding` → landing pubblica SEO / funnel di registrazione.
 * La logica interna (analisi, OCR, dossier, matrice SSD) resta incapsulata.
 */
export { CalcolatoreCfuApp } from './calcolatore/CalcolatoreCfuApp';
export { CalcolatoreCfuLanding } from './landing/CalcolatoreCfuLanding';

/** Motore di calcolo isolato (5 moduli: documentParser, normalizer, normativeResolver, requirementSolver, reportEngine). */
export * as engine from './engine';

export type {
  AllegatoCfu,
  AmbitoDisciplinare,
  ClasseDiConcorso,
  CoperturaAmbito,
  DiagnosiCFU,
  DossierCFU,
  Esame,
  EsitoClasse,
  SSD,
} from './shared/types';
export { ETICHETTE_AMBITI } from './shared/types';
