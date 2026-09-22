/**
 * Verifica che i TEMPLATE di notifica (Telegram, email, Edge Function) NON
 * contengano più copy di quota/prova superata: il servizio opera con il mese PRO
 * gratuito (accesso pieno, nessun contatore decrescente).
 * Scansiona i sorgenti e blocca qualsiasi regressione.
 *
 * Uso: npm run test:copy
 */
import { readFileSync } from 'node:fs';
import {
  BRAND_NOME,
  BRAND_RIGA_TELEGRAM,
  CTA_NOTIZIE_TELEGRAM,
  CTA_NOTIZIE_TESTO,
  ETICHETTA_AVVISO_UFFICIALE,
  URL_NOTIZIE,
} from '../src/lib/alertInterpello.ts';
import { ETICHETTA_FONTE_UFFICIALE } from '../src/lib/telegram.ts';

let errori = 0;
function check(nome: string, atteso: unknown, ottenuto: unknown): void {
  const ok = JSON.stringify(atteso) === JSON.stringify(ottenuto);
  if (!ok) errori += 1;
  console.log(`${ok ? '✓' : '✗'} ${nome}: atteso=${JSON.stringify(atteso)} ottenuto=${JSON.stringify(ottenuto)}`);
}

const FILE_NOTIFICHE = [
  'src/lib/telegram.ts',
  'src/lib/resend.ts',
  'src/lib/alertInterpello.ts',
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

console.log('\n— Telegram: alert di SOLO TESTO (nessun logo/anteprima gigante) —');
/**
 * Gli alert personali non devono MAI allegare immagini: la foto con il logo
 * generava l'anteprima gigante che nascondeva il contenuto. Il brand è una RIGA
 * compatta in testa al messaggio; le anteprime dei link sono disattivate a
 * livello di Bot API. Controllo STATICO sul sorgente (commenti rimossi).
 */
const telegramCodice = senzaCommenti(telegram);
check('nessun invio di foto (sendPhoto)', false, /sendPhoto/.test(telegramCodice));
check('nessun logo negli alert', false, /urlLogoTelegram|SCUOLERADAR_LOGO_URL/.test(telegramCodice));
check(
  'brand compatto in testa (BRAND_RIGA_TELEGRAM)',
  true,
  /BRAND_RIGA_TELEGRAM/.test(telegramCodice),
);
check(
  'anteprime dei link disattivate (link_preview_options)',
  true,
  /link_preview_options:\s*\{\s*is_disabled:\s*true\s*\}/.test(telegramCodice),
);
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
  "etichetta condivisa (email) invariata: 'Apri l'avviso ufficiale'",
  "👉 Apri l'avviso ufficiale",
  ETICHETTA_AVVISO_UFFICIALE,
);
// TELEGRAM: etichetta UNICA e canonica del link alla fonte, applicata dai
// generatori di riga (`rigaFonteUfficiale`/`rigaAvvisoUfficiale`) e MAI un URL
// di fonte in chiaro nel testo del messaggio.
check('etichetta unica Telegram del link fonte', '🔗 Fonte Ufficiale', ETICHETTA_FONTE_UFFICIALE);
check(
  'Telegram: la riga fonte usa l’etichetta canonica',
  true,
  /rigaFonteUfficiale[\s\S]{0,400}ETICHETTA_FONTE_UFFICIALE/.test(telegramCodice),
);
// Confronto sul CODICE, senza commenti: una nota che cita la vecchia etichetta
// non deve far fallire la guardia.
const telegramCodiceSenzaCommenti = telegramCodice
  .split('\n')
  .filter((riga) => !/^\s*(?:\/\/|\/\*|\*)/.test(riga))
  .join('\n');
check(
  "Telegram: nessuna etichetta legacy nel codice ('Apri l'avviso ufficiale' / 'Leggi la Fonte Ufficiale')",
  false,
  telegramCodiceSenzaCommenti.includes("Apri l'avviso ufficiale") ||
    telegramCodiceSenzaCommenti.includes('Leggi la Fonte Ufficiale'),
);
check(
  'nessun marchio testuale non cliccabile (il brand è un link)',
  false,
  /<b>Scuole Radar\.it<\/b>/.test(telegramCodice),
);
check(
  'copy di brand COMPLETO nell\'apertura delle opportunità',
  true,
  /const TESTO_OPPORTUNITA = 'Abbiamo trovato una nuova opportunità per te';/.test(telegramCodice) &&
    /const TESTA_OPPORTUNITA = `🎯 <b>\$\{TESTO_OPPORTUNITA\}<\/b>`;/.test(telegramCodice),
);
check(
  'nessuna apertura abbreviata "🎯 Nuova opportunità"',
  false,
  /🎯 <b>Nuova opportunità/.test(telegramCodice),
);
check(
  'Edge: stesso copy di brand nei messaggi Telegram',
  true,
  /TESTO_OPPORTUNITA/.test(senzaCommenti(edge)) &&
    /Abbiamo trovato una nuova opportunità per te/.test(senzaCommenti(edge)),
);
check(
  'nessun oggetto email generico "Nuova opportunità trovata per te"',
  false,
  /Nuova opportunità trovata per te/.test(senzaCommenti(resend)) ||
    /Nuova opportunità trovata per te/.test(senzaCommenti(edge)),
);
check(
  'CTA Notizie: ESATTAMENTE le due righe ufficiali',
  `📌 ${URL_NOTIZIE}\nQuando vuoi sapere cosa succede di importante nella scuola, vieni qui`,
  CTA_NOTIZIE_TELEGRAM,
);
check('CTA Notizie: seconda riga come da specifica', 'Quando vuoi sapere cosa succede di importante nella scuola, vieni qui', CTA_NOTIZIE_TESTO);
check('URL Notizie canonico (www)', 'https://www.scuoleradar.it/notizie', URL_NOTIZIE);
check(
  'brand compatto (icona + nome ufficiale cliccabile)',
  '📡 <a href="https://www.scuoleradar.it">Scuole Radar.it</a>',
  BRAND_RIGA_TELEGRAM,
);
check('nome ufficiale del brand', 'Scuole Radar.it', BRAND_NOME);
check(
  'resend.ts: CTA Notizie EMAIL (due righe esatte, formato email)',
  true,
  /CTA_NOTIZIE_TESTO_EMAIL/.test(senzaCommenti(resend)) &&
    /URL_NOTIZIE_VISIBILE/.test(senzaCommenti(resend)) &&
    /scuoleradar\.it\/notizie/.test(senzaCommenti(resend)),
);
check(
  'resend.ts: avviso "non rispondere" in coda (footer crisp)',
  true,
  /TESTO_NON_RISPOSTA/.test(senzaCommenti(resend)) && !/#94a3b8/.test(senzaCommenti(resend)),
);
check(
  'resend.ts: nessun blocco "P.S."',
  false,
  /P\.S\./.test(senzaCommenti(resend)),
);
check(
  'resend.ts: oggetto standard "Nuove opportunità per te!"',
  true,
  /OGGETTO_OPPORTUNITA = 'Nuove opportunità per te!'/.test(senzaCommenti(resend)),
);
check(
  'Edge send-notification: brand + CTA Notizie a due righe',
  true,
  /BRAND_TELEGRAM/.test(senzaCommenti(edge)) &&
    /Quando vuoi sapere cosa succede di importante nella scuola, vieni qui/.test(senzaCommenti(edge)),
);

console.log(errori === 0 ? '\n✅ COPY NOTIFICHE: nessun problema' : `\n❌ COPY NOTIFICHE: ${errori} errore/i`);
process.exitCode = errori === 0 ? 0 : 1;
