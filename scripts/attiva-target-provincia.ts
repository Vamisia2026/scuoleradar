/**
 * scripts/attiva-target-provincia.ts
 *
 * Promuove i target di UNA provincia da `pending` ad `active_crawler`.
 *
 * PERCHÉ ESISTE: `npm run targets:whitelist:attiva` promuove solo i target della
 * WHITELIST (hub USR/USP + aggregatori) e lo fa su tutto il Paese. I target
 * comunali/scolastici entrati in coda dall'anagrafica (`import-schools-local.ts`)
 * restano `pending`, cioè discovery-only: `scripts/table-reporter.ts` legge
 * `active_crawler` e quindi non li visita mai — una provincia può avere 60
 * target in coda e un solo portale davvero letto. Questo script fa UNA cosa:
 * porta in `active_crawler` i target di una provincia, senza toccare le altre.
 *
 * COMPORTAMENTO
 *  · dry-run per default: elenca i target che promuoverebbe e i domini ripetuti,
 *    senza scrivere nulla;
 *  · `--apply`: scrive (a lotti di 100, via `lib/codaTargets.ts`);
 *  · nessun `--riattiva` implicito: gli stati `disabled`, `error_internal`,
 *    `empty_view` NON vengono toccati (una disattivazione deliberata resta tale).
 *
 * Uso:
 *   npx tsx scripts/attiva-target-provincia.ts --provincia=AT              (dry-run)
 *   npx tsx scripts/attiva-target-provincia.ts --provincia=AT --apply
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import {
  STATO_ATTIVO,
  STATO_PENDING,
  aggiornaStato,
  type RigaCoda,
} from './lib/codaTargets.ts';

dotenv.config();

/** `--apply` scrive; senza, l'utile è solo la misura. */
const APPLY = process.argv.includes('--apply');

/** Codice provincia (`--provincia=AT`, `--province=AT` o `PROVINCIA=AT`). */
const PROVINCIA = (() => {
  const arg = process.argv.find(
    (a) => a.startsWith('--provincia=') || a.startsWith('--province='),
  );
  return (arg?.split('=')[1] ?? process.env.PROVINCIA ?? '').trim().toUpperCase();
})();

if (!/^[A-Z]{2}$/.test(PROVINCIA)) {
  console.error(
    '[attiva-provincia] Serve il codice di UNA provincia: --provincia=AT ' +
      '(due lettere, come in `profiles.province`).',
  );
  process.exit(1);
}

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
/** `service_role` obbligatoria: `discovered_links` è RLS-locked al client anon. */
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!supabaseUrl || !supabaseKey) {
  console.error(
    '[attiva-provincia] Credenziali Supabase mancanti: servono SUPABASE_URL e ' +
      'SUPABASE_SERVICE_ROLE_KEY nel file .env.',
  );
  process.exit(1);
}

const supabase: SupabaseClient = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

/** Target `pending` della provincia, a pagine da 1.000 (tetto di PostgREST). */
async function targetPending(): Promise<RigaCoda[]> {
  const out: RigaCoda[] = [];
  const PASSO = 1_000;
  for (let da = 0; ; da += PASSO) {
    const { data, error } = await supabase
      .from('discovered_links')
      .select('id, url, status, region, province, domain')
      .eq('province', PROVINCIA)
      .eq('status', STATO_PENDING)
      .order('url', { ascending: true })
      .range(da, da + PASSO - 1);
    if (error) throw new Error(`Lettura discovered_links: ${error.message}`);
    const lotto = (data ?? []) as RigaCoda[];
    out.push(...lotto);
    if (lotto.length < PASSO) break;
  }
  return out;
}

async function main(): Promise<void> {
  console.log(
    `[attiva-provincia] Provincia ${PROVINCIA} · da «${STATO_PENDING}» a ` +
      `«${STATO_ATTIVO}» · modalità ${APPLY ? 'APPLY' : 'dry-run'}`,
  );

  const righe = await targetPending();
  if (righe.length === 0) {
    console.log(
      `[attiva-provincia] Nessun target «${STATO_PENDING}» in provincia ${PROVINCIA}: ` +
        'coda già allineata (o provincia senza semi).',
    );
    return;
  }

  const perDominio = new Map<string, number>();
  for (const riga of righe) {
    const dominio = (riga.domain ?? 'dominio-assente').toLowerCase();
    perDominio.set(dominio, (perDominio.get(dominio) ?? 0) + 1);
  }

  console.log(
    `[attiva-provincia] ${righe.length} target «${STATO_PENDING}» su ` +
      `${perDominio.size} domini.`,
  );
  for (const riga of righe) console.log(`  · ${riga.url}`);

  const ripetuti = [...perDominio.entries()]
    .filter(([, n]) => n > 1)
    .sort((a, b) => b[1] - a[1]);
  if (ripetuti.length > 0) {
    console.log(
      '[attiva-provincia] Domini con più target (verranno letti tutti, uno per target):',
    );
    for (const [dominio, n] of ripetuti) console.log(`  · ${dominio} → ${n}`);
  }

  if (!APPLY) {
    console.log(
      '[attiva-provincia] Dry-run: nessuna scrittura. Rilancia con --apply per ' +
        `promuovere i ${righe.length} target ad «${STATO_ATTIVO}».`,
    );
    return;
  }

  const errori = await aggiornaStato(
    supabase,
    righe.map((riga) => riga.id),
    STATO_ATTIVO,
    `attivazione ${PROVINCIA}`,
  );
  if (errori > 0) {
    console.error(`[attiva-provincia] ${errori} lotti NON aggiornati: la coda è incompleta.`);
    process.exitCode = 1;
    return;
  }
  console.log(
    `[attiva-provincia] ${righe.length} target → «${STATO_ATTIVO}». ` +
      `Ora \`npx tsx scripts/table-reporter.ts --province=${PROVINCIA}\` li legge.`,
  );
}

main().catch((err) => {
  console.error('[attiva-provincia] Errore:', err);
  process.exit(1);
});
