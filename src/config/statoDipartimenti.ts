/**
 * ScuoleRadar.it — STATO EFFETTIVO e VISIBILITÀ dei dipartimenti.
 *
 * Seconda metà del sistema di feature flags (l'anagrafica e lo store degli
 * override vivono in `./features.ts`): risolve lo stato effettivo di un
 * dipartimento secondo la priorità
 *
 *     variabile d'ambiente  →  override locale (browser)  →  default del codice
 *
 * e ne deriva la visibilità per l'utente corrente (`test` = solo admin) e le
 * etichette usate da navbar, pannelli Admin/DEV e pagine di manutenzione.
 *
 * Modulo PURO e isomorfo: nessun import di React, nessun accesso a DOM.
 */
import { nomeVariabileFeature, variabileAmbiente } from '../lib/ambiente.ts';
import {
  DIPARTIMENTI,
  eStatoDipartimento,
  overrideDipartimenti,
  trovaDipartimento,
  type DipartimentoId,
  type OverrideDipartimenti,
  type StatoDipartimento,
} from './features.ts';

/** Provenienza dello stato effettivo (diagnostica nel pannello Admin/DEV). */
export type OrigineStato = 'ambiente' | 'locale' | 'default';

/** Stato imposto dalle variabili d'ambiente (`FEATURE_RADAR=test`, …), o null. */
export function statoDaAmbiente(id: DipartimentoId): StatoDipartimento | null {
  const raw = (variabileAmbiente(nomeVariabileFeature(id)) ?? '').toLowerCase();
  return eStatoDipartimento(raw) ? raw : null;
}

/** Da dove arriva lo stato effettivo di un dipartimento. */
export function origineStatoDipartimento(id: DipartimentoId): OrigineStato {
  if (statoDaAmbiente(id)) return 'ambiente';
  if (overrideDipartimenti()[id]) return 'locale';
  return 'default';
}

/**
 * Stato EFFETTIVO di un dipartimento (env → override locale → default).
 * `override` permette agli hook React di passare lo snapshot sottoscritto.
 */
export function statoDipartimento(
  id: DipartimentoId,
  override?: OverrideDipartimenti,
): StatoDipartimento {
  const locali = override ?? overrideDipartimenti();
  return statoDaAmbiente(id) ?? locali[id] ?? trovaDipartimento(id)?.statoBase ?? 'off';
}

/** Mappa completa degli stati effettivi (comoda per pannelli e test). */
export function statiDipartimenti(): Record<DipartimentoId, StatoDipartimento> {
  const out = {} as Record<DipartimentoId, StatoDipartimento>;
  for (const d of DIPARTIMENTI) out[d.id] = statoDipartimento(d.id);
  return out;
}

/**
 * Visibilità di un dipartimento per l'utente corrente:
 *   `off`  → mai visibile;
 *   `test` → solo admin (o DEV forzato dalla DEV Toolbar);
 *   `on`   → sempre visibile.
 *
 * `override` permette agli hook React di passare lo snapshot SOTTOSCRITTO degli
 * override locali: senza, la visibilità verrebbe riletta dallo store al momento
 * della chiamata e i valori memoizzati a valle (`primaRottaVisibile`, filtri di
 * navbar/tab) potrebbero restare quelli di prima del cambio («sblocco» non
 * istantaneo quando l'Admin accende un dipartimento).
 */
export function dipartimentoVisibile(
  id: DipartimentoId,
  accesso: { eAdmin?: boolean; forzaDev?: boolean; override?: OverrideDipartimenti } = {},
): boolean {
  const stato = statoDipartimento(id, accesso.override);
  if (stato === 'on') return true;
  if (stato === 'off') return false;
  return accesso.eAdmin === true || accesso.forzaDev === true;
}

/** Etichetta operativa dello stato (OFF | TEST | ON). */
export function etichettaStato(stato: StatoDipartimento): string {
  if (stato === 'off') return 'OFF';
  if (stato === 'test') return 'TEST';
  return 'ON';
}

/** Spiegazione dello stato, per pannelli Admin/DEV e componenti di manutenzione. */
export function descrizioneStato(stato: StatoDipartimento): string {
  if (stato === 'off') return 'Disattivato: nessuna tab in navbar e rotta non accessibile.';
  if (stato === 'test') return 'Solo admin: notifiche automatiche dirottate sull’account di test.';
  return 'Pubblico: visibile a tutti e notifiche operative regolari.';
}
