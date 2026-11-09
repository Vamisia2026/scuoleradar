/**
 * GUARDIA — IL BANNER DELLA SCANSIONE, LATO CABLAGGIO (§26.151 · §26.152).
 * -----------------------------------------------------------------------------------
 * Gemella di `test-telemetria-scansione`: quella difende il CONTENUTO (che cosa il banner
 * dice, e che non inventi nulla), questa difende i FILI — che il banner sia davvero montato
 * in bacheca, che la Edge che tace non produca un badge, e che le costanti della lib
 * (`ORA_APERTURA` 8, `ORA_CHIUSURA` 17, `GIORNI_APERTURA` 1-5) siano le STESSE del cron e del
 * gate del workflow `coda-scansione.yml`. Una finestra dichiarata in due posti è una finestra
 * che prima o poi si sdoppia: qui si verifica che non sia già successo.
 *
 * Il taglio non è estetico: `scripts/check-architettura.ts` impone 300 righe per file, e la
 * guardia gemella è già al limite.
 *
 * Uso: npm run test:telemetria-cablaggio  (incluso in `npm test`)
 */
import { readFileSync } from 'node:fs';
import { GIORNI_APERTURA, ORA_APERTURA, ORA_CHIUSURA } from '../src/lib/finestraScansione.ts';

declare const process: { exitCode?: number };

let errori = 0;
function check(nome: string, atteso: unknown, ottenuto: unknown): void {
  const ok = JSON.stringify(atteso) === JSON.stringify(ottenuto);
  if (!ok) errori += 1;
  console.log(`${ok ? '✓' : '✗'} ${nome}: atteso=${JSON.stringify(atteso)} ottenuto=${JSON.stringify(ottenuto)}`);
}
const leggi = (p: string): string => readFileSync(p, 'utf8');

console.log('— 1. Cablaggio in bacheca: badge, luna dello standby, zero allarmi —');
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
check('lo standby ha la sua icona (luna)', true, /Icona: Moon/.test(componente));
check(
  'cinque toni vestiti (standby compreso)',
  true,
  /standby: \{[\s\S]*?live: \{[\s\S]*?attivo: \{[\s\S]*?'in-ritardo': \{[\s\S]*?guasta: \{/.test(componente),
);
check('badge «IN DIRETTA» verde', true, /bg-accent-500/.test(componente));
check('niente icone d’allarme nel banner', false, /⛔|⚠|🚫/.test(componente));
check('niente fondi o bordi da errore/allarme', false, /bg-warning-|bg-error-|border-warning-/.test(componente));
check('niente frasi di quarantena (i dettagli stanno in Admin)', false, /quarantena protetta|sorgenti in quarantena/i.test(componente));

console.log('\n— 2. Contratto col worker: cron e gate dicono gli stessi numeri della lib —');
const workflow = leggi('.github/workflows/coda-scansione.yml');
const pianificazione = /cron:\s*'(\d+)\s+([\d-]+)\s+\*\s+\*\s+([\d-]+)'/.exec(workflow);
check('il workflow ha una pianificazione a ore', true, Boolean(pianificazione));
check(
  'lo span UTC copre i due fusi (apertura −2 … chiusura −2)',
  `${ORA_APERTURA - 2}-${ORA_CHIUSURA - 2}`,
  pianificazione?.[2],
);
check(
  'i giorni del cron sono quelli aperti',
  `${GIORNI_APERTURA[0]}-${GIORNI_APERTURA[GIORNI_APERTURA.length - 1]}`,
  pianificazione?.[3],
);
const minuti = Number(pianificazione?.[1]);
check('minuto sfasato, non allo scoccare dell’ora', true, minuti >= 0 && minuti < 60);
check('il gate legge l’ora di Roma, non quella del runner', true, /TZ=Europe\/Rome date/.test(workflow));
check('il gate apre alle 08:00', ORA_APERTURA, Number(/-ge (\d+)/.exec(workflow)?.[1]));
check('il gate chiude alle 17:00', ORA_CHIUSURA, Number(/-lt (\d+)/.exec(workflow)?.[1]));
check('il gate chiude anche i giorni feriali', GIORNI_APERTURA.length, Number(/-le (\d+)/.exec(workflow)?.[1]));
check(
  'i job pesanti partono solo a finestra aperta',
  true,
  /if: needs\.prepara\.outputs\.aperta == 'true'/.test(workflow),
);
check('un avvio manuale salta il gate', true, /"workflow_dispatch" \]; then/.test(workflow));
check('esegue la coda regionale', true, /npm run scrape:coda/.test(workflow));
check('un giro alla volta', true, /concurrency:/.test(workflow));
const edge = leggi('supabase/functions/crawler-admin/index.ts');
check('espone il segnale di vita', true, /ultimo_ciclo: piuRecente\(/.test(edge));
check('espone gli scarti (la misura «fuori tema»)', true, /scarti:/.test(edge));
check('espone i giri delle 24 ore', true, /cicli_24h:/.test(edge));
check('espone le province coperte', true, /province_coperte:/.test(edge));
check('il contratto del client li dichiara', true, /ultimo_ciclo\?:/.test(leggi('src/services/crawlerTelemetry.ts')));

console.log(`\n${errori === 0 ? '✓ guardia verde' : `✗ ${errori} verifiche fallite`}`);
if (errori > 0) process.exitCode = 1;
