/**
 * ScuoleRadar.it — REGISTRO FONTI INTERPELLI (Node-only, PURO) — Capoluoghi & hub.
 * PERIMETRO (separazione dei domini): questo registro riguarda SOLO il motore
 * degli INTERPELLI di lavoro (src/scraper/). Nessuna fonte editoriale, nessun
 * comunicato stampa, nessuna rassegna: le notizie del MIM vivono in
 * src/departments/notizie/ e non entrano MAI nella bacheca degli interpelli.
 * I DATI (URL verificate) stanno in tre blocchi: fontiRegistro.ts (USR dei
 * capoluoghi + archivi dell'aggregatore), fontiTerritoriali.ts (elenchi degli
 * Uffici Territoriali, provincia per provincia) e fontiEsclusiVerifica.ts (URL
 * non verificabili, con il motivo). Qui ci sono i tipi, la costruzione del
 * registro e la SELEZIONE delle fonti per provincia/run. La copertura
 * dichiarata (regioni e capoluoghi) sta in fontiCopertura.ts.
 * 
 * Tipi di fonte (aggiornato §26.123):
 * · aggregatore       → SPAVENTO: nessun aggregatore privato è interrogabile.
 *                       Le voci restano registrate e SPENTE con il motivo, e il
 *                       filtro duro è in `fontiAttive()` (`eAggregatorePrivato`):
 *                       riaccendere una voce non la rende interrogabile;
 * · hub-istituzionale → pagine di reclutamento USR/USP dei capoluoghi di
 *                       regione e hub metropolitani (docenti, ATA, PNRR,
 *                       esperti esterni pubblicati dall'ente).
 * AGGREGATORI (§26.123): `scuolainterpelli.it` vive nel registro SOLO come voce
 * spenta. Qualunque host di `AGGREGATORI_PRIVATI` è escluso da `fontiAttive()`
 * anche se la voce è `attiva: true`: un aggregatore non è una fonte, è un
 * concorrente, e la sua riga in bacheca sarebbe un falso positivo col link di
 * un terzo.
 * 
 * Nessuna URL inventata: una fonte non verificabile resta registrata con
 * attiva: false e il motivo in note (npm run fonti:verifica le ricontrolla).
 */

import { province } from '../data/province.ts';
import { eAggregatorePrivato } from '../lib/dominiIstituzionali.ts';
import { AGGREGATORI_SPENTI } from './fontiAggregatori.ts';
import { HUB_ATTIVI, HUB_ESCLUSI } from './fontiRegistro.ts';
import { DATA_VERIFICA_TERRITORI, HUB_TERRITORIALI } from './fontiTerritoriali.ts';
import { HUB_ESCLUSI_VERIFICA } from './fontiEsclusiVerifica.ts';
import { FONTI_WHITELIST_2610 } from './fontiWhitelist2610.ts';
import type { FonteInterpelli, TipoFonte } from './fontiTipi.ts';

// I tipi restano importabili da qui (superficie pubblica invariata): la forma
// dei dati vive in `fontiTipi.ts`, così questo file resta sotto le 250 righe.
export type { FonteInterpelli, TipoFonte };

/** Data dell'ultima verifica HTTP del registro. */
export const DATA_VERIFICA_FONTI = '2026-09-28';

const V = DATA_VERIFICA_FONTI;

/** Aggregatore nazionale: costante pubblica, voce SPENTA (§26.123). */
export { AGGREGATORE_NAZIONALE, AGGREGATORI_SPENTI } from './fontiAggregatori.ts';

/** Massimo numero di fonti interrogate per una singola provincia. */
export const MAX_FONTI_PER_PROVINCIA = 5;

/**
 * Massimo numero di fonti interrogate in un run (feed nazionale + hub locali).
 * §26.101 (29/10/2026) — ATTACCO DI MASSA: era **12**. Con dodici fonti su ~180
 * verificate il giro quotidiano rileggeva sempre gli stessi capoluoghi: era il
 * budget (`SCRAPER_FONTI_MAX`) a fermarsi, non il registro a essere corto.
 */
export const MAX_FONTI_PER_RUN = 20;

/**
 * Tetti degli hub interrogati per regione in un run (§26.89, §26.101).
 * Gli hub territoriali verificati sono molti (un elenco per provincia), il
 * budget di rete di un run no. Restano tutti ATTIVI e verificati: questo tetto
 * sceglie solo quali interrogare ORA, con due garanzie:
 *   1. gli hub della provincia richiesta passano sempre per primi;
 *   2. la finestra sui restanti RUOTA ogni giorno (giorno UTC), così nell'arco
 *      della settimana tutti gli hub della regione vengono interrogati.
 * Dal 29/10/2026 la finestra è **10** (era 6): sei hub coprivano un terzo delle
 * province di Lombardia, Emilia-Romagna e Puglia e la rotazione non bastava.
 */
export const MAX_HUB_PER_REGIONE = 10;

/**
 * Registro completo: SOLO hub istituzionali attivi + aggregatori dichiarati
 * spenti (`fontiAggregatori.ts`, §26.123).
 */
export const FONTI_INTERPELLI: FonteInterpelli[] = [
  ...AGGREGATORI_SPENTI,
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
  // Blocco territoriale (verifica 2026-10-23 + aggiornamento 2026-10-25): elenchi
  // di interpelli degli Uffici Territoriali, provincia per provincia. La data di
  // verifica è quella dichiarata dalla singola voce (sesto campo della tupla).
  ...HUB_TERRITORIALI.map(([id, etichetta, url, regioni, capoluogo, data]) => ({
    id: `hub-${id}`,
    etichetta,
    url,
    tipo: 'hub-istituzionale' as TipoFonte,
    regioni,
    capoluogo,
    nazionale: false,
    attiva: true,
    verificata: data ?? DATA_VERIFICA_TERRITORI,
  })),
  // Stesse URL escluse: registrate con il motivo, mai interrogate.
  ...HUB_ESCLUSI_VERIFICA.map(([id, etichetta, url, regioni, capoluogo, note]) => ({
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
  // Whitelist UST/USR verificata il 26/10/2026 (blocco autonomo in
  // `fontiWhitelist2610.ts`: 85 fonti attive + 27 spente con il motivo).
  ...FONTI_WHITELIST_2610,
];

/* ----------------------------- Selezione fonti ----------------------------- */

/** Regione di una provincia (codice ISTAT a 2 lettere), se mappata. */
export function regioneDiProvincia(codice: string): string | null {
  const c = (codice ?? '').trim().toUpperCase();
  return province.find((p) => p.codice === c)?.regione ?? null;
}

/**
 * Fonti interrogabili in questo run (registro filtrato).
 *
 * §26.123 — BLOCCO A MONTE: oltre al flag `attiva`, qualunque host elencato in
 * `AGGREGATORI_PRIVATI` (`lib/dominiIstituzionali.ts`) è escluso **sempre**.
 * È la difesa in profondità: il flag può essere riacceso per errore (o da un
 * import futuro), la whitelist dei domini no. Un aggregatore concorrente non
 * entra nel motore per nessun motivo.
 */
export function fontiAttive(): FonteInterpelli[] {
  return FONTI_INTERPELLI.filter((f) => f.attiva && !eAggregatorePrivato(f.url));
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
 * Hub della REGIONE da interrogare ORA, in ordine di priorità: prima le
 * province richieste (i loro bandi contano di più), poi gli altri hub del
 * territorio con la finestra ROTANTE di `MAX_HUB_PER_REGIONE`.
 *
 * La rotazione usa il GIORNO UTC: due run dello stesso giorno scelgono gli
 * stessi hub (run ripetibili e testabili) e, con il passare dei giorni, la
 * finestra scorre su tutti gli hub della regione (un ciclo completo del
 * `resto` li copre tutti). `giorno` è un parametro solo per i test.
 */
export function hubDellaRegione(
  regione: string,
  priorita: string[] = [],
  giorno = Math.floor(Date.now() / 86_400_000),
): FonteInterpelli[] {
  const hub = fontiAttive().filter((f) => f.tipo === 'hub-istituzionale' && f.regioni.includes(regione));
  const pos = (f: FonteInterpelli) => {
    const i = priorita.indexOf(f.capoluogo ?? '');
    return i === -1 ? priorita.length : i;
  };
  const ordinati = [...hub].sort((a, b) => pos(a) - pos(b));
  if (ordinati.length <= MAX_HUB_PER_REGIONE) return ordinati;
  const fissi = ordinati.filter((f) => pos(f) < priorita.length);
  const resto = ordinati.slice(fissi.length);
  const k = resto.length > 0 ? giorno % resto.length : 0;
  return [...fissi, ...resto.slice(k), ...resto.slice(0, k)].slice(0, MAX_HUB_PER_REGIONE);
}

/**
 * Fonti da interrogare per una provincia, in ordine di priorità:
 * 1. hub istituzionali della regione (USP/ATP della provincia in testa);
 * 2. (solo se un aggregatore fosse attivo — oggi nessuno, §26.123) il feed
 *    nazionale, che resta l'unica fonte che vede TUTTE le province.
 * Con gli aggregatori spenti il budget va interamente agli hub: `riserva` vale 0
 * e il tetto per provincia è tutto per il territorio.
 */
export function fontiPerProvincia(provincia: string, max = MAX_FONTI_PER_PROVINCIA): FonteInterpelli[] {
  const regione = regioneDiProvincia(provincia);
  const attive = fontiAttive();
  const nazionale = attive.filter((f) => f.tipo === 'aggregatore' && f.regioni.length === 0);
  const archivio = attive.filter((f) => f.tipo === 'aggregatore' && regione && f.regioni.includes(regione));
  // Il feed nazionale è l'unica fonte che vede TUTTE le province: si tiene
  // sempre un posto per lui, anche quando la regione ha molti hub territoriali.
  const riserva = nazionale.length > 0 ? 1 : 0;
  const hub = regione ? hubDellaRegione(regione, [provincia]).slice(0, Math.max(1, max - riserva)) : [];
  return dedupPerUrl([...hub, ...nazionale, ...archivio]).slice(0, max);
}

/**
 * Fonti da interrogare in un RUN multi-provincia: prima gli hub locali (sono
 * quelli che portano i bandi del capoluogo), poi — se esistono — gli aggregatori.
 *
 * §26.123: con gli aggregatori spenti `nazionali`/`archivi` sono vuoti e il
 * budget è tutto degli hub; il codice resta generico (se un giorno una fonte
 * istituzionale nazionale entrasse nel registro, il posto riservato funziona).
 * `includiArchivi` resta per il backfill manuale: oggi non seleziona nulla.
 */
export function fontiPerRun(
  provincie: string[],
  max = MAX_FONTI_PER_RUN,
  opts: { includiArchivi?: boolean } = {},
): FonteInterpelli[] {
  const attive = fontiAttive();
  const regioni = [...new Set(provincie.map(regioneDiProvincia).filter((r): r is string => Boolean(r)))];
  const hub: FonteInterpelli[] = [];
  for (const regione of regioni) hub.push(...hubDellaRegione(regione, provincie));
  const nazionali = attive.filter((f) => f.tipo === 'aggregatore' && f.regioni.length === 0);
  const archivi = opts.includiArchivi
    ? attive.filter((f) => f.tipo === 'aggregatore' && regioni.some((r) => f.regioni.includes(r)))
    : [];
  const tettoHub = Math.max(1, max - (nazionali.length > 0 ? 1 : 0));
  return dedupPerUrl([...hub.slice(0, tettoHub), ...nazionali, ...archivi]).slice(0, max);
}