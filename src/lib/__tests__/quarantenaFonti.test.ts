/**
 * TEST — QUARANTENA A TERMINE DELLE FONTI (§26.85, §26.109).
 *
 * Due lati opposti, entrambi costosi se sbagliati:
 *   · un `404`/`410` ripetuto è la prova più forte che un dominio scolastico è
 *     sparito o ha cambiato indirizzo → isola al SECONDO run, non al terzo;
 *   · una quarantena senza scadenza è una condanna: dopo `GIORNI_QUARANTENA`
 *     (60) la fonte torna candidabile da sola, così un portale che riapre non
 *     resta invisibile per sempre. Se è ancora morta, le regole la isolano di
 *     nuovo al primo run fallito (e l'orologio riparte).
 *
 * Verifica anche che la scadenza sia davvero cablata dove si decide (`fontiIsolate`
 * nei runner) e che i moduli restino leggeri (< 201 righe).
 *
 * Uso: npm run test:quarantena  (incluso in `npm test`)
 */
import { readFileSync } from 'node:fs';
import { GIORNI_QUARANTENA, fontiIsolate, quarantenaScaduta } from '../sourceQuarantine.ts';
import {
  SOGLIA_NON_TROVATO,
  motivoGuasto,
  recordSourceRun,
  resetTelemetria,
  sogliaQuarantena,
  statoVuoto,
  valutaRun,
  type PonteTelemetria,
  type SourceHealthStatus,
} from '../sourceTelemetry.ts';

/** Interfaccia minima per l'ambiente (come gli altri test di prodotto). */
declare const process: { exitCode?: number };

let errori = 0;
function check(nome: string, atteso: unknown, ottenuto: unknown): void {
  const ok = JSON.stringify(atteso) === JSON.stringify(ottenuto);
  if (!ok) errori += 1;
  console.log(`${ok ? '✓' : '✗'} ${nome}: atteso=${JSON.stringify(atteso)} ottenuto=${JSON.stringify(ottenuto)}`);
}

const leggi = (p: string): string => readFileSync(p, 'utf8');
const FONTE = 'https://www.istruzionepiemonte.it/interpelli/';
const ADESSO = new Date('2026-10-30T09:00:00.000Z');
const giorni = (n: number): Date => new Date(ADESSO.getTime() + n * 86_400_000);
const dettagli = (error?: string, layoutDetected?: string) => ({ itemsCount: 0, error, layoutDetected });

/** Database finto con la forma di `public.source_health`. */
function dbFinto(iniziali: readonly SourceHealthStatus[] = []) {
  const righe = new Map(iniziali.map((stato) => [stato.sourceUrl, { ...stato }]));
  const ponte: PonteTelemetria = {
    async leggi() {
      return [...righe.values()].map((stato) => ({ ...stato }));
    },
    async salva(stato) {
      righe.set(stato.sourceUrl, { ...stato });
      return null;
    },
  };
  return { righe, ponte };
}

/** Fonte isolata da `giorniFa` giorni, come la lascerebbe un run fallito. */
function isolataDa(giorniFa: number, url = FONTE): SourceHealthStatus {
  return {
    ...statoVuoto(url),
    status: 'empty',
    consecutiveFailures: 3,
    isQuarantined: true,
    quarantineReason: 'zero_items',
    quarantinedAt: giorni(-giorniFa).toISOString(),
  };
}

async function main(): Promise<void> {
  /* -------------- 1) 404/410: LA PROVA VALE PIÙ DEL TIMEOUT -------------- */
  console.log('— 1. Dominio sparito: soglia a due run —');
  check('soglia dei 404 dichiarata', 2, SOGLIA_NON_TROVATO);
  check('motivi riconosciuti', ['not_found', 'not_found', 'timeout', 'timeout'], [
    motivoGuasto(dettagli('HTTP 404')),
    motivoGuasto(dettagli('HTTP 410')),
    motivoGuasto(dettagli('HTTP 503')),
    motivoGuasto(dettagli('connect ETIMEDOUT')),
  ]);
  check('soglie per motivo (404, layout, timeout)', [2, 2, 3, 3], [
    sogliaQuarantena('not_found'),
    sogliaQuarantena('layout_changed'),
    sogliaQuarantena('timeout'),
    sogliaQuarantena('zero_items'),
  ]);
  const primo404 = valutaRun(FONTE, null, 'quarantine', dettagli('HTTP 404'), ADESSO);
  check('un solo 404 non isola', [1, false], [primo404.consecutiveFailures, primo404.isQuarantined]);
  const secondo404 = valutaRun(FONTE, primo404, 'quarantine', dettagli('HTTP 404'), ADESSO);
  check('due 404 isolano con motivo dichiarato', [true, 'not_found'], [secondo404.isQuarantined, secondo404.quarantineReason]);
  const due503 = valutaRun(
    FONTE,
    valutaRun(FONTE, null, 'quarantine', dettagli('HTTP 503'), ADESSO),
    'quarantine',
    dettagli('HTTP 503'),
    ADESSO,
  );
  check('un timeout non isola al secondo run', false, due503.isQuarantined);

  /* -------------- 2) LA FINESTRA DEI 60 GIORNI -------------- */
  console.log('\n— 2. Quarantena a termine: 60 giorni, poi si riprova —');
  check('finestra dichiarata', 60, GIORNI_QUARANTENA);
  check('scadenza ai bordi', [false, false, true], [
    quarantenaScaduta(isolataDa(59), ADESSO),
    quarantenaScaduta(statoVuoto(FONTE), ADESSO),
    quarantenaScaduta(isolataDa(60), ADESSO),
  ]);
  check('isolamento senza data = scaduto (si riprova)', true, quarantenaScaduta({ ...isolataDa(0), quarantinedAt: null }, ADESSO));
  check('data illeggibile = scaduto', true, quarantenaScaduta({ ...isolataDa(0), quarantinedAt: 'ieri' }, ADESSO));

  /* -------------- 3) CHI SALTA IL GIRO -------------- */
  console.log('\n— 3. `fontiIsolate`: dentro solo le quarantene in corso —');
  const ALTRA = 'https://www.usp-pi.it/interpelli';
  const SANA = 'https://www.usptaranto.it/';
  const isolate = fontiIsolate([isolataDa(10), isolataDa(90, ALTRA), statoVuoto(SANA)], ADESSO);
  check('fresca dentro, scaduta fuori, sana fuori', [true, false, false], [
    isolate.has(FONTE),
    isolate.has(ALTRA),
    isolate.has(SANA),
  ]);
  check(
    'URL normalizzati come chiave',
    true,
    fontiIsolate([isolataDa(5, 'https://www.usp-rieti.it/interpelli#avvisi')], ADESSO).has('https://www.usp-rieti.it/interpelli'),
  );

  /* -------------- 4) LA SCADENZA NEL FLUSSO REALE -------------- */
  console.log('\n— 4. `recordSourceRun` dopo la scadenza: si riparte da zero —');
  const scaduta = dbFinto([isolataDa(70)]);
  await recordSourceRun(FONTE, 'empty', dettagli(undefined, 'table'), { ponte: scaduta.ponte, adesso: ADESSO });
  const dopoScadenza = scaduta.righe.get(FONTE) as SourceHealthStatus;
  check('contatori azzerati e fonte riprovata', [1, false, null], [
    dopoScadenza.consecutiveFailures,
    dopoScadenza.isQuarantined,
    dopoScadenza.quarantinedAt,
  ]);

  resetTelemetria();
  const morto = dbFinto();
  await recordSourceRun(FONTE, 'quarantine', dettagli('HTTP 404'), { ponte: morto.ponte, adesso: ADESSO });
  await recordSourceRun(FONTE, 'quarantine', dettagli('HTTP 404'), { ponte: morto.ponte, adesso: ADESSO });
  check('due 404 via database isolano il dominio', [true, 'not_found'], [
    morto.righe.get(FONTE)?.isQuarantined,
    morto.righe.get(FONTE)?.quarantineReason,
  ]);
  await recordSourceRun(FONTE, 'quarantine', dettagli('HTTP 404'), { ponte: morto.ponte, adesso: giorni(60) });
  check('scaduta la quarantena i contatori ripartono', [1, false], [
    morto.righe.get(FONTE)?.consecutiveFailures,
    morto.righe.get(FONTE)?.isQuarantined,
  ]);
  await recordSourceRun(FONTE, 'quarantine', dettagli('HTTP 404'), { ponte: morto.ponte, adesso: giorni(60) });
  check('se il dominio è ancora morto la quarantena riparte con data nuova', [true, giorni(60).toISOString()], [
    morto.righe.get(FONTE)?.isQuarantined,
    morto.righe.get(FONTE)?.quarantinedAt,
  ]);

  /* -------------- 5) IL CABLAGGIO -------------- */
  console.log('\n— 5. Cablaggio: telemetria, runner, moduli leggeri —');
  check('la telemetria applica la scadenza', [true, true], [
    leggi('src/lib/sourceTelemetry.ts').includes('quarantenaScaduta(precedente, adesso)'),
    leggi('src/lib/sourceTelemetry.ts').includes('return fontiIsolate(tutte, opzioni.adesso)'),
  ]);
  check('i runner saltano le fonti isolate', [true, true], [
    leggi('scripts/table-reporter.ts').includes('filtraFontiSane(targets, quarantena'),
    leggi('scripts/discovery-engine.ts').includes('return filtraFontiSane(righe, escluse)'),
  ]);
  check('la migrazione conserva la data dell’isolamento', true, /quarantined_at/.test(leggi('supabase/migrations/20261023120000_create_source_health.sql')));

  const contaRighe = (p: string): number => leggi(p).replace(/\r?\n$/, '').split('\n').length;
  const moduli = ['src/lib/sourceHealthRules.ts', 'src/lib/sourceQuarantine.ts', 'src/lib/sourceTelemetry.ts'];
  check('moduli sotto 201 righe', [true, true, true], moduli.map((m) => contaRighe(m) <= 200));

  const pkg = JSON.parse(leggi('package.json')) as { scripts: Record<string, string> };
  check('script dedicato e guardia nella catena', [true, true], [
    'test:quarantena' in pkg.scripts,
    (pkg.scripts.test ?? '').includes('src/lib/__tests__/quarantenaFonti.test.ts'),
  ]);

  console.log(
    errori === 0
      ? '\n✅ QUARANTENA FONTI: si isola sulle prove (404), si riprova dopo 60 giorni.'
      : `\n❌ QUARANTENA FONTI: ${errori} errore/i`,
  );
  process.exitCode = errori === 0 ? 0 : 1;
}

main().catch((err) => {
  console.error('❌ QUARANTENA FONTI: errore non gestito nel test', err);
  process.exitCode = 1;
});
