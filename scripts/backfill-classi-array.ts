/**
 * ScuoleRadar.it — RIPARAZIONE `class_codes` DAL SINGOLARE `class_code` (§26.119).
 *
 * Perché esiste: la tabella `interpelli` ha DUE colonne per la classe di concorso —
 * `class_codes` (array, indicizzata GIN, usata dalla RPC `match_interpelli` e dal
 * fallback PostgREST) e `class_code` (singolare, quella che l'ingestione scriveva).
 * Misurato il 30/10/2026: **465 righe con il singolare, 197 con l'array**. Le altre
 * entravano nel database ma nessuna ricerca per classe poteva vederle: la bacheca
 * dell'utente restava vuota («0 opportunità») pur avendo avvisi attivi.
 *
 * Cosa fa: per ogni riga con `class_codes` VUOTO e `class_code` valorizzato copia il
 * codice nell'array, con la stessa normalizzazione del mapper (`codiciClasseRiga`:
 * maiuscolo, dedup, segnaposto come «GENERALE» esclusi). Idempotente: le righe già
 * riparate non vengono toccate al giro successivo.
 *
 * Uso:
 *   npx tsx scripts/backfill-classi-array.ts            # DRY-RUN (default): conta e mostra
 *   npx tsx scripts/backfill-classi-array.ts --apply    # scrive (service_role)
 *   npx tsx scripts/backfill-classi-array.ts --apply --limite=10
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { codiciClasseRiga } from '../src/lib/matchingEngine.ts';

dotenv.config();

/** Pagina massima consegnata da PostgREST: oltre, si pagina (mai un conteggio troncato). */
const RIGHE_PAGINA = 1_000;
/** Righe per singola `update` (una richiesta troppo grande viene rifiutata). */
const RIGHE_UPDATE = 50;

const APPLY = process.argv.includes('--apply');
const LIMITE = (() => {
  const arg = process.argv.find((a) => a.startsWith('--limite='));
  const n = Number(arg?.split('=')[1] ?? 0);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : Number.POSITIVE_INFINITY;
})();

interface RigaDaRiparare {
  id: string;
  classe: string;
}

/** Righe con `class_codes` vuoto e `class_code` valorizzato, paginate. */
async function righeDaRiparare(client: SupabaseClient): Promise<{ letti: number; righe: RigaDaRiparare[] }> {
  const righe: RigaDaRiparare[] = [];
  let letti = 0;
  let da = 0;
  for (;;) {
    const { data, error } = await client
      .from('interpelli')
      .select('id,class_code,class_codes')
      .not('class_code', 'is', null)
      .order('id', { ascending: true })
      .range(da, da + RIGHE_PAGINA - 1);
    if (error) throw new Error(error.message);
    const pagina = (data ?? []) as { id: string; class_code: string | null; class_codes: string[] | null }[];
    if (pagina.length === 0) break;
    letti += pagina.length;
    for (const riga of pagina) {
      if ((riga.class_codes ?? []).length > 0) continue;
      const codici = codiciClasseRiga({ class_codes: null, class_code: riga.class_code });
      if (codici.length === 0) continue;
      righe.push({ id: riga.id, classe: codici.join(',') });
      if (righe.length >= LIMITE) return { letti, righe };
    }
    da += pagina.length;
    if (pagina.length < RIGHE_PAGINA) break;
  }
  return { letti, righe };
}

const client = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  { auth: { persistSession: false, autoRefreshToken: false } },
);

const { letti, righe } = await righeDaRiparare(client);
const perClasse = new Map<string, number>();
for (const riga of righe) perClasse.set(riga.classe, (perClasse.get(riga.classe) ?? 0) + 1);

console.log(`\n=== BACKFILL class_codes ← class_code ===`);
console.log(`• Righe lette con class_code: ${letti}`);
console.log(`• Da riparare (class_codes vuoto): ${righe.length}`);
const top = [...perClasse.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12);
if (top.length > 0) {
  console.log(`• Classi più frequenti: ${top.map(([c, n]) => `${c} ×${n}`).join(' · ')}`);
}

if (!APPLY) {
  console.log('\n[dry-run] Nessuna scrittura. Rilancia con --apply per riparare.');
  process.exitCode = 0;
} else {
  let riparate = 0;
  let errori = 0;
  for (let i = 0; i < righe.length; i += RIGHE_UPDATE) {
    const blocco = righe.slice(i, i + RIGHE_UPDATE);
    // Le righe dello stesso blocco possono avere classi diverse: si raggruppa.
    const perCodice = new Map<string, string[]>();
    for (const riga of blocco) {
      perCodice.set(riga.classe, [...(perCodice.get(riga.classe) ?? []), riga.id]);
    }
    for (const [classe, ids] of perCodice) {
      const { error } = await client
        .from('interpelli')
        .update({ class_codes: classe.split(',') })
        .in('id', ids);
      if (error) {
        errori += ids.length;
        console.error(`✗ ${ids.length} righe (${classe}) non aggiornate: ${error.message}`);
        continue;
      }
      riparate += ids.length;
    }
    console.log(`  … ${Math.min(i + RIGHE_UPDATE, righe.length)}/${righe.length}`);
  }
  console.log(`\n✅ Riparate ${riparate} righe${errori > 0 ? ` · ${errori} in errore` : ''}.`);
  process.exitCode = errori === 0 ? 0 : 1;
}
