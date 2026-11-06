/**
 * GUARDIA — IL BANNER DELLA SCANSIONE (§26.146).
 * -----------------------------------------------------------------------------------
 * Il banner dice all'utente quanto sono freschi gli albi che sta guardando. Il rischio
 * di un contenuto così è tutto in una parola: INVENTARE. Un «0 fonti isolate» quando la
 * Edge non ha risposto, un «adesso» quando la data manca, un verde su un giro vecchio.
 *
 * Questa guardia fissa le regole, numero per numero:
 *
 *   1. SILENZIO — telemetria assente = nessun banner (mai un tono inventato);
 *   2. ORDINE DELLE PRIORITÀ — «toglie avvisi» prima di «li rende vecchi»: quarantena,
 *      poi errori, poi ritardo, infine il giro fresco;
 *   3. SOGLIE — `ORE_PRIMA_DEL_RITARDO` = 48 h; un istante nel futuro vale 0 ore e NON
 *      è un errore (gli orologi dei server non sono sincronizzati);
 *   4. NUMERI — un campo non letto resta «non lo so»: il dettaglio del giro fresco non
 *      stampa «null pagine» né zeri che nessuno ha misurato;
 *   5. MODULO PURO — `lib/telemetriaScansione` non importa React, Supabase né usa `fetch`;
 *   6. CABLAGGIO — il banner sta SOPRA `ElencoOpportunita` in `DashboardPage`, appare solo
 *      con sessione (`user &&`), e il componente non mostra nulla se la Edge tace.
 *
 * Uso: npm run test:telemetria-scansione  (incluso in `npm test`)
 */
import { readFileSync } from 'node:fs';
import {
  ORE_PRIMA_DEL_RITARDO,
  bannerScansione,
  durataLeggibile,
  oreDa,
} from '../src/lib/telemetriaScansione.ts';

declare const process: { exitCode?: number };

let errori = 0;
function check(nome: string, atteso: unknown, ottenuto: unknown): void {
  const ok = JSON.stringify(atteso) === JSON.stringify(ottenuto);
  if (!ok) errori += 1;
  console.log(`${ok ? '✓' : '✗'} ${nome}: atteso=${JSON.stringify(atteso)} ottenuto=${JSON.stringify(ottenuto)}`);
}
const leggi = (p: string): string => readFileSync(p, 'utf8');

/** Istante fisso: le regole si misurano su un orologio che non si muove. */
const ADESSO = new Date('2026-11-06T12:00:00.000Z');
/** `ore` prima di `ADESSO`, in ISO. */
const fa = (ore: number): string => new Date(ADESSO.getTime() - ore * 3_600_000).toISOString();

console.log('— 1. Silenzio: senza telemetria non si dice niente —');
check('assente → nessun banner', null, bannerScansione(null, ADESSO));
check('undefined → nessun banner', null, bannerScansione(undefined, ADESSO));

console.log('\n— 2. Un giro fresco e completo è verde —');
const fresco = bannerScansione(
  { ultima_scansione: fa(2), scansionate_24h: 412, pagine_in_coda: 0, in_errore: 0, fonti_isolate: [], fonti_in_guasto: 0 },
  ADESSO,
);
check('tono', 'fresca', fresco?.tono);
check('titolo', 'Albi letti di recente', fresco?.titolo);
check('dettaglio (senza coda a zero)', 'Ultima scansione 2 ore fa · 412 pagine lette nelle ultime 24 ore.', fresco?.dettaglio);

console.log('\n— 3. Il ritardo si misura sulla finestra delle fonti (48 h) —');
check('soglia dichiarata', 48, ORE_PRIMA_DEL_RITARDO);
check('47 h → ancora fresca', 'fresca', bannerScansione({ ultima_scansione: fa(47) }, ADESSO)?.tono);
const ritardo = bannerScansione({ ultima_scansione: fa(49) }, ADESSO);
check('49 h → in ritardo', 'in-ritardo', ritardo?.tono);
check('titolo con la durata in parole', 'Ultima scansione 2 giorni fa', ritardo?.titolo);

console.log('\n— 4. Le fonti isolate vengono PRIMA del ritardo —');
const isolata = bannerScansione(
  { ultima_scansione: fa(120), fonti_isolate: [{ url: 'a' }, { url: 'b' }, { url: 'c' }] },
  ADESSO,
);
check('tono', 'isolata', isolata?.tono);
check('titolo al plurale', '3 fonti isolate', isolata?.titolo);
check(
  'singolare',
  '1 fonte isolata',
  bannerScansione({ ultima_scansione: fa(1), fonti_isolate: [{ url: 'a' }] }, ADESSO)?.titolo,
);
check(
  'elenco non letto = nessuna accusa',
  'fresca',
  bannerScansione({ ultima_scansione: fa(1), fonti_isolate: null }, ADESSO)?.tono,
);

console.log('\n— 5. Gli errori sono un guasto dichiarato, non un numero a caso —');
const erroriRun = bannerScansione(
  { ultima_scansione: fa(3), in_errore: 2, ultima_run: { errori: 1 } },
  ADESSO,
);
check('vince il conteggio maggiore', '2 fonti in errore', erroriRun?.titolo);
check('tono', 'guasta', erroriRun?.tono);
check(
  'guasti senza essere isolati',
  '1 fonte in errore',
  bannerScansione({ ultima_scansione: fa(3), fonti_in_guasto: 1 }, ADESSO)?.titolo,
);

console.log('\n— 6. Nessun giro registrato è un guasto, non un «adesso» —');
const maiGirato = bannerScansione({ ultima_scansione: null, fonti_isolate: [] }, ADESSO);
check('tono', 'guasta', maiGirato?.tono);
check('titolo', 'Scansione non ancora registrata', maiGirato?.titolo);
check(
  'data illeggibile = stessa diagnosi',
  'guasta',
  bannerScansione({ ultima_scansione: 'ieri' }, ADESSO)?.tono,
);


console.log('\n— 7. Date e durate: nessun numero negativo, nessun «0 ore fa» —');
check('istante nel futuro → 0 ore', 0, oreDa('2027-01-01T00:00:00.000Z', ADESSO));
check('data assente → null', null, oreDa(null, ADESSO));
check('data illeggibile → null', null, oreDa('non-una-data', ADESSO));
check("sotto l'ora", "meno di un'ora fa", durataLeggibile(0.4));
check("un'ora (singolare)", "un'ora fa", durataLeggibile(1));
check('ieri', 'ieri', durataLeggibile(30));
check('due giorni', '2 giorni fa', durataLeggibile(52));
check('assente', 'non registrata', durataLeggibile(null));

console.log('\n— 8. Il modulo è puro: nessuna rete, nessun framework —');
const lib = leggi('src/lib/telemetriaScansione.ts');
check('nessun import da React', false, /from 'react'/.test(lib));
check('nessuna chiamata di rete', false, /\bfetch\(/.test(lib));
check('nessun client Supabase', false, /supabase/i.test(lib));
check('orologio iniettabile', true, /adesso: Date = new Date\(\)/.test(lib));

console.log('\n— 9. Cablaggio in bacheca —');
const pagina = leggi('src/pages/DashboardPage.tsx');
check('il banner è importato', true, /BannerTelemetriaScansione/.test(pagina));
check('appare solo con sessione', true, /\{user && <BannerTelemetriaScansione \/>\}/.test(pagina));
check(
  'sta SOPRA la bacheca',
  true,
  pagina.indexOf('<BannerTelemetriaScansione />') < pagina.indexOf('<ElencoOpportunita'),
);
const componente = leggi('src/pages/dashboard/components/BannerTelemetriaScansione.tsx');
check('la Edge che tace non produce banner', true, /\.catch\(\(\) => \{/.test(componente));
check('delega le regole alla lib', true, /bannerScansione\(dati\)/.test(componente));

console.log(`\n${errori === 0 ? '✓ guardia verde' : `✗ ${errori} verifiche fallite`}`);
if (errori > 0) process.exitCode = 1;

