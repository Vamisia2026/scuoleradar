/**
 * DIAGNOSTICA — Verifica ingestione multi-regione in `interpelli`.
 * Mostra i conteggi per provincia delle righe più recenti.
 * Uso: npx tsx scripts/diag-interpelli-multiregione.ts
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

async function main(): Promise<void> {
  const sb = createClient(URL_, SERVICE);
  const { count } = await sb.from('interpelli').select('*', { count: 'exact', head: true });
  console.log(`Totale interpelli: ${count}`);

  const { data } = await sb
    .from('interpelli')
    .select('province, class_codes, expiration_date, published_at, created_at')
    .order('created_at', { ascending: false })
    .limit(20);

  const perProv = new Map<string, number>();
  for (const r of data ?? []) {
    perProv.set(r.province, (perProv.get(r.province) ?? 0) + 1);
  }
  console.log('Ultime 20 righe — province:', [...perProv.entries()].map(([p, n]) => `${p}:${n}`).join(' '));

  console.log('\nUltime 20 righe (provincia | classi | scadenza | pubblicazione):');
  for (const r of data ?? []) {
    const classi = (r.class_codes ?? []).join(',');
    console.log(`  [${r.province}] ${classi || '—'} | scad=${r.expiration_date ?? 'null'} | pub=${r.published_at ?? 'null'}`);
  }
}

void main();
