/**
 * Test — CABLAGGIO delle automazioni email (pannello Admin «Email & Automazioni»).
 *
 * Seconda parte di `test-automazioni-email.ts` (catalogo, store e anteprima):
 * verifica il CABLAGGIO reale nei punti di invio e nel pannello.
 *   · lettura difensiva della KV `app_settings` (errore → automazione ATTIVA);
 *   · Edge `send-notification` (interruttore + testi del pannello);
 *   · Edge `admin` (azioni `list_email_automations` / `set_email_automation`);
 *   · notifier Node (digest, alert PRO, promemoria 24h);
 *   · UI del pannello (riga, anteprima, editor copy, hook, servizio);
 *   · documentazione aggiornata.
 *
 * Uso: npm run test:automazioni
 */
import { readFileSync } from 'node:fs';
import type { SupabaseClient } from '@supabase/supabase-js';
import { oggettoConsentito, resetCacheAutomazioni, statoAutomazioneEmail } from '../src/lib/automazioniEmailDb.ts';

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

console.log('\n— 6. Lettura dello stato: sempre difensiva —');
type RigaKv = { key: string; value: string };
function clientKv(righe: RigaKv[] | 'errore'): SupabaseClient {
  return {
    from: () => ({
      select: () =>
        righe === 'errore'
          ? Promise.reject(new Error('rete non raggiungibile'))
          : Promise.resolve({ data: righe, error: null }),
    }),
  } as unknown as SupabaseClient;
}
const rigaDigestSpento = [
  { key: 'email_automazione_digest_giornaliero', value: '{"abilitata":false}' },
];
const digestSpento = await statoAutomazioneEmail(clientKv(rigaDigestSpento), 'digest_giornaliero');
resetCacheAutomazioni();
const altroAttivo = await statoAutomazioneEmail(clientKv(rigaDigestSpento), 'alert_pro_tempo_reale');
resetCacheAutomazioni();
const conErrore = await statoAutomazioneEmail(clientKv('errore'), 'digest_giornaliero');
resetCacheAutomazioni();
const senzaClient = await statoAutomazioneEmail(null, 'digest_giornaliero');
verifica([
  ['KV: digest disattivato letto correttamente', false, digestSpento.abilitata],
  ['KV: le automazioni sono indipendenti', true, altroAttivo.abilitata],
  ['KV illeggibile → automazione ATTIVA (nessun blocco)', true, conErrore.abilitata],
  ['client assente (dry-run) → automazione ATTIVA', true, senzaClient.abilitata],
  [
    'oggetto consentito solo dove il catalogo lo permette',
    [undefined, 'X'],
    [
      oggettoConsentito('digest_giornaliero', { abilitata: true, oggetto: 'X' }),
      oggettoConsentito('preavvisi_rinnovo', { abilitata: true, oggetto: 'X' }),
    ],
  ],
]);

console.log('\n— 7. Cablaggio: Edge, notifier e pannello —');
const edge = leggi('supabase/functions/send-notification/index.ts');
const admin = leggi('supabase/functions/admin/index.ts');
const notifier = leggi('src/lib/notifier.ts');
const resend = leggi('src/lib/resend.ts');
const tab = leggi('src/departments/admin/components/TabEmailAutomazioni.tsx');
const riga = leggi('src/departments/admin/components/RigaAutomazione.tsx');
const interruttore = leggi('src/departments/admin/components/AutomazioniInterruttore.tsx');
const pannello = leggi('src/departments/admin/components/PannelloCopyAutomazione.tsx');
const hook = leggi('src/departments/admin/hooks/useAutomazioniEmail.ts');
const servizio = leggi('src/departments/admin/services/automazioniService.ts');
const toolbar = leggi('src/components/DevToolbar.tsx');
const adminPage = leggi('src/pages/AdminPage.tsx');
const indiceAdmin = leggi('src/departments/admin/index.ts');
verifica([
  [
    'Edge send-notification: interruttore rispettato (invio saltato)',
    true,
    [
      'automazioneDaTipo(tipo)',
      'leggiStatiAutomazioni(SUPABASE_URL, SERVICE_ROLE)',
      'abilitata === false',
      'skipped: `automazione disattivata',
    ].every((f) => edge.includes(f)),
  ],
  [
    'Edge send-notification: testi del pannello applicati',
    true,
    [
      'applicaOverrideScheda(scheda, statoAutomazione, varsAutomazione)',
      'oggettoFinale(',
      'introParagrafoHtml(introAut)',
      'introTesto(statoAutomazione, varsAutomazione)',
    ].every((f) => edge.includes(f)),
  ],
  [
    'Edge admin: azioni delle automazioni',
    true,
    [
      'list_email_automations',
      'set_email_automation',
      "from('app_settings')",
      'normalizzaStatoAutomazione',
      'ripristinata: true',
    ].every((f) => admin.includes(f)),
  ],
  [
    'notifier: gate digest',
    true,
    [
      "statoAutomazioneEmail(client, 'digest_giornaliero')",
      'automazioneDigest.abilitata',
      "oggettoConsentito('digest_giornaliero', automazioneDigest)",
    ].every((f) => notifier.includes(f)),
  ],
  [
    'notifier: gate promemoria 24h',
    true,
    [
      "statoAutomazioneEmail(client, 'promemoria_scadenza')",
      'automazionePromemoria.abilitata',
      "oggettoConsentito('promemoria_scadenza', automazionePromemoria)",
    ].every((f) => notifier.includes(f)),
  ],
  [
    'notifier: gate alert PRO',
    true,
    ["statoAutomazioneEmail(client, 'alert_pro_tempo_reale')", 'automazioneAlert.abilitata'].every(
      (f) => notifier.includes(f),
    ),
  ],
  [
    'resend: oggetto personalizzabile (digest + promemoria)',
    true,
    ['oggetto?: string', 'opts.oggetto?.trim() ||'].every((f) => resend.includes(f)) &&
      resend.split('oggetto?: string').length - 1 >= 3,
  ],
  [
    'UI: interruttore a 2 stati (switch accessibile)',
    true,
    ['role="switch"', 'aria-checked={abilitata}', 'onCambia', 'etichettaAbilitazione'].every(
      (f) => interruttore.includes(f),
    ),
  ],
  [
    'UI: riga di tabella con anteprima, modifica e copia',
    true,
    ['Anteprima & copy', 'onToggle', 'RigaAutomazione', 'testoAnteprima'].every(
      (f) => riga.includes(f) || tab.includes(f),
    ),
  ],
  [
    'UI: editor con oggetto, intro e corpo',
    true,
    [
      'oggettoModificabile(automazione)',
      'corpoModificabile(automazione)',
      'Salva testi',
      'Ripristina copy del codice',
    ].every((f) => pannello.includes(f)),
  ],
  [
    'UI: anteprima visiva con dati di esempio',
    true,
    ['Anteprima visiva', 'logoScuoleRadar', 'testi.oggetto'].every((f) => pannello.includes(f)),
  ],
  [
    'UI: persistenza su Supabase (servizio del dipartimento)',
    true,
    ['caricaAutomazioniEmail', 'salvaAutomazioneEmail'].every((f) => servizio.includes(f)),
  ],
  [
    'UI: hook di stato del pannello',
    true,
    ['cambiaAbilitazione', 'salvaTesti', 'ripristinaTesti'].every((f) => hook.includes(f)),
  ],
  ['AdminPage: nuove tab cablata', true, adminPage.includes("id: 'email'")],
  [
    'dipartimento Admin: export pubblico del tab',
    true,
    indiceAdmin.includes("export { TabEmailAutomazioni } from './components/TabEmailAutomazioni';"),
  ],
  [
    'DEV Toolbar: selettore a 3 stati dei dipartimenti',
    true,
    [
      'FlagDipartimentiPanel',
      'variante="lista"',
      'sr_flag_dipartimenti',
      'FlagDipartimentiProva',
      'impostaStato',
      '= spento',
      '= pubblico',
    ].every((f) => toolbar.includes(f)),
  ],
]);

console.log('\n— 8. Documentazione —');
const handover = leggi('docs/SYSTEM_HANDOVER.md');
check(
  'SYSTEM_HANDOVER: pannello, chiave KV e comando di test',
  true,
  ['email_automazione_', 'TabEmailAutomazioni', 'test:automazioni'].every((f) => handover.includes(f)),
);

process.exitCode = errori === 0 ? 0 : 1;
console.log(
  errori === 0
    ? '\n✅ Automazioni email: tutti i controlli superati.'
    : `\n❌ ${errori} controllo/i fallito/i.`,
);

