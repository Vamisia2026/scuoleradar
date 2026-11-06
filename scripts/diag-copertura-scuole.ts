/**
 * ScuoleRadar.it — COPERTURA DI UNA PROVINCIA, SCUOLA PER SCUOLA (§26.145).
 *
 * La domanda (05/11/2026): «ad Asti le scuole che conosciamo producono avvisi, o le
 * stiamo solo sfiorando?». Un totale nazionale non risponde: serve, per UNA provincia,
 * l'incrocio fra `interpelli` (ciò che abbiamo), `discovered_links` (ciò che il crawler
 * ha in mano) e `source_health` (ciò che è isolato). Senza, «zero avvisi» vuol dire tre
 * cose diversissime: albo vuoto, albo mai letto, albo letto e scartato.
 *
 * SOLA LETTURA e letture PAGINATE (PostgREST tronca a 1.000 righe: un conteggio
 * troncato sembra un dato). Il nome della scuola non è una chiave — il confronto è per
 * sottostringa normalizzata, quindi è una diagnosi, e il report lo dice.
 *
 * Uso:
 *   npx tsx scripts/diag-copertura-scuole.ts                  (Asti, scuole della direttiva)
 *   npx tsx scripts/diag-copertura-scuole.ts --provincia=AT --top=20
 *   npx tsx scripts/diag-copertura-scuole.ts --scuole=Artom,Penna --json
 */
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  { auth: { persistSession: false, autoRefreshToken: false } },
);

const argomenti = process.argv.slice(2);
const JSON_OUT = argomenti.includes('--json');
const TOP = Number(argomenti.find((a) => a.startsWith('--top='))?.split('=')[1] ?? 12) || 12;
/** Codice provincia: due lettere come in `profiles.province` (default Asti). */
const PROVINCIA = (argomenti.find((a) => a.startsWith('--provincia='))?.split('=')[1] ?? 'AT')
  .trim()
  .toUpperCase();
/** Le scuole nominate nella direttiva: il default rifà la diagnosi in un comando. */
const SCUOLE = (
  argomenti.find((a) => a.startsWith('--scuole='))?.split('=')[1] ??
  'Artom,Monti,Alfieri,Castigliano,Penna'
)
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

/** Nome confrontabile: minuscole, senza accenti, spazi compattati. */
const norm = (s: string | null | undefined): string =>
  (s ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();

const oggi = new Date().toISOString().slice(0, 10);
const hostDi = (url: string | null | undefined): string => {
  try {
    return new URL(url ?? '').host.replace(/^www\./, '');
  } catch {
    return '(non-URL)';
  }
};
const giorniFa = (iso: string | null): string => {
  if (!iso) return 'mai';
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return 'mai';
  const g = Math.floor((Date.now() - t) / 86_400_000);
  return g <= 0 ? 'oggi' : g === 1 ? 'ieri' : `${g}g fa`;
};

interface Avviso {
  school_name: string | null;
  province: string | null;
  source_url: string | null;
  created_at: string | null;
  expiration_date: string | null;
}
interface Target {
  url: string;
  domain: string | null;
  status: string;
  last_scanned_at: string | null;
}
interface Fonte {
  source_url: string;
  is_quarantined: boolean | null;
  consecutive_failures: number | null;
  last_run_at: string | null;
  last_error: string | null;
}


/** Lettura paginata: una sola forma per tutte le tabelle (PostgREST tronca a 1.000). */
async function leggiPaginato<T>(tabella: string, colonne: string, ordina: string): Promise<T[]> {
  const out: T[] = [];
  for (let da = 0; ; da += 1000) {
    const { data, error } = await supabase
      .from(tabella)
      .select(colonne)
      .eq('province', PROVINCIA)
      .order(ordina, { ascending: true })
      .range(da, da + 999);
    if (error) throw new Error(`${tabella} (${PROVINCIA}): ${error.message}`);
    const lotto = (data ?? []) as unknown as T[];
    out.push(...lotto);
    if (lotto.length < 1000) break;
  }
  return out;
}

/** Tutti gli avvisi della provincia. */
const leggiAvvisi = () =>
  leggiPaginato<Avviso>('interpelli', 'school_name, province, source_url, created_at, expiration_date', 'id');

/** Tutti i target della provincia (ogni stato: anche un `not_found` è una risposta). */
const leggiTarget = () =>
  leggiPaginato<Target>('discovered_links', 'url, domain, status, last_scanned_at', 'url');

/** Classifica valori → conteggio, dal più frequente. */
function classifica(valori: Array<string | null>, top = TOP): Array<[string, number]> {
  const mappa = new Map<string, number>();
  for (const v of valori) {
    const k = v ?? '(nessuno)';
    mappa.set(k, (mappa.get(k) ?? 0) + 1);
  }
  return [...mappa.entries()].sort((a, b) => b[1] - a[1]).slice(0, top);
}

async function main(): Promise<void> {
  const avvisi = await leggiAvvisi();
  const target = await leggiTarget();
  /** «Vivo» = termine dichiarato e non ancora passato (stessa regola della bacheca, §26.71). */
  const vivi = avvisi.filter((a) => (a.expiration_date ?? '') >= oggi);

  // `source_health` è la memoria delle fonti: si legge solo per gli host della provincia.
  const hostProvincia = new Set(target.map((t) => t.domain ?? hostDi(t.url)));
  for (const a of avvisi) hostProvincia.add(hostDi(a.source_url));
  const { data: salute } = await supabase
    .from('source_health')
    .select('source_url, is_quarantined, consecutive_failures, last_run_at, last_error')
    .limit(5000);
  const fonti = ((salute ?? []) as unknown as Fonte[]).filter((f) =>
    hostProvincia.has(hostDi(f.source_url)),
  );

  const perScuola = SCUOLE.map((nome) => {
    const chiave = norm(nome);
    const suoi = avvisi.filter((a) => norm(a.school_name).includes(chiave));
    const suoiVivi = vivi.filter((a) => norm(a.school_name).includes(chiave));
    const suoiTarget = target.filter(
      (t) => norm(t.domain ?? '').includes(chiave) || norm(t.url).includes(chiave),
    );
    return {
      scuola: nome,
      avvisi: suoi.length,
      vivi: suoiVivi.length,
      ultimo: suoiVivi.map((a) => a.created_at ?? '').sort().at(-1) || null,
      host: classifica(
        suoi.map((a) => hostDi(a.source_url)),
        3,
      ).map(([h]) => h),
      target: suoiTarget.length,
      stati: Object.fromEntries(classifica(suoiTarget.map((t) => t.status), 6)),
      ultimaLettura: suoiTarget.map((t) => t.last_scanned_at).filter(Boolean).sort().at(-1) ?? null,
    };
  });

  const report = {
    provincia: PROVINCIA,
    oggi,
    avvisi: { totali: avvisi.length, vivi: vivi.length },
    target: {
      totali: target.length,
      perStato: Object.fromEntries(classifica(target.map((t) => t.status), 12)),
      hostDistinti: new Set(target.map((t) => t.domain ?? hostDi(t.url))).size,
      maiLetti: target.filter((t) => !t.last_scanned_at).length,
    },
    fonti: {
      lette: fonti.length,
      inQuarantena: fonti.filter((f) => f.is_quarantined === true).length,
      inGuasto: fonti.filter((f) => (f.consecutive_failures ?? 0) > 0).length,
      elenco: fonti
        .filter((f) => f.is_quarantined === true || (f.consecutive_failures ?? 0) > 0)
        .slice(0, TOP)
        .map((f) => ({
          host: hostDi(f.source_url),
          quarantena: f.is_quarantined === true,
          guasti: f.consecutive_failures ?? 0,
          ultimoGiro: f.last_run_at,
          errore: (f.last_error ?? '').slice(0, 90),
        })),
    },
    topHostPerAvvisiVivi: classifica(vivi.map((a) => hostDi(a.source_url))),
    scuole: perScuola,
  };

  if (JSON_OUT) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }

  const sezione = (titolo: string, voci: Array<[string, number]>) => {
    console.log(`\n${titolo}`);
    for (const [chiave, n] of voci) console.log(`  ${String(n).padStart(6)}  ${chiave}`);
  };

  console.log(`\n=== COPERTURA ${PROVINCIA} — ${oggi} ===`);
  console.log(`Avvisi in archivio ${report.avvisi.totali} · vivi ${report.avvisi.vivi}`);
  console.log(
    `Target in coda ${report.target.totali} · host distinti ${report.target.hostDistinti} · ` +
      `mai letti ${report.target.maiLetti}`,
  );
  sezione('TARGET PER STATO', Object.entries(report.target.perStato));
  sezione(`HOST PER AVVISI VIVI (top ${TOP})`, report.topHostPerAvvisiVivi);

  console.log('\nSCUOLE DELLA DIRETTIVA (confronto per sottostringa nel nome)');
  for (const s of perScuola) {
    const stato = Object.entries(s.stati)
      .map(([k, n]) => `${k} ${n}`)
      .join(' · ');
    console.log(
      `  ${s.scuola.padEnd(12)} vivi ${String(s.vivi).padStart(3)}/${String(s.avvisi).padEnd(3)}` +
        ` · ultimo ${s.ultimo ? s.ultimo.slice(0, 10) : '—'} · target ${s.target}` +
        ` (${stato || 'nessuno'}) · letto ${giorniFa(s.ultimaLettura)}` +
        ` · host ${s.host.join(', ') || '—'}`,
    );
  }

  console.log(
    `\nFONTI DELLA PROVINCIA: ${report.fonti.lette} note · ` +
      `${report.fonti.inQuarantena} in quarantena · ${report.fonti.inGuasto} in guasto`,
  );
  for (const f of report.fonti.elenco) {
    console.log(
      `  ${f.quarantena ? 'QUARANTENA' : `guasti ${f.guasti}`} ${f.host} — ultimo giro ` +
        `${giorniFa(f.ultimoGiro)}${f.errore ? ` · ${f.errore}` : ''}`,
    );
  }
  console.log(
    '\nDiagnosi, non contabilità: i nomi delle scuole non sono chiavi. Se una scuola ha 0 avvisi ' +
      "e 0 target il problema non è l'albo: è la scoperta (§26.125).",
  );
}

void main();

