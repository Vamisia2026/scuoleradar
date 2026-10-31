/**
 * scripts/crawl-provincia.ts
 *
 * UNA provincia, un comando: anagrafica → coda → crawler. (§26.125)
 *
 * PERCHÉ ESISTE. «Quando provo il Radar su Asti, il sistema deve interrogare i
 * target locali di Asti.» Il box «Prova il Radar» legge `interpelli` e basta: non
 * può avviare una scansione dal browser. Il comando che rende vera quella promessa
 * è questo, e fa tre cose in fila — ognuna già esistente, nessuna riscritta:
 *
 *   1. **ANAGRAFICA MIM** (`lib/scuoleMaster.scuoleDellaProvincia`): elenca gli
 *      istituti della provincia con un sito istituzionale — la lista che il deep
 *      crawl contatterà, stampata PRIMA di toccare la rete;
 *   2. **CODA** (`discovered_links`): con `--apply` promuove i target `pending`
 *      della provincia ad `active_crawler` (lo stato che `table-reporter` legge);
 *      le scuole seminate da `import-schools-local.ts` smettono così di restare in
 *      attesa per sempre. Senza `--apply` è solo la misura;
 *   3. **CRAWL** (`scripts/table-reporter.ts --province=…`): legge gli hub
 *      istituzionali della regione (l'USR che pubblica per Asti non è censito su
 *      Asti) e visita le scuole dell'elenco, stampando «SCUOLE CONTATTATE».
 *
 * Uso:
 *   npx tsx scripts/crawl-provincia.ts --province=AT            (misura + crawl)
 *   npx tsx scripts/crawl-provincia.ts --province=AT --apply    (promuove e crawla)
 *   npx tsx scripts/crawl-provincia.ts --province=AT --dry-run  (nessuna scrittura)
 *   npx tsx scripts/crawl-provincia.ts --province=AT --max-scuole=12  (visura parziale)
 *
 * Il tetto delle scuole è `tutte` per default (§26.127): la provincia richiesta si
 * legge al 100% dell'anagrafica MIM, non su un campione.
 */

import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import * as dotenv from 'dotenv';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { STATO_ATTIVO, STATO_PENDING, aggiornaStato, type RigaCoda } from './lib/codaTargets.ts';
import { TUTTE_LE_SCUOLE, type TettoScuoleProvincia } from '../src/lib/mvpPerimetro.ts';
import { provinciaDaCodice } from '../src/lib/scanTargets.ts';
import { regioneDiProvincia } from '../src/lib/ambitoProvincia.ts';
import { caricaAnagrafica } from '../src/lib/anagraficaIndice.ts';
import { scuoleDellaProvincia } from '../src/lib/scuoleProvincia.ts';

dotenv.config();

/** Codice provincia (`--province=AT` / `--provincia=AT` / `PROVINCIA=AT`). */
const PROVINCIA = (() => {
  const arg = process.argv.find((a) => a.startsWith('--province=') || a.startsWith('--provincia='));
  return (arg?.split('=')[1] ?? process.env.PROVINCIA ?? '').trim().toUpperCase();
})();
const APPLY = process.argv.includes('--apply');
const DRY_RUN = process.argv.includes('--dry-run');
/**
 * Tetto di HOME del giro. §26.127 — default **tutte**: la provincia che qualcuno
 * ha chiesto si legge al 100% dell'anagrafica MIM (il campione di 60 è caduto).
 * `--max-scuole=N` resta per una visura parziale, `--max-scuole=tutte` è la forma
 * esplicita.
 */
const MAX_SCUOLE: TettoScuoleProvincia = (() => {
  const arg = process.argv.find((a) => a.startsWith('--max-scuole='));
  const grezzo = (arg?.split('=')[1] ?? '').trim().toLowerCase();
  if (!grezzo || grezzo === TUTTE_LE_SCUOLE || grezzo === 'tutti' || grezzo === 'all') {
    return TUTTE_LE_SCUOLE;
  }
  const n = Number(grezzo);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : TUTTE_LE_SCUOLE;
})();

if (!/^[A-Z]{2}$/.test(PROVINCIA)) {
  console.error(
    '[crawl-provincia] Serve il codice di UNA provincia: --province=AT ' +
      '(due lettere, come in `profiles.province`).',
  );
  process.exit(1);
}

const voce = provinciaDaCodice(PROVINCIA);
if (!voce) {
  console.error(`[crawl-provincia] «${PROVINCIA}» non è una provincia del catalogo.`);
  process.exit(1);
}

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

/** Target della provincia in coda (i due stati che contano per l'ingestione). */
async function targetProvincia(supabase: SupabaseClient): Promise<RigaCoda[]> {
  const { data, error } = await supabase
    .from('discovered_links')
    .select('id, url, status, region, province, domain')
    .eq('province', PROVINCIA)
    .in('status', [STATO_PENDING, STATO_ATTIVO])
    .order('url', { ascending: true });
  if (error) throw new Error(`Lettura discovered_links: ${error.message}`);
  return (data ?? []) as RigaCoda[];
}

/**
 * Esegue il crawler della provincia nello stesso processo padre, con l'output in
 * chiaro: è l'unico modo per vedere la lista «SCUOLE CONTATTATE» mentre accade.
 */
function eseguiCrawler(): number {
  const argomenti = [
    'scripts/table-reporter.ts',
    `--province=${PROVINCIA}`,
    '--scuole-provincia',
    ...(DRY_RUN ? ['--dry-run'] : []),
    `--max-scuole=${MAX_SCUOLE}`,
  ];
  const tsx = 'node_modules/tsx/dist/cli.mjs';
  const esito = existsSync(tsx)
    ? spawnSync(process.execPath, [tsx, ...argomenti], { stdio: 'inherit', env: process.env })
    : spawnSync('npx', ['tsx', ...argomenti], { stdio: 'inherit', env: process.env, shell: true });
  return esito.status ?? 1;
}

async function main(): Promise<void> {
  const regione = regioneDiProvincia(PROVINCIA);
  console.log(
    `[crawl-provincia] ${voce?.nome ?? PROVINCIA} (${PROVINCIA}) · regione ${regione ?? 'n.d.'} · ` +
      `${DRY_RUN ? 'dry-run' : 'scrittura attiva'}${APPLY ? ' · promozione coda' : ''}`,
  );

  // 1. ANAGRAFICA — la lista delle scuole che il crawler contatterà.
  const anagrafica = caricaAnagrafica();
  const scuole = scuoleDellaProvincia(anagrafica, PROVINCIA, {
    max: MAX_SCUOLE === TUTTE_LE_SCUOLE ? undefined : MAX_SCUOLE,
  });
  if (!anagrafica.disponibile) {
    console.log(
      '[crawl-provincia] Anagrafica MIM NON disponibile (file SCUANAGRAFE assenti): ' +
        'il crawler resterà sugli istituti citati dagli hub. Nessuna lista da mostrare.',
    );
  } else {
    console.log(
      `[crawl-provincia] Scuole della provincia: ${scuole.scuole.length} istituti con sito ` +
        `ufficiale su ${scuole.righe} righe d'anagrafica (${scuole.senzaSito} senza sito, ` +
        `${scuole.paritarie} paritarie escluse).`,
    );
    for (const scuola of scuole.scuole) {
      console.log(`  · ${scuola.codice} — ${scuola.nome ?? 'nome non dichiarato'} → ${scuola.home}`);
    }
  }

  // 2. CODA — i target della provincia: cosa è già attivo, cosa aspetta.
  if (!supabaseUrl || !supabaseKey) {
    console.warn(
      '[crawl-provincia] Credenziali Supabase assenti (SUPABASE_URL / ' +
        'SUPABASE_SERVICE_ROLE_KEY): salto la coda e passo al crawler.',
    );
  } else {
    const supabase = createClient(supabaseUrl, supabaseKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const righe = await targetProvincia(supabase);
    const pending = righe.filter((r) => r.status === STATO_PENDING);
    const attivi = righe.filter((r) => r.status === STATO_ATTIVO);
    console.log(
      `[crawl-provincia] Coda ${PROVINCIA}: ${attivi.length} target «${STATO_ATTIVO}» · ` +
        `${pending.length} «${STATO_PENDING}».`,
    );
    if (pending.length > 0) {
      for (const riga of pending) console.log(`  · in attesa: ${riga.url}`);
      if (APPLY && !DRY_RUN) {
        const errori = await aggiornaStato(
          supabase,
          pending.map((r) => r.id),
          STATO_ATTIVO,
          `attivazione ${PROVINCIA}`,
        );
        if (errori > 0) {
          console.error(`[crawl-provincia] ${errori} lotti NON aggiornati: coda incompleta.`);
          process.exitCode = 1;
        }
      } else {
        console.log(
          '[crawl-provincia] Dry-run: nessuna promozione. Rilancia con --apply per ' +
            `portare i ${pending.length} target ad «${STATO_ATTIVO}».`,
        );
      }
    }
  }

  // 3. CRAWL — hub della regione + scuole della provincia, con la lista in console.
  console.log(
    `\n[crawl-provincia] Avvio del crawler ${DRY_RUN ? '(dry-run) ' : ''}per ${PROVINCIA}…`,
  );
  const stato = eseguiCrawler();
  if (stato !== 0) {
    console.error(`[crawl-provincia] Crawler terminato con codice ${stato}.`);
    process.exitCode = stato;
    return;
  }
  console.log(
    `[crawl-provincia] Fatto: le scuole di ${voce?.nome ?? PROVINCIA} contattate sono ` +
      'elencate sopra («SCUOLE CONTATTATE»).',
  );
}

main().catch((err) => {
  console.error('[crawl-provincia] Errore:', err instanceof Error ? err.message : String(err));
  process.exit(1);
});
