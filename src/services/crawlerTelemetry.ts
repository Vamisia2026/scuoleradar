/**
 * ScuoleRadar.it — TELEMETRIA DEL CRAWLER (client della Edge `crawler-admin`).
 *
 * Perché un servizio a parte: la «Linea Rossa» del pannello Admin (§26.110) deve
 * mostrare numeri VERI (coda di scansione, scarti, interpelli vivi, fonti isolate)
 * e poter avviare un giro di ingestione. Le tabelle che li contengono
 * (`discovered_links`, `scraper_runs`, `source_health`) sono leggibili solo col
 * `service_role`, quindi il client non le interroga mai direttamente: parla con
 * la Edge.
 *
 * Contratto della Edge (vedi `supabase/functions/crawler-admin/index.ts`):
 *   POST { azione: 'stato' }     → { ok, telemetria }
 *   POST { azione: 'scansione' } → { ok, avviato, workflow, repo, telemetria }
 *
 * Errori: messaggi in italiano, mai un numero inventato. Se la Edge non è
 * deployata o il segreto GitHub manca, la UI lo dice e resta senza dati.
 *
 * SESSIONE & SVILUPPO — la Edge chiede una sessione (JWT) perché legge tabelle
 * di servizio; in build locale (`import.meta.env.DEV`) si può anche mandare
 * l'header `x-crawler-secret` preso da `VITE_CRAWLER_DEV_SECRET`
 * (`.env.local`, mai in produzione): la Edge lo accetta per telemetria e trigger
 * e registra in risposta chi ha autorizzato (`autorizzato_da`). Se manca anche
 * quello, si chiede il login con un messaggio che dice esattamente cosa
 * configurare — mai un errore anonimo.
 */
import { supabase } from '@/lib/supabase';
import type { FonteIsolata } from '@/lib/sourceQuarantine';

/** Progetto Supabase remoto dove sono deployate le Edge Functions. */
const SUPABASE_URL_REMOTO = 'https://gwdmsgsshvdnfrplbjiv.supabase.co';

/** Numeri della coda di scansione + stato dell'ultima run. */
export interface TelemetriaCrawler {
  fonti_whitelist: number;
  pagine_in_coda: number;
  scarti: number;
  in_errore: number;
  interpelli_attivi: number;
  interpelli_totali: number;
  scansionate_24h: number;
  ultima_scansione: string | null;
  /**
   * Fonti in quarantena lette da `source_health` (§26.109), con la data
   * dell'isolamento. `null` o assente = la Edge non le ha lette (versione
   * precedente o tabella non raggiungibile): la UI mostra «—», mai uno zero.
   */
  fonti_isolate?: FonteIsolata[] | null;
  /** Fonti che stanno fallendo senza essere ancora isolate (`null` = non letto). */
  fonti_in_guasto?: number | null;
  ultima_run: {
    started_at: string;
    esito: string;
    trovati: number;
    nuovi: number;
    errori: number;
  } | null;
  aggiornato_il: string;
}

/** Esito dell'avvio manuale. */
export interface EsitoAvvio {
  avviato: boolean;
  /** Chi ha autorizzato la chiamata (`admin`, `segreto`, `sviluppo-locale`, …). */
  autorizzato_da?: string | null;
  workflow: string;
  repo: string;
  telemetria?: TelemetriaCrawler;
}

/** Errore applicativo con il messaggio già pronto per la UI. */
export class CrawlerTelemetriaError extends Error {}

/**
 * Segreto di SVILUPPO (`VITE_CRAWLER_DEV_SECRET` in `.env.local`), `null` in
 * produzione: `import.meta.env.DEV` è `false` nella build, quindi il valore non
 * finisce mai nel bundle pubblico.
 */
export function segretoSviluppo(): string | null {
  const env = (import.meta as unknown as { env?: Record<string, unknown> }).env ?? {};
  if (env.DEV !== true) return null;
  const segreto = typeof env.VITE_CRAWLER_DEV_SECRET === 'string' ? env.VITE_CRAWLER_DEV_SECRET : '';
  return segreto.trim() ? segreto.trim() : null;
}

async function tokenSessione(): Promise<string | null> {
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

/**
 * Chiamata alla Edge `crawler-admin`. Il JWT di sessione è la via normale; se non
 * c'è (DEV Bar senza login) si manda la chiave anon per superare il gateway e ci si
 * fa autorizzare dall'header `x-crawler-secret` della build locale.
 */
async function chiama<T>(azione: 'stato' | 'scansione'): Promise<T> {
  const token = await tokenSessione();
  const segreto = segretoSviluppo();
  const anon = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) ?? '';
  const bearer = token ?? (segreto ? anon : null);
  if (!bearer) {
    throw new CrawlerTelemetriaError(
      'Serve una sessione attiva: la telemetria del crawler legge tabelle di servizio. ' +
        'In sviluppo puoi evitare il login impostando VITE_CRAWLER_DEV_SECRET in .env.local.',
    );
  }
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    apikey: anon,
    Authorization: `Bearer ${bearer}`,
  };
  if (segreto) headers['x-crawler-secret'] = segreto;
  let res: Response;
  try {
    res = await fetch(`${SUPABASE_URL_REMOTO}/functions/v1/crawler-admin`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ azione }),
    });
  } catch {
    throw new CrawlerTelemetriaError(
      "Errore di rete: impossibile raggiungere la Edge Function 'crawler-admin'.",
    );
  }

  const data = (await res.json().catch(() => null)) as Record<string, unknown> | null;
  if (res.status === 404) {
    throw new CrawlerTelemetriaError(
      "Edge Function 'crawler-admin' non deployata: `supabase functions deploy crawler-admin`.",
    );
  }
  if (!res.ok || data?.ok !== true) {
    const motivo =
      typeof data?.error === 'string'
        ? data.error
        : res.status === 401
          ? 'Sessione non valida: esegui il login come admin.'
          : `HTTP ${res.status}: telemetria non disponibile.`;
    throw new CrawlerTelemetriaError(motivo);
  }
  return data as T;
}

/** Numeri correnti della coda (sola lettura). */
export async function leggiTelemetriaCrawler(): Promise<TelemetriaCrawler> {
  const r = await chiama<{ ok: true; telemetria: TelemetriaCrawler }>('stato');
  return r.telemetria;
}

/** Avvia un giro di ingestione (GitHub Actions `workflow_dispatch`). */
export async function avviaScansioneWhitelist(): Promise<EsitoAvvio> {
  return chiama<EsitoAvvio>('scansione');
}

/** Formattazione compatta di un istante ISO in ora italiana (stringa vuota se assente). */
export function quando(iso: string | null | undefined): string {
  if (!iso) return 'mai';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'mai';
  return d.toLocaleString('it-IT', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}
