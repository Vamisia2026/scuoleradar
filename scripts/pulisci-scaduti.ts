/**
 * PULIZIA — Rimuove da `interpelli` (e `notices`) gli interpelli SCADUTI,
 * così le liste pubbliche restano automaticamente pulite.
 *
 * DRY-RUN di default. `--apply` per cancellare. `--giorni=N` per una tolleranza
 * (default 0 = si cancellano le scadenze precedenti a oggi).
 * Uso: npx tsx scripts/pulisci-scaduti.ts [--apply] [--giorni=0]
 */
import { createClient } from '@supabase/supabase-js';
import process from 'node:process';

try {
  process.loadEnvFile();
} catch {
  /* nessun .env */
}

const APPLY = process.argv.includes('--apply');
const argGiorni = process.argv.find((a) => a.startsWith('--giorni='));
const tolleranza = argGiorni ? Math.max(0, Number(argGiorni.split('=')[1]) || 0) : 0;

const URL_ = process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL ?? '';
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';

const cutoff = new Date(Date.now() - tolleranza * 86_400_000).toISOString().slice(0, 10);

async function pulisci(tabella: string): Promise<void> {
  const sb = createClient(URL_, SERVICE);
  const { data, error } = await sb
    .from(tabella)
    .select('id, title, province, expiration_date')
    .lt('expiration_date', cutoff)
    .limit(5000);
  if (error) {
    console.log(`\n=== ${tabella}: errore ${error.message}`);
    return;
  }
  const righe = (data ?? []) as Array<{
    id: string;
    title: string | null;
    province: string | null;
    expiration_date: string | null;
  }>;
  console.log(`\n=== ${tabella}: ${righe.length} interpelli SCADUTI (scadenza < ${cutoff}) ===`);
  for (const r of righe.slice(0, 20)) {
    console.log(`   · [${r.province}] ${(r.title ?? '').slice(0, 55)} — scad: ${r.expiration_date}`);
  }
  if (righe.length > 20) console.log(`   … e altri ${righe.length - 20}`);

  if (!APPLY) {
    console.log('  (DRY-RUN: nessuna cancellazione. Rilancia con --apply.)');
    return;
  }
  if (righe.length === 0) return;
  const ids = righe.map((r) => r.id);
  const { error: errDel } = await sb.from(tabella).delete().in('id', ids);
  console.log(errDel ? `  ✗ delete fallita: ${errDel.message}` : `  ✓ rimossi ${ids.length} interpelli scaduti`);
}

async function main(): Promise<void> {
  console.log(
    `Pulizia interpelli scaduti — modalità ${APPLY ? 'APPLY' : 'DRY-RUN'} · cutoff=${cutoff}`,
  );
  await pulisci('interpelli');
  await pulisci('notices');
}

void main();
