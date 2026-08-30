/**
 * ScuoleRadar.it — Notifiche Telegram (FASE 5)
 *
 * Messaggi HTML (parse_mode) coerenti con la sequenza di copy di Bartolo:
 * le 8 tipologie di resend.ts, adattate in versione testo sobria ed empatica.
 *
 * Variabili d'ambiente:
 *   TELEGRAM_BOT_TOKEN   (obbligatoria) — token del bot @ScuoleRadar_bot
 *   RESEND_DASHBOARD_URL (opzionale)    — URL base dell'app per i link
 *
 * NOTA: modulo solo-Node, escluso dal typecheck/build del frontend.
 */

import {
  categoriaOpportunita,
  classeRilevante,
  linkOpportunita,
  TIPI_CON_OPPORTUNITA,
  type DettagliNotifica,
  type TipoMessaggio,
} from './resend.ts';

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

/** Base assoluta dell'app (origin) derivata dall'URL della dashboard. */
function baseUrl(dashboardUrl: string): string {
  try {
    return new URL('/', dashboardUrl).toString();
  } catch {
    return 'https://scuoleradar.it/';
  }
}

/** URL assoluto della pagina prezzi per la CTA PRO. */
function proUrl(dashboardUrl: string): string {
  try {
    return new URL('/prezzi', dashboardUrl).toString();
  } catch {
    return 'https://scuoleradar.it/prezzi';
  }
}

/** Restituisce il token del bot o `null` se non configurato (o placeholder). */
export function getTelegramBotToken(): string | null {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token || token.includes('ExampleToken') || token.includes('xxxx') || token.includes('inserisci')) {
    console.warn('⚠ TELEGRAM_BOT_TOKEN non configurato: notifiche Telegram disattivate.');
    return null;
  }
  return token;
}

/* --------------------------- Copy per tipologia --------------------------- */

interface TestoTelegram {
  /** Testata del messaggio (prima riga, in grassetto). */
  testa: string;
  /** Corpo del messaggio. */
  paragrafi: string[];
  /** Blocco CTA finale (facoltativo). */
  cta?: (linkPro: string, linkOpp: string) => string;
}

const TESTO_TELEGRAM: Record<TipoMessaggio, TestoTelegram> = {
  welcome: {
    testa: '👋 Benvenuto in ScuoleRadar',
    paragrafi: [
      'Grazie per esserti iscritto, ora ci pensiamo noi.',
      'Il tuo profilo è <b>attivo</b>: interpelli, supplenze, PON, PNRR e bandi per esperti ora hanno qualcuno che li monitora per te.',
    ],
    cta: (dashboardUrl) => `👉 <a href="${dashboardUrl}">Vai a ScuoleRadar</a>`,
  },
  prova1: {
    testa: '🎯 Prima opportunità',
    paragrafi: ['Questa è la <b>prima opportunità</b> che abbiamo trovato per te. Te ne <b>restano 2</b>.'],
    cta: (_linkPro, linkOpp) => `👉 <a href="${linkOpp}">Guarda l'opportunità e candidati</a>`,
  },
  prova2: {
    testa: '🎯 Seconda opportunità',
    paragrafi: ['Questa è la <b>seconda opportunità</b> che abbiamo trovato per te. Te ne <b>resta 1</b>.'],
    cta: (_linkPro, linkOpp) => `👉 <a href="${linkOpp}">Guarda l'opportunità e candidati</a>`,
  },
  extra: {
    testa: '😮 Questa non dovevamo mandartela...',
    paragrafi: ['Questa non dovevamo mandartela, ma era troppo bella. <b>Ora il tuo periodo di prova è finito.</b>'],
    cta: (linkPro) => `👉 <a href="${linkPro}">Attiva PRO</a>`,
  },
  recap: {
    testa: '📋 Le tue notifiche di prova sono finite',
    paragrafi: [
      'Le tue notifiche di prova sono finite. <b>Passa al piano PRO</b> per continuare a ricevere notifiche illimitate in tempo reale, oppure resta con l\'Account Base.',
    ],
    cta: (linkPro) => `👉 <a href="${linkPro}">Passa a PRO</a>`,
  },
  welcome_pro: {
    testa: '🎉 Benvenuto in ScuoleRadar PRO!',
    paragrafi: [
      'Da oggi continuiamo a cercare per te le opportunità più interessanti in base al tuo profilo: interpelli, supplenze, incarichi, PNRR, PON, POR e altro ancora.',
      'Tu non devi passare ore a cercarle: quando troviamo qualcosa che sembra fatto per te, te lo segnaliamo.',
      'E hai accesso a tutti i servizi PRO di ScuoleRadar: CV, calcolo CFU, modulistica, Pure Focus e gli altri strumenti che stiamo sviluppando per chi lavora nella scuola.',
      'Hai fatto un buon investimento.',
      'Noi continuiamo a cercare per te!',
      'A presto!',
    ],
    cta: (dashboardUrl) => `👉 <a href="${dashboardUrl}">Vai a ScuoleRadar</a>`,
  },
  notifica_pro: {
    testa: '🎯 Nuova opportunità trovata per te!',
    paragrafi: [
      'Abbiamo trovato una <b>nuova opportunità</b> per te.',
      'Ci è sembrata interessante per il tuo profilo e abbiamo pensato che valesse la pena fartela vedere.',
      'Continuiamo a cercare per te.',
      'A presto!',
    ],
    cta: (_linkPro, linkOpp) => `👉 <a href="${linkOpp}">Guarda l'opportunità e candidati</a>`,
  },
};

/* ------------------------- Formattazione messaggio ------------------------- */

/**
 * Formatta il messaggio per una delle 8 tipologie (parse_mode HTML).
 * `interpello` può essere null per i messaggi transazionali (welcome, recap, welcome_pro).
 */
export function formattaMessaggioTelegram(
  interpello: DettagliNotifica | null,
  classe: string,
  dashboardUrl: string = DASHBOARD_URL,
  tipo: TipoMessaggio = 'welcome',
): string {
  const copy = TESTO_TELEGRAM[tipo];
  const linkPro = proUrl(dashboardUrl);
  const linkOpp = linkOpportunita(interpello, dashboardUrl);

  const titolo = interpello ? `📌 <b>${escapeHtml(interpello.title)}</b>` : '';

  // Dettagli compatti: scuola e classe si omettono se sono già dentro il titolo.
  let dettagli = '';
  if (interpello && TIPI_CON_OPPORTUNITA.has(tipo)) {
    const tLower = interpello.title.toLowerCase();
    const righe: string[] = [];
    if (interpello.schoolName && !tLower.includes(interpello.schoolName.toLowerCase())) {
      righe.push(`🏫 ${escapeHtml(interpello.schoolName)}`);
    }
    if (classe && !tLower.includes(classe.toLowerCase())) {
      righe.push(`📚 ${escapeHtml(classe)}`);
    }
    righe.push(`📍 ${escapeHtml(interpello.province)}`);
    righe.push(`⏳ Scadenza: ${formatDataScadenza(interpello.scadenza)}`);
    righe.push(`🏷️ ${escapeHtml(categoriaOpportunita(interpello.title))}`);
    dettagli = righe.join('\n');
  }

  const linkRiga =
    interpello && interpello.link && TIPI_CON_OPPORTUNITA.has(tipo)
      ? `🔗 <a href="${escapeHtml(interpello.link)}">Fonte ufficiale verificata (Albo Pretorio) — apri e candidati</a>`
      : '';

  const parti: string[] = [copy.testa];
  if (titolo) parti.push(titolo);
  if (dettagli) parti.push(dettagli);
  if (linkRiga) parti.push(linkRiga);
  if (copy.paragrafi.length) parti.push(copy.paragrafi.join('\n'));
  if (copy.cta) parti.push(copy.cta(linkPro, linkOpp));
  parti.push('I tuoi colleghi di <b>Scuole Radar</b>');

  return parti.join('\n\n');
}

/* ------------------------------ Invio messaggi ------------------------------ */

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

/** Invia la notifica Telegram per una delle 8 tipologie, usando la classe in comune. */
export async function inviaNotificaTelegram(
  chatId: string,
  interpello: DettagliNotifica | null,
  opts: { classiUtente?: string[]; dashboardUrl?: string; tipo?: TipoMessaggio } = {},
): Promise<EsitoTelegram> {
  const classe = interpello
    ? classeRilevante(interpello, {
        email: '',
        province: [],
        classi: opts.classiUtente ?? [],
      })
    : '';
  const testo = formattaMessaggioTelegram(interpello, classe, opts.dashboardUrl, opts.tipo ?? 'welcome');
  return inviaMessaggioTelegram(chatId, testo);
}
