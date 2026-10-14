// scripts/table-reporter.ts
//
// Table Reporter — v4
//   • Pre-check Strutturale: rifiuta pagine senza vera tabella interpelli
//     (Albo Online generico, delibere, determine, mense, gare, regolamenti)
//     restituendo 0 record senza tentare conversioni forzate.
//   • Filtro Rigido Chiusi (case-insensitive, spazi normalizzati).
//   • Provincia Forzata da Codice Meccanografico (addio "EE" fantasma).
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
//
// Obiettivo: scartare in partenza pagine che non contengono una tabella di
// interpelli (Albo Online generico, Amministrazione Trasparente, elenchi di
// delibere, determine, mense, regolamenti, gare, bandi, ...) evitando falsi
// positivi che sporcherebbero la tabella `interpelli` su Supabase.
//
// Strategia a due livelli:
//   1) Match esplicito: presenza della radice "interpell*" nel testo delle
//      tabelle (header o corpo) → pagina accettata immediatamente.
//   2) Punteggio:
//        - marcatori FORTI (tipici della tabella interpelli)
//        - marcatori DEBOLI (contesto generico di avvisi)
//      La pagina è accettata SOLO se:
//        - almeno 2 marcatori forti distinti, OPPURE
//        - almeno 1 forte + 2 deboli.
//
// In tutti gli altri casi la funzione ritorna `false` e il chiamante deve
// restituire `[]` senza tentare alcuna conversione forzata.
//

// Marcatori "forti": se ne trovano 2 la pagina è quasi certamente interpelli.
const STRONG_INTERPELLI_MARKERS: RegExp[] = [
  /classi?\s+di\s+concorso/i,
  /cod(?:ice)?\.?\s*mecc(?:anografico)?/i,
  /graduator/i,
  /\bscadenz/i,
  /supplenz/i,
];

// Marcatori "deboli": da soli non bastano, ma corroborano il contesto.
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
): InterpelloRecord[] {
  const records: InterpelloRecord[] = [];

  // --- PRE-CHECK STRUTTURALE ---
  // Se la pagina non contiene una vera tabella di interpelli (Albo Online,
  // Amministrazione Trasparente, delibere, determine, mense, regolamenti,
  // gare, bandi...), restituiamo `[]` immediatamente, senza tentare
  // conversioni forzate e senza inserire record spazzatura su Supabase.
  if (!pageContainsInterpelliTable($)) {
    console.log(
      '[table-reporter] Pagina priva di tabella interpelli riconoscibile — skip.'
    );
    return [];
  }

  const defaultProvince = (target.province || CONFIG.fallbackProvince).toUpperCase();
  const region = target.region;

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

      // --- FIX v3: FILTRO RIGIDO CHIUSI ---
      // Scarta in modo aggressivo qualsiasi riga che indichi uno stato
      // chiuso / scaduto / non attivo (case-insensitive, spazi normalizzati).
      if (rowIndicatesClosed(fullRowTextLower)) {
        return;
      }

      // --- FIX v3: VERIFICA PRESENZA LINK DI CANDIDATURA ATTIVO ---
      // Se la riga non contiene alcun <a> valido, l'interpello è considerato
      // non più candidabile e viene scartato.
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

      const schoolCode = extractMechCode(fullRowText);

      // --- FIX v3: RISOLUZIONE FORZATA PROVINCIA DA CODICE MECCANOGRAFICO ---
      // Se il codice meccanografico è valido e riconosciuto, la provincia
      // viene derivata OBBLIGATORIAMENTE dalle prime 2 lettere (es. AT, BI, VB).
      // Il fallback (target.province / 'EE') viene usato SOLO se il codice
      // non è disponibile o non è riconosciuto.
      let province: string;
      if (schoolCode !== 'ND' && isLikelyMechCode(schoolCode)) {
        const derivedProv = schoolCode.slice(0, 2).toUpperCase();
        if (PROVINCE_CODES.has(derivedProv)) {
          province = derivedProv;
        } else {
          province = defaultProvince;
        }
      } else {
        province = defaultProvince;
      }

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