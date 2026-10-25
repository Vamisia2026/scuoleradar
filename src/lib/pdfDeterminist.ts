/**
 * ScuoleRadar.it — LETTURA DETERMINISTICA DEL TESTO PDF (modulo PURO, §26.83).
 *
 * Prima del parsing pesante o di una chiamata LLM si leggono con regex i dati
 * che rendono un avviso lavorabile — SCADENZA, CLASSI DI CONCORSO, RECAPITO —
 * distinguendo la PUBBLICAZIONE dalla SCADENZA (§26.72) e normalizzando i codici
 * (`A022` → `A-22`). Con scadenza FUTURA, almeno una classe e confidenza ≥
 * `SOGLIA_CONFIDENZA` l'esito è `success` e `needsLlmFallback` resta false;
 * altrimenti si passa SOLO `candidateChunk` (≤ `MAX_CHUNK_CHARS` caratteri
 * attorno a scadenza/oggetto), mai il testo integrale del documento.
 *
 * Invarianti: zero import (nessuna rete, nessun LLM), regex precompilate,
 * scansione ≤ `MAX_SCAN_CHARS`, esito deterministico a parità di `now`.
 * Guardia: `npm run test:pdf-determinist` (incluso in `npm test`).
 */

/** Snippet massimo consegnato all'LLM quando serve il ripiego. */
export const MAX_CHUNK_CHARS = 500;
/** Confidenza minima per dichiarare l'avviso leggibile senza LLM. */
export const SOGLIA_CONFIDENZA = 0.8;
/** Un PDF dichiara i suoi dati in testa; oltre si legge l'allegato. */
const MAX_SCAN_CHARS = 60_000;

/** Dati estratti dal testo (tutti opzionali tranne `classCodes`). */
export interface DeterministicPdfData {
  expirationDate?: string; // ISO YYYY-MM-DD, anche se già passata
  publicationDate?: string; // ISO, solo se il testo la qualifica
  classCodes: string[]; // max 8, normalizzate, senza duplicati
  email?: string; // PEC > PEO istituzionale > primo indirizzo
  schoolName?: string;
}

/** Esito: `success` significa «nessun LLM necessario». */
export interface DeterministicPdfResult {
  success: boolean;
  confidence: number; // 0…1: scadenza 0,5 (+0,1 se forte) · classi 0,3 · contatti 0,1
  data: DeterministicPdfData;
  needsLlmFallback: boolean;
  candidateChunk?: string; // solo col fallback, ≤ MAX_CHUNK_CHARS
}

const MESI: Readonly<Record<string, number>> = {
  gennaio: 1, febbraio: 2, marzo: 3, aprile: 4, maggio: 5, giugno: 6,
  luglio: 7, agosto: 8, settembre: 9, ottobre: 10, novembre: 11, dicembre: 12,
};

/** Spazi (NBSP compresi) e righe su uno spazio: i PDF spezzano le frasi a metà
 *  («entro il\n15/11/2026»), la vista compatta le ricompone per le regex. */
function normalizza(testo: string): string {
  if (typeof testo !== 'string' || testo.length === 0) return '';
  const pulito = testo.replace(/[\u00a0\u2007\u202f]/g, ' ').replace(/\s+/g, ' ').trim();
  return pulito.length > MAX_SCAN_CHARS ? pulito.slice(0, MAX_SCAN_CHARS) : pulito;
}

type DataTrovata = { iso: string; index: number; length: number };

const RE_DATA_ISO = /\b(\d{4})-(\d{2})-(\d{2})\b/g;
const RE_DATA_NUMERICA = /\b(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})\b/g;
const RE_DATA_TESTUALE =
  /\b(\d{1,2})\s*(?:°|º)?\s*(gennaio|febbraio|marzo|aprile|maggio|giugno|luglio|agosto|settembre|ottobre|novembre|dicembre)\s+(\d{4})\b/gi;

/** Data reale (31/02 no) e anno plausibile: «297/1994» e «88/2024» non sono
 *  scadenze di interpello. */
function dataValida(anno: number, mese: number, giorno: number): string | null {
  if (anno < 2000 || anno > 2100 || mese < 1 || mese > 12 || giorno < 1 || giorno > 31) return null;
  const d = new Date(Date.UTC(anno, mese - 1, giorno));
  if (d.getUTCMonth() !== mese - 1 || d.getUTCDate() !== giorno) return null;
  return `${anno}-${String(mese).padStart(2, '0')}-${String(giorno).padStart(2, '0')}`;
}

/** Tutte le date del testo, in ordine di comparsa e senza sovrapposizioni. */
function raccogliDate(testo: string): DataTrovata[] {
  const trovate: DataTrovata[] = [];
  const aggiungi = (iso: string | null, index: number, length: number): void => {
    if (iso) trovate.push({ iso, index, length });
  };
  for (const m of testo.matchAll(RE_DATA_ISO)) {
    aggiungi(dataValida(+m[1], +m[2], +m[3]), m.index ?? 0, m[0].length);
  }
  for (const m of testo.matchAll(RE_DATA_NUMERICA)) {
    const anno = m[3].length === 2 ? 2000 + +m[3] : +m[3];
    aggiungi(dataValida(anno, +m[2], +m[1]), m.index ?? 0, m[0].length);
  }
  for (const m of testo.matchAll(RE_DATA_TESTUALE)) {
    aggiungi(dataValida(+m[3], MESI[m[2].toLowerCase()] ?? 0, +m[1]), m.index ?? 0, m[0].length);
  }
  trovate.sort((a, b) => a.index - b.index);
  const filtrate: DataTrovata[] = [];
  for (const d of trovate) {
    const prev = filtrate[filtrate.length - 1];
    if (!prev || d.index >= prev.index + prev.length) filtrate.push(d);
  }
  return filtrate;
}

/** Parole chiave che datano un termine di candidatura (peso crescente). */
const SEGNALI_SCADENZA: readonly { re: RegExp; peso: number }[] = [
  { re: /\bscadenz\w*|\bscade\b|\bscadut\w*/i, peso: 3 },
  { re: /\bentro\b|\bnon\s+oltre\b/i, peso: 3 },
  { re: /\bore\s+(?:[01]?\d|2[0-3])(?::\d{2})?\b/i, peso: 2 },
  { re: /\btermine\b|\bchiusur\w*|\bultimo\s+giorno\b|\bfino\s+al\b/i, peso: 2 },
  { re: /presentazion\w*|presentare|domand\w*|candidatur\w*|istanz\w*|ricezion\w*|invio|trasmis\w*/i, peso: 1 },
];
/** Parole chiave che qualificano una data come PUBBLICAZIONE (non scadenza). */
const RE_PUBBLICAZIONE = /pubblicat\w*|pubblicazion\w*|data\s+di|del\s+giorno|aggiornat\w*|caricat\w*/i;

type DataAnalizzata = DataTrovata & { peso: number; pubblicazione: boolean };

/** Classifica le date: parola chiave PRIMA (più forte) e DOPO la data. */
function analizzaDate(testo: string): DataAnalizzata[] {
  const peso = (frammento: string): number =>
    Math.min(SEGNALI_SCADENZA.reduce((n, s) => (s.re.test(frammento) ? n + s.peso : n), 0), 6);
  return raccogliDate(testo).map((d) => {
    const prima = testo.slice(Math.max(0, d.index - 70), d.index);
    const dopo = testo.slice(d.index + d.length, d.index + d.length + 35);
    return { ...d, peso: peso(prima) * 2 + peso(dopo), pubblicazione: RE_PUBBLICAZIONE.test(prima) };
  });
}

const RE_CLASSE_TRATTINO = /\b([A-Z]{1,2})[-._](\d{2,3})\b/g;
const RE_CLASSE_COMPATTA = /\b([A-Z])(\d{3})\b/g;
const RE_CLASSE_DOPPIA = /\b([A-Z]{2})(\d{2})\b/g;
const RE_SOSTEGNO = /\b(AD(?:[A-Z]{2,3}|\d{2}))\b/g;
/** Segnaposto generici delle tabelle ministeriali: non sono classi. */
const CLASSI_ESCLUSE = new Set(['AAAA', 'EEEE', 'XXXX', 'ZZZZ']);

/** Forma canonica (allineata a `matchingEngine.normalizzaClasse`): `A022`,
 *  `A-022` → **`A-22`**; `B-02` → **`B-02`**. I codici a DUE lettere + 2 cifre
 *  restano compatti (`AB25`, `AD24`); le sigle di sostegno (`ADEE`) non cambiano. */
function normalizzaCodiceClasse(lettere: string, cifre: string): string | null {
  const numero = Number(cifre);
  if (!Number.isInteger(numero) || numero < 1 || numero > 99) return null;
  const due = String(numero).padStart(2, '0');
  return lettere.length === 1 ? `${lettere}-${due}` : `${lettere}${due}`;
}

/** Classi presenti nel testo, normalizzate e in ordine di comparsa. */
export function estraiCodiciClasse(testo: string): string[] {
  const maiuscolo = (testo ?? '').toUpperCase();
  const grezzi: { codice: string; index: number }[] = [];
  const aggiungi = (codice: string | null, index: number): void => {
    if (codice && !CLASSI_ESCLUSE.has(codice)) grezzi.push({ codice, index });
  };
  for (const m of maiuscolo.matchAll(RE_SOSTEGNO)) aggiungi(m[1], m.index ?? 0);
  for (const m of maiuscolo.matchAll(RE_CLASSE_TRATTINO)) aggiungi(normalizzaCodiceClasse(m[1], m[2]), m.index ?? 0);
  for (const m of maiuscolo.matchAll(RE_CLASSE_COMPATTA)) aggiungi(normalizzaCodiceClasse(m[1], m[2]), m.index ?? 0);
  for (const m of maiuscolo.matchAll(RE_CLASSE_DOPPIA)) aggiungi(`${m[1]}${m[2]}`, m.index ?? 0);
  grezzi.sort((a, b) => a.index - b.index);
  return [...new Set(grezzi.map((g) => g.codice))].slice(0, 8);
}

const RE_EMAIL = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g;

/** Recapito preferito: etichetta PEC/PEO, poi dominio (PEC > PEO > edu/gov). */
function estraiEmail(testo: string): string | undefined {
  let migliore: string | undefined;
  let migliorPunteggio = -1;
  for (const m of testo.matchAll(RE_EMAIL)) {
    const email = m[0].replace(/[.,;:]+$/, '').toLowerCase();
    const prima = testo.slice(Math.max(0, (m.index ?? 0) - 25), m.index ?? 0);
    const etichetta = /\bPEC\b|posta\s+elettronica\s+certificata/i.test(prima) ? 2
      : /\bPEO\b|e-?mail/i.test(prima) ? 1 : 0;
    const dominio = /@pec\.istruzione\.it$/i.test(email) ? 4
      : /@istruzione\.it$/i.test(email) ? 3
        : /@(?:[a-z0-9-]+\.)*(?:edu|gov)\.it$/i.test(email) ? 2 : 0;
    const punteggio = dominio + etichetta;
    if (punteggio > migliorPunteggio) [migliorPunteggio, migliore] = [punteggio, email];
  }
  return migliore;
}

const RE_NOME_ISTITUTO =
  /\b(Istituto\s+(?:Comprensivo|Statale|Tecnico|Professionale|Superiore)|Liceo(?:\s+[A-Z][\w'’]+){0,4}|Scuola\s+(?:Secondaria|Primaria|dell['’]Infanzia)|ITIS|IPSIA|ITC|ITI|CPIA|Convitto\s+Nazionale|Direzione\s+Didattica)\b/i;
/** Coda amministrativa o di testo che non fa parte del nome dell'istituto. */
const RE_CODA_NOME = /\s+(?:[-–—]\s+)?(?:prot\.?|pec|peo|e-?mail|tel\.?|c\.f\.|codice|oggetto|avviso|classe\s+di\s+concorso|termine|scadenza|domande)\b/i;

/** Denominazione dichiarata su una riga del PDF (ripulita dalla coda). */
function estraiNomeIstituto(testo: string): string | undefined {
  for (const riga of (testo ?? '').split(/\r?\n/)) {
    const linea = riga.replace(/[\u00a0\u2007\u202f]/g, ' ').replace(/\s+/g, ' ').trim();
    const m = linea.length >= 8 ? RE_NOME_ISTITUTO.exec(linea) : null;
    if (!m || m.index === undefined) continue;
    const coda = RE_CODA_NOME.exec(linea.slice(m.index));
    const nome = linea.slice(m.index, coda && coda.index > 0 ? m.index + coda.index : undefined);
    const pulito = nome.replace(/^["'«“]+|["'»”]+$/g, '').replace(/[\s,;:.\-–—]+$/, '').trim();
    if (pulito.length >= 8) return pulito.slice(0, 120);
  }
  return undefined;
}

const RE_ANCORA_SCADENZA = /scadenz|entro|termine|chiusur|presentazion|domand|candidatur/i;
const RE_ANCORA_OGGETTO = /oggetto|classe\s+di\s+concorso|supplenz|interpell/i;

/** Finestra di `MAX_CHUNK_CHARS` attorno al segnale che conta (scadenza, poi
 *  oggetto/classe/supplenza): il documento intero non esce mai da qui. */
function candidateChunk(testo: string): string | undefined {
  if (!testo) return undefined;
  const ancora = RE_ANCORA_SCADENZA.exec(testo) ?? RE_ANCORA_OGGETTO.exec(testo);
  const inizio = Math.max(0, (ancora?.index ?? 0) - 150);
  // Si parte dopo uno spazio: il modello non deve ricevere una parola spezzata.
  const da = inizio > 0 ? testo.indexOf(' ', inizio) + 1 : 0;
  return testo.slice(da, da + MAX_CHUNK_CHARS).trim() || testo.slice(0, MAX_CHUNK_CHARS);
}

/**
 * Legge il testo di un PDF e decide se basta la via deterministica.
 * `now` è iniettabile nei test: in produzione si omette.
 */
export function parsePdfDeterminist(pdfText: string, now: Date = new Date()): DeterministicPdfResult {
  const testo = normalizza(pdfText);
  const classCodes = estraiCodiciClasse(testo);
  const data: DeterministicPdfData = { classCodes };
  if (!testo) return { success: false, confidence: 0, data, needsLlmFallback: true };

  const oggi = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const date = analizzaDate(testo);
  // Scadenza: prima le date con un segnale esplicito, privilegiando le future.
  const scadenze = date.filter((d) => d.peso >= 2).sort((a, b) => b.peso - a.peso || a.index - b.index);
  const scadenza = scadenze.find((d) => d.iso >= oggi) ?? scadenze[0];
  if (scadenza) data.expirationDate = scadenza.iso;
  const pub = date.find((d) => d.pubblicazione && d.iso !== scadenza?.iso);
  if (pub) data.publicationDate = pub.iso;
  const email = estraiEmail(testo);
  if (email) data.email = email;
  const schoolName = estraiNomeIstituto(pdfText);
  if (schoolName) data.schoolName = schoolName;

  let confidenza = scadenza ? 0.5 + (scadenza.peso >= 4 ? 0.1 : 0) : 0;
  if (classCodes.length > 0) confidenza += 0.3;
  if (email) confidenza += 0.05;
  if (schoolName) confidenza += 0.05;
  const confidence = Math.min(1, Math.round(confidenza * 100) / 100);
  const success = Boolean(scadenza && scadenza.iso >= oggi) && classCodes.length > 0 && confidence >= SOGLIA_CONFIDENZA;
  if (success) return { success: true, confidence, data, needsLlmFallback: false };

  const chunk = candidateChunk(testo);
  return { success: false, confidence, data, needsLlmFallback: true, ...(chunk ? { candidateChunk: chunk } : {}) };
}
