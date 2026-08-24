/**
 * ScuoleRadar.it — Notifiche Telegram (FASE 5)
 *
 * Invio di messaggi formattati (HTML) tramite le Telegram Bot API:
 *   https://api.telegram.org/bot<TOKEN>/sendMessage
 *
 * Variabili d'ambiente:
 *   TELEGRAM_BOT_TOKEN  (obbligatoria) — token del bot @ScuoleRadar_bot
 *   RESEND_DASHBOARD_URL (opzionale)   — URL della dashboard per il link del messaggio
 *
 * NOTA: modulo solo-Node, escluso dal typecheck/build del frontend.
 */

import { classeRilevante, type DettagliNotifica } from './resend.ts';

/** Interfaccia per l'ambiente (evita la dipendenza da @types/node nel frontend). */
declare const process: { env: Record<string, string | undefined> };

const DASHBOARD_URL =
  process.env.RESEND_DASHBOARD_URL ?? 'https://scuoleradar.it/dashboard/radar';

/* ------------------------------- Helpers ------------------------------- */

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function formatDataScadenza(data: string | null): string {
  if (!data) return 'Non indicata';
  const d = new Date(data);
  if (Number.isNaN(d.getTime())) return data;
  return d.toLocaleDateString('it-IT', { day: '2-digit', month: 'long', year: 'numeric' });
}

/** Restituisce il token del bot o `null` se non configurato (o placeholder). */
export function getTelegramBotToken(): string | null {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token || token.includes('ExampleToken') || token.includes('xxxx')) {
    console.warn('⚠ TELEGRAM_BOT_TOKEN non configurato: notifiche Telegram disattivate.');
    return null;
  }
  return token;
}

/** Formatta il messaggio di notifica per un interpello (parse_mode HTML). */
export function formattaMessaggioInterpello(
  interpello: DettagliNotifica,
  classe: string,
  dashboardUrl: string = DASHBOARD_URL,
): string {
  const scuola = escapeHtml(interpello.schoolName || 'Scuola non indicata');
  const provincia = escapeHtml(interpello.province);
  const scadenza = formatDataScadenza(interpello.scadenza);
  const link = interpello.link ? escapeHtml(interpello.link) : dashboardUrl;

  return (
    '🎯 <b>Nuovo Interpello Trovato!</b>\n' +
    `🏫 <b>Scuola:</b> ${scuola}\n` +
    `📍 <b>Provincia:</b> ${provincia}\n` +
    `📚 <b>Classe di Concorso:</b> ${escapeHtml(classe)}\n` +
    `⏳ <b>Scadenza:</b> ${scadenza}\n` +
    `🔗 <a href="${link}">Apri su ScuoleRadar</a>`
  );
}

export interface EsitoTelegram {
  ok: boolean;
  error?: string;
}

/**
 * Invia un messaggio di testo al chat_id indicato tramite le Bot API.
 * `parse_mode: 'HTML'` per la formattazione (bold, link).
 */
export async function inviaMessaggioTelegram(
  chatId: string,
  testo: string,
): Promise<EsitoTelegram> {
  const token = getTelegramBotToken();
  if (!token) return { ok: false, error: 'Token non configurato' };
  if (!chatId.trim()) return { ok: false, error: 'Chat ID mancante' };

  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId.trim(),
        text: testo,
        parse_mode: 'HTML',
        disable_web_page_preview: false,
      }),
    });

    const data = (await res.json().catch(() => null)) as {
      ok?: boolean;
      description?: string;
    } | null;

    if (!res.ok || !data?.ok) {
      return { ok: false, error: data?.description ?? `HTTP ${res.status}` };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

/** Invia la notifica Telegram di un interpello, usando la classe in comune con l'utente. */
export async function inviaNotificaTelegram(
  chatId: string,
  interpello: DettagliNotifica,
  opts: { classiUtente?: string[]; dashboardUrl?: string } = {},
): Promise<EsitoTelegram> {
  const classe = classeRilevante(interpello, {
    email: '',
    province: [],
    classi: opts.classiUtente ?? [],
  });
  const testo = formattaMessaggioInterpello(interpello, classe, opts.dashboardUrl);
  return inviaMessaggioTelegram(chatId, testo);
}
