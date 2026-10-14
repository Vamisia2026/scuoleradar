// scripts/table-reporter.ts
//
// Table Reporter — v6
//   • Auto-disattivazione target inutili: se una pagina viene scartata dal
//     pre-check `pageContainsInterpelliTable($)` (Albo Online, Amministrazione
//     Trasparente, sezioni burocratiche), il target corrispondente in
//     `discovered_links` viene impostato a `status = 'disabled'` per non
//     sprecare richieste HTTP ai run successivi.
//   • Cleanup iniziale: disattiva i link Umbria con URL contenenti pattern
//     `amministrazione-trasparente` / `albo-online`.
//   • Anti-spam Sindacale & Rumore — Zero Tolleranza.
//   • Mappatura rigida provincia da codice meccanografico o da URL `ambito_XX`.
//   • Scadenza reale: parsing YYYY-MM-DD; righe scadute SCARTATE.
//   • Pre-check Strutturale: rifiuta pagine senza vera tabella interpelli.
//   • Filtro rigido chiusi + link attivo (fix v3 preservati).
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
  // Stato impostato sui target quando la pagina non contiene una vera
  // tabella di interpelli. Vengono esclusi dai run successivi.
  disqualifiedStatus: 'disabled',
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
  // True se la pagina è stata scartata perché priva di una vera tabella
  // di interpelli → il target va disattivato in discovered_links.
  disqualified?: boolean;
}

interface ExtractionResult {
  records: InterpelloRecord[];
  disqualified: boolean;
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

function parseDeadline(text: string): string | null {
  // 1) Formato ISO già presente: YYYY-MM-DD
  const isoMatch = text.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
  if (isoMatch) {
    const [, y, m, d] = isoMatch;
    return validateIsoDate(y, m, d);
  }

  // 2) Formato italiano/europeo: DD/MM/YYYY, DD-MM-YYYY, DD.MM.YYYY (anche 2 cifre)
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

// ---------------------------------------------------------------------------
// Estrazione provincia dall'URL (per i portali USR che usano `ambito_XX`)
// ---------------------------------------------------------------------------

const URL_AMBITO_REGEX = /ambito[_\-.]?([a-z]{2})(?:[_\-.]|\b)/i;

function extractProvinceFromUrl(url: string): string | null {
  if (!url) return null;
  const m = url.match(URL_AMBITO_REGEX);
  if (!m) return null;
  const prov = m[1].toUpperCase();
  if (PROVINCE_CODES.has(prov)) return prov;
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
// Filtro di stato (interpelli chiusi / scaduti / non attivi) — FIX v3
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
// PRE-CHECK STRUTTURALE — la pagina contiene una VERA tabella di interpelli?
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

    // Dev'essere una tabella "reale": almeno 2 righe.
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

  // (1) Match esplicito "interpell*" → pagina di interpelli.
  if (/\binterpell/i.test(fullScope)) return true;

  // (2) Conteggio marcatori forti / deboli.
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

  // --- PRE-CHECK STRUTTURALE ---
  // Se la pagina non contiene una vera tabella di interpelli, segnaliamo
  // il target come `disqualified` così il chiamante può disattivarlo.
  if (!pageContainsInterpelliTable($)) {
    console.log(
      '[table-reporter] Pagina priva di tabella interpelli riconoscibile — skip.'
    );
    return { records: [], disqualified: true };
  }

  const defaultProvince = (target.province || CONFIG.fallbackProvince).toUpperCase();
  const region = target.region;

  // Provincia derivabile dall'URL del target (es. portali USR con `ambito_XX`).
  const urlProvince = extractProvinceFromUrl(target.url);

  $('table').each((_tableIdx, tableEl) => {
    const $table = $(tableEl);

    $table.find('tr').each((rowIndex, rowEl) => {
      const $row = $(rowEl);

      // Salta l'header quando riconoscibile.
      if (rowIndex === 0 && $row.find('th').length > 0) return;

      const cols = $row.find('td');
      if (cols.length < 2) return;

      // Estrai il testo normalizzato di tutte le colonne.
      const colTexts = cols
        .map((_, el) => normalize($(el).text()))
        .get();
      const fullRowText = colTexts.join(' ');
      const fullRowTextLower = fullRowText.toLowerCase();

      // --- FIX v5 #1: ANTI-SPAM SINDACALE & RUMORE (Zero Tolleranza) ---
      if (rowIsNoise(fullRowTextLower)) {
        return;
      }

      // --- FIX v3: FILTRO RIGIDO CHIUSI ---
      if (rowIndicatesClosed(fullRowTextLower)) {
        return;
      }

      // --- FIX v3: LINK DI CANDIDATURA ATTIVO ---
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
      const secondCellText = normalize($(cols[1]).text());
      const schoolName = linkText || secondCellText;

      if (schoolName.length < CONFIG.minSchoolNameLength) return;
      if (schoolName.toLowerCase().includes('scuola non specificata')) return;
      if (href.includes('artov.rm.cnr.it')) return;

      // --- FIX v5 #3: SCADENZA REALE + SCARTO SE SCADUTA ---
      const deadline = parseDeadline(fullRowText);
      if (isExpired(deadline)) {
        return;
      }

      const schoolCode = extractMechCode(fullRowText);

      // --- FIX v5 #2: MAPPATURA RIGIDA PROVINCIA ---
      // Priorità:
      //   1) sigla derivata dal codice meccanografico (NO/BI/VC/CN/AT/...)
      //   2) sigla estratta dall'URL del target (pattern `ambito_XX`)
      //   3) fallback target.province / 'EE'
      let province: string;
      if (schoolCode !== 'ND' && isLikelyMechCode(schoolCode)) {
        const derivedProv = schoolCode.slice(0, 2).toUpperCase();
        if (PROVINCE_CODES.has(derivedProv)) {
          province = derivedProv;
        } else {
          province = urlProvince ?? defaultProvince;
        }
      } else if (urlProvince) {
        province = urlProvince;
      } else {
        province = defaultProvince;
      }

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
// Orchestrazione — disattivazione target inutili
// ---------------------------------------------------------------------------

// Pattern URL usati per il cleanup iniziale (link Umbria evidentemente
// burocratici che non contengono mai tabelle di interpelli).
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

// Disattiva un singolo target dopo che il pre-check strutturale ha rilevato
// l'assenza di una vera tabella interpelli.
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

  // STEP 0 — cleanup iniziale: disattiva i link Umbria genericamente
  // burocratici prima di sprecare richieste HTTP.
  try {
    await disableObviousJunkTargets();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[table-reporter] Cleanup iniziale fallito: ${msg}`);
    // Non blocchiamo il run: proseguiamo comunque.
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

      // Auto-disattivazione del target se privo di tabella interpelli.
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