/**
 * ScuoleRadar.it — Parser Interpelli (FASE 1)
 *
 * Modulo puro e riutilizzabile: a partire da un avviso grezzo (titolo,
 * URL, provincia, testo di contesto) estrae:
 *   - le classi di concorso / sostegno via Regex (A-12, A-026, ADEE, AD24…)
 *   - la data di scadenza (formato numerico gg/mm/aaaa oppure italiano "22 agosto 2026")
 *   - l'hash_id SHA-256 univoco (provincia|titolo|data) per l'upsert anti-duplicati
 *
 * Non dipende dalla rete né da Supabase: è testabile in isolamento.
 */

import { createHash } from 'node:crypto';

/* ------------------------------- Tipi ------------------------------- */

export interface InterpelloInput {
  /** Titolo dell'avviso (es. "Interpello supplenza A-026 Matematica e fisica") */
  title: string;
  /** URL della fonte ufficiale */
  link: string | null;
  /** Codice provincia, es. 'AT' */
  provincia: string;
  /** Nome della sorgente (URL pagina / 'fixture') */
  source: string;
  /** Testo aggiuntivo (contesto HTML) usato per estrarre date e classi */
  corpo?: string;
  /** Data di scadenza già nota (es. da attributo HTML), in formato libero o ISO YYYY-MM-DD */
  dataNota?: string | null;
  /** Nome della scuola (se disponibile) */
  schoolName?: string | null;
  /** Codice meccanografico della scuola (se disponibile) */
  schoolCode?: string | null;
}

export interface InterpelloParsato {
  title: string;
  link: string | null;
  province: string;
  classCodes: string[];
  /** Data di scadenza normalizzata YYYY-MM-DD, se presente */
  expirationDate: string | null;
  /** SHA256 di `provincia|titolo|data` — chiave anti-duplicato */
  hashId: string;
  source: string;
  schoolName: string | null;
  schoolCode: string | null;
}

/* --------------------- Regex per le classi di concorso --------------------- */

/**
 * Rileva i codici di classe di concorso:
 *  - formato classico: A-12, A-026, B-02, B-001
 *  - speciali sostegno: ADEE, ADSS, ADMM, AD24, ...
 */
const RE_CLASSI = /\b(?:[A-Z]{1,2}-\d{2,3}|AD(?:[A-Z]{2,3}|\d{2}))\b/g;

export function rilevaClassi(testo: string): string[] {
  const trovate = testo.match(RE_CLASSI) ?? [];
  return [...new Set(trovate.map((c) => c.toUpperCase()))];
}

/**
 * Categoria dell'opportunità rilevata dal testo (copre tutte le tipologie
 * gestite dallo scraper): Interpelli/Supplenze, PON, POR, PNRR e bandi per
 * esperti (ricerca esperti / selezione esperti).
 */
export function rilevaCategoriaAvviso(testo: string): string {
  const t = testo.toLowerCase();
  // Priorità per specificità: PNRR > PON > POR > Esperti > Interpelli > Bandi.
  // Copre sia gli acronimi (PNRR / PON / POR) sia le denominazioni complete
  // (Next Generation EU, Programma Operativo Nazionale/Regionale, FSE, FESR).
  if (/\bpnrr\b|next generation eu|missione 4/.test(t)) return 'PNRR';
  if (/\bpon\b|programma operativo nazionale|\bfse\b/.test(t)) return 'PON';
  if (/\bpor\b|programma operativo regionale|\bfesr\b/.test(t)) return 'POR';
  if (/espert|reclutamento/.test(t)) return 'Bando Esperti';
  if (/interpell|supplenz/.test(t)) return 'Interpello / Supplenza';
  if (/bando|avviso|pubblicazione|selezione|incarico|procedura|manifestazione di interesse/.test(t)) {
    return 'Bando / Avviso';
  }
  return 'Altro';
}

/**
 * True se il contesto di un link/avviso sembra un'opportunità da intercettare.
 * Copre TUTTE le tipologie gestite dallo scraper: interpelli/supplenze, bandi,
 * avvisi, pubblicazioni, selezioni di esperti (ricerca esperti / selezione
 * esperti) e i fondi PON / POR / PNRR (es. "Bando per esperto esterno PNRR").
 */
export function sembraOpportunita(contesto: string): boolean {
  // Copre TUTTE le tipologie gestite: interpelli/supplenze, bandi/avvisi,
  // selezioni di esperti (ricerca esperti / reclutamento esperti) e i fondi
  // PON / POR / PNRR, anche con le denominazioni estese (FSE, FESR,
  // Programma Operativo, Next Generation EU).
  return /interpell|supplenz|avviso|bando|pubblicazione|selezione|espert|pnrr|next generation eu|pon\b|por\b|fse\b|fesr\b|programma operativo|fondi strutturali|incarico|procedura|manifestazione di interesse|finanziamento/i.test(
    contesto,
  );
}

/* ------------------------------- Date ------------------------------- */

const MESI_IT: Record<string, string> = {
  gennaio: '01', febbraio: '02', marzo: '03', aprile: '04', maggio: '05', giugno: '06',
  luglio: '07', agosto: '08', settembre: '09', ottobre: '10', novembre: '11', dicembre: '12',
};

function pad(n: string): string {
  return n.padStart(2, '0');
}

/** Converte una data già in formato ISO (YYYY-MM-DD) nell'intervallo valido, oppure null. */
function validaIso(data: string): string | null {
  const m = data.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  const [, anno, mese, giorno] = m;
  if (Number(mese) < 1 || Number(mese) > 12) return null;
  if (Number(giorno) < 1 || Number(giorno) > 31) return null;
  return `${anno}-${mese}-${giorno}`;
}

/** Formato numerico italiano gg/mm/aaaa, gg-mm-aaaa o gg.mm.aaaa → YYYY-MM-DD. */
export function normalizzaDataNumerica(testo: string): string | null {
  const match = testo.match(/\b(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})\b/);
  if (!match) return null;
  const [, gg, mm, aa] = match;
  const anno = aa.length === 2 ? `20${aa}` : aa;
  return validaIso(`${anno}-${pad(mm)}-${pad(gg)}`);
}

/** Formato testuale italiano "22 agosto 2026" → YYYY-MM-DD. */
export function normalizzaDataTestuale(testo: string): string | null {
  const m = testo
    .toLowerCase()
    .match(
      /\b(\d{1,2})\s+(gennaio|febbraio|marzo|aprile|maggio|giugno|luglio|agosto|settembre|ottobre|novembre|dicembre)\s+(\d{4})\b/,
    );
  if (!m) return null;
  return validaIso(`${m[3]}-${MESI_IT[m[2]]}-${pad(m[1])}`);
}

/** Estrae la prima data di scadenza valida (testuale italiana, poi numerica). */
export function estraiDataScadenza(testo: string): string | null {
  return normalizzaDataTestuale(testo) ?? normalizzaDataNumerica(testo);
}

/* ------------------------------- Hashing ------------------------------- */

/** SHA256 di `provincia|titolo|data` — chiave univoca anti-duplicati. */
export function generaHashId(province: string, title: string, data: string | null): string {
  const payload = `${province}|${title.trim()}|${data ?? ''}`;
  return createHash('sha256').update(payload).digest('hex');
}

/* ------------------------------- Parser ------------------------------- */

/**
 * Parsa un avviso grezzo in un `InterpelloParsato` completo:
 * classi di concorso, data di scadenza normalizzata e hash_id univoco.
 */
export function parseInterpello(input: InterpelloInput): InterpelloParsato {
  const testoCompleto = `${input.title} ${input.corpo ?? ''}`;

  // Se la data nota è già ISO la si usa direttamente; altrimenti la si estrae dal testo.
  let expirationDate: string | null = null;
  if (input.dataNota && /^\d{4}-\d{2}-\d{2}/.test(input.dataNota.trim())) {
    expirationDate = validaIso(input.dataNota.trim());
  } else {
    expirationDate = estraiDataScadenza(`${input.dataNota ?? ''} ${testoCompleto}`);
  }

  return {
    title: input.title.trim(),
    link: input.link,
    province: input.provincia.trim().toUpperCase(),
    classCodes: rilevaClassi(testoCompleto),
    expirationDate,
    hashId: generaHashId(input.provincia, input.title, expirationDate),
    source: input.source,
    schoolName: input.schoolName?.trim() || null,
    schoolCode: input.schoolCode?.trim() || null,
  };
}
