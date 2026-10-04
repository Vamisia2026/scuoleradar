/**
 * ScuoleRadar.it — STORE degli override dei testi per chiave (DEV).
 *
 * Seconda metà del sistema: il DIZIONARIO dei testi vive in
 * `src/data/editableTexts.ts`, qui c'è la sola parte mutabile —
 * `localStorage: sr_simple_text_overrides` — con lo stesso schema dello store
 * delle feature flags (`src/config/features.ts`):
 *
 *   · snapshot a riferimento STABILE (`overrideTesti`) → sicuro in `useSyncExternalStore`;
 *   · lettura/scrittura tolleranti (storage bloccato, JSON corrotto, chiavi ignote
 *     o non più nel registro → si torna ai default del codice, mai un crash);
 *   · notifica agli ascoltatori: chi rende un testo si aggiorna nello stesso render.
 *
 * L'attivazione è responsabilità dell'hook (`src/hooks/useTestiEditabili.ts`): gli
 * override valgono SOLO in ambiente di sviluppo. Nessuno scrive più qui da quando il
 * pannello «Editor Testi Rapido» è stato rimosso (§26.38): la lettura resta per non
 * lasciare attivi in sviluppo i testi eventualmente salvati prima di quella rimozione,
 * e «Reset dati / LocalStorage» della DEV Toolbar cancella la chiave.
 *
 * Modulo PURO e isomorfo: nessun import di React, nessun accesso a DOM/storage
 * al caricamento → importabile da frontend, script Node e test.
 */
import {
  eChiaveTesto,
  testoDiDefault,
  type ChiaveTesto,
} from '../data/editableTexts.ts';

/** Chiave localStorage degli override scritti dall'editor DEV. */
export const STORAGE_KEY_TESTI_RAPIDI = 'sr_simple_text_overrides';

/** Override locali: solo le chiavi modificate nell'editor. */
export type OverrideTesti = Partial<Record<ChiaveTesto, string>>;

/** Sottoinsieme di `localStorage` usato qui (letto via `globalThis`: browser-safe). */
interface HostStorage {
  localStorage?: {
    getItem(chiave: string): string | null;
    setItem(chiave: string, valore: string): void;
    removeItem(chiave: string): void;
  };
}

function memoriaLocale(): HostStorage['localStorage'] {
  return (globalThis as unknown as HostStorage).localStorage;
}

let cache: OverrideTesti | null = null;
const ascoltatori = new Set<() => void>();

/**
 * Snapshot degli override. Riferimento STABILE finché non cambiano: è ciò che
 * rende sicuro l'uso dentro `useSyncExternalStore`.
 */
export function overrideTesti(): OverrideTesti {
  if (cache === null) cache = leggiDaStorage();
  return cache;
}

/** Legge la chiave localStorage tenendo SOLO chiavi del registro con valore testo. */
function leggiDaStorage(): OverrideTesti {
  const storage = memoriaLocale();
  if (!storage) return {};
  try {
    const raw = storage.getItem(STORAGE_KEY_TESTI_RAPIDI);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const out: OverrideTesti = {};
    for (const [chiave, valore] of Object.entries(parsed)) {
      if (eChiaveTesto(chiave) && typeof valore === 'string' && valore.trim() !== '') {
        out[chiave] = valore;
      }
    }
    return out;
  } catch {
    return {}; // storage disabilitato o JSON corrotto: si usano i default
  }
}

function scriviSuStorage(override: OverrideTesti): void {
  const storage = memoriaLocale();
  if (!storage) return;
  try {
    if (Object.keys(override).length === 0) storage.removeItem(STORAGE_KEY_TESTI_RAPIDI);
    else storage.setItem(STORAGE_KEY_TESTI_RAPIDI, JSON.stringify(override));
  } catch {
    /* quota/privacy mode: gli override restano validi in memoria per la sessione */
  }
}

function avvisaAscoltatori(): void {
  for (const ascoltatore of [...ascoltatori]) ascoltatore();
}

/** Iscrive un ascoltatore (ritorna la funzione di annullamento). */
export function sottoscriviTesti(ascoltatore: () => void): () => void {
  ascoltatori.add(ascoltatore);
  return () => {
    ascoltatori.delete(ascoltatore);
  };
}

/**
 * Testo EFFETTIVO di una chiave: l'override dell'editor se c'è, altrimenti il
 * default del registro. È l'unico modo in cui le pagine leggono un testo.
 */
export function testoCorrente(chiave: ChiaveTesto): string {
  return overrideTesti()[chiave] ?? testoDiDefault(chiave);
}

/**
 * Scrive l'override di UNA chiave (svuotare il campo = si torna al default).
 * Nessuna scrittura e nessuna notifica se il valore è già quello corrente: la
 * digitazione non provoca render inutili.
 */
export function impostaTesto(chiave: ChiaveTesto, valore: string): void {
  const attuale = overrideTesti();
  if (attuale[chiave] === valore) return;
  const prossimo: OverrideTesti = { ...attuale };
  if (valore.trim() === '') delete prossimo[chiave];
  else prossimo[chiave] = valore;
  cache = prossimo;
  scriviSuStorage(prossimo);
  avvisaAscoltatori();
}

/** Riporta TUTTI i testi ai default del codice, cancellando la chiave salvata. */
export function azzeraTesti(): void {
  if (Object.keys(overrideTesti()).length === 0) return; // già ai default
  cache = {};
  const storage = memoriaLocale();
  if (storage) {
    try {
      storage.removeItem(STORAGE_KEY_TESTI_RAPIDI);
    } catch {
      /* privacy mode: resta valido il solo reset in memoria */
    }
  }
  avvisaAscoltatori();
}
