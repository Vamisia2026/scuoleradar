/**
 * ScuoleRadar.it — REGISTRO FONTI INTERPELLI (Node-only, PURO) — Capoluoghi & hub.
 * PERIMETRO (separazione dei domini): questo registro riguarda SOLO il motore
 * degli INTERPELLI di lavoro (src/scraper/). Nessuna fonte editoriale, nessun
 * comunicato stampa, nessuna rassegna: le notizie del MIM vivono in
 * src/departments/notizie/ e non entrano MAI nella bacheca degli interpelli.
 * I DATI (URL verificate) stanno in fontiRegistro.ts; qui ci sono i tipi, la
 * costruzione del registro e la SELEZIONE delle fonti per provincia/run. La
 * copertura dichiarata (regioni e capoluoghi) sta in fontiCopertura.ts.
 * 
 * Tipi di fonte:
 * · aggregatore       → landing dell'aggregatore di interpelli: i post
 *                       giornalieri sono NAZIONALI, quindi la provincia si
 *                       RILEVA dalla singola riga (città o codice scuola);
 * · hub-istituzionale → pagine di reclutamento USR/USP dei capoluoghi di
 *                       regione e hub metropolitani (docenti, ATA, PNRR,
 *                       esperti esterni pubblicati dall'ente).
 * 
 * Nessuna URL inventata: una fonte non verificabile resta registrata con
 * attiva: false e il motivo in note (npm run fonti:verifica le ricontrolla).
 */

import { province } from '../data/province.ts';
import { AGGREGATORI_REGIONALI, HUB_ATTIVI, HUB_ESCLUSI } from './fontiRegistro.ts';

export type TipoFonte = 'aggregatore' | 'hub-istituzionale';

export interface FonteInterpelli {
  /** Chiave stabile (log e test). */
  id: string;
  /** Nome leggibile della fonte. */
  etichetta: string;
  url: string;
  tipo: TipoFonte;
  /** Regioni coperte (vuoto = fonte nazionale). */
  regioni: string[];
  /**
   * Provincia di riferimento (capoluogo/hub) usata come fallback per le fonti
   * LOCALI. Le fonti nazionali non hanno fallback: la riga deve dichiarare la
   * propria provincia, altrimenti si scarta (mai una provincia inventata).
   */
  capoluogo: string | null;
  /** Feed nazionale: la provincia si rileva riga per riga. */
  nazionale: boolean;
  /** Fonte interrogata nei run (false = registrata ma non usata). */
  attiva: boolean;
  /** Data ISO dell'ultima verifica HTTP (null = mai verificata → non attiva). */
  verificata: string | null;
  /** Motivo dell'esclusione (obbligatorio quando attiva è false). */
  note?: string;
}

/** Data dell'ultima verifica HTTP del registro. */
export const DATA_VERIFICA_FONTI = '2026-09-28';

const V = DATA_VERIFICA_FONTI;

/**
 * Aggregatore: indice dei post giornalieri. Il post è NAZIONALE (le voci sono
 * raggruppate per città), quindi la deduplica per URL evita di riscaricare lo
 * stesso post una volta per regione.
 */
export const AGGREGATORE_NAZIONALE = 'https://www.scuolainterpelli.it/interpelli-scuola-aggiornati/';

/** Massimo numero di fonti interrogate per una singola provincia. */
export const MAX_FONTI_PER_PROVINCIA = 5;

/** Massimo numero di fonti interrogate in un run (feed nazionale + hub locali). */
export const MAX_FONTI_PER_RUN = 12;

/** Registro completo: feed dell'aggregatore + hub istituzionali dei capoluoghi. */
export const FONTI_INTERPELLI: FonteInterpelli[] = [
  {
    id: 'aggregatore-nazionale',
    etichetta: 'Aggregatore interpelli — indice nazionale',
    url: AGGREGATORE_NAZIONALE,
    tipo: 'aggregatore',
    regioni: [],
    capoluogo: null,
    nazionale: true,
    attiva: true,
    verificata: V,
  },
  ...AGGREGATORI_REGIONALI.map(([regione, slug]) => ({
    id: `aggregatore-${regione.toLowerCase().replace(/[^a-z]+/g, '-')}`,
    etichetta: `Aggregatore interpelli — archivio ${regione}`,
    url: `https://www.scuolainterpelli.it/${slug}/`,
    tipo: 'aggregatore' as TipoFonte,
    regioni: [regione],
    capoluogo: null,
    nazionale: true,
    attiva: true,
    verificata: V,
  })),
  ...HUB_ATTIVI.map(([id, etichetta, url, regioni, capoluogo]) => ({
    id: `hub-${id}`,
    etichetta,
    url,
    tipo: 'hub-istituzionale' as TipoFonte,
    regioni,
    capoluogo,
    nazionale: false,
    attiva: true,
    verificata: V,
  })),
  ...HUB_ESCLUSI.map(([id, etichetta, url, regioni, capoluogo, note]) => ({
    id: `hub-${id}`,
    etichetta,
    url,
    tipo: 'hub-istituzionale' as TipoFonte,
    regioni,
    capoluogo: capoluogo || null,
    nazionale: !capoluogo,
    attiva: false,
    verificata: null,
    note,
  })),
];

/* ----------------------------- Selezione fonti ----------------------------- */

/** Regione di una provincia (codice ISTAT a 2 lettere), se mappata. */
export function regioneDiProvincia(codice: string): string | null {
  const c = (codice ?? '').trim().toUpperCase();
  return province.find((p) => p.codice === c)?.regione ?? null;
}

/** Fonti interrogabili in questo run (registro filtrato). */
export function fontiAttive(): FonteInterpelli[] {
  return FONTI_INTERPELLI.filter((f) => f.attiva);
}

/** Deduplica per URL mantenendo l'ordine di priorità. */
export function dedupPerUrl(fonti: FonteInterpelli[]): FonteInterpelli[] {
  const visti = new Set();
  const out: FonteInterpelli[] = [];
  for (const f of fonti) {
    if (visti.has(f.url)) continue;
    visti.add(f.url);
    out.push(f);
  }
  return out;
}

/**
 * Fonti da interrogare per una provincia, in ordine di priorità:
 * 1. hub istituzionali della regione (USR/USP del capoluogo);
 * 2. aggregatore nazionale (post del giorno — feed NAZIONALE);
 * 3. archivio regionale dell'aggregatore (recupero dei post precedenti).
 * Le province non mappate su una regione restano coperte dal feed nazionale.
 */
export function fontiPerProvincia(provincia: string, max = MAX_FONTI_PER_PROVINCIA): FonteInterpelli[] {
  const regione = regioneDiProvincia(provincia);
  const attive = fontiAttive();
  const hub = attive.filter((f) => f.tipo === 'hub-istituzionale' && regione && f.regioni.includes(regione));
  const nazionale = attive.filter((f) => f.tipo === 'aggregatore' && f.regioni.length === 0);
  const archivio = attive.filter((f) => f.tipo === 'aggregatore' && regione && f.regioni.includes(regione));
  return dedupPerUrl([...hub, ...nazionale, ...archivio]).slice(0, max);
}

/**
 * Fonti da interrogare in un RUN multi-provincia: prima gli hub locali (sono
 * quelli che portano i bandi del capoluogo), poi il feed nazionale. Gli ARCHIVI
 * regionali dell'aggregatore sono opt-in (includiArchivi): contengono gli
 * stessi post NAZIONALI dei giorni precedenti, quindi servono solo al backfill
 * manuale (SCRAPER_ARCHIVI=1) e non al run quotidiano.
 */
export function fontiPerRun(
  provincie: string[],
  max = MAX_FONTI_PER_RUN,
  opts: { includiArchivi?: boolean } = {},
): FonteInterpelli[] {
  const hub: FonteInterpelli[] = [];
  const nazionali: FonteInterpelli[] = [];
  const archivi: FonteInterpelli[] = [];
  for (const p of provincie) {
    const regione = regioneDiProvincia(p);
    for (const f of fontiAttive()) {
      if (f.tipo === 'hub-istituzionale' && regione && f.regioni.includes(regione)) hub.push(f);
      else if (f.tipo === 'aggregatore' && f.regioni.length === 0) nazionali.push(f);
      else if (opts.includiArchivi && f.tipo === 'aggregatore' && regione && f.regioni.includes(regione)) {
        archivi.push(f);
      }
    }
  }
  return dedupPerUrl([...hub, ...nazionali, ...archivi]).slice(0, max);
}