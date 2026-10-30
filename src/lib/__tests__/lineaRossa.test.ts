/**
 * TEST — «LINEA ROSSA»: la barra di comando del pannello Admin (§26.110).
 *
 * Due cose possono rompersi in silenzio e nessuna delle due dà errore a runtime:
 *   · la finestra dei 60 giorni — se la barra se ne tenesse una copia, la copia
 *     sarebbe la prima a divergere dal motore che isola davvero le fonti;
 *   · la distinzione «nessuna fonte isolata» / «dato assente» — se `null`
 *     diventasse `[]`, la barra racconterebbe un fatto che nessuno ha misurato.
 *
 * Il test controlla quindi il modulo puro (`quaranteneAttive`,
 * `giorniResiduiQuarantena`) e il cablaggio: componente, montaggio nel pannello
 * Admin, Edge che espone `fonti_isolate`, via del System Health Check.
 *
 * Uso: npm run test:linea-rossa  (incluso in `npm test`)
 */
import { readFileSync } from 'node:fs';
import {
  GIORNI_QUARANTENA,
  giorniResiduiQuarantena,
  quaranteneAttive,
  type FonteIsolata,
} from '../sourceQuarantine.ts';

/** Interfaccia minima per l'ambiente (come gli altri test di prodotto). */
declare const process: { exitCode?: number };

let errori = 0;
function check(nome: string, atteso: unknown, ottenuto: unknown): void {
  const ok = JSON.stringify(atteso) === JSON.stringify(ottenuto);
  if (!ok) errori += 1;
  console.log(`${ok ? '✓' : '✗'} ${nome}: atteso=${JSON.stringify(atteso)} ottenuto=${JSON.stringify(ottenuto)}`);
}

const leggi = (p: string): string => readFileSync(p, 'utf8');
const ADESSO = new Date('2026-10-30T09:00:00.000Z');
const MS_GIORNO = 86_400_000;
/** Data ISO di `n` giorni prima (o dopo, con `n` negativo) di `ADESSO`. */
const giorniFa = (n: number): string => new Date(ADESSO.getTime() - n * MS_GIORNO).toISOString();
const fonte = (url: string, dal: string | null, motivo?: string | null): FonteIsolata => ({
  url,
  dal,
  motivo,
});

function main(): void {
  /* ------------- 1) LA FINESTRA: 60 giorni, poi si riprova ------------- */
  console.log('— 1. La finestra dei 60 giorni —');
  check('finestra dichiarata', 60, GIORNI_QUARANTENA);
  check('isolata ieri: restano 59 giorni', 59, giorniResiduiQuarantena(giorniFa(1), ADESSO));
  check('isolata 59 giorni fa: resta 1 giorno', 1, giorniResiduiQuarantena(giorniFa(59), ADESSO));
  check('scaduta esattamente oggi: 0 giorni', 0, giorniResiduiQuarantena(giorniFa(60), ADESSO));
  check('isolata da 70 giorni: 0 giorni', 0, giorniResiduiQuarantena(giorniFa(70), ADESSO));
  check('orologio indietro: mai oltre la finestra', 60, giorniResiduiQuarantena(giorniFa(-5), ADESSO));
  check('data illeggibile: vale scaduta', [0, 0], [
    giorniResiduiQuarantena(null, ADESSO),
    giorniResiduiQuarantena('non-una-data', ADESSO),
  ]);

  /* ------------- 2) «NESSUN ISOLAMENTO» NON È «DATO ASSENTE» ------------- */
  console.log('\n— 2. Assente ≠ vuoto —');
  check('telemetria muta: null, non lista vuota', null, quaranteneAttive(null, ADESSO));
  check('nessuna fonte isolata: lista vuota', [], quaranteneAttive([], ADESSO));
  const attive = quaranteneAttive(
    [
      fonte('https://www.usp-rieti.it/interpelli', giorniFa(1), 'not_found'),
      fonte('https://www.istruzionepiemonte.it/interpelli/', giorniFa(61), 'timeout'),
      fonte('https://www.usp-siena.it/albo', null, 'layout_changed'),
    ],
    ADESSO,
  );
  check('restano solo le quarantene attive', [
    ['https://www.usp-rieti.it/interpelli', 59, 'not_found'],
  ], (attive ?? []).map((f) => [f.url, f.giorni, f.motivo ?? null]));
  check('la fonte conserva url, data e motivo', true, Boolean(attive?.[0]?.dal));

  /* ------------- 3) IL CABLAGGIO: una sola finestra, una sola barra ------------- */
  console.log('\n— 3. Cablaggio —');
  const componente = leggi('src/components/CrawlerTelemetry.tsx');
  check('il componente esporta la barra', true, /export function LineaRossa\b/.test(componente));
  check('la finestra viene dal modulo puro, non ricopiata', [true, false], [
    /quaranteneAttive\(/.test(componente) && /from '@\/lib\/sourceQuarantine'/.test(componente),
    /GIORNI_QUARANTENA\s*=\s*\d+/.test(componente),
  ]);
  check('dato assente mostrato come «—», mai come zero', true, componente.includes("'—'"));
  check('la barra è montata nel pannello Admin', true, /<LineaRossa\b/.test(leggi('src/pages/AdminPage.tsx')));
  check('il System Health Check non la monta più', false, /<CrawlerTelemetry\b/.test(leggi('src/components/HealthCheckModal.tsx')));

  const edge = leggi('supabase/functions/crawler-admin/index.ts');
  check('la Edge legge source_health e ne ricava i due campi', [true, true, true], [
    edge.includes('source_health'),
    edge.includes('fonti_isolate'),
    edge.includes('fonti_in_guasto'),
  ]);
  check('il client dichiara i campi opzionali', [true, true], [
    /fonti_isolate\?:/.test(leggi('src/services/crawlerTelemetry.ts')),
    /fonti_in_guasto\?:/.test(leggi('src/services/crawlerTelemetry.ts')),
  ]);
  check('l’arancio di brand è nel tema', true, /450:\s*'#E37820'/i.test(leggi('tailwind.config.js')));

  /* ------------- 4) IL PESO DEL FILE (300 righe = gate) ------------- */
  console.log('\n— 4. Peso del componente —');
  const righe = componente.replace(/\r?\n$/, '').split(/\r?\n/).length;
  check('componente sotto le 251 righe', true, righe <= 250);

  const pkg = JSON.parse(leggi('package.json')) as { scripts: Record<string, string> };
  check('script dedicato e guardia nella catena', [true, true], [
    'test:linea-rossa' in pkg.scripts,
    (pkg.scripts.test ?? '').includes('src/lib/__tests__/lineaRossa.test.ts'),
  ]);

  console.log(
    errori === 0
      ? '\n✅ LINEA ROSSA: la finestra è una sola e i numeri mancanti restano «—».'
      : `\n❌ LINEA ROSSA: ${errori} errore/i`,
  );
  process.exitCode = errori === 0 ? 0 : 1;
}

try {
  main();
} catch (err) {
  console.error('❌ LINEA ROSSA: errore non gestito nel test', err);
  process.exitCode = 1;
}
