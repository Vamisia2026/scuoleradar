/**
 * TEST — Matching Engine NATIVO: RPC `match_interpelli` + fallback PostgREST.
 * ----------------------------------------------------------------------------
 * Due garanzie, una guardia:
 *   1. **Contratto SQL** della migrazione `..._add_rpc_match_interpelli.sql`:
 *      funzione `security definer` con `search_path` blindato, parametri nominali,
 *      overlap `&&` sugli array (indice GIN), confronto TOLLERANTE dei formati,
 *      ramo SOSTEGNO esplicito, «attivo» = senza scadenza o non scaduto, permessi
 *      di lettura;
 *   2. **Client** (`searchInterpelli`): usa la RPC per prima, con province
 *      normalizzate/deduplicate, varianti di formato delle classi, sostegno sempre
 *      incluso, limite inoltrato; se la RPC non è disponibile ricade sulla query
 *      PostgREST EQUIVALENTE — il feed non si svuota mai per una migrazione
 *      mancante.
 *
 * Esecuzione: npm run test:match-rpc
 */
import { readFileSync } from 'node:fs';
import {
  RPC_MATCH_INTERPELLI,
  searchInterpelli,
  variantiClasseCodice,
} from '../src/lib/matchingEngine.ts';

declare const process: { exitCode?: number };

let falliti = 0;
function check(descrizione: string, atteso: unknown, ottenuto: unknown): void {
  const ok = JSON.stringify(atteso) === JSON.stringify(ottenuto);
  if (!ok) falliti += 1;
  console.log(
    `${ok ? '✓' : '✗'} ${descrizione}` +
      (ok ? '' : `\n      atteso: ${JSON.stringify(atteso)}\n      ottenuto: ${JSON.stringify(ottenuto)}`),
  );
}

const SQL = readFileSync(
  new URL('../supabase/migrations/20261004110000_add_rpc_match_interpelli.sql', import.meta.url),
  'utf8',
);

console.log('══════════════════════════════════════════════════════════');
console.log('🧪 MATCHING ENGINE NATIVO (RPC match_interpelli)');
console.log('══════════════════════════════════════════════════════════');

console.log('\n— 1. Contratto SQL della RPC —');
check(
  'definizione idempotente della funzione',
  true,
  /create or replace function public\.match_interpelli/.test(SQL),
);
check(
  'parametri nominali p_province/p_classi/p_sostegno/p_limit',
  true,
  ['p_province text[]', 'p_classi text[]', 'p_sostegno boolean', 'p_limit integer'].every((p) =>
    SQL.includes(p),
  ),
);
check('security definer (nessuna dipendenza dal chiamante)', true, /security definer/.test(SQL));
check('search_path blindato su public', true, /set search_path = public/.test(SQL));
check('funzione stabile (sola lettura)', true, /\bstable\b/.test(SQL));
check('filtro province su array (`= any`)', true, /= any \(f\.province\)/.test(SQL));
check('OVERLAP `&&` sugli array di classi (indice GIN)', true, /class_codes[\s\S]{0,90}&&/.test(SQL));
check(
  'forma canonica dei codici nel database (classe_chiave)',
  true,
  /create or replace function public\.classe_chiave/.test(SQL) && /classe_chiave\(cc\) = any/.test(SQL),
);
check(
  'ramo SOSTEGNO esplicito sui codici AD…',
  true,
  /\^AD\(\[A-Z\]\{2,3\}\|\[0-9\]\{2\}\)/.test(SQL),
);
check('ramo SOSTEGNO anche da titolo/materia', true, /sostegn\|adaa\|adee\|admm\|adss\|ad24/.test(SQL));
check(
  '«attivo» = senza scadenza oppure non scaduto',
  true,
  /expiration_date is null or i\.expiration_date >= current_date/.test(SQL),
);
check('ordinamento per urgenza', true, /order by i\.expiration_date asc nulls last/.test(SQL));
check('limite sempre valido (mai 0, mai illimitato)', true, /limit greatest\(1, least\(/.test(SQL));
check(
  'execute concesso a anon/authenticated/service_role',
  true,
  /grant execute on function public\.match_interpelli/.test(SQL) &&
    /to anon, authenticated, service_role/.test(SQL),
);
check('la lettura resta sui dati pubblici (RLS della tabella)', true, /only quella tabella|dati pubblici/.test(SQL));

console.log('\n— 2. Client: RPC per prima, fallback PostgREST equivalente —');

interface Chiamata {
  nome: string;
  args: Record<string, unknown>;
}

/** Client Supabase finto: registra RPC e filtri, così il test resta senza rete. */
function clientFinto(opts: {
  erroreRpc?: { message: string } | null;
  erroreQuery?: { message: string } | null;
  righe?: unknown[];
}) {
  const chiamate: { rpc: Chiamata[]; filtri: string[] } = { rpc: [], filtri: [] };
  const righe = opts.righe ?? [];
  const builder = {
    in(colonna: string) {
      chiamate.filtri.push(`in:${colonna}`);
      return builder;
    },
    overlaps(colonna: string) {
      chiamate.filtri.push(`overlaps:${colonna}`);
      return builder;
    },
    or(espressione: string) {
      chiamate.filtri.push(`or:${espressione}`);
      return builder;
    },
    order(colonna: string) {
      chiamate.filtri.push(`order:${colonna}`);
      return builder;
    },
    limit(n: number) {
      chiamate.filtri.push(`limit:${n}`);
      return Promise.resolve({ data: righe, error: opts.erroreQuery ?? null });
    },
  };
  return {
    chiamate,
    rpc: async (nome: string, args: Record<string, unknown>) => {
      chiamate.rpc.push({ nome, args });
      return opts.erroreRpc ? { data: null, error: opts.erroreRpc } : { data: righe, error: null };
    },
    from: () => ({ select: () => builder }),
  };
}

type ClientLike = Parameters<typeof searchInterpelli>[0];
const comeClient = (finto: ReturnType<typeof clientFinto>): ClientLike =>
  finto as unknown as ClientLike;

/** Riga di `interpelli` di prova (nessuna rete: il DB non viene mai toccato). */
const rigaDb = {
  id: 'r1',
  hash_id: 'h1',
  title: 'Interpello supplenza A-022',
  province: 'AT',
  class_codes: ['A-022'],
  school_name: null,
  school_code: null,
  source_url: 'https://www.usp-asti.gov.it/interpelli/1',
  expiration_date: '2099-12-31',
  created_at: '2026-10-04T00:00:00.000Z',
  contact_email: null,
  materia: null,
  stato_arricchimento: 'parziale',
};

// (a) RPC disponibile: nessun filtro PostgREST, argomenti corretti.
const conRpc = clientFinto({ righe: [rigaDb] });
const esitoRpc = await searchInterpelli(comeClient(conRpc), {
  province: ['at', 'TO', 'AT'],
  classi: ['A-22'],
  limit: 7,
});
const chiamata = conRpc.chiamate.rpc[0];
check('nome esportato coerente con la migrazione', 'match_interpelli', RPC_MATCH_INTERPELLI);
check('RPC chiamata una volta', 1, conRpc.chiamate.rpc.length);
check('nome della RPC', 'match_interpelli', chiamata?.nome ?? null);
check('province normalizzate e deduplicate', ['AT', 'TO'], chiamata?.args.p_province);
check(
  'classi passate con TUTTE le varianti di formato',
  ['A-22', 'A-022', 'A22', 'A022'],
  chiamata?.args.p_classi,
);
check('area sostegno sempre inclusa nella query', true, chiamata?.args.p_sostegno);
check('limite inoltrato alla RPC', 7, chiamata?.args.p_limit);
check('righe restituite dalla RPC', 1, esitoRpc?.length ?? 0);
check('nessuna query PostgREST quando la RPC risponde', [], conRpc.chiamate.filtri);

// (b) RPC assente (migrazione non applicata): fallback PostgREST equivalente.
const senzaRpc = clientFinto({
  erroreRpc: {
    message:
      'Could not find the function public.match_interpelli(p_province, p_classi, p_sostegno, p_limit) in the schema cache',
  },
  righe: [rigaDb],
});
const esitoFallback = await searchInterpelli(comeClient(senzaRpc), {
  province: ['AT'],
  classi: ['A-22'],
  limit: 5,
});
check('la RPC è stata comunque tentata', 1, senzaRpc.chiamate.rpc.length);
check(
  'fallback PostgREST con gli stessi filtri',
  ['in:province', 'overlaps:class_codes', 'order:expiration_date', 'limit:5'],
  senzaRpc.chiamate.filtri.filter((f) => !f.startsWith('or:')),
);
check(
  'il fallback tiene solo gli avvisi attivi (senza scadenza o non scaduti)',
  true,
  // Dal §26.53 il ramo «senza scadenza» porta anche la FINESTRA dei 60 giorni
  // sulla pubblicazione (`created_at`): la stessa regola di `eAvvisoVivo`.
  senzaRpc.chiamate.filtri.some(
    (f) =>
      f.startsWith('or:expiration_date.gte.') &&
      f.includes(',and(expiration_date.is.null,created_at.gte.'),
  ),
);
check('righe servite dal fallback (il feed non si svuota)', 1, esitoFallback?.length ?? 0);


// (c) Nessuna provincia / nessuna classe: nessun filtro inutile.
const senzaFiltri = clientFinto({ righe: [] });
await searchInterpelli(comeClient(senzaFiltri), {});
check(
  'nessuna selezione → argomenti nulli (nessun filtro inutile)',
  [null, null],
  [senzaFiltri.chiamate.rpc[0]?.args.p_province, senzaFiltri.chiamate.rpc[0]?.args.p_classi],
);

// (d) Supabase non configurato: nessuna query, nessun errore.
check('Supabase non configurato → nessuna query', null, await searchInterpelli(null, {}));

// (e) Errore anche nel fallback: la funzione dichiara il fallimento (null).
const tuttoRotto = clientFinto({
  erroreRpc: { message: 'permission denied for function match_interpelli' },
  erroreQuery: { message: 'permission denied for table interpelli' },
});
check('RPC e fallback in errore → null (il chiamante decide)', null, await searchInterpelli(comeClient(tuttoRotto), {}));

console.log('\n— 3. Varianti di formato delle classi (una sola regola) —');
check('«a 22» copre A-22/A-022/A22/A022', ['A-22', 'A-022', 'A22', 'A022'], variantiClasseCodice('a 22'));
check('codici a 4 lettere (sostegno/ATA) restano invariati', ['ADEE'], variantiClasseCodice('ADEE'));
check('codice vuoto → nessuna variante', [], variantiClasseCodice('  '));

console.log('\n══════════════════════════════════════════════════════════');
if (falliti === 0) console.log('✅ MATCHING ENGINE NATIVO: RPC e fallback coerenti');
else {
  console.log(`❌ MATCHING ENGINE NATIVO: ${falliti} controllo/i fallito/i`);
  process.exitCode = 1;
}
console.log('══════════════════════════════════════════════════════════');

