// services/discoveryEngine.js
//
// ScuoleRadar — Multi-provider discovery engine.
//
// For each radar_school with a website, fetch the homepage (5s timeout,
// max 3 redirects), detect the administrative provider (ARGO / SPAGGIARI /
// NUVOLA / WEB_GENERIC), build the canonical public Albo/Interpelli URL,
// and upsert into radar_school_sources on (school_id, provider, source_url).
//
// Usage:
//   node services/discoveryEngine.js               # default batch 100
//   node services/discoveryEngine.js --batch=50
//
// Environment:
//   SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY

import { createClient } from '@supabase/supabase-js';
import axios from 'axios';
import { fileURLToPath } from 'node:url';

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

const DISCOVERY_TIMEOUT_MS = 5_000;
const MAX_REDIRECTS = 3;
const MAX_CONTENT_BYTES = 5 * 1024 * 1024;
const DEFAULT_CONCURRENCY = 5;
const STALE_DAYS = 30;
const USER_AGENT = 'ScuoleRadarDiscovery/1.0 (+https://scuoleradar.it)';

// ---------------------------------------------------------------------------
// UTILITIES
// ---------------------------------------------------------------------------

/** Normalise a website URL: add https:// if missing, trim, return null if empty. */
function normalizeUrl(raw) {
  if (!raw) return null;
  const trimmed = String(raw).trim();
  if (!trimmed || /^assente$/i.test(trimmed)) return null;
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

/** Simple promise concurrency limiter (no external dependency). */
function createLimiter(max) {
  let active = 0;
  const queue = [];
  const next = () => {
    if (active >= max || queue.length === 0) return;
    active += 1;
    const { fn, resolve, reject } = queue.shift();
    Promise.resolve()
      .then(fn)
      .then(resolve, reject)
      .finally(() => {
        active -= 1;
        next();
      });
  };
  return (fn) =>
    new Promise((resolve, reject) => {
      queue.push({ fn, resolve, reject });
      next();
    });
}

/** True if `needle` appears in the final URL or anywhere in the HTML body. */
function hasDomain(finalUrl, html, needle) {
  return (
    (finalUrl && finalUrl.toLowerCase().includes(needle)) ||
    (html && html.toLowerCase().includes(needle))
  );
}

/** Extract Argo customerCode from URL or HTML. Returns null if not found. */
function extractCustomerCode(finalUrl, html) {
  const haystack = `${finalUrl}\n${html}`;
  const match = haystack.match(/customerCode=([A-Za-z0-9]+)/i);
  return match ? match[1].toUpperCase() : null;
}

// ---------------------------------------------------------------------------
// PROVIDER DETECTION
// ---------------------------------------------------------------------------

/**
 * Detect all providers present in the final URL / HTML.
 * Returns an array of { provider, customerCode? }.
 * Never returns an empty array — falls back to WEB_GENERIC.
 */
function detectProviders(finalUrl, html) {
  const detected = [];

  if (hasDomain(finalUrl, html, 'nuvola.madisoft.it')) {
    detected.push({ provider: 'NUVOLA' });
  }

  if (
    hasDomain(finalUrl, html, 'spaggiari.eu') ||
    hasDomain(finalUrl, html, 'alboweb')
  ) {
    detected.push({ provider: 'SPAGGIARI' });
  }

  if (hasDomain(finalUrl, html, 'portaleargo.it')) {
    detected.push({
      provider: 'ARGO',
      customerCode: extractCustomerCode(finalUrl, html),
    });
  }

  if (detected.length === 0) {
    detected.push({ provider: 'WEB_GENERIC' });
  }

  return detected;
}

// ---------------------------------------------------------------------------
// SOURCE URL BUILDER
// ---------------------------------------------------------------------------

/**
 * Build the canonical public source URL for a detected provider.
 * Returns null if it cannot be built (caller then falls back to finalUrl).
 */
function buildSourceUrl(provider, { schoolCode, finalUrl, customerCode }) {
  switch (provider) {
    case 'ARGO':
      return customerCode
        ? `https://www.portaleargo.it/albopretorio/online/#/?customerCode=${customerCode}`
        : finalUrl;

    case 'SPAGGIARI':
      return schoolCode
        ? `https://web.spaggiari.eu/sdg2/Interpelli/${schoolCode}`
        : finalUrl;

    case 'NUVOLA':
      return schoolCode
        ? `https://nuvola.madisoft.it/mad/${schoolCode}/interpelli`
        : finalUrl;

    case 'WEB_GENERIC':
    default:
      return finalUrl;
  }
}

// ---------------------------------------------------------------------------
// HOMEPAGE FETCH
// ---------------------------------------------------------------------------

/**
 * Fetch a school homepage. Returns
 *   { ok: true, status, finalUrl, html }
 * or
 *   { ok: false, status, error }
 * Never throws.
 */
async function fetchHomepage(url) {
  try {
    const response = await axios.get(url, {
      timeout: DISCOVERY_TIMEOUT_MS,
      maxRedirects: MAX_REDIRECTS,
      maxContentLength: MAX_CONTENT_BYTES,
      responseType: 'text',
      validateStatus: () => true, // never throw on 4xx/5xx
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'text/html,application/xhtml+xml',
      },
    });

    // Axios in Node exposes the post-redirect URL on response.request.res.
    const finalUrl =
      response.request?.res?.responseUrl ||
      response.request?._redirectable?._currentUrl ||
      url;

    const html =
      typeof response.data === 'string' ? response.data : String(response.data ?? '');

    return {
      ok: true,
      status: response.status,
      finalUrl,
      html,
    };
  } catch (err) {
    const code = err.code || 'ERR_UNKNOWN';
    const message = err.message || String(err);
    return { ok: false, status: code, error: message };
  }
}

// ---------------------------------------------------------------------------
// SINGLE SCHOOL PROCESSING
// ---------------------------------------------------------------------------

/**
 * Process one school: fetch, detect, upsert source(s), update school status.
 * Returns a result object used for logging. Never throws.
 */
async function processSchool(school) {
  const schoolId = school.id ?? school.school_code;
  const label = school.school_code || schoolId || '<unknown>';

  if (!schoolId) {
    return { schoolId: label, status: 'error', error: 'missing id/school_code' };
  }

  const website = normalizeUrl(school.website);
  if (!website) {
    await markSchool(schoolId, 'invalid_website');
    return { schoolId, status: 'invalid_website' };
  }

  const fetchResult = await fetchHomepage(website);

  if (!fetchResult.ok) {
    await markSchool(schoolId, 'unreachable');
    return {
      schoolId,
      status: 'unreachable',
      error: `${fetchResult.status}: ${fetchResult.error}`,
    };
  }

  const { finalUrl, html, status: httpStatus } = fetchResult;

  // We still parse HTML on 4xx/5xx — some broken pages reveal the provider.
  const detected = detectProviders(finalUrl, html);
  const realProvider = detected.find((d) => d.provider !== 'WEB_GENERIC');
  const overallStatus = realProvider ? 'detected' : 'web_generic';

  // Build one source row per detected provider.
  const sources = detected.map((d) => {
    const sourceUrl =
      buildSourceUrl(d.provider, {
        schoolCode: school.school_code,
        finalUrl,
        customerCode: d.customerCode,
      }) || finalUrl;

    const payload = {
      school_id: schoolId,
      provider: d.provider,
      source_url: sourceUrl,
      discovery_status: 'detected',
      discovery_checked_at: new Date().toISOString(),
      metadata: {
        final_url: finalUrl,
        http_status: httpStatus,
        customer_code: d.customerCode ?? null,
        checked_from: website,
      },
    };

    return { payload, provider: d.provider, sourceUrl };
  });

  // Upsert each source individually — resilient to partial failures.
  const upserted = [];
  const failed = [];
  for (const s of sources) {
    const { error } = await supabase
      .from('radar_school_sources')
      .upsert(s.payload, {
        onConflict: 'school_id,provider,source_url',
        ignoreDuplicates: false,
      });

    if (error) {
      failed.push({ provider: s.provider, error: error.message });
    } else {
      upserted.push(s.provider);
    }
  }

  await markSchool(schoolId, overallStatus);

  return {
    schoolId,
    status: overallStatus,
    httpStatus,
    providers: upserted,
    failed,
  };
}

/** Update a school's discovery tracking columns. */
async function markSchool(schoolId, status) {
  const { error } = await supabase
    .from('radar_schools')
    .update({
      discovery_status: status,
      discovery_checked_at: new Date().toISOString(),
    })
    .eq('id', schoolId);

  if (error) {
    // Non-fatal — log and continue. The batch must not crash on a status update.
    console.warn(`  [warn] status update failed for ${schoolId}: ${error.message}`);
  }
}

// ---------------------------------------------------------------------------
// BATCH RUNNER
// ---------------------------------------------------------------------------

/**
 * Load and process a batch of unprocessed or stale schools.
 *
 * @param {number} batchSize   Number of schools to process (default 100).
 * @param {object} [opts]
 * @param {number} [opts.concurrency]  Parallel fetches (default 5).
 * @returns {Promise<{ processed, detected, generic, unreachable, invalid, errors }>}
 */
export async function runDiscoveryBatch(batchSize = 100, opts = {}) {
  const concurrency = opts.concurrency ?? DEFAULT_CONCURRENCY;
  const cutoff = new Date(
    Date.now() - STALE_DAYS * 24 * 60 * 60 * 1000
  ).toISOString();

  console.log(
    `[discovery] Loading up to ${batchSize} schools ` +
      `(unchecked or older than ${STALE_DAYS} days, concurrency=${concurrency})...`
  );

  const { data: schools, error } = await supabase
    .from('radar_schools')
    .select(
      'id, school_code, name, province, website, discovery_status, discovery_checked_at'
    )
    .not('website', 'is', null)
    .or(`discovery_checked_at.is.null,discovery_checked_at.lt.${cutoff}`)
    .order('discovery_checked_at', { ascending: true, nullsFirst: true })
    .limit(batchSize);

  if (error) {
    throw new Error(
      `Failed to load schools: ${error.message}. ` +
        `Ensure radar_schools has discovery_status and discovery_checked_at columns.`
    );
  }

  if (!schools || schools.length === 0) {
    console.log('[discovery] No schools to process.');
    return { processed: 0, detected: 0, generic: 0, unreachable: 0, invalid: 0, errors: 0 };
  }

  console.log(`[discovery] Processing ${schools.length} schools...\n`);

  const limit = createLimiter(concurrency);
  const summary = {
    processed: 0,
    detected: 0,
    generic: 0,
    unreachable: 0,
    invalid: 0,
    errors: 0,
  };

  await Promise.all(
    schools.map((school) =>
      limit(async () => {
        const label = school.school_code || school.id;
        try {
          const result = await processSchool(school);

          summary.processed += 1;
          if (result.status === 'detected') summary.detected += 1;
          else if (result.status === 'web_generic') summary.generic += 1;
          else if (result.status === 'unreachable') summary.unreachable += 1;
          else if (result.status === 'invalid_website') summary.invalid += 1;
          else summary.errors += 1;

          const providers =
            result.providers && result.providers.length > 0
              ? ` → ${result.providers.join(', ')}`
              : '';
          const suffix = result.error ? ` (${result.error})` : '';
          console.log(
            `  [${summary.processed}/${schools.length}] ${label} ` +
              `${result.status}${providers}${suffix}`
          );
        } catch (err) {
          summary.errors += 1;
          console.error(
            `  [error] ${label}: ${err.message || err}`
          );
        }
      })
    )
  );

  console.log('\n[discovery] Batch summary:');
  console.log(`  processed    : ${summary.processed}`);
  console.log(`  detected     : ${summary.detected}`);
  console.log(`  generic      : ${summary.generic}`);
  console.log(`  unreachable  : ${summary.unreachable}`);
  console.log(`  invalid      : ${summary.invalid}`);
  console.log(`  errors       : ${summary.errors}`);

  return summary;
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function parseArgs(argv) {
  const args = { batch: 100 };
  for (const raw of argv.slice(2)) {
    if (raw.startsWith('--batch=')) {
      const n = Number.parseInt(raw.split('=')[1], 10);
      if (!Number.isNaN(n) && n > 0) args.batch = n;
    } else if (raw === '--help' || raw === '-h') {
      console.log(`
Usage: node services/discoveryEngine.js [--batch=N]

  --batch=N   Process N schools per run (default 100).

Environment:
  SUPABASE_URL
  SUPABASE_SERVICE_ROLE_KEY
`);
      process.exit(0);
    }
  }
  return args;
}

const isMain = (() => {
  try {
    return process.argv[1] === fileURLToPath(import.meta.url);
  } catch {
    return false;
  }
})();

if (isMain) {
  const { batch } = parseArgs(process.argv);
  runDiscoveryBatch(batch)
    .then((summary) => {
      if (summary.errors > 0) {
        console.error('\n[discovery] Completed with errors.');
        process.exit(1);
      }
      process.exit(0);
    })
    .catch((err) => {
      console.error('\n[discovery] Fatal error:');
      console.error(err.stack || err.message || err);
      process.exit(1);
    });
}