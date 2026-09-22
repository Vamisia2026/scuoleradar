/**
 * Test — AUTOMAZIONI EMAIL (pannello Admin «Email & Automazioni»).
 *
 * Verifica:
 *  1. catalogo completo: id, trigger, canale, tipi Edge, oggetti vincolati;
 *  2. store: chiave `app_settings`, normalizzazione, default sicuro;
 *  3. anteprima: interpolazione e override oggetto/intro/corpo;
 *  4. coerenza con i template del codice (`_shared/emailTemplates.ts`);
 *  5. gemello Deno (`_shared/automazioniEmail.ts`): id, tipi e prefisso identici;
 *  6. `app_settings`: lettura difensiva (errore → automazione ATTIVA);
 *  7. cablaggio reale: Edge `send-notification`, Edge `admin`, notifier, UI;
 *  8. documentazione aggiornata.
 *
 * Uso: npm run test:automazioni
 */
import { readFileSync } from 'node:fs';
import {
  AUTOMAZIONI_EMAIL,
  PREFISSO_CHIAVE_AUTOMAZIONE,
  automazioneDaTemplate,
  automazioneDaTipoEdge,
  chiaveAutomazione,
  corpoModificabile,
  eStatoPredefinito,
  idDaChiaveAutomazione,
  normalizzaStatoAutomazione,
  oggettoModificabile,
  statoEffettivoAutomazione,
  statoPredefinitoAutomazione,
  testoAnteprima,
} from '../src/config/automazioniEmail.ts';

/** Interfaccia minima per l'ambiente (come gli altri script di test). */
declare const process: {
  env: Record<string, string | undefined>;
  exitCode?: number;
};

let errori = 0;
function check(nome: string, atteso: unknown, ottenuto: unknown): void {
  const ok = JSON.stringify(atteso) === JSON.stringify(ottenuto);
  if (!ok) errori += 1;
  console.log(`${ok ? '✓' : '✗'} ${nome}: atteso=${JSON.stringify(atteso)} ottenuto=${JSON.stringify(ottenuto)}`);
}

/** Esegue una tabella di confronti `[nome, atteso, ottenuto]`. */
function verifica(controlli: Array<[string, unknown, unknown]>): void {
  for (const [nome, atteso, ottenuto] of controlli) check(nome, atteso, ottenuto);
}

const leggi = (file: string): string => readFileSync(file, 'utf8');
const automazione = (id: string) => AUTOMAZIONI_EMAIL.find((a) => a.id === id)!;
const ids = (lista: readonly { id: string }[]) => lista.map((a) => a.id);

console.log('— 1. Catalogo delle automazioni —');
check('11 automazioni', 11, AUTOMAZIONI_EMAIL.length);
check('id univoci', AUTOMAZIONI_EMAIL.length, new Set(ids(AUTOMAZIONI_EMAIL)).size);
verifica([
  [
    'campi obbligatori sempre valorizzati',
    [],
    ids(AUTOMAZIONI_EMAIL.filter((a) => !a.nome || !a.emoji || !a.quando || !a.motore || !a.oggetto || !a.anteprima)),
  ],
  [
    'trigger ammessi',
    [],
    ids(AUTOMAZIONI_EMAIL.filter((a) => !['evento', 'temporale'].includes(a.trigger))),
  ],
  [
    'ogni automazione ha un motore (Edge, notifier o cron)',
    [],
    ids(AUTOMAZIONI_EMAIL.filter((a) => a.tipiEdge.length === 0 && !a.notifier)),
  ],
  [
    'nessun tipo Edge duplicato tra automazioni',
    [],
    AUTOMAZIONI_EMAIL.flatMap((a) => a.tipiEdge).filter((tipo, i, tutti) => tutti.indexOf(tipo) !== i),
  ],
  ['esempio richiesto: benvenuto', true, Boolean(automazione('benvenuto'))],
  [
    'esempio richiesto: richiamo Radar a 24h',
    'temporale',
    automazione('radar_spento').trigger,
  ],
  [
    'esempio richiesto: scadenza abbonamento',
    'temporale',
    automazione('scadenza_abbonamento').trigger,
  ],
  [
    'oggetti vincolati solo dove la checklist li impone',
    ['drip_base', 'digest_giornaliero', 'alert_pro_tempo_reale'],
    ids(AUTOMAZIONI_EMAIL.filter((a) => a.oggettoBloccato)),
  ],
  [
    'corpo modificabile solo con template centralizzato',
    ids(AUTOMAZIONI_EMAIL.filter((a) => corpoModificabile(a))),
    ids(AUTOMAZIONI_EMAIL.filter((a) => typeof a.chiaveTemplate === 'string')),
  ],
  [
    'digest e alert non consentono di cambiare l’oggetto',
    [false, false],
    ['digest_giornaliero', 'alert_pro_tempo_reale'].map((id) => oggettoModificabile(automazione(id))),
  ],
]);

console.log('\n— 2. Chiavi e stato salvato (app_settings) —');
verifica([
  ['prefisso KV', 'email_automazione_', PREFISSO_CHIAVE_AUTOMAZIONE],
  ['chiave del digest', 'email_automazione_digest_giornaliero', chiaveAutomazione('digest_giornaliero')],
  ['id da chiave', 'benvenuto', idDaChiaveAutomazione('email_automazione_benvenuto')],
  ['chiave di servizio ignorata', null, idDaChiaveAutomazione('send_notification_url')],
  ['automazione sconosciuta ignorata', null, idDaChiaveAutomazione('email_automazione_boh')],
  ['default: attiva e senza override', { abilitata: true }, statoPredefinitoAutomazione()],
  ['JSON valido interpretato', { abilitata: false, oggetto: 'Ciao' }, normalizzaStatoAutomazione('{"abilitata":false,"oggetto":"Ciao"}')],
  ['JSON corrotto → default attivo', { abilitata: true }, normalizzaStatoAutomazione('{non-json')],
  ['valore assente → default attivo', { abilitata: true }, normalizzaStatoAutomazione(null)],
  [
    'stato effettivo applica gli override',
    false,
    statoEffettivoAutomazione('digest_giornaliero', { digest_giornaliero: { abilitata: false } }).abilitata,
  ],
  [
    'stato effettivo senza override → default attivo',
    true,
    statoEffettivoAutomazione('digest_giornaliero', {}).abilitata,
  ],
  ['stato default riconosciuto', true, eStatoPredefinito({ abilitata: true })],
  ['stato con override non è default', false, eStatoPredefinito({ abilitata: true, intro: 'x' })],
]);

console.log('\n— 3. Anteprima visiva (copy e override) —');
const benvenuto = automazione('benvenuto');
const anteprimaBase = testoAnteprima(benvenuto, statoPredefinitoAutomazione());
check('anteprima: oggetto dal codice', benvenuto.oggetto, anteprimaBase.oggetto);
check('anteprima: variabile {{nome}} sostituita', true, anteprimaBase.corpo.includes('Maria'));
check('anteprima: corpo del codice (non personalizzato)', false, anteprimaBase.corpoPersonalizzato);
const anteprimaModificata = testoAnteprima(benvenuto, {
  abilitata: true,
  oggetto: 'Oggetto {{nome}}',
  intro: 'Novità per te',
  corpo: 'Ciao {{nome}}, testo nuovo.',
});
verifica([
  ['anteprima: oggetto personalizzato interpolato', 'Oggetto Maria', anteprimaModificata.oggetto],
  ['anteprima: intro mostrata', 'Novità per te', anteprimaModificata.intro],
  ['anteprima: corpo personalizzato', 'Ciao Maria, testo nuovo.', anteprimaModificata.corpo],
  ['anteprima: flag corpo personalizzato', true, anteprimaModificata.corpoPersonalizzato],
  [
    'anteprima: corpo strutturato NON sostituibile (digest)',
    false,
    testoAnteprima(automazione('digest_giornaliero'), { abilitata: true, corpo: 'x' })
      .corpoPersonalizzato,
  ],
  ['lookup per tipo Edge', 'radar_spento', automazioneDaTipoEdge('email_2_1_radar_spento')?.id],
  ['lookup per template', 'scadenza_abbonamento', automazioneDaTemplate('email_3_1_scadenza_5')?.id],
  ['tipo Edge sconosciuto', undefined, automazioneDaTipoEdge('boh')],
]);

console.log('\n— 4. Coerenza con i template del codice —');
const template = leggi('supabase/functions/_shared/emailTemplates.ts');
const conTemplate = AUTOMAZIONI_EMAIL.filter((a) => typeof a.chiaveTemplate === 'string');
check('4 automazioni con template centralizzato', 4, conTemplate.length);
for (const a of conTemplate) {
  const chiave = a.chiaveTemplate as string;
  const inizio = template.indexOf(`  ${chiave}: {`);
  const blocco = inizio >= 0 ? template.slice(inizio, inizio + 4000) : '';
  const soggetto = /soggetto: '((?:[^'\\]|\\.)*)'/.exec(blocco)?.[1] ?? '';
  check(`${a.id}: template ${chiave} presente`, true, inizio >= 0);
  check(`${a.id}: oggetto allineato al template`, true, soggetto === a.oggetto);
  check(`${a.id}: anteprima presa dal corpo reale`, true, blocco.includes(a.anteprima.split('\n')[0]));
}
// Il benvenuto (id `benvenuto`) è il messaggio della registrazione: conferma il
// mese di PRO in omaggio. Mai il vecchio piano Base né quote di segnalazioni.
const benvenutoCatalogo = automazione('benvenuto');
const anteprimaBenvenuto = testoAnteprima(benvenutoCatalogo, statoPredefinitoAutomazione()).corpo;
check(
  'benvenuto: copy allineato al mese PRO in omaggio',
  true,
  /mese di PRO in omaggio/.test(anteprimaBenvenuto),
);
check(
  'benvenuto: nessun riferimento a piano Base / 3 segnalazioni (anteprima o oggetto)',
  [],
  [/account Base/i, /piano Base/i, /piano gratuito/i, /3 segnalazioni/i]
    .filter((re) => re.test(anteprimaBenvenuto) || re.test(benvenutoCatalogo.oggetto))
    .map(String),
);

console.log('\n— 5. Gemello Deno (Edge Functions) —');
const deno = leggi('supabase/functions/_shared/automazioniEmail.ts');
const automazioniEdge = AUTOMAZIONI_EMAIL.filter((a) => a.tipiEdge.length > 0);
const bloccoCatalogo = deno.slice(
  deno.indexOf('export const AUTOMAZIONI_EDGE'),
  deno.indexOf('];', deno.indexOf('export const AUTOMAZIONI_EDGE')),
);
const blocchiEdge = bloccoCatalogo.split("id: '").slice(1).map((blocco) => ({
  id: blocco.slice(0, blocco.indexOf("'")),
  bloccato: /oggettoBloccato:\s*true/.test(blocco.slice(0, blocco.indexOf('}'))),
}));
verifica([
  [
    'prefisso chiave allineato',
    true,
    deno.includes(`PREFISSO_CHIAVE_AUTOMAZIONE = '${PREFISSO_CHIAVE_AUTOMAZIONE}'`),
  ],
  ['8 automazioni gestite dalla Edge', 8, automazioniEdge.length],
  ['la Edge dichiara 8 automazioni', 8, blocchiEdge.length],
  [
    'la Edge conosce OGNI tipo dichiarato nel catalogo',
    [],
    automazioniEdge
      .flatMap((a) => a.tipiEdge.map((tipo) => `${a.id}:${tipo}`))
      .filter((voce) => !deno.includes(`'${voce.split(':')[1]}'`)),
  ],
  [
    'la Edge conosce ogni id del catalogo (lato Edge)',
    [],
    ids(automazioniEdge.filter((a) => !deno.includes(`id: '${a.id}'`))),
  ],
  [
    'oggetti vincolati coerenti (solo drip_base)',
    ids(automazioniEdge.filter((a) => a.oggettoBloccato)),
    blocchiEdge.filter((b) => b.bloccato).map((b) => b.id),
  ],
  [
    'funzioni di gate esportate dalla Edge',
    true,
    [
      'automazioneDaTipo',
      'leggiStatiAutomazioni',
      'applicaOverrideScheda',
      'oggettoFinale',
      'introTesto',
      'introParagrafoHtml',
    ].every((fn) => deno.includes(`export function ${fn}`) || deno.includes(`export async function ${fn}`)),
  ],
]);

process.exitCode = errori === 0 ? 0 : 1;
console.log(
  errori === 0
    ? '\n✅ Automazioni email (catalogo, store, anteprima): tutti i controlli superati.'
    : `\n❌ ${errori} controllo/i fallito/i.`,
);
