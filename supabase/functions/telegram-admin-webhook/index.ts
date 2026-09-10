// ============================================================
// Edge Function Supabase — Webhook Bot Telegram ADMIN
//
// Bot di CONTROLLO AMMINISTRATIVO, SEPARATO dal bot pubblico degli
// interpelli (Edge `telegram-webhook`, bot @ScuoleRadar_bot):
//   · bot DEDICATO           → ADMIN_TELEGRAM_BOT_TOKEN
//   · mittente autorizzato   → ADMIN_TELEGRAM_ID (fail-closed)
//   · secret webhook         → ADMIN_TELEGRAM_WEBHOOK_SECRET (richiesto)
//   · log dei comandi        → tabella `admin_telegram_log`
//   · inoltro comandi (opz.) → ADMIN_COMMAND_FORWARD_URL (+ secret)
//
// Deploy e configurazione:
//   supabase secrets set ADMIN_TELEGRAM_BOT_TOKEN=<token bot admin>
//   supabase secrets set ADMIN_TELEGRAM_ID=<tuo id telegram numerico>
//   supabase secrets set ADMIN_TELEGRAM_WEBHOOK_SECRET=<secret-aleatorio>
//   supabase secrets set ADMIN_COMMAND_FORWARD_URL=<url opzionale>
//   supabase secrets set ADMIN_COMMAND_FORWARD_SECRET=<secret opzionale>
//   supabase functions deploy telegram-admin-webhook --no-verify-jwt
//   curl "https://api.telegram.org/bot<ADMIN_TOKEN>/setWebhook?url=<FUNZIONE_URL>&secret_token=<secret-aleatorio>"
//
// Comandi: /start /help /ping /id /stato /log [n] /forward <testo>
// Ogni messaggio autorizzato è REGISTRATO e (se configurato) INOLTRATO.
// ============================================================

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';

/* ------------------------------- Config ------------------------------- */

const BOT_TOKEN = Deno.env.get('ADMIN_TELEGRAM_BOT_TOKEN') ?? '';
const ADMIN_ID = (Deno.env.get('ADMIN_TELEGRAM_ID') ?? '').trim();
const WEBHOOK_SECRET = Deno.env.get('ADMIN_TELEGRAM_WEBHOOK_SECRET') ?? '';
const FORWARD_URL = (Deno.env.get('ADMIN_COMMAND_FORWARD_URL') ?? '').trim();
const FORWARD_SECRET = Deno.env.get('ADMIN_COMMAND_FORWARD_SECRET') ?? '';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

const TABELLA_LOG = 'admin_telegram_log';

const AIUTO = [
  '🛠️ <b>ScuoleRadar · Bot Admin</b>',
  '',
  'Comandi disponibili:',
  '• /ping — verifica che il bot sia raggiungibile',
  '• /id — mostra il tuo ID Telegram',
  '• /stato — stato sintetico del sistema (DB + conteggi)',
  '• /log [n] — ultimi n comandi registrati (default 5, max 20)',
  '• /forward &lt;testo&gt; — inoltra un comando/testo al sistema remoto',
  '• /help — mostra questo messaggio',
  '',
  "Solo l'ID amministratore autorizzato (ADMIN_TELEGRAM_ID) può usare questo bot.",
].join('\n');

/* ------------------------------ REST helpers ------------------------------ */

function restHeaders(): Record<string, string> {
  return {
    apikey: SERVICE_ROLE,
    Authorization: `Bearer ${SERVICE_ROLE}`,
    'Content-Type': 'application/json',
  };
}

/** Registra un comando in `admin_telegram_log` (best-effort: non blocca mai il flusso). */
async function registraLog(riga: Record<string, unknown>): Promise<boolean> {
  if (!SUPABASE_URL || !SERVICE_ROLE) return false;
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${TABELLA_LOG}`, {
    method: 'POST',
    headers: { ...restHeaders(), Prefer: 'return=minimal' },
    body: JSON.stringify(riga),
  }).catch(() => null);
  return res !== null && res.ok;
}

/** Ultimi comandi registrati (per il comando /log). */
async function ultimiLog(limite: number): Promise<Array<Record<string, unknown>>> {
  if (!SUPABASE_URL || !SERVICE_ROLE) return [];
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/${TABELLA_LOG}?select=command,autorizzato,created_at&order=created_at.desc&limit=${limite}`,
    { headers: restHeaders() },
  ).catch(() => null);
  if (!res || !res.ok) return [];
  const dati = (await res.json().catch(() => [])) as Array<Record<string, unknown>>;
  return Array.isArray(dati) ? dati : [];
}

/** Conteggio righe di una tabella (usa `content-range: 0-0/N` di PostgREST). */
async function conta(tabella: string): Promise<number | null> {
  if (!SUPABASE_URL || !SERVICE_ROLE) return null;
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${tabella}?select=id&limit=1`, {
    headers: { ...restHeaders(), Prefer: 'count=exact', Range: '0-0' },
  }).catch(() => null);
  if (!res || !res.ok) return null;
  const m = (res.headers.get('content-range') ?? '').match(/\/\s*(\d+)\s*$/);
  return m ? Number(m[1]) : null;
}

/* ------------------------------ Telegram ------------------------------ */

/** Invia un messaggio all'admin via Bot API (bot DEDICATO admin). */
async function inviaMessaggio(chatId: number, testo: string): Promise<boolean> {
  if (!BOT_TOKEN) {
    console.error('ADMIN_TELEGRAM_BOT_TOKEN non configurato: impossibile rispondere.');
    return false;
  }
  const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text: testo,
      parse_mode: 'HTML',
      disable_web_page_preview: true,
    }),
  }).catch((err) => {
    console.error('Invio Telegram admin fallito:', (err as Error).message);
    return null;
  });
  return res !== null && res.ok;
}

/** Inoltra il comando al sistema remoto configurato (automazione operativa). */
async function inoltra(payload: Record<string, unknown>): Promise<boolean> {
  if (!FORWARD_URL) return false;
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (FORWARD_SECRET) headers.Authorization = `Bearer ${FORWARD_SECRET}`;
  const res = await fetch(FORWARD_URL, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  }).catch(() => null);
  return res !== null && res.ok;
}

function isoOra(): string {
  return new Date().toISOString();
}

/* ------------------------------ Comandi ------------------------------ */

/** Risposta ai comandi informativi (il resto è comunque loggato/inoltrato). */
async function rispondiComando(
  comando: string,
  argomento: string,
  chatId: number,
): Promise<string> {
  switch (comando) {
    case '/ping':
      return `🏓 pong — ${isoOra()}`;
    case '/id':
      return `🆔 Il tuo Telegram ID: <code>${chatId}</code>`;
    case '/stato': {
      const [profili, interpelli, log] = await Promise.all([
        conta('profiles'),
        conta('interpelli'),
        conta(TABELLA_LOG),
      ]);
      const valore = (n: number | null) => (n === null ? 'n/d (DB non raggiungibile)' : String(n));
      return [
        '📊 <b>Stato sistema</b>',
        `• Profili: ${valore(profili)}`,
        `• Interpelli: ${valore(interpelli)}`,
        `• Comandi admin registrati: ${valore(log)}`,
        `• Ora: ${isoOra()}`,
      ].join('\n');
    }
    case '/log': {
      const n = Math.min(Math.max(Number.parseInt(argomento, 10) || 5, 1), 20);
      const righe = await ultimiLog(n);
      if (righe.length === 0) return '📭 Nessun comando registrato (o tabella log non disponibile).';
      const elenco = righe.map(
        (r) => `• ${r.created_at} — ${r.command}${r.autorizzato ? '' : ' (non autorizzato)'}`,
      );
      return ['🗒️ <b>Ultimi comandi</b>', ...elenco].join('\n');
    }
    case '/forward':
      return argomento
        ? `📤 Inoltrato al sistema remoto: ${argomento.slice(0, 200)}`
        : 'Uso: /forward &lt;testo&gt;';
    default:
      // /start, /help o comando sconosciuto → aiuto.
      return AIUTO;
  }
}

/* -------------------------------- serve -------------------------------- */

serve(async (req: Request) => {
  if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405 });

  // 1) Secret del webhook (impostato da Telegram via setWebhook: secret_token).
  //    Fail-closed: senza secret configurato NON si accetta alcun comando.
  const secretHeader = req.headers.get('x-telegram-bot-api-secret-token') ?? '';
  if (!WEBHOOK_SECRET || secretHeader !== WEBHOOK_SECRET) {
    return new Response('Forbidden', { status: 403 });
  }

  let update: Record<string, unknown>;
  try {
    update = (await req.json()) as Record<string, unknown>;
  } catch {
    return new Response('Bad Request', { status: 400 });
  }

  const message = (update.message ?? update.edited_message) as
    | {
        from?: { id?: number; username?: string; first_name?: string };
        chat?: { id?: number };
        text?: string;
      }
    | undefined;

  const fromId = message?.from?.id;
  const chatId = message?.chat?.id;
  const testo = (message?.text ?? '').trim();
  const username = message?.from?.username ?? null;

  // Non-messaggio testuale → ack immediato.
  if (!fromId || !chatId || !testo) return new Response('ok', { status: 200 });

  // 2) Autorizzazione STRETTA: solo ADMIN_TELEGRAM_ID (fail-closed se non configurato).
  const autorizzato = ADMIN_ID !== '' && String(fromId) === ADMIN_ID;

  const [comandoGrezzo, ...resto] = testo.split(/\s+/);
  const comando = (comandoGrezzo ?? '').toLowerCase().split('@')[0]; // gestisce /cmd@botname
  const argomento = resto.join(' ').trim();

  // 3) Log di OGNI comando ricevuto (autorizzato o no) — best-effort.
  await registraLog({
    telegram_id: fromId,
    chat_id: chatId,
    username,
    command: comando.slice(0, 64) || '(vuoto)',
    payload: testo.slice(0, 2000),
    autorizzato,
  });

  // 4) Comando NON autorizzato → nessuna azione e nessuna risposta.
  if (!autorizzato) {
    console.warn(
      `[admin-bot] comando rifiutato da telegram_id=${fromId} (atteso: ${ADMIN_ID || 'non configurato'}).`,
    );
    return new Response('ok', { status: 200 });
  }

  // 5) Risposta ai comandi informativi.
  const risposta = await rispondiComando(comando, argomento, chatId);
  await inviaMessaggio(chatId, risposta);

  // 6) Inoltro al sistema remoto (se configurato): abilita la gestione da remoto.
  const inoltrato = await inoltra({
    source: 'telegram-admin-webhook',
    telegram_id: fromId,
    chat_id: chatId,
    username,
    command: comando,
    argument: argomento,
    text: testo,
    timestamp: isoOra(),
  });

  console.log(
    `[admin-bot] ${comando} da ${fromId}${
      argomento ? ` (${argomento.slice(0, 80)})` : ''
    } — risposta inviata, inoltro: ${inoltrato ? 'ok' : 'non configurato/non riuscito'}`,
  );

  return new Response('ok', { status: 200 });
});
