/**
 * ScuoleRadar.it — CLICK-TO-EDIT («Visual Editor», solo sviluppo): store delle modifiche.
 *
 * Metà PERSISTENTE del sistema (`src/lib/visualEditorRegole.ts` legge e riscrive il DOM,
 * `src/hooks/useVisualEditor.ts` fa da ponte con React): i testi scritti cliccando sulla pagina
 * vivono in `localStorage`, **una chiave per ROTTA** (`sr_visual_editor:/prezzi`,
 * `sr_visual_editor:/faq`…): la pagina modificata si ritrova intatta dopo un refresh e si
 * azzera — o si esporta — da sola.
 *
 * Forma della voce, identica allo store dell'«Editor Testi Rapido» (`src/lib/testiDomOverride.ts`):
 * `chiave → { t, v }`, con `t` = testo di default del codice (serve al ripristino) e
 * `v` = testo scritto a mano.
 *
 * Un piccolo INDICE (`sr_visual_editor:_rotte`) elenca le rotte toccate, così esportazione
 * completa e reset globale non devono scorrere tutto il `localStorage`.
 *
 * Contratto, come gli altri store dell'editor:
 *   · snapshot a riferimento STABILE, per `useSyncExternalStore`;
 *   · lettura TOLLERANTE: storage bloccato, JSON corrotto o voci malformate → si torna alla
 *     copy del codice, mai un crash;
 *   · notifica agli ascoltatori solo su cambiamento reale.
 *
 * Modulo PURO e isomorfo: nessun React, nessun accesso allo storage al momento dell'import, e
 * le funzioni di esportazione sono pure (la data la passa chi le chiama).
 */

/** Prefisso delle chiavi per rotta: `sr_visual_editor:/prezzi`. */
export const PREFISSO_STORAGE_VISUAL_EDITOR = 'sr_visual_editor:';

/** Indice delle rotte toccate (riga JSON con l'elenco). */
export const CHIAVE_ROTTE_VISUAL_EDITOR = 'sr_visual_editor:_rotte';

/** Flag persistito di attivazione del badge/pannello (l'editor resta acceso fra i refresh). */
export const CHIAVE_VISUAL_EDITOR_ATTIVO = 'sr_visual_editor_attivo';

/** Un override: `t` = testo di default del codice, `v` = testo scritto a mano. */
export interface VoceBlocco {
  t: string;
  v: string;
}

/** Modifiche salvate di una rotta: solo i blocchi toccati. */
export type OverrideRotta = Record<string, VoceBlocco>;

/** Sottoinsieme di localStorage usato qui (letto da globalThis: sicuro anche fuori browser). */
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

/** Chiave localStorage di una rotta: è la «pagina» del visual editor. */
export function chiaveStorageRotta(rotta: string): string {
  return `${PREFISSO_STORAGE_VISUAL_EDITOR}${rotta}`;
}

const cache = new Map<string, OverrideRotta>();
const ascoltatori = new Set<() => void>();

function avvisaAscoltatori(): void {
  for (const ascoltatore of [...ascoltatori]) ascoltatore();
}

/** Iscrive un ascoltatore del cambio store (ritorna la funzione di annullamento). */
export function sottoscriviVisualEditor(ascoltatore: () => void): () => void {
  ascoltatori.add(ascoltatore);
  return () => {
    ascoltatori.delete(ascoltatore);
  };
}

/** Tiene solo le voci ben formate di un JSON qualunque (chiavi stringa, `v` non vuoto). */
function vociValide(parsed: Record<string, unknown>): OverrideRotta {
  const out: OverrideRotta = {};
  for (const [chiave, valore] of Object.entries(parsed)) {
    const voce = valore as Partial<VoceBlocco> | null;
    if (voce && typeof voce.t === 'string' && typeof voce.v === 'string' && voce.v.trim() !== '') {
      out[chiave] = { t: voce.t, v: voce.v };
    }
  }
  return out;
}

/** Modifiche di una rotta come stanno NELLO STORAGE (ciò che vede una pagina ricaricata). */
export function overrideRottaSalvatiDaStorage(rotta: string): OverrideRotta {
  const storage = memoriaLocale();
  if (!storage) return {};
  try {
    const raw = storage.getItem(chiaveStorageRotta(rotta));
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    return vociValide(parsed as Record<string, unknown>);
  } catch {
    return {}; // storage disabilitato o JSON corrotto: si riparte dalla copy del codice
  }
}

/** Modifiche correnti di una rotta: riferimento STABILE finché non cambiano. */
export function overrideRotta(rotta: string): OverrideRotta {
  const inCache = cache.get(rotta);
  if (inCache) return inCache;
  const letta = overrideRottaSalvatiDaStorage(rotta);
  cache.set(rotta, letta);
  return letta;
}

/** Rotte toccate almeno una volta (dall'indice salvato), in ordine di comparsa. */
export function rotteSalvate(): string[] {
  const storage = memoriaLocale();
  if (!storage) return [];
  try {
    const raw = storage.getItem(CHIAVE_ROTTE_VISUAL_EDITOR);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((voce): voce is string => typeof voce === 'string' && voce !== '');
  } catch {
    return [];
  }
}

/** Tutte le modifiche salvate, rotta → voci (per l'esportazione completa e per il reset). */
export function overrideTutteLeRotte(): Record<string, OverrideRotta> {
  const out: Record<string, OverrideRotta> = {};
  for (const rotta of rotteSalvate()) {
    const voci = overrideRotta(rotta);
    if (Object.keys(voci).length > 0) out[rotta] = voci;
  }
  return out;
}

/** Aggiorna l'indice delle rotte toccate (entra/esce la rotta indicata). */
function scriviIndice(rotta: string, presente: boolean): void {
  const storage = memoriaLocale();
  if (!storage) return;
  const attuali = rotteSalvate().filter((voce) => voce !== rotta);
  const prossime = presente ? [...attuali, rotta] : attuali;
  try {
    if (prossime.length === 0) storage.removeItem(CHIAVE_ROTTE_VISUAL_EDITOR);
    else storage.setItem(CHIAVE_ROTTE_VISUAL_EDITOR, JSON.stringify(prossime));
  } catch {
    /* quota esaurita o modalità privata: l'indice resta valido in memoria per la sessione */
  }
}

/** Scrive (o cancella, con mappa vuota) le modifiche di una rotta. */
function scriviSuStorage(rotta: string, voci: OverrideRotta): void {
  const storage = memoriaLocale();
  if (!storage) return;
  try {
    if (Object.keys(voci).length === 0) storage.removeItem(chiaveStorageRotta(rotta));
    else storage.setItem(chiaveStorageRotta(rotta), JSON.stringify(voci));
  } catch {
    /* quota esaurita o modalità privata: gli override restano validi in memoria per la sessione */
  }
}

/**
 * Scrive (o cancella, con `voce` a null) la modifica di UN blocco della rotta. Ritorna true solo
 * se lo store è cambiato davvero: chi chiama salta la riscrittura del DOM quando è inutile.
 */
export function impostaOverrideRotta(
  rotta: string,
  chiave: string,
  voce: VoceBlocco | null,
): boolean {
  const attuale = overrideRotta(rotta);
  const salvato = attuale[chiave];
  if (voce === null) {
    if (!salvato) return false;
  } else if (salvato && salvato.t === voce.t && salvato.v === voce.v) {
    return false;
  }
  const prossimo: OverrideRotta = { ...attuale };
  if (voce === null) delete prossimo[chiave];
  else prossimo[chiave] = voce;
  cache.set(rotta, prossimo);
  scriviSuStorage(rotta, prossimo);
  scriviIndice(rotta, Object.keys(prossimo).length > 0);
  avvisaAscoltatori();
  return true;
}

/** Riporta ai default del codice TUTTI i testi di una rotta. True se c'era qualcosa da togliere. */
export function azzeraOverrideRotta(rotta: string): boolean {
  if (Object.keys(overrideRotta(rotta)).length === 0) return false;
  cache.set(rotta, {});
  scriviSuStorage(rotta, {});
  scriviIndice(rotta, false);
  avvisaAscoltatori();
  return true;
}

/** Riporta ai default del codice le modifiche di TUTTE le rotte. Ritorna il numero di rotte svuotate. */
export function azzeraTutteLeRotte(): number {
  const rotte = rotteSalvate();
  let svuotate = 0;
  for (const rotta of rotte) {
    if (Object.keys(overrideRotta(rotta)).length > 0) svuotate += 1;
    cache.set(rotta, {});
    scriviSuStorage(rotta, {});
  }
  const storage = memoriaLocale();
  if (storage) {
    try {
      storage.removeItem(CHIAVE_ROTTE_VISUAL_EDITOR);
    } catch {
      /* modalità privata: resta valido il solo reset in memoria */
    }
  }
  if (svuotate > 0) avvisaAscoltatori();
  return svuotate;
}

/**
 * Testo pronto da riportare nel codice sorgente: una riga per blocco con «era» e «ora», in
 * ordine di chiave (due esportazioni della stessa pagina si leggono allo stesso modo).
 * Puro: `quando` lo passa chi chiama, così nel modulo non c'è nessun orologio nascosto.
 */
export function esportaTestoRotta(rotta: string, voci: OverrideRotta, quando: string): string {
  const elenco = Object.entries(voci).sort(([a], [b]) => a.localeCompare(b));
  const modifiche = elenco.length === 1 ? '1 modifica' : `${elenco.length} modifiche`;
  const righe: string[] = [
    `/* ScuoleRadar · modifiche testi (Click-to-Edit) — pagina ${rotta}`,
    ` * ${modifiche} · ${quando}`,
    ' * Riporta questi testi nei componenti: la chiave è tag#impronta(testo originale)#occorrenza.',
    ' * Fonti e cablaggio: docs/SYSTEM_HANDOVER.md (§26.37).',
    ' */',
  ];
  for (const [chiave, voce] of elenco) {
    righe.push('', `[${chiave}]`, `  era: «${voce.t}»`, `  ora: «${voce.v}»`);
  }
  return `${righe.join('\n')}\n`;
}

/** Esportazione JSON (download o passaggio a un altro strumento), indentata e leggibile. */
export function esportaJsonRotte(rotte: Record<string, OverrideRotta>): string {
  return `${JSON.stringify(rotte, null, 2)}\n`;
}
