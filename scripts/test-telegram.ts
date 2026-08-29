/**
 * TEST DI INTEGRAZIONE TELEGRAM (temporaneo)
 * -------------------------------------------
 * Invia due messaggi REALI al chat_id configurato in `.env` usando la stessa
 * funzione `inviaNotificaTelegram` del notifier (src/lib/telegram.ts):
 *   1. formato "prova"   — 1ª di 3 (copy con countdown + CTA PRO)
 *   2. formato "standard" — copy neutro (utenti PRO)
 *
 * Esecuzione:
 *   npm run test:telegram
 *
 * Richiede nel file `.env` (nella cartella project/):
 *   TELEGRAM_BOT_TOKEN  = token del bot (@ScuoleRadar_bot)
 *   TELEGRAM_CHAT_ID    = chat Telegram di test che riceverà i messaggi
 *   (opzionale) RESEND_DASHBOARD_URL = base dell'app per i link
 */

import { inviaNotificaTelegram } from '../src/lib/telegram.ts';
import type { DettagliNotifica } from '../src/lib/resend.ts';

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

if (!botToken || botToken.includes('xxxx') || botToken.includes('ExampleToken')) {
  console.error('✗ TELEGRAM_BOT_TOKEN mancante o placeholder nel file .env');
  console.error('  Aggiungi: TELEGRAM_BOT_TOKEN=<token del bot @ScuoleRadar_bot>');
  process.exit(1);
}
if (!chatId) {
  console.error('✗ TELEGRAM_CHAT_ID mancante nel file .env');
  console.error('  Aggiungi: TELEGRAM_CHAT_ID=<chat_id della tua chat Telegram>');
  process.exit(1);
}

/** Interpello di test: Liceo Monti di Asti, 18 ore, Classe A-22. */
const interpelloTest: DettagliNotifica = {
  id: 'test-integrazione-001',
  title: 'Interpello supplenza 18 ore — Liceo "Vincenzo Monti" di Asti (Classe A-22)',
  schoolName: 'Liceo "Vincenzo Monti" di Asti',
  province: 'AT',
  classi: ['A-22'],
  scadenza: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
  link: 'https://scuoleradar.it/interpello/test-integrazione-001',
};

const dashboardUrl =
  process.env.RESEND_DASHBOARD_URL ?? 'https://scuoleradar.it/dashboard/radar';

async function main(): Promise<void> {
  console.log('──────────────────────────────────────────────');
  console.log('📡 TEST INTEGRAZIONE TELEGRAM');
  console.log(`   Chat di destinazione: ${chatId}`);
  console.log(`   Interpello: ${interpelloTest.title}`);
  console.log('──────────────────────────────────────────────');

  console.log('\n— Messaggio 1/2 · formato "prova" (1ª di 3) —');
  const r1 = await inviaNotificaTelegram(chatId, interpelloTest, {
    classiUtente: ['A-22'],
    dashboardUrl,
    tipo: 'prova1',
  });
  console.log(r1.ok ? '✓ Inviato (prova1)' : `✗ Fallito: ${r1.error ?? 'errore sconosciuto'}`);

  console.log('\n— Messaggio 2/2 · formato "PRO" (notifica standard) —');
  const r2 = await inviaNotificaTelegram(chatId, interpelloTest, {
    classiUtente: ['A-22'],
    dashboardUrl,
    tipo: 'notifica_pro',
  });
  console.log(r2.ok ? '✓ Inviato (notifica_pro)' : `✗ Fallito: ${r2.error ?? 'errore sconosciuto'}`);

  // Chiusura naturale (process.exitCode, non process.exit): su Windows un exit
  // brusco con handle fetch ancora aperti fa scattare un'asserzione libuv.
  process.exitCode = r1.ok && r2.ok ? 0 : 1;
}

void main();
