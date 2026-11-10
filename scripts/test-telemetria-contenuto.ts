/**
 * GUARDIA — IL CONTENUTO DEL BANNER DELLA SCANSIONE (§26.151): cosa si dice quando non si sa.
 * -----------------------------------------------------------------------------------
 * Il banner vive di tre numeri e di una frase. Tutto il rischio sta in quel poco: un «0
 * avvisi scartati» quando la Edge non ha risposto, un «tutto ok» su un radar che non ha mai
 * girato, un «1.200+» su un numero che nessuno ha letto, un «IN DIRETTA» su un ciclo vecchio.
 *
 * Questa guardia difende la parte che si può verificare senza contesto (le altre due sono
 * `test-telemetria-scansione` per gli stati e `test-telemetria-cablaggio` per i fili):
 *
 *   1. AVVIO — nessun ciclo leggibile: badge `IN INIZIALIZZAZIONE`, «Radar in avvio», mai «tutto ok»;
 *   2. MISURE — le misure esistono solo se misurate (mai «0» inventati);
 *   3. FRASI — migliaia all'italiana, singolari, «+» solo per difetto, zero mai dichiarato;
 *   4. MODULI PURI — `telemetriaScansione`, `finestraScansione`, `…Copy`: senza React né rete.
 *
 * Uso: npm run test:telemetria-contenuto  (incluso in `npm test`)
 */
import { readFileSync } from 'node:fs';
import { bannerScansione } from '../src/lib/telemetriaScansione.ts';
import {
  almenoCentinaia,
  fraseBacheche,
  frasePosizioni,
  fraseScartati,
  migliaia,
} from '../src/lib/telemetriaScansioneCopy.ts';

declare const process: { exitCode?: number };

let errori = 0;
function check(nome: string, atteso: unknown, ottenuto: unknown): void {
  const ok = JSON.stringify(atteso) === JSON.stringify(ottenuto);
  if (!ok) errori += 1;
  console.log(`${ok ? '✓' : '✗'} ${nome}: atteso=${JSON.stringify(atteso)} ottenuto=${JSON.stringify(ottenuto)}`);
}
const leggi = (p: string): string => readFileSync(p, 'utf8');
/** Il fatto, non il periodo: per i dettagli lunghi si verifica la sottostringa. */
const contiene = (nome: string, atteso: boolean, testo: string | undefined, ago: RegExp): void =>
  check(nome, atteso, ago.test(testo ?? ''));

/** Venerdì 6 novembre 2026, 13:00 a Roma: la finestra è APERTA (8 ≤ 13 < 17). */
const ADESSO = new Date('2026-11-06T12:00:00.000Z');
/** `ore` prima di `adesso`, in ISO. */
const fa = (ore: number, adesso: Date = ADESSO): string =>
  new Date(adesso.getTime() - ore * 3_600_000).toISOString();

console.log('— 1. Nessun ciclo leggibile a finestra aperta: si dice, non si finge —');
const maiGirato = bannerScansione({ ultima_scansione: null, fonti_isolate: [] }, ADESSO);
check('tono', 'guasta', maiGirato?.tono);
check('badge', 'IN INIZIALIZZAZIONE', maiGirato?.badge);
check('titolo', 'Radar in avvio', maiGirato?.titolo);
check('data illeggibile = stessa diagnosi', 'guasta', bannerScansione({ ultima_scansione: 'ieri' }, ADESSO)?.tono);
contiene('e promette i dati della zona e l’archivio, non un orario', true, maiGirato?.dettaglio, /sta allineando i dati della tua zona/);
contiene('l’avvio dice anche dove guardare subito', true, maiGirato?.dettaglio, /opportunità già disponibili in archivio/);

console.log('\n— 2. Le misure esistono solo se misurate —');
check(
  'un solo campo letto → un solo numero',
  [{ etichetta: 'Bacheche controllate', valore: '1.284' }],
  bannerScansione({ ultimo_ciclo: fa(0.5), scansionate_24h: 1284 }, ADESSO)?.misure,
);
check('la coda non è una misura da mostrare', [], bannerScansione({ ultimo_ciclo: fa(0.5), pagine_in_coda: 0 }, ADESSO)?.misure);
check('nessun campo → nessuna misura', 0, bannerScansione({ ultimo_ciclo: fa(0.5) }, ADESSO)?.misure.length);
contiene('i campi non letti non finiscono nel testo', false, bannerScansione({ ultimo_ciclo: fa(0.5) }, ADESSO)?.dettaglio, /null|undefined|NaN/i);
check('un valore sporco non diventa una misura', 0, bannerScansione({ ultimo_ciclo: fa(0.5), scansionate_24h: Number.NaN }, ADESSO)?.misure.length);

console.log('\n— 3. Le frasi: migliaia all’italiana, singolari, «+» solo per difetto —');
check('«700+» su 712', '700+', almenoCentinaia(712));
check('«1.200+» su 1284', '1.200+', almenoCentinaia(1284));
check('sotto le 200 unità niente «+»', '48', almenoCentinaia(48));
check('migliaia con il punto', '1.284', migliaia(1284));
check('una bacheca (singolare)', '1 bacheca scolastica analizzata nelle ultime 24 ore', fraseBacheche(1));
check(
  'zero bacheche non si dichiara: la riga sparisce, non rassicura',
  null,
  fraseBacheche(0),
);
check('campo assente → nessuna frase', null, fraseBacheche(null));
check('un avviso scartato (singolare)', '1 avviso scartato perché non pertinente', fraseScartati(1));
check('nessuno scarto dichiarato: nessuna riga', null, fraseScartati(0));
check('campo assente → nessuna frase sugli scarti', null, fraseScartati(null));
check('una posizione selezionata (singolare)', '1 posizione selezionata', frasePosizioni(1));
check('campo assente → nessuna frase sulle posizioni', null, frasePosizioni(null));

console.log('\n— 4. I moduli sono puri: nessuna rete, nessun framework —');
const copia = leggi('src/lib/telemetriaScansioneCopy.ts');
const orologio = leggi('src/lib/finestraScansione.ts');
const lib = leggi('src/lib/telemetriaScansione.ts') + copia + orologio;
check('nessun import da React', false, /from 'react'/.test(lib));
check('nessuna chiamata di rete', false, /\bfetch\(/.test(lib));
check('nessun client Supabase', false, /supabase/i.test(lib));
check('orologio iniettabile (banner)', true, /adesso: Date = new Date\(\)/.test(lib));
check('orologio iniettabile (finestra)', true, /finestraAperta\(adesso: Date = new Date\(\)\)/.test(orologio));
check('fuso esplicito, mai quello del browser', true, /timeZone: FUSO_ITALIA/.test(orologio));
check('nessun Intl.NumberFormat (stesso risultato in locale e in CI)', false, /new Intl\./.test(copia));

console.log(`\n${errori === 0 ? '✓ guardia verde' : `✗ ${errori} verifiche fallite`}`);
if (errori > 0) process.exitCode = 1;

