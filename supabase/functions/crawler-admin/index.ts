/**
 * ScuoleRadar.it — Edge Function `crawler-admin` (telemetria + trigger manuale).
 *
 * Perché esiste: la sezione «Crawler Telemetry» del System Health Check (DEV) deve
 * leggere i numeri veri della coda di scansione e poter AVVIARE un giro senza
 * passare da GitHub → Actions. `discovered_links` e `scraper_runs` sono RLS-locked
 * al `service_role`, quindi la lettura non può stare nel browser: sta qui.
 *
 * POST JSON `{ "azione": "stato" | "scansione" }`
 *   · `stato`     → conteggi aggregati, ultima scansione, ultima run. Basta una
 *                   sessione valida (solo numeri) o l'header `x-crawler-secret`.
 *   · `scansione` → `workflow_dispatch` del workflow di ingestione. Autorizza, in
 *                   ordine: `x-crawler-secret` = `CRAWLER_TRIGGER_SECRET` (CI,
 *                   terminale, DEV Bar senza login) · `ADMIN_EMAILS` ·
 *                   `CRAWLER_DEV_EMAILS` (allowlist DEV/TEST) · SVILUPPO/TEST
 *                   DICHIARATO (`ENVIRONMENT` = dev/local/test/staging,
 *                   `CRAWLER_ALLOW_DEV=1` o URL Supabase locale), dove può avviare
 *                   il giro qualunque sessione valida. In produzione (`ENVIRONMENT`
 *                   assente o `production`) quest'ultima regola NON esiste.
 *
 * SEGRETI: `GITHUB_DISPATCH_TOKEN` (PAT con `actions:write`) · `GITHUB_REPO` ·
 * `GITHUB_DISPATCH_WORKFLOW` · `GITHUB_DISPATCH_REF` · `CRAWLER_TRIGGER_SECRET` ·
 * `CRAWLER_DEV_EMAILS` · `ENVIRONMENT` / `CRAWLER_ALLOW_DEV` · `ADMIN_EMAILS`.
 *
 * Deploy: `supabase functions deploy crawler-admin` (JWT verificato: nessuna
 * funzione `--no-verify-jwt`, così il gateway rifiuta le chiamate anonime).
 */
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

/** Lista di email da una variabile d'ambiente (minuscole, senza spazi, senza vuoti). */
function listaEmail(valore: string | undefined): string[] {
  return (valore ?? '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

const ADMIN_EMAILS = listaEmail(
  Deno.env.get('ADMIN_EMAILS') ?? 'bartoloansaldi@gmail.com,myvamisia@gmail.com',
);
/** Allowlist DEV/TEST: ammessa al trigger senza toccare gli admin principali. */
const DEV_EMAILS = listaEmail(Deno.env.get('CRAWLER_DEV_EMAILS'));
const GITHUB_TOKEN = Deno.env.get('GITHUB_DISPATCH_TOKEN') ?? '';
const GITHUB_REPO = Deno.env.get('GITHUB_REPO') ?? 'Vamisia2026/scuoleradar';
const GITHUB_WORKFLOW = Deno.env.get('GITHUB_DISPATCH_WORKFLOW') ?? 'scraper.yml';
const GITHUB_REF = Deno.env.get('GITHUB_DISPATCH_REF') ?? 'main';
const SEGRETO_TRIGGER = Deno.env.get('CRAWLER_TRIGGER_SECRET') ?? '';

/** Ambiente dichiarato del deploy (assente = produzione). */
const AMBIENTE = (Deno.env.get('ENVIRONMENT') ?? Deno.env.get('APP_ENV') ?? '').toLowerCase();

/**
 * SVILUPPO/TEST DICHIARATO: `ENVIRONMENT` dell'ambiente, `CRAWLER_ALLOW_DEV`
 * attivo oppure URL Supabase locale (`supabase start`). Solo in questo stato una
 * qualunque sessione valida può avviare il giro: in produzione (`ENVIRONMENT`
 * assente o `production`) la regola NON esiste e restano admin, allowlist DEV e
 * segreto di trigger.
 */
const SVILUPPO =
  ['dev', 'development', 'local', 'test', 'testing', 'staging'].includes(AMBIENTE) ||
  ['1', 'true', 'yes', 'on'].includes((Deno.env.get('CRAWLER_ALLOW_DEV') ?? '').toLowerCase()) ||
  /localhost|127\.0\.0\.1/.test(SUPABASE_URL);

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-crawler-secret',
};

/** Stati della coda che rappresentano uno SCARTO dichiarato dal motore. */
const STATI_SCARTATI = ['disqualified_noise', 'empty_view', 'parked_low_score', 'parked_for_pdf', 'disabled'];

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
  ultima_run: { started_at: string; esito: string; trovati: number; nuovi: number; errori: number } | null;
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
  return { id: data.user.id, email: String(prof?.email ?? data.user.email ?? '').toLowerCase() };
}

/** Chi ha autorizzato la chiamata (`da` torna nella risposta: diagnosi, non fiducia). */
type Fonte = 'admin' | 'allowlist-dev' | 'segreto' | 'sessione' | 'sviluppo-locale';

/** Esito dell'autorizzazione: `motivo`/`status` sono pronti per la UI. */
interface Autorizzazione {
  ok: boolean;
  da: Fonte | null;
  motivo?: string;
  status?: number;
}

/**
 * Decide CHI può fare cosa, in un solo punto: 1) header `x-crawler-secret` =
 * `CRAWLER_TRIGGER_SECRET` (CI, terminale, DEV Bar senza login via
 * `VITE_CRAWLER_DEV_SECRET`); 2) `ADMIN_EMAILS` e `CRAWLER_DEV_EMAILS`; 3)
 * SVILUPPO/TEST dichiarato: qualunque sessione valida (mai in produzione);
 * 4) `stato`: qualunque sessione valida (solo numeri aggregati).
 */
function autorizza(
  azione: 'stato' | 'scansione',
  utente: { email: string } | null,
  req: Request,
): Autorizzazione {
  const segretoValido =
    SEGRETO_TRIGGER !== '' && req.headers.get('x-crawler-secret') === SEGRETO_TRIGGER;
  if (segretoValido) return { ok: true, da: 'segreto' };
  const email = utente?.email ?? '';
  if (email && ADMIN_EMAILS.includes(email)) return { ok: true, da: 'admin' };
  if (email && DEV_EMAILS.includes(email)) return { ok: true, da: 'allowlist-dev' };
  if (SVILUPPO && utente) return { ok: true, da: 'sviluppo-locale' };
  if (azione === 'stato' && utente) return { ok: true, da: 'sessione' };
  if (azione === 'stato') {
    return {
      ok: false,
      da: null,
      status: 401,
      motivo:
        'Serve una sessione valida: la telemetria del crawler legge tabelle di servizio. ' +
        'In sviluppo: login, oppure header x-crawler-secret (VITE_CRAWLER_DEV_SECRET).',
    };
  }
  return {
    ok: false,
    da: null,
    status: 403,
    motivo:
      `Solo un admin può avviare una scansione (utente: ${email || 'anonimo'}). ` +
      'In sviluppo: email in CRAWLER_DEV_EMAILS, header x-crawler-secret oppure ' +
      'ENVIRONMENT=dev/test (una qualunque sessione valida).',
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

/** Numeri della coda: le letture sono indipendenti e partono tutte insieme. */
async function telemetria(sb: ReturnType<typeof createClient>): Promise<TelemetriaCrawler> {
  const oggi = new Date().toISOString().slice(0, 10);
  const ieri = new Date(Date.now() - 86_400_000).toISOString();
  const [fonti, coda, scartiGrezzi, errori, totali, attivi, scansionate, ultima, run] =
    await Promise.all([
      conta(sb, 'discovered_links', { status: 'active_crawler' }),
      conta(sb, 'discovered_links', { status: 'pending' }),
      Promise.all(STATI_SCARTATI.map((s) => conta(sb, 'discovered_links', { status: s }))),
      conta(sb, 'discovered_links', { status: 'error_internal' }),
      conta(sb, 'interpelli'),
      sb.from('interpelli').select('*', { count: 'exact', head: true })
        .gte('expiration_date', `${oggi}T00:00:00+00:00`),
      sb.from('discovered_links').select('*', { count: 'exact', head: true })
        .eq('status', 'active_crawler').gte('last_scanned_at', ieri),
      sb.from('discovered_links').select('last_scanned_at')
        .not('last_scanned_at', 'is', null).order('last_scanned_at', { ascending: false }).limit(1),
      sb.from('scraper_runs').select('started_at, esito, trovati, nuovi, errori')
        .order('started_at', { ascending: false }).limit(1),
    ]);

  return {
    fonti_whitelist: fonti,
    pagine_in_coda: coda,
    scarti: (scartiGrezzi as number[]).reduce((somma: number, n: number) => somma + n, 0),
    in_errore: errori,
    interpelli_attivi: attivi.count ?? 0,
    interpelli_totali: totali,
    scansionate_24h: scansionate.count ?? 0,
    ultima_scansione:
      ((ultima.data ?? [])[0] as { last_scanned_at?: string } | undefined)?.last_scanned_at ?? null,
    ultima_run: ((run.data ?? [])[0] as TelemetriaCrawler['ultima_run']) ?? null,
    aggiornato_il: new Date().toISOString(),
  };
}

/** `workflow_dispatch` del workflow di ingestione. */
async function avviaWorkflow(): Promise<{ ok: true } | { ok: false; status: number; motivo: string }> {
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
  if (azione !== 'stato' && azione !== 'scansione') {
    return risposta({ error: `azione sconosciuta: ${azione}` }, 400);
  }

  try {
    const utente = await utenteDaJwt(req);
    const auth = autorizza(azione, utente, req);
    if (!auth.ok) {
      return risposta(
        { error: auth.motivo, ambiente: AMBIENTE || 'produzione', sviluppo: SVILUPPO },
        auth.status ?? 403,
      );
    }

    const sb = createClient(SUPABASE_URL, SERVICE_ROLE);
    if (azione === 'stato') {
      return risposta({ ok: true, autorizzato_da: auth.da, telemetria: await telemetria(sb) });
    }

    // `autorizza` ha già deciso CHI può: qui si esegue soltanto.
    const esito = await avviaWorkflow();
    if (!esito.ok) return risposta({ error: esito.motivo, autorizzato_da: auth.da }, esito.status);
    return risposta({
      ok: true,
      avviato: true,
      autorizzato_da: auth.da,
      workflow: GITHUB_WORKFLOW,
      repo: GITHUB_REPO,
      telemetria: await telemetria(sb),
    });
  } catch (err) {
    return risposta({ error: (err as Error).message }, 500);
  }
});

