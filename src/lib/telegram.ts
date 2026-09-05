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
    return new URL('prezzi', baseUrl(dashboardUrl)).toString();
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
    testa: '🎉 Mese di PRO attivo — benvenuto in ScuoleRadar!',
    paragrafi: [
      'Per i primi 30 giorni hai il piano PRO gratuito.',
      'Hai accesso a Modulistica, Crea CV, Calcolatore CFU e Radar Scuole con notifiche illimitate.',
      'Quando vuoi sapere cosa succede di importante nella scuola, passa dal nostro Notiziario.',
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
  prova3: {
    testa: '🎯 Terza e ultima opportunità',
    paragrafi: ['Questa è la <b>terza e ultima opportunità</b> di prova che abbiamo trovato per te.'],
    cta: (_linkPro, linkOpp) => `👉 <a href="${linkOpp}">Guarda l'opportunità e candidati</a>`,
  },
  extra: {
    testa: '😮 Il tuo periodo di prova è terminato',
    paragrafi: [
      'Le tue <b>3 notifiche di prova sono terminate</b>.',
      'Per continuare a ricevere le opportunità su misura per te, passa al piano PRO.',
    ],
    cta: (linkPro) => `👉 <a href="${linkPro}">Attiva PRO</a>`,
  },
  recap: {
    testa: '📋 Avviso finale: servizio di notifica sospeso',
    paragrafi: [
      'Questo è l\'ultimo avviso del periodo di prova.',
      'Il mese di prova PRO è terminato: non riceverai più nuove notifiche.',
      'Passa a PRO per riattivarlo.',
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
  conferma_attivazione: {
    testa: '🎉 Conferma attivazione: il tuo piano PRO è attivo!',
    paragrafi: [
      'La tua attivazione è confermata: il piano PRO di ScuoleRadar è attivo.',
      'Notifiche illimitate, strumenti docenti completi, modulistica sempre aggiornata e Pure Focus.',
      'Nessun altro passaggio: noi continuiamo a cercare per te.',
    ],
    cta: (dashboardUrl) => `👉 <a href="${dashboardUrl}">Vai a ScuoleRadar</a>`,
  },
  free_forever_preavviso: {
    testa: '🎁 PRO Free Forever: il rinnovo gratuito è automatico',
    paragrafi: [
      'Il tuo piano PRO Free Forever si sta avvicinando alla scadenza annuale.',
      'Nessun pagamento e nessuna azione richiesta: alla scadenza il rinnovo parte automaticamente a 0€, per sempre.',
      'Non riceverai mai solleciti di pagamento né avvisi di mancato rinnovo.',
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

/* ------------------- Canali regionali (pubblicazione interpelli) ------------------- */

/** Dati minimi di un interpello per la pubblicazione sul canale regionale. */
export interface InterpelloCanale {
  title: string;
  schoolName?: string | null;
  province: string;
  classCodes?: string[];
  expirationDate?: string | null;
  link?: string | null;
}

/**
 * Canali Telegram regionali di acquisizione interpelli.
 * Formato env TELEGRAM_CHANNELS (JSON, chiave = codice provincia):
 *   {"MI":"@ScuoleRadar_Interpelli_Milano","TO":"@ScuoleRadar_Interpelli_Torino"}
 * Il bot deve essere AMMINISTRATORE del canale (o il chat_id numerico -100… del canale).
 */
export function getTelegramChannels(): Record<string, string> {
  const raw = (process.env.TELEGRAM_CHANNELS ?? '').trim();
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const canali: Record<string, string> = {};
    for (const [prov, chat] of Object.entries(parsed)) {
      if (typeof chat === 'string' && chat.trim()) canali[prov.trim().toUpperCase()] = chat.trim();
    }
    return canali;
  } catch (err) {
    console.warn(
      '⚠ TELEGRAM_CHANNELS non è un JSON valido — pubblicazione canali disattivata:',
      (err as Error).message,
    );
    return {};
  }
}

/** Chat/canale configurato per una provincia (es. "MI"), o null. */
export function canalePerProvincia(provincia: string): string | null {
  const canali = getTelegramChannels();
  const p = (provincia ?? '').trim().toUpperCase();
  return p && canali[p] ? canali[p] : null;
}

/**
 * Pubblica un interpello NUOVO sul canale Telegram regionale.
 * Struttura del post:
 *   🚨 NUOVO INTERPELLO - [CLASSE] - [PROVINCIA]
 *   🏫 Scuola · 🗓 Scadenza · 🔗 Avviso
 *   CTA footer: "Vuoi ricevere solo gli interpelli per la tua classe di concorso?
 *               Attiva il tuo Radar su ScuoleRadar.it"
 */
export async function pubblicaInterpelloSuCanale(
  interpello: InterpelloCanale,
  chatId?: string,
): Promise<EsitoTelegram> {
  const canale = chatId?.trim() ?? canalePerProvincia(interpello.province);
  if (!canale) return { ok: false, error: 'Nessun canale configurato per la provincia' };

  const classe = (interpello.classCodes?.[0] ?? 'ND').toUpperCase();
  const provincia = (interpello.province ?? '').trim().toUpperCase() || 'ND';
  const scadenza = formatDataScadenza(interpello.expirationDate ?? null);

  const righe: string[] = [
    `🚨 NUOVO INTERPELLO - <b>${escapeHtml(classe)}</b> - ${provincia}`,
    '',
  ];

  if (interpello.schoolName?.trim()) {
    righe.push(`🏫 <b>${escapeHtml(interpello.schoolName.trim())}</b>`);
  }
  if (interpello.title?.trim()) {
    righe.push(`📌 ${escapeHtml(interpello.title.trim())}`);
  }
  righe.push(`🗓 Scadenza: ${scadenza}`);
  if (interpello.link?.trim()) {
    righe.push(`🔗 <a href="${escapeHtml(interpello.link.trim())}">Vai all'avviso ufficiale</a>`);
  }
  righe.push('', 'Vuoi ricevere solo gli interpelli per la tua classe di concorso?');
  righe.push(`<a href="${DASHBOARD_URL.replace(/\/+$/, '')}/">Attiva il tuo Radar su ScuoleRadar.it</a>`);

  return inviaMessaggioTelegram(canale, righe.join('\n'));
}

