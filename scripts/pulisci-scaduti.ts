/**
 * PULIZIA — Rimuove da `interpelli` (e `notices`) gli avvisi NON VIVI, così le
 * liste pubbliche restano automaticamente pulite:
 *   1. gli interpelli SCADUTI (scadenza precedente a oggi);
 *   2. gli avvisi SENZA scadenza esplicita pubblicati oltre la finestra di
 *      `GIORNI_FINESTRA_SENZA_SCADENZA` (60 giorni) — la fonte non li data, quindi
 *      non possono restare pubblici per sempre (stessa regola di `eAvvisoVivo`).
 *
 * DRY-RUN di default. `--apply` per cancellare. `--giorni=N` per una tolleranza
 * sulle SOLE scadenze (default 0 = si cancellano le scadenze precedenti a oggi).
 * Uso: npx tsx scripts/pulisci-scaduti.ts [--apply] [--giorni=0]
 */
import { createClient } from '@supabase/supabase-js';
import process from 'node:process';
import { GIORNI_FINESTRA_SENZA_SCADENZA } from '../src/lib/scadenza.ts';

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
// Soglia della finestra per gli avvisi che la fonte NON data (regola di prodotto):
// pubblicati PRIMA di questo giorno sono fuori dalla finestra dei 60 giorni.
const limiteSenzaScadenza = new Date(
  Date.now() - GIORNI_FINESTRA_SENZA_SCADENZA * 86_400_000,
)
  .toISOString()
  .slice(0, 10);

interface RigaPulizia {
  id: string;
  title: string | null;
  province: string | null;
  expiration_date?: string | null;
  created_at?: string | null;
}

async function pulisci(tabella: string): Promise<void> {
  const sb = createClient(URL_, SERVICE);

  // 1) Avvisi con scadenza GIÀ PASSATA.
  const { data, error } = await sb
    .from(tabella)
    .select('id, title, province, expiration_date')
    .lt('expiration_date', cutoff)
    .limit(5000);
  if (error) {
    console.log(`\n=== ${tabella}: errore ${error.message}`);
    return;
  }
  const righe = (data ?? []) as RigaPulizia[];
  console.log(`\n=== ${tabella}: ${righe.length} interpelli SCADUTI (scadenza < ${cutoff}) ===`);
  for (const r of righe.slice(0, 20)) {
    console.log(`   · [${r.province}] ${(r.title ?? '').slice(0, 55)} — scad: ${r.expiration_date}`);
  }
  if (righe.length > 20) console.log(`   … e altri ${righe.length - 20}`);

  // 2) Avvisi SENZA scadenza pubblicati OLTRE la finestra dei 60 giorni.
  //    `created_at` è la data di pubblicazione della riga: una fonte che non data
  //    la scadenza non può tenere l'opportunità in vetrina per sempre.
  const { data: senzaData, error: errSenza } = await sb
    .from(tabella)
    .select('id, title, province, created_at')
    .is('expiration_date', null)
    .lt('created_at', limiteSenzaScadenza)
    .limit(5000);
  if (errSenza) console.log(`\n=== ${tabella}: errore (senza scadenza) ${errSenza.message}`);
  const senzaScadenza = (senzaData ?? []) as RigaPulizia[];
  console.log(
    `\n=== ${tabella}: ${senzaScadenza.length} avvisi SENZA scadenza fuori dalla finestra di ` +
      `${GIORNI_FINESTRA_SENZA_SCADENZA} giorni (pubblicati prima del ${limiteSenzaScadenza}) ===`,
  );
  for (const r of senzaScadenza.slice(0, 20)) {
    console.log(
      `   · [${r.province}] ${(r.title ?? '').slice(0, 55)} — pub: ${(r.created_at ?? '').slice(0, 10)}`,
    );
  }
  if (senzaScadenza.length > 20) console.log(`   … e altri ${senzaScadenza.length - 20}`);

  if (!APPLY) {
    console.log('  (DRY-RUN: nessuna cancellazione. Rilancia con --apply.)');
    return;
  }
  const ids = [...righe.map((r) => r.id), ...senzaScadenza.map((r) => r.id)];
  if (ids.length === 0) return;
  const { error: errDel } = await sb.from(tabella).delete().in('id', ids);
  console.log(
    errDel
      ? `  ✗ delete fallita: ${errDel.message}`
      : `  ✓ rimossi ${ids.length} avvisi non vivi (scaduti + fuori finestra)`,
  );
}

async function main(): Promise<void> {
  console.log(
    `Pulizia interpelli non vivi — modalità ${APPLY ? 'APPLY' : 'DRY-RUN'} · ` +
      `cutoff scadenze=${cutoff} · finestra senza scadenza=${GIORNI_FINESTRA_SENZA_SCADENZA}gg (prima del ${limiteSenzaScadenza})`,
  );
  await pulisci('interpelli');
  await pulisci('notices');
}

void main();
