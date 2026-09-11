/**
 * TEST — Ciclo di vita abbonamento: TRIAL PRO 1 mese + PROMEMORIA RINNOVO (3–5 gg).
 *
 * Verifica:
 *  1) la logica condivisa `src/lib/abbonamento.ts` (finestra 3–5 giorni, etichette);
 *  2) i template centralizzati email del FLUSSO 3 (promemoria trial e PRO);
 *  3) la coerenza statica della migrazione 20260903100000 (funzione + cron + flag);
 *  4) il contratto della Edge `send-notification` (alias multistep + variabili).
 *
 * Esecuzione: npm run test:rinnovo-preavvisi
 */

import { readFileSync } from 'node:fs';
import {
  dataScadenzaBreve,
  etichettaScadenzaAbbonamento,
  FINESTRA_PREAVVISO_RINNOVO,
  GIORNI_TRIAL_PRO,
  giorniAllaScadenza,
  inFinestraPreavviso,
} from '../src/lib/abbonamento.ts';
import {
  EMAIL_TEMPLATES,
  getEmailScheda,
} from '../supabase/functions/_shared/emailTemplates.ts';

declare const process: { exitCode?: number };

let falliti = 0;
function check(descrizione: string, atteso: unknown, ottenuto: unknown): void {
  const ok = JSON.stringify(atteso) === JSON.stringify(ottenuto);
  if (!ok) {
    falliti += 1;
    console.log(`  ✗ ${descrizione}\n      atteso: ${JSON.stringify(atteso)}\n      ottenuto: ${JSON.stringify(ottenuto)}`);
  } else {
    console.log(`  ✓ ${descrizione}`);
  }
}

// OGGI fisso per test deterministici: 2026-09-10.
const OGGI = new Date('2026-09-10T12:00:00');
const iso = (giorni: number): string => new Date(OGGI.getTime() + giorni * 86_400_000).toISOString();

const MIGRAZIONE = new URL(
  '../supabase/migrations/20260903100000_preavvisi_rinnovo_trial_pro.sql',
  import.meta.url,
);
const EDGE = new URL('../supabase/functions/send-notification/index.ts', import.meta.url);

console.log('──────────────────────────────────────────────────────────');
console.log('🧪 TEST CICLO DI VITA ABBONAMENTO (trial 1 mese + rinnovo 3–5 gg)');
console.log('──────────────────────────────────────────────────────────');

console.log('\n— Policy trial (1 mese) & finestra promemoria —');
check('durata trial = 30 giorni', 30, GIORNI_TRIAL_PRO);
check('finestra = 3–5 giorni', { minGiorni: 3, maxGiorni: 5 }, FINESTRA_PREAVVISO_RINNOVO);

console.log('\n— giorniAllaScadenza —');
check('trial appena attivato → 30', 30, giorniAllaScadenza(iso(30), OGGI));
check('scade oggi → 0', 0, giorniAllaScadenza(iso(0), OGGI));
check('scaduto da 2 gg → -2', -2, giorniAllaScadenza(iso(-2), OGGI));
check('assente → null', null, giorniAllaScadenza(null, OGGI));
check('invalida → null', null, giorniAllaScadenza('non-una-data', OGGI));

console.log('\n— inFinestraPreavviso (3–5 giorni) —');
check('3 giorni → true', true, inFinestraPreavviso(iso(3), OGGI));
check('4 giorni → true', true, inFinestraPreavviso(iso(4), OGGI));
check('5 giorni → true', true, inFinestraPreavviso(iso(5), OGGI));
check('6 giorni → false', false, inFinestraPreavviso(iso(6), OGGI));
check('2 giorni → false', false, inFinestraPreavviso(iso(2), OGGI));
check('trial al giorno 1 (29 gg) → false', false, inFinestraPreavviso(iso(29), OGGI));
check('già scaduto → false', false, inFinestraPreavviso(iso(-1), OGGI));
check('senza scadenza → false', false, inFinestraPreavviso(null, OGGI));

console.log('\n— etichette di scadenza —');
check('oggi', 'oggi', etichettaScadenzaAbbonamento(iso(0), OGGI));
check('domani', 'domani', etichettaScadenzaAbbonamento(iso(1), OGGI));
check('tra 4 giorni', 'tra 4 giorni', etichettaScadenzaAbbonamento(iso(4), OGGI));
check('scaduto', 'scaduto', etichettaScadenzaAbbonamento(iso(-1), OGGI));
check('assente → stringa vuota', '', etichettaScadenzaAbbonamento(null, OGGI));
check('data breve formato gg/mm/aaaa', true, /^\d{2}\/\d{2}\/\d{4}$/.test(dataScadenzaBreve(iso(4))));

console.log('\n— Template FLUSSO 3 (promemoria di rinnovo) —');
check('email_3_5_rinnovo_prova presente', true, Boolean(EMAIL_TEMPLATES.email_3_5_rinnovo_prova));
check('email_3_6_rinnovo_pro presente', true, Boolean(EMAIL_TEMPLATES.email_3_6_rinnovo_pro));

const vars = { nome: 'Giuseppe', giorni: '4', scadenza: '15/09/2026' };
const prova = getEmailScheda('email_3_5_rinnovo_prova', vars);
const pro = getEmailScheda('email_3_6_rinnovo_pro', vars);

check('prova: oggetto con i giorni', true, prova.soggetto.includes('4 giorni'));
check('prova: saluto interpolato', true, prova.testo.includes('Giuseppe'));
check('prova: data interpolata', true, prova.testo.includes('15/09/2026'));
check('prova: nessun placeholder residuo', false, prova.testo.includes('{{'));
check('prova: CTA verso /prezzi', true, prova.html.includes('scuoleradar.it/prezzi'));
check('prova: CTA resa come pulsante', true, prova.html.includes('background:#2B6F9E'));

check('pro: oggetto con i giorni', true, pro.soggetto.includes('4 giorni'));
check('pro: nessun placeholder residuo', false, pro.testo.includes('{{'));
check('pro: CTA verso /prezzi', true, pro.html.includes('scuoleradar.it/prezzi'));
check('pro: copy dedicata al rinnovo abbonamento', true, pro.testo.includes('abbonamento PRO'));

console.log('\n— Migrazione 20260903100000 (cron + idempotenza) —');
const migrazione = readFileSync(MIGRAZIONE, 'utf8');
const attesiMigrazione: Array<[string, string]> = [
  ['flag di idempotenza', 'preavviso_rinnovo_inviato_at timestamptz'],
  ['funzione invia_preavvisi_rinnovo', 'create or replace function public.invia_preavvisi_rinnovo()'],
  ['finestra 3 giorni', "now() + interval '3 days'"],
  ['finestra 5 giorni', "now() + interval '5 days'"],
  ['solo piano pro', "p.piano = 'pro'"],
  ['esclude i beta tester', 'is_beta_tester'],
  ['tipo trial', 'rinnovo_preavviso_prova'],
  ['tipo PRO', 'rinnovo_preavviso_pro'],
  ['payload giorni/scadenza', "'giorni', v_giorni::text"],
  ['cron giornaliero', "cron.schedule('rinnovo-preavvisi-3-5g', '0 9 * * *'"],
];
for (const [descrizione, atteso] of attesiMigrazione) {
  check(descrizione, true, migrazione.includes(atteso));
}

console.log('\n— Edge send-notification (alias multistep + variabili) —');
const edge = readFileSync(EDGE, 'utf8');
check('alias multistep definito', true, edge.includes('TIPO_ALIAS'));
check('alias scadenza_preavviso_3d', true, edge.includes('scadenza_preavviso_3d'));
check('alias scadenza_finale', true, edge.includes('scadenza_finale'));
check('variabile giorni passata al template', true, edge.includes('body.giorni'));
check('variabile scadenza passata al template', true, edge.includes('body.scadenza'));

console.log('\n──────────────────────────────────────────────────────────');
if (falliti === 0) {
  console.log('✅ CICLO DI VITA ABBONAMENTO: tutti i controlli superati');
} else {
  console.log(`❌ CICLO DI VITA ABBONAMENTO: ${falliti} controllo/i fallito/i`);
  process.exitCode = 1;
}
console.log('──────────────────────────────────────────────────────────');
