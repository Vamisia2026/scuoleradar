/**
 * Livello dati del Pannello Admin — AUTOMAZIONI EMAIL (tab «Email & Automazioni»).
 *
 * Lo stato delle automazioni vive nella KV `public.app_settings` (chiave
 * `email_automazione_<id>`), letta e scritta tramite la Edge `admin`
 * (`list_email_automations` / `set_email_automation`). Senza sessione Supabase
 * (modalità demo) si usa la copia locale del browser: nessun invio server-side
 * legge mai questa cache.
 */
import {
  STORAGE_KEY_AUTOMAZIONI,
  eStatoPredefinito,
  normalizzaStatoAutomazione,
  trovaAutomazione,
  type IdAutomazione,
  type StatoAutomazione,
} from '@/config/automazioniEmail';
import { chiamaAdmin, tokenAdmin } from '../adminService';

/* --------------------- Automazioni email (pannello Admin) --------------------- */

/**
 * Stati salvati delle automazioni: la fonte autorevole è `public.app_settings`
 * (KV, letta dall'Edge `admin`). La copia in localStorage serve SOLO come
 * fallback quando non esiste una sessione Supabase (modalità demo) o la Edge non
 * è raggiungibile: nessun invio server-side legge mai questa cache.
 */
export type StatiAutomazioni = Partial<Record<IdAutomazione, StatoAutomazione>>;

/** Legge la copia locale degli stati (demo/offline). */
function leggiCacheAutomazioni(): StatiAutomazioni {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_AUTOMAZIONI);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const out: StatiAutomazioni = {};
    for (const [id, valore] of Object.entries(parsed)) {
      if (trovaAutomazione(id as IdAutomazione)) {
        out[id as IdAutomazione] = normalizzaStatoAutomazione(valore);
      }
    }
    return out;
  } catch {
    return {};
  }
}

/** Scrive la copia locale degli stati (best-effort). */
function scriviCacheAutomazioni(stati: StatiAutomazioni): void {
  try {
    localStorage.setItem(STORAGE_KEY_AUTOMAZIONI, JSON.stringify(stati));
  } catch {
    /* storage pieno o disabilitato: la sessione corrente resta coerente */
  }
}

/** Esito del caricamento: stati + provenienza (Supabase o copia locale). */
export interface EsitoCaricamentoAutomazioni {
  stati: StatiAutomazioni;
  /** true = stati NON letti da Supabase (demo/offline: si usa la copia locale). */
  demo: boolean;
  /** Motivo leggibile quando la lettura reale non è riuscita. */
  errore?: string;
}

/**
 * Carica gli stati delle automazioni dall'Edge `admin` (`list_email_automations`).
 * Senza sessione (demo) o in caso d'errore si usa la copia locale, segnalando
 * `demo: true` così il pannello può avvisare l'operatore.
 */
export async function caricaAutomazioniEmail(): Promise<EsitoCaricamentoAutomazioni> {
  const token = await tokenAdmin();
  if (!token) return { stati: leggiCacheAutomazioni(), demo: true };
  try {
    const ris = await chiamaAdmin<{ automazioni?: Array<{ id: string; valore: string }> }>(
      'list_email_automations',
    );
    const stati: StatiAutomazioni = {};
    for (const riga of ris.automazioni ?? []) {
      const id = String(riga?.id ?? '') as IdAutomazione;
      if (!trovaAutomazione(id)) continue;
      stati[id] = normalizzaStatoAutomazione(riga?.valore);
    }
    scriviCacheAutomazioni(stati);
    return { stati, demo: false };
  } catch (err) {
    const messaggio = err instanceof Error ? err.message : String(err);
    console.warn('[admin] automazioni email: lettura reale non riuscita, uso la copia locale', err);
    return { stati: leggiCacheAutomazioni(), demo: true, errore: messaggio };
  }
}

/**
 * Salva lo stato di UNA automazione (`set_email_automation`). Con stato identico
 * al default la Edge rimuove la riga dalla KV (`ripristinata: true`).
 */
export async function salvaAutomazioneEmail(
  id: IdAutomazione,
  stato: StatoAutomazione,
): Promise<{ demo: boolean; ripristinata: boolean }> {
  const normalizzato = normalizzaStatoAutomazione({
    ...stato,
    abilitata: stato.abilitata !== false,
  });
  const token = await tokenAdmin();
  const cache: StatiAutomazioni = { ...leggiCacheAutomazioni(), [id]: normalizzato };
  if (!token) {
    scriviCacheAutomazioni(cache);
    return { demo: true, ripristinata: eStatoPredefinito(normalizzato) };
  }
  const ris = await chiamaAdmin<{ ripristinata?: boolean }>('set_email_automation', {
    id,
    stato: normalizzato,
  });
  scriviCacheAutomazioni(cache);
  return { demo: false, ripristinata: ris.ripristinata === true };
}
