// adapters/argoAdapter.js
//
// ScuoleRadar — Argo Albo Pretorio adapter.
//
// Verified against the public SPA bundle (AttiService-CjtTOtLP.js):
//   POST /public/atti/filters/{customerCode}          → paginated list
//   GET  /public/atti/online/{id}                     → detail
//   GET  /public/atti/allegati/{attachmentId}         → binary PDF
//   GET  /public/atti/rss/{customerCode}              → RSS fallback
//   GET  /public/tipologie/online?customerCode=...    → tipologie
//   GET  /public/categorie/online?customerCode=...    → categorie
//
// Base URL: https://www.portaleargo.it/albopretorio/services
//
// Usage:
//   node adapters/argoAdapter.js --source-id=<uuid>
//   node adapters/argoAdapter.js --school-code=CTIC8XXXXX
//
// Environment:
//   SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY
//   ARGO_BASE_URL (optional, default https://www.portaleargo.it/albopretorio/services)

import { createClient } from '@supabase/supabase-js';
import axios from 'axios';
import crypto from 'node:crypto';

// ---------------------------------------------------------------------------
// CONFIG
// ---------------------------------------------------------------------------

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error(
    'Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables.'
  );
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const ARGO_BASE_URL =
  process.env.ARGO_BASE_URL ||
  'https://www.portaleargo.it/albopretorio/services';

const HTTP_TIMEOUT_MS = 15_000;
const MAX_PAGES = 20;
const PAGE_SIZE = 50;
const PAGE_DELAY_MS = 400;
const USER_AGENT = 'ScuoleRadarArgoAdapter/1.0 (+https://scuoleradar.it)';

// ---------------------------------------------------------------------------
// KEYWORD ENGINE (Level A / Level B)
// ---------------------------------------------------------------------------

const LEVEL_A_KEYWORDS = [
  'INTERPELLO',
  'SUPPLENZA',
  'POSTO VACANTE',
  'DISPONIBILITA',
  'DISPONIBILITÀ',
  'SOSTEGNO',
  'ADSS',
  'ADMM',
  'ADEE',
  'AD0D',
];

const LEVEL_B_KEYWORDS = [
  'AVVISO',
  'ATA',
  'ASSISTENTE',
  'COLLABORATORE',
  'PNRR',
  'PON',
  'ESPERTO',
  'TUTOR',
];

const COMPETITION_CLASS_PATTERN =
  /\b(AD[A-Z0-9]{2}|A[0-9]{2}|B[0-9]{2}|C[0-9]{2}|[A-Z]{2}[0-9]{2})\b/g;

/**
 * Returns { level: 'A'|'B'|null, matches: string[] }.
 * Level A wins if any Level A keyword is present.
 */
function matchKeywords(text) {
  if (!text) return { level: null, matches: [] };
  const upper = text.toUpperCase();
  const matches = [];

  for (const kw of LEVEL_A_KEYWORDS) {
    if (upper.includes(kw)) matches.push(kw);
  }
  if (matches.length > 0) return { level: 'A', matches };

  for (const kw of LEVEL_B_KEYWORDS) {
    if (upper.includes(kw)) matches.push(kw);
  }
  if (matches.length > 0) return { level: 'B', matches };

  return { level: null, matches: [] };
}

// ---------------------------------------------------------------------------
// CATEGORY & CLASS MAPPING
// ---------------------------------------------------------------------------

function categorize(text) {
  const upper = (text || '').toUpperCase();

  if (upper.includes('SOSTEGNO') || upper.includes('ADSS') || upper.includes('ADMM') || upper.includes('ADEE')) {
    return 'SUPPLENZA_SOSTEGNO';
  }
  if (upper.includes('SUPPLENZA') || upper.includes('INTERPELLO') || upper.includes('POSTO VACANTE')) {
    if (upper.includes('ATA') || upper.includes('ASSISTENTE') || upper.includes('COLLABORATORE')) {
      return 'SUPPLENZA_ATA';
    }
    return 'SUPPLENZA_DOCENTE';
  }
  if (upper.includes('PNRR') || upper.includes('PON')) return 'PNRR';
  if (upper.includes('ESPERTO') || upper.includes('TUTOR')) return 'ESPERTO_TUTOR';
  return 'ALTRO';
}

function extractCompetitionClasses(text) {
  if (!text) return [];
  const found = new Set();
  const upper = text.toUpperCase();
  let match;
  while ((match = COMPETITION_CLASS_PATTERN.exec(upper)) !== null) {
    found.add(match[1]);
  }
  return [...found];
}

// ---------------------------------------------------------------------------
// DOCUMENT HASH
// ---------------------------------------------------------------------------

/**
 * Deterministic dedup key.
 * - When the provider notice id is available, use school_id + provider_notice_id.
 * - Otherwise fall back to school_id + normalised title + protocol.
 * This survives re-publications with new deadlines because the notice id
 * (or title/protocol) is stable for the same act.
 */
function buildDocumentHash(schoolId, noticeId, title, protocol) {
  const seed = noticeId
    ? `${schoolId}::${noticeId}`
    : `${schoolId}::${(title || '').trim().toUpperCase()}::${(protocol || '').trim().toUpperCase()}`;

  return crypto.createHash('sha256').update(seed).digest('hex');
}

// ---------------------------------------------------------------------------
// HTTP HELPERS
// ---------------------------------------------------------------------------

function argoClient() {
  return axios.create({
    baseURL: ARGO_BASE_URL,
    timeout: HTTP_TIMEOUT_MS,
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'application/json, text/plain, */*',
    },
  });
}

const client = argoClient();

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ---------------------------------------------------------------------------
// FETCH: LIST (filters endpoint)
// ---------------------------------------------------------------------------

function emptyFilterObject() {
  return {
    dataPubblicazioneDal: null,
    dataPubblicazioneAl: null,
    dataArchiviazioneDal: null,
    dataArchiviazioneAl: null,
    descrizione: null,
    tipologiaAtto: null,
    categoria: null,
    annoInserimento: null,
    numeroRegistro: null,
    annoProtocollo: null,
    numeroProtocollo: null,
  };
}

async function fetchAttiPage(customerCode, page, size = PAGE_SIZE) {
  const payload = {
    object: emptyFilterObject(),
    page,
    size,
    sortBy: 'numRegistroAnno',
    sortDesc: true,
  };

  const { data } = await client.post(
    `/public/atti/filters/${encodeURIComponent(customerCode)}`,
    payload
  );

  return data;
}

/**
 * Fetch all pages for a customerCode.
 * Returns an array of raw atti records.
 */
async function fetchAllAtti(customerCode) {
  const all = [];
  let page = 0;

  while (page < MAX_PAGES) {
    const data = await fetchAttiPage(customerCode, page);
    const list = data?.list ?? [];
    all.push(...list);

    const totalRows = data?.totalRows ?? 0;
    const fetched = (page + 1) * PAGE_SIZE;

    if (list.length === 0) break;
    if (totalRows > 0 && fetched >= totalRows) break;
    if (list.length < PAGE_SIZE) break;

    page += 1;
    await sleep(PAGE_DELAY_MS);
  }

  return all;
}

// ---------------------------------------------------------------------------
// FETCH: RSS FALLBACK
// ---------------------------------------------------------------------------

async function fetchRssItems(customerCode) {
  try {
    const { data } = await client.get(
      `/public/atti/rss/${encodeURIComponent(customerCode)}`,
      { responseType: 'text' }
    );

    // Minimal RSS parsing: extract <item> blocks and their fields.
    const items = [];
    const itemRegex = /<item>([\s\S]*?)<\/item>/gi;
    let m;
    while ((m = itemRegex.exec(data)) !== null) {
      const block = m[1];
      const pick = (tag) => {
        const r = new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`, 'i');
        const mm = block.match(r);
        return mm ? mm[1].replace(/<!\[CDATA\[|\]\]>/g, '').trim() : null;
      };

      items.push({
        title: pick('title'),
        link: pick('link'),
        description: pick('description'),
        pubDate: pick('pubDate'),
        guid: pick('guid'),
      });
    }
    return items;
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// FETCH: DETAIL & ATTACHMENTS
// ---------------------------------------------------------------------------

async function fetchAttoDetail(attoId) {
  try {
    const { data } = await client.get(`/public/atti/online/${attoId}`);
    return data;
  } catch {
    return null;
  }
}

/**
 * Resolve the original PDF URL for an attachment id.
 * The endpoint returns the binary; the public URL itself is the original.
 */
function buildAttachmentUrl(attachmentId) {
  return `${ARGO_BASE_URL}/public/atti/allegati/${encodeURIComponent(attachmentId)}`;
}

function extractAttachmentIds(detail) {
  if (!detail) return [];
  const candidates = [];
  // The detail payload exposes attachments under various keys depending on version.
  for (const key of ['allegati', 'attachments', 'documenti']) {
    const arr = detail[key];
    if (Array.isArray(arr)) {
      for (const a of arr) {
        if (a?.id) candidates.push(a.id);
      }
    }
  }
  return [...new Set(candidates)];
}

// ---------------------------------------------------------------------------
// NOTICE NORMALISATION
// ---------------------------------------------------------------------------

/**
 * Map a raw Argo atto + optional detail into a radar_notices row.
 */
function buildNoticeRow({ source, raw, detail, customerCode }) {
  const schoolId = source.school_id;
  const providerNoticeId =
    raw.id ?? raw.idAtto ?? raw.numeroRegistro ?? raw.protocolo ?? null;

  const title =
    raw.descrizione || raw.oggetto || raw.titolo || detail?.descrizione || '';
  const description =
    detail?.testo || raw.descrizione || raw.oggetto || '';
  const protocol = raw.numeroProtocollo
    ? `${raw.annoProtocollo ?? ''}/${raw.numeroProtocollo}`
    : null;

  const textForMatch = [title, description, protocol].filter(Boolean).join(' ');
  const { level, matches } = matchKeywords(textForMatch);

  const category = categorize(textForMatch);
  const classes = extractCompetitionClasses(textForMatch);

  // Deadline extraction: the list payload usually carries dataPubblicazioneAl
  // or dataScadenza; the detail payload may carry more.
  const deadline =
    raw.dataScadenza ||
    raw.dataPubblicazioneAl ||
    detail?.dataScadenza ||
    detail?.dataPubblicazioneAl ||
    null;

  const publishedAt =
    raw.dataPubblicazioneDal ||
    raw.dataPubblicazione ||
    detail?.dataPubblicazioneDal ||
    null;

  // Resolve original PDF URL: prefer detail attachments, then raw attachment id.
  let originalDocumentUrl = null;
  const detailAttachments = extractAttachmentIds(detail);
  if (detailAttachments.length > 0) {
    originalDocumentUrl = buildAttachmentUrl(detailAttachments[0]);
  } else if (raw.idAllegato) {
    originalDocumentUrl = buildAttachmentUrl(raw.idAllegato);
  } else if (raw.linkAllegato) {
    originalDocumentUrl = raw.linkAllegato;
  }

  const documentHash = buildDocumentHash(
    schoolId,
    providerNoticeId,
    title,
    protocol
  );

  return {
    school_id: schoolId,
    source_id: source.id,
    provider: 'ARGO',
    provider_notice_id: providerNoticeId ? String(providerNoticeId) : null,
    document_hash: documentHash,
    title: title || null,
    description: description || null,
    category,
    competition_classes: classes,
    deadline: deadline ? new Date(deadline).toISOString().slice(0, 10) : null,
    published_at: publishedAt
      ? new Date(publishedAt).toISOString()
      : null,
    original_document_url: originalDocumentUrl,
    match_level: level,
    matched_keywords: matches,
    raw_payload: raw,
    is_active: true,
  };
}

// ---------------------------------------------------------------------------
// SUPABASE: NOTICES UPSERT
// ---------------------------------------------------------------------------

async function upsertNotice(row) {
  const { error } = await supabase
    .from('radar_notices')
    .upsert(row, {
      onConflict: 'document_hash',
      ignoreDuplicates: false,
    });

  if (error) {
    throw new Error(`radar_notices upsert failed: ${error.message}`);
  }
}

// ---------------------------------------------------------------------------
// SUPABASE: SOURCE STATUS
// ---------------------------------------------------------------------------

async function updateSourceStatus(sourceId, status, errorMessage = null) {
  const now = new Date().toISOString();

  const payload = {
    status,
    last_checked_at: now,
  };

  if (status === 'OK') {
    payload.last_success_at = now;
    payload.failure_count = 0;
    payload.last_error = null;
  } else if (status === 'ERROR') {
    // Increment failure_count atomically using an RPC would be ideal;
    // fallback: read + write (acceptable for low-volume adapters).
    const { data } = await supabase
      .from('radar_school_sources')
      .select('failure_count')
      .eq('id', sourceId)
      .maybeSingle();

    payload.failure_count = (data?.failure_count ?? 0) + 1;
    payload.last_error = errorMessage;
  } else if (status === 'EMPTY') {
    payload.last_success_at = now;
    payload.failure_count = 0;
    payload.last_error = null;
  }

  const { error } = await supabase
    .from('radar_school_sources')
    .update(payload)
    .eq('id', sourceId);

  if (error) {
    console.warn(
      `[argo] source status update failed for ${sourceId}: ${error.message}`
    );
  }
}

// ---------------------------------------------------------------------------
// MAIN ADAPTER (single source)
// ---------------------------------------------------------------------------

/**
 * Process one radar_school_sources row for Argo.
 *
 * @param {object} source  Row from radar_school_sources.
 *   Expected: { id, school_id, provider, source_url, metadata }
 *   customer_code is read from metadata.customer_code or parsed from source_url.
 * @returns {Promise<{ status, notices, matched, error? }>}
 */
export async function runArgoAdapter(source) {
  const customerCode =
    source.metadata?.customer_code ||
    source.customer_code ||
    extractCustomerCodeFromUrl(source.source_url);

  if (!customerCode) {
    const msg = 'Missing customer_code in source metadata or URL';
    await updateSourceStatus(source.id, 'ERROR', msg);
    return { status: 'ERROR', notices: 0, matched: 0, error: msg };
  }

  console.log(
    `[argo] Processing source ${source.id} (school ${source.school_id}, customerCode=${customerCode})`
  );

  try {
    // 1. Try the RSS feed first — it is lightweight and often complete.
    const rssItems = await fetchRssItems(customerCode);

    // 2. Fetch the paginated list as the authoritative source.
    const rawAtti = await fetchAllAtti(customerCode);

    if (rawAtti.length === 0 && rssItems.length === 0) {
      await updateSourceStatus(source.id, 'EMPTY');
      console.log(`[argo] No atti found for ${customerCode}.`);
      return { status: 'EMPTY', notices: 0, matched: 0 };
    }

    let written = 0;
    let matched = 0;

    // Process raw atti (richer than RSS).
    for (const raw of rawAtti) {
      const textForMatch = [
        raw.descrizione,
        raw.oggetto,
        raw.titolo,
        raw.numeroProtocollo,
      ]
        .filter(Boolean)
        .join(' ');

      const { level } = matchKeywords(textForMatch);
      if (!level) continue; // Skip non-employment notices early.

      matched += 1;

      // Fetch detail only for matched notices.
      const attoId = raw.id ?? raw.idAtto;
      const detail = attoId ? await fetchAttoDetail(attoId) : null;

      const row = buildNoticeRow({
        source,
        raw,
        detail,
        customerCode,
      });

      await upsertNotice(row);
      written += 1;
    }

    // If no raw atti but RSS items exist, fall back to RSS-only ingestion.
    if (rawAtti.length === 0 && rssItems.length > 0) {
      for (const item of rssItems) {
        const { level } = matchKeywords(
          `${item.title || ''} ${item.description || ''}`
        );
        if (!level) continue;

        matched += 1;

        const row = buildNoticeRow({
          source,
          raw: {
            descrizione: item.title,
            oggetto: item.description,
            id: item.guid,
          },
          detail: null,
          customerCode,
        });

        await upsertNotice(row);
        written += 1;
      }
    }

    await updateSourceStatus(source.id, 'OK');
    console.log(
      `[argo] Source ${source.id}: ${written} notices written (${matched} matched).`
    );

    return { status: 'OK', notices: written, matched };
  } catch (err) {
    const msg = err.message || String(err);
    console.error(`[argo] Source ${source.id} failed: ${msg}`);
    await updateSourceStatus(source.id, 'ERROR', msg);
    return { status: 'ERROR', notices: 0, matched: 0, error: msg };
  }
}

// ---------------------------------------------------------------------------
// HELPERS
// ---------------------------------------------------------------------------

function extractCustomerCodeFromUrl(url) {
  if (!url) return null;
  const m = String(url).match(/customerCode=([A-Za-z0-9]+)/i);
  return m ? m[1].toUpperCase() : null;
}

// ---------------------------------------------------------------------------
// BATCH RUNNER
// ---------------------------------------------------------------------------

/**
 * Load Argo sources that are unchecked or stale and process them.
 *
 * @param {number} batchSize
 * @param {number} [concurrency=3]
 */
export async function runArgoBatch(batchSize = 20, concurrency = 3) {
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const { data: sources, error } = await supabase
    .from('radar_school_sources')
    .select('*')
    .eq('provider', 'ARGO')
    .or(`last_checked_at.is.null,last_checked_at.lt.${cutoff}`)
    .order('last_checked_at', { ascending: true, nullsFirst: true })
    .limit(batchSize);

  if (error) {
    throw new Error(`Failed to load Argo sources: ${error.message}`);
  }

  if (!sources || sources.length === 0) {
    console.log('[argo] No sources to process.');
    return { processed: 0, ok: 0, empty: 0, errors: 0 };
  }

  console.log(`[argo] Processing ${sources.length} sources (concurrency=${concurrency})...`);

  const summary = { processed: 0, ok: 0, empty: 0, errors: 0 };
  const queue = [...sources];

  async function worker() {
    while (queue.length > 0) {
      const source = queue.shift();
      const result = await runArgoAdapter(source);
      summary.processed += 1;
      if (result.status === 'OK') summary.ok += 1;
      else if (result.status === 'EMPTY') summary.empty += 1;
      else summary.errors += 1;
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, sources.length) }, () => worker())
  );

  console.log('\n[argo] Batch summary:', summary);
  return summary;
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

async function main() {
  const args = process.argv.slice(2);
  const getArg = (name) => {
    const prefix = `--${name}=`;
    const found = args.find((a) => a.startsWith(prefix));
    return found ? found.slice(prefix.length) : null;
  };

  const sourceId = getArg('source-id');
  const schoolCode = getArg('school-code');
  const batch = Number.parseInt(getArg('batch') || '', 10);

  if (sourceId) {
    const { data, error } = await supabase
      .from('radar_school_sources')
      .select('*')
      .eq('id', sourceId)
      .maybeSingle();

    if (error || !data) {
      console.error(`Source ${sourceId} not found:`, error?.message);
      process.exit(1);
    }
    const result = await runArgoAdapter(data);
    process.exit(result.status === 'ERROR' ? 1 : 0);
  }

  if (schoolCode) {
    const { data, error } = await supabase
      .from('radar_school_sources')
      .select('*')
      .eq('school_id', schoolCode)
      .eq('provider', 'ARGO')
      .maybeSingle();

    if (error || !data) {
      console.error(`Argo source for school ${schoolCode} not found:`, error?.message);
      process.exit(1);
    }
    const result = await runArgoAdapter(data);
    process.exit(result.status === 'ERROR' ? 1 : 0);
  }

  if (!Number.isNaN(batch) && batch > 0) {
    const summary = await runArgoBatch(batch);
    process.exit(summary.errors > 0 ? 1 : 0);
  }

  console.log(`
Usage:
  node adapters/argoAdapter.js --source-id=<uuid>
  node adapters/argoAdapter.js --school-code=<codice>
  node adapters/argoAdapter.js --batch=20

Environment:
  SUPABASE_URL
  SUPABASE_SERVICE_ROLE_KEY
  ARGO_BASE_URL (optional)
`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error(err.stack || err.message || err);
    process.exit(1);
  });
}