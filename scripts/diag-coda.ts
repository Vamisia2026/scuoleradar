/**
 * ScuoleRadar.it — DIAGNOSI DELLA CODA DI SCANSIONE (`discovered_links`).
 *
 * Perché esiste: la «Linea Rossa» del pannello Admin mostra UN numero —
 * «pagine in coda» = righe `pending` — e il 31/10/2026 quel numero era **15.561**.
 * Un totale da solo non dice se la coda è lavoro vero (scuole non ancora lette)
 * o un accumulo di target morti (host non istituzionali, figli mai consumati).
 * Questo script scompone lo stesso insieme per profondità, età, host e provincia,
 * **senza scrivere nulla**: nessuna `update`, nessun claim, nessuna cancellazione.
 *
 * La lettura è PAGINATA (PostgREST tronca a 1.000 righe e un conteggio troncato
 * sembra un dato).
 *
 * Uso: `npm run diag:coda` — opzioni: `--json` (output macchina),
 * `--top=20` (righe per classifica, default 15).
 */
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { eDominioIstituzionale } from '../src/lib/dominiIstituzionali.ts';

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  { auth: { persistSession: false, autoRefreshToken: false } },
);

const argomenti = process.argv.slice(2);
const JSON_OUT = argomenti.includes('--json');
const TOP = Number(argomenti.find((a) => a.startsWith('--top='))?.split('=')[1] ?? 15) || 15;
/** `--provincia=CT` limita TUTTE le sezioni a una provincia (diagnosi di un giro mirato). */
const PROVINCIA = (argomenti.find((a) => a.startsWith('--provincia='))?.split('=')[1] ?? '')
  .trim()
  .toUpperCase();

/** Stati scritti dal motore: serve a mostrare TUTTO, non solo il `pending`. */
const STATI = [
  'pending',
  'active_crawler',
  'idle',
  'error_timeout',
  'error_internal',
  'not_found',
  'empty_view',
  'disqualified_noise',
  'parked_low_score',
  'parked_for_pdf',
  'blacklisted',
  'disabled',
];

interface RigaCoda {
  url: string;
  domain: string | null;
  province: string | null;
  depth: number | null;
  path_score: number | null;
  last_scanned_at: string | null;
  created_at: string | null;
}

async function conta(stato: string): Promise<number> {
  const { count, error } = await supabase
    .from('discovered_links')
    .select('*', { count: 'exact', head: true })
    .eq('status', stato);
  if (error) throw new Error(`discovered_links (${stato}): ${error.message}`);
  return count ?? 0;
}

/** Tutte le righe di uno stato, paginate a 1.000 (nessun troncamento silenzioso). */
async function righe(stato: string, colonne: string): Promise<RigaCoda[]> {
  const out: RigaCoda[] = [];
  for (let da = 0; ; da += 1000) {
    const { data, error } = await supabase
      .from('discovered_links')
      .select(colonne)
      .eq('status', stato)
      .order('id', { ascending: true })
      .range(da, da + 999);
    if (error) throw new Error(`discovered_links (${stato}): ${error.message}`);
    const pagina = (data ?? []) as unknown as RigaCoda[];
    out.push(...pagina);
    if (pagina.length < 1000) break;
  }
  return out;
}

const giorniFa = (iso: string | null, orologio: number): number | null => {
  if (!iso) return null;
  const t = Date.parse(iso);
  return Number.isNaN(t) ? null : Math.floor((orologio - t) / 86_400_000);
};

/** Classifica valori → conteggio, ordinata dal più frequente. */
function classifica(valori: Array<string | null>, top = TOP): Array<[string, number]> {
  const mappa = new Map<string, number>();
  for (const v of valori) {
    const chiave = v && v.trim() ? v.trim() : '(nessuno)';
    mappa.set(chiave, (mappa.get(chiave) ?? 0) + 1);
  }
  return [...mappa.entries()].sort((a, b) => b[1] - a[1]).slice(0, top);
}

const orologio = Date.now();
const perStato = Object.fromEntries(
  await Promise.all(STATI.map(async (s) => [s, await conta(s)] as const)),
);
const pending = (await righe(
  'pending',
  'url, domain, province, depth, path_score, last_scanned_at, created_at',
)).filter((r) => !PROVINCIA || (r.province ?? '').toUpperCase() === PROVINCIA);

const istituzionali = pending.filter((r) => eDominioIstituzionale(r.url));

/**
 * Righe MAI LETTE davvero: `last_scanned_at` coincide con `created_at` (entro
 * 120 s). La colonna ha un default `now()` all'inserimento, quindi da sola
 * direbbe «tutte lette» anche per un seme che nessuno ha mai aperto — è la
 * ragione per cui questa distinzione si misura qui e non si eredita dal DB.
 */
const maiLette = pending.filter((r) => {
  if (!r.last_scanned_at || !r.created_at) return true;
  return Math.abs(Date.parse(r.last_scanned_at) - Date.parse(r.created_at)) < 120_000;
});
const profondita0 = pending.filter((r) => (r.depth ?? 0) === 0);

const perProfondita = classifica(pending.map((r) => `depth ${r.depth ?? '?'}`), 10);
const perEta = classifica(
  pending.map((r) => {
    const g = giorniFa(r.created_at, orologio);
    if (g === null) return 'data illeggibile';
    if (g < 1) return 'oggi';
    if (g < 2) return 'ieri';
    if (g < 8) return '2-7 giorni';
    if (g < 31) return '8-30 giorni';
    return 'oltre 30 giorni';
  }),
  8,
);
const perUltimaLettura = classifica(
  pending.map((r) => {
    if (!r.last_scanned_at) return 'mai tentata';
    const g = giorniFa(r.last_scanned_at, orologio);
    if (g === null) return 'data illeggibile';
    if (g < 1) return 'ultime 24 ore';
    if (g < 8) return '2-7 giorni';
    return 'oltre 7 giorni';
  }),
  6,
);
const perHost = classifica(pending.map((r) => r.domain));
const perProvincia = classifica(pending.map((r) => r.province), TOP);

/** Quante righe `pending` sono nate in ciascuno degli ultimi giorni letti. */
const perGiorno = (() => {
  const mappa = new Map<string, number>();
  for (const r of pending) {
    if (!r.created_at) continue;
    const giorno = r.created_at.slice(0, 10);
    mappa.set(giorno, (mappa.get(giorno) ?? 0) + 1);
  }
  return [...mappa.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1)).slice(0, 7);
})();

const report = {
  oggi: new Date(orologio).toISOString().slice(0, 10),
  perStato,
  pending: {
    totale: pending.length,
    istituzionali: istituzionali.length,
    fuoriWhitelist: pending.length - istituzionali.length,
    hostDistinti: new Set(pending.map((r) => r.domain ?? '(nessuno)')).size,
    senzaProvincia: pending.filter((r) => !r.province).length,
    pathScoreZero: pending.filter((r) => (r.path_score ?? 0) === 0).length,
    maiLette: maiLette.length,
    semeDepth0: {
      totale: profondita0.length,
      istituzionali: profondita0.filter((r) => eDominioIstituzionale(r.url)).length,
      fuoriWhitelist: profondita0.filter((r) => !eDominioIstituzionale(r.url)).length,
      maiLette: profondita0.filter((r) => maiLette.includes(r)).length,
    },
  },
  perProfondita,
  perEta,
  perUltimaLettura,
  perHost,
  perProvincia,
  perGiorno,
};

if (JSON_OUT) {
  console.log(JSON.stringify(report, null, 2));
} else {
  const sezione = (titolo: string, voci: Array<[string, number]>) => {
    console.log(`\n${titolo}`);
    for (const [chiave, n] of voci) console.log(`  ${String(n).padStart(6)}  ${chiave}`);
  };
  console.log(`\n=== CODA DI SCANSIONE — ${report.oggi}${PROVINCIA ? ` · provincia ${PROVINCIA}` : ''} ===`);
  sezione('RIGHE PER STATO', Object.entries(perStato).sort((a, b) => b[1] - a[1]));
  const p = report.pending;
  console.log(
    `\nPENDING ${p.totale} — istituzionali ${p.istituzionali} · fuori whitelist ` +
      `${p.fuoriWhitelist} · host distinti ${p.hostDistinti}`,
  );
  console.log(
    `  senza provincia ${p.senzaProvincia} · path_score 0 ${p.pathScoreZero} · ` +
      `mai lette ${p.maiLette}`,
  );
  console.log(
    `  seme a depth 0: ${p.semeDepth0.totale} (istituzionali ${p.semeDepth0.istituzionali} · ` +
      `fuori whitelist ${p.semeDepth0.fuoriWhitelist} · mai lette ${p.semeDepth0.maiLette})`,
  );
  sezione('PER PROFONDITÀ', perProfondita);
  sezione('PER ETÀ (created_at)', perEta);
  sezione('PER ULTIMA LETTURA', perUltimaLettura);
  sezione('PER PROVINCIA', perProvincia);
  sezione(`PER HOST (top ${TOP})`, perHost);
  sezione('RIGHE NATIVE PER GIORNO (ultimi 7 letti)', perGiorno);
}

