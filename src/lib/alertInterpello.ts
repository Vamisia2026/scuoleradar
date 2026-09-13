/**
 * ScuoleRadar.it — Costruttore di AVVISI STRUTTURATI (card/messaggi puliti).
 *
 * Trasforma i dati grezzi di un interpello (che nelle fonti appaiono come righe
 * di tabella lunghe e disomogenee) in una gerarchia informativa STRETTA:
 *
 *   OBBLIGATORI (sempre presenti): Provincia · Ordine di scuola · Classe/Materia · Scadenza
 *   OPZIONALI  (mostrati SOLO se estratti): Scuola · Data di pubblicazione
 *
 * Regole:
 *  - i campi opzionali assenti NON vengono resi (nessun placeholder tipo "N/D");
 *  - la Scadenza è valida solo se è una data reale (altrimenti è "mancante");
 *  - `completo === true` solo quando TUTTI i campi obbligatori sono presenti:
 *    i messaggi/notifiche usano questo flag per SALTARE in modo sicuro gli avvisi
 *    incompleti, mentre le card gestiscono la scadenza assente in modo garbato.
 *
 * Modulo PURO: usabile sia dal frontend sia dallo scraper/notifier (Node).
 */
import type { OrdineScuola } from '../data/ordiniMaterie';
import { classeByCodice, etichettaClasseMateria } from '../data/classiConcorso';

/** Etichetta leggibile dell'ordine di scuola. */
export const ORDINE_ETICHETTA: Record<OrdineScuola, string> = {
  infanzia: "Scuola dell'Infanzia",
  primaria: 'Scuola Primaria',
  secondaria1: 'Secondaria di I grado',
  secondaria2: 'Secondaria di II grado',
  cpia: 'CPIA / Adulti',
  serali: 'Corsi serali',
  pon: 'PON / PNRR',
  ata: 'Personale ATA',
};

/** Codici ATA abbreviati usati dalle fonti → ordine "ata". */
const ATA_ALIAS = new Set(['AA', 'AT', 'CS', 'DSGA', 'ATA-AA', 'ATA-AT', 'ATA-CS']);

const MESI_BREVI = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic'];
const MESI_LUNGHI = [
  'gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno',
  'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre',
];
const GIORNI = ['domenica', 'lunedì', 'martedì', 'mercoledì', 'giovedì', 'venerdì', 'sabato'];

/** True se il valore è una data ISO interpretabile. */
export function dataIsoValida(valore?: string | null): boolean {
  const s = (valore ?? '').trim();
  if (!s) return false;
  return !Number.isNaN(new Date(s).getTime());
}

/** Data breve "15 set 2026" (UTC, nessuno slittamento di fuso). */
export function formatDataAvviso(iso?: string | null): string {
  if (!dataIsoValida(iso)) return '';
  const d = new Date(iso as string);
  return `${String(d.getUTCDate()).padStart(2, '0')} ${MESI_BREVI[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

/** Data estesa "martedì 15 settembre 2026" (UTC). */
export function formatDataAvvisoLunga(iso?: string | null): string {
  if (!dataIsoValida(iso)) return '';
  const d = new Date(iso as string);
  return `${GIORNI[d.getUTCDay()]} ${d.getUTCDate()} ${MESI_LUNGHI[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

/** Dati grezzi accettati dal costruttore (frontend e scraper). */
export interface DatiAvviso {
  /** Nome leggibile della provincia (preferito) o, in mancanza, il codice. */
  provincia?: string | null;
  /** Codici di classe di concorso rilevati (il primo determina ordine + etichetta). */
  classCodes?: string[] | null;
  /** Codice classe singolo (alternativa a `classCodes`). */
  classCode?: string | null;
  /** Materia/settore (evidenza di ripiego quando manca la classe). */
  materia?: string | null;
  /** Ordine esplicito (dal feed); se assente è dedotto dalla classe. */
  ordine?: OrdineScuola | string | null;
  scadenza?: string | null;
  schoolName?: string | null;
  pubblicazione?: string | null;
}

export interface RigaAvviso {
  etichetta: string;
  valore: string;
}

export interface AvvisoStrutturato {
  /** Righe obbligatorie presenti (max 4: Provincia, Ordine, Classe/Materia, Scadenza). */
  obbligatorie: RigaAvviso[];
  /** Righe opzionali presenti (Scuola, Pubblicato) — solo se estratte. */
  opzionali: RigaAvviso[];
  /** Etichette dei campi obbligatori RISULTATI MANCANTI. */
  mancanti: string[];
  /** true = tutti i campi obbligatori presenti. */
  completo: boolean;
  /** true = la scadenza è una data valida (per gestirla con garbo se assente). */
  scadenzaValida: boolean;
}

/** Deduce l'ordine di scuola (etichetta) dalla classe o dal codice ATA. */
function ordineDaClasse(classCode?: string | null): string {
  const c = (classCode ?? '').trim().toUpperCase();
  if (!c) return '';
  if (ATA_ALIAS.has(c)) return ORDINE_ETICHETTA.ata;
  const ordine = classeByCodice(c)?.ordine;
  return ordine ? ORDINE_ETICHETTA[ordine] ?? '' : '';
}

/**
 * Costruisce l'avviso strutturato con la gerarchia STRETTA.
 * I campi opzionali assenti non compaiono; la mancanza di obbligatori è esposta
 * in `mancanti` (per saltare in modo sicuro o gestire con garbo).
 */
export function costruisciAvviso(dati: DatiAvviso): AvvisoStrutturato {
  const obbligatorie: RigaAvviso[] = [];
  const opzionali: RigaAvviso[] = [];
  const mancanti: string[] = [];

  // 1) Provincia
  const provincia = (dati.provincia ?? '').trim();
  if (provincia) obbligatorie.push({ etichetta: 'Provincia', valore: provincia });
  else mancanti.push('Provincia');

  // 2) Ordine di scuola (esplicito o dedotto dalla classe)
  const classCode = (dati.classCode ?? dati.classCodes?.[0] ?? '').trim();
  const ordine =
    (dati.ordine ? ORDINE_ETICHETTA[dati.ordine as OrdineScuola] ?? String(dati.ordine) : '') ||
    ordineDaClasse(classCode);
  if (ordine) obbligatorie.push({ etichetta: 'Ordine di scuola', valore: ordine });
  else mancanti.push('Ordine di scuola');

  // 3) Classe / Materia
  const classe = etichettaClasseMateria(classCode, dati.materia).trim();
  if (classe) obbligatorie.push({ etichetta: 'Classe / Materia', valore: classe });
  else mancanti.push('Classe / Materia');

  // 4) Scadenza (obbligatoria: valida solo se è una data reale)
  const scadenzaValida = dataIsoValida(dati.scadenza);
  if (scadenzaValida) {
    obbligatorie.push({ etichetta: 'Scadenza', valore: formatDataAvviso(dati.scadenza) });
  } else {
    mancanti.push('Scadenza');
  }

  // OPZIONALI — solo se estratti (nessun placeholder).
  const scuola = (dati.schoolName ?? '').trim();
  if (scuola) opzionali.push({ etichetta: 'Scuola', valore: scuola });
  if (dataIsoValida(dati.pubblicazione)) {
    opzionali.push({ etichetta: 'Pubblicato', valore: formatDataAvviso(dati.pubblicazione) });
  }

  return { obbligatorie, opzionali, mancanti, completo: mancanti.length === 0, scadenzaValida };
}

/** True se l'avviso ha TUTTI i campi obbligatori (pronto per la notifica). */
export function avvisoNotificabile(dati: DatiAvviso): boolean {
  return costruisciAvviso(dati).completo;
}

export const ICONA_RIGA: Record<string, string> = {
  Provincia: '📍',
  'Ordine di scuola': '🎓',
  'Classe / Materia': '📚',
  Scadenza: '📅',
  Scuola: '🏫',
  Pubblicato: '🗓️',
};

/**
 * Righe di testo (con emoji) per i messaggi Telegram/email, rispettando la
 * gerarchia: obbligatorie SEMPRE, opzionali solo se presenti. La scadenza è la
 * sola obbligatoria che, se assente, viene OMESSA garbatamente (nessun blocco
 * "Scadenza: Non indicata").
 */
export function righeTestoAvviso(dati: DatiAvviso): string[] {
  const a = costruisciAvviso(dati);
  const righe: string[] = [];
  for (const r of a.obbligatorie) righe.push(`${ICONA_RIGA[r.etichetta] ?? '•'} ${r.etichetta}: ${r.valore}`);
  for (const r of a.opzionali) righe.push(`${ICONA_RIGA[r.etichetta] ?? '•'} ${r.etichetta}: ${r.valore}`);
  return righe;
}


/* --------------------- Pulizia dei titoli grezzi (tabelle) --------------------- */

/** True se il token è SOLO un codice classe (A042, A-041, ADEE, EEEE, AA56, BI02…). */
const RE_SOLO_CODICE = /^(?:[A-Z]{1,2}-?\d{2,3}|A[DS][A-Z]{2}|[A-Z]{4}|[A-Z]{2}\d{2})$/;

function soloCodiciClasse(segmento: string): boolean {
  const pulito = segmento
    .replace(/[()[\]{},/·•|;–—-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!pulito) return true;
  const token = pulito.split(' ');
  return token.every((tk) => RE_SOLO_CODICE.test(tk.toUpperCase()) || /^\d{1,3}\s*(?:ore|h)$/i.test(tk));
}

/**
 * Pulisce un titolo grezzo proveniente dalle TABELLE delle fonti: rimuove i
 * "dump" di codici classe separati da `|`/`·`/`–` (es. "ADEE | A042 | AAAA |
 * ADAA | EEEE | A042 | ADMM"), gli artefatti tipo "timbro_FIRMATO_" e gli spazi
 * multipli. Se resta troppo poco (titolo fatto solo di codici) usa il `fallback`
 * (es. "Interpello A-041 — Torino"), così l'alert resta leggibile e curato.
 */
export function pulisciTitoloAvviso(titolo?: string | null, fallback?: string | null): string {
  const grezzo = (titolo ?? '').replace(/\s+/g, ' ').trim();
  const fb = (fallback ?? '').replace(/\s+/g, ' ').trim();
  if (!grezzo) return fb || 'Avviso ufficiale';

  const segmenti = grezzo
    .split(/\s*[|•·]\s*|\s+[–—]\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
  const tenuti = segmenti.filter((s) => !soloCodiciClasse(s));

  let pulito = (tenuti.length > 0 ? tenuti.join(' — ') : '')
    .replace(/timbro[_\s-]*firmato[_\s-]*/gi, '')
    .replace(/\btimbro\b/gi, '')
    .replace(/[_]{2,}/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .replace(/^[\s–—-]+|[\s–—-]+$/g, '')
    .trim();

  // Se è rimasto troppo poco (o è ancora un dump di codici) → fallback curato.
  if (pulito.length < 8 || soloCodiciClasse(pulito)) pulito = fb;
  return pulito || 'Avviso ufficiale';
}

