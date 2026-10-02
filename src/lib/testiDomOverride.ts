/**
 * ScuoleRadar.it — «EDITOR TESTI RAPIDO» (DEV Toolbar): store degli override SUL DOM.
 * Metà PERSISTENTE della scansione universale (`src/lib/testiDom.ts`): gli override scritti
 * a mano sui blocchi di testo della pagina vivono in localStorage: `sr_dom_text_overrides`,
 * con la stessa forma dello store del dizionario (`src/lib/testiModificabili.ts`):
 *   · snapshot a riferimento STABILE (`overrideDom`) → sicuro in `useSyncExternalStore`;
 *   · lettura tollerante (storage bloccato, JSON corrotto, voci malformate → si torna alla
 *     copy del codice, mai un crash);
 *   · chiave → `{ t, v }`: `t` è il testo di default che c'era a schermo quando è stato
 *     scritto l'override, `v` è il testo nuovo. `t` serve a rimettere il default al reset.
 *
 * Modulo PURO e isomorfo: nessun React, nessun accesso allo storage all'import.
 */

/** Chiave localStorage degli override scritti a mano sui testi del DOM. */
export const STORAGE_KEY_TESTI_DOM = 'sr_dom_text_overrides';

/** Un override: `t` = testo di default del codice, `v` = testo scritto a mano. */
export interface VoceOverride {
  t: string;
  v: string;
}

/** Override salvati: solo le occorrenze di testo modificate a mano. */
export type OverrideDom = Record<string, VoceOverride>;

/** Sottoinsieme di localStorage usato qui (letto via globalThis: browser-safe). */
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

let cache: OverrideDom | null = null;

/** Override correnti: riferimento STABILE finché non cambiano. */
export function overrideDom(): OverrideDom {
  if (cache === null) cache = overrideDomSalvatiDaStorage();
  return cache;
}

/**
 * Override come stanno NELLO STORAGE, senza passare dalla cache: è esattamente ciò che vede
 * una pagina appena RICARICATA (persistenza fra i reload, e lettura nei test).
 */
export function overrideDomSalvatiDaStorage(): OverrideDom {
  const storage = memoriaLocale();
  if (!storage) return {};
  try {
    const raw = storage.getItem(STORAGE_KEY_TESTI_DOM);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const out: OverrideDom = {};
    for (const [chiave, valore] of Object.entries(parsed)) {
      const voce = valore as Partial<VoceOverride> | null;
      if (voce && typeof voce.t === 'string' && typeof voce.v === 'string' && voce.v.trim() !== '') {
        out[chiave] = { t: voce.t, v: voce.v };
      }
    }
    return out;
  } catch {
    return {}; // storage disabilitato o JSON corrotto: si usa la copy del codice
  }
}

function scriviSuStorage(mappa: OverrideDom): void {
  const storage = memoriaLocale();
  if (!storage) return;
  try {
    if (Object.keys(mappa).length === 0) {
      storage.removeItem(STORAGE_KEY_TESTI_DOM);
    } else {
      storage.setItem(STORAGE_KEY_TESTI_DOM, JSON.stringify(mappa));
    }
  } catch {
    /* quota/privacy mode: gli override restano validi in memoria per la sessione */
  }
}

/**
 * Scrive (o cancella, con voce a null) l'override di UNA occorrenza.
 * Ritorna true solo se lo store è cambiato: chi chiama salta la riscrittura del DOM se inutile.
 */
export function impostaOverrideDom(chiave: string, voce: VoceOverride | null): boolean {
  const attuale = overrideDom();
  const salvato = attuale[chiave];
  if (voce === null) {
    if (!salvato) return false;
  } else if (salvato && salvato.t === voce.t && salvato.v === voce.v) {
    return false;
  }
  const prossimo: OverrideDom = { ...attuale };
  if (voce === null) {
    delete prossimo[chiave];
  } else {
    prossimo[chiave] = voce;
  }
  cache = prossimo;
  scriviSuStorage(prossimo);
  return true;
}

/**
 * Riporta TUTTI i testi ai default del codice, cancellando la chiave salvata.
 * Ritorna true se c'era qualcosa da cancellare (e quindi da rimmettere a schermo).
 */
export function azzeraOverrideDom(): boolean {
  if (Object.keys(overrideDom()).length === 0) return false;
  cache = {};
  scriviSuStorage({});
  return true;
}