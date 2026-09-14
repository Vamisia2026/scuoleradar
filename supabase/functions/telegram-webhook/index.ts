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
  '👋 <b>Benvenuto su ScuoleRadar!</b>\n\n' +
  'Per ricevere le notifiche personalizzate sugli interpelli scolastici devi prima configurare ' +
  'il tuo profilo (classi di concorso e province desiderate).\n\n' +
  '1️⃣ Vai su <a href="https://scuoleradar.it/dashboard/radar">Configura il tuo Radar</a>: scegli province e classi di concorso.\n' +
  '2️⃣ Nella sezione <b>Profilo</b>, clicca sul pulsante <b>Collega Telegram</b>.\n\n' +
  'In questo modo il bot saprà esattamente quali avvisi inviarti!';

/** Invia un messaggio su Telegram via Bot API. */
async function inviaMessaggio(chatId: number, testo: string): Promise<void> {
  if (!TELEGRAM_TOKEN) return;
  await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text: testo, parse_mode: 'HTML' }),
  }).catch((err) => console.error('Errore invio messaggio Telegram:', err.message));
}

/**
 * Aggiorna profiles.telegram_chat_id (e, se fornito, telegram_username)
 * per l'utente dato, via REST + service_role. Ritorna true se la PATCH è andata
 * a buon fine E ha aggiornato almeno una riga.
 */
async function aggiornaChatId(
  userId: string,
  chatId: number,
  username?: string,
): Promise<boolean> {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE) return false;
  const body: Record<string, unknown> = { telegram_chat_id: String(chatId) };
  if (username) body.telegram_username = username;
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/profiles?id=eq.${encodeURIComponent(userId)}`,
    {
      method: 'PATCH',
      headers: {
        apikey: SUPABASE_SERVICE_ROLE,
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE}`,
        'Content-Type': 'application/json',
        Prefer: 'return=representation',
      },
      body: JSON.stringify(body),
    },
  ).catch((err) => {
    console.error('Errore aggiornamento profiles:', err.message);
    return null;
  });
  if (!res || !res.ok) return false;
  try {
    const righe = (await res.json()) as unknown[];
    return Array.isArray(righe) && righe.length > 0;
  } catch {
    return true;
  }
}

/**
 * Risolve l'userId dal SOLO username Telegram (fallback quando il deeplink
 * `?start=<user_id>` non è presente): cerca `profiles.telegram_username`.
 */
async function trovaUserIdPerUsername(username: string): Promise<string | null> {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE || !username) return null;
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/profiles?telegram_username=ilike.${encodeURIComponent(username)}&select=id&limit=1`,
    {
      headers: {
        apikey: SUPABASE_SERVICE_ROLE,
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE}`,
      },
    },
  ).catch((err) => {
    console.error('Errore lookup username:', err.message);
    return null;
  });
  if (!res || !res.ok) return null;
  try {
    const righe = (await res.json()) as Array<{ id?: string }>;
    return righe[0]?.id ?? null;
  } catch {
    return null;
  }
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
    | { chat?: { id?: number }; text?: string; from?: { username?: string } }
    | undefined;
  const chatId = message?.chat?.id;
  const testo = (message?.text ?? '').trim();
  const username = (message?.from?.username ?? '').trim().replace(/^@/, '');

  // Ack immediato: non è un messaggio testuale
  if (!chatId || !testo) {
    return new Response('ok', { status: 200 });
  }

  // Riconosce "/start" oppure "/start <user_id>" (deeplink ?start=USER_ID)
  const match = testo.match(/^\/start(?:\s+([A-Za-z0-9-]+))?\s*$/);
  if (!match) {
    return new Response('ok', { status: 200 });
  }

  let userId = match[1] ?? '';

  // FALLBACK per username: se manca il deeplink o l'id non aggiorna nulla,
  // prova a collegare l'account tramite `profiles.telegram_username`.
  let aggiornato = false;
  if (userId) {
    aggiornato = await aggiornaChatId(userId, chatId, username || undefined);
  }
  if (!aggiornato && username) {
    const perUsername = await trovaUserIdPerUsername(username);
    if (perUsername) {
      userId = perUsername;
      aggiornato = await aggiornaChatId(perUsername, chatId, username);
    }
  }

  if (!aggiornato) {
    // Nessun collegamento possibile: spieghiamo come collegare l'account.
    await inviaMessaggio(chatId, MESSAGGIO_ISTRUZIONI);
    return new Response('ok', { status: 200 });
  }

  await inviaMessaggio(chatId, MESSAGGIO_CONFERMA);
  return new Response('ok', { status: 200 });
});
