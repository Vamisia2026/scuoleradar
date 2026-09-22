/**
 * ScuoleRadar.it — stato delle AUTOMAZIONI EMAIL lato Node (scraper/notifier).
 *
 * Il pannello Admin (tab «Email & Automazioni») salva gli interruttori e i testi
 * nella KV `public.app_settings` con chiave `email_automazione_<id>`; qui il
 * notifier li RISPETTA: automazione disattivata → invio saltato; oggetto
 * personalizzato → oggetto dell'email.
 *
 * REGOLA DI ROBUSTEZZA: qualunque errore (tabella assente, RLS, rete, client
 * stub nei test) → automazione ATTIVA con i testi del codice. Come per il ledger
 * delle notifiche, la configurazione non deve MAI fermare il servizio.
 *
 * Cache di processo (TTL 60s): lo stato cambia di rado e il digest gira su molti
 * profili nella stessa esecuzione (una query per run, non una per invio).
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  PREFISSO_CHIAVE_AUTOMAZIONE,
  normalizzaStatoAutomazione,
  oggettoModificabile,
  statoEffettivoAutomazione,
  trovaAutomazione,
  type IdAutomazione,
  type StatoAutomazione,
} from '../config/automazioniEmail.ts';

/** Durata della cache di processo dello stato automazioni. */
const TTL_MS = 60_000;

let cache: { istante: number; stati: Partial<Record<IdAutomazione, StatoAutomazione>> } | null = null;

/** Azzera la cache (test e run lunghi). */
export function resetCacheAutomazioni(): void {
  cache = null;
}

/** Legge dalla KV gli stati salvati (solo chiavi delle automazioni gestite). */
async function leggiStati(
  client: SupabaseClient,
): Promise<Partial<Record<IdAutomazione, StatoAutomazione>>> {
  const stati: Partial<Record<IdAutomazione, StatoAutomazione>> = {};
  try {
    const { data, error } = await client.from('app_settings').select('key,value');
    if (error || !data) return stati;
    for (const riga of data as Array<{ key?: string; value?: string }>) {
      const chiave = String(riga?.key ?? '');
      if (!chiave.startsWith(PREFISSO_CHIAVE_AUTOMAZIONE)) continue;
      const id = chiave.slice(PREFISSO_CHIAVE_AUTOMAZIONE.length) as IdAutomazione;
      if (!trovaAutomazione(id)) continue;
      stati[id] = normalizzaStatoAutomazione(riga?.value);
    }
  } catch (err) {
    const motivo = err instanceof Error ? err.message : String(err);
    console.warn(
      `⚠ automazioni email: app_settings non leggibile (${motivo}), uso i default (tutte attive).`,
    );
  }
  return stati;
}

/**
 * Stato effettivo di un'automazione (default: ATTIVA, testi dal codice).
 * `client` null (dry-run/test senza DB) → default del catalogo.
 */
export async function statoAutomazioneEmail(
  client: SupabaseClient | null,
  id: IdAutomazione,
): Promise<StatoAutomazione> {
  if (!client) return statoEffettivoAutomazione(id);
  const adesso = Date.now();
  if (!cache || adesso - cache.istante > TTL_MS) {
    cache = { istante: adesso, stati: await leggiStati(client) };
  }
  return statoEffettivoAutomazione(id, cache.stati);
}

/**
 * Oggetto da usare per l'email: override del pannello SOLO se il catalogo lo
 * consente (gli oggetti standard delle opportunità sono vincolati).
 */
export function oggettoConsentito(id: IdAutomazione, stato: StatoAutomazione): string | undefined {
  const automazione = trovaAutomazione(id);
  if (!automazione || !oggettoModificabile(automazione)) return undefined;
  return stato.oggetto;
}
