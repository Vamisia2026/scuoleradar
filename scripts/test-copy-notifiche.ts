/**
 * Verifica che i TEMPLATE di notifica (Telegram, email, Edge Function) NON
 * contengano più copy di quota/prova superata: il servizio opera con il mese PRO
 * gratuito (accesso pieno, nessun contatore decrescente).
 * Scansiona i sorgenti e blocca qualsiasi regressione.
 *
 * Uso: npm run test:copy
 */
import { readFileSync } from 'node:fs';

let errori = 0;
function check(nome: string, atteso: unknown, ottenuto: unknown): void {
  const ok = JSON.stringify(atteso) === JSON.stringify(ottenuto);
  if (!ok) errori += 1;
  console.log(`${ok ? '✓' : '✗'} ${nome}: atteso=${JSON.stringify(atteso)} ottenuto=${JSON.stringify(ottenuto)}`);
}

const FILE_NOTIFICHE = [
  'src/lib/telegram.ts',
  'src/lib/resend.ts',
  'supabase/functions/send-notification/index.ts',
  'supabase/functions/_shared/emailTemplates.ts',
  'supabase/functions/webhook/index.ts',
];

/**
 * Copy VIETATE nei messaggi (quote di prova e conteggi residui). Il servizio
 * opera con il mese PRO gratuito a accesso pieno: nessun contatore decrescente.
 */
const VIETATE = [
  /Te ne restano\s*(\d|<)/i,
  /Te ne resta\s*1/i,
  /restano 2/i,
  /resta 1/i,
  /di prova sono terminate/i,
  /notifiche di prova sono finite/i,
  /terza e ultima opportunità/i,
  /periodo di prova è terminato/i,
  /ultimo avviso del periodo di prova/i,
  /servizio di notifica sospeso/i,
];

/** Rimuove i commenti (di riga e di blocco) prima della scansione. */
function senzaCommenti(testo: string): string {
  return testo.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1');
}

for (const file of FILE_NOTIFICHE) {
  const codice = senzaCommenti(readFileSync(file, 'utf8'));
  const trovate = VIETATE.filter((re) => re.test(codice)).map((re) => String(re));
  check(`${file}: nessuna copy di quota/prova`, [], trovate);
}

console.log('\n— Email di candidatura: presente e cliccabile negli avvisi —');
const telegram = readFileSync('src/lib/telegram.ts', 'utf8');
check(
  'Telegram: email con link mailto',
  true,
  /📧 Candidature: <a href="mailto:/.test(telegram),
);
const resend = readFileSync('src/lib/resend.ts', 'utf8');
check('Email: email con link mailto', true, /Candidature: <a href="mailto:/.test(resend));
const edge = readFileSync('supabase/functions/send-notification/index.ts', 'utf8');
check('Edge send-notification: email con link mailto', true, /Candidature: <a href="mailto:/.test(edge));
check('Edge send-notification: email recuperata anche dal DB', true, /caricaEmailAvviso/.test(edge));

console.log(errori === 0 ? '\n✅ COPY NOTIFICHE: nessun problema' : `\n❌ COPY NOTIFICHE: ${errori} errore/i`);
process.exitCode = errori === 0 ? 0 : 1;
