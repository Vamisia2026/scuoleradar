/**
 * DIAGNOSTICA — Perché la tabella "Radar Live" (FlightBoardInterpelli) è nascosta?
 *
 * Replica ESATTAMENTE la query e i filtri del componente
 * `src/components/FlightBoardInterpelli.tsx`:
 *   query: from('interpelli').select(...).order('created_at', desc).limit(500)
 *   filtro: source_url valorizzato AND (expiration_date nulla O >= now-24h)
 *   render: sezione nascosta se righe.length === 0
 *
 * Confronta chiave ANON (browser) e service_role (server) e controlla anche
 * la tabella legacy `notices` (fallback dello scraper).
 *
 * Uso: npx tsx scripts/diag-flightboard.ts
 */

import { createClient } from '@supabase/supabase-js';
import process from 'node:process';

try {
  process.loadEnvFile();
} catch {
  /* nessun .env: uso l'ambiente di sistema */
}

const URL_ = process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL ?? '';
const ANON = process.env.VITE_SUPABASE_ANON_KEY ?? '';
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
const VENTIQUATTRO_ORE = 86_400_000;

const SELECT_COMPONENTE =
  'id, title, school_name, province, class_codes, expiration_date, created_at, source_url';

interface Riga {
  id?: string;
  title?: string | null;
  province?: string | null;
  class_codes?: string[] | null;
  expiration_date?: string | null;
  created_at?: string | null;
  source_url?: string | null;
}

const host = (() => {
  try {
    return new URL(URL_).host;
  } catch {
    return '(url non valido/vuoto)';
  }
})();

console.log('──────────────────────────────────────────────────────────');
console.log('🔎 DIAGNOSI FlightBoardInterpelli (Radar Live)');
console.log('──────────────────────────────────────────────────────────');
console.log(`• SUPABASE_URL (host): ${host}`);
console.log(`• VITE_SUPABASE_ANON_KEY: ${ANON ? 'presente' : 'MANCANTE'}`);
console.log(`• SUPABASE_SERVICE_ROLE_KEY: ${SERVICE ? 'presente' : 'MANCANTE'}`);

function riepilogo(etichetta: string, righe: Riga[]): void {
  const ora = Date.now();
  const conFonte = righe.filter((r) => Boolean((r.source_url ?? '').trim()));
  const senzaFonte = righe.filter((r) => !Boolean((r.source_url ?? '').trim()));
  const scadenzaNulla = righe.filter((r) => !r.expiration_date);
  const scadenzaFutura = righe.filter(
    (r) => r.expiration_date && new Date(r.expiration_date).getTime() >= ora - VENTIQUATTRO_ORE,
  );
  const scadenzaPassata = righe.filter(
    (r) => r.expiration_date && new Date(r.expiration_date).getTime() < ora - VENTIQUATTRO_ORE,
  );
  // Filtro ESATTO del componente:
  const attive = righe.filter(
    (r) =>
      Boolean((r.source_url ?? '').trim()) &&
      (!r.expiration_date || new Date(r.expiration_date).getTime() >= ora - VENTIQUATTRO_ORE),
  );

  console.log(`\n— ${etichetta} —`);
  console.log(`  righe restituite dalla query : ${righe.length}`);
  console.log(`  con source_url valorizzato   : ${conFonte.length}`);
  console.log(`  senza source_url             : ${senzaFonte.length}`);
  console.log(`  scadenza nulla               : ${scadenzaNulla.length}`);
  console.log(`  scadenza futura (>= −24h)    : ${scadenzaFutura.length}`);
  console.log(`  scadenza passata (< −24h)    : ${scadenzaPassata.length}`);
  console.log(`  >>> MOSTRATE dal componente   : ${attive.length} ${attive.length === 0 ? '→ SEZIONE NASCOSTA (comportamento attuale)' : '→ SEZIONE VISIBILE'}`);
  // Simulazione del comportamento dopo il fix (fallback ai più recenti con fonte).
  const mostrabili = attive.length > 0 ? attive : conFonte;
  console.log(`  >>> CON FIX (fallback)        : ${mostrabili.length} ${mostrabili.length > 0 ? '→ SEZIONE VISIBILE' : '→ sezione nascosta (nessun dato pubblico)'}`);

  const esempi = righe.slice(0, 5);
  if (esempi.length > 0) {
    console.log('  esempi (title | province | expiration_date | source_url):');
    for (const r of esempi) {
      console.log(
        `   · ${(r.title ?? '(no title)').slice(0, 42)} | ${r.province ?? '—'} | ${
          r.expiration_date ?? 'null'
        } | ${(r.source_url ?? 'null').slice(0, 45)}`,
      );
    }
  }
}

async function contaEsatta(
  client: ReturnType<typeof createClient>,
  tabella: string,
): Promise<number | string> {
  const { count, error } = await client.from(tabella).select('*', { count: 'exact', head: true });
  if (error) return `errore: ${error.message}`;
  return count ?? 0;
}

async function main(): Promise<void> {
  // ---- 1) Chiave ANON (come il browser).
  if (!URL_ || !ANON) {
    console.log('\n✗ ANON: VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY mancanti → il client è null → sezione SEMPRE nascosta.');
    return;
  }
  const sbAnon = createClient(URL_, ANON);

  console.log('\n=== CHIAVE ANON (browser) ===');
  console.log(`  conteggio totale interpelli: ${await contaEsatta(sbAnon, 'interpelli')}`);
  console.log(`  conteggio totale notices   : ${await contaEsatta(sbAnon, 'notices')}`);

  const { data: datiAnon, error: errAnon } = await sbAnon
    .from('interpelli')
    .select(SELECT_COMPONENTE)
    .order('created_at', { ascending: false })
    .limit(500);
  if (errAnon) {
    console.log(`  ✗ ERRORE query: ${errAnon.message} (code: ${errAnon.code ?? '—'})`);
    console.log('    → il componente logga l\'errore e mantiene righe=[] → SEZIONE NASCOSTA.');
  } else {
    riepilogo('ANON — interpelli', (datiAnon ?? []) as Riga[]);
  }

  // ---- 2) Chiave service_role (server) per confronto (RLS o dati diversi).
  if (SERVICE) {
    console.log('\n=== CHIAVE service_role (server) ===');
    const sbService = createClient(URL_, SERVICE);
    console.log(`  conteggio totale interpelli: ${await contaEsatta(sbService, 'interpelli')}`);
    console.log(`  conteggio totale notices   : ${await contaEsatta(sbService, 'notices')}`);

    const { data: datiService, error: errService } = await sbService
      .from('interpelli')
      .select(SELECT_COMPONENTE)
      .order('created_at', { ascending: false })
      .limit(500);
    if (errService) {
      console.log(`  ✗ ERRORE query: ${errService.message}`);
    } else {
      riepilogo('service_role — interpelli', (datiService ?? []) as Riga[]);
    }
  } else {
    console.log('\n(service_role assente: confronto RLS saltato)');
  }

  // ---- 3) Relazione tra scadenza, pubblicazione e inserimento (ipotesi inversione date).
  if (SERVICE) {
    const sb = createClient(URL_, SERVICE);
    const { data, error } = await sb
      .from('interpelli')
      .select('title, created_at, published_at, expiration_date, province')
      .order('created_at', { ascending: false })
      .limit(500);
    console.log('\n=== RELAZIONE DATE (ipotesi: scadenza = data di pubblicazione) ===');
    if (error) {
      console.log(`  ✗ select published_at non disponibile: ${error.message}`);
      console.log('    (la migrazione 20260903060000_add_interpelli_published_at non è applicata?)');
    } else {
      const righe = (data ?? []) as Array<Riga & { published_at?: string | null }>;
      const giorno = (v?: string | null) => (v ? v.slice(0, 10) : null);
      const conPub = righe.filter((r) => r.published_at).length;
      const scadUgualePub = righe.filter(
        (r) => r.published_at && r.expiration_date && giorno(r.published_at) === giorno(r.expiration_date),
      ).length;
      const scadUgualeIns = righe.filter(
        (r) => r.expiration_date && giorno(r.created_at) === giorno(r.expiration_date),
      ).length;
      const range = (k: 'created_at' | 'expiration_date' | 'published_at') => {
        const vals = righe.map((r) => (r as Record<string, string | null>)[k]).filter(Boolean) as string[];
        if (vals.length === 0) return 'n/d';
        const ord = [...vals].sort();
        return `${ord[0]} … ${ord[ord.length - 1]}`;
      };
      console.log(`  published_at valorizzato               : ${conPub}/${righe.length}`);
      console.log(`  expiration_date == published_at (giorno): ${scadUgualePub}/${righe.length}`);
      console.log(`  expiration_date == created_at   (giorno): ${scadUgualeIns}/${righe.length}`);
      console.log(`  range created_at   : ${range('created_at')}`);
      console.log(`  range expiration   : ${range('expiration_date')}`);
      console.log(`  range published_at : ${range('published_at')}`);
      console.log('  esempi (created_at | published_at | expiration_date):');
      for (const r of righe.slice(0, 5)) {
        console.log(`   · ${r.created_at ?? '—'} | ${r.published_at ?? 'null'} | ${r.expiration_date ?? 'null'}`);
      }
    }
  }

  console.log('\n──────────────────────────────────────────────────────────');
}

void main();
