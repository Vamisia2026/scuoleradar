/**
 * PULIZIA — Rimuove da `interpelli` le righe di CONTORNO (§26.65).
 *
 * Perché esiste. Le fonti pubblicano sulla stessa pagina gli avvisi e il contorno
 * (voci di menu, titoli di sezione, indici di classi di concorso, numeri di
 * protocollo). L'ingestione che legge la pagina intera porta in tabella anche il
 * contorno: la bacheca lo mostrava come «opportunità» con punteggi piatti («60%»)
 * e senza scadenza («INVALID DATE» in vetrina).
 *
 * La bacheca ora scarta quelle righe a monte (`lib/qualitaAvviso.ts`, lo STESSO
 * giudizio usato qui): questo script ripulisce anche la TABELLA, così il contorno
 * non inquina più nemmeno le superfici che leggono `interpelli` direttamente.
 *
 * DRY-RUN di default: stampa cosa uscirebbe, non tocca nulla. `--apply` per
 * cancellare. Uso: npx tsx scripts/pulisci-non-opportunita.ts [--apply]
 */
import { createClient } from '@supabase/supabase-js';
import process from 'node:process';
import { mapInterpelloDBToInterpello, type InterpelloDB } from '../src/lib/matchingEngine.ts';
import { motivoRigaNonOpportunitaAvviso } from '../src/lib/qualitaAvviso.ts';

try {
  process.loadEnvFile();
} catch {
  /* nessun .env */
}

const APPLY = process.argv.includes('--apply');
const URL_ = process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL ?? '';
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';

const COLONNE =
  'id,title,province,class_codes,school_name,school_code,source_url,expiration_date,created_at,contact_email,materia,stato_arricchimento';

interface RigaContorno {
  id: string;
  titolo: string;
  motivo: string;
}

async function main(): Promise<void> {
  const sb = createClient(URL_, SERVICE);
  const { data, error } = await sb.from('interpelli').select(COLONNE).limit(5000);
  if (error) {
    console.log(`✗ lettura interpelli: ${error.message}`);
    process.exitCode = 1;
    return;
  }
  const righe = (data ?? []) as unknown as InterpelloDB[];

  const contorno: RigaContorno[] = [];
  const perMotivo = new Map<string, number>();
  for (const riga of righe) {
    // STESSA mappatura e STESSO giudizio della bacheca: nessuna copia della regola.
    const avviso = mapInterpelloDBToInterpello(riga);
    const motivo = motivoRigaNonOpportunitaAvviso(avviso);
    if (!motivo) continue;
    contorno.push({ id: riga.id, titolo: avviso.titolo, motivo });
    perMotivo.set(motivo, (perMotivo.get(motivo) ?? 0) + 1);
  }

  console.log(
    `interpelli in tabella: ${righe.length} · righe di contorno: ${contorno.length} ` +
      `(opportunità reali: ${righe.length - contorno.length})`,
  );
  for (const [motivo, n] of perMotivo) console.log(`   · ${motivo}: ${n}`);
  for (const r of contorno.slice(0, 30)) console.log(`   · [${r.motivo}] ${r.titolo.slice(0, 70)}`);
  if (contorno.length > 30) console.log(`   … e altre ${contorno.length - 30}`);

  if (!APPLY) {
    console.log('(DRY-RUN: nessuna cancellazione. Rilancia con --apply.)');
    return;
  }
  if (contorno.length === 0) return;
  const { error: errDel } = await sb
    .from('interpelli')
    .delete()
    .in('id', contorno.map((r) => r.id));
  if (errDel) {
    console.log(`  ✗ delete fallita: ${errDel.message}`);
    process.exitCode = 1;
    return;
  }
  console.log(`  ✓ rimosse ${contorno.length} righe di contorno (non erano avvisi)`);
}

void main();
