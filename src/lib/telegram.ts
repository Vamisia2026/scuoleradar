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
} from './resend';
import { province } from '../data/province';
import { ICONA_RIGA, costruisciAvviso, pulisciTitoloAvviso } from './alertInterpello';

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

/** True se l'URL punta a un file PDF (es. avviso pubblicato in PDF sull'Albo). */
function eLinkPdf(url?: string | null): boolean {
  try {
    return new URL(url ?? '').pathname.toLowerCase().endsWith('.pdf');
  } catch {
    return false;
  }
}

/**
 * Restituisce l'URL SOLO se è http(s) assoluto e valido, altrimenti `null`.
 * Evita di inviare a Telegram/email link relativi o malformati (che farebbero
 * fallire l'invio o porterebbero l'utente su una pagina rotta).
 */
export function urlAssolutaValida(url?: string | null): string | null {
  const u = (url ?? '').trim();
  if (!/^https?:\/\//i.test(u)) return null;
  try {
    new URL(u);
    return u;
  } catch {
    return null;
  }
}

/**
 * Barra/CTA blu cliccabile per il PDF ufficiale: da usare al posto del generico
 * link di fonte quando l'avviso è un PDF, così l'utente vede subito un invito
 * chiaro ad aprirlo/scaricarlo (invece della sola icona PDF del link preview).
 */
function barraPdf(url: string): string {
  const href = escapeHtml(url.trim());
  return `📄 <b>PDF Ufficiale</b>\n📥 <a href="${href}">APRI / SCARICA IL PDF</a>`;
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
  /**
   * Blocco CTA finale (facoltativo). Riceve i link GIÀ risolti:
   * `linkPro` (pagina prezzi), `linkOpp` (opportunità) e `dashboardUrl` (piattaforma).
   */
  cta?: (linkPro: string, linkOpp: string, dashboardUrl: string) => string;
}

const TESTO_TELEGRAM: Record<TipoMessaggio, TestoTelegram> = {
  welcome: {
    testa: '🎉 Mese di PRO attivo — benvenuto in ScuoleRadar!',
    paragrafi: [
      'Per i primi 30 giorni hai il piano PRO gratuito.',
      'Hai accesso a Modulistica, Crea CV, Calcolatore CFU e Radar Scuole con notifiche illimitate.',
      'Quando vuoi sapere cosa succede di importante nella scuola, passa dal nostro Notiziario.',
    ],
    cta: (_linkPro, _linkOpp, dashboardUrl) => `👉 <a href="${dashboardUrl}">Vai a ScuoleRadar</a>`,
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
      "Questo è l'ultimo avviso del periodo di prova.",
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
    cta: (_linkPro, _linkOpp, dashboardUrl) => `👉 <a href="${dashboardUrl}">Vai a ScuoleRadar</a>`,
  },
  conferma_attivazione: {
    testa: '🎯 Radar attivato con successo!',
    paragrafi: [
      'Ora puoi rilassarti: il tuo Radar è attivo e sta già lavorando per te.',
      "Non ti invieremo comunicazioni inutili e spam. Quando vedi un nostro messaggio qui su Telegram, aprilo subito: abbiamo intercettato un'opportunità per te!",
    ],
    cta: (_linkPro, _linkOpp, dashboardUrl) => `👉 <a href="${dashboardUrl}">Vai a ScuoleRadar</a>`,
  },
  free_forever_preavviso: {
    testa: '🎁 PRO Free Forever: il rinnovo gratuito è automatico',
    paragrafi: [
      'Il tuo piano PRO Free Forever si sta avvicinando alla scadenza annuale.',
      'Nessun pagamento e nessuna azione richiesta: alla scadenza il rinnovo parte automaticamente a 0€, per sempre.',
      'Non riceverai mai solleciti di pagamento né avvisi di mancato rinnovo.',
    ],
    cta: (_linkPro, _linkOpp, dashboardUrl) => `👉 <a href="${dashboardUrl}">Vai a ScuoleRadar</a>`,
  },
  notifica_pro: {
    testa: '🎯 Nuova opportunità trovata per te!',
    paragrafi: [
      'Abbiamo trovato una <b>nuova opportunità</b> per te.',
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

  // Titolo pulito: niente "dump" di codici classe dalle tabelle delle fonti.
  const titolo = interpello
    ? `📌 <b>${escapeHtml(pulisciTitoloAvviso(interpello.title, `Interpello ${[classe, interpello.province].filter(Boolean).join(' — ')}`))}</b>`
    : '';

  // Dettagli compatti con GERARCHIA STRETTA: obbligatorie (Provincia, Ordine,
  // Classe/Materia, Scadenza) + opzionali (Scuola, Pubblicato) solo se presenti.
  // La Scadenza assente viene OMESSA (nessun blocco "Scadenza: Non indicata").
  let dettagli = '';
  if (interpello && TIPI_CON_OPPORTUNITA.has(tipo)) {
    const avviso = costruisciAvviso({
      provincia: nomeProvincia(interpello.province) ?? interpello.province,
      classCode: classe,
      materia: interpello.materia,
      scadenza: interpello.scadenza,
      schoolName: interpello.schoolName,
    });
    const righe: string[] = [];
    for (const r of avviso.obbligatorie) {
      righe.push(`${ICONA_RIGA[r.etichetta] ?? '•'} ${escapeHtml(r.etichetta)}: <b>${escapeHtml(r.valore)}</b>`);
    }
    for (const r of avviso.opzionali) {
      righe.push(`${ICONA_RIGA[r.etichetta] ?? '•'} ${escapeHtml(r.valore)}`);
    }
    righe.push(`🏷️ ${escapeHtml(categoriaOpportunita(interpello.title))}`);
    dettagli = righe.join('\n');
  }

  const linkFonte = urlAssolutaValida(interpello?.link);
  const linkRiga =
    linkFonte && TIPI_CON_OPPORTUNITA.has(tipo)
      ? eLinkPdf(linkFonte)
        ? barraPdf(linkFonte)
        : `🔗 <a href="${escapeHtml(linkFonte)}">Fonte ufficiale verificata (Albo Pretorio) — apri e candidati</a>`
      : '';

  // Email di candidatura della scuola: mostrata per i tipi con opportunità.
  // Se assente nei dati → dicitura pulita (mai email inventate/ipotizzate).
  const emailContatto = interpello?.contactEmail?.trim() ?? '';
  const emailRiga = TIPI_CON_OPPORTUNITA.has(tipo)
    ? emailContatto
      ? `📧 Candidature: <a href="mailto:${escapeHtml(emailContatto)}">${escapeHtml(emailContatto)}</a>`
      : '📧 Email non disponibile'
    : '';

  const parti: string[] = [copy.testa];
  if (titolo) parti.push(titolo);
  if (dettagli) parti.push(dettagli);
  if (linkRiga) parti.push(linkRiga);
  if (emailRiga) parti.push(emailRiga);
  if (copy.paragrafi.length) parti.push(copy.paragrafi.join('\n'));
  if (copy.cta) parti.push(copy.cta(linkPro, linkOpp, dashboardUrl));
  parti.push('I tuoi colleghi di <b>Scuole Radar</b>');
  parti.push('📌 Quando vuoi sapere cosa succede di importante, vieni qui: https://www.scuoleradar.it/notizie');

  return parti.join('\n\n');
}

/* ------------------------------ Invio messaggi ------------------------------ */

export interface EsitoTelegram {
  ok: boolean;
  error?: string;
}

/** Timeout per singola chiamata alla Bot API (evita blocchi su rete lenta). */
const TELEGRAM_TIMEOUT_MS = 10_000;
/** Tentativi massimi per errori transitori (429 / 5xx / timeout). */
const TELEGRAM_MAX_TENTATIVI = 3;

/** Attesa non bloccante (retry/backoff). */
function attendi(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Invia un messaggio di testo al chat_id indicato tramite le Bot API.
 * `parse_mode: 'HTML'` per la formattazione (bold, link).
 *
 * ROBUSTEZZA: timeout per tentativo + RETRY con backoff sui soli errori
 * transitori (HTTP 429 rispettando `retry_after`, 5xx, errori di rete/timeout).
 * Non lancia MAI eccezioni: restituisce sempre `{ ok, error }`, così l'errore
 * è SEMPRE visibile al chiamante (nessun fallimento silenzioso).
 */
export async function inviaMessaggioTelegram(
  chatId: string,
  testo: string,
): Promise<EsitoTelegram> {
  const token = getTelegramBotToken()?.trim();
  if (!token) return { ok: false, error: 'Token non configurato' };
  const destinatario = chatId.trim();
  if (!destinatario) return { ok: false, error: 'Chat ID mancante' };

  const url = `https://api.telegram.org/bot${token}/sendMessage`;
  let ultimoErrore = 'errore sconosciuto';

  for (let tentativo = 1; tentativo <= TELEGRAM_MAX_TENTATIVI; tentativo += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TELEGRAM_TIMEOUT_MS);
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: destinatario,
          text: testo,
          parse_mode: 'HTML',
          disable_web_page_preview: false,
        }),
        signal: controller.signal,
      });
      clearTimeout(timer);

      const data = (await res.json().catch(() => null)) as {
        ok?: boolean;
        description?: string;
        parameters?: { retry_after?: number };
      } | null;

      if (res.ok && data?.ok) return { ok: true };

      ultimoErrore = data?.description ?? `HTTP ${res.status}`;
      const transitorio = res.status === 429 || res.status >= 500;
      if (!transitorio || tentativo === TELEGRAM_MAX_TENTATIVI) break;

      const retryAfter = Number(data?.parameters?.retry_after ?? 0);
      const attesaMs = retryAfter > 0 ? retryAfter * 1000 : tentativo * 1000;
      console.warn(
        `  ⏳ Telegram ${res.status} su ${destinatario}: nuovo tentativo tra ${Math.round(
          attesaMs / 1000,
        )}s (${tentativo + 1}/${TELEGRAM_MAX_TENTATIVI}).`,
      );
      await attendi(attesaMs);
    } catch (err) {
      clearTimeout(timer);
      const e = err as Error;
      ultimoErrore = e.name === 'AbortError' ? 'timeout' : e.message;
      if (tentativo === TELEGRAM_MAX_TENTATIVI) break;
      await attendi(tentativo * 1000);
    }
  }
  return { ok: false, error: ultimoErrore };
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
  /** Materia/settore inferito quando manca la classe di concorso (es. "Matematica"). */
  materia?: string | null;
  /** Email di candidatura per l'invio delle domande, se disponibile nella fonte. */
  contactEmail?: string | null;
  expirationDate?: string | null;
  link?: string | null;
}

/** Chiave del canale nazionale ATA dentro CANALI_TELEGRAM_REGIONALI. */
export const CHIAVE_CANALE_ATA_NAZIONALE = 'ATA Italia (National)';

/**
 * Canali Telegram UFFICIALI ATTIVI (10): i 9 canali regionali + ATA Nazionale.
 * Il bot @ScuoleRadar_bot deve essere AMMINISTRATORE del canale
 * (oppure è possibile usare il chat_id numerico -100… del canale).
 *
 * Le regioni NON ancora attive non hanno un canale regionale: per gli avvisi
 * di quelle regioni l'unico canale è ATA Italia. Il canale @scuoleradar_ata
 * riceve OGNI 🔵 [AVVISO ATA] d'Italia (in aggiunta al canale regionale).
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
  [CHIAVE_CANALE_ATA_NAZIONALE]: '@scuoleradar_ata',
};

/**
 * Canali Telegram effettivi: i 10 canali ATTIVI (9 regionali + ATA nazionale),
 * con eventuale override via env TELEGRAM_CHANNELS_REGIONALI (JSON
 * "Regione"/"ATA Italia (National)" → "@canale", utile per test o canali
 * temporanei).
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

/** Canale nazionale ATA (@scuoleradar_ata): riceve ogni 🔵 [AVVISO ATA] d'Italia. */
export function canaleAtaNazionale(): string | null {
  // Passa da canalePerRegione per beneficiare del confronto normalizzato.
  return canalePerRegione(CHIAVE_CANALE_ATA_NAZIONALE);
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

/**
 * Normalizza un nome di regione/chiave canale per confronti tolleranti:
 * minuscole, senza accenti né separatori (es. "Emilia Romagna" ≡
 * "Emilia-Romagna", "Valle D'Aosta" ≡ "Valle d'Aosta").
 */
function chiaveCanale(testo: string): string {
  return (testo ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '')
    .toLowerCase();
}

/**
 * Chat/canale ufficiale configurato per una regione, o null.
 * L'uguaglianza esatta ha la precedenza; in subordine si accetta una
 * corrispondenza normalizzata, così nessuna regione può "cadere" in modo
 * silenzioso su un canale sbagliato (o su nessun canale) per una differenza
 * di maiuscole, accenti o separatori nel nome.
 */
export function canalePerRegione(regione: string): string | null {
  const nome = (regione ?? '').trim();
  if (!nome) return null;
  const canali = getTelegramCanaliRegionali();
  if (canali[nome]) return canali[nome];
  const chiave = chiaveCanale(nome);
  for (const [regioneConfigurata, canale] of Object.entries(canali)) {
    if (chiaveCanale(regioneConfigurata) === chiave) return canale;
  }
  return null;
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

export type CategoriaPost = 'interpello_docenti' | 'avviso_ata' | 'bando_pnrr_esperto';

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

/**
 * Codici dei profili ATA definiti nel catalogo (`src/data/classiConcorso.ts`,
 * ordine 'ata': 'ATA-CS', 'ATA-AT', 'ATA-AA') più le abbreviazioni sintetiche
 * 'AA' / 'AT' / 'CS' e il ruolo 'DSGA'. Serve a riconoscere come 🔵 [AVVISO ATA]
 * anche i bandi in cui il profilo ATA è indicato solo nel codice classe.
 */
const RE_CLASSE_ATA = /^(?:ATA(?:[-_][A-Z]{2})?|AA|AT|CS|DSGA)$/i;

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
  const codice = (interpello.classCodes?.[0]?.trim() || daTitolo || '').toUpperCase();
  if (codice) return codice;
  // Nessuna classe di concorso esplicita: mostra la MATERIA/settore inferita
  // dal titolo/contesto (evita la sola etichetta generica "Docente").
  return interpello.materia?.trim() || 'Docente';
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
 * Classifica l'avviso in una delle tre categorie del post canale.
 * 🔵 ATA ha la priorità: un titolo "Personale ATA" / "Assistente amministrativo"
 * NON deve mai essere etichettato come interpello docenti o bando PNRR. Il
 * profilo ATA viene riconosciuto sia dal titolo sia dal codice classe
 * (`ATA-AA` / `ATA-AT` / `ATA-CS`, abbreviazioni `AA`/`AT`/`CS`, `DSGA`).
 */
export function classificaCategoriaPost(interpello: InterpelloCanale): CategoriaPost {
  const titolo = (interpello.title ?? '').trim();
  if (RE_ATA.test(titolo)) return 'avviso_ata';
  const classiAta = (interpello.classCodes ?? []).some((codice) =>
    RE_CLASSE_ATA.test((codice ?? '').trim()),
  );
  if (classiAta) return 'avviso_ata';
  if (RE_BANDO.test(titolo)) return 'bando_pnrr_esperto';
  return 'interpello_docenti';
}

/**
 * Formatta il post canale Telegram (STRUTTURA UFFICIALE — 5 sezioni fisse):
 *   1. HEADER   → emoji + tipologia: 🟢 [INTERPELLO DOCENTI] / 🔵 [AVVISO ATA]
 *                / 🟣 [BANDO / PNRR / ESPERTO];
 *   2. DETTAGLI → 📍 Provincia ([PR]) — Comune · 🏫 Scuola · 👩🏫 Ruolo · 📅 Scadenza;
 *   3. LINK     → 🔗 Leggi l'Avviso Originale (link ufficiale della fonte);
 *   4. CTA      → ⚡ Ricevi solo gli avvisi per la tua provincia e classe: 👉 scuoleradar.it;
 *   5. HASHTAG  → #Regione #Provincia #Tipologia #Ruolo #ScuoleRadar.
 * Nessuna riga extra (nessun 📌 titolo): i blocchi pubblicati sono sempre 5.
 */
export function formattaPostCanaleTelegram(interpello: InterpelloCanale): string {
  const codice = (interpello.province ?? '').trim().toUpperCase() || 'ND';
  const regione = regionePerProvincia(codice);
  const provincia = nomeProvincia(codice);
  const comune = comuneAvviso(interpello);
  const titolo = interpello.title ?? '';

  const categoria = classificaCategoriaPost(interpello);
  const ruolo = ruoloPerCategoria(categoria, interpello);

  // Codice classe (per etichetta leggibile + ordine di scuola) e avviso strutturato.
  const codiceClasse = (
    interpello.classCodes?.[0]?.trim() ||
    titolo.match(RE_CLASSE_CONCORSO)?.[0] ||
    ''
  ).toUpperCase();
  const avviso = costruisciAvviso({
    provincia: provincia ? `${provincia} (${codice})` : codice,
    classCode: codiceClasse,
    materia: interpello.materia,
    scadenza: interpello.expirationDate,
    schoolName: interpello.schoolName?.trim() || null,
  });
  const ordineScuola = avviso.obbligatorie.find((r) => r.etichetta === 'Ordine di scuola')?.valore ?? '';
  const materiaAvviso = avviso.obbligatorie.find((r) => r.etichetta === 'Classe / Materia')?.valore ?? '';

  const dettagli: string[] = [
    `📍 Provincia: <b>${escapeHtml(provincia ? `${provincia} (${codice})` : codice)}</b>${
      comune ? ` — <b>${escapeHtml(comune)}</b>` : ''
    }`,
  ];
  // Scuola: OPZIONALE — mostrata solo se estratta (nessun placeholder).
  if (interpello.schoolName?.trim()) {
    dettagli.push(`🏫 Scuola: <b>${escapeHtml(interpello.schoolName.trim())}</b>`);
  }
  // Ordine di scuola: OBBLIGATORIO (dedotto dalla classe).
  if (ordineScuola) dettagli.push(`🎓 Ordine di scuola: <b>${escapeHtml(ordineScuola)}</b>`);
  dettagli.push(`👩🏫 Ruolo / Categoria: <b>${escapeHtml(ruolo)}</b>`);
  // Classe/Materia: OBBLIGATORIO — etichetta leggibile (codice + nome ufficiale).
  if (materiaAvviso) dettagli.push(`📚 Classe/Materia: <b>${escapeHtml(materiaAvviso)}</b>`);
  // Scadenza: OBBLIGATORIA — omessa garbatamente se la fonte non la dichiara.
  if (avviso.scadenzaValida) {
    dettagli.push(`📅 Scadenza: <b>${escapeHtml(formatDataScadenza(interpello.expirationDate ?? null))}</b>`);
  }

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

  // Link alla fonte: SOLO se è un http(s) assoluto valido (mai link relativi/
  // malformati). Se è un PDF, barra blu dedicata "APRI / SCARICA IL PDF".
  const linkFonte = urlAssolutaValida(interpello.link);
  const linkRiga = linkFonte
    ? eLinkPdf(linkFonte)
      ? barraPdf(linkFonte)
      : `🔗 <a href="${escapeHtml(linkFonte)}">Leggi l'Avviso Originale</a>`
    : '';

  // Email di candidatura. Se assente nei dati → "Email non disponibile"
  // (ultima ratio: mai email inventate/ipotizzate).
  const email = interpello.contactEmail?.trim() ?? '';
  const emailRiga = email
    ? `📧 Candidature: <a href="mailto:${escapeHtml(email)}">${escapeHtml(email)}</a>`
    : '📧 Email non disponibile';

  const cta = '⚡ Ricevi solo gli avvisi per la tua provincia e classe in privato:\n👉 https://scuoleradar.it';

  // Blocco CONTATTO = link ufficiale (se valido) + email raggruppati in UNA sola
  // sezione: la struttura pubblicata resta FISSA a 5 blocchi
  // (header · dettagli · contatto · CTA · hashtag).
  const bloccoContatto = [linkRiga, emailRiga].filter(Boolean).join('\n');
  const parti: string[] = [HEADER_POST[categoria], dettagli.join('\n'), bloccoContatto, cta, hashtag];
  return parti.join('\n\n');
}

/**
 * Destinazioni di pubblicazione per un avviso (ordine di invio):
 *   1. il canale REGIONALE attivo della provincia (se la regione è tra le 10
 *      attive — altrimenti nessun canale regionale);
 *   2. il canale ATA nazionale per OGNI 🔵 [AVVISO ATA], in qualunque regione
 *      d'Italia (in AGGIUNTA al canale regionale).
 */
export function destinazioniPubblicazione(interpello: InterpelloCanale): string[] {
  const destinazioni = new Set<string>();
  const regionale = canalePerProvincia(interpello.province);
  if (regionale) destinazioni.add(regionale);
  if (classificaCategoriaPost(interpello) === 'avviso_ata') {
    const ata = canaleAtaNazionale();
    if (ata) destinazioni.add(ata);
  }
  return [...destinazioni];
}

/** Esito della pubblicazione multi-canale di un avviso. */
export interface EsitoPubblicazioneCanali {
  /** Canali a cui l'avviso doveva andare (vuoto = nessun canale attivo). */
  destinazioni: string[];
  /** Numero di invii andati a buon fine. */
  pubblicati: number;
  /** Errori per singolo canale. */
  errori: { canale: string; errore: string }[];
}

/**
 * Pubblica un avviso NUOVO su TUTTE le destinazioni corrette:
 *   - regionale: solo se la regione della provincia è tra i canali attivi;
 *   - ATA nazionale: SEMPRE in aggiunta se l'avviso è 🔵 [AVVISO ATA].
 */
export async function pubblicaInterpelloSuCanali(
  interpello: InterpelloCanale,
): Promise<EsitoPubblicazioneCanali> {
  const destinazioni = destinazioniPubblicazione(interpello);
  const testo = formattaPostCanaleTelegram(interpello);
  const errori: { canale: string; errore: string }[] = [];
  let pubblicati = 0;
  for (const canale of destinazioni) {
    const esito = await inviaMessaggioTelegram(canale, testo);
    if (esito.ok) {
      pubblicati += 1;
    } else {
      errori.push({ canale, errore: esito.error ?? 'errore sconosciuto' });
    }
  }
  return { destinazioni, pubblicati, errori };
}