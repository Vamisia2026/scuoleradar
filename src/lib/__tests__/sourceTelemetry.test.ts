/**
 * TEST — TELEMETRIA DELLE FONTI E QUARANTENA AUTOMATICA (§26.85).
 *
 * La quarantena costa: se scatta per un falso positivo la bacheca perde una
 * fonte viva, se non scatta mai la scansione brucia richieste su portali morti.
 * Qui i due lati: TRE fallimenti consecutivi isolano (`zero_items`), DUE layout
 * non riconosciuti isolano prima (`layout_changed`), un `success` azzera tutto,
 * un database che non risponde non fa cadere la pipeline. Verifica anche che le
 * fonti isolate vengano saltate nei giri ordinari e il cablaggio nei runner.
 *
 * Uso: npm run test:source-telemetry  (incluso in `npm test`)
 */
import { existsSync, readFileSync } from 'node:fs';
import { SOGLIA_LAYOUT_IGNOTO, SOGLIA_QUARANTENA, filtraFontiSane, fontiInQuarantena, getSourceHealth, motivoGuasto, normalizzaUrl, recordSourceRun, resetTelemetria, riabilitaFonte, statoVuoto, valutaRun, type PonteTelemetria, type SourceHealthStatus } from '../sourceTelemetry.ts';

/** Interfaccia minima per l'ambiente (come gli altri test di prodotto). */
declare const process: { exitCode?: number };

let errori = 0;
function check(nome: string, atteso: unknown, ottenuto: unknown): void {
  const ok = JSON.stringify(atteso) === JSON.stringify(ottenuto);
  if (!ok) errori += 1;
  console.log(`${ok ? '✓' : '✗'} ${nome}: atteso=${JSON.stringify(atteso)} ottenuto=${JSON.stringify(ottenuto)}`);
}

const leggi = (p: string): string => readFileSync(p, 'utf8');

/** Database finto con la forma di `public.source_health`: prova la quarantena «fra processi diversi» (resetTelemetria + rilettura). */
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

const ADESSO = new Date('2026-10-23T09:00:00.000Z');
const FONTE = 'https://usr.example.it/interpelli/';
const dettagli = (itemsCount: number, layoutDetected?: string, error?: string) => ({ itemsCount, layoutDetected, error });

/* ------------------ 1) TRE FALLIMENTI CONSECUTIVI → QUARANTENA ---------------- */
const sequenza = (esiti: Array<'success' | 'empty' | 'quarantine'>, layout = 'table') => {
  let stato: SourceHealthStatus | null = null;
  for (const esito of esiti) stato = valutaRun(FONTE, stato, esito, dettagli(0, layout), ADESSO);
  return stato as unknown as SourceHealthStatus;
};

const dueFallimenti = sequenza(['empty', 'empty']);
check('due run senza voci: contano ma non isolano', [2, false, 'table'], [dueFallimenti.consecutiveFailures, dueFallimenti.isQuarantined, dueFallimenti.layoutDetected]);
const treFallimenti = sequenza(['empty', 'empty', 'empty']);
check('soglia dei fallimenti dichiarata', 3, SOGLIA_QUARANTENA);
check('il terzo fallimento isola (motivo e data del run)', [true, 'zero_items', ADESSO.toISOString()], [treFallimenti.isQuarantined, treFallimenti.quarantineReason, treFallimenti.quarantinedAt]);

/* ------------------- 2) LAYOUT IGNOTO CHE PERSISTE → QUARANTENA -------------- */
const primoIgnoto = sequenza(['empty'], 'unknown');
check('un layout ignoto non isola subito', [false, 'layout_changed', 2], [primoIgnoto.isQuarantined, motivoGuasto(dettagli(0, 'unknown')), SOGLIA_LAYOUT_IGNOTO]);
const secondoIgnoto = valutaRun(FONTE, primoIgnoto, 'empty', dettagli(0, 'unknown'), ADESSO);
check('il layout ignoto che persiste isola', [true, 'layout_changed'], [secondoIgnoto.isQuarantined, secondoIgnoto.quarantineReason]);

/* ------------------------ 3) IL SUCCESSO AZZERA TUTTO ----------------------- */
const riabilitata = valutaRun(FONTE, treFallimenti, 'success', dettagli(7, 'table'), ADESSO);
check('un run riuscito azzera fallimenti, quarantena e motivo', [0, false, null, ADESSO.toISOString(), 7, 4], [riabilitata.consecutiveFailures, riabilitata.isQuarantined, riabilitata.quarantineReason, riabilitata.lastSuccessAt, riabilitata.itemsCount, riabilitata.totalRuns]);

/* --------------------- 4) TIMEOUT E ALTRI ERRORI DI RETE -------------------- */
check('un errore = pagina non servita (timeout)', ['timeout', 'timeout', 'timeout'], [motivoGuasto(dettagli(0, 'table', 'Timeout 25000ms')), motivoGuasto(dettagli(0, undefined, 'connect ECONNREFUSED')), motivoGuasto(dettagli(0, 'table', 'HTTP 500'))]);
check('pagina letta e vuota = zero_items', 'zero_items', motivoGuasto(dettagli(0, 'table')));

/* --------------- 6) PERSISTENZA FRA PROCESSI E RESET MANUALE ----------------- */
async function main(): Promise<void> {
  const { righe, ponte } = dbFinto();
  resetTelemetria();
  for (let giro = 1; giro <= 3; giro += 1) {
    await recordSourceRun(FONTE, 'empty', dettagli(0, 'table'), { ponte, adesso: ADESSO });
  }
  check('il database riceve una riga per fonte', [1, 3, true], [righe.size, righe.get(FONTE)?.consecutiveFailures, righe.get(FONTE)?.isQuarantined]);

  // Un NUOVO processo non ha memoria: la decisione deve arrivare dal database.
  resetTelemetria();
  const dopoRiavvio = await getSourceHealth(FONTE, { ponte });
  check('lo stato sopravvive al riavvio', [true, 'zero_items', 3], [dopoRiavvio.isQuarantined, dopoRiavvio.quarantineReason, dopoRiavvio.consecutiveFailures]);

  await recordSourceRun(FONTE, 'empty', dettagli(0, 'table'), { ponte, adesso: ADESSO });
  check('i fallimenti si accumulano fra processi', 4, righe.get(FONTE)?.consecutiveFailures);

  // Reset manuale: la fonte torna candidabile e la scrittura arriva al database.
  await riabilitaFonte(FONTE, { ponte, adesso: ADESSO });
  check('il reset azzera quarantena e fallimenti', [false, 0], [(await getSourceHealth(FONTE, { ponte })).isQuarantined, righe.get(FONTE)?.consecutiveFailures]);
  await recordSourceRun(FONTE, 'empty', dettagli(0, 'table'), { ponte, adesso: ADESSO });
  check('dopo il reset serve una nuova serie', false, (await getSourceHealth(FONTE, { ponte })).isQuarantined);

  // Un run riuscito riabilita anche una fonte già isolata.
  await recordSourceRun(FONTE, 'success', dettagli(12, 'table'), { ponte, adesso: ADESSO });
  const sana = await getSourceHealth(FONTE, { ponte });
  check('il successo riabilita e registra le voci', [false, 12, 'success'], [sana.isQuarantined, sana.itemsCount, righe.get(FONTE)?.status]);

  const maiVista = await getSourceHealth('https://nuova.example.it/interpelli/', { ponte });
  check('una fonte sconosciuta parte neutra', [true, 0], [maiVista.status === 'unknown' && !maiVista.isQuarantined, maiVista.consecutiveFailures]);

  /* ---------- 7) DATABASE GIÙ: NESSUN CRASH, STATO IN MEMORIA + AVVISO -------- */
  const rotto: PonteTelemetria = {
    async leggi() {
      throw new Error('fetch failed: database irraggiungibile');
    },
    async salva() {
      return 'timeout della connessione';
    },
  };
  const URL_ROTTO = 'https://lento.example.it/interpelli/';
  resetTelemetria();
  const erroriPrima = errori;
  for (let giro = 1; giro <= 3; giro += 1) {
    await recordSourceRun(URL_ROTTO, 'quarantine', dettagli(0, undefined, 'HTTP 503'), { ponte: rotto, adesso: ADESSO });
  }
  const comunque = await getSourceHealth(URL_ROTTO, { ponte: rotto });

  /* --------- 8) LE FONTI ISOLATE SI SALTANO NEI GIRI ORDINARI --------------- */
  const { ponte: ponteSano } = dbFinto();
  resetTelemetria();
  for (let giro = 1; giro <= 3; giro += 1) {
    await recordSourceRun('https://rotto.example.it/interpelli/', 'empty', dettagli(0, 'unknown'), { ponte: ponteSano, adesso: ADESSO });
  }
  await recordSourceRun('https://sano.example.it/interpelli/', 'success', dettagli(5, 'table'), { ponte: ponteSano, adesso: ADESSO });

  const quarantena = await fontiInQuarantena({ ponte: ponteSano });
  check('una sola fonte isolata, quella che ha fallito', [1, true], [quarantena.size, quarantena.has('https://rotto.example.it/interpelli/')]);

  const target = [
    { id: '1', url: 'https://rotto.example.it/interpelli/' },
    { id: '2', url: 'https://sano.example.it/interpelli/' },
  ];
  check('il giro ordinario salta la fonte isolata', ['2'], filtraFontiSane(target, quarantena).map((t) => t.id));
  check('il giro di ri-validazione la include', 2, filtraFontiSane(target, quarantena, { ignora: true }).length);
  check('senza quarantena passano tutte', 2, filtraFontiSane(target, new Set()).length);

  /* ------------------- 9) LA CHIAVE DELLA FONTE È CANONICA ------------------ */
  check('il frammento non fa una seconda fonte', 'https://x.example.it/a', normalizzaUrl(' https://x.example.it/a#progr=3 '));
  check('una stringa non URL resta leggibile', 'non-un-url', normalizzaUrl(' non-un-url '));
  check('fonte vuota = stato vuoto', '', statoVuoto('').sourceUrl);

  check('il database rotto non genera eccezioni', [erroriPrima, true, 'timeout'], [errori, comunque.isQuarantined, comunque.quarantineReason]);

  /* -------------- 10) CABLAGGIO, MIGRAZIONE E LIMITI DI DIMENSIONE ----------- */
  const reporter = leggi('scripts/table-reporter.ts');
  const discovery = leggi('scripts/discovery-engine.ts');
  check('runner e discovery importano la telemetria', [true, true], [reporter, discovery].map((s) => /from '\.\.\/src\/lib\/sourceTelemetry\.ts'/.test(s)));
  check('runner e discovery registrano i run', [true, true], [reporter, discovery].map((s) => /recordSourceRun\(/.test(s)));
  check('runner e discovery saltano le fonti isolate', [true, true], [reporter, discovery].map((s) => /fontiInQuarantena\(/.test(s) && /filtraFontiSane\(/.test(s)));
  check('il runner può forzare la ri-validazione', true, /--ignora-quarantena/.test(reporter));

  const migrazione = 'supabase/migrations/20261023120000_create_source_health.sql';
  const sql = existsSync(migrazione) ? leggi(migrazione) : '';
  check('tabella idempotente', true, /create table if not exists public\.source_health/i.test(sql));
  check('colonne della quarantena', true, ['consecutive_failures', 'is_quarantined', 'quarantine_reason'].every((c) => new RegExp(`\\b${c}\\b`).test(sql)));
  check('RLS di servizio', true, /enable row level security/i.test(sql) && /to service_role/i.test(sql));

  // §26.117 — RLS e GRANT sono due cancelli diversi: la policy decide le RIGHE,
  // il privilegio decide se il ruolo tocca la tabella. Misurato il 30/10/2026:
  // con la chiave `service_role` giusta la tabella rispondeva 42501.
  const permessi = leggi('supabase/migrations/20261030120000_grant_source_health_service_role.sql');
  check('privilegi SQL al service_role (42501)', true, /grant\s+select[\s\S]*?on public\.source_health\s+to service_role/i.test(permessi));
  check('nessun privilegio al browser', false, /\bto\s+(?:anon|authenticated)\b/i.test(permessi));
  check('l\'errore 42501 dice quale SQL eseguire', true, /42501/.test(leggi('src/lib/sourceTelemetryDb.ts')));

  const regole = leggi('src/lib/sourceHealthRules.ts');
  check('regole pure: nessun import, nessuna rete', [false, false], [/^\s*import\s/m.test(regole), /fetch\s*\(|XMLHttpRequest|cheerio/i.test(regole)]);

  const contaRighe = (p: string): number => leggi(p).replace(/\r?\n$/, '').split('\n').length;
  const moduli = ['src/lib/sourceTelemetry.ts', 'src/lib/sourceHealthRules.ts', 'src/lib/sourceTelemetryDb.ts'];
  check('moduli sotto 201 righe', [true, true, true], moduli.map((m) => contaRighe(m) <= 200));

  const pkg = JSON.parse(leggi('package.json')) as { scripts: Record<string, string> };
  check('script dedicato e guardia nella catena', [true, true], ['test:source-telemetry' in pkg.scripts, (pkg.scripts.test ?? '').includes('src/lib/__tests__/sourceTelemetry.test.ts')]);

  console.log(errori === 0 ? '\n✅ TELEMETRIA FONTI: la quarantena scatta sulle prove, non sulle impressioni.' : `\n❌ TELEMETRIA FONTI: ${errori} errore/i`);
  process.exitCode = errori === 0 ? 0 : 1;
}

main().catch((err) => {
  console.error('❌ TELEMETRIA FONTI: errore non gestito nel test', err);
  process.exitCode = 1;
});


const treTimeout = sequenza(['quarantine', 'quarantine', 'quarantine'], 'table');
check('tre errori di fetch isolano la fonte', true, treTimeout.isQuarantined);

/* ------------- 5) UNA FONTE ISOLATA NON SI RIABILITA DA SOLA ---------------- */
const ancoraIsolata = valutaRun(FONTE, treFallimenti, 'empty', dettagli(0, 'unknown'), ADESSO);
check('quarantena e motivo sopravvivono ai run successivi', [true, 'zero_items'], [ancoraIsolata.isQuarantined, ancoraIsolata.quarantineReason]);
