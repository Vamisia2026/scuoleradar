// scripts/table-reporter.ts
//
// Table Reporter — v2
// Legge i target da discovered_links (status = 'active_crawler'),
// estrae le righe delle tabelle interpelli e fa upsert su interpelli.
//
// Dipendenze: @supabase/supabase-js, cheerio, dotenv
// Uso: npx tsx scripts/table-reporter.ts
//
// Nota schema: il record scritto in `interpelli` include il campo `region`.
// Se la colonna non esiste ancora, va aggiunta con una migrazione.

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

// Senza flag /i: i codici meccanografici sono sempre maiuscoli.
const MECH_CODE_REGEX = /\b([A-Z]{2}[A-Z0-9]{8})\b/g;

function isLikelyMechCode(code: string): boolean {
  if (code.length !== 10) return false;
  if (!PROVINCE_CODES.has(code.slice(0, 2))) return false;
  if (!/^[A-Z]{2}$/.test(code.slice(2, 4))) return false;
  return true;
}

function extractMechCode(text: string): string {
  const matches = text.match(MECH_CODE_REGEX) || [];
  for (const raw of matches) {
    if (isLikelyMechCode(raw)) return raw;
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

function parseDeadline(text: string): string | null {
  const match = text.match(/\b(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})\b/);
  if (!match) return null;

  const [, d, m, y] = match;
  const day = d.padStart(2, '0');
  const month = m.padStart(2, '0');
  const year = y.length === 2 ? `20${y}` : y;

  const dayNum = Number(day);
  const monthNum = Number(month);
  const yearNum = Number(year);

  if (dayNum < 1 || dayNum > 31) return null;
  if (monthNum < 1 || monthNum > 12) return null;
  if (yearNum < 2000 || yearNum > 2100) return null;

  return `${year}-${month}-${day}`;
}

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
): InterpelloRecord[] {
  const records: InterpelloRecord[] = [];
  const province = (target.province || CONFIG.fallbackProvince).toUpperCase();
  const region = target.region;

  $('table').each((_tableIdx, tableEl) => {
    const $table = $(tableEl);

    $table.find('tr').each((rowIndex, rowEl) => {
      const $row = $(rowEl);

      // Salta l'header quando riconoscibile.
      if (rowIndex === 0 && $row.find('th').length > 0) return;

      const cols = $row.find('td');
      if (cols.length < 2) return;

      const $link = $row.find('a').first();
      const linkText = normalize($link.text());
      const href = $link.attr('href') || target.url;
      const secondCellText = normalize($(cols[1]).text());
      const schoolName = linkText || secondCellText;

      if (schoolName.length < CONFIG.minSchoolNameLength) return;
      if (schoolName.toLowerCase().includes('scuola non specificata')) return;
      if (href.includes('artov.rm.cnr.it')) return;

      const colTexts = cols
        .map((_, el) => normalize($(el).text()))
        .get();
      const fullRowText = colTexts.join(' ');

      const schoolCode = extractMechCode(fullRowText);
      const { classCode, subject } = extractSubjectAndClass(fullRowText);
      const deadline = parseDeadline(fullRowText);
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

  return records;
}

// ---------------------------------------------------------------------------
// Orchestrazione
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
    const records = extractRecordsFromHtml($, target);

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
    } else {
      errorCount += 1;
      console.error(`[table-reporter] Errore su ${target.url}: ${result.error}`);
    }
  }

  console.log('\n[table-reporter] Riepilogo:');
  console.log(`  Target elaborati: ${targets.length}`);
  console.log(`  Successi: ${successCount}`);
  console.log(`  Errori: ${errorCount}`);
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