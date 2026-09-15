/**
 * ScuoleRadar.it — Risoluzione dei DEEP LINK legacy agli avvisi (`/interpello/:param`).
 *
 * NOTA DI POLICY (routing notifiche): le notifiche NON puntano più a una pagina
 * interna della piattaforma. Ogni link di avviso deve puntare SOLO alla fonte
 * originale dell'istituzione (`eLinkEsterno` / `urlEsterna` in
 * `alertInterpello.ts`). Questo modulo resta per risolvere i deep link STORICI
 * già inviati (`/interpello/<hash_id>`): la scheda interna reindirizza subito
 * alla fonte ufficiale, se presente.
 *
 * Modulo PURO (nessuna dipendenza da rete/DOM): testabile con `test:link`.
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
