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
//   supabase secrets set ADMIN_ALERT_SECRET=<secret machine-to-machine>   # alert helper
//   supabase secrets set ADMIN_COMMAND_FORWARD_URL=<url opzionale>
//   supabase secrets set ADMIN_COMMAND_FORWARD_SECRET=<secret opzionale>
//   supabase functions deploy telegram-admin-webhook --no-verify-jwt
//   curl "https://api.telegram.org/bot<ADMIN_TOKEN>/setWebhook?url=<FUNZIONE_URL>&secret_token=<secret-aleatorio>"
//
// Comandi: /start /help /ping /id /status /ultimi /log [n] /forward <testo>
// ALERT helper (percorso A): POST con header `x-admin-alert-secret`
//   body { severity, category, title, message, meta? } → notifica a ADMIN_TELEGRAM_ID.
// Ogni messaggio autorizzato è REGISTRATO e (se configurato) INOLTRATO.
// ============================================================

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';

/* ------------------------------- Config ------------------------------- */

const BOT_TOKEN = Deno.env.get('ADMIN_TELEGRAM_BOT_TOKEN') ?? '';
const ADMIN_ID = (Deno.env.get('ADMIN_TELEGRAM_ID') ?? '').trim();
const WEBHOOK_SECRET = Deno.env.get('ADMIN_TELEGRAM_WEBHOOK_SECRET') ?? '';
const ALERT_SECRET = Deno.env.get('ADMIN_ALERT_SECRET') ?? '';
const FORWARD_URL = (Deno.env.get('ADMIN_COMMAND_FORWARD_URL') ?? '').trim();
const FORWARD_SECRET = Deno.env.get('ADMIN_COMMAND_FORWARD_SECRET') ?? '';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

const TABELLA_LOG = 'admin_telegram_log';
const TABELLA_ALERT = 'admin_telegram_alerts';
const TABELLA_RUNS = 'scraper_runs';

/**
 * BRAND compatto (icona + nome ufficiale cliccabile): apre OGNI messaggio del
 * bot admin, per uniformità con le notifiche del bot pubblico. Niente immagini
 * o anteprime: il marchio è una riga, non un riquadro gigante.
 */
const BRAND_TELEGRAM = '📡 <a href="https://www.scuoleradar.it">Scuole Radar.it</a>';

const AIUTO = [
  '🛠️ <b>ScuoleRadar · Bot Admin</b>',
  '',
  'Comandi disponibili:',
  '• /ping — verifica che il bot sia raggiungibile',
  '• /id — mostra il tuo ID Telegram',
  '• /status — diagnostica: run scraper recenti, conteggi attivi, tasso errori',
  '• /ultimi — ultimi 3 interpelli importati',
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

/** INSERT best-effort su una tabella (non blocca mai il flusso). */
async function restInsert(tabella: string, riga: Record<string, unknown>): Promise<boolean> {
  if (!SUPABASE_URL || !SERVICE_ROLE) return false;
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${tabella}`, {
    method: 'POST',
    headers: { ...restHeaders(), Prefer: 'return=minimal' },
    body: JSON.stringify(riga),
  }).catch(() => null);
  return res !== null && res.ok;
}

/** GET JSON da PostgREST (null se non configurato o in errore). */
async function restJson<T>(cammino: string): Promise<T | null> {
  if (!SUPABASE_URL || !SERVICE_ROLE) return null;
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${cammino}`, {
    headers: restHeaders(),
  }).catch(() => null);
  if (!res || !res.ok) return null;
  return (await res.json().catch(() => null)) as T | null;
}

/** Registra un comando in `admin_telegram_log`. */
function registraLog(riga: Record<string, unknown>): Promise<boolean> {
  return restInsert(TABELLA_LOG, riga);
}

/** Ultimi comandi registrati (per il comando /log). */
async function ultimiLog(limite: number): Promise<Array<Record<string, unknown>>> {
  const dati = await restJson<Array<Record<string, unknown>>>(
    `${TABELLA_LOG}?select=command,autorizzato,created_at&order=created_at.desc&limit=${limite}`,
  );
  return Array.isArray(dati) ? dati : [];
}

/** Conteggio righe di una tabella (filtro PostgREST opzionale, es. `col=gte.val`). */
async function conta(tabella: string, filtro = ''): Promise<number | null> {
  if (!SUPABASE_URL || !SERVICE_ROLE) return null;
  const query = filtro ? `&${filtro}` : '';
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${tabella}?select=id&limit=1${query}`, {
    headers: { ...restHeaders(), Prefer: 'count=exact', Range: '0-0' },
  }).catch(() => null);
  if (!res || !res.ok) return null;
  const m = (res.headers.get('content-range') ?? '').match(/\/\s*(\d+)\s*$/);
  return m ? Number(m[1]) : null;
}

/* ---------------------------- Diagnostica run ---------------------------- */

interface RunScraper {
  esito?: string;
  trovati?: number;
  nuovi?: number;
  errori?: number;
  telegram_attesi?: number;
  telegram_riusciti?: number;
  created_at?: string;
}

/** Ultimi run dello scraper nell'intervallo indicato (per /status). */
async function ultimiRun(giorni = 7, limite = 50): Promise<RunScraper[]> {
  const da = new Date(Date.now() - giorni * 86_400_000).toISOString();
  const dati = await restJson<RunScraper[]>(
    `${TABELLA_RUNS}?select=esito,trovati,nuovi,errori,telegram_attesi,telegram_riusciti,created_at&created_at=gte.${da}&order=created_at.desc&limit=${limite}`,
  );
  return Array.isArray(dati) ? dati : [];
}

interface InterpelloRiga {
  title?: string;
  province?: string;
  class_codes?: string[];
  created_at?: string;
}

/** Ultimi interpelli importati (per /ultimi). */
async function ultimiInterpelli(limite = 3): Promise<InterpelloRiga[]> {
  const dati = await restJson<InterpelloRiga[]>(
    `interpelli?select=title,province,class_codes,created_at&order=created_at.desc&limit=${limite}`,
  );
  return Array.isArray(dati) ? dati : [];
}

/* ------------------------------ Telegram ------------------------------ */

/** Invia un messaggio all'admin via Bot API (bot DEDICATO admin). */
async function inviaMessaggio(chatId: number, testo: string): Promise<boolean> {
  if (!BOT_TOKEN) {
    console.error('ADMIN_TELEGRAM_BOT_TOKEN non configurato: impossibile rispondere.');
    return false;
  }
  // Brand compatto in testa + anteprime dei link DISATTIVATE (nessun riquadro
  // generato da Telegram che copra il contenuto del messaggio).
  const corpo = `${BRAND_TELEGRAM}\n\n${testo}`;
  const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text: corpo,
      parse_mode: 'HTML',
      link_preview_options: { is_disabled: true },
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

/** Confronto a tempo costante (evita timing attack sui secret). */
function confrontoCostante(a: string, b: string): boolean {
  if (!a || !b || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function escapeHtml(v: string): string {
  return (v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** Risposta JSON standard (per il percorso ALERT). */
function rispostaJson(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}

/* --------------------------- Alert helper (admin) --------------------------- */

type SeveritaAlerta = 'critical' | 'warning' | 'info';

interface Alerta {
  severity?: SeveritaAlerta;
  category?: string;
  title: string;
  message: string;
  meta?: Record<string, unknown>;
}

const EMOJI_SEVERITA: Record<SeveritaAlerta, string> = {
  critical: '🚨',
  warning: '⚠️',
  info: 'ℹ️',
};

/** Formatta l'alert in HTML per Telegram. */
function formattaAlerta(a: Alerta): string {
  const severity = a.severity ?? 'warning';
  return [
    `${EMOJI_SEVERITA[severity]} <b>${escapeHtml(a.title)}</b>`,
    `Severità: <b>${severity.toUpperCase()}</b> · Categoria: <code>${escapeHtml(
      a.category ?? 'generale',
    )}</code>`,
    '',
    escapeHtml(a.message),
    '',
    `🕒 ${isoOra()}`,
  ].join('\n');
}

/**
 * ALERT helper: invia una notifica PRIORITARIA ad ADMIN_TELEGRAM_ID e la registra
 * in `admin_telegram_alerts`. Usato per fallimenti critici dello scraper o
 * anomalie di routing. Fail-closed: senza ADMIN_TELEGRAM_ID non invia nulla.
 */
async function inviaAlerta(a: Alerta): Promise<{ ok: boolean; inviato: boolean; error?: string }> {
  const severity: SeveritaAlerta = a.severity ?? 'warning';
  if (!ADMIN_ID) {
    return { ok: false, inviato: false, error: 'ADMIN_TELEGRAM_ID non configurato' };
  }
  const inviato = await inviaMessaggio(Number(ADMIN_ID), formattaAlerta({ ...a, severity }));
  await restInsert(TABELLA_ALERT, {
    severity,
    category: a.category ?? 'generale',
    title: a.title,
    message: a.message,
    meta: a.meta ?? null,
    inviato,
  });
  return { ok: true, inviato };
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
    case '/status':
    case '/stato': {
      const oggi = new Date().toISOString().slice(0, 10);
      const iso24h = new Date(Date.now() - 86_400_000).toISOString();
      const iso7g = new Date(Date.now() - 7 * 86_400_000).toISOString();
      const [totale, attivi, nuovi24h, nuovi7g, profili, runs] = await Promise.all([
        conta('interpelli'),
        conta('interpelli', `expiration_date=gte.${oggi}`),
        conta('interpelli', `created_at=gte.${iso24h}`),
        conta('interpelli', `created_at=gte.${iso7g}`),
        conta('profiles'),
        ultimiRun(7),
      ]);
      const valore = (n: number | null) => (n === null ? 'n/d' : String(n));
      const runError = runs.filter((r) => r.esito === 'error').length;
      const runWarn = runs.filter((r) => r.esito === 'warn').length;
      const runOk = runs.length - runError - runWarn;
      const tasso = runs.length ? Math.round((runError / runs.length) * 100) : 0;
      const ultimoRun = runs[0];
      const rigaUltimo = ultimoRun
        ? `• Ultimo run: ${ultimoRun.created_at} — ${ultimoRun.esito ?? 'n/d'} ` +
          `(trovati ${ultimoRun.trovati ?? '?'}, nuovi ${ultimoRun.nuovi ?? '?'}, ` +
          `TG ${ultimoRun.telegram_riusciti ?? '?'}/${ultimoRun.telegram_attesi ?? '?'})`
        : '• Ultimo run: n/d';
      return [
        '📊 <b>Status sistema</b>',
        `• Interpelli attivi: ${valore(attivi)} / ${valore(totale)} totali`,
        `• Nuovi: 24h ${valore(nuovi24h)} · 7g ${valore(nuovi7g)}`,
        `• Profili: ${valore(profili)}`,
        `• Run scraper (7g): ${runs.length} — ok ${runOk}, warn ${runWarn}, error ${runError}`,
        `• Tasso errori run (7g): ${tasso}%`,
        rigaUltimo,
        `• Ora: ${isoOra()}`,
      ].join('\n');
    }
    case '/ultimi': {
      const lista = await ultimiInterpelli(3);
      if (lista.length === 0) return '📭 Nessun interpello importato (o tabella non disponibile).';
      const righe = lista.map((r) => {
        const classi = (r.class_codes ?? []).slice(0, 3).join(', ');
        const prov = r.province ? `[${r.province}] ` : '';
        const titolo = (r.title ?? '(senza titolo)').slice(0, 90);
        return `• ${prov}${titolo}${classi ? ` — ${classi}` : ''}\n   🕒 ${r.created_at ?? 'n/d'}`;
      });
      return ['🆕 <b>Ultimi interpelli importati</b>', ...righe].join('\n');
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

  // A) Percorso ALERT (macchina→macchina, es. scraper Node): header x-admin-alert-secret.
  //    Fail-closed: se ADMIN_ALERT_SECRET non è configurato il percorso è disattivato.
  const alertHeader = req.headers.get('x-admin-alert-secret') ?? '';
  if (ALERT_SECRET && confrontoCostante(alertHeader, ALERT_SECRET)) {
    let corpoAlerta: Record<string, unknown>;
    try {
      corpoAlerta = (await req.json()) as Record<string, unknown>;
    } catch {
      return rispostaJson({ ok: false, error: 'Bad Request' }, 400);
    }
    const title = String(corpoAlerta.title ?? '').trim();
    const message = String(corpoAlerta.message ?? '').trim();
    if (!title || !message) {
      return rispostaJson({ ok: false, error: 'title e message sono obbligatori' }, 400);
    }
    const esito = await inviaAlerta({
      severity: (corpoAlerta.severity as SeveritaAlerta) ?? 'warning',
      category: String(corpoAlerta.category ?? 'scraper'),
      title,
      message,
      meta: (corpoAlerta.meta as Record<string, unknown>) ?? undefined,
    });
    return rispostaJson(esito, 200);
  }

  // B) Percorso WEBHOOK Telegram (secret impostato via setWebhook: secret_token).
  //    Fail-closed: senza secret configurato NON si accetta alcun comando.
  const secretHeader = req.headers.get('x-telegram-bot-api-secret-token') ?? '';
  if (!WEBHOOK_SECRET || !confrontoCostante(secretHeader, WEBHOOK_SECRET)) {
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
