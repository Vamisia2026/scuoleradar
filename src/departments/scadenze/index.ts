/**
 * ScuoleRadar.it — Dipartimento Scadenze (Deadlines Engine).
 *
 * Punto di ingresso pubblico del dipartimento:
 *  - `RevolverScadenze`  → widget carosello orizzontale (10 scadenze attive);
 *  - motore + servizio   → logica pura e livello dati per test/riuso;
 *  - tipi del dominio    → modelli condivisi.
 *
 * Nessun dettaglio interno viene esposto all'esterno.
 */
export { RevolverScadenze } from './components/RevolverScadenze';
export type { RevolverScadenzeProps } from './components/RevolverScadenze';
export {
  codaScadenze,
  prossimaOccorrenza,
  cicloScolasticoDi,
  faseOperativa,
  formattaPeriodo,
  formattaDataBreve,
  formattaDataItaliana,
  giorniCalendarioTra,
  parseTokenData,
  LIMITE_CODA_SCADENZE,
} from './engine';
export {
  caricaScadenzeMaster,
  azzeraCacheScadenze,
  fondeScadenze,
  normalizzaRiga,
  scadenzeFallback,
} from './deadlinesService';
export type { RisultatoScadenze } from './deadlinesService';
export type {
  DeadlineRecord,
  ScadenzaProiettata,
  OrigineScadenze,
  TipoScadenza,
} from './types';
