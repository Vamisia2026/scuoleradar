/**
 * ScuoleRadar.it — LEDGER LOCALE anti-duplicato (Node-only, fallback).
 *
 * Perché esiste: il ledger di produzione vive su Supabase
 * (`notifications_log`, `channel_posts_log`). Finché quelle tabelle non sono
 * create, il controllo DB risponde "assente" e ogni run dello scraper
 * rimandava gli stessi avvisi (bug "notifiche ripetute"). Questo ledger su file
 * — committato dal workflow — è la RETE DI SICUREZZA che blocca i duplicati
 * anche senza migrazioni applicate.
 *
 * Formato: JSON con un array di chiavi `"<ambito>|<id>|<canale>"`, ordinate e
 * troncate (max 20.000 voci) per non crescere all'infinito.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

const PERCORSO = join(process.cwd(), '.scuoleradar', 'notifiche-ledger.json');
const MAX_VOCI = 20_000;

let cache: Set<string> | null = null;
let sporco = false;

/** Chiave canonica di deduplica. */
export function chiaveLedger(ambito: string, id: string, canale: string): string {
  return `${ambito}|${id}|${canale}`;
}

/** Legge il ledger (cache in memoria; file assente = ledger vuoto). */
export function ledgerLocale(): Set<string> {
  if (cache) return cache;
  cache = new Set<string>();
  try {
    if (existsSync(PERCORSO)) {
      const dati = JSON.parse(readFileSync(PERCORSO, 'utf8')) as { chiavi?: string[] };
      for (const k of dati.chiavi ?? []) if (typeof k === 'string' && k) cache.add(k);
    }
  } catch {
    // ledger illeggibile: si riparte da vuoto (nessun blocco della pipeline)
  }
  return cache;
}

/** True se la chiave è già stata inviata (ledger locale). */
export function ledgerLocaleGia(chiave: string): boolean {
  return ledgerLocale().has(chiave);
}

/** Registra una chiave (scrittura su disco differita, best-effort). */
export function ledgerLocaleRegistra(chiave: string): void {
  if (!chiave) return;
  const set = ledgerLocale();
  if (set.has(chiave)) return;
  set.add(chiave);
  sporco = true;
}

/** Salva su disco il ledger (chiamare a fine run). Mai eccezioni. */
export function ledgerLocaleSalva(): void {
  if (!sporco || !cache) return;
  try {
    const chiavi = [...cache];
    // Troncamento: si conservano le voci più recenti (accodate in fondo).
    const ridotte = chiavi.length > MAX_VOCI ? chiavi.slice(chiavi.length - MAX_VOCI) : chiavi;
    mkdirSync(dirname(PERCORSO), { recursive: true });
    writeFileSync(PERCORSO, `${JSON.stringify({ aggiornato: new Date().toISOString(), chiavi: ridotte }, null, 0)}\n`, 'utf8');
    sporco = false;
  } catch {
    // disco non scrivibile: il ledger DB resta la fonte primaria
  }
}

/** Percorso del ledger locale (per il commit nel workflow). */
export function percorsoLedgerLocale(): string {
  return PERCORSO;
}
