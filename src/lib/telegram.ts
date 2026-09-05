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
import { province } from '../data/province.ts';

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
  /** Codice provincia (es. "MI"). */
  province: string;
  /** Comune, quando noto (es. estratto dal titolo/avviso). */
  comune?: string | null;
  /** Classi di concorso / profili coinvolti (es. ["A-026"], ["ADEE"]). */
  classCodes?: string[];
  expirationDate?: string | null;
  link?: string | null;
}

/**
 * Canali Telegram UFFICIALI di pubblicazione, uno per ciascuna delle 20 regioni
 * italiane. Il bot @ScuoleRadar_bot deve essere AMMINISTRATORE del canale
 * (oppure è possibile usare il chat_id numerico -100… del canale).
 */
export const CANALI_TELEGRAM_REGIONALI: Record<string, string> = {
  Piemonte: '@scuoleradar_piemonte',
  Lombardia: '@scuoleradar_lombardia',
  Veneto: '@scuoleradar_veneto',
  'Emilia-Romagna': '@scuoleradar_emiliaromagna',
  Toscana: '@scuoleradar_toscana',
  Lazio: '@scuoleradar_lazio',
  Campania: '@scuoleradar_campania',
  Sicilia: '@scuoleradar_sicilia',
  Puglia: '@scuoleradar_puglia',
  Liguria: '@scuoleradar_liguria',
  'Friuli-Venezia Giulia': '@scuoleradar_friuli',
  Marche: '@scuoleradar_marche',
  Umbria: '@scuoleradar_umbria',
  Abruzzo: '@scuoleradar_abruzzo',
  Calabria: '@scuoleradar_calabria',
  Sardegna: '@scuoleradar_sardegna',
  'Trentino-Alto Adige': '@scuoleradar_trentino',
  Basilicata: '@scuoleradar_basilicata',
  Molise: '@scuoleradar_molise',
  "Valle d'Aosta": '@scuoleradar_valledaosta',
};

/**
 * Canali Telegram effettivi per regione: i 20 canali ufficiali, con eventuale
 * override via env TELEGRAM_CHANNELS_REGIONALI (JSON "Regione" → "@canale",
 * utile per test o canali temporanei).
 */
export function getTelegramCanaliRegionali(): Record<string, string> {
  const canali: Record<string, string> = { ...CANALI_TELEGRAM_REGIONALI };
  const raw = (process.env.TELEGRAM_CHANNELS_REGIONALI ?? '').trim();
  if (!raw) return canali;
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    for (const [regione, chat] of Object.entries(parsed)) {
      if (typeof chat === 'string' && chat.trim()) canali[regione.trim()] = chat.trim();
    }
  } catch (err) {
    console.warn(
      '⚠ TELEGRAM_CHANNELS_REGIONALI non è un JSON valido — uso i canali regionali di default:',
      (err as Error).message,
    );
  }
  return canali;
}

/**
 * Override RETRO-COMPATIBILE per-provincia via env TELEGRAM_CHANNELS
 * (JSON, chiave = codice provincia), es.:
 *   {"MI":"@canale_test_Milano","TO":"@canale_test_Torino"}
 * Se valorizzato per una provincia, vince sul canale regionale ufficiale.
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
      '⚠ TELEGRAM_CHANNELS non è un JSON valido — override per-provincia disattivato:',
      (err as Error).message,
    );
    return {};
  }
}

/** Regione di appartenenza di un codice provincia (es. "MI" → "Lombardia"). */
export function regionePerProvincia(codiceProvincia: string): string | null {
  const p = (codiceProvincia ?? '').trim().toUpperCase();
  if (!p) return null;
  return province.find((x) => x.codice === p)?.regione ?? null;
}

/** Nome esteso della provincia (es. "MI" → "Milano"). */
export function nomeProvincia(codiceProvincia: string): string | null {
  const p = (codiceProvincia ?? '').trim().toUpperCase();
  if (!p) return null;
  return province.find((x) => x.codice === p)?.nome ?? null;
}

/** Chat/canale ufficiale configurato per una regione, o null. */
export function canalePerRegione(regione: string): string | null {
  const nome = (regione ?? '').trim();
  if (!nome) return null;
  return getTelegramCanaliRegionali()[nome] ?? null;
}

/**
 * Canale Telegram per una provincia:
 *   1. override per-provincia TELEGRAM_CHANNELS (retro-compatibile, se presente);
 *   2. altrimenti il canale UFFICIALE della regione di appartenenza.
 */
export function canalePerProvincia(provincia: string): string | null {
  const override = getTelegramChannels();
  const p = (provincia ?? '').trim().toUpperCase();
  if (p && override[p]) return override[p];
  const regione = regionePerProvincia(p);
  return regione ? canalePerRegione(regione) : null;
}

/* ------------------- Formato post canali regionali (colori & hashtag) ------------------- */

type CategoriaPost = 'interpello_docenti' | 'avviso_ata' | 'bando_pnrr_esperto';

/** Testate cromatiche per tipologia di avviso. */
const HEADER_POST: Record<CategoriaPost, string> = {
  interpello_docenti: '🟢 [INTERPELLO DOCENTI]',
  avviso_ata: '🔵 [AVVISO ATA]',
  bando_pnrr_esperto: '🟣 [BANDO / PNRR / ESPERTO]',
};

/** Keyword profili ATA (amministrativi, tecnici, collaboratori scolastici). */
const RE_ATA =
  /\b(personale\s+ata|profilo\s+ata|ata)\b|\bcollaborator\w*\s+scolastic\w*\b|\bassistent\w*\s+amministrativ\w*\b|\bassistent\w*\s+tecn\w*\b|\bdsga\b|\bbidell\w*\b|\bguardarobier\w*\b/i;

/** Keyword bandi/progetti/PNRR/incarichi per esperti e tutor. */
const RE_BANDO =
  /\bbando\b|\bselezion\w*\b|\breclutament\w*\b|\bespert\w*\b|\btutor\b|\bincarico\b|\bprocedura\b|\bmanifestazione\s+di\s+interesse\b|\bpnrr\b|\bpon\b|\bpor\b|\bprogetto\b|\bfinanziament\w*\b|\bfondi\b|\bfse\b|\bfesr\b|\bnext\s+generation\s+eu\b/i;

/** Classi di concorso (A-026, ADEE, …) che identificano ruoli da docente. */
const RE_CLASSE_CONCORSO = /\b(?:[A-Z]{1,2}-\d{2,3}|AD(?:[A-Z]{2,3}|\d{2}))\b/i;

/** Token per hashtag Telegram: rimuove accenti, spazi e punteggiatura. */
function hashtagToken(testo: string): string {
  const token = (testo ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Za-z0-9]+/g, '');
  return token || 'ScuoleRadar';
}

/** Profilo ATA specifico citato nel titolo (fallback "Personale ATA"). */
function profiloAta(titolo: string): string {
  const t = titolo.toLowerCase();
  if (/\bdsga\b/.test(t)) return 'DSGA';
  if (/\bcollaborator\w*\s+scolastic\w*/.test(t)) return 'Collaboratore scolastico';
  if (/\bassistent\w*\s+amministrativ\w*/.test(t)) return 'Assistente amministrativo';
  if (/\bassistent\w*\s+tecn\w*/.test(t)) return 'Assistente tecnico';
  if (/\bguardarobier\w*/.test(t)) return 'Guardarobiere';
  return 'Personale ATA';
}

/** Tipologia per hashtag quando l'avviso è un bando/progetto (PNRR > PON > POR > Esperto > Bando). */
function tipologiaBando(titolo: string): string {
  const t = titolo.toLowerCase();
  if (/\bpnrr\b/.test(t)) return 'PNRR';
  if (/\bpon\b/.test(t)) return 'PON';
  if (/\bpor\b/.test(t)) return 'POR';
  if (/\bespert\w*/.test(t) || /\btutor\b/.test(t)) return 'Esperto';
  return 'Bando';
}

/** Ruolo / categoria mostrato nella riga "👩🏫 Ruolo / Categoria". */
function ruoloPerCategoria(categoria: CategoriaPost, interpello: InterpelloCanale): string {
  const titolo = interpello.title ?? '';
  if (categoria === 'avviso_ata') return profiloAta(titolo);
  if (categoria === 'bando_pnrr_esperto') {
    if (/\bespert\w*/.test(titolo.toLowerCase())) return 'Esperto esterno';
    if (/\btutor\b/.test(titolo.toLowerCase())) return 'Tutor';
    return tipologiaBando(titolo);
  }
  const daTitolo = titolo.match(RE_CLASSE_CONCORSO)?.[0];
  return (interpello.classCodes?.[0]?.trim() || daTitolo || '').toUpperCase() || 'Docente';
}

/** Comune best-effort: campo dedicato oppure coda del titolo dopo separatore o virgola. */
function comuneAvviso(interpello: InterpelloCanale): string | null {
  const esplicito = interpello.comune?.trim();
  if (esplicito) return esplicito;
  const coda = (interpello.title ?? '').split(/\s*[—–,]\s*/).pop()?.trim() ?? '';
  if (coda.length < 2 || coda.length > 40 || /\d/.test(coda)) return null;
  if (!/^[A-ZÀ-Ý]/.test(coda)) return null;
  if (/(istituto|scuola|liceo|i\.?\s*c\.?|ist\.|convitto|cpia|circolo|comprensivo)/i.test(coda)) return null;
  return coda;
}

/**
 * Formatta il post per i canali Telegram regionali (struttura ufficiale):
 *   riga 1 — emoji + tipologia colorata;
 *   corpo  — 📍 Provincia ([PR]) — Comune · 🏫 Scuola · 👩🏫 Ruolo · 📅 Scadenza;
 *   🔗 link ufficiale, ⚡ CTA per il servizio privato e hashtag finali.
 */
export function formattaPostCanaleTelegram(interpello: InterpelloCanale): string {
  const codice = (interpello.province ?? '').trim().toUpperCase() || 'ND';
  const regione = regionePerProvincia(codice);
  const provincia = nomeProvincia(codice);
  const comune = comuneAvviso(interpello);
  const titolo = interpello.title ?? '';

  const categoria: CategoriaPost = RE_ATA.test(titolo)
    ? 'avviso_ata'
    : RE_BANDO.test(titolo)
      ? 'bando_pnrr_esperto'
      : 'interpello_docenti';
  const ruolo = ruoloPerCategoria(categoria, interpello);

  const dettagli: string[] = [
    `📍 Provincia: <b>${escapeHtml(provincia ? `${provincia} (${codice})` : codice)}</b>${
      comune ? ` — <b>${escapeHtml(comune)}</b>` : ''
    }`,
  ];
  if (interpello.schoolName?.trim()) {
    dettagli.push(`🏫 Scuola: <b>${escapeHtml(interpello.schoolName.trim())}</b>`);
  }
  dettagli.push(`👩🏫 Ruolo / Categoria: <b>${escapeHtml(ruolo)}</b>`);
  dettagli.push(
    `📅 Scadenza: <b>${
      interpello.expirationDate ? escapeHtml(formatDataScadenza(interpello.expirationDate)) : 'Immediata'
    }</b>`,
  );

  const tipologiaToken =
    categoria === 'avviso_ata'
      ? hashtagToken('ATA')
      : hashtagToken(categoria === 'bando_pnrr_esperto' ? tipologiaBando(titolo) : 'Interpello');

  const hashtag = [
    regione ? `#${hashtagToken(regione)}` : '',
    provincia ? `#${hashtagToken(provincia)}` : '',
    `#${tipologiaToken}`,
    `#${hashtagToken(ruolo)}`,
    '#ScuoleRadar',
  ]
    .filter(Boolean)
    .join(' ');

  const linkRiga = interpello.link?.trim()
    ? `🔗 <a href="${escapeHtml(interpello.link.trim())}">Leggi l'Avviso Originale</a>`
    : '';

  const cta = '⚡ Ricevi solo gli avvisi per la tua provincia e classe in privato:\n👉 https://scuoleradar.it';

  const parti: string[] = [
    HEADER_POST[categoria],
    `📌 <b>${escapeHtml(titolo)}</b>`,
    dettagli.join('\n'),
  ];
  if (linkRiga) parti.push(linkRiga);
  parti.push(cta, hashtag);
  return parti.join('\n\n');
}

/**
 * Pubblica un interpello NUOVO sul canale Telegram della regione di appartenenza
 * (o su un canale/chat esplicito, es. per i test). Usa la formattazione ufficiale.
 */
export async function pubblicaInterpelloSuCanale(
  interpello: InterpelloCanale,
  chatId?: string,
): Promise<EsitoTelegram> {
  const canale = chatId?.trim() ?? canalePerProvincia(interpello.province);
  if (!canale) return { ok: false, error: 'Nessun canale configurato per la provincia/regione' };
  return inviaMessaggioTelegram(canale, formattaPostCanaleTelegram(interpello));
}

