/**
 * ScuoleRadar.it — Risoluzione dei DEEP LINK agli avvisi (`/interpello/:param`).
 *
 * Le notifiche email/Telegram puntano a:
 *   1. la FONTE UFFICIALE (quando l'avviso ha un `source_url` valido);
 *   2. altrimenti alla scheda interna `/interpello/<chiave>`.
 *
 * La chiave usata dall'id di notifica è lo `hash_id` dell'avviso (vedi
 * `notifier.ts`), ma i link generati da altre parti possono usare l'`id` uuid:
 * questo modulo decide con ONESTÀ su quale colonna cercare, così un deep link
 * non finisce MAI sulla Home per errore di instradamento.
 *
 * Modulo PURO (nessuna dipendenza da rete/DOM): testabile con `test:route`.
 */

/** True se il parametro è un UUID (riga della tabella `interpelli`). */
export function eUuid(valore?: string | null): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    (valore ?? '').trim(),
  );
}

export interface ChiaveInterpello {
  /** Colonna su cui filtrare la riga. */
  colonna: 'id' | 'hash_id';
  /** Valore normalizzato (trim, senza slash finali). */
  valore: string;
}

/**
 * Traduce il parametro di rotta nel filtro DB corretto: `id` (uuid) oppure
 * `hash_id` (SHA-256). Ritorna `null` per parametri vuoti/non plausibili.
 */
export function chiaveInterpelloDaParam(param?: string | null): ChiaveInterpello | null {
  const valore = decodeURIComponent((param ?? '').trim()).replace(/^\/+|\/+$/g, '');
  if (!valore || valore.length < 6) return null;
  if (eUuid(valore)) return { colonna: 'id', valore: valore.toLowerCase() };
  // Gli hash_id sono esadecimali (SHA-256); accettiamo anche id legacy alfanumerici.
  if (/^[a-z0-9_-]+$/i.test(valore)) return { colonna: 'hash_id', valore: valore.toLowerCase() };
  return null;
}

/** URL assoluto della scheda interna di un avviso (nessuno slash duplicato). */
export function urlSchedaInterpello(baseOrigin: string, chiave: string): string {
  const base = baseOrigin.replace(/\/+$/, '');
  return `${base}/interpello/${encodeURIComponent(chiave)}`;
}
