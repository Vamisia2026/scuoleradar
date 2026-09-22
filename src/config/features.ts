/**
 * ScuoleRadar.it — FEATURE FLAGS dei DIPARTIMENTI (unico punto di verità).
 *
 * Ogni dipartimento ha 3 stati:
 *   · `off`  → disattivato: sparisce dalla navbar e la rotta non è accessibile;
 *   · `test` → visibile/accessibile SOLO all'admin; le notifiche automatiche del
 *              modulo partono unicamente verso l'account di test dell'admin;
 *   · `on`   → pubblico (comportamento di produzione).
 *
 * Tre livelli, in ordine di priorità (il primo che esiste vince):
 *   1. OVERRIDE di ambiente (`FEATURE_RADAR=test`, …) → processi Node/Deno;
 *   2. OVERRIDE locale (`localStorage: sr_flag_dipartimenti`) → impostato dal
 *      pannello Admin / DEV Toolbar, vale per il browser corrente;
 *   3. DEFAULT del codice (`DIPARTIMENTI[].statoBase`).
 *
 * Modulo PURO e isomorfo: nessun import di React, nessun accesso a DOM/storage
 * al caricamento → importabile da frontend, script Node, test e notifier.
 *
 * File collegati:
 *   · `./statoDipartimenti.ts` → stato effettivo, visibilità e etichette;
 *   · `./gateNotifiche.ts`      → gate di invio email/Telegram.
 */

/** I tre stati di un dipartimento/modulo. */
export type StatoDipartimento = 'off' | 'test' | 'on';

/** Identificativi dei dipartimenti gestiti dalle feature flags. */
export type DipartimentoId =
  | 'radar'
  | 'cfu'
  | 'modulistica'
  | 'purefocus'
  | 'referral'
  | 'cv_builder';

/** Anagrafica + default di un dipartimento. */
export interface Dipartimento {
  id: DipartimentoId;
  nome: string;
  emoji: string;
  /** Rotta principale del dipartimento (link «torna al dipartimento»). */
  rotta: string;
  descrizione: string;
  /** Stato applicato quando non esistono override (env o locale). */
  statoBase: StatoDipartimento;
  /** true = il dipartimento invia notifiche automatiche (email/Telegram). */
  notificheAutomatiche: boolean;
}

/** Ordine di presentazione (navbar, pannelli DEV/Admin). */
export const DIPARTIMENTI: readonly Dipartimento[] = [
  {
    id: 'radar',
    nome: 'Radar Scuole',
    emoji: '📡',
    rotta: '/dashboard/radar',
    descrizione: 'Monitoraggio interpelli e notifiche automatiche (email + Telegram).',
    statoBase: 'on',
    notificheAutomatiche: true,
  },
  {
    id: 'cfu',
    nome: 'Calcolatore CFU',
    emoji: '🎓',
    rotta: '/dashboard/calcolatore-cfu',
    descrizione: 'Analisi dei requisiti di accesso (Dipartimento CFU).',
    statoBase: 'on',
    notificheAutomatiche: false,
  },
  {
    id: 'modulistica',
    nome: 'Modulistica',
    emoji: '📁',
    rotta: '/dashboard/moduli',
    descrizione: 'Archivio moduli, Archivista AI e generazione documenti.',
    statoBase: 'on',
    notificheAutomatiche: false,
  },
  {
    id: 'purefocus',
    nome: 'Pure Focus',
    emoji: '🧘',
    rotta: '/dashboard/purefocus',
    descrizione: 'Servizio partner incluso nell’offerta VIP.',
    statoBase: 'on',
    notificheAutomatiche: false,
  },
  {
    id: 'referral',
    nome: 'Invita un Collega',
    emoji: '🎁',
    rotta: '/dashboard/invita',
    descrizione: 'Programma referral: inviti, premi e codici sconto.',
    statoBase: 'on',
    notificheAutomatiche: false,
  },
  {
    id: 'cv_builder',
    nome: 'Crea CV',
    emoji: '📄',
    rotta: '/dashboard/cv',
    descrizione: 'Generatore CV dedicato (in incubazione: default OFF).',
    statoBase: 'off',
    notificheAutomatiche: false,
  },
];

/** Ordine dei tre stati nel selettore (da più chiuso a più aperto). */
export const STATI_DIPARTIMENTO: readonly StatoDipartimento[] = ['off', 'test', 'on'];

/** Chiave localStorage degli override impostati da Admin/DEV. */
export const STORAGE_KEY_FLAG_DIPARTIMENTI = 'sr_flag_dipartimenti';

/** Override locali (solo dipartimenti con stato diverso dal default). */
export type OverrideDipartimenti = Partial<Record<DipartimentoId, StatoDipartimento>>;

/** true se il valore è uno dei tre stati ammessi. */
export function eStatoDipartimento(valore: unknown): valore is StatoDipartimento {
  return valore === 'off' || valore === 'test' || valore === 'on';
}
/** Anagrafica di un dipartimento (o `undefined` se l'id non è gestito). */
export function trovaDipartimento(id: DipartimentoId): Dipartimento | undefined {
  return DIPARTIMENTI.find((d) => d.id === id);
}

/* ------------------------------ Store locale ------------------------------ */

/** Sottoinsieme di `localStorage` usato qui (letto via `globalThis`: browser-safe). */
interface HostStorage {
  localStorage?: {
    getItem(chiave: string): string | null;
    setItem(chiave: string, valore: string): void;
    removeItem(chiave: string): void;
  };
}

function memoriaLocale(): HostStorage['localStorage'] | undefined {
  return (globalThis as unknown as HostStorage).localStorage;
}

let cache: OverrideDipartimenti | null = null;
const ascoltatori = new Set<() => void>();

/**
 * Snapshot degli override locali. Riferimento STABILE finché non cambiano: è ciò
 * che rende sicuro l'uso dentro `useSyncExternalStore`.
 */
export function overrideDipartimenti(): OverrideDipartimenti {
  if (cache === null) cache = leggiDaStorage();
  return cache;
}

function leggiDaStorage(): OverrideDipartimenti {
  const storage = memoriaLocale();
  if (!storage) return {};
  try {
    const raw = storage.getItem(STORAGE_KEY_FLAG_DIPARTIMENTI);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const out: OverrideDipartimenti = {};
    for (const d of DIPARTIMENTI) {
      const valore = parsed[d.id];
      if (eStatoDipartimento(valore)) out[d.id] = valore;
    }
    return out;
  } catch {
    return {}; // storage disabilitato o JSON corrotto: si usano i default
  }
}

function scriviSuStorage(stati: OverrideDipartimenti): void {
  const storage = memoriaLocale();
  if (!storage) return;
  try {
    if (Object.keys(stati).length === 0) storage.removeItem(STORAGE_KEY_FLAG_DIPARTIMENTI);
    else storage.setItem(STORAGE_KEY_FLAG_DIPARTIMENTI, JSON.stringify(stati));
  } catch {
    /* quota/privacy mode: gli override restano validi in memoria per la sessione */
  }
}

function avvisaAscoltatori(): void {
  for (const ascoltatore of [...ascoltatori]) ascoltatore();
}

/**
 * Sincronizzazione TRA SCHEDE dello stesso browser: senza questo, un cambio di
 * stato fatto nella scheda A (es. DEV Toolbar) non si rifletteva nella scheda B
 * aperta sullo stesso sito, che continuava a mostrare il modulo come attivo.
 * L'ascoltatore è installato al primo sottoscrittore (mai all'import: il modulo
 * resta puro e isomorfo per gli script Node).
 */
let ascoltoStorageAttivo = false;
function attivaAscoltoStorage(): void {
  if (ascoltoStorageAttivo) return;
  if (typeof window === 'undefined' || typeof window.addEventListener !== 'function') return;
  ascoltoStorageAttivo = true;
  window.addEventListener('storage', (evento) => {
    // `key === null` = svuotamento completo dello storage: in entrambi i casi si
    // rilegge la chiave e si avvisano i componenti.
    if (evento.key && evento.key !== STORAGE_KEY_FLAG_DIPARTIMENTI) return;
    cache = leggiDaStorage();
    avvisaAscoltatori();
  });
}

/** Iscrive un ascoltatore ai cambi di stato (ritorna la funzione di rimozione). */
export function sottoscriviDipartimenti(ascoltatore: () => void): () => void {
  attivaAscoltoStorage();
  ascoltatori.add(ascoltatore);
  return () => {
    ascoltatori.delete(ascoltatore);
  };
}

/** Imposta lo stato locale di un dipartimento (persistito + notificato subito). */
export function impostaStatoDipartimento(id: DipartimentoId, stato: StatoDipartimento): void {
  const prossimi: OverrideDipartimenti = { ...overrideDipartimenti(), [id]: stato };
  cache = prossimi;
  scriviSuStorage(prossimi);
  avvisaAscoltatori();
}

/** Riporta tutti i dipartimenti ai default del codice (azzera gli override locali). */
export function azzeraStatiDipartimento(): void {
  cache = {};
  scriviSuStorage(cache);
  avvisaAscoltatori();
}

