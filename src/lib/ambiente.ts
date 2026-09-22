/**
 * ScuoleRadar.it — lettura ISOMORFA delle variabili d'ambiente.
 *
 * Serve al sistema di Feature Flags (`src/config/features.ts`,
 * `src/config/gateNotifiche.ts`), che deve funzionare in tre ambienti diversi:
 *   · browser (Vite: `process` NON esiste → riferimento protetto da `globalThis`);
 *   · Node / tsx (scraper, notifier, script di test: `process.env`);
 *   · Deno (Edge Functions: `Deno.env.get`).
 *
 * Modulo PURO: nessun import, nessun effetto collaterale. Non lancia MAI.
 */

/** Forma minima dell'host globale nei tre ambienti supportati. */
interface HostAmbiente {
  process?: { env?: Record<string, string | undefined> };
  Deno?: { env?: { get(name: string): string | undefined } };
}

/** Nome della variabile d'ambiente per lo stato di un dipartimento (`FEATURE_RADAR`). */
export function nomeVariabileFeature(id: string): string {
  return `FEATURE_${id.toUpperCase()}`;
}

/**
 * Valore (trim) di una variabile d'ambiente, oppure `null` se assente/vuota.
 * Accesso via `globalThis`: nel browser non provoca ReferenceError.
 */
export function variabileAmbiente(nome: string): string | null {
  const host = globalThis as unknown as HostAmbiente;
  const daProcess = host.process?.env?.[nome];
  if (typeof daProcess === 'string' && daProcess.trim()) return daProcess.trim();
  try {
    const daDeno = host.Deno?.env?.get(nome);
    if (typeof daDeno === 'string' && daDeno.trim()) return daDeno.trim();
  } catch {
    /* `--allow-env` mancante: si prosegue col valore di default */
  }
  return null;
}

/** True se la variabile d'ambiente è "attiva" (`1`, `true`, `yes`, `on`). */
export function variabileAmbienteAttiva(nome: string, predefinito = false): boolean {
  const valore = (variabileAmbiente(nome) ?? '').toLowerCase();
  if (!valore) return predefinito;
  return ['1', 'true', 'yes', 'on', 'si', 'sì', 'attivo'].includes(valore);
}
