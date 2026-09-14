/**
 * ScuoleRadar.it — Ledger dei POST sui canali Telegram (Node-only, best-effort).
 *
 * Problema risolto: lo stesso avviso veniva ripubblicato sui canali a OGNI run
 * dello scraper quando l'upsert su `interpelli` veniva ignorato o falliva
 * (l'avviso risultava di nuovo "nuovo"). Qui la pubblicazione è tracciata per
 * coppia (interpello, canale) nella tabella `channel_posts_log`
 * (migrazione 20260914020000): se la coppia esiste già, l'invio si salta.
 *
 * Nessuna funzione lancia mai: senza credenziali o senza tabella il ledger
 * risulta "vuoto" e la pipeline continua (best-effort, come `scraper_runs`).
 */

import { chiaveLedger, ledgerLocale, ledgerLocaleRegistra } from '../lib/ledgerLocale.ts';

/** Interfaccia minima per l'ambiente (nessuna dipendenza da @types/node). */
declare const process: { env: Record<string, string | undefined> };

function baseSupabase(): string {
  return (process.env.SUPABASE_URL ?? '').replace(/\/+$/, '');
}

function serviceKey(): string {
  return process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
}

/** Avviso una-tantum quando il ledger dei canali non è disponibile. */
let ledgerCanaliAvvisato = false;

function avvisaLedgerAssente(dettaglio: string): void {
  if (ledgerCanaliAvvisato) return;
  ledgerCanaliAvvisato = true;
  console.warn(
    `⚠ Ledger canali NON disponibile (${dettaglio}): applicare la migrazione ` +
      '`20260914020000_channel_posts_log.sql` per impedire la ripubblicazione degli avvisi.',
  );
}

/** Canali su cui l'avviso risulta GIÀ pubblicato (ledger locale + DB). */
export async function canaliGiaPubblicati(hash: string): Promise<Set<string>> {
  // 1) Ledger LOCALE su file: sempre disponibile, blocca i duplicati anche se la
  //    tabella `channel_posts_log` non è ancora stata creata.
  const locali = new Set<string>();
  const prefisso = `canale|${hash}|`;
  for (const chiave of ledgerLocale()) {
    if (chiave.startsWith(prefisso)) locali.add(chiave.slice(prefisso.length));
  }

  // 2) Ledger DB (fonte primaria quando presente).
  const base = baseSupabase();
  const key = serviceKey();
  if (!base || !key || !hash) return locali;
  try {
    const res = await fetch(
      `${base}/rest/v1/channel_posts_log?interpello_hash=eq.${encodeURIComponent(hash)}&select=canale`,
      { headers: { apikey: key, Authorization: `Bearer ${key}` } },
    );
    if (!res.ok) {
      avvisaLedgerAssente(`HTTP ${res.status}`);
      return locali;
    }
    const dati = (await res.json()) as { canale?: string | null }[];
    for (const r of dati ?? []) {
      const canale = String(r.canale ?? '').trim();
      if (canale) locali.add(canale);
    }
    return locali;
  } catch {
    return locali;
  }
}

/** Registra la pubblicazione di un avviso su un canale (idempotente). */
export async function registraPubblicazioneCanale(hash: string, canale: string): Promise<boolean> {
  // Ledger locale SEMPRE (fallback duraturo, committato dal workflow).
  ledgerLocaleRegistra(chiaveLedger('canale', hash, canale));

  const base = baseSupabase();
  const key = serviceKey();
  if (!base || !key || !hash || !canale) return false;
  try {
    const res = await fetch(`${base}/rest/v1/channel_posts_log`, {
      method: 'POST',
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
        Prefer: 'resolution=ignore-duplicates,return=minimal',
      },
      body: JSON.stringify({ interpello_hash: hash, canale }),
    });
    return res.ok;
  } catch {
    return false;
  }
}
