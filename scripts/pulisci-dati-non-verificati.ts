/**
 * PULIZIA — Rimuove da `interpelli` (e `notices`) i record NON verificati e
 * sanifica i nomi scuola fittizi.
 *
 *   · CANCELLA i record che non superano `verificaAvviso` (titolo/fonte con
 *     segnali di test/mock, URL non http(s) o non istituzionale, fonte mancante);
 *   · AZZERA `school_name` quando non è un istituto reale (sigle di classe,
 *     "VISUALIZZA INTERPELLI", ecc.).
 *
 * DRY-RUN di default. Usare `--apply` per applicare le modifiche.
 * Uso: npx tsx scripts/pulisci-dati-non-verificati.ts [--apply]
 */
import { createClient } from '@supabase/supabase-js';
import process from 'node:process';
import { verificaAvviso } from '../src/scraper/parser.ts';

try {
  process.loadEnvFile();
} catch {
  /* nessun .env */
}

const APPLY = process.argv.includes('--apply');
const URL_ = process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL ?? '';
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';

/** Nome scuola NON valido (sigle/classe/etichette generiche). */
function scuolaDaAzzerare(scuola: string | null | undefined): boolean {
  const s = (scuola ?? '').trim();
  if (!s) return false;
  if (/^visualizza/i.test(s)) return true;
  if (!/[a-zà-ÿ]/.test(s)) return true; // solo maiuscole/codici (es. "EEEE", "ADEE | EEEE")
  if (/\b(?:[A-Z]{1,2}-?\d{2,3}|AD[A-Z]{2,3})\b/.test(s)) return true; // contiene un codice classe
  return false;
}

async function pulisci(tabella: string): Promise<void> {
  const sb = createClient(URL_, SERVICE);
  let { data, error } = await sb
    .from(tabella)
    .select('id, title, school_name, source_url')
    .limit(2000);
  // `notices` (legacy) non ha la colonna school_name → ripiega senza sanificazione.
  if (error && /school_name/.test(error.message)) {
    ({ data, error } = await sb.from(tabella).select('id, title, source_url').limit(2000));
  }
  if (error) {
    console.log(`\n=== ${tabella}: errore ${error.message}`);
    return;
  }
  const righe = (data ?? []) as Array<{
    id: string;
    title: string | null;
    school_name?: string | null;
    source_url: string | null;
  }>;
  console.log(`\n=== ${tabella}: ${righe.length} righe da verificare ===`);

  const daCancellare: typeof righe = [];
  const daAzzerareScuola: typeof righe = [];
  for (const r of righe) {
    const esito = verificaAvviso({ title: r.title, link: r.source_url });
    if (!esito.ok) daCancellare.push(r);
    else if (scuolaDaAzzerare(r.school_name)) daAzzerareScuola.push(r);
  }

  console.log(`  · record non verificati da CANCELLARE: ${daCancellare.length}`);
  for (const r of daCancellare.slice(0, 20)) {
    console.log(`      ✗ [${r.id.slice(0, 8)}] ${(r.title ?? '').slice(0, 55)} → ${(r.source_url ?? '').slice(0, 60)}`);
  }
  console.log(`  · nomi scuola fittizi da AZZERARE: ${daAzzerareScuola.length}`);
  for (const r of daAzzerareScuola.slice(0, 20)) {
    console.log(`      · [${r.id.slice(0, 8)}] school_name=${JSON.stringify(r.school_name)}`);
  }

  if (!APPLY) {
    console.log('  (DRY-RUN: nessuna modifica. Rilancia con --apply per applicare.)');
    return;
  }

  if (daCancellare.length > 0) {
    const ids = daCancellare.map((r) => r.id);
    const { error: errDel } = await sb.from(tabella).delete().in('id', ids);
    console.log(errDel ? `  ✗ delete fallita: ${errDel.message}` : `  ✓ cancellati ${ids.length} record`);
  }
  for (const r of daAzzerareScuola) {
    const { error: errUpd } = await sb.from(tabella).update({ school_name: null }).eq('id', r.id);
    if (errUpd) console.log(`  ✗ update ${r.id.slice(0, 8)}: ${errUpd.message}`);
  }
  console.log(`  ✓ azzerati ${daAzzerareScuola.length} nomi scuola`);
}

async function main(): Promise<void> {
  console.log(`Pulizia dati non verificati — modalità ${APPLY ? 'APPLY' : 'DRY-RUN'}`);
  await pulisci('interpelli');
  await pulisci('notices');
}

void main();
