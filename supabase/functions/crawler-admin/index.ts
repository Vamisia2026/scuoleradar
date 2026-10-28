/**
 * ScuoleRadar.it — Edge Function `crawler-admin` (telemetria + trigger manuale).
 *
 * Perché esiste: la sezione «Crawler Telemetry» del System Health Check (DEV)
 * deve leggere i numeri veri della coda di scansione e poter AVVIARE un giro
 * senza passare da GitHub → Actions. Le tabelle di servizio
 * (`discovered_links`, `scraper_runs`) sono RLS-locked al solo `service_role`,
 * quindi la lettura non può stare nel browser: qui.
 *
 * AZIONI (POST JSON `{ "azione": "stato" | "scansione" }`)
 *  · `stato`      → conteggi aggregati + ultima scansione + ultima run. Richiede
 *                   una sessione valida (nessun dato personale: solo numeri).
 *  · `scansione`  → `workflow_dispatch` del workflow di ingestione su GitHub
 *                   (`scraper.yml` di default). Richiede un ADMIN
 *                   (`ADMIN_EMAILS`, stessa regola della Edge `admin`) oppure
 *                   l'header `x-crawler-secret` = `CRAWLER_TRIGGER_SECRET`
 *                   (lanci da terminale/CI). Se `GITHUB_DISPATCH_TOKEN` non è
 *                   configurato risponde 503 con il motivo: nessun falso OK.
 *
 * SEGRETI (Supabase → Edge Functions → Secrets)
 *   GITHUB_DISPATCH_TOKEN     PAT fine-grained con `actions: write` sul repo.
 *   GITHUB_REPO               default `Vamisia2026/scuoleradar`.
 *   GITHUB_DISPATCH_WORKFLOW  default `scraper.yml` (`discovery.yml` per la BFS).
 *   GITHUB_DISPATCH_REF       default `main`.
 *   CRAWLER_TRIGGER_SECRET    opzionale (sblocca il trigger senza login admin).
 *   ADMIN_EMAILS              opzionale, stessa semantica della Edge `admin`.
 *
 * Deploy: `supabase functions deploy crawler-admin` (JWT verificato: nessuna
 * funzione `--no-verify-jwt`, così il gateway rifiuta le chiamate anonime).
 */
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const ADMIN_EMAILS = (Deno.env.get('ADMIN_EMAILS') ?? 'bartoloansaldi@gmail.com,myvamisia@gmail.com')
  .split(',')
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean);
const GITHUB_TOKEN = Deno.env.get('GITHUB_DISPATCH_TOKEN') ?? '';
const GITHUB_REPO = Deno.env.get('GITHUB_REPO') ?? 'Vamisia2026/scuoleradar';
const GITHUB_WORKFLOW = Deno.env.get('GITHUB_DISPATCH_WORKFLOW') ?? 'scraper.yml';
const GITHUB_REF = Deno.env.get('GITHUB_DISPATCH_REF') ?? 'main';
const SEGRETO_TRIGGER = Deno.env.get('CRAWLER_TRIGGER_SECRET') ?? '';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-crawler-secret',
};

/** Stati della coda che rappresentano uno SCARTO dichiarato dal motore. */
const STATI_SCARTATI = [
  'disqualified_noise',
  'empty_view',
  'parked_low_score',
  'parked_for_pdf',
  'disabled',
];

interface TelemetriaCrawler {
  /** Fonti in whitelist che il runner legge davvero (`active_crawler`). */
  fonti_whitelist: number;
  /** Pagine scoperte e ancora da lavorare (`pending`). */
  pagine_in_coda: number;
  /** Voci scartate dal motore (rumore, viste vuote, parcheggi, domini spenti). */
  scarti: number;
  /** Sottoinsieme degli scarti: voci fermate per errore interno. */
  in_errore: number;
  /** Interpelli vivi nel database (`expiration_date` ≥ oggi). */
  interpelli_attivi: number;
  /** Interpelli totali (anche scaduti e senza data). */
  interpelli_totali: number;
  /** Fonti whitelist ricontrollate nelle ultime 24 ore. */
  scansionate_24h: number;
  ultima_scansione: string | null;
  ultima_run: {
    started_at: string;
    esito: string;
    trovati: number;
    nuovi: number;
    errori: number;
  } | null;
  aggiornato_il: string;
}

function risposta(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json; charset=utf-8' },
  });
}

/** Utente della sessione (null = token assente o non valido). */
async function utenteDaJwt(req: Request) {
  const auth = req.headers.get('Authorization') ?? '';
  const jwt = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!jwt) return null;
  const sb = createClient(SUPABASE_URL, SERVICE_ROLE, {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
  });
  const { data, error } = await sb.auth.getUser(jwt);
  if (error || !data.user) return null;
  const { data: prof } = await sb.from('profiles').select('email').eq('id', data.user.id).single();
  return {
    id: data.user.id,
    email: String(prof?.email ?? data.user.email ?? '').toLowerCase(),
  };
}

/** Conteggio esatto (`head: true`: nessuna riga trasferita, nessun troncamento). */
async function conta(
  sb: ReturnType<typeof createClient>,
  tabella: string,
  patch: Record<string, string> = {},
): Promise<number> {
  let query = sb.from(tabella).select('*', { count: 'exact', head: true });
  for (const [chiave, valore] of Object.entries(patch)) query = query.eq(chiave, valore);
  const { count, error } = await query;
  if (error) throw new Error(`${tabella}: ${error.message}`);
  return count ?? 0;
}

async function telemetria(sb: ReturnType<typeof createClient>): Promise<TelemetriaCrawler> {
  const oggi = new Date().toISOString().slice(0, 10);
  const ieri = new Date(Date.now() - 86_400_000).toISOString();

  const fontiWhitelist = await conta(sb, 'discovered_links', { status: 'active_crawler' });
  const pagineInCoda = await conta(sb, 'discovered_links', { status: 'pending' });
  const scarti = (
    await Promise.all(STATI_SCARTATI.map((stato) => conta(sb, 'discovered_links', { status: stato })))
  ).reduce((somma, n) => somma + n, 0);
  const inErrore = await conta(sb, 'discovered_links', { status: 'error_internal' });
  const interpelliTotali = await conta(sb, 'interpelli');

  const { count: attivi } = await sb
    .from('interpelli')
    .select('*', { count: 'exact', head: true })
    .gte('expiration_date', `${oggi}T00:00:00+00:00`);
  const { count: scansionate } = await sb
    .from('discovered_links')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'active_crawler')
    .gte('last_scanned_at', ieri);
  const { data: ultima } = await sb
    .from('discovered_links')
    .select('last_scanned_at')
    .not('last_scanned_at', 'is', null)
    .order('last_scanned_at', { ascending: false })
    .limit(1);
  const { data: run } = await sb
    .from('scraper_runs')
    .select('started_at, esito, trovati, nuovi, errori')
    .order('started_at', { ascending: false })
    .limit(1);

  const ultimaRun = (run ?? [])[0] as TelemetriaCrawler['ultima_run'];

  return {
    fonti_whitelist: fontiWhitelist,
    pagine_in_coda: pagineInCoda,
    scarti,
    in_errore: inErrore,
    interpelli_attivi: attivi ?? 0,
    interpelli_totali: interpelliTotali,
    scansionate_24h: scansionate ?? 0,
    ultima_scansione:
      ((ultima ?? [])[0] as { last_scanned_at?: string } | undefined)?.last_scanned_at ?? null,
    ultima_run: ultimaRun ?? null,
    aggiornato_il: new Date().toISOString(),
  };
}

/** `workflow_dispatch` del workflow di ingestione. */
async function avviaWorkflow(): Promise<
  { ok: true } | { ok: false; status: number; motivo: string }
> {
  if (!GITHUB_TOKEN) {
    return {
      ok: false,
      status: 503,
      motivo:
        'GITHUB_DISPATCH_TOKEN non configurato: aggiungi il secret (PAT con actions:write) ' +
        'nelle impostazioni delle Edge Functions per abilitare il trigger manuale.',
    };
  }
  const url = `https://api.github.com/repos/${GITHUB_REPO}/actions/workflows/${GITHUB_WORKFLOW}/dispatches`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${GITHUB_TOKEN}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json',
      'User-Agent': 'ScuoleRadar-crawler-admin',
    },
    body: JSON.stringify({ ref: GITHUB_REF }),
  });
  if (res.status === 204) return { ok: true };
  const dettaglio = (await res.text().catch(() => '')).slice(0, 300);
  return {
    ok: false,
    status: 502,
    motivo: `GitHub ha risposto ${res.status}: ${dettaglio || 'nessun dettaglio'}`,
  };
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  if (req.method !== 'POST') return risposta({ error: 'Metodo non consentito' }, 405);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return risposta({ error: 'Bad Request' }, 400);
  }
  const azione = String(body.azione ?? '');

  try {
    const utente = await utenteDaJwt(req);
    if (!utente) return risposta({ error: 'Sessione non valida: esegui il login.' }, 401);

    const sb = createClient(SUPABASE_URL, SERVICE_ROLE);

    if (azione === 'stato') {
      return risposta({ ok: true, telemetria: await telemetria(sb) });
    }

    if (azione === 'scansione') {
      const segretoValido =
        SEGRETO_TRIGGER !== '' && req.headers.get('x-crawler-secret') === SEGRETO_TRIGGER;
      const adminValido = ADMIN_EMAILS.includes(utente.email);
      if (!adminValido && !segretoValido) {
        return risposta(
          { error: `Solo un admin può avviare una scansione (utente: ${utente.email}).` },
          403,
        );
      }
      const esito = await avviaWorkflow();
      if (!esito.ok) return risposta({ error: esito.motivo }, esito.status);
      return risposta({
        ok: true,
        avviato: true,
        workflow: GITHUB_WORKFLOW,
        repo: GITHUB_REPO,
        telemetria: await telemetria(sb),
      });
    }

    return risposta({ error: `azione sconosciuta: ${azione}` }, 400);
  } catch (err) {
    return risposta({ error: (err as Error).message }, 500);
  }
});

