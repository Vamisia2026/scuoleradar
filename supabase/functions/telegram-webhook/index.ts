// ============================================================
// Edge Function Supabase — Webhook Bot Telegram (comando /start)
//
// Gestisce le chiamate di Webhook da Telegram per collegare il
// Chat ID dell'utente al suo profilo (tabella `profiles`).
//
// Flusso:
//   1. L'utente apre dalla pagina Profilo il deeplink
//      https://t.me/ScuoleRadar_bot?start=<user_id>
//   2. Telegram invia al bot il messaggio "/start <user_id>"
//   3. Questa Edge Function:
//      a. estrae chat.id (mittente)
//      b. aggiorna profiles.telegram_chat_id per l'utente <user_id>
//      c. invia il messaggio di conferma via Bot API
//
// Deploy e configurazione:
//   supabase secrets set TELEGRAM_BOT_TOKEN=<token>
//   supabase secrets set TELEGRAM_WEBHOOK_SECRET=<secret-aleatorio>
//   supabase functions deploy telegram-webhook --no-verify-jwt
//   curl "https://api.telegram.org/bot<TOKEN>/setWebhook?url=<FUNZIONE_URL>&secret_token=<secret-aleatorio>"
//
// Security: il webhook è protetto da `secret_token` (header
// X-Telegram-Bot-Api-Secret-Token) verificato a ogni richiesta.
// ============================================================

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';

const TELEGRAM_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN') ?? '';
const WEBHOOK_SECRET = Deno.env.get('TELEGRAM_WEBHOOK_SECRET') ?? '';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

const MESSAGGIO_CONFERMA =
  '✅ Account collegato con successo a ScuoleRadar! ' +
  'Riceverai qui le notifiche per le classi di concorso selezionate.';

const MESSAGGIO_ISTRUZIONI =
  '👋 Benvenuto su ScuoleRadar!\n' +
  'Per collegare il tuo account Telegram vai nella pagina Profilo del sito e premi il pulsante ' +
  '"Collega Telegram": si aprirà questa chat con il tuo account già riconosciuto.';

const MESSAGGIO_ERRORE =
  '❌ Impossibile collegare l\'account. Riprova aprendo il link "Collega Telegram" dalla pagina Profilo.';

/** Invia un messaggio su Telegram via Bot API. */
async function inviaMessaggio(chatId: number, testo: string): Promise<void> {
  if (!TELEGRAM_TOKEN) return;
  await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text: testo, parse_mode: 'HTML' }),
  }).catch((err) => console.error('Errore invio messaggio Telegram:', err.message));
}

/** Aggiorna profiles.telegram_chat_id per l'utente dato (via REST + service_role). */
async function aggiornaChatId(userId: string, chatId: number): Promise<boolean> {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE) return false;
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/profiles?id=eq.${encodeURIComponent(userId)}`,
    {
      method: 'PATCH',
      headers: {
        apikey: SUPABASE_SERVICE_ROLE,
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify({ telegram_chat_id: String(chatId) }),
    },
  ).catch((err) => {
    console.error('Errore aggiornamento profiles:', err.message);
    return null;
  });
  return res !== null && res.ok;
}

serve(async (req: Request) => {
  // Solo POST
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  // Verifica secret del webhook (header impostato da Telegram via setWebhook secret_token)
  const secretHeader = req.headers.get('x-telegram-bot-api-secret-token');
  if (WEBHOOK_SECRET && secretHeader !== WEBHOOK_SECRET) {
    return new Response('Forbidden', { status: 403 });
  }

  let update: Record<string, unknown>;
  try {
    update = await req.json();
  } catch {
    return new Response('Bad Request', { status: 400 });
  }

  const message = update.message as
    | { chat?: { id?: number }; text?: string }
    | undefined;
  const chatId = message?.chat?.id;
  const testo = (message?.text ?? '').trim();

  // Ack immediato: non è un messaggio testuale
  if (!chatId || !testo) {
    return new Response('ok', { status: 200 });
  }

  // Riconosce "/start" oppure "/start <user_id>" (deeplink ?start=USER_ID)
  const match = testo.match(/^\/start(?:\s+([A-Za-z0-9-]+))?\s*$/);
  if (!match) {
    return new Response('ok', { status: 200 });
  }

  const userId = match[1] ?? '';

  if (!userId) {
    // /start senza parametro: spieghiamo come collegare l'account
    await inviaMessaggio(chatId, MESSAGGIO_ISTRUZIONI);
    return new Response('ok', { status: 200 });
  }

  const aggiornato = await aggiornaChatId(userId, chatId);
  await inviaMessaggio(chatId, aggiornato ? MESSAGGIO_CONFERMA : MESSAGGIO_ERRORE);

  return new Response('ok', { status: 200 });
});
