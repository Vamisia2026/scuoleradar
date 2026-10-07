/**
 * GUARDIA — Consumatore della coda di scansione (`src/scraper/coda.ts`).
 * ---------------------------------------------------------------------
 * Perché esiste: il consumatore è il punto in cui un target può restare
 * `running` per sempre (worker morto, nessun reap) o passare per riuscito senza
 * esserlo. Le proprietà che non si vedono provando a mano, e che qui si bloccano:
 *   · il reap viene PRIMA del claim (un lock scaduto non deve nascondere un target);
 *   · la città del target determina la provincia scansionata (`provinciaDaCitta`);
 *   · una città senza provincia chiude il target in ERRORE ma non ferma il giro;
 *   · un run fallito registra il messaggio del run e va in backoff;
 *   · il limite del giro è rispettato (un giro corto non diventa infinito);
 *   · se la chiusura di un target fallisce il giro si FERMA (mai dichiarare
 *     successi quando non si riesce a chiudere: sarebbero solo lock da recuperare).
 *
 * Il database è sostituito da uno stub: nessuna rete, nessun service_role.
 *
 * Esecuzione: npm run test:coda:consumer
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { TargetScan } from '../src/lib/queue.ts';
import { MAX_TARGET_PER_GIRO, consumaCodaScansioni } from '../src/scraper/coda.ts';

declare const process: { exitCode?: number };

let errori = 0;
function check(nome: string, atteso: unknown, ottenuto: unknown): void {
  const ok = JSON.stringify(atteso) === JSON.stringify(ottenuto);
  if (!ok) errori += 1;
  console.log(`${ok ? '✓' : '✗'} ${nome}: atteso=${JSON.stringify(atteso)} ottenuto=${JSON.stringify(ottenuto)}`);
}

/** Target minimo ma completo (i campi che il consumatore legge). */
function target(city: string): TargetScan {
  return {
    id: `id-${city.toLowerCase()}`,
    city,
    region: 'Piemonte',
    slug: city.toLowerCase(),
    status: 'running',
    priority: 10,
    next_run_at: '2026-10-06T00:00:00.000Z',
    last_checked_at: null,
    last_success_at: null,
    last_error: null,
    consecutive_failures: 0,
    total_runs: 0,
    locked_at: null,
    locked_by: 'test',
    metadata: {},
    created_at: '2026-09-29T10:24:43.000Z',
    updated_at: '2026-09-29T10:24:43.000Z',
  };
}

interface Chiamata {
  nome: string;
  params: Record<string, unknown>;
}
interface Finto {
  client: SupabaseClient;
  chiamate: Chiamata[];
}

/** Stub della coda: `claim` consuma i target passati, gli altri RPC rispondono e basta. */
function clientFinto(opzioni: { coda: TargetScan[]; reap?: number; finishInErrore?: boolean }): Finto {
  const chiamate: Chiamata[] = [];
  const coda = [...opzioni.coda];
  const rpc = async (nome: string, params: Record<string, unknown>) => {
    chiamate.push({ nome, params });
    if (nome === 'reap_stuck_scans') return { data: opzioni.reap ?? 0, error: null };
    if (nome === 'claim_scan_target') {
      const prossimo = coda.shift() ?? null;
      return { data: prossimo ? [prossimo] : [], error: null };
    }
    if (nome === 'finish_scan_target') {
      return opzioni.finishInErrore
        ? { data: null, error: { message: 'database non raggiungibile' } }
        : { data: null, error: null };
    }
    return { data: null, error: { message: `RPC inattesa: ${nome}` } };
  };
  return { client: { rpc } as unknown as SupabaseClient, chiamate };
}
const nomiChiamate = (f: Finto): string[] => f.chiamate.map((c) => c.nome);
const chiusure = (f: Finto): Record<string, unknown>[] =>
  f.chiamate.filter((c) => c.nome === 'finish_scan_target').map((c) => c.params);
const claim = (f: Finto): number => nomiChiamate(f).filter((n) => n === 'claim_scan_target').length;

async function main(): Promise<void> {
  console.log('— Coda di scansione: consumatore —');

  // 1) REAP PRIMA DEL CLAIM, CODA VUOTA
  {
    const f = clientFinto({ coda: [], reap: 3 });
    const esito = await consumaCodaScansioni({
      client: f.client,
      worker: 'test',
      scansiona: async () => undefined,
    });
    check('reap chiamato per PRIMO', 'reap_stuck_scans', f.chiamate[0]?.nome);
    check('lock recuperati riportati nell’esito', 3, esito.liberati);
    check('coda vuota: un solo claim (nessuna insistenza)', 1, claim(f));
    check('coda vuota: nessun lavoro dichiarato', [0, 0, 0], [esito.presi, esito.riusciti, esito.falliti]);
  }

  // 2) SUCCESSO: LA CITTÀ DIVENTA LA PROVINCIA DA SCANSIONARE
  {
    const f = clientFinto({ coda: [target('Torino')] });
    const viste: string[] = [];
    const esito = await consumaCodaScansioni({
      client: f.client,
      worker: 'test',
      scansiona: async (provincia) => {
        viste.push(provincia);
      },
    });
    check('la città del target è la provincia scansionata', ['TO'], viste);
    check('esito del giro riuscito', [1, 1, 0], [esito.presi, esito.riusciti, esito.falliti]);
    check(
      'target chiuso con successo (senza errore)',
      [true, null],
      [chiusure(f)[0]?.p_success, chiusure(f)[0]?.p_error ?? null],
    );
    check('worker dichiarato alla RPC di claim', 'test', f.chiamate[1]?.params?.p_worker);
  }

  // 3) CITTÀ SENZA PROVINCIA: ERRORE DICHIARATO, GIRO CHE PROSEGUE
  {
    const f = clientFinto({ coda: [target('Zugo'), target('Torino')] });
    const log: string[] = [];
    const viste: string[] = [];
    const esito = await consumaCodaScansioni({
      client: f.client,
      worker: 'test',
      log: (messaggio) => log.push(messaggio),
      scansiona: async (provincia) => {
        viste.push(provincia);
      },
    });
    check('città ignota: nessuna scansione tentata', ['TO'], viste);
    check('città ignota: target chiuso in ERRORE', false, chiusure(f)[0]?.p_success);
    check('città ignota: l’errore la nomina', true, String(chiusure(f)[0]?.p_error ?? '').includes('Zugo'));
    check('città ignota: dichiarata nell’esito', ['Zugo'], esito.scartati);
    check('città ignota: il giro PROSEGUE sul target successivo', [2, 1, 1], [
      esito.presi,
      esito.riusciti,
      esito.falliti,
    ]);
    check('città ignota: l’avviso arriva nel log del chiamante', 1, log.length);
  }

  // 4) RUN FALLITO: MESSAGGIO REGISTRATO SUL TARGET
  {
    const f = clientFinto({ coda: [target('Milano')] });
    const esito = await consumaCodaScansioni({
      client: f.client,
      worker: 'test',
      scansiona: async () => {
        throw new Error('hub USR irraggiungibile');
      },
      log: () => undefined,
    });
    check(
      'run fallito: target in errore con il messaggio del run',
      [false, 'hub USR irraggiungibile'],
      [chiusure(f)[0]?.p_success, chiusure(f)[0]?.p_error],
    );
    check('run fallito: contato fra i falliti', [1, 0], [esito.falliti, esito.riusciti]);
  }

  // 5) LIMITE DEL GIRO
  {
    const f = clientFinto({ coda: [target('Torino'), target('Milano'), target('Roma')] });
    const esito = await consumaCodaScansioni({
      client: f.client,
      worker: 'test',
      maxTarget: 2,
      scansiona: async () => undefined,
    });
    check('limite del giro rispettato (2 target)', [2, 2], [esito.presi, claim(f)]);
    check('default del giro', 5, MAX_TARGET_PER_GIRO);

    const molte = clientFinto({ coda: Array.from({ length: 8 }, (_, i) => target(`Citta${i}`)) });
    const esitoDefault = await consumaCodaScansioni({
      client: molte.client,
      worker: 'test',
      maxTarget: Number.NaN,
      scansiona: async () => undefined,
      log: () => undefined,
    });
    check('maxTarget non valido → default del giro', MAX_TARGET_PER_GIRO, esitoDefault.presi);
  }

  // 6) CODA NON CONFIGURATA (sviluppo locale senza service_role)
  {
    const esito = await consumaCodaScansioni({
      client: null,
      worker: 'test',
      scansiona: async () => {
        throw new Error('non deve mai essere chiamata');
      },
    });
    check('client null: nessun lavoro, nessun crash', [0, 0, 0, 0], [
      esito.liberati,
      esito.presi,
      esito.riusciti,
      esito.falliti,
    ]);
  }

  // 7) CHIUSURA IMPOSSIBILE: IL GIRO SI FERMA, NESSUN SUCCESSO DICHIARATO
  {
    const f = clientFinto({ coda: [target('Torino'), target('Milano')], finishInErrore: true });
    let lanciato = false;
    let esito: unknown = null;
    try {
      esito = await consumaCodaScansioni({
        client: f.client,
        worker: 'test',
        scansiona: async () => undefined,
      });
    } catch {
      lanciato = true;
    }
    check('chiusura in errore: l’errore risale al chiamante', true, lanciato);
    check('chiusura in errore: un solo target preso (nessun lock accumulato)', 1, claim(f));
    check('chiusura in errore: nessun esito dichiarato', null, esito);
  }

  console.log(errori === 0 ? '\n✅ CONSUMATORE CODA: nessun problema' : `\n❌ CONSUMATORE CODA: ${errori} errore/i`);
  process.exitCode = errori === 0 ? 0 : 1;
}

main().catch((err) => {
  console.error('✗ Guardia del consumatore non eseguita:', err);
  process.exitCode = 1;
});
