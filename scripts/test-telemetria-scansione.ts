/**
 * GUARDIA — IL BANNER DELLA SCANSIONE (§26.146 · §26.149 · §26.150).
 * -----------------------------------------------------------------------------------
 * Il banner dice quanto sta lavorando il radar che l'utente sta guardando: pagine lette nelle
 * 24 ore, fonti chiuse senza errori, opportunità attive rilevate, copertura. Dal §26.150 il
 * registro è quello della «prova di lavoro» — badge verde LIVE, cifre in evidenza, età del
 * giro in minuti o in ore — e i dettagli tecnici sulle fonti temporaneamente sorde
 * (quarantena, errori per fonte) NON compaiono più nel testo.
 *
 * Il rischio di un contenuto così è tutto in una parola: INVENTARE. Un «0 fonti in errore»
 * quando la Edge non ha risposto, un «adesso» quando la data manca, un «LIVE» su un ciclo
 * vecchio, un «700+» su un numero non letto, una cadenza promessa che il worker non tiene.
 * Le dodici regole verificate qui sotto:
 *
 *   1. SILENZIO — telemetria assente = nessun banner;
 *   2. IN DIRETTA — badge LIVE, «1.200+ opportunità attive rilevate», cifre in evidenza;
 *   3. FRESCHEZZA — `ultimo_ciclo` batte `ultima_scansione`;
 *   4. SOGLIE — live < 1,5 h · attivo ≤ 24 h · in-ritardo oltre · guasta senza ciclo;
 *   5. MAI IN GIORNI — l'età resta in minuti o in ore, anche oltre le 48;
 *   6. NIENTE REFERTO TECNICO — quarantena ed errori per fonte fuori dal testo;
 *   7. AVVIO — nessun ciclo leggibile: «in avvio», mai «tutto ok»;
 *   8. DATE E DURATE — minuti, singolari, istanti nel futuro;
 *   9. NUMERI — le misure esistono solo se misurate (mai «0» inventati);
 *  10. MODULO PURO — `lib/telemetriaScansione` (e il gemello `…Copy`) senza React né `fetch`;
 *  11. CABLAGGIO — badge verde, nessuna icona o fondo d'allarme, polling e focus;
 *  12. WORKER — ciclo ORARIO che alimenta la telemetria, campi esposti dalla Edge.
 *
 * Uso: npm run test:telemetria-scansione  (incluso in `npm test`)
 */
import { readFileSync } from 'node:fs';
import {
  ORE_CADENZA,
  ORE_LIVE,
  ORE_PRIMA_DEL_RITARDO,
  bannerScansione,
  durataLeggibile,
  durataTrascorsa,
  oreDa,
} from '../src/lib/telemetriaScansione.ts';
import { almenoCentinaia, fontiElaborate } from '../src/lib/telemetriaScansioneCopy.ts';

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

/** Istante fisso: le regole si misurano su un orologio che non si muove. */
const ADESSO = new Date('2026-11-06T12:00:00.000Z');
/** `ore` prima di `ADESSO`, in ISO. */
const fa = (ore: number): string => new Date(ADESSO.getTime() - ore * 3_600_000).toISOString();

console.log('— 1. Silenzio: senza telemetria non si dice niente —');
check('assente → nessun banner', null, bannerScansione(null, ADESSO));
check('undefined → nessun banner', null, bannerScansione(undefined, ADESSO));

console.log('\n— 2. Un ciclo in diretta: badge LIVE e prova di lavoro —');
const live = bannerScansione(
  { ultimo_ciclo: fa(0.25), fonti_whitelist: 512, province_coperte: 87, interpelli_attivi: 1284,
    cicli_24h: 24, scansionate_24h: 412, pagine_in_coda: 0, in_errore: 0, fonti_isolate: [], fonti_in_guasto: 0 },
  ADESSO,
);
check('tono', 'live', live?.tono);
check('badge', 'LIVE', live?.badge);
check('titolo: la cifra «prova di lavoro» arrotondata PER DIFETTO', 'Radar in tempo reale · 1.200+ opportunità attive rilevate', live?.titolo);
check('dettaglio: giro, pagine lette, fonti riuscite — nient’altro', 'Ultimo giro 15 minuti fa · 412 pagine lette nelle ultime 24 ore · 512 fonti elaborate con successo.', live?.dettaglio);
check(
  'misure in evidenza (migliaia all’italiana e «+» sulle centinaia)',
  [
    { etichetta: 'Scansioni 24h', valore: '412' },
    { etichetta: 'Fonti elaborate', valore: '512' },
    { etichetta: 'Avvisi attivi', valore: '1.200+' },
    { etichetta: 'Copertura', valore: '87' },
  ],
  live?.misure,
);
check('senza opportunità misurate il titolo non inventa una cifra', 'Radar in tempo reale · ciclo appena completato', bannerScansione({ ultimo_ciclo: fa(0.5) }, ADESSO)?.titolo);

console.log('\n— 3. Il segnale di vita batte il singolo timestamp —');
check('ultimo_ciclo vince su ultima_scansione', 'live', bannerScansione({ ultimo_ciclo: fa(0.2), ultima_scansione: fa(50) }, ADESSO)?.tono);
check('senza ultimo_ciclo si ripiega su ultima_scansione', 'in-ritardo', bannerScansione({ ultima_scansione: fa(50) }, ADESSO)?.tono);
const attivo = bannerScansione({ ultimo_ciclo: fa(2), province_coperte: 87 }, ADESSO);
check('2 ore → attivo', 'attivo', attivo?.tono);
check('badge', 'OPERATIVO', attivo?.badge);
check('titolo con le province', 'Radar operativo · copertura su 87 province', attivo?.titolo);
check('copertura non letta: nessun numero inventato', 'Radar operativo · copertura continua', bannerScansione({ ultimo_ciclo: fa(2) }, ADESSO)?.titolo);

console.log('\n— 4. Le soglie: 1,5 h per la diretta, 24 h per il fermo —');
check('cadenza dichiarata (ore)', 1, ORE_CADENZA);
check('soglia diretta', 1.5, ORE_LIVE);
check('soglia fermo', 24, ORE_PRIMA_DEL_RITARDO);
check('1 h → live', 'live', bannerScansione({ ultimo_ciclo: fa(1) }, ADESSO)?.tono);
check('23 h → ancora attivo', 'attivo', bannerScansione({ ultimo_ciclo: fa(23) }, ADESSO)?.tono);
check('25 h → in ritardo', 'in-ritardo', bannerScansione({ ultimo_ciclo: fa(25) }, ADESSO)?.tono);
const fermo = bannerScansione({ ultimo_ciclo: fa(50) }, ADESSO);
check('badge dell’attesa', 'IN ATTESA', fermo?.badge);
check('50 h → titolo in ORE, non in giorni', 'Ultimo giro 50 ore fa', fermo?.titolo);
check('25 h → titolo in ORE', 'Ultimo giro 25 ore fa', bannerScansione({ ultimo_ciclo: fa(25) }, ADESSO)?.titolo);
contiene('il fermo dice che il ciclo è orario', true, fermo?.dettaglio, /ciclo automatico è orario/);

console.log('\n— 5. La freschezza si dice in minuti o in ore, MAI in giorni —');
const eta = [0.5, 3, 23, 25, 30, 50, 72, 240].map((ore) => durataLeggibile(ore));
check('nessuna durata nomina giorni o «ieri»', [], eta.filter((t) => /giorn|ieri/.test(t)));
check('30 ore restano 30 ore', '30 ore fa', durataLeggibile(30));
check('52 ore restano 52 ore', '52 ore fa', durataLeggibile(52));
check('dieci giorni restano ore', '240 ore fa', durataLeggibile(240));
contiene('anche un fermo lunghissimo non dice «giorni»', false, bannerScansione({ ultimo_ciclo: fa(240) }, ADESSO)?.titolo, /giorn|ieri/);
check('durata senza «fa» (per il titolo)', '2 ore', durataTrascorsa(2));

console.log('\n— 6. Niente referto tecnico: le fonti sorde restano fuori dal banner —');
const sorde = bannerScansione({ ultimo_ciclo: fa(0.5), fonti_isolate: Array.from({ length: 205 }, () => ({ url: 'a' })), fonti_whitelist: 512, in_errore: 7 }, ADESSO);
contiene('nessuna quarantena nel dettaglio', false, sorde?.dettaglio, /quarantena|isolat/i);
contiene('nessun errore per fonte nel dettaglio', false, sorde?.dettaglio, /error|risposto male/i);
check('nessun chip di quarantena', undefined, sorde?.misure.find((m) => /quarantena/i.test(m.etichetta)));
check('le fonti riuscite si contano (512 in ascolto, 7 in errore → 505)', { etichetta: 'Fonti elaborate', valore: '505' }, sorde?.misure.find((m) => m.etichetta === 'Fonti elaborate'));
check('senza il conto degli errori NON si dichiara «tutte riuscite»', null, fontiElaborate(512, null));
check('…e il chip non compare affatto', undefined, bannerScansione({ ultimo_ciclo: fa(0.5), fonti_whitelist: 512 }, ADESSO)?.misure.find((m) => m.etichetta === 'Fonti elaborate'));
check('mai un numero negativo di fonti riuscite', 0, fontiElaborate(3, 6));

console.log('\n— 7. Nessun ciclo leggibile: si dice, non si finge —');
const maiGirato = bannerScansione({ ultima_scansione: null, fonti_isolate: [] }, ADESSO);
check('tono', 'guasta', maiGirato?.tono);
check('badge', 'IN AVVIO', maiGirato?.badge);
check('titolo', 'Radar in avvio · primo giro in corso', maiGirato?.titolo);
check('data illeggibile = stessa diagnosi', 'guasta', bannerScansione({ ultima_scansione: 'ieri' }, ADESSO)?.tono);
contiene('e non promette nulla', true, maiGirato?.dettaglio, /non è ancora registrato/);

console.log('\n— 8. Date e durate: i minuti ci sono, i numeri negativi no —');
check('istante nel futuro → 0 ore', 0, oreDa('2027-01-01T00:00:00.000Z', ADESSO));
check('data assente → null', null, oreDa(null, ADESSO));
check('data illeggibile → null', null, oreDa('non-una-data', ADESSO));
check('pochi secondi', 'adesso', durataLeggibile(0.001));
check('un minuto (singolare)', 'un minuto fa', durataLeggibile(1 / 60));
check('mezz’ora', '30 minuti fa', durataLeggibile(0.5));
check("un'ora (singolare)", "un'ora fa", durataLeggibile(1));
check('due ore', '2 ore fa', durataLeggibile(2));
check('assente', 'non registrata', durataLeggibile(null));

console.log('\n— 9. Le misure esistono solo se misurate —');
check('un solo campo letto → un solo numero', [{ etichetta: 'Scansioni 24h', valore: '1.284' }], bannerScansione({ ultimo_ciclo: fa(0.5), scansionate_24h: 1284 }, ADESSO)?.misure);
check('la coda non è una misura da mostrare', [], bannerScansione({ ultimo_ciclo: fa(0.5), pagine_in_coda: 0 }, ADESSO)?.misure);
check('nessun campo → nessuna misura', 0, bannerScansione({ ultimo_ciclo: fa(0.5) }, ADESSO)?.misure.length);
contiene('i campi non letti non finiscono nel testo', false, bannerScansione({ ultimo_ciclo: fa(0.5) }, ADESSO)?.dettaglio, /null|undefined|NaN/i);
check('«700+» su 712', '700+', almenoCentinaia(712));
check('«1.200+» su 1284', '1.200+', almenoCentinaia(1284));
check('sotto le 200 unità niente «+»', '48', almenoCentinaia(48));
check('un valore sporco non diventa una misura', 0, bannerScansione({ ultimo_ciclo: fa(0.5), scansionate_24h: Number.NaN }, ADESSO)?.misure.length);

console.log('\n— 10. I moduli sono puri: nessuna rete, nessun framework —');
const copia = leggi('src/lib/telemetriaScansioneCopy.ts');
const lib = leggi('src/lib/telemetriaScansione.ts') + copia;
check('nessun import da React', false, /from 'react'/.test(lib));
check('nessuna chiamata di rete', false, /\bfetch\(/.test(lib));
check('nessun client Supabase', false, /supabase/i.test(lib));
check('orologio iniettabile', true, /adesso: Date = new Date\(\)/.test(lib));
check('il gemello dei numeri non tocca la rete', false, /\bfetch\(|createClient/.test(copia));
check('nessun Intl.NumberFormat (stesso risultato in locale e in CI)', false, /new Intl\./.test(copia));

console.log('\n— 11. Cablaggio in bacheca: badge verde, zero allarmi, si rilegge da solo —');
const pagina = leggi('src/pages/DashboardPage.tsx');
check('il banner è importato', true, /BannerTelemetriaScansione/.test(pagina));
check('appare solo con sessione', true, /\{user && <BannerTelemetriaScansione \/>\}/.test(pagina));
check('sta SOPRA la bacheca', true, pagina.indexOf('<BannerTelemetriaScansione />') < pagina.indexOf('<ElencoOpportunita'));
const componente = leggi('src/pages/dashboard/components/BannerTelemetriaScansione.tsx');
check('la Edge che tace non produce banner', true, /\.catch\(\(\) => \{/.test(componente));
check('delega le regole alla lib', true, /bannerScansione\(dati, adesso\)/.test(componente));
check('rilegge lo stato a intervalli', true, /setInterval\([\s\S]*RILETTURA_MS/.test(componente));
check('rilegge al ritorno sulla scheda', true, /removeEventListener\('focus'/.test(componente));
check('orologio interno per l’età del ciclo', true, /setAdesso\(new Date\(\)\)/.test(componente));
check('badge LIVE verde', true, /bg-accent-500/.test(componente));
check('niente icone d’allarme nel banner', false, /⛔|⚠|🚫/.test(componente));
check('niente fondi o bordi da errore/allarme', false, /bg-warning-|bg-error-|border-warning-/.test(componente));
check('niente frasi di quarantena nel componente (i dettagli stanno in Admin)', false, /quarantena protetta|sorgenti in quarantena/i.test(componente));

console.log('\n— 12. Il worker gira ogni ora e la telemetria lo registra —');
const cron = leggi('.github/workflows/coda-scansione.yml');
check('cron ORARIO (campo ora = *)', true, /cron: '\d+ \* \* \* \*'/.test(cron));
check('esegue la coda regionale', true, /npm run scrape:coda/.test(cron));
check('un giro alla volta', true, /concurrency:/.test(cron));
const edge = leggi('supabase/functions/crawler-admin/index.ts');
check('espone il segnale di vita', true, /ultimo_ciclo: piuRecente\(/.test(edge));
check('espone i giri delle 24 ore', true, /cicli_24h:/.test(edge));
check('espone le province coperte', true, /province_coperte:/.test(edge));
check('il contratto del client li dichiara', true, /ultimo_ciclo\?:/.test(leggi('src/services/crawlerTelemetry.ts')));

console.log(`\n${errori === 0 ? '✓ guardia verde' : `✗ ${errori} verifiche fallite`}`);
if (errori > 0) process.exitCode = 1;


