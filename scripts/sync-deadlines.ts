/**
 * ScuoleRadar.it — Sync Scadenze verso Supabase (cron / aggiornamento manuale).
 *
 * Legge la master list locale `src/data/deadlinesFallback.json` (+ file extra
 * opzionale prodotto da cron-scraper/feed RSS ufficiali) ed esegue l'UPSERT
 * sulla tabella `school_deadlines` (migration 20260902000000).
 *
 * Uso (dalla cartella `project/`):
 *   npm run scadenze:sync                            # upsert master list
 *   npm run scadenze:sync -- --source ./extra.json   # upsert master + extra
 *   npm run scadenze:sync -- --dry-run               # solo riepilogo, no DB
 *
 * Richiede in `.env`:
 *   SUPABASE_URL                (project URL)
 *   SUPABASE_SERVICE_ROLE_KEY   (chiave service_role — MAI nel browser)
 *
 * Nota: questa pipeline è pensata per essere schedulata (es. GitHub Actions
 * su cron giornaliero) quando un modulo scraper dedicato produrrà il file
 * `--source` dalle fonti istituzionali (MIM, INVALSI, INPS, ARAN, Gazzetta
 * Ufficiale). I record remoti sovrascrivono quelli locali per id.
 */

import process from 'node:process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

interface RecordScadenza {
  id: string;
  category: string;
  title: string;
  type: 'exact' | 'window';
  date?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  phase?: string | null;
  target?: string | null;
  source?: string | null;
  officialSourceUrl?: string | null;
  active?: boolean;
}

function caricaEnv(): void {
  try {
    // Node >= 20.12: carica il file `.env` dalla cartella corrente.
    process.loadEnvFile?.();
  } catch {
    // Nessun .env: si usano le variabili già presenti nell'ambiente.
  }
}

function leggeJson(persorso: string): unknown {
  return JSON.parse(readFileSync(persorso, 'utf8')) as unknown;
}

function validaLista(dato: unknown): RecordScadenza[] {
  if (!Array.isArray(dato)) {
    throw new Error('Il file JSON deve contenere un array di record scadenza.');
  }
  return dato
    .filter((r): r is RecordScadenza => {
      const x = r as RecordScadenza | null;
      return (
        !!x &&
        typeof x.id === 'string' &&
        typeof x.title === 'string' &&
        typeof x.category === 'string' &&
        (x.type === 'exact' || x.type === 'window')
      );
    })
    .map((r) => ({ ...r, active: r.active ?? true }));
}

/** Converte i record camelCase del frontend in righe snake_case per la tabella. */
function aRigaDb(r: RecordScadenza) {
  return {
    id: r.id,
    category: r.category,
    title: r.title,
    type: r.type,
    date: r.date ?? null,
    start_date: r.startDate ?? null,
    end_date: r.endDate ?? null,
    phase: r.phase ?? null,
    target: r.target ?? null,
    source: r.source ?? null,
    official_source_url: r.officialSourceUrl ?? null,
    active: r.active ?? true,
    updated_at: new Date().toISOString(),
  };
}

async function upsert(
  client: SupabaseClient,
  righe: ReturnType<typeof aRigaDb>[],
): Promise<void> {
  const { error } = await client
    .from('school_deadlines')
    .upsert(righe, { onConflict: 'id' });
  if (error) throw error;
}

function main(): void {
  caricaEnv();

  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const sourceIdx = args.indexOf('--source');
  const fonteExtra =
    sourceIdx !== -1 && args[sourceIdx + 1] ? args[sourceIdx + 1] : null;

  const percorsoFallback = fileURLToPath(
    new URL('../src/data/deadlinesFallback.json', import.meta.url),
  );
  const master = validaLista(leggeJson(percorsoFallback));
  const extra = fonteExtra ? validaLista(leggeJson(fonteExtra)) : [];

  // Merge: i record extra/remoti vincono per id sul master locale.
  const perId = new Map<string, RecordScadenza>();
  for (const r of master) perId.set(r.id, r);
  for (const r of extra) perId.set(r.id, r);
  const righe = [...perId.values()].map(aRigaDb);

  const url = process.env.SUPABASE_URL ?? '';
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
  const configurato =
    url.trim().length > 0 &&
    serviceKey.trim().length > 0 &&
    !url.includes('xxxx') &&
    !serviceKey.includes('your-service-role-key');

  console.log(
    `📋 Scadenze: ${righe.length} record pronti (master ${master.length}` +
      `${fonteExtra ? ` + extra ${extra.length}` : ''}, dedup per id).`,
  );

  if (dryRun) {
    console.log(`🔍 Dry-run: nessun upsert eseguito (tabella school_deadlines).`);
    return;
  }
  if (!configurato) {
    console.error(
      '✗ SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY mancanti o placeholder nel file .env.',
    );
    process.exitCode = 1;
    return;
  }

  const client = createClient(url, serviceKey);
  await upsert(client, righe);
  console.log(`✓ Upsert completato su Supabase (school_deadlines).`);
}

await main();
