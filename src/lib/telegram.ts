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
  if (!token || token.includes('ExampleToken') || token.includes('xxxx')) {
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
    testa: '👋 Benvenuto in ScuoleRadar!',
    paragrafi: [
      'Abbiamo iniziato a cercare per te le opportunità più interessanti in base al tuo profilo: interpelli, supplenze, incarichi, PNRR, PON, POR e altro ancora.',
      'Per provare il servizio hai a disposizione 3 segnalazioni ultra personalizzate.',
      'Noi cerchiamo. Tu decidi quali opportunità cogliere.',
    ],
    cta: (linkPro) =>
      `💰 ScuoleRadar PRO costa 49 € all'anno, con tutti i nostri servizi inclusi.\n👉 <a href="${linkPro}">Attiva PRO</a>`,
  },
  prova1: {
    testa: '🎯 Abbiamo trovato una nuova opportunità per te!',
    paragrafi: [
      'Questa è la <b>prima</b> opportunità che abbiamo trovato per te.',
      'Te ne restano <b>2</b> per provare il servizio.',
      'Come vedi, non ti intasiamo di segnalazioni inutili solo per fare volume: cerchiamo proprio quell\'opportunità che può fare la differenza.',
      'Una buona opportunità può valere mesi, o persino un anno, di lavoro.',
    ],
    cta: (linkPro) =>
      `💰 Se vuoi che continuiamo a cercare per te, ScuoleRadar PRO costa 49 € all'anno.\n👉 <a href="${linkPro}">Continua con PRO</a>`,
  },
  prova2: {
    testa: '🎯 Abbiamo trovato un\'altra opportunità che potrebbe interessarti!',
    paragrafi: [
      'Questa è la <b>seconda</b> segnalazione che ti inviamo.',
      'Te ne resta <b>1</b>.',
      'Facciamo ogni giorno del nostro meglio per trovare le migliori opportunità per te, in modo che tu non debba sprecare il tuo tempo a farlo.',
      'Una sola opportunità andata a buon fine può valere migliaia di euro. E se ti sfugge, sono migliaia di euro che perdi, non soltanto un\'email.',
    ],
    cta: (linkPro) =>
      `💰 ScuoleRadar PRO costa 49 € all'anno e comprende tutti i nostri servizi per la scuola.\n👉 <a href="${linkPro}">Continua con PRO</a>`,
  },
  prova3: {
    testa: '🎯 Terza e ultima segnalazione di prova!',
    paragrafi: [
      'Se nel frattempo hai trovato quello che cercavi grazie a noi e non vuoi abbonarti, siamo contenti per te.',
      'Dillo ai tuoi amici e siamo pari.',
      'Se invece vuoi che continuiamo a cercare opportunità per te, puoi attivare ScuoleRadar PRO a 49 € all\'anno.',
      'Nel prezzo sono inclusi anche la modulistica, lo strumento per costruire e aggiornare il CV, il calcolatore di CFU e gli altri servizi per chi lavora nella scuola.',
    ],
    cta: (linkPro) => `👉 <a href="${linkPro}">Continua con PRO</a>`,
  },
  extra: {
    testa: '😊 Questa opportunità non dovevamo mandartela...',
    paragrafi: [
      'Il periodo di prova è terminato, ma quando l\'abbiamo vista ci è sembrata davvero adatta al tuo profilo ed era un peccato non fartela vedere.',
      'Ecco, questa volta te l\'abbiamo offerta noi. 😊',
      'Se vuoi che continuiamo a cercare opportunità per te, ScuoleRadar PRO costa 49 € all\'anno.',
      'Hai anche accesso a tutta la modulistica, allo strumento per costruire il CV, al calcolatore di CFU, a Pure Focus e agli altri servizi che stiamo sviluppando.',
      'Buona giornata, e buona vita!',
    ],
    cta: (linkPro) => `👉 <a href="${linkPro}">Attiva PRO</a>`,
  },
  recap: {
    testa: '📋 Il tuo periodo di prova su ScuoleRadar è terminato',
    paragrafi: [
      'Hai ricevuto le 3 segnalazioni gratuite di ScuoleRadar.',
      'Da questo momento il tuo account passa al piano Free: puoi continuare a usare i servizi disponibili gratuitamente, consultare il blog, scaricare la modulistica e usare gli strumenti che mettiamo a disposizione.',
      'Quello che cambia è che smettiamo di cercare opportunità personalizzate per te.',
      'Se vuoi continuare a ricevere interpelli, supplenze, incarichi, PNRR, PON, POR e altre opportunità selezionate in base al tuo profilo, puoi attivare ScuoleRadar PRO a 49 € all\'anno.',
      'Una sola buona opportunità può valere migliaia di euro.',
      'E nel frattempo hai tutto il resto: CV, calcolo CFU, Pure Focus, modulistica e gli altri servizi PRO.',
      'Se invece preferisci restare sul piano Free, nessun problema.',
      'Buona vita. Se cambi idea, noi siamo qui.',
    ],
    cta: (linkPro) => `👉 <a href="${linkPro}">Attiva PRO</a>`,
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
    interpello && TIPI_CON_OPPORTUNITA.has(tipo)
      ? `🔗 <a href="${escapeHtml(linkOpp)}">Vedi l'opportunità e candidati</a>`
      : '';

  const parti: string[] = [copy.testa];
  if (titolo) parti.push(titolo);
  if (dettagli) parti.push(dettagli);
  if (linkRiga) parti.push(linkRiga);
  if (copy.paragrafi.length) parti.push(copy.paragrafi.join('\n'));
  if (copy.cta) parti.push(copy.cta(linkPro, linkOpp));

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
