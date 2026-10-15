// scripts/table-reporter.ts
//
// Table Reporter — v9
//   • FIX v9 — Supporto rigido per portali USR Piemonte:
//       - Filtro STATO INTERPELLO: processa SOLO righe con stato "aperto".
//         Scarta "chiuso", "cancellato", vuoto o qualsiasi altro valore.
//       - Estrazione SCADENZA dalla colonna "Data Scadenza Interpello"
//         (formato YYYY-MM-DD o DD/MM/YYYY). Se manca la colonna, usa il
//         fallback +15 giorni oppure scarta (configurabile).
//       - Lettura rigida orizzontale: Colonna 1 = Codice Meccanografico
//         (deriva provincia AT/CN/TO/AL/NO/VC/VB/BI), Colonna 2 = Denominazione.
//   • FIX #1 — Forzatura assoluta della scadenza (v8):
//       - Cerca QUALSIASI colonna con "scadenza" nell'header o nel testo.
//       - MAI usare la "Data Pubblicazione" come deadline.
//   • FIX #2 — Eliminazione totale degli "EE" (v8):
//       - Analizza la PRIMISSIMA cella per codice meccanografico.
//       - Se ancora "EE", cerca la sigla nell'URL (`ambito_cn`, `_to.php`, ...).
//   • FIX #3 — Nome scuola pulito (v8):
//       - MAI "SCUOLA NON SPECIFICATA".
//   • FIX #4 — Ingestione Master Liguria (v8):
//       - Supporto `servizi.istruzioneliguria.gov.it/provincia.php?p=...`.
//   • Auto-disattivazione target inutili (v6) preservata.
//   • Cleanup iniziale Umbria (v6) preservato.
//   • Anti-spam Sindacale & Rumore — Zero Tolleranza (v5).
//   • Pre-check Strutturale (v4) + Filtro Chiusi / Link attivo (v3).
//
// Legge i target da discovered_links (status = 'active_crawler'),
// estrae le righe delle tabelle interpelli e fa upsert su interpelli.
//
// Dipendenze: @supabase/supabase-js, cheerio, dotenv
// Uso: npx tsx scripts/table-reporter.ts

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import * as cheerio from 'cheerio';
import * as dotenv from 'dotenv';
import * as crypto from 'crypto';

dotenv.config();

// ---------------------------------------------------------------------------
// Configurazione
// ---------------------------------------------------------------------------

const CONFIG = {
  userAgent: 'ScuoleRadarBot/1.0 (+https://scuoleradar.it)',
  fetchTimeoutMs: 25_000,
  minSchoolNameLength: 4,
  fallbackProvince: 'EE',
  disqualifiedStatus: 'disabled',
  // Fallback deadline: giorni da oggi quando la colonna scadenza è assente.
  defaultDeadlineDays: 15,
  // Se true, scarta la riga quando non c'è scadenza certa.
  // Se false, usa il fallback +15 giorni.
  discardWhenNoDeadline: false,
} as const;

const supabaseUrl =
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY ||
  '';

if (!supabaseUrl || !supabaseKey) {
  console.error('[table-reporter] Credenziali Supabase mancanti nel file .env');
  process.exit(1);
}

const supabase: SupabaseClient = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// ---------------------------------------------------------------------------
// Codici meccanografici
// ---------------------------------------------------------------------------

const PROVINCE_CODES = new Set<string>([
  'AG','AL','AN','AO','AP','AQ','AR','AT','AV','BA','BG','BI','BL','BN','BO',
  'BR','BS','BT','BZ','CA','CB','CE','CH','CL','CN','CO','CR','CS','CT','CZ',
  'EN','FC','FE','FG','FI','FM','FR','GE','GO','GR','IM','IS','KR','LC','LE',
  'LI','LO','LT','LU','MB','MC','ME','MI','MN','MO','MS','MT','NA','NO','NU',
  'OR','PA','PC','PD','PE','PG','PI','PN','PO','PR','PT','PU','PV','PZ','RA',
  'RC','RE','RG','RI','RM','RN','RO','SA','SI','SO','SP','SR','SS','SU','SV',
  'TA','TE','TN','TO','TP','TR','TS','TV','UD','VA','VB','VC','VE','VI','VR',
  'VT','VV',
]);

// Case-insensitive: cattura anche codici in minuscolo presenti nelle tabelle.
const MECH_CODE_REGEX = /\b([A-Za-z]{2}[A-Za-z0-9]{8})\b/g;

function isLikelyMechCode(code: string): boolean {
  if (code.length !== 10) return false;
  if (!PROVINCE_CODES.has(code.slice(0, 2))) return false;
  if (!/^[A-Z]{2}$/.test(code.slice(2, 4))) return false;
  return true;
}

function extractMechCode(text: string): string {
  if (!text) return 'ND';
  const matches = text.match(MECH_CODE_REGEX) || [];
  for (const raw of matches) {
    const upper = raw.toUpperCase();
    if (isLikelyMechCode(upper)) return upper;
  }
  return 'ND';
}

// ---------------------------------------------------------------------------
// Tipi
// ---------------------------------------------------------------------------

interface DiscoveredLink {
  id: string;
  url: string;
  region: string | null;
  province: string | null;
  status: string;
}

interface InterpelloRecord {
  hash_id: string;
  title: string;
  school_name: string;
  school_code: string;
  province: string;
  region: string | null;
  class_code: string;
  subject: string;
  deadline: string | null;
  source_url: string;
}

interface ProcessResult {
  extracted: number;
  status: 'success' | 'error';
  signature: string | null;
  error?: string;
  disqualified?: boolean;
}

interface ExtractionResult {
  records: InterpelloRecord[];
  disqualified: boolean;
}

interface ColumnMapping {
  codeIdx: number;
  schoolIdx: number;
  deadlineIdx: number;
  publishDateIdx: number;
  stateIdx: number;
  deadlineByText: number;
}

// ---------------------------------------------------------------------------
// Utility
// ---------------------------------------------------------------------------

function normalize(input: string): string {
  return input.replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();
}

function sha256(input: string): string {
  return crypto.createHash('sha256').update(input).digest('hex');
}

function generateHashId(
  province: string,
  schoolCode: string,
  title: string,
  url: string
): string {
  const raw = `${province}|${schoolCode}|${title}|${url}`.toLowerCase();
  return sha256(raw);
}

function getStructuralSignature($: cheerio.CheerioAPI): string {
  const parts: string[] = [];
  $('table').each((tIdx, tableEl) => {
    const $table = $(tableEl);
    const rowCount = $table.find('tr').length;
    const headers = $table
      .find('th')
      .map((_, el) => $(el).text().trim())
      .get()
      .join('|');
    parts.push(`t${tIdx}:r${rowCount}:h[${headers}]`);
  });
  return crypto.createHash('md5').update(parts.join(';')).digest('hex');
}

function resolveUrl(href: string, baseUrl: string): string {
  if (!href) return baseUrl;
  try {
    if (href.startsWith('http://') || href.startsWith('https://')) return href;
    return new URL(href, baseUrl).toString();
  } catch {
    return baseUrl;
  }
}

// ---------------------------------------------------------------------------
// Parsing della scadenza
// ---------------------------------------------------------------------------

function todayIso(): string {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, '0');
  const d = String(now.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

const TODAY_ISO = todayIso();

function addDaysIso(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  const yy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(dt.getUTCDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

const DEFAULT_DEADLINE_ISO = addDaysIso(TODAY_ISO, CONFIG.defaultDeadlineDays);

function parseDeadline(text: string): string | null {
  if (!text) return null;

  // 1) Formato ISO già presente: YYYY-MM-DD
  const isoMatch = text.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
  if (isoMatch) {
    const [, y, m, d] = isoMatch;
    return validateIsoDate(y, m, d);
  }

  // 2) Formato italiano/europeo: DD/MM/YYYY, DD-MM-YYYY, DD.MM.YYYY
  const euMatch = text.match(/\b(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})\b/);
  if (!euMatch) return null;

  const [, d, m, y] = euMatch;
  const day = d.padStart(2, '0');
  const month = m.padStart(2, '0');
  const year = y.length === 2 ? `20${y}` : y;

  return validateIsoDate(year, month, day);
}

function validateIsoDate(
  year: string,
  month: string,
  day: string
): string | null {
  const dayNum = Number(day);
  const monthNum = Number(month);
  const yearNum = Number(year);

  if (dayNum < 1 || dayNum > 31) return null;
  if (monthNum < 1 || monthNum > 12) return null;
  if (yearNum < 2000 || yearNum > 2100) return null;

  return `${year}-${month}-${day}`;
}

function isExpired(deadlineIso: string | null): boolean {
  if (!deadlineIso) return false;
  return deadlineIso < TODAY_ISO;
}

function isFutureOrToday(deadlineIso: string | null): boolean {
  if (!deadlineIso) return false;
  return deadlineIso >= TODAY_ISO;
}

// ---------------------------------------------------------------------------
// Estrazione provincia dall'URL
// ---------------------------------------------------------------------------

// Pattern 1: `ambito_cn`, `ambito-to`, `ric_interpello_ambito_vc`
const URL_AMBITO_REGEX = /ambito[_\-.]?([a-z]{2})(?:[_\-.]|\b)/i;

// Pattern 2: `_to.php`, `_ge.php`, `_sp.php` (suffisso file)
const URL_SUFFIX_REGEX = /[_\-]([a-z]{2})\.php/i;

// Pattern 3: `?p=CN` o `&p=TO` (query string Liguria)
const URL_QUERY_PROV_REGEX = /[?&]p=([A-Za-z]{2})\b/;

// Pattern 4: `provincia.php?p=...`
const URL_LIGURIA_REGEX = /provincia\.php\?p=([A-Za-z]{2})/i;

function extractProvinceFromUrl(url: string): string | null {
  if (!url) return null;

  const candidates: Array<RegExp> = [
    URL_LIGURIA_REGEX,
    URL_QUERY_PROV_REGEX,
    URL_AMBITO_REGEX,
    URL_SUFFIX_REGEX,
  ];

  for (const re of candidates) {
    const m = url.match(re);
    if (m) {
      const prov = m[1].toUpperCase();
      if (PROVINCE_CODES.has(prov)) return prov;
    }
  }

  return null;
}

// ---------------------------------------------------------------------------
// Anti-spam sindacale & rumore (Zero Tolleranza)
// ---------------------------------------------------------------------------

const NOISE_KEYWORDS = [
  'assemblea sindacale',
  'assemblee sindacali',
  'sciopero',
  'scioperi',
  'rappresentanza sindacale',
  'rappresentanze sindacali',
  'r.s.u.',
  'rsu',
  'orario ricevimento',
  'orari di ricevimento',
  'verbale',
  'verbali',
  'delibera',
  'delibere',
  'determina',
  'determine',
  'cig',
];

function rowIsNoise(fullRowTextLower: string): boolean {
  for (const kw of NOISE_KEYWORDS) {
    if (fullRowTextLower.includes(kw)) return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// Filtro di stato generico (interpelli chiusi / scaduti / non attivi)
// ---------------------------------------------------------------------------

const CLOSED_STATE_KEYWORDS = [
  'chiuso',
  'chiusa',
  'chiusi',
  'chiuse',
  'scaduto',
  'scaduta',
  'scaduti',
  'scadute',
  'concluso',
  'conclusa',
  'conclusi',
  'concluse',
  'terminato',
  'terminata',
  'terminati',
  'terminate',
  'non attivo',
  'non attiva',
  'non attivi',
  'non attive',
  'inattivo',
  'inattiva',
  'cancellato',
  'cancellata',
  'cancellati',
  'cancellate',
  'expired',
  'closed',
];

function rowIndicatesClosed(fullRowTextLower: string): boolean {
  for (const kw of CLOSED_STATE_KEYWORDS) {
    if (fullRowTextLower.includes(kw)) return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// FIX v9 — Filtro STATO INTERPELLO per portali Piemonte
// ---------------------------------------------------------------------------
//
// I portali USR Piemonte espongono una colonna "Stato interpello" con valori
// tipici: "aperto", "chiuso", "cancellato". Processiamo ESCLUSIVAMENTE le
// righe con stato "aperto" (case-insensitive, spazi normalizzati).
// Qualsiasi altro valore (incluso vuoto) → riga scartata.
//

const OPEN_STATE_VALUES = ['aperto', 'aperta', 'aperti', 'aperte', 'attivo', 'attiva'];

function isRowOpen(stateText: string): boolean {
  const t = normalize(stateText).toLowerCase();
  if (!t) return false;
  return OPEN_STATE_VALUES.some((v) => t === v || t.includes(v));
}

// ---------------------------------------------------------------------------
// PRE-CHECK STRUTTURALE
// ---------------------------------------------------------------------------

const STRONG_INTERPELLI_MARKERS: RegExp[] = [
  /classi?\s+di\s+concorso/i,
  /cod(?:ice)?\.?\s*mecc(?:anografico)?/i,
  /graduator/i,
  /\bscadenz/i,
  /supplenz/i,
];

const WEAK_INTERPELLI_MARKERS: RegExp[] = [
  /candidatur/i,
  /posti?\s+disponibil/i,
  /tipo\s+posto/i,
  /data\s+pubblicazione/i,
  /codice\s+scuola/i,
  /destinatari/i,
  /requisiti/i,
  /\bclass[ei]\b/i,
  /\bstato\b/i,
];

function pageContainsInterpelliTable($: cheerio.CheerioAPI): boolean {
  const tables = $('table');
  if (tables.length === 0) return false;

  const headersText: string[] = [];
  const bodyChunks: string[] = [];

  tables.each((_, tableEl) => {
    const $table = $(tableEl);
    if ($table.find('tr').length < 2) return;

    $table.find('th, thead td').each((_, el) => {
      headersText.push(normalize($(el).text()));
    });
    bodyChunks.push(normalize($table.text()));
  });

  if (bodyChunks.length === 0) return false;

  const headerScope = headersText.join(' ').toLowerCase();
  const bodyScope = bodyChunks.join(' ').toLowerCase();
  const fullScope = `${headerScope} ${bodyScope}`;

  if (fullScope.trim().length === 0) return false;

  if (/\binterpell/i.test(fullScope)) return true;

  const strongHits = STRONG_INTERPELLI_MARKERS.reduce(
    (n, re) => n + (re.test(fullScope) ? 1 : 0),
    0
  );
  const weakHits = WEAK_INTERPELLI_MARKERS.reduce(
    (n, re) => n + (re.test(fullScope) ? 1 : 0),
    0
  );

  if (strongHits >= 2) return true;
  if (strongHits >= 1 && weakHits >= 2) return true;

  return false;
}

// ---------------------------------------------------------------------------
// Rilevamento colonne
// ---------------------------------------------------------------------------

function getTableHeaders(
  $: cheerio.CheerioAPI,
  tableEl: cheerio.Element
): string[] {
  const $table = $(tableEl);

  const $thead = $table.find('thead').first();
  if ($thead.length > 0) {
    const cells = $thead.find('tr').first().find('th, td');
    if (cells.length > 0) {
      return cells
        .map((_, el) => normalize($(el).text()).toLowerCase())
        .get();
    }
  }

  const $firstRow = $table.find('tr').first();
  if ($firstRow.find('th').length > 0) {
    return $firstRow
      .find('th, td')
      .map((_, el) => normalize($(el).text()).toLowerCase())
      .get();
  }

  return [];
}

function detectColumns(headers: string[]): ColumnMapping {
  const findIdx = (patterns: RegExp[]): number => {
    for (let i = 0; i < headers.length; i += 1) {
      if (patterns.some((re) => re.test(headers[i]))) return i;
    }
    return -1;
  };

  const codeIdx = findIdx([
    /cod(?:ice)?\.?\s*mecc/,
    /codice\s*scuola/,
    /cod\.?\s*scuola/,
    /meccanografico/,
  ]);

  const schoolIdx = findIdx([
    /denominazione/,
    /istituto\s+scolastico/,
    /nome\s+(?:istituto|scuola)/,
    /scuola/,
    /istituto/,
  ]);

  const deadlineIdx = findIdx([
    /data\s*scadenza\s*interpello/,
    /scadenza\s*interpello/,
    /data\s*scadenza/,
    /\bscadenz/,
  ]);

  const publishDateIdx = findIdx([
    /data\s*interpello/,
    /data\s*pubblicazione/,
    /data\s*avviso/,
    /pubblicato\s*il/,
  ]);

  // FIX v9 — Rilevamento colonna "Stato interpello"
  const stateIdx = findIdx([
    /stato\s*interpello/,
    /stato\s*avviso/,
    /\bstato\b/,
  ]);

  return {
    codeIdx: codeIdx >= 0 ? codeIdx : 0,
    schoolIdx: schoolIdx >= 0 ? schoolIdx : 1,
    deadlineIdx,
    publishDateIdx,
    stateIdx,
    deadlineByText: -1,
  };
}

// FIX #1: rilevamento scadenza anche dal TESTO della cella (non solo header).
function detectDeadlineColumnByCellText(colTexts: string[]): number {
  for (let i = 0; i < colTexts.length; i += 1) {
    const cellLower = colTexts[i].toLowerCase();
    if (/scadenz/.test(cellLower)) {
      const d = parseDeadline(colTexts[i]);
      if (d && isFutureOrToday(d)) return i;
    }
  }
  return -1;
}

// ---------------------------------------------------------------------------
// Fetch
// ---------------------------------------------------------------------------

interface FetchResult {
  status: number;
  contentType: string;
  html: string;
}

async function fetchHtml(url: string): Promise<FetchResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), CONFIG.fetchTimeoutMs);

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': CONFIG.userAgent,
        Accept: 'text/html,application/xhtml+xml',
        'Accept-Language': 'it-IT,it;q=0.9,en;q=0.8',
      },
      signal: controller.signal,
      redirect: 'follow',
    });

    const contentType = response.headers.get('content-type') || '';
    const html = await response.text();
    return { status: response.status, contentType, html };
  } finally {
    clearTimeout(timer);
  }
}

// ---------------------------------------------------------------------------
// Estrazione record tabellari
// ---------------------------------------------------------------------------

function extractRecordsFromHtml(
  $: cheerio.CheerioAPI,
  target: DiscoveredLink
): ExtractionResult {
  const records: InterpelloRecord[] = [];

  if (!pageContainsInterpelliTable($)) {
    console.log(
      '[table-reporter] Pagina priva di tabella interpelli riconoscibile — skip.'
    );
    return { records: [], disqualified: true };
  }

  const defaultProvince = (
    target.province || CONFIG.fallbackProvince
  ).toUpperCase();
  const region = target.region;

  const urlProvince = extractProvinceFromUrl(target.url);

  $('table').each((_tableIdx, tableEl) => {
    const $table = $(tableEl);

    const headers = getTableHeaders($, tableEl as cheerio.Element);
    const columns = detectColumns(headers);

    $table.find('tr').each((rowIndex, rowEl) => {
      const $row = $(rowEl);

      if (rowIndex === 0 && $row.find('th').length > 0) return;

      const cols = $row.find('td');
      if (cols.length < 2) return;

      const colTexts: string[] = cols
        .map((_, el) => normalize($(el).text()))
        .get();

      const fullRowText = colTexts.join(' ');
      const fullRowTextLower = fullRowText.toLowerCase();

      // Anti-spam sindacale.
      if (rowIsNoise(fullRowTextLower)) return;

      // -----------------------------------------------------------------
      // FIX v9 — FILTRO STATO INTERPELLO (Piemonte)
      // -----------------------------------------------------------------
      // Se la tabella ha una colonna "Stato interpello" identificata,
      // processa SOLO le righe con stato "aperto".
      // In assenza di colonna stato, applica il filtro generico chiusi.
      if (columns.stateIdx >= 0 && columns.stateIdx < colTexts.length) {
        const stateText = colTexts[columns.stateIdx];
        if (!isRowOpen(stateText)) {
          return;
        }
      } else {
        // Fallback: filtro generico chiusi/scaduti.
        if (rowIndicatesClosed(fullRowTextLower)) {
          return;
        }
      }

      // Link attivo.
      const $link = $row.find('a').first();
      const rawHref = $link.attr('href');
      if (
        !$link.length ||
        !rawHref ||
        rawHref.trim() === '' ||
        rawHref.trim() === '#'
      ) {
        return;
      }

      const linkText = normalize($link.text());
      const href = rawHref;

      // -----------------------------------------------------------------
      // FIX #2 — PROVINCIA: analizza la PRIMISSIMA cella
      // -----------------------------------------------------------------
      const firstCellText = colTexts[0] || '';
      let schoolCode = extractMechCode(firstCellText);

      if (schoolCode === 'ND' && columns.codeIdx !== 0 && columns.codeIdx >= 0) {
        if (columns.codeIdx < colTexts.length) {
          schoolCode = extractMechCode(colTexts[columns.codeIdx]);
        }
      }
      if (schoolCode === 'ND') {
        schoolCode = extractMechCode(fullRowText);
      }

      let province: string;
      if (schoolCode !== 'ND' && isLikelyMechCode(schoolCode)) {
        const derivedProv = schoolCode.slice(0, 2).toUpperCase();
        if (PROVINCE_CODES.has(derivedProv)) {
          province = derivedProv;
        } else if (urlProvince) {
          province = urlProvince;
        } else {
          province = defaultProvince;
        }
      } else if (urlProvince) {
        province = urlProvince;
      } else {
        province = defaultProvince;
      }

      if (province === 'EE' && target.url) {
        const aggressive = extractProvinceFromUrl(target.url);
        if (aggressive) {
          province = aggressive;
        }
      }

      // -----------------------------------------------------------------
      // FIX #3 — NOME SCUOLA PULITO
      // -----------------------------------------------------------------
      let schoolName = '';

      if (columns.schoolIdx >= 0 && columns.schoolIdx < colTexts.length) {
        schoolName = colTexts[columns.schoolIdx];
      }

      if (
        !schoolName ||
        schoolName.length < CONFIG.minSchoolNameLength ||
        schoolName.toLowerCase().includes('non specificata')
      ) {
        const secondCellText = colTexts[1] || '';
        if (
          secondCellText &&
          secondCellText.length >= CONFIG.minSchoolNameLength &&
          !secondCellText.toLowerCase().includes('non specificata')
        ) {
          schoolName = secondCellText;
        }
      }

      if (
        !schoolName ||
        schoolName.length < CONFIG.minSchoolNameLength ||
        schoolName.toLowerCase().includes('non specificata')
      ) {
        if (
          linkText &&
          linkText.length >= CONFIG.minSchoolNameLength &&
          !linkText.toLowerCase().includes('non specificata')
        ) {
          schoolName = linkText;
        }
      }

      if (
        !schoolName ||
        schoolName.length < CONFIG.minSchoolNameLength ||
        schoolName.toLowerCase().includes('non specificata')
      ) {
        if (schoolCode !== 'ND') {
          schoolName = `Istituto ${schoolCode}`;
        }
      }

      if (!schoolName || schoolName.length < CONFIG.minSchoolNameLength) return;
      if (schoolName.toLowerCase().includes('scuola non specificata')) return;
      if (href.includes('artov.rm.cnr.it')) return;

      // -----------------------------------------------------------------
      // FIX v9 + FIX #1 — SCADENZA FORZATA
      // -----------------------------------------------------------------
      // Priorità:
      //   1) Colonna header "scadenza" mappata.
      //   2) Qualsiasi cella con keyword "scadenza" e data futura.
      //   3) Fallback: +15 giorni oppure scarto.
      //   4) MAI la colonna "data pubblicazione".
      let deadline: string | null = null;

      // (1) Header mappato.
      if (columns.deadlineIdx >= 0 && columns.deadlineIdx < colTexts.length) {
        deadline = parseDeadline(colTexts[columns.deadlineIdx]);
      }

      // (2) Ricerca per keyword "scadenza" in qualsiasi cella.
      if (!deadline) {
        const byText = detectDeadlineColumnByCellText(colTexts);
        if (byText >= 0) {
          deadline = parseDeadline(colTexts[byText]);
        }
      }

      // (3) Fallback: +15 giorni oppure scarto.
      if (!deadline) {
        if (CONFIG.discardWhenNoDeadline) {
          return;
        }
        deadline = DEFAULT_DEADLINE_ISO;
      }

      if (isExpired(deadline)) return;

      const { classCode, subject } = extractSubjectAndClass(fullRowText);
      const sourceUrl = resolveUrl(href, target.url);
      const title = `${schoolName} - Interpello Ufficiale`;
      const hashId = generateHashId(province, schoolCode, title, sourceUrl);

      records.push({
        hash_id: hashId,
        title,
        school_name: schoolName,
        school_code: schoolCode,
        province,
        region,
        class_code: classCode,
        subject,
        deadline,
        source_url: sourceUrl,
      });
    });
  });

  return { records, disqualified: false };
}

// ---------------------------------------------------------------------------
// Utility: estrazione materia / classe di concorso
// ---------------------------------------------------------------------------

function extractSubjectAndClass(text: string): {
  classCode: string;
  subject: string;
} {
  const classMatch = text.match(/\b([A-E][0-9]{2}|[A-Z]{2,3}[0-9]{1,2})\b/i);
  const classCode = classMatch ? classMatch[1].toUpperCase() : 'GENERALE';

  let subject = 'Non specificata';
  const t = text.toLowerCase();

  if (t.includes('sostegno')) subject = 'Sostegno';
  else if (t.includes('inglese')) subject = 'Inglese';
  else if (t.includes('matematica')) subject = 'Matematica';
  else if (t.includes('italiano')) subject = 'Italiano';
  else if (t.includes('fisica')) subject = 'Fisica';
  else if (t.includes('chimica')) subject = 'Chimica';
  else if (t.includes('storia')) subject = 'Storia';
  else if (t.includes('filosofia')) subject = 'Filosofia';
  else if (t.includes('latino')) subject = 'Latino';
  else if (t.includes('scienze')) subject = 'Scienze';

  return { classCode, subject };
}

// ---------------------------------------------------------------------------
// Orchestrazione — disattivazione target inutili
// ---------------------------------------------------------------------------

const JUNK_UMBRIA_URL_PATTERNS: RegExp[] = [
  /amministrazione[\-\s_]?trasparente/i,
  /albo[\-\s_]?online/i,
];

async function disableObviousJunkTargets(): Promise<number> {
  const { data, error } = await supabase
    .from('discovered_links')
    .select('id, url, status')
    .eq('region', 'Umbria')
    .eq('status', 'active_crawler');

  if (error) {
    console.error(
      `[table-reporter] Errore query Umbria (cleanup iniziale): ${error.message}`
    );
    return 0;
  }

  const ids = (data ?? [])
    .filter((row) =>
      JUNK_UMBRIA_URL_PATTERNS.some((re) => re.test(String(row.url ?? '')))
    )
    .map((row) => row.id);

  if (ids.length === 0) {
    console.log(
      '[table-reporter] Cleanup iniziale: nessun link Umbria generico da disattivare.'
    );
    return 0;
  }

  const { error: updErr } = await supabase
    .from('discovered_links')
    .update({ status: CONFIG.disqualifiedStatus })
    .in('id', ids);

  if (updErr) {
    console.error(
      `[table-reporter] Errore disattivazione Umbria (cleanup iniziale): ${updErr.message}`
    );
    return 0;
  }

  console.log(
    `[table-reporter] Cleanup iniziale: disattivati ${ids.length} link Umbria generici.`
  );
  return ids.length;
}

async function disqualifyTarget(target: DiscoveredLink): Promise<void> {
  const { error } = await supabase
    .from('discovered_links')
    .update({ status: CONFIG.disqualifiedStatus })
    .eq('id', target.id);

  if (error) {
    console.error(
      `[table-reporter] Errore disattivazione ${target.url}: ${error.message}`
    );
  } else {
    console.log(
      `[table-reporter] Target disattivato (${CONFIG.disqualifiedStatus}) — nessuna tabella interpelli: ${target.url}`
    );
  }
}

// ---------------------------------------------------------------------------
// Orchestrazione — main
// ---------------------------------------------------------------------------

async function loadTargets(): Promise<DiscoveredLink[]> {
  const { data, error } = await supabase
    .from('discovered_links')
    .select('id, url, region, province, status')
    .eq('status', 'active_crawler');

  if (error) {
    throw new Error(`Errore query discovered_links: ${error.message}`);
  }

  return (data ?? []) as DiscoveredLink[];
}

async function processTarget(target: DiscoveredLink): Promise<ProcessResult> {
  try {
    const { status, contentType, html } = await fetchHtml(target.url);

    if (status >= 400) {
      return {
        extracted: 0,
        status: 'error',
        signature: null,
        error: `HTTP ${status}`,
      };
    }

    if (!contentType.includes('text/html') && !contentType.includes('xml')) {
      return {
        extracted: 0,
        status: 'error',
        signature: null,
        error: `Content-Type non HTML: ${contentType}`,
      };
    }

    const $ = cheerio.load(html);
    const signature = getStructuralSignature($);
    const extraction = extractRecordsFromHtml($, target);
    const records = extraction.records;

    if (records.length > 0) {
      const { error: upsertError } = await supabase
        .from('interpelli')
        .upsert(records, {
          onConflict: 'hash_id',
          ignoreDuplicates: true,
        });

      if (upsertError) {
        return {
          extracted: 0,
          status: 'error',
          signature,
          error: `Upsert interpelli: ${upsertError.message}`,
        };
      }
    }

    return {
      extracted: records.length,
      status: 'success',
      signature,
      disqualified: extraction.disqualified,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      extracted: 0,
      status: 'error',
      signature: null,
      error: msg,
    };
  }
}

async function writeReport(
  target: DiscoveredLink,
  result: ProcessResult
): Promise<void> {
  const { error } = await supabase.from('scrape_reports').insert({
    portal_id: target.id,
    extracted_count: result.extracted,
    structural_signature: result.signature,
    status: result.status,
    error_message: result.error ?? null,
  });

  if (error) {
    console.error(
      `[table-reporter] Errore scrittura scrape_reports per ${target.url}: ${error.message}`
    );
  }
}

async function runTableReporter(): Promise<void> {
  console.log('[table-reporter] Avvio scansione tabellare...');

  try {
    await disableObviousJunkTargets();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[table-reporter] Cleanup iniziale fallito: ${msg}`);
  }

  let targets: DiscoveredLink[];
  try {
    targets = await loadTargets();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[table-reporter] ${msg}`);
    process.exit(1);
  }

  if (targets.length === 0) {
    console.warn(
      '[table-reporter] Nessun target con status=active_crawler in discovered_links.'
    );
    return;
  }

  console.log(`[table-reporter] Trovati ${targets.length} target da analizzare.`);

  let totalExtracted = 0;
  let successCount = 0;
  let errorCount = 0;
  let disqualifiedCount = 0;

  for (const target of targets) {
    const label = `${target.region ?? 'N/D'} / ${target.province ?? 'N/D'} — ${target.url}`;
    console.log(`\n[table-reporter] Esamino: ${label}`);

    const result = await processTarget(target);
    await writeReport(target, result);

    if (result.status === 'success') {
      successCount += 1;
      totalExtracted += result.extracted;
      console.log(
        `[table-reporter] Estratti ${result.extracted} record validi da ${target.url}`
      );

      if (result.disqualified) {
        await disqualifyTarget(target);
        disqualifiedCount += 1;
      }
    } else {
      errorCount += 1;
      console.error(`[table-reporter] Errore su ${target.url}: ${result.error}`);
    }
  }

  console.log('\n[table-reporter] Riepilogo:');
  console.log(`  Target elaborati: ${targets.length}`);
  console.log(`  Successi: ${successCount}`);
  console.log(`  Errori: ${errorCount}`);
  console.log(`  Target disattivati (no tabella): ${disqualifiedCount}`);
  console.log(`  Record totali processati: ${totalExtracted}`);

  if (errorCount > 0) {
    process.exitCode = 2;
  }
}

runTableReporter().catch((err) => {
  const msg = err instanceof Error ? err.stack ?? err.message : String(err);
  console.error(`[table-reporter] Errore fatale: ${msg}`);
  process.exit(1);
});