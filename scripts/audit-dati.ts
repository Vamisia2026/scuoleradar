/**
 * DIAGNOSTICA/IGIENE — Audit dei dati in `interpelli` e `notices`:
 * individua record di test/mock o non verificabili (URL "esempio/test/mock",
 * host non ufficiali) da rimuovere, e mostra i gruppi per host.
 *
 * Uso: npx tsx scripts/audit-dati.ts
 */
import { createClient } from '@supabase/supabase-js';
import process from 'node:process';

try {
  process.loadEnvFile();
} catch {
  /* nessun .env */
}

const URL_ = process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL ?? '';
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';

const RE_SOSPETTO = /esempio|\btest\b|mock|sample|dummy|placeholder|fixture|example|localhost|demo/i;

interface Riga {
  hash_id?: string;
  title?: string | null;
  province?: string | null;
  source_url?: string | null;
  created_at?: string | null;
}

function host(url: string | null | undefined): string {
  try {
    return new URL(url ?? '').host;
  } catch {
    return '(non-URL)';
  }
}

async function audit(tabella: string): Promise<void> {
  const sb = createClient(URL_, SERVICE);
  const { data, error } = await sb
    .from(tabella)
    .select('hash_id,title,province,source_url,created_at')
    .order('created_at', { ascending: false })
    .limit(1000);
  if (error) {
    console.log(`\n=== ${tabella}: errore ${error.message}`);
    return;
  }
  const righe = (data ?? []) as Riga[];
  console.log(`\n=== ${tabella}: ${righe.length} righe ===`);

  const perHost = new Map<string, number>();
  for (const r of righe) perHost.set(host(r.source_url), (perHost.get(host(r.source_url)) ?? 0) + 1);
  console.log('Host (prime 25):');
  for (const [h, n] of [...perHost.entries()].sort((a, b) => b[1] - a[1]).slice(0, 25)) {
    console.log(`   ${n.toString().padStart(4)}  ${h}`);
  }

  const sospetti = righe.filter(
    (r) => RE_SOSPETTO.test(r.source_url ?? '') || RE_SOSPETTO.test(r.title ?? ''),
  );
  console.log(`\nRecord SOSPETTI (titolo/url con esempio|test|mock|...): ${sospetti.length}`);
  for (const r of sospetti.slice(0, 30)) {
    console.log(`   [${r.province}] ${(r.title ?? '').slice(0, 60)} → ${(r.source_url ?? '').slice(0, 70)}`);
  }

  // URL non validi o non http(s)
  const urlNonValidi = righe.filter((r) => !/^https?:\/\//i.test((r.source_url ?? '').trim()));
  console.log(`\nRecord con source_url NON http(s): ${urlNonValidi.length}`);
  for (const r of urlNonValidi.slice(0, 15)) {
    console.log(`   [${r.province}] ${(r.title ?? '').slice(0, 50)} → ${JSON.stringify(r.source_url)}`);
  }
}

async function main(): Promise<void> {
  const sb = createClient(URL_, SERVICE);
  for (const tabella of ['interpelli', 'notices']) {
    const { data } = await sb
      .from(tabella)
      .select('title, school_name, source_url, province, created_at')
      .order('created_at', { ascending: false })
      .limit(1000);
    const righe = (data ?? []) as Array<Record<string, string | null>>;
    console.log(`\n===== ${tabella}: ${righe.length} righe =====`);
    const scuole = new Set<string>();
    for (const r of righe) {
      const s = (r.school_name ?? '').trim();
      if (s) scuole.add(s);
    }
    console.log(`school_name distinti (${scuole.size}):`);
    for (const s of [...scuole].slice(0, 40)) console.log(`   · ${s}`);
    console.log('Titoli (prime 25):');
    for (const r of righe.slice(0, 25)) console.log(`   [${r.province}] ${(r.title ?? '').slice(0, 95)}`);
  }
}

void main();

