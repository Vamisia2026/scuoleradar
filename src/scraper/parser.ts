/**
 * ScuoleRadar.it — Parser Interpelli (FASE 1)
 *
 * Modulo puro e riutilizzabile: a partire da un avviso grezzo (titolo,
 * URL, provincia, testo di contesto) estrae:
 *   - la provincia REALE dell'istituto emittente (codice meccanografico o comune
 *     citato nel testo) — senza applicare fallback fissi su una provincia
 *     (l'ultima spiaggia è la provincia della fonte, che è dinamica);
 *   - il nome dell'istituto emittente, quando riconoscibile (altrimenti null);
 *   - le classi di concorso / sostegno via Regex (A-12, A-026, ADEE, AD24…)
 *   - la data di PUBBLICAZIONE (intestazione/contesto) e la SCADENZA REALE del
 *     bando, tenute DISTINTE: la data di pubblicazione non viene mai assegnata
 *     alla scadenza (nessuna inversione). La scadenza è estratta solo quando il
 *     testo la dichiara (parole chiave tipo "scadenza"/"entro"/"termine") oppure
 *     calcolata da un termine relativo ("entro N giorni dalla pubblicazione").
 *   - l'hash_id SHA-256 univoco (provincia|titolo|data) per l'upsert anti-duplicati
 *
 * Non dipende dalla rete né da Supabase: è testabile in isolamento.
 */

import { createHash } from 'node:crypto';
import { province } from '../data/province.ts';

/* ------------------------------- Tipi ------------------------------- */

export interface InterpelloInput {
  /** Titolo dell'avviso (es. "Interpello supplenza A-026 Matematica e fisica") */
  title: string;
  /** URL della fonte ufficiale */
  link: string | null;
  /** Codice provincia della FONTE (fallback usato solo se il testo non ne indica una). */
  provincia: string;
  /** Nome della sorgente (URL pagina / 'fixture') */
  source: string;
  /** Testo aggiuntivo (contesto HTML) usato per estrarre date e classi */
  corpo?: string;
  /** Data di SCADENZA già nota esplicitamente (es. attributo HTML), libera o ISO YYYY-MM-DD */
  dataNota?: string | null;
  /**
   * Data di PUBBLICAZIONE già nota (es. dall'intestazione/titolo del post o da un
   * attributo `<time datetime>`), libera o ISO YYYY-MM-DD. È distinta dalla scadenza.
   */
  dataPubblicazione?: string | null;
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
  /** Data di PUBBLICAZIONE dell'avviso (ISO YYYY-MM-DD), se rilevata dall'intestazione/contesto */
  publishedAt: string | null;
  /** Data di SCADENZA reale (ISO YYYY-MM-DD): dichiarata nel bando o calcolata, altrimenti null */
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

/** Normalizza un valore di data (ISO, testuale italiano o numerico gg/mm/aaaa) in YYYY-MM-DD. */
export function normalizzaData(valore?: string | null): string | null {
  const v = (valore ?? '').trim();
  if (!v) return null;
  return (
    validaIso(v) ??
    normalizzaDataTestuale(v) ??
    normalizzaDataNumerica(v) ??
    raccogliDate(v)[0]?.iso ??
    null
  );
}

/** Una data trovata nel testo, con la posizione del match (per l'analisi del contesto). */
interface DataRilevata {
  iso: string;
  index: number;
  length: number;
}

const RE_DATA_TESTUALE =
  /\b(\d{1,2})\s*(?:°|º)?\s*(gennaio|febbraio|marzo|aprile|maggio|giugno|luglio|agosto|settembre|ottobre|novembre|dicembre)\s+(\d{4})\b/gi;
const RE_DATA_ISO = /\b(\d{4})-(\d{2})-(\d{2})\b/g;
const RE_DATA_NUMERICA = /\b(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})\b/g;

/** Raccoglie TUTTE le date del testo (testuali, ISO e numeriche), con la loro posizione. */
export function raccogliDate(testo: string): DataRilevata[] {
  const trovate: DataRilevata[] = [];
  let m: RegExpExecArray | null;

  RE_DATA_TESTUALE.lastIndex = 0;
  while ((m = RE_DATA_TESTUALE.exec(testo)) !== null) {
    const iso = validaIso(`${m[3]}-${MESI_IT[m[2].toLowerCase()]}-${pad(m[1])}`);
    if (iso) trovate.push({ iso, index: m.index, length: m[0].length });
  }
  RE_DATA_ISO.lastIndex = 0;
  while ((m = RE_DATA_ISO.exec(testo)) !== null) {
    const iso = validaIso(m[0]);
    if (iso) trovate.push({ iso, index: m.index, length: m[0].length });
  }
  RE_DATA_NUMERICA.lastIndex = 0;
  while ((m = RE_DATA_NUMERICA.exec(testo)) !== null) {
    const anno = m[3].length === 2 ? `20${m[3]}` : m[3];
    const iso = validaIso(`${anno}-${pad(m[2])}-${pad(m[1])}`);
    if (iso) trovate.push({ iso, index: m.index, length: m[0].length });
  }

  trovate.sort((a, b) => a.index - b.index);
  // Scarta i match sovrapposti (es. una sottostringa già riconosciuta da un altro pattern).
  const filtrate: DataRilevata[] = [];
  for (const d of trovate) {
    const precedente = filtrate[filtrate.length - 1];
    if (precedente && d.index < precedente.index + precedente.length) continue;
    filtrate.push(d);
  }
  return filtrate;
}

/**
 * Parole chiave che qualificano una data come SCADENZA. Devono PRECEDERE la data
 * ("Scadenza: 15/09/2026", "entro il 12/09/2026", "termine presentazione domande: …"):
 * così una data di pubblicazione in testa al post NON viene mai scambiata per scadenza.
 */
const RE_CONTESTO_SCADENZA =
  /scadenz|scade|scadut|\bentro\b|\btermine\b|presentazion|presentare|domand|istanz|non oltre|ultimo|ricezion|\binvio\b|fino al/i;

/** Parole chiave che qualificano una data come PUBBLICAZIONE. */
const RE_CONTESTO_PUBBLICAZIONE =
  /pubblicat|pubblicazion|in data|del giorno|data di|caricat|aggiornat/i;

/** Termine relativo: "entro 7 giorni (dalla pubblicazione)". */
const RE_SCADENZA_RELATIVA =
  /(?:entro|termine(?:\s+di)?|non oltre|fino\s+a)\s+(?:i\s+|le\s+)?(\d{1,3})\s*(?:giorni|gg)\b/i;

/** Somma N giorni a una data ISO (YYYY-MM-DD). */
function aggiungiGiorni(iso: string, giorni: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return iso;
  d.setUTCDate(d.getUTCDate() + giorni);
  return d.toISOString().slice(0, 10);
}

/** Prima data preceduta (entro 45 caratteri) da un contesto che soddisfa `re`. */
function estraiDataConContesto(testo: string, re: RegExp): string | null {
  for (const d of raccogliDate(testo)) {
    const prima = testo.slice(Math.max(0, d.index - 45), d.index);
    if (re.test(prima)) return d.iso;
  }
  return null;
}

/** Data di pubblicazione ESPLICITAMENTE qualificata nel testo (solo contesto). */
function estraiDataPubblicazioneDaContesto(testo: string): string | null {
  return estraiDataConContesto(testo, RE_CONTESTO_PUBBLICAZIONE);
}

/**
 * Estrae la data di PUBBLICAZIONE dall'intestazione/titolo o dal contesto:
 *   1) data preceduta da una parola chiave di pubblicazione ("pubblicato il …");
 *   2) altrimenti, per un testo BREVE (intestazione/titolo) senza indizi di
 *      scadenza, la prima data è la pubblicazione del post.
 */
export function estraiDataPubblicazione(testo: string): string | null {
  const esplicita = estraiDataPubblicazioneDaContesto(testo);
  if (esplicita) return esplicita;
  const compatto = (testo ?? '').replace(/\s+/g, ' ').trim();
  if (compatto.length > 0 && compatto.length <= 80 && !RE_CONTESTO_SCADENZA.test(compatto)) {
    return raccogliDate(compatto)[0]?.iso ?? null;
  }
  return null;
}

/**
 * Estrae la SCADENZA REALE del bando, SENZA inversioni:
 *   1) una data dichiarata come scadenza ("scadenza", "entro", "termine", "domande", …);
 *   2) altrimenti un termine relativo ("entro 7 giorni") calcolato dalla pubblicazione.
 * Se il bando non dichiara la scadenza ritorna null: NON si riusa la pubblicazione.
 */
export function estraiDataScadenza(
  testo: string,
  pubblicazione: string | null = null,
): string | null {
  const dichiarata = estraiDataConContesto(testo, RE_CONTESTO_SCADENZA);
  if (dichiarata) return dichiarata;

  const relativa = (testo ?? '').match(RE_SCADENZA_RELATIVA);
  if (relativa && pubblicazione) return aggiungiGiorni(pubblicazione, Number(relativa[1]));
  return null;
}

/* ------------------------------- Hashing ------------------------------- */

/** SHA256 di `provincia|titolo|data` — chiave univoca anti-duplicati. */
export function generaHashId(province: string, title: string, data: string | null): string {
  const payload = `${province}|${title.trim()}|${data ?? ''}`;
  return createHash('sha256').update(payload).digest('hex');
}

/* -------------------- Provincia & scuola dai dati reali -------------------- */

/** Minuscole e senza accenti, coi separatori preservati (confini di parola verificabili). */
function senzaAccenti(testo: string): string {
  return (testo ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

/** Codici provincia validi (107) — serve a convalidare i codici meccanografici. */
const CODICI_PROVINCIA = new Set(province.map((p) => p.codice));

/** Nomi provincia normalizzati, dal più lungo al più corto (match più specifico prima). */
const NOMI_PROVINCIA = province
  .map((p) => ({ chiave: senzaAccenti(p.nome).replace(/[^a-z0-9]+/g, ' ').trim(), codice: p.codice }))
  .sort((a, b) => b.chiave.length - a.chiave.length);

/**
 * Alias città → codice per i territori il cui capoluogo non coincide col nome
 * della provincia nel dataset (es. "Forlì-Cesena" → la città è Forlì;
 * "Verbano-Cusio-Ossola" → la città è Verbania).
 */
const ALIAS_CITTA: { chiave: string; codice: string }[] = [
  { chiave: 'aosta', codice: 'AO' },
  { chiave: 'cesena', codice: 'FC' },
  { chiave: 'carrara', codice: 'MS' },
  { chiave: 'andria', codice: 'BT' },
  { chiave: 'trani', codice: 'BT' },
  { chiave: 'urbino', codice: 'PU' },
  { chiave: 'verbania', codice: 'VB' },
];

/** Nomi che da soli sono anche parole comuni: ammessi solo in contesto locativo. */
const CITTA_AMBIGUE = new Set(['prato', 'massa']);

const CANDIDATI_CITTA = [...NOMI_PROVINCIA, ...ALIAS_CITTA];

/** Locuzioni che introducono il comune dell'istituto ("di Milano", "— Bergamo", ", Pavia"). */
const PREPOSIZIONI_CITTA = 'di|del|dello|della|dei|degli|delle|presso|in|a|ad|nel|nella';

/** Pattern regex (su testo normalizzato) per il nome di un comune. */
function regexCitta(chiave: string, locativo: boolean): RegExp {
  const nome = chiave.replace(/ /g, '[^a-z0-9]+');
  if (!locativo) return new RegExp(`(?:^|[^a-z0-9])${nome}(?![a-z0-9])`);
  // Il boundary serve solo al ramo "preposizione": punteggiatura e trattini
  // sono già di per sé non alfanumerici e non possono stare dentro una parola.
  return new RegExp(
    `(?:(?:^|[^a-z0-9])(?:${PREPOSIZIONI_CITTA})\\s+|[,\\;:\\u2013\\u2014-]+\\s*)${nome}(?![a-z0-9])`,
  );
}

/** Provincia dal codice meccanografico della scuola (es. "MIIC81200P" → "MI"). */
export function estraiProvinciaDaCodiceScuola(codice?: string | null): string | null {
  const c = (codice ?? '').trim().toUpperCase();
  const m = c.match(/^([A-Z]{2})[A-Z]{2}\d{5}/);
  return m && CODICI_PROVINCIA.has(m[1]) ? m[1] : null;
}

/**
 * Estrae il codice provincia dell'istituto emittente dai dati REALI dell'avviso:
 *   1. codice meccanografico della scuola (es. "MIIC81200P" → "MI");
 *   2. comune in contesto locativo ("di Milano", "— Bergamo", ", Pavia");
 *   3. comune "distintivo" come parola a sé stante.
 * Nessuna deduzione creativa: se non c'è un indizio affidabile ritorna null
 * (decide il chiamante; il fallback NON è mai una provincia fissa).
 */
export function estraiProvincia(testo: string): string | null {
  const t = senzaAccenti(testo).trim();
  if (!t) return null;

  const mecc = t.match(/\b([a-z]{2})[a-z]{2}\d{5}\b/);
  if (mecc && CODICI_PROVINCIA.has(mecc[1].toUpperCase())) return mecc[1].toUpperCase();

  for (const { chiave, codice } of CANDIDATI_CITTA) {
    if (regexCitta(chiave, true).test(t)) return codice;
  }
  for (const { chiave, codice } of CANDIDATI_CITTA) {
    if (chiave.length < 4 || CITTA_AMBIGUE.has(chiave)) continue;
    if (regexCitta(chiave, false).test(t)) return codice;
  }
  return null;
}

/** True se la stringa è (solo) il nome di un comune/provincia, non un istituto. */
function eNomeCitta(testo: string): boolean {
  const chiave = senzaAccenti(testo).replace(/[^a-z0-9]+/g, ' ').trim();
  if (!chiave) return false;
  return CANDIDATI_CITTA.some((c) => c.chiave === chiave);
}

/** Keyword che designano un istituto scolastico. */
const RE_TIPO_SCUOLA =
  /\b(?:i\.?\s?c\.?|istituto\s+comprensivo|istituto\s+(?:tecnico|professionale)|istituto|liceo|convitto|cpia|scuola(?:\s+(?:primaria|secondaria(?:\s+di\s+(?:i|ii)\s+grado)?|dell'infanzia|materna|media))?|direzione\s+didattica|iis|itis|itc|itg|ipsia|ipsct|ipss)\b/i;

/** Candidati che sono solo la tipologia, senza il nome proprio dell'istituto. */
const SCUOLE_GENERICHE = new Set([
  'istituto', 'liceo', 'scuola', 'convitto', 'cpia', 'iis', 'ic', 'i c',
  'scuola primaria', 'scuola secondaria', 'scuola media', 'scuola materna',
  "scuola dell'infanzia", 'scuola secondaria di i grado', 'scuola secondaria di ii grado',
  'direzione didattica', 'istituto comprensivo', 'istituto tecnico', 'istituto professionale',
  'liceo scientifico', 'liceo classico', 'liceo linguistico', 'liceo artistico',
  'liceo delle scienze umane', 'liceo sportivo', 'liceo musicale',
]);

/** Rifinisce un candidato istituto: taglia classi/parentesi e scarta i generici. */
function pulisciScuola(grezzo: string): string | null {
  let s = (grezzo ?? '').replace(/\s+/g, ' ').trim();
  s = (s.split(/[,;|(]/)[0] ?? s).trim();
  s = s.replace(/[\s\-–—.,;:]+$/, '').trim();
  if (s.length < 3 || s.length > 90) return null;
  if (/\d/.test(s)) return null; // numeri ⇒ classe di concorso / codice, non un nome
  const chiave = senzaAccenti(s).replace(/[^a-z0-9]+/g, ' ').trim();
  if (SCUOLE_GENERICHE.has(chiave)) return null;
  if (eNomeCitta(s)) return null; // è una città, non una scuola
  if (!/[a-z]/i.test(s)) return null;
  return s;
}

/**
 * Estrae il nome dell'istituto emittente dal titolo/contesto dell'avviso.
 * Se non è riconoscibile con affidabilità ritorna null (nessuna deduzione creativa).
 */
export function estraiScuola(testo: string): string | null {
  const t = (testo ?? '').replace(/\s+/g, ' ').trim();
  if (!t) return null;

  const match = RE_TIPO_SCUOLA.exec(t);
  if (match) {
    const candidato = pulisciScuola(t.slice(match.index));
    if (candidato) return candidato;
  }

  // Fallback: solo con un trattino lungo (l'ultimo blocco è di norma la scuola).
  const parti = t.split(/[—–]/);
  if (parti.length < 2) return null;
  return pulisciScuola((parti[parti.length - 1] ?? '').trim());
}

/* ------------------------------- Parser ------------------------------- */

/**
 * Parsa un avviso grezzo in un `InterpelloParsato` completo:
 * provincia e istituto REALI, data di PUBBLICAZIONE e SCADENZA REALE (distinte),
 * classi di concorso e hash_id univoco.
 */
export function parseInterpello(input: InterpelloInput): InterpelloParsato {
  const testoCompleto = `${input.title} ${input.corpo ?? ''}`;

  // Data di PUBBLICAZIONE: prima un valore esplicito (intestazione/<time>), poi il
  // contesto ("pubblicato il …"). La pubblicazione non è MAI usata come scadenza.
  const publishedAt =
    normalizzaData(input.dataPubblicazione) ??
    estraiDataPubblicazioneDaContesto(testoCompleto);

  // SCADENZA reale: un hint esplicito, oppure una data dichiarata nel bando, oppure
  // un termine relativo calcolato dalla pubblicazione. Altrimenti null (no inversioni).
  const expirationDate =
    normalizzaData(input.dataNota) ??
    estraiDataScadenza(testoCompleto, publishedAt);

  // Provincia REALE dell'istituto: prima dal titolo, poi dal contesto, poi dal
  // codice meccanografico; solo come ultima spiaggia la provincia della fonte
  // (dinamica — mai una provincia fissa tipo Torino).
  const provincia =
    estraiProvincia(input.title) ??
    estraiProvincia(testoCompleto) ??
    estraiProvinciaDaCodiceScuola(input.schoolCode) ??
    input.provincia.trim().toUpperCase();

  // Scuola emittente: dal campo esplicito, altrimenti estratta dal titolo/contesto.
  const scuola = input.schoolName?.trim() || estraiScuola(input.title) || estraiScuola(testoCompleto);

  return {
    title: input.title.trim(),
    link: input.link,
    province: provincia,
    classCodes: rilevaClassi(testoCompleto),
    publishedAt,
    expirationDate,
    // L'hash resta ancorato alla provincia della FONTE: identità stabile nel tempo.
    hashId: generaHashId(input.provincia, input.title, expirationDate),
    source: input.source,
    schoolName: scuola || null,
    schoolCode: input.schoolCode?.trim() || null,
  };
}
