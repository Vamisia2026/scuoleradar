/**
 * TEST DI INTEGRAZIONE NOTIFICHE (temporaneo)
 * -------------------------------------------
 * Invia SIMULTANEAMENTE:
 *   - notifica Telegram (chat da TELEGRAM_CHAT_ID nel .env)
 *   - email di test via Resend all'indirizzo indicato (default bartoloansaldi@gmail.com)
 * Usa UNA sola notifica di prova (1ª di 3) per evitare messaggi duplicati.
 *
 * Esecuzione:
 *   npm run test:notifiche
 *
 * Richiede nel file `.env`:
 *   TELEGRAM_BOT_TOKEN  = token del bot (@ScuoleRadar_bot)
 *   TELEGRAM_CHAT_ID    = chat Telegram di test
 *   RESEND_API_KEY      = chiave API Resend (per l'email)
 *   (opzionale) TEST_EMAIL = destinatario email di test (default bartoloansaldi@gmail.com)
 */

import {
  getResendClient,
  inviaNotificaEmail,
  type DestinatarioNotifica,
  type DettagliNotifica,
} from '../src/lib/resend.ts';
import { inviaNotificaTelegram } from '../src/lib/telegram.ts';

/** Interfaccia minima per l'ambiente (senza dipendere da @types/node). */
declare const process: {
  env: Record<string, string | undefined>;
  loadEnvFile?: (path?: string) => void;
  exitCode?: number;
  exit: (code?: number) => never;
};

// Carica `.env` dalla cartella corrente (Node >= 20.12), come fa lo scraper.
try {
  process.loadEnvFile?.();
} catch {
  // Nessun .env: si usano le variabili già presenti nell'ambiente
}

const chatId = (process.env.TELEGRAM_CHAT_ID ?? '').trim();
const botToken = process.env.TELEGRAM_BOT_TOKEN ?? '';
const emailTest = process.env.TEST_EMAIL ?? 'bartoloansaldi@gmail.com';

if (!botToken || botToken.includes('xxxx') || botToken.includes('ExampleToken')) {
  console.error('✗ TELEGRAM_BOT_TOKEN mancante o placeholder nel file .env');
  process.exit(1);
}
if (!chatId) {
  console.error('✗ TELEGRAM_CHAT_ID mancante nel file .env');
  process.exit(1);
}

/** Interpello di test: Liceo Monti di Asti, 18 ore, Classe A-22. */
const interpelloTest: DettagliNotifica = {
  id: 'test-notifiche-001',
  title: 'Interpello supplenza 18 ore — Liceo "Vincenzo Monti" di Asti (Classe A-22)',
  schoolName: 'Liceo "Vincenzo Monti" di Asti',
  province: 'AT',
  classi: ['A-22'],
  scadenza: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
  link: 'https://scuoleradar.it/interpello/test-notifiche-001',
};

async function main(): Promise<void> {
  const resend = getResendClient();

  const destinatario: DestinatarioNotifica = {
    email: emailTest,
    nome: 'Bartolo',
    province: ['AT'],
    classi: ['A-22'],
  };

  console.log('──────────────────────────────────────────────');
  console.log('📡 TEST INTEGRAZIONE NOTIFICHE (Telegram + Email)');
  console.log(`   Interpello: ${interpelloTest.title}`);
  console.log(`   Telegram → ${chatId}`);
  console.log(`   Email    → ${emailTest}`);
  console.log('──────────────────────────────────────────────');

  // Invio SIMULTANEO: email e Telegram partono in parallelo (una sola notifica prova1).
  // Se la chiave Resend non c'è, l'email risulta subito fallita senza bloccare il Telegram.
  const [esitoEmail, esitoTelegram] = await Promise.all([
    resend
      ? inviaNotificaEmail(resend, interpelloTest, destinatario, {
          tipo: 'prova1',
        })
      : Promise.resolve({ inviata: false, error: 'RESEND_API_KEY mancante o placeholder nel file .env' }),
    inviaNotificaTelegram(chatId, interpelloTest, {
      classiUtente: ['A-22'],
      tipo: 'prova1',
    }),
  ]);

  console.log('\n— Telegram (prova1) —');
  console.log(esitoTelegram.ok ? '✓ Inviato' : `✗ Fallito: ${esitoTelegram.error ?? 'errore sconosciuto'}`);

  console.log(`\n— Email (prova1) → ${emailTest} —`);
  console.log(esitoEmail.inviata ? '✓ Inviata' : `✗ Fallita: ${esitoEmail.error ?? 'errore sconosciuto'}`);

  process.exitCode = esitoTelegram.ok && esitoEmail.inviata ? 0 : 1;
}

void main();
