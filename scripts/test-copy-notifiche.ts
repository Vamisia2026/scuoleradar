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
/**
 * Recapito di candidatura reso CLICCABILE con etichetta CONDIVISA
 * (`EMAIL_ICONA` + `EMAIL_ETICHETTA`, definite in `src/lib/alertInterpello.ts`):
 * un'unica fonte di verità per email, Telegram e post canale.
 */
const RE_RECAPITO_MAILTO = /EMAIL_ICONA\} \$\{EMAIL_ETICHETTA\}: <a href="mailto:/;
const telegram = readFileSync('src/lib/telegram.ts', 'utf8');
check('Telegram: email con link mailto (etichetta condivisa)', true, RE_RECAPITO_MAILTO.test(telegram));
const resend = readFileSync('src/lib/resend.ts', 'utf8');
check('Email: email con link mailto (etichetta condivisa)', true, RE_RECAPITO_MAILTO.test(resend));
const edge = readFileSync('supabase/functions/send-notification/index.ts', 'utf8');
check('Edge send-notification: email con link mailto', true, /Candidature: <a href="mailto:/.test(edge));
check('Edge send-notification: email recuperata anche dal DB', true, /caricaEmailAvviso/.test(edge));

console.log('\n— Telegram: alert di SOLO TESTO (nessuna foto/logo, nessun marchio ridondante) —');
/**
 * Gli alert personali non devono MAI allegare immagini: la foto con il logo
 * generava l'anteprima gigante che nascondeva il contenuto. Controllo STATICO sul
 * sorgente (commenti rimossi): blocca il ritorno di `sendPhoto`, del logo e della
 * riga di marchio ridondante.
 */
const telegramCodice = senzaCommenti(telegram);
check('nessun invio di foto (sendPhoto)', false, /sendPhoto/.test(telegramCodice));
check('nessun logo negli alert', false, /urlLogoTelegram|SCUOLERADAR_LOGO_URL/.test(telegramCodice));
check('nessun marchio ridondante (MARCHIO_TELEGRAM)', false, /MARCHIO_TELEGRAM/.test(telegramCodice));
check(
  'nessun disclaimer "non indica la pagina ufficiale" nei messaggi Telegram',
  false,
  /non indica la pagina ufficiale/i.test(telegramCodice),
);
check(
  'CTA di ricalibrazione del Radar presente',
  true,
  /Se questi risultati non corrispondono più ai tuoi interessi, modifica il tuo radar su/.test(
    telegramCodice,
  ),
);
check(
  "riga link condivisa 'Apri l'avviso ufficiale'",
  true,
  /Apri l'avviso ufficiale/.test(telegramCodice),
);

console.log(errori === 0 ? '\n✅ COPY NOTIFICHE: nessun problema' : `\n❌ COPY NOTIFICHE: ${errori} errore/i`);
process.exitCode = errori === 0 ? 0 : 1;
