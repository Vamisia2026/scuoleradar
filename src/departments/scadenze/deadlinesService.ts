/**
 * ScuoleRadar.it — Servizio dati Scadenze.
 *
 * Livello dati del Dipartimento Scadenze: carica la master list dal
 * fallback locale `src/data/deadlinesFallback.json` e, quando disponibile,
 * applica un OVERRIDE dinamico da una delle due sorgenti remote:
 *
 *   1. API/Edge Function generica  → `VITE_DEADLINES_API_URL` (fetch JSON);
 *   2. Tabella Supabase            → `school_deadlines` (chiave anon, lettura
 *      pubblica), aggiornabile da cron-scraper / feed RSS delle fonti
 *      istituzionali (MIM, INVALSI, INPS, ARAN, Gazzetta Ufficiale) tramite
 *      lo script `npm run scadenze:sync` (scripts/sync-deadlines.ts).
 *
 * Strategia di merge: il record remoto VINCE per id su quello locale;
 * i record solo-locali restano (fallback sempre completo). Se la sorgente
 * remota non è configurata o fallisce, l'app usa i dati locali.
 */

import { supabase } from '@/lib/supabase';
import type { DeadlineRecord, OrigineScadenze } from './types';
import scadenzeFallbackJson from '../../data/deadlinesFallback.json';

/** Sorgente master locale (sempre disponibile, bundlata nell'app). */
export const scadenzeFallback = scadenzeFallbackJson as DeadlineRecord[];

// Difensivo: in ambienti senza Vite (es. test Node/tsx) `import.meta.env`
// può essere undefined → nessuna sorgente remota, solo fallback locale.
const env = (import.meta as unknown as { env?: Record<string, string | undefined> }).env ?? {};

const API_URL = (env.VITE_DEADLINES_API_URL as string | undefined)?.trim();

/* ------------------------- Normalizzazione record ------------------------- */

function testo(valore: unknown): string | null {
  if (typeof valore !== 'string') return null;
  const pulito = valore.trim();
  return pulito.length > 0 ? pulito : null;
}

function booleano(valore: unknown): boolean | undefined {
  if (typeof valore === 'boolean') return valore;
  if (typeof valore === 'string') {
    const v = valore.toLowerCase();
    if (v === 'true' || v === '1') return true;
    if (v === 'false' || v === '0') return false;
  }
  if (typeof valore === 'number') return valore !== 0;
  return undefined;
}

/**
 * Normalizza una riga generica (Supabase snake_case o API camelCase) nel
 * modello `DeadlineRecord`. Riga invalida ⇒ null.
 */
export function normalizzaRiga(riga: Record<string, unknown>): DeadlineRecord | null {
  const id = testo(riga.id);
  const title = testo(riga.title);
  const category = testo(riga.category);
  const typeRaw = testo(riga.type);
  if (!id || !title || !category || (typeRaw !== 'exact' && typeRaw !== 'window')) {
    return null;
  }
  return {
    id,
    category,
    title,
    type: typeRaw,
    date: testo(riga.date),
    startDate: testo(riga.startDate ?? riga.start_date),
    endDate: testo(riga.endDate ?? riga.end_date),
    phase: testo(riga.phase),
    target: testo(riga.target),
    source: testo(riga.source),
    officialSourceUrl: testo(riga.officialSourceUrl ?? riga.official_source_url),
    active: booleano(riga.active) ?? true,
  };
}

function listaValida(lista: unknown): DeadlineRecord[] {
  if (!Array.isArray(lista)) return [];
  return lista
    .map((r) =>
      r && typeof r === 'object'
        ? normalizzaRiga(r as Record<string, unknown>)
        : null,
    )
    .filter((r): r is DeadlineRecord => r !== null);
}

/* ------------------------- Sorgenti remote (override) ------------------------- */

/** 1) Edge Function / API generica configurata via VITE_DEADLINES_API_URL. */
async function caricaDaApi(): Promise<DeadlineRecord[] | null> {
  if (!API_URL) return null;
  const risposta = await fetch(API_URL, {
    headers: { Accept: 'application/json' },
  });
  if (!risposta.ok) throw new Error(`API scadenze HTTP ${risposta.status}`);
  const corpo: unknown = await risposta.json();
  const dati = Array.isArray(corpo)
    ? corpo
    : (corpo as { data?: unknown }).data;
  return listaValida(dati);
}

/** 2) Tabella Supabase `school_deadlines` (lettura pubblica con chiave anon). */
async function caricaDaSupabase(): Promise<DeadlineRecord[] | null> {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from('school_deadlines')
    .select('*')
    .eq('active', true);
  if (error) throw error;
  return listaValida(data as unknown[]);
}

/* ------------------------------ Merge + cache ------------------------------ */

/** Unisce locale + remoto: il remoto vince per id, il locale copre i buchi. */
export function fondeScadenze(
  locale: readonly DeadlineRecord[],
  remota: readonly DeadlineRecord[],
): DeadlineRecord[] {
  const perId = new Map<string, DeadlineRecord>();
  for (const r of locale) perId.set(r.id, r);
  for (const r of remota) {
    if (r.active === false) {
      perId.delete(r.id); // il remoto può disattivare un record locale
    } else {
      perId.set(r.id, r);
    }
  }
  return [...perId.values()];
}

export interface RisultatoScadenze {
  lista: DeadlineRecord[];
  origine: OrigineScadenze;
}

let cacheRisultato: Promise<RisultatoScadenze> | null = null;

/**
 * Master list per il revolver. Prima chiamata: fallback locale immediato a
 * cui viene applicato l'override remoto (se disponibile) — chiamate successive
 * riusano la stessa Promise (nessun doppio fetch a parità di sessione).
 */
export function caricaScadenzeMaster(): Promise<RisultatoScadenze> {
  const giaCaricato = cacheRisultato;
  if (giaCaricato) return giaCaricato;

  const nuova = (async (): Promise<RisultatoScadenze> => {
    const remotaApi = await caricaDaApi();
    if (remotaApi) {
      return { lista: fondeScadenze(scadenzeFallback, remotaApi), origine: 'api' };
    }

    const remotaDb = await caricaDaSupabase();
    if (remotaDb) {
      return {
        lista: fondeScadenze(scadenzeFallback, remotaDb),
        origine: 'supabase',
      };
    }

    return { lista: [...scadenzeFallback], origine: 'fallback' };
  })().catch((): RisultatoScadenze => ({
    lista: [...scadenzeFallback],
    origine: 'fallback',
  }));

  cacheRisultato = nuova;
  return nuova;
}

/** Resetta la cache (utile in test / devtool). */
export function azzeraCacheScadenze(): void {
  cacheRisultato = null;
}
