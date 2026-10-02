/**
 * ScuoleRadar.it — Dipartimento Radar · DIAGNOSTICA della bacheca «Radar Live».
 *
 * Risponde alla domanda «perché il tabellone mostra quello che mostra?» sul
 * GREZZO della tabella `interpelli` (non filtrato dal prodotto): quante righe
 * hanno una fonte, quante una scadenza, quante la scadenza è passata, e che
 * relazione c'è fra `created_at`, `published_at` e `expiration_date`.
 * Confronta la chiave ANON (browser) con la service_role (server/RLS) e legge
 * anche la tabella legacy `notices`.
 *
 * LEGGE A PAGINE, come il prodotto: una lettura singola si fermerebbe al
 * `max-rows` del server e la diagnosi erediterebbe **proprio** il troncamento
 * che serve a studiare (numeri più piccoli della realtà, e diversi a ogni
 * cambio di `max-rows`). Vive DENTRO il dipartimento, accanto ai moduli che
 * diagnostica, così usa l'unico lettore a pagine (`letturaBoard.ts`) senza
 * scavalcare l'`index.ts` del dipartimento (gate `E-DOM`).
 *
 * NON è un test di catena: parla col database vero, quindi resta manuale.
 *
 * Uso: npm run board:diag
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import process from 'node:process';
import { leggiTutteLePagine, type LetturaBoard } from '../letturaBoard.ts';

try {
  process.loadEnvFile();
} catch {
  /* nessun .env: uso l'ambiente di sistema */
}

const URL_ = process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL ?? '';
const ANON = process.env.VITE_SUPABASE_ANON_KEY ?? '';
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
const VENTIQUATTRO_ORE = 86_400_000;

/** Le stesse colonne della query di prodotto, più `id` (chiave della paginazione). */
const SELECT_DIAGNOSI =
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

/**
 * Legge TUTTA la tabella a pagine (stessa disciplina del tabellone): ordina per
 * `created_at` decrescente e chiude con `id`, senza il quale la paginazione può
 * ripetere o saltare righe.
 */
async function leggiGrezzo<T extends { id?: string }>(
  client: SupabaseClient,
  colonne: string,
  attese: number | null,
): Promise<LetturaBoard<T>> {
  return leggiTutteLePagine<T>({
    attese,
    chiave: (riga) => String(riga.id ?? ''),
    chiediPagina: async (da, a) => {
      const { data, error } = await client
        .from('interpelli')
        .select(colonne)
        .order('created_at', { ascending: false })
        .order('id', { ascending: false })
        .range(da, a);
      return { data: (data ?? null) as T[] | null, error };
    },
  });
}

function riepilogo(etichetta: string, lettura: LetturaBoard<Riga>): void {
  const righe = lettura.righe;
  const ora = Date.now();
  const conFonte = righe.filter((r) => Boolean((r.source_url ?? '').trim()));
  const senzaFonte = righe.filter((r) => !(r.source_url ?? '').trim());
  const scadenzaNulla = righe.filter((r) => !r.expiration_date);
  const scadenzaFutura = righe.filter(
    (r) => r.expiration_date && new Date(r.expiration_date).getTime() >= ora - VENTIQUATTRO_ORE,
  );
  const scadenzaPassata = righe.filter(
    (r) => r.expiration_date && new Date(r.expiration_date).getTime() < ora - VENTIQUATTRO_ORE,
  );
  // Filtro ESATTO del prodotto (source_url + scadenza non passata):
  const attive = righe.filter(
    (r) =>
      Boolean((r.source_url ?? '').trim()) &&
      (!r.expiration_date || new Date(r.expiration_date).getTime() >= ora - VENTIQUATTRO_ORE),
  );

  console.log(`\n— ${etichetta} —`);
  console.log(`  righe lette (a pagine)       : ${righe.length} in ${lettura.pagineLette} pagine`);
  console.log(`  lettura esaustiva             : ${lettura.esaustiva ? 'sì' : 'NO'}`);
  if (lettura.duplicati > 0) console.log(`  righe scartate come doppioni : ${lettura.duplicati}`);
  if (lettura.errore) console.log(`  errore di lettura            : ${lettura.errore}`);
  console.log(`  con source_url valorizzato   : ${conFonte.length}`);
  console.log(`  senza source_url             : ${senzaFonte.length}`);
  console.log(`  scadenza nulla               : ${scadenzaNulla.length}`);
  console.log(`  scadenza futura (>= −24h)    : ${scadenzaFutura.length}`);
  console.log(`  scadenza passata (< −24h)    : ${scadenzaPassata.length}`);
  console.log(
    `  >>> MOSTRATE dal componente   : ${attive.length} ${
      attive.length === 0 ? '→ SEZIONE NASCOSTA (nessuna riga presentabile)' : '→ SEZIONE VISIBILE'
    }`,
  );

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
  client: SupabaseClient,
  tabella: string,
): Promise<number | string> {
  const { count, error } = await client.from(tabella).select('*', { count: 'exact', head: true });
  if (error) return `errore: ${error.message}`;
  return count ?? 0;
}

/** Il conteggio serve da `attese` alla lettura a pagine; se è fallito, nessuna attesa. */
function atteseDa(conteggio: number | string): number | null {
  return typeof conteggio === 'number' && conteggio > 0 ? conteggio : null;
}

async function main(): Promise<void> {
  // ---- 1) Chiave ANON (come il browser).
  if (!URL_ || !ANON) {
    console.log(
      '\n✗ ANON: VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY mancanti → il client è null → sezione SEMPRE nascosta.',
    );
    return;
  }
  const sbAnon = createClient(URL_, ANON);

  console.log('\n=== CHIAVE ANON (browser) ===');
  const contaAnonInterpelli = await contaEsatta(sbAnon, 'interpelli');
  console.log(`  conteggio totale interpelli: ${contaAnonInterpelli}`);
  console.log(`  conteggio totale notices   : ${await contaEsatta(sbAnon, 'notices')}`);

  const letturaAnon = await leggiGrezzo<Riga>(sbAnon, SELECT_DIAGNOSI, atteseDa(contaAnonInterpelli));
  riepilogo('ANON — interpelli', letturaAnon);
  if (letturaAnon.errore) {
    console.log(`  → lettura ANON fermata: ${letturaAnon.errore} (RLS o colonna non leggibile).`);
    console.log("    il componente logga l'errore: senza righe → SEZIONE NASCOSTA.");
  }

  // ---- 2) Chiave service_role (server) per confronto (RLS o dati diversi).
  if (SERVICE) {
    console.log('\n=== CHIAVE service_role (server) ===');
    const sbService = createClient(URL_, SERVICE);
    const contaServiceInterpelli = await contaEsatta(sbService, 'interpelli');
    console.log(`  conteggio totale interpelli: ${contaServiceInterpelli}`);
    console.log(`  conteggio totale notices   : ${await contaEsatta(sbService, 'notices')}`);

    const letturaService = await leggiGrezzo<Riga>(
      sbService,
      SELECT_DIAGNOSI,
      atteseDa(contaServiceInterpelli),
    );
    riepilogo('service_role — interpelli', letturaService);
    if (letturaService.errore) console.log(`  ✗ lettura interrotta: ${letturaService.errore}`);
  } else {
    console.log('\n(service_role assente: confronto RLS saltato)');
  }

  // ---- 3) Relazione tra scadenza, pubblicazione e inserimento (ipotesi inversione date).
  if (SERVICE) {
    const sb = createClient(URL_, SERVICE);
    const letturaDate = await leggiGrezzo<Riga & { published_at?: string | null }>(
      sb,
      'id, title, created_at, published_at, expiration_date, province',
      atteseDa(await contaEsatta(sb, 'interpelli')),
    );
    console.log('\n=== RELAZIONE DATE (ipotesi: scadenza = data di pubblicazione) ===');
    if (letturaDate.errore) {
      console.log(`  ✗ select published_at non disponibile: ${letturaDate.errore}`);
      console.log('    (la migrazione 20260903060000_add_interpelli_published_at non è applicata?)');
    } else {
      const righe = letturaDate.righe;
      if (!letturaDate.esaustiva) {
        console.log('  ⚠ lettura non esaustiva (guardia anti-anello): i conteggi sotto sono un minimo.');
      }
      console.log(`  righe lette (a pagine)                 : ${righe.length} in ${letturaDate.pagineLette} pagine`);
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
