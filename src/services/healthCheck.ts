/**
 * ScuoleRadar.it — System Health Check (diagnostica in tempo reale).
 *
 * Modulo isolato e disaccoppiato dalla UI: esegue una serie di test asincroni
 * sullo stato dell'app (database, auth, chiavi/env, Edge Functions, rotte SPA,
 * servizi esterni) e restituisce risultati tipizzati. I test girano in
 * parallelo, non bloccano mai la UI e non scrivono nulla in console.
 */

import { supabase } from '@/lib/supabase';

/** Progetto Supabase remoto dove sono deployate le Edge Functions. */
const SUPABASE_URL_REMOTO = 'https://gwdmsgsshvdnfrplbjiv.supabase.co';

/** Rotta critiche della SPA (deve servire index.html senza 404 server-side). */
const ROTTE_CRITICHE = ['/', '/prezzi', '/chi-siamo', '/servizi', '/notizie', '/dashboard/radar'];

/** Risultato di un singolo test diagnostico. */
export interface HealthCheckResult {
  name: string;
  status: 'ok' | 'error' | 'warning';
  message: string;
  latencyMs?: number;
}

type CheckFn = () => Promise<{ status: HealthCheckResult['status']; message: string }>;

/** Esegue un check misurando la latenza; non lancia mai eccezioni al chiamante. */
async function misura(name: string, fn: CheckFn): Promise<HealthCheckResult> {
  const inizio = performance.now();
  try {
    const r = await fn();
    return {
      name,
      status: r.status,
      message: r.message,
      latencyMs: Math.round(performance.now() - inizio),
    };
  } catch (err) {
    return {
      name,
      status: 'error',
      message: (err as Error)?.message ?? 'Errore sconosciuto',
      latencyMs: Math.round(performance.now() - inizio),
    };
  }
}

/** Variabili d'ambiente esposte da Vite (defensive fuori dal browser/tsx). */
function envFrontend(): Record<string, string | undefined> {
  return (import.meta as unknown as { env?: Record<string, string | undefined> }).env ?? {};
}

/** Token di sessione dell'utente corrente (per le Edge Function protette da JWT). */
async function tokenSessione(): Promise<string | null> {
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

/** Esito di un ping a un'Edge Function remota. */
interface EsitoPing {
  status: number;
  data: Record<string, unknown> | null;
}

/** POST JSON a un'Edge Function remota (contatto è --no-verify-jwt; checkout richiede JWT). */
async function pingFunzione(
  nome: string,
  body: Record<string, unknown>,
  token?: string | null,
): Promise<EsitoPing> {
  const anon = envFrontend().VITE_SUPABASE_ANON_KEY ?? '';
  const headers: Record<string, string> = { 'Content-Type': 'application/json', apikey: anon };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${SUPABASE_URL_REMOTO}/functions/v1/${nome}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
  const data = (await res.json().catch(() => null)) as Record<string, unknown> | null;
  return { status: res.status, data };
}

/* ----------------------- Test: database & auth ----------------------- */

async function testDatabase(): Promise<{ status: HealthCheckResult['status']; message: string }> {
  if (!supabase) {
    return {
      status: 'warning',
      message: 'Supabase non configurato: app in modalità demo (nessuna connessione al database).',
    };
  }
  const { count, error } = await supabase
    .from('profiles')
    .select('id', { count: 'exact', head: true })
    .limit(1);
  if (error) {
    return { status: 'error', message: `Errore di connessione: ${error.message}` };
  }
  return { status: 'ok', message: `Database raggiungibile (${count ?? 0} profili presenti).` };
}

async function testSessione(): Promise<{ status: HealthCheckResult['status']; message: string }> {
  if (!supabase) {
    return { status: 'warning', message: 'Auth non configurata (modalità demo).' };
  }
  const { data, error } = await supabase.auth.getSession();
  if (error) {
    return { status: 'error', message: `Errore sessione: ${error.message}` };
  }
  return {
    status: 'ok',
    message: data.session
      ? `Sessione attiva (${data.session.user.email ?? data.session.user.id.slice(0, 8)}) — endpoint auth OK.`
      : 'Endpoint auth raggiungibile, nessuna sessione attiva.',
  };
}

async function testSegretiEnv(): Promise<{ status: HealthCheckResult['status']; message: string }> {
  const env = envFrontend();
  const mancanti: string[] = [];
  if (!env.VITE_SUPABASE_URL || env.VITE_SUPABASE_URL.includes('xxxx')) mancanti.push('VITE_SUPABASE_URL');
  if (!env.VITE_SUPABASE_ANON_KEY || env.VITE_SUPABASE_ANON_KEY.includes('xxxx')) {
    mancanti.push('VITE_SUPABASE_ANON_KEY');
  }
  if (mancanti.length > 0) {
    return {
      status: 'warning',
      message: `Chiavi mancanti o placeholder: ${mancanti.join(', ')}.`,
    };
  }
  return {
    status: 'ok',
    message: 'VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY configurate correttamente.',
  };
}

/* ----------------------- Test: Edge Functions ----------------------- */

async function testContatto(
  esito: EsitoPing,
): Promise<{ status: HealthCheckResult['status']; message: string }> {
  const { status, data } = esito;
  if (status === 0) {
    return { status: 'error', message: `Funzione non raggiungibile: ${data?.error ?? 'errore di rete'}` };
  }
  if (status === 404) return { status: 'error', message: 'Funzione non deployata (HTTP 404).' };
  if (status >= 500) return { status: 'error', message: `HTTP ${status}: ${data?.error ?? 'errore server'}` };
  if (status >= 400) return { status: 'warning', message: `HTTP ${status}: ${data?.error ?? 'risposta inattesa'}` };
  if (data?.configurato === true) {
    return {
      status: 'ok',
      message: `Mailer attivo (RESEND_API_KEY configurata, destinatario: ${data?.supportEmail ?? '—'}).`,
    };
  }
  return { status: 'warning', message: 'Funzione raggiungibile ma RESEND_API_KEY mancante sul server.' };
}

async function testCheckout(): Promise<{ status: HealthCheckResult['status']; message: string }> {
  try {
    const token = await tokenSessione();
    const { status, data } = await pingFunzione('checkout', { ping: true }, token);
    if (status === 401) {
      return {
        status: 'warning',
        message:
          'HTTP 401 ATTESO in modalità Guest: il checkout è protetto da JWT (comportamento di sicurezza). Autenticati per il ping completo dei segreti Stripe.',
      };
    }
    if (status === 404) return { status: 'error', message: 'Funzione non deployata (HTTP 404).' };
    if (status >= 500) return { status: 'error', message: `HTTP ${status}: ${data?.error ?? 'errore server'}` };
    if (status >= 400) return { status: 'warning', message: `HTTP ${status}: ${data?.error ?? 'risposta inattesa'}` };
    if (data?.configurato === true) {
      return { status: 'ok', message: 'Checkout configurato (STRIPE_SECRET_KEY e Price IDs presenti).' };
    }
    const mancanti = (data?.priceMancanti as string[] | undefined) ?? [];
    return {
      status: 'warning',
      message: `Checkout raggiungibile ma configurazione Stripe incompleta${
        mancanti.length ? ` (mancano: ${mancanti.join(', ')})` : ''
      }.`,
    };
  } catch (err) {
    return { status: 'error', message: `Non raggiungibile: ${(err as Error).message}` };
  }
}

/* ----------------------- Test: rotte SPA ----------------------- */

async function testRotteSpa(): Promise<{ status: HealthCheckResult['status']; message: string }> {
  const esiti = await Promise.all(
    ROTTE_CRITICHE.map(async (rotta) => {
      try {
        const res = await fetch(rotta, { headers: { Accept: 'text/html' } });
        return { rotta, ok: res.ok };
      } catch {
        return { rotta, ok: false };
      }
    }),
  );
  const ko = esiti.filter((e) => !e.ok);
  if (ko.length > 0) {
    return { status: 'error', message: `Rotte non servite: ${ko.map((e) => e.rotta).join(', ')}.` };
  }
  return {
    status: 'ok',
    message: `${esiti.length} rotte critiche servite dalla piattaforma (nessun 404 server-side).`,
  };
}

/* ----------------------- Test: servizi esterni ----------------------- */

/**
 * Stato del servizio email (Resend): NON si interroga direttamente
 * https://api.resend.com dal browser (bloccato da CORS → 'Failed to fetch').
 * Il verde è determinato dal ping dell'Edge Function `contatto` (HTTP 200 +
 * RESEND_API_KEY configurata).
 */
async function testResend(
  esito: EsitoPing,
): Promise<{ status: HealthCheckResult['status']; message: string }> {
  const { status, data } = esito;
  if (status === 0) {
    return {
      status: 'error',
      message: `Servizio email non verificabile: ${data?.error ?? 'funzione contatto non raggiungibile'}.`,
    };
  }
  if (status === 200 && data?.configurato === true) {
    return { status: 'ok', message: 'Servizio email attivo (mailer contatto OK, RESEND_API_KEY configurata).' };
  }
  if (status === 200) {
    return { status: 'warning', message: 'Mailer raggiungibile ma RESEND_API_KEY mancante sul server.' };
  }
  return { status: 'warning', message: `Servizio email non verificato (contatto HTTP ${status}).` };
}

async function testFonteMim(): Promise<{ status: HealthCheckResult['status']; message: string }> {
  try {
    const res = await fetch('https://www.mim.gov.it/web/guest/notizie', {
      headers: { Accept: 'text/html' },
    });
    if (res.ok) return { status: 'ok', message: `Feed MIM raggiungibile (HTTP ${res.status}).` };
    return {
      status: 'warning',
      message: `MIM ha risposto HTTP ${res.status}: il blog usa il fallback (seed) finché non torna.`,
    };
  } catch (err) {
    const msg = (err as Error)?.message ?? 'Errore sconosciuto';
    const limitazioneCors = /Failed to fetch|NetworkError|load failed|fetch/i.test(msg);
    return {
      status: 'warning',
      message: limitazioneCors
        ? 'Fonte MIM non verificabile dal browser (CORS): attivo il fallback seed. Nessun errore di servizio.'
        : `MIM non raggiungibile: ${msg} (fallback seed attivo).`,
    };
  }
}

/* ----------------------- Aggregatore ----------------------- */

/** Esegue tutti i test diagnostici in parallelo (non blocca mai la UI). */
export async function eseguiHealthCheck(): Promise<HealthCheckResult[]> {
  // Ping condiviso della Edge Function `contatto`: alimenta sia il check del
  // mailer sia quello del servizio email (Resend), evitando chiamate dirette
  // dal browser a https://api.resend.com (bloccate da CORS).
  const pingContatto: EsitoPing = await pingFunzione('contatto', { ping: true }).catch((err) => ({
    status: 0,
    data: { error: (err as Error).message },
  }));

  const checks: Array<Promise<HealthCheckResult>> = [
    misura('Supabase / Database', testDatabase),
    misura('Supabase Auth / Sessione', testSessione),
    misura('Chiavi & Segreti (Env)', testSegretiEnv),
    misura('Edge Function contatto (mailer)', () => testContatto(pingContatto)),
    misura('Edge Function checkout (pagamenti)', testCheckout),
    misura('Rotte & Pagine (SPA)', testRotteSpa),
    misura('Servizio Email (Resend)', () => testResend(pingContatto)),
    misura('Fonte Notizie (MIM)', testFonteMim),
  ];
  return Promise.all(checks);
}
