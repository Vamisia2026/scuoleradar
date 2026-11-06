// run_pipeline.js
//
// ScuoleRadar — End-to-end MVP pipeline runner.
//
//   [1/3 SEED]        scripts/seed_schools.js  (spawned as child process)
//   [2/3 DISCOVERY]   services/discoveryEngine.js → runDiscoveryBatch()
//   [3/3 ARGO]        adapters/argoAdapter.js     → runArgoBatch()
//
// Usage:
//   node run_pipeline.js
//   node run_pipeline.js --sample=100
//   node run_pipeline.js --full
//   node run_pipeline.js --skip-seed
//   node run_pipeline.js --discovery-batch=50 --argo-batch=10
//
// Environment:
//   SUPABASE_URL
//   SUPABASE_SERVICE_KEY  (or SUPABASE_SERVICE_ROLE_KEY)

import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ---------------------------------------------------------------------------
// ENV SETUP (normalize before any child process or dynamic import)
// ---------------------------------------------------------------------------

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY =
  process.env.SUPABASE_SERVICE_KEY ||
  process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error(
    '❌ Missing SUPABASE_URL or SUPABASE_SERVICE_KEY (or SUPABASE_SERVICE_ROLE_KEY).'
  );
  process.exit(1);
}

// The downstream modules and the spawned seed script both read
// SUPABASE_SERVICE_ROLE_KEY. Normalize it now so everything sees the same value.
process.env.SUPABASE_URL = SUPABASE_URL;
process.env.SUPABASE_SERVICE_ROLE_KEY = SUPABASE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ---------------------------------------------------------------------------
// CLI ARGS
// ---------------------------------------------------------------------------

function parseArgs(argv) {
  const opts = {
    sample: 100,
    full: false,
    skipSeed: false,
    skipDiscovery: false,
    skipArgo: false,
    discoveryBatch: 100,
    argoBatch: 20,
  };

  for (const raw of argv.slice(2)) {
    if (raw.startsWith('--sample=')) {
      const n = Number.parseInt(raw.split('=')[1], 10);
      if (!Number.isNaN(n) && n > 0) opts.sample = n;
    } else if (raw === '--full') opts.full = true;
    else if (raw === '--skip-seed') opts.skipSeed = true;
    else if (raw === '--skip-discovery') opts.skipDiscovery = true;
    else if (raw === '--skip-argo') opts.skipArgo = true;
    else if (raw.startsWith('--discovery-batch=')) {
      const n = Number.parseInt(raw.split('=')[1], 10);
      if (!Number.isNaN(n) && n > 0) opts.discoveryBatch = n;
    } else if (raw.startsWith('--argo-batch=')) {
      const n = Number.parseInt(raw.split('=')[1], 10);
      if (!Number.isNaN(n) && n > 0) opts.argoBatch = n;
    } else if (raw === '--help' || raw === '-h') {
      printHelp();
      process.exit(0);
    } else {
      console.warn(`Ignoring unknown argument: ${raw}`);
    }
  }

  return opts;
}

function printHelp() {
  console.log(`
Usage: node run_pipeline.js [options]

Options:
  --sample=N              Seed N sample schools (default 100)
  --full                  Run the full MIM seed instead of the sample
  --skip-seed             Skip the seed step
  --skip-discovery        Skip the discovery step
  --skip-argo             Skip the Argo adapter step
  --discovery-batch=N     Discovery batch size (default 100)
  --argo-batch=N          Argo batch size (default 20)
  --help, -h              Show this help

Environment:
  SUPABASE_URL
  SUPABASE_SERVICE_KEY (or SUPABASE_SERVICE_ROLE_KEY)
`);
}

// ---------------------------------------------------------------------------
// STEP 1 — SEED (child process)
// ---------------------------------------------------------------------------

function runSeed(opts) {
  return new Promise((resolve) => {
    const scriptPath = path.resolve(__dirname, 'scripts/seed_schools.js');
    const args = [scriptPath];
    if (!opts.full) args.push(`--sample=${opts.sample}`);

    console.log(`   → node ${args.map((a) => path.relative(__dirname, a) || a).join(' ')}`);

    const child = spawn(process.execPath, args, {
      stdio: 'inherit',
      env: process.env,
      cwd: __dirname,
    });

    child.on('exit', (code) => {
      if (code !== 0) {
        console.warn(`   ⚠ seed script exited with code ${code} — continuing.`);
      }
      resolve(code);
    });

    child.on('error', (err) => {
      console.error(`   ❌ failed to spawn seed script: ${err.message}`);
      resolve(1);
    });
  });
}

// ---------------------------------------------------------------------------
// STEP 2 — DISCOVERY
// ---------------------------------------------------------------------------

async function runDiscovery(opts) {
  const { runDiscoveryBatch } = await import('./services/discoveryEngine.js');
  return runDiscoveryBatch(opts.discoveryBatch, { concurrency: 5 });
}

// ---------------------------------------------------------------------------
// STEP 3 — ARGO
// ---------------------------------------------------------------------------

async function runArgo(opts) {
  const { runArgoBatch } = await import('./adapters/argoAdapter.js');
  return runArgoBatch(opts.argoBatch, 3);
}

// ---------------------------------------------------------------------------
// SUMMARY
// ---------------------------------------------------------------------------

async function safeCount(table) {
  try {
    const { count, error } = await supabase
      .from(table)
      .select('*', { count: 'exact', head: true });
    if (error) return null;
    return count ?? 0;
  } catch {
    return null;
  }
}

async function printSummary({ startedAt, argoStartedAt, timings, stepResults }) {
  console.log('\n');
  console.log('═'.repeat(66));
  console.log('                       PIPELINE SUMMARY');
  console.log('═'.repeat(66));

  // --- Schools ---------------------------------------------------------
  const totalSchools = await safeCount('radar_schools');
  console.log(`\n📚 Schools seeded (total in DB): ${totalSchools ?? 'unknown'}`);

  // --- Sources by provider --------------------------------------------
  let sourceRows = [];
  try {
    const { data, error } = await supabase
      .from('radar_school_sources')
      .select('provider');
    if (!error && data) sourceRows = data;
  } catch {
    /* ignore */
  }

  const byProvider = {};
  for (const r of sourceRows) {
    byProvider[r.provider] = (byProvider[r.provider] || 0) + 1;
  }
  const totalSources = Object.values(byProvider).reduce((a, b) => a + b, 0);

  console.log('\n🔗 Sources discovered (total in DB):');
  if (Object.keys(byProvider).length === 0) {
    console.log('   (none)');
  } else {
    for (const [p, n] of Object.entries(byProvider).sort((a, b) => b[1] - a[1])) {
      console.log(`   ${p.padEnd(14)}: ${n}`);
    }
    console.log(`   ${'─'.repeat(20)}`);
    console.log(`   ${'TOTAL'.padEnd(14)}: ${totalSources}`);
  }

  // --- Notices ---------------------------------------------------------
  const totalNotices = await safeCount('radar_notices');

  let newNoticesCount = 0;
  let recentNotices = [];
  try {
    const { data, error } = await supabase
      .from('radar_notices')
      .select('*')
      .gte('created_at', argoStartedAt.toISOString());
    if (!error && data) newNoticesCount = data.length;
  } catch {
    /* ignore */
  }

  try {
    const { data, error } = await supabase
      .from('radar_notices')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(500);
    if (!error && data) recentNotices = data;
  } catch {
    /* ignore */
  }

  // Look up school names for referenced notices
  const schoolIds = [...new Set(recentNotices.map((n) => n.school_id).filter(Boolean))];
  const schoolMap = {};
  if (schoolIds.length > 0) {
    try {
      const { data, error } = await supabase
        .from('radar_schools')
        .select('id, name, province, school_code')
        .in('id', schoolIds);
      if (!error && data) {
        for (const s of data) schoolMap[s.id] = s;
      }
    } catch {
      /* ignore */
    }
  }

  console.log(`\n📄 Notices ingested:`);
  console.log(`   Total in DB      : ${totalNotices ?? 'unknown'}`);
  console.log(`   New in this run  : ${newNoticesCount}`);

  // --- Sample list -----------------------------------------------------
  if (recentNotices.length > 0) {
    console.log('\n📋 Sample notices (latest 8):');
    recentNotices.slice(0, 8).forEach((n, i) => {
      const school = schoolMap[n.school_id] || {};
      const where = school.province ? ` (${school.province})` : '';
      const classes = (n.competition_classes || []).join(', ') || '—';
      const title = (n.title || '').replace(/\s+/g, ' ').slice(0, 72);
      console.log(`   ${i + 1}. ${school.name || n.school_id || '?'}${where}`);
      console.log(`      "${title}"`);
      console.log(
        `      category: ${n.category || '—'} | level: ${n.match_level || '—'} | classes: ${classes}`
      );
    });
  } else {
    console.log('\n   No notices in DB yet.');
  }

  // --- Asti highlight --------------------------------------------------
  const astiNotices = recentNotices.filter(
    (n) => schoolMap[n.school_id]?.province === 'AT'
  );
  console.log(`\n🎯 Asti (AT) notices: ${astiNotices.length}`);
  if (astiNotices.length > 0) {
    astiNotices.slice(0, 5).forEach((n) => {
      const school = schoolMap[n.school_id] || {};
      const title = (n.title || '').replace(/\s+/g, ' ').slice(0, 64);
      console.log(`   • ${school.name || '?'} — "${title}" [${n.category || '—'}]`);
    });
  }

  // --- Artom highlight -------------------------------------------------
  const artomNotices = recentNotices.filter((n) => {
    const name = schoolMap[n.school_id]?.name || '';
    return /artom/i.test(name);
  });
  console.log(`\n🎯 Artom notices (IIS Artom, Asti): ${artomNotices.length}`);
  if (artomNotices.length > 0) {
    artomNotices.slice(0, 5).forEach((n) => {
      const school = schoolMap[n.school_id] || {};
      const title = (n.title || '').replace(/\s+/g, ' ').slice(0, 64);
      console.log(
        `   • ${school.name || '?'} (${school.province || '?'}) — "${title}" [${n.category || '—'}]`
      );
    });
  }

  // --- Step status -----------------------------------------------------
  console.log('\n📊 Step status:');
  for (const [step, status] of Object.entries(stepResults)) {
    const icon =
      status === 'ok' ? '✅' : status === 'skipped' ? '⏭ ' : status === 'failed' ? '❌' : 'ℹ ';
    const ms = timings[step];
    const time = ms !== undefined ? ` (${(ms / 1000).toFixed(1)}s)` : '';
    console.log(`   ${icon} ${step.padEnd(12)} ${status}${time}`);
  }

  const totalMs = Date.now() - startedAt.getTime();
  console.log(`\n⏱  Total elapsed: ${(totalMs / 1000).toFixed(1)}s`);
  console.log('═'.repeat(66));
}

// ---------------------------------------------------------------------------
// MAIN
// ---------------------------------------------------------------------------

async function main() {
  const opts = parseArgs(process.argv);
  const startedAt = new Date();
  const timings = {};
  const stepResults = {};

  console.log('🚀 ScuoleRadar — MVP Pipeline');
  console.log(`   Mode: ${opts.full ? 'FULL MIM' : `SAMPLE (${opts.sample})`}`);
  console.log(`   Supabase: ${SUPABASE_URL}`);

  // --- [1/3] SEED ------------------------------------------------------
  if (opts.skipSeed) {
    console.log('\n[1/3 SEED] ⏭  skipped (--skip-seed)');
    stepResults.seed = 'skipped';
  } else {
    console.log('\n[1/3 SEED] 📚 Seeding radar_schools...');
    const t = Date.now();
    const code = await runSeed(opts);
    timings.seed = Date.now() - t;
    stepResults.seed = code === 0 ? 'ok' : 'failed';
  }

  // --- [2/3] DISCOVERY -------------------------------------------------
  if (opts.skipDiscovery) {
    console.log('\n[2/3 DISCOVERY] ⏭  skipped (--skip-discovery)');
    stepResults.discovery = 'skipped';
  } else {
    console.log('\n[2/3 DISCOVERY] 🔍 Scanning school websites...');
    const t = Date.now();
    try {
      const summary = await runDiscovery(opts);
      timings.discovery = Date.now() - t;
      stepResults.discovery = summary?.errors > 0 ? 'failed' : 'ok';
    } catch (err) {
      timings.discovery = Date.now() - t;
      stepResults.discovery = 'failed';
      console.error(`   ❌ discovery failed: ${err.message}`);
    }
  }

  // --- [3/3] ARGO ------------------------------------------------------
  const argoStartedAt = new Date();
  if (opts.skipArgo) {
    console.log('\n[3/3 ARGO ADAPTER] ⏭  skipped (--skip-argo)');
    stepResults.argo = 'skipped';
  } else {
    console.log('\n[3/3 ARGO ADAPTER] 🏛  Querying Argo sources...');
    const t = Date.now();
    try {
      const summary = await runArgo(opts);
      timings.argo = Date.now() - t;
      stepResults.argo = summary?.errors > 0 ? 'failed' : 'ok';
    } catch (err) {
      timings.argo = Date.now() - t;
      stepResults.argo = 'failed';
      console.error(`   ❌ argo adapter failed: ${err.message}`);
    }
  }

  // --- SUMMARY ---------------------------------------------------------
  try {
    await printSummary({ startedAt, argoStartedAt, timings, stepResults });
  } catch (err) {
    console.error('\n⚠ Failed to render full summary:', err.message);
  }

  // Exit code: fail only if every active step failed
  const active = Object.entries(stepResults).filter(([, s]) => s !== 'skipped');
  const allFailed = active.length > 0 && active.every(([, s]) => s === 'failed');
  process.exit(allFailed ? 1 : 0);
}

main().catch((err) => {
  console.error('\n❌ PIPELINE FATAL:', err.stack || err.message || err);
  process.exit(1);
});