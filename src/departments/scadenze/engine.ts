/**
 * ScuoleRadar.it — Motore scadenze (Deadlines Engine).
 *
 * Logica PURA e testabile (nessuna dipendenza React/DOM):
 *   · risolve i record master (vedi ./types.ts) in occorrenze con data
 *     certa, proiettando le ricorrenze "MM-DD" nell'anno scolastico attivo
 *     (settembre → agosto) con rollover automatico;
 *   · rispetta la regola di visibilità: un item resta ATTIVO fino alle
 *     23:59:59.999 del giorno esatto / endDate e decade alla mezzanotte
 *     successiva;
 *   · produce la coda dei primi N appuntamenti più vicini, ordinati in
 *     ordine cronologico di apertura: appena un item decade, il successivo
 *     entra automaticamente in coda.
 *
 * Convenzione date: mese 0-11 in ingresso (Date), 1-12 nei token testuali.
 */

import type { DeadlineRecord, ScadenzaProiettata, TipoScadenza } from './types';

/* ------------------------------ Costanti ------------------------------ */

/** Numero massimo di scadenze mostrate nel revolver (Queue Limit). */
export const LIMITE_CODA_SCADENZE = 10;

const MESI_BREVI = [
  'GEN',
  'FEB',
  'MAR',
  'APR',
  'MAG',
  'GIU',
  'LUG',
  'AGO',
  'SET',
  'OTT',
  'NOV',
  'DIC',
] as const;

const MESI_LUNGHI = [
  'gennaio',
  'febbraio',
  'marzo',
  'aprile',
  'maggio',
  'giugno',
  'luglio',
  'agosto',
  'settembre',
  'ottobre',
  'novembre',
  'dicembre',
] as const;

const MS_GIORNO = 86_400_000;

/** Token di data testuale già scomposto. `anno === undefined` ⇒ ricorrente. */
interface TokenData {
  anno?: number;
  mese: number; // 1-12
  giorno: number;
}

/* ------------------------- Helper data temporali ------------------------- */

/** Anno solare di riferimento del ciclo scolastico attivo (inizio settembre). */
export function cicloScolasticoDi(oggi: Date): number {
  return oggi.getMonth() >= 8 ? oggi.getFullYear() : oggi.getFullYear() - 1;
}

/** Giorno civile come numero UTC (confronti immuni a fuso/DST). */
function giornoCivile(d: Date): number {
  return Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
}

/** Differenza in GIORNI CIVILI tra due date locali (al dopo ⇒ positivo). */
export function giorniCalendarioTra(dal: Date, al: Date): number {
  return Math.round((giornoCivile(al) - giornoCivile(dal)) / MS_GIORNO);
}

/** Fine giornata inclusiva (23:59:59.999 locale) del giorno indicato. */
export function fineGiornata(giorno: Date): Date {
  return new Date(
    giorno.getFullYear(),
    giorno.getMonth(),
    giorno.getDate(),
    23,
    59,
    59,
    999,
  );
}

/** Anno nel ciclo scolastico per un mese: set-dic ⇒ ciclo, gen-ago ⇒ ciclo+1. */
function annoNelCiclo(ciclo: number, mese1_12: number): number {
  return mese1_12 >= 9 ? ciclo : ciclo + 1;
}

/* -------------------------- Parsing token data -------------------------- */

/**
 * "YYYY-MM-DD" → anno esplicito; "MM-DD" → ricorrenza annuale (anno assente).
 * Ritorna null se il token non è riconosciuto.
 */
export function parseTokenData(
  valore: string | null | undefined,
): TokenData | null {
  if (!valore) return null;
  const testo = valore.trim();
  if (!testo) return null;

  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(testo);
  if (iso) {
    return {
      anno: Number(iso[1]),
      mese: Number(iso[2]),
      giorno: Number(iso[3]),
    };
  }
  const annuale = /^(\d{2})-(\d{2})$/.exec(testo);
  if (annuale) {
    return { mese: Number(annuale[1]), giorno: Number(annuale[2]) };
  }
  return null;
}

function tokenValido(t: TokenData | null): t is TokenData {
  return (
    t !== null &&
    Number.isInteger(t.mese) &&
    t.mese >= 1 &&
    t.mese <= 12 &&
    Number.isInteger(t.giorno) &&
    t.giorno >= 1 &&
    t.giorno <= 31
  );
}

function dataDaToken(t: TokenData, anno: number): Date | null {
  if (!tokenValido(t)) return null;
  const data = new Date(anno, t.mese - 1, t.giorno);
  // Rifiuta date impossibili (es. 31 febbraio normalizzate da JS).
  if (data.getMonth() !== t.mese - 1 || data.getDate() !== t.giorno) return null;
  return data;
}

/* ------------------------- Risoluzione occorrenze ------------------------- */

export interface OccorrenzaRisolta {
  /** Inizio finestra o giorno esatto (00:00 locali). */
  inizio: Date;
  /** Scadenza inclusiva: ultimo secondo utile (23:59:59.999). */
  scadenza: Date;
}

/**
 * Costruisce una finestra ANNUALE (token senza anno) dentro il ciclo dato.
 * Gestisce anche finestre a cavallo d'anno (es. 12-20 → 01-10).
 */
function finestraAnnuale(
  start: TokenData,
  end: TokenData,
  ciclo: number,
): OccorrenzaRisolta | null {
  const annoStart = annoNelCiclo(ciclo, start.mese);
  // A cavallo d'anno (endMonth < startMonth) ⇒ fine nell'anno solare dopo.
  const annoEnd =
    end.mese < start.mese ? annoStart + 1 : annoNelCiclo(ciclo, end.mese);
  const dataInizio = dataDaToken(start, annoStart);
  const dataFine = dataDaToken(end, annoEnd);
  if (!dataInizio || !dataFine) return null;
  return { inizio: dataInizio, scadenza: fineGiornata(dataFine) };
}

/**
 * Occorrenza più prossima NON ancora scaduta per un record.
 *
 *   · token assoluti (anno presente) → valgono per quell'anno e basta:
 *     se la data è passata il record è scaduto (attende l'update API);
 *   · token ricorrenti ("MM-DD")     → prima proiezione nel ciclo scolastico
 *     attivo; se già scaduta, rollover automatico al ciclo successivo
 *     (annual renewal).
 *
 * Ritorna null per record malformati o assolutamente scaduti.
 */
export function prossimaOccorrenza(
  record: DeadlineRecord,
  oggi: Date,
): OccorrenzaRisolta | null {
  const tipo: TipoScadenza = record.type === 'window' ? 'window' : 'exact';
  if (record.active === false) return null;

  if (tipo === 'exact') {
    const token = parseTokenData(record.date ?? record.startDate ?? record.endDate);
    if (!tokenValido(token)) return null;

    // Data assoluta (con anno): una sola occorrenza, niente rollover.
    if (token.anno !== undefined) {
      const data = dataDaToken(token, token.anno);
      if (!data) return null;
      const scadenza = fineGiornata(data);
      if (scadenza.getTime() < oggi.getTime()) return null; // scaduta
      return { inizio: data, scadenza };
    }

    // Ricorrenza annuale: prova il ciclo attivo, poi il successivo.
    const ciclo = cicloScolasticoDi(oggi);
    for (let passo = 0; passo < 2; passo += 1) {
      const anno = annoNelCiclo(ciclo + passo, token.mese);
      const data = dataDaToken(token, anno);
      if (!data) return null;
      const scadenza = fineGiornata(data);
      if (scadenza.getTime() >= oggi.getTime()) {
        return { inizio: data, scadenza };
      }
    }
    return null;
  }

  // --- Finestra operativa (window) ---

  const start = parseTokenData(record.startDate ?? record.date);
  const end = parseTokenData(record.endDate ?? record.date ?? record.startDate);
  if (!tokenValido(start) || !tokenValido(end)) return null;

  const startAssoluta = start.anno !== undefined;
  const endAssoluta = end.anno !== undefined;

  if (startAssoluta || endAssoluta) {
    // Finestra datata (almeno un estremo assoluto): l'anno viene ancorato
    // all'estremo assoluto; l'estremo relativo condivide lo stesso anno
    // solare (o quello adiacente se la finestra cavalca l'anno).
    const annoBase = start.anno ?? end.anno;
    if (annoBase === undefined) return null;
    let annoStart: number;
    let annoEnd: number;
    if (start.anno !== undefined) {
      annoStart = start.anno;
      annoEnd =
        end.anno ?? (end.mese < start.mese ? annoStart + 1 : annoStart);
    } else {
      annoEnd = end.anno as number;
      annoStart = start.mese > end.mese ? annoEnd - 1 : annoEnd;
    }
    const dataInizio = dataDaToken(start, annoStart);
    const dataFine = dataDaToken(end, annoEnd);
    if (!dataInizio || !dataFine) return null;
    const scadenza = fineGiornata(dataFine);
    if (scadenza.getTime() < oggi.getTime()) return null; // scaduta
    return { inizio: dataInizio, scadenza };
  }

  // Finestra annuale ricorrente: ciclo attivo + rollover automatico.
  const ciclo = cicloScolasticoDi(oggi);
  for (let passo = 0; passo < 2; passo += 1) {
    const occ = finestraAnnuale(start, end, ciclo + passo);
    if (occ && occ.scadenza.getTime() >= oggi.getTime()) return occ;
  }
  return null;
}

/* --------------------------- Coda delle prime N --------------------------- */

/** Fase operativa del record, con fallback editoriale per dati spogli. */
export function faseOperativa(record: DeadlineRecord): string {
  const fase = record.phase?.trim();
  if (fase) return fase;
  return record.type === 'window' ? 'Finestra operativa' : 'Termine ultimo';
}

/**
 * Costruisce la coda cronologica delle scadenze attive/vicine: ordina per
 * data di apertura (inizio finestra / giorno esatto) e ritorna al massimo
 * `limite` elementi (default 10 — Queue Limit).
 *
 * Gli item scaduti (giorno esatto/endDate passato) vengono esclusi e
 * sostituiti automaticamente dal successivo in ordine di tempo.
 */
export function codaScadenze(
  lista: readonly DeadlineRecord[],
  oggi: Date,
  limite = LIMITE_CODA_SCADENZE,
): ScadenzaProiettata[] {
  const coda: ScadenzaProiettata[] = [];

  for (const record of lista) {
    if (record.active === false) continue;
    const occ = prossimaOccorrenza(record, oggi);
    if (!occ) continue;

    const giorniAllaScadenza = giorniCalendarioTra(oggi, occ.scadenza);
    if (giorniAllaScadenza < 0) continue; // già decaduta alle 00:00

    coda.push({
      record,
      fase: faseOperativa(record),
      inizio: occ.inizio,
      scadenza: occ.scadenza,
      attiva: occ.inizio.getTime() <= oggi.getTime(),
      giorniAllInizio: giorniCalendarioTra(oggi, occ.inizio),
      giorniAllaScadenza,
    });
  }

  coda.sort((a, b) => {
    const perInizio = a.inizio.getTime() - b.inizio.getTime();
    if (perInizio !== 0) return perInizio;
    return a.scadenza.getTime() - b.scadenza.getTime();
  });

  return coda.slice(0, Math.max(0, limite));
}

/* ------------------------------ Formattazione ------------------------------ */

function dueCifre(n: number): string {
  return String(n).padStart(2, '0');
}

/** "15 APR" — giorno + mese breve in maiuscolo (locale indipendente). */
export function formattaDataBreve(data: Date): string {
  return `${dueCifre(data.getDate())} ${MESI_BREVI[data.getMonth()]}`;
}

/** "15 aprile 2026" — data estesa italiana (anno solo se > 0). */
export function formattaDataItaliana(data: Date): string {
  const anno = data.getFullYear() > 0 ? ` ${data.getFullYear()}` : '';
  return `${data.getDate()} ${MESI_LUNGHI[data.getMonth()]}${anno}`;
}

/**
 * Periodo leggibile per la slide (sempre con l'anno per evitare ambiguità):
 * data unica per le scadenze esatte, intervallo per le finestre. Esempi:
 *   "28 OTT 2026" · "15 NOV → 30 NOV 2026" · "28 DIC 2026 → 05 GEN 2027"
 */
export function formattaPeriodo(
  occ: Pick<ScadenzaProiettata, 'inizio' | 'scadenza'> & {
    record: Pick<DeadlineRecord, 'type'>;
  },
): string {
  const completa = (d: Date): string =>
    `${dueCifre(d.getDate())} ${MESI_BREVI[d.getMonth()]} ${d.getFullYear()}`;

  if (occ.record.type === 'exact') return completa(occ.inizio);

  const stessaData = occ.inizio.getTime() === occ.scadenza.getTime();
  const stessoAnno = occ.inizio.getFullYear() === occ.scadenza.getFullYear();
  if (stessaData) return completa(occ.scadenza);

  const inizio = stessoAnno
    ? `${dueCifre(occ.inizio.getDate())} ${MESI_BREVI[occ.inizio.getMonth()]}`
    : completa(occ.inizio);
  return `${inizio} → ${completa(occ.scadenza)}`;
}
