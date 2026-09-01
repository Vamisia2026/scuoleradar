/**
 * Analytics leggero e privacy-first (compatibile PostHog).
 *
 * - Nessun SDK esterno: gli eventi vengono inviati direttamente a PostHog via
 *   `navigator.sendBeacon` (fallback `fetch` con `keepalive`) → asincrono,
 *   non bloccante, zero impatto sul rendering/LCP.
 * - Nessun cookie e nessun consent modal intrusivo: un solo ID anonimo salvato
 *   in localStorage (nessun dato personale inviato).
 * - Attivo SOLO se `VITE_POSTHOG_KEY` è configurato nel `.env`; altrimenti
 *   ogni funzione è un no-op totale (l'app non viene mai rallentata o rotta).
 *
 * Eventi tracciati:
 *   - `$pageview`              → cambio rotta (pagina + referrer/source visitatore)
 *   - `visit_started`          → prima visita per visitatore (referrer sticky)
 *   - `cta_pro_click`          → click su CTA "Diventa PRO" (PrezziPage / Vetrina)
 *   - `checkout_started`       → avvio sessione checkout Stripe (piano/promo/quantità)
 *   - `signup_attempted`       → invio form di registrazione email
 *   - `signup_success`         → account creato (email) / modalità demo
 *   - `signin_google_started`  → avvio login Google OAuth
 */

// Difensivo: in ambienti senza Vite (es. test Node/tsx) `import.meta.env` può
// essere undefined → il tracker resta disattivato (nessun invio di rete).
const env = (import.meta as unknown as { env?: Record<string, string | undefined> }).env ?? {};
const POSTHOG_KEY = (env.VITE_POSTHOG_KEY ?? '').trim();
const POSTHOG_HOST = ((env.VITE_POSTHOG_HOST ?? '').trim() || 'https://eu.i.posthog.com').replace(/\/+$/, '');

const STORAGE_ANON_ID = 'scuoleradar:anon_id';
const STORAGE_VISITED = 'scuoleradar:visit_tracked';

let attivo = false;
let anonId = '';

function getOrCreateAnonId(): string {
  try {
    let id = localStorage.getItem(STORAGE_ANON_ID);
    if (!id) {
      id = `anon-${crypto.randomUUID()}`;
      localStorage.setItem(STORAGE_ANON_ID, id);
    }
    return id;
  } catch {
    // localStorage non disponibile: ID effimero per la sessione corrente
    return `anon-${crypto.randomUUID()}`;
  }
}

/** Sorgente del visitatore in base al referrer (privacy-first: solo dominio). */
function sorgenteVisitante(): string {
  const r = document.referrer?.trim();
  if (!r) return 'direct';
  try {
    const host = new URL(r).hostname;
    if (host === window.location.hostname) return 'internal';
    if (/(^|\.)(google|bing|duckduckgo|search)\./i.test(host)) return 'organic-search';
    return host;
  } catch {
    return 'direct';
  }
}

function referrerDomain(): string | null {
  const r = document.referrer?.trim();
  if (!r) return null;
  try {
    return new URL(r).hostname;
  } catch {
    return null;
  }
}

function baseProperties(): Record<string, unknown> {
  return {
    $current_url: window.location.href,
    $pathname: window.location.pathname,
    $referrer: document.referrer || null,
    $referring_domain: referrerDomain(),
    source: sorgenteVisitante(),
  };
}

/** Invia l'evento a PostHog in modo fire-and-forget (mai sincrono/bloccante). */
function invia(evento: string, properties?: Record<string, unknown>, distinct?: string): void {
  try {
    const payload = JSON.stringify({
      api_key: POSTHOG_KEY,
      event: evento,
      distinct_id: distinct ?? anonId,
      timestamp: new Date().toISOString(),
      properties: {
        ...baseProperties(),
        ...properties,
        $lib: 'web',
        $lib_version: '1.0.0',
      },
    });
    const url = `${POSTHOG_HOST}/capture/`;
    if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
      const ok = navigator.sendBeacon(url, new Blob([payload], { type: 'text/plain;charset=utf-8' }));
      if (!ok) {
        void fetch(url, {
          method: 'POST',
          body: payload,
          keepalive: true,
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        });
      }
    } else {
      void fetch(url, {
        method: 'POST',
        body: payload,
        keepalive: true,
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      });
    }
  } catch {
    // L'analytics non deve MAI rompere l'app o la navigazione.
  }
}

/** Inizializza il tracker (no-op se VITE_POSTHOG_KEY manca). Da chiamare UNA volta all'avvio. */
export function initAnalytics(): void {
  if (attivo || !POSTHOG_KEY) return;
  attivo = true;
  anonId = getOrCreateAnonId();
  try {
    if (!localStorage.getItem(STORAGE_VISITED)) {
      localStorage.setItem(STORAGE_VISITED, '1');
      invia('visit_started', {
        first_referrer: document.referrer || null,
        first_source: sorgenteVisitante(),
      });
    }
  } catch {
    // localStorage non disponibile: traccia comunque la prima visita una sola volta
    invia('visit_started', {
      first_referrer: document.referrer || null,
      first_source: sorgenteVisitante(),
    });
  }
}

/** Pagina vista: chiamare a ogni cambio rotta (SPA). */
export function trackPageview(): void {
  if (!attivo) return;
  invia('$pageview', { $title: document.title });
}

/** Evento custom (fire-and-forget, asincrono, non bloccante). */
export function track(evento: string, properties?: Record<string, unknown>): void {
  if (!attivo) return;
  invia(evento, properties);
}

/** Collega l'ID anonimo all'ID utente Supabase (nessun dato personale inviato). */
export function identify(userId: string): void {
  if (!attivo || !userId) return;
  const vecchio = anonId;
  anonId = userId;
  if (vecchio && vecchio !== userId) {
    invia('$identify', { $anon_distinct_id: vecchio }, userId);
  }
  try {
    localStorage.setItem(STORAGE_ANON_ID, userId);
  } catch {
    // localStorage non disponibile: l'ID resta valido per la sessione corrente
  }
}
