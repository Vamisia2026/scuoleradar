/**
 * ScuoleRadar.it — Helper ALERT amministrativi + run log (Node-only, scraper)
 *
 * Invia alert ad ALTA priorità al bot Telegram ADMIN tramite la Edge Function
 * `telegram-admin-webhook` (percorso machine-to-machine, header
 * `x-admin-alert-secret`), che li recapita a `ADMIN_TELEGRAM_ID` e li registra.
 * Registra inoltre ogni esecuzione dello scraper in `scraper_runs`, per la
 * diagnostica remota (comando `/status` del bot admin).
 *
 * Variabili d'ambiente:
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY   (obbligatorie per il run log)
 *   ADMIN_ALERT_SECRET                        (per l'invio alert)
 *   ADMIN_ALERT_URL (opzionale)               default <SUPABASE_URL>/functions/v1/telegram-admin-webhook
 *
 * Nessuna funzione lancia mai: gli errori sono sempre restituiti come esito.
 */

/** Interfaccia minima per l'ambiente (evita la dipendenza da @types/node). */
declare const process: { env: Record<string, string | undefined> };

export type SeveritaAlerta = 'critical' | 'warning' | 'info';

export interface AlertaAdmin {
  severity?: SeveritaAlerta;
  category?: string;
  title: string;
  message: string;
  meta?: Record<string, unknown>;
}

export interface RunScraperLog {
  modalita: 'reali' | 'fixture';
  province: string[];
  trovati: number;
  nuovi: number;
  upsertOk: boolean;
  telegramAttesi: number;
  telegramRiusciti: number;
  errori: number;
  esito: 'ok' | 'warn' | 'error';
  messaggio?: string;
  durataMs?: number;
}

function baseSupabase(): string {
  return (process.env.SUPABASE_URL ?? '').replace(/\/+$/, '');
}

function urlAlert(): string {
  const esplicito = (process.env.ADMIN_ALERT_URL ?? '').trim();
  if (esplicito) return esplicito;
  const base = baseSupabase();
  return base ? `${base}/functions/v1/telegram-admin-webhook` : '';
}

/**
 * Invia un ALERT amministrativo (non lancia mai: ritorna l'esito).
 * Se `ADMIN_ALERT_SECRET`/URL mancano, l'invio è semplicemente saltato.
 */
export async function inviaAlertaAdmin(
  alerta: AlertaAdmin,
): Promise<{ ok: boolean; inviato?: boolean; error?: string }> {
  const url = urlAlert();
  const secret = (process.env.ADMIN_ALERT_SECRET ?? '').trim();
  if (!url || !secret) {
    return { ok: false, error: 'ADMIN_ALERT_URL/ADMIN_ALERT_SECRET non configurati' };
  }
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-admin-alert-secret': secret },
      body: JSON.stringify({
        severity: alerta.severity ?? 'warning',
        category: alerta.category ?? 'scraper',
        title: alerta.title,
        message: alerta.message,
        meta: alerta.meta ?? undefined,
      }),
    });
    const dati = (await res.json().catch(() => null)) as
      | { ok?: boolean; inviato?: boolean; error?: string }
      | null;
    if (!res.ok) return { ok: false, error: dati?.error ?? `HTTP ${res.status}` };
    return { ok: dati?.ok ?? true, inviato: dati?.inviato };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

/**
 * Registra una run dello scraper in `scraper_runs` (best-effort: non lancia mai).
 * Alimenta i comandi diagnostici del bot admin (`/status`).
 */
export async function registraRunScraper(run: RunScraperLog): Promise<boolean> {
  const base = baseSupabase();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
  if (!base || !key) return false;
  const finishedAt = new Date();
  const startedAt = run.durataMs != null ? new Date(finishedAt.getTime() - run.durataMs) : finishedAt;
  try {
    const res = await fetch(`${base}/rest/v1/scraper_runs`, {
      method: 'POST',
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify({
        started_at: startedAt.toISOString(),
        finished_at: finishedAt.toISOString(),
        durata_ms: run.durataMs ?? null,
        modalita: run.modalita,
        province: run.province,
        trovati: run.trovati,
        nuovi: run.nuovi,
        upsert_ok: run.upsertOk,
        telegram_attesi: run.telegramAttesi,
        telegram_riusciti: run.telegramRiusciti,
        errori: run.errori,
        esito: run.esito,
        messaggio: run.messaggio ?? null,
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}