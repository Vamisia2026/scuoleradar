/**
 * ScuoleRadar.it — PONTE SUPABASE DELLA TELEMETRIA DELLE FONTI (§26.85).
 *
 * L'unico punto che conosce la tabella `public.source_health` e i suoi nomi
 * snake_case: le regole (`sourceHealthRules.ts`) e le operazioni
 * (`sourceTelemetry.ts`) lavorano in camelCase e non sanno dove finisce lo
 * stato. Stesso schema di `automazioniEmailDb.ts`: le colonne cambiano qui e in
 * nessun altro file.
 *
 * La tabella è di SERVIZIO (RLS con la sola policy `service_role`, come
 * `scan_targets`): i runner passano un client con `SUPABASE_SERVICE_ROLE_KEY`.
 * Le due operazioni sono deliberatamente crude — `leggi` lancia se il database
 * non risponde, `salva` restituisce il messaggio d'errore — perché è
 * `sourceTelemetry.ts` a decidere come degradare (memoria + un avviso per URL).
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import type { PonteTelemetria, SourceHealthStatus } from './sourceHealthRules';

/** Riga PostgREST → stato (camelCase); valori fuori dominio riportati al neutro. */
function daRiga(riga: Record<string, unknown>): SourceHealthStatus {
  const testo = (v: unknown): string | null =>
    typeof v === 'string' && v ? v : null;
  const numero = (v: unknown): number => Math.max(0, Number(v) || 0);
  const esito = testo(riga.status);
  const motivo = testo(riga.quarantine_reason);
  return {
    sourceUrl: String(riga.source_url ?? ''),
    status:
      esito === 'success' || esito === 'empty' || esito === 'quarantine'
        ? esito
        : 'unknown',
    consecutiveFailures: numero(riga.consecutive_failures),
    isQuarantined: riga.is_quarantined === true,
    quarantineReason:
      motivo === 'layout_changed' ||
      motivo === 'timeout' ||
      motivo === 'zero_items'
        ? motivo
        : null,
    quarantinedAt: testo(riga.quarantined_at),
    layoutDetected: testo(riga.layout_detected),
    itemsCount: numero(riga.items_count),
    totalRuns: numero(riga.total_runs),
    lastRunAt: testo(riga.last_run_at),
    lastSuccessAt: testo(riga.last_success_at),
    lastError: testo(riga.last_error),
  };
}

/** Stato → riga `source_health` (snake_case; `updated_at` lo scrive il trigger). */
function aRiga(stato: SourceHealthStatus): Record<string, unknown> {
  return {
    source_url: stato.sourceUrl,
    status: stato.status,
    consecutive_failures: stato.consecutiveFailures,
    is_quarantined: stato.isQuarantined,
    quarantine_reason: stato.quarantineReason,
    quarantined_at: stato.quarantinedAt,
    layout_detected: stato.layoutDetected,
    items_count: stato.itemsCount,
    total_runs: stato.totalRuns,
    last_run_at: stato.lastRunAt,
    last_success_at: stato.lastSuccessAt,
    last_error: stato.lastError,
  };
}

/** SQLSTATE dei permessi negati: manca il GRANT, non è una questione di RLS. */
const PERMESSI_NEGATI = '42501';

/**
 * Messaggio d'errore leggibile (§26.117). Un `42501` non dice «permesso negato»
 * e basta: dice QUALE SQL eseguire. Misurato il 30/10/2026 — la chiave era
 * `service_role` e la tabella esisteva, mancava solo il privilegio.
 */
function messaggioErrore(error: { code?: string; message: string }): string {
  if (error.code === PERMESSI_NEGATI) {
    return (
      'permessi SQL mancanti (42501): esegui `grant select, insert, update, delete on public.source_health to service_role;` ' +
      '(supabase/migrations/20261030120000_grant_source_health_service_role.sql)'
    );
  }
  return error.message;
}

/** Ponte Supabase su `public.source_health` (upsert sulla chiave naturale). */
export function ponteSupabase(client: SupabaseClient): PonteTelemetria {
  return {
    async leggi() {
      const { data, error } = await client.from('source_health').select('*');
      if (error) throw new Error(messaggioErrore(error));
      return ((data ?? []) as Record<string, unknown>[]).map(daRiga);
    },
    async salva(stato) {
      const { error } = await client
        .from('source_health')
        .upsert(aRiga(stato), { onConflict: 'source_url' });
      return error ? messaggioErrore(error) : null;
    },
  };
}
