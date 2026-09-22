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
  classeRilevante,
  linkOpportunita,
  TIPI_CON_OPPORTUNITA,
  type DettagliNotifica,
  type TipoMessaggio,
} from './resend';
import { province } from '../data/province';
import {
  BRAND_RIGA_TELEGRAM,
  CTA_NOTIZIE_TELEGRAM,
  EMAIL_ETICHETTA,
  EMAIL_ICONA,
  ETICHETTA_AVVISO_UFFICIALE as ETICHETTA_AVVISO_UFFICIALE_SHARED,
  ICONA_RIGA,
  costruisciAvviso,
  eUrlAvvisoDiretto,
  emailAvviso,
  pulisciTitoloAvviso,
  scegliClasseRilevante,
  suggerimentoRicercaAvviso,
} from './alertInterpello';
import { gateTelegram } from '../config/gateNotifiche';

/** Interfaccia per l'ambiente (evita la dipendenza da @types/node nel frontend). */
declare const process: { env: Record<string, string | undefined> };

const DASHBOARD_URL =
  process.env.RESEND_DASHBOARD_URL ?? 'https://scuoleradar.it/dashboard/radar';

/**
 * URL della pagina di SETUP DEL RADAR (onboarding): è la destinazione di ogni
 * CTA di conversione (canali regionali, benvenuto del bot, notifiche). Portare
 * l'utente QUI — e non alla home generica — significa che appena arriva sceglie
 * province e classi di concorso e il Radar inizia subito a lavorare per lui.
 */
export const RADAR_SETUP_PATH = 'dashboard/radar';

/** Risolve l'URL assoluto del setup Radar (accetta override d'ambiente). */
export function radarSetupUrl(dashboardUrl: string = DASHBOARD_URL): string {
  try {
    return new URL(RADAR_SETUP_PATH, baseUrl(dashboardUrl)).toString();
  } catch {
    return 'https://scuoleradar.it/dashboard/radar';
  }
}

/** URL canonico del setup Radar (destinazione unica delle CTA). */
export const RADAR_SETUP_URL = radarSetupUrl();

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
 * URL PULITO per Telegram: niente spazi, punteggiatura di troppo o caratteri
 * che spezzano l'auto-link. Un URL pulito viene riconosciuto come link NATIVO
 * (entità "url"), quindi Telegram NON chiede conferma con il popup
 * "Vuoi aprire questo link?" come accade per i link nascosti dietro un'etichetta.
 */
export function pulisciUrlTelegram(url?: string | null): string {
  return (url ?? '')
    .trim()
    .replace(/^<|>$/g, '')
    .replace(/\s+/g, '')
    .replace(/[.,;:'")\]]+$/g, '');
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
   * `linkPro` (pagina prezzi), `linkOpp` (opportunità), `dashboardUrl` (piattaforma)
   * ed `etichettaOpp` (etichetta ONESTA del link di fonte: mai "Candidati").
   */
  cta?: (linkPro: string, linkOpp: string, dashboardUrl: string, etichettaOpp: string) => string;
}

/**
 * Apertura UNIFORME degli alert di opportunità: il copy di brand COMPLETO
 * ("Abbiamo trovato una nuova opportunità per te"), mai la versione abbreviata
 * "Nuova opportunità: …". Le voci `prova1`/`prova2`/`prova3`/`notifica_pro`
 * condividono la stessa apertura.
 */
const TESTO_OPPORTUNITA = 'Abbiamo trovato una nuova opportunità per te';
const TESTA_OPPORTUNITA = `🎯 <b>${TESTO_OPPORTUNITA}</b>`;

/**
 * Testata CONTESTUALE dell'alert: copy di brand completo + classe di concorso e
 * provincia del match (esattamente le preferenze scelte nel Radar). Se il
 * contesto manca resta il copy completo, mai una riga abbreviata.
 */
export function aperturaOpportunita(
  classe?: string | null,
  provincia?: string | null,
): string {
  const contesto = [classe, provincia].filter(Boolean).join(' · ');
  return contesto ? `${TESTA_OPPORTUNITA}: ${escapeHtml(contesto)}` : TESTA_OPPORTUNITA;
}

const TESTO_TELEGRAM: Record<TipoMessaggio, TestoTelegram> = {
  // Voce di DIGEST: serve alla completezza della mappa, ma l'invio reale del
  // riepilogo usa il renderer dedicato `formattaDigestTelegram` (una voce per
  // opportunità in UN solo messaggio).
  digest_giornaliero: {
    testa: 'Riepilogo giornaliero',
    paragrafi: [],
    cta: (_linkPro, _linkOpp, dashboardUrl) => `👉 ${pulisciUrlTelegram(dashboardUrl)}`,
  },
  // BENVENUTO (post-registrazione): mese di PRO in omaggio GIÀ attivo, vantaggi
  // elencati come in email. Nessun riferimento al vecchio piano Base.
  welcome: {
    testa: '🎉 Mese di PRO attivo — benvenuto in ScuoleRadar!',
    paragrafi: [
      'Il tuo <b>mese di PRO in omaggio</b> è già attivo: da questo momento hai tutto disponibile, senza restrizioni.',
      'Radar Scuole con notifiche illimitate, Modulistica scolastica, Crea CV e Calcolatore CFU.',
      'Indica provincia e classi di concorso: da lì cerchiamo noi le opportunità per te, ogni giorno.',
    ],
    cta: (_linkPro, _linkOpp, dashboardUrl) => `👉 ${pulisciUrlTelegram(dashboardUrl)}`,
  },
  prova1: {
    testa: TESTA_OPPORTUNITA,
    paragrafi: [],
    cta: (_linkPro, linkOpp, _dashboardUrl, etichettaOpp) =>
      `👉 <b>${escapeHtml(etichettaOpp)}</b>`,
  },
  prova2: {
    testa: TESTA_OPPORTUNITA,
    paragrafi: [],
    cta: (_linkPro, linkOpp, _dashboardUrl, etichettaOpp) =>
      `👉 <b>${escapeHtml(etichettaOpp)}</b>`,
  },
  prova3: {
    testa: TESTA_OPPORTUNITA,
    paragrafi: [],
    cta: (_linkPro, linkOpp, _dashboardUrl, etichettaOpp) =>
      `👉 <b>${escapeHtml(etichettaOpp)}</b>`,
  },
  extra: {
    testa: '🛎️ Notifiche del piano gratuito in pausa',
    paragrafi: [
      'Con il piano gratuito ricevi un numero limitato di segnalazioni.',
      'Con <b>PRO</b> ricevi ogni opportunità in tempo reale, senza limiti.',
    ],
    cta: (linkPro) => `👉 ${pulisciUrlTelegram(linkPro)}`,
  },
  recap: {
    testa: '🔔 Ultimo avviso automatico del piano gratuito',
    paragrafi: [
      'Da adesso non riceverai più notifiche automatiche.',
      'I tuoi dati e la Modulistica restano attivi: riattiva gli avvisi quando vuoi con <b>PRO</b>.',
    ],
    cta: (linkPro) => `👉 ${pulisciUrlTelegram(linkPro)}`,
  },
  welcome_pro: {
    testa: '🎉 Benvenuto in ScuoleRadar PRO!',
    paragrafi: [
      'Da oggi continuiamo a cercare per te le opportunità più interessanti in base al tuo profilo: interpelli, supplenze, incarichi, PNRR, PON, POR e altro ancora.',
      'Tu non devi passare ore a cercarle: quando troviamo qualcosa che corrisponde al tuo profilo, te lo segnaliamo.',
      'E hai accesso a tutti i servizi PRO di ScuoleRadar: CV, calcolo CFU, modulistica, Pure Focus e gli altri strumenti che stiamo sviluppando per chi lavora nella scuola.',
    ],
    cta: (_linkPro, _linkOpp, dashboardUrl) => `👉 ${pulisciUrlTelegram(dashboardUrl)}`,
  },
  conferma_attivazione: {
    testa: '🎯 Radar attivato con successo!',
    paragrafi: [
      'Ora puoi rilassarti: il tuo Radar è attivo e sta già lavorando per te.',
      'Non ti invieremo comunicazioni inutili e spam: quando arriva un messaggio qui su Telegram, aprilo subito — significa che c\'è un\'opportunità compatibile con il tuo profilo.',
    ],
    cta: (_linkPro, _linkOpp, dashboardUrl) => `👉 ${pulisciUrlTelegram(dashboardUrl)}`,
  },
  free_forever_preavviso: {
    testa: '🎁 PRO Free Forever: il rinnovo gratuito è automatico',
    paragrafi: [
      'Il tuo piano PRO Free Forever si sta avvicinando alla scadenza annuale.',
      'Nessun pagamento e nessuna azione richiesta: alla scadenza il rinnovo parte automaticamente a 0€, per sempre.',
      'Non riceverai mai solleciti di pagamento né avvisi di mancato rinnovo.',
    ],
    cta: (_linkPro, _linkOpp, dashboardUrl) => `👉 ${pulisciUrlTelegram(dashboardUrl)}`,
  },
  notifica_pro: {
    testa: TESTA_OPPORTUNITA,
    paragrafi: [],
    cta: (_linkPro, linkOpp, _dashboardUrl, etichettaOpp) =>
      `👉 <b>${escapeHtml(etichettaOpp)}</b>`,
  },
};

/* ------------------------- Formattazione messaggio ------------------------- */

/**
 * Formatta il messaggio per una delle 8 tipologie (parse_mode HTML).
 * `interpello` può essere null per i messaggi transazionali (welcome, recap, welcome_pro).
 *
 * `opts.mostraCtaRadar` forza (true/false) la CTA di ricalibrazione del Radar:
 * quando è omesso la decisione è automatica (~20% delle comunicazioni, stabile
 * sull'identità dell'avviso — vedi `deveMostrareCtaRadar`).
 */
export function formattaMessaggioTelegram(
  interpello: DettagliNotifica | null,
  classe: string,
  dashboardUrl: string = DASHBOARD_URL,
  tipo: TipoMessaggio = 'welcome',
  opts: { mostraCtaRadar?: boolean } = {},
): string {
  const copy = TESTO_TELEGRAM[tipo];
  const linkPro = proUrl(dashboardUrl);
  const linkOpp = linkOpportunita(interpello);

  // Titolo pulito: niente "dump" di codici classe dalle tabelle delle fonti.
  const titolo = interpello
    ? `📌 <b>${escapeHtml(pulisciTitoloAvviso(interpello.title, `Interpello ${[classe, interpello.province].filter(Boolean).join(' — ')}`))}</b>`
    : '';

  // Alert di opportunità (copy "nuova opportunità"): layout dedicato, testo puro.
  const conOpportunita = Boolean(interpello) && TIPI_CON_OPPORTUNITA.has(tipo);

  // Dettagli compatti con GERARCHIA STRETTA: obbligatorie (Provincia, Ordine,
  // Classe/Materia, Scadenza) + opzionali (Scuola, Pubblicato) solo se presenti.
  // La Scadenza assente viene OMESSA (nessun blocco "Scadenza: Non indicata").
  let dettagli = '';
  // Recapito di candidatura: letto dall'avviso STRUTTURATO (stessa fonte di
  // verità delle email) così etichetta/posizione restano identiche ovunque.
  let emailStrutturata: string | null = null;
  if (conOpportunita && interpello) {
    const avviso = costruisciAvviso({
      provincia: nomeProvincia(interpello.province) ?? interpello.province,
      classCode: classe,
      materia: interpello.materia,
      scadenza: interpello.scadenza,
      schoolName: interpello.schoolName,
      // Email di candidatura: asset del piano PRO, presente anche quando il link
      // è solo una pagina di riepilogo/"Stampa" senza descrizione estesa.
      email: interpello.contactEmail,
      // Il titolo serve solo a rendere il LIVELLO coerente con la classe e a
      // dedurlo quando la classe manca (nessuna contraddizione nei campi).
      titolo: interpello.title,
    });
    emailStrutturata = avviso.email;
    const righe: string[] = [];
    for (const r of avviso.obbligatorie) {
      righe.push(`${ICONA_RIGA[r.etichetta] ?? '•'} ${escapeHtml(r.etichetta)}: <b>${escapeHtml(r.valore)}</b>`);
    }
    for (const r of avviso.opzionali) {
      righe.push(`${ICONA_RIGA[r.etichetta] ?? '•'} ${escapeHtml(r.valore)}`);
    }
    // NB: nessuna riga "🏷️ <categoria>" — era un metadato vuoto e ripetitivo
    // (spesso conteneva solo la parola "Opportunità").
    dettagli = righe.join('\n');
  }

  // UNA SOLA CTA cliccabile per l'opportunità: il link di fonte è il bottone in
  // fondo, con etichetta canonica `🔗 Fonte Ufficiale` (URL solo nell'href).
  // La vecchia riga duplicata "Fonte ufficiale verificata … apri e candidati" è
  // stata rimossa: puntava allo stesso URL del bottone.
  const etichettaOpp = ETICHETTA_FONTE_UFFICIALE;

  // Email di candidatura della scuola: mostrata SOLO se estratta con certezza.
  // Se manca si OMETTE la riga (mai "Email non disponibile": nessuno stato
  // negativo nel messaggio).
  const emailContatto = emailStrutturata ?? emailAvviso(interpello?.contactEmail) ?? '';
  const emailRiga =
    conOpportunita && emailContatto
      ? `${EMAIL_ICONA} ${EMAIL_ETICHETTA}: <a href="mailto:${escapeHtml(emailContatto)}">${escapeHtml(emailContatto)}</a>`
      : '';

  // LAYOUT degli ALERT (testo pulito, niente immagini e niente marchio ripetuto):
  //   brand · apertura · titolo · dettagli · 📧 candidature · 👉 avviso ufficiale · CTA radar
  // I messaggi di CICLO DI VITA mantengono il loro copy + la CTA Notizie.
  // TESTATA BRAND: UNA sola riga compatta (icona + nome ufficiale) in cima a
  // OGNI messaggio: nessun logo grande, nessuna anteprima a occupare lo schermo.
  const parti: string[] = [BRAND_RIGA_TELEGRAM];
  // Apertura CONTESTUALE per gli alert (classe · provincia): la vecchia frase
  // generica non diceva nulla di utile.
  parti.push(
    conOpportunita
      ? aperturaOpportunita(
          classe,
          nomeProvincia(interpello?.province ?? '') ?? interpello?.province ?? '',
        )
      : copy.testa,
  );
  if (titolo) parti.push(titolo);
  if (dettagli) parti.push(dettagli);
  if (emailRiga) parti.push(emailRiga);

  if (conOpportunita) {
    // LINK alla pubblicazione ufficiale: etichetta canonica `🔗 Fonte Ufficiale`
    // (l'anteprima del link è disattivata a monte: nessun riquadro con loghi o
    // immagini). La riga compare SOLO con un avviso diretto (`eUrlAvvisoDiretto`
    // dentro `rigaFonteUfficiale`): con una home, un elenco o una pagina di
    // ricerca il messaggio resta senza riga di fonte — mai un fallback generico.
    const rigaLink = rigaAvvisoUfficiale(linkOpp);
    if (rigaLink) parti.push(rigaLink);
    // CTA UNICA: ricalibrare il Radar. Sostituisce il vecchio footer promozionale
    // e la guida operativa ("Questo avviso non indica la pagina ufficiale…"),
    // rimossa perché confondeva più di quanto aiutasse.
    // FREQUENZA RIDOTTA: compare solo nel ~20% delle comunicazioni personalizzate
    // (scelta stabile sull'identità dell'avviso) — vedi `deveMostrareCtaRadar`.
    const mostraCtaRadar =
      opts.mostraCtaRadar ??
      deveMostrareCtaRadar(interpello?.id ?? interpello?.link ?? null);
    if (mostraCtaRadar) parti.push(ctaRadarInteressi(dashboardUrl));
    // CTA informativa Notizie (formato a due righe, identico a email e digest).
    parti.push(CTA_NOTIZIE_TELEGRAM);
  } else {
    if (copy.paragrafi.length) parti.push(copy.paragrafi.join('\n'));
    if (copy.cta) parti.push(copy.cta(linkPro, linkOpp, dashboardUrl, etichettaOpp));
    parti.push(CTA_NOTIZIE_TELEGRAM);
  }

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

/* ------------------------- Copy e costanti condivise ------------------------- */

/**
 * CTA finale degli ALERT personali: invita a ricalibrare il Radar quando i
 * risultati non corrispondono più agli interessi dell'utente. Sostituisce il
 * vecchio footer promozionale (rumore) mantenendo UNA sola chiamata all'azione.
 */
export const CTA_RADAR_INTERESSI =
  '👉 Se questi risultati non corrispondono più ai tuoi interessi, modifica il tuo radar su';

/**
 * FREQUENZA della CTA di ricalibrazione del Radar nelle comunicazioni
 * personalizzate: 20%. La riga è utile ma non deve ripetersi in OGNI messaggio
 * (diventa rumore e fa sembrare l'alert automatico un banner). Viene mostrata
 * solo nel ~20% degli alert, scelto in modo STABILE sull'identità dell'avviso:
 * lo stesso avviso non alterna il footer tra un tentativo e il successivo.
 */
export const FREQUENZA_CTA_RADAR = 0.2;

/**
 * Hash FNV-1a a 32 bit → frazione [0, 1). Deterministico: stesso seme ⇒ stessa
 * decisione (nessun footer "ballerino" in caso di retry dello stesso invio).
 */
function frazioneDaSeme(seme: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < seme.length; i += 1) {
    h ^= seme.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return (h >>> 0) / 0x1_0000_0000;
}

/**
 * True quando la CTA di ricalibrazione del Radar deve comparire nel messaggio.
 * Con un seme (id/URL dell'avviso) la decisione è DETERMINISTICA e copre ~20%
 * delle comunicazioni; senza seme si usa il caso (es. messaggi di ciclo di vita).
 */
export function deveMostrareCtaRadar(seme?: string | null): boolean {
  const s = (seme ?? '').trim();
  if (!s) return Math.random() < FREQUENZA_CTA_RADAR;
  return frazioneDaSeme(s) < FREQUENZA_CTA_RADAR;
}

/**
 * Etichetta CONDIVISA storica del link alla fonte (definita in `alertInterpello.ts`
 * e usata dalle EMAIL): resta esportata per parità con gli altri canali, ma nei
 * messaggi Telegram la riga della fonte usa l'etichetta canonica
 * `ETICHETTA_FONTE_UFFICIALE` (sotto).
 */
export const ETICHETTA_AVVISO_UFFICIALE = ETICHETTA_AVVISO_UFFICIALE_SHARED;

/**
 * ETICHETTA UNICA della riga con la FONTE UFFICIALE in OGNI messaggio Telegram
 * (alert personali, digest, post dei canali pubblici).
 *
 * Regole di prodotto applicate QUI (non nei chiamanti):
 *   · testo iperlinkato pulito `🔗 Fonte Ufficiale`: l'URL ufficiale non compare
 *     MAI in chiaro nel messaggio, sta solo nell'`href`;
 *   · la destinazione deve essere un avviso SPECIFICO e DIRETTO (gate
 *     `eUrlAvvisoDiretto`): mai home dell'ente, elenchi/archivi/tag, landing
 *     regionali o pagine di ricerca (`?s=INTERPELLO`). Un link non diretto
 *     produce una riga VUOTA: nessun fallback a una pagina di ricerca.
 */
export const ETICHETTA_FONTE_UFFICIALE = '🔗 Fonte Ufficiale';

/**
 * Riga della fonte ufficiale: `<a href="URL"><b>🔗 Fonte Ufficiale</b></a>`.
 * Ritorna stringa vuota quando il link non è un avviso diretto (o è assente):
 * il messaggio resta senza riga di fonte, mai con un link generico.
 *
 * L'anteprima nativa è disattivata in `inviaMessaggioTelegram`
 * (`link_preview_options.is_disabled`): nessun riquadro con loghi/immagini.
 */
export function rigaFonteUfficiale(link?: string | null): string {
  if (!eUrlAvvisoDiretto(link)) return '';
  const url = urlAssolutaValida(link);
  if (!url) return '';
  return `<a href="${escapeHtml(pulisciUrlTelegram(url))}"><b>${escapeHtml(
    ETICHETTA_FONTE_UFFICIALE,
  )}</b></a>`;
}

/**
 * CTA Notizie (due righe esatte): unica in tutti i canali.
 * Vedi `CTA_NOTIZIE_TELEGRAM` in `alertInterpello.ts`.
 */
export const FOOTER_NOTIZIE = CTA_NOTIZIE_TELEGRAM;

/**
 * Riga dell'avviso ufficiale negli ALERT personali e nel DIGEST: delega alla riga
 * canonica (`rigaFonteUfficiale`) così l'etichetta e il gate sui link diretti
 * restano UNICI in tutto il modulo Telegram.
 */
export function rigaAvvisoUfficiale(link?: string | null): string {
  return rigaFonteUfficiale(link);
}

/** Riga finale dell'alert con il link al setup del Radar dell'utente. */
export function ctaRadarInteressi(dashboardUrl: string = DASHBOARD_URL): string {
  return `${CTA_RADAR_INTERESSI} ${pulisciUrlTelegram(radarSetupUrl(dashboardUrl))}`;
}

/** Attesa non bloccante (retry/backoff). */
function attendi(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Chiamata ROBUSTA alla Bot API: timeout per tentativo + RETRY con backoff sui
 * soli errori transitori (HTTP 429 rispettando `retry_after`, 5xx, rete/timeout).
 * Un'unica implementazione della resilienza, condivisa da testo e foto.
 * Non lancia MAI eccezioni: restituisce sempre `{ ok, error }`.
 */
async function chiamaBotApi(metodo: string, payload: Record<string, unknown>): Promise<EsitoTelegram> {
  const token = getTelegramBotToken()?.trim();
  if (!token) return { ok: false, error: 'Token non configurato' };
  const destinatario = String(payload.chat_id ?? '').trim();
  if (!destinatario) return { ok: false, error: 'Chat ID mancante' };

  const url = `https://api.telegram.org/bot${token}/${metodo}`;
  let ultimoErrore = 'errore sconosciuto';

  for (let tentativo = 1; tentativo <= TELEGRAM_MAX_TENTATIVI; tentativo += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TELEGRAM_TIMEOUT_MS);
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
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

/**
 * PAYLOAD UNICO di `sendMessage` con le ANTEPRIME DISATTIVATE.
 *
 * Tutti gli invii di testo Telegram passano da qui, quindi nessun chiamante può
 * reintrodurre i riquadri di anteprima (che caricavano loghi istituzionali o
 * immagini casuali delle pagine di fonte, coprendo il messaggio):
 *   · `link_preview_options.is_disabled` → opzione corrente della Bot API;
 *   · `disable_web_page_preview: true`   → fallback per client/bot più vecchi.
 *
 * Esportato per essere verificabile dai test: la regressione sulle anteprime è
 * un semplice assert su questo payload.
 */
export function payloadMessaggioTesto(chatId: string, testo: string): Record<string, unknown> {
  return {
    chat_id: chatId,
    text: testo,
    parse_mode: 'HTML',
    link_preview_options: { is_disabled: true },
    disable_web_page_preview: true,
  };
}

/**
 * Invia un messaggio di TESTO al chat_id indicato (`parse_mode: 'HTML'` per la
 * formattazione: bold, link).
 *
 * ANTEPRIME DISATTIVATE: vedi `payloadMessaggioTesto` — punto unico del payload.
 *
 * GATE FEATURE FLAGS (punto unico di ogni invio Telegram): con dipartimento
 * Radar in `test` il messaggio parte solo verso l'account admin di test (o
 * viene dirottato lì), in `off` non parte affatto — vale anche per i canali
 * pubblici, così un modulo in prova non raggiunge mai terzi.
 */
export async function inviaMessaggioTelegram(chatId: string, testo: string): Promise<EsitoTelegram> {
  const gate = gateTelegram('radar', chatId);
  if (!gate.consentito || !gate.recapito) return { ok: false, error: `gate dipartimenti: ${gate.motivo}` };
  const destinatario = gate.recapito.trim();
  if (!destinatario) return { ok: false, error: 'Chat ID mancante' };
  // GARANZIA DI BRAND: OGNI messaggio parte dalla testata compatta CLIICCABILE
  // (icona + `Scuole Radar.it` verso la home). È idempotente: i renderer che la
  // includono già non la duplicano.
  const corpo = testo.startsWith(BRAND_RIGA_TELEGRAM)
    ? testo
    : `${BRAND_RIGA_TELEGRAM}\n\n${testo}`;
  return chiamaBotApi('sendMessage', payloadMessaggioTesto(destinatario, corpo));
}

/**
 * Invia la notifica Telegram per una delle tipologie, usando la classe in comune.
 *
 * LAYOUT: SEMPRE messaggio di TESTO (`sendMessage`). Gli alert NON allegano più
 * il logo: la foto generava l'anteprima gigante (thumbnail) che occupava lo
 * schermo e nascondeva il contenuto. Un alert è informazione, non un poster:
 * testo pulito, link visibili, zero immagini.
 */
export async function inviaNotificaTelegram(
  chatId: string,
  interpello: DettagliNotifica | null,
  opts: {
    classiUtente?: string[];
    dashboardUrl?: string;
    tipo?: TipoMessaggio;
    /** Forza la presenza/assenza della CTA Radar (~20% di default, stabile). */
    mostraCtaRadar?: boolean;
  } = {},
): Promise<EsitoTelegram> {
  const classe = interpello
    ? classeRilevante(interpello, {
        email: '',
        province: [],
        classi: opts.classiUtente ?? [],
      })
    : '';
  const tipo = opts.tipo ?? 'welcome';
  const testo = formattaMessaggioTelegram(interpello, classe, opts.dashboardUrl, tipo, {
    mostraCtaRadar: opts.mostraCtaRadar,
  });
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
 * riceve OGNI avviso ATA (🗂️ Avviso ATA) d'Italia (in aggiunta al canale regionale).
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

/** Canale nazionale ATA (@scuoleradar_ata): riceve ogni avviso ATA d'Italia. */
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

/* ------------------- Formato post canali regionali (testate & hashtag) ------------------- */

export type CategoriaPost = 'interpello_docenti' | 'avviso_ata' | 'bando_pnrr_esperto';

/**
 * Testate TIPOGRAFICHE pulite per tipologia di avviso.
 *
 * Perché non più le vecchie fasce colorate (`🟢 [INTERPELLO DOCENTI]`,
 * `🔵 [AVVISO ATA]`, `🟣 [BANDO / PNRR / ESPERTO]`): i cerchi colorati e le
 * parentesi quadre sembravano "badge di sistema"/banner di errore e spezzavano
 * la lettura. Resta un'icona semantica + testo in grassetto, senza cornici.
 */
const HEADER_POST: Record<CategoriaPost, string> = {
  interpello_docenti: '📝 <b>Interpello docenti</b>',
  avviso_ata: '🗂️ <b>Avviso ATA</b>',
  bando_pnrr_esperto: '📣 <b>Bando / PNRR / Esperto</b>',
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
 * 'AA' / 'AT' / 'CS' e il ruolo 'DSGA'. Serve a riconoscere come avviso ATA
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
  const codice = (
    scegliClasseRilevante(interpello.classCodes, titolo) ||
    daTitolo ||
    ''
  ).toUpperCase();
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
 * La categoria ATA ha la priorità: un titolo "Personale ATA" / "Assistente amministrativo"
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
 * Formatta il post canale Telegram (STRUTTURA UFFICIALE — solo TESTO, pulita):
 *   1. BRAND    → `📡 <a href="https://www.scuoleradar.it">Scuole Radar.it</a>`;
 *   2. HEADER   → icona semantica + tipologia, SENZA fasce colorate né parentesi:
 *                 `📝 Interpello docenti` / `🗂️ Avviso ATA` / `📣 Bando / PNRR / Esperto`;
 *   3. DETTAGLI → 📍 Provincia ([PR]) — Comune · 🏫 Scuola · 🎓 Ordine · 📚 Classe/Materia · 📅 Scadenza;
 *   4. FONTE    → `🔗 Fonte Ufficiale` (testo iperlinkato, MAI URL in chiaro;
 *                 chiaro, solo avviso specifico/PDF/"Stampa") + 📧 recapito scuola;
 *   5. CTA      → LEAD GEN: invito esplicito a creare il Radar personalizzato su
 *                 `https://scuoleradar.it/dashboard/radar` (URL visibile);
 *   6. NOTIZIE  → CTA a due righe verso scuoleradar.it/notizie;
 *   7. HASHTAG  → #Regione #Provincia #Tipologia #Ruolo #ScuoleRadar.
 *
 * Nessuna immagine allegata e nessuna anteprima nativa: il messaggio è solo testo
 * (`link_preview_options.is_disabled` in `inviaMessaggioTelegram`), quindi non
 * compaiono riquadri/media giganti che coprono l'avviso.
 */
export function formattaPostCanaleTelegram(interpello: InterpelloCanale): string {
  const codice = (interpello.province ?? '').trim().toUpperCase() || 'ND';
  const regione = regionePerProvincia(codice);
  const provincia = nomeProvincia(codice);
  const comune = comuneAvviso(interpello);
  const titolo = interpello.title ?? '';

  const categoria = classificaCategoriaPost(interpello);
  const ruolo = ruoloPerCategoria(categoria, interpello);

  // Codice classe COERENTE con il titolo (il primo della tabella sorgente può
  // essere di un altro livello: era la causa della contraddizione "Primaria" +
  // titolo della secondaria) + avviso strutturato.
  const codiceClasse = (
    scegliClasseRilevante(interpello.classCodes, titolo) ||
    titolo.match(RE_CLASSE_CONCORSO)?.[0] ||
    ''
  ).toUpperCase();
  const avviso = costruisciAvviso({
    provincia: provincia ? `${provincia} (${codice})` : codice,
    classCode: codiceClasse,
    materia: interpello.materia,
    scadenza: interpello.expirationDate,
    schoolName: interpello.schoolName?.trim() || null,
    // Serve solo a dedurre il livello quando manca la classe (nessun campo
    // contraddittorio: Ordine di scuola sempre coerente con Classe/Materia).
    titolo,
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
  // Ordine di scuola: OBBLIGATORIO (dedotto dalla classe, coerente con essa).
  if (ordineScuola) dettagli.push(`🎓 Ordine di scuola: <b>${escapeHtml(ordineScuola)}</b>`);
  // Ruolo/Categoria: omesso quando RIPETE la Classe/Materia (nessuna riga
  // ridondante: es. "👩🏫 A-041" + "📚 A-041 - Scienze…" → resta solo la classe).
  const ruoloRidondante =
    Boolean(ruolo.trim()) &&
    Boolean(materiaAvviso) &&
    materiaAvviso.toLowerCase().includes(ruolo.trim().toLowerCase());
  if (!ruoloRidondante) {
    dettagli.push(`👩🏫 Ruolo / Categoria: <b>${escapeHtml(ruolo)}</b>`);
  }
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

  // Link alla fonte: SOLO un avviso SPECIFICO e DIRETTO — pagina dell'ente, PDF
  // o pagina tabellare/"Stampa" del singolo avviso (`eUrlAvvisoDiretto`). MAI
  // home regionali, archivi, elenchi, tag o pagine di ricerca. L'URL NON viene
  // mai mostrato in chiaro: il post espone solo la riga iperlinkata
  // "🔗 Fonte Ufficiale" con l'URL nell'`href`. Nessuna anteprima nativa
  // (disattivata a monte in `inviaMessaggioTelegram`).
  const linkFonte = eUrlAvvisoDiretto(interpello.link) ? (interpello.link ?? '').trim() : null;
  const linkRiga = linkFonte ? rigaFonteUfficiale(linkFonte) : '';

  // Email di candidatura: OMESSA se non estratta (mai "Email non disponibile":
  // nessuno stato negativo, nessuna email inventata). Il recapito è normalizzato
  // (`emailAvviso`) e reso cliccabile: è l'azione utile quando la pagina di fonte
  // è solo un riepilogo/"Stampa" senza descrizione.
  const email = emailAvviso(interpello.contactEmail);
  const emailRiga = email
    ? `${EMAIL_ICONA} ${EMAIL_ETICHETTA}: <a href="mailto:${escapeHtml(email)}">${escapeHtml(email)}</a>`
    : '';

  // FOOTER CANALE (broadcast regionale/generale): LEAD GENERATION. Invito
  // ESPLICITO a creare il Radar personalizzato (province + classi) su
  // /dashboard/radar — non alla home generica. URL VISIBILE (niente popup
  // nativo): i link ScuoleRadar possono restare in chiaro, l'URL UFFICIALE della
  // fonte no.
  const cta =
    '⚡ <b>Vuoi solo le opportunità della TUA provincia e delle TUE classi?</b>\n' +
    `👉 Crea il tuo Radar personalizzato: ${pulisciUrlTelegram(RADAR_SETUP_URL)}`;

  // NIENTE guida operativa nel post pubblico: il testo che spiegava "questo
  // avviso non indica la pagina ufficiale…" confondeva più di quanto aiutasse e
  // duplicava il link qui sotto. Restano i contenuti utili: link ufficiale + email.
  const bloccoContatto = [linkRiga, emailRiga].filter(Boolean).join('\n');
  // BRAND in testa (una riga compatta) + CTA Notizie a due righe in coda: la
  // struttura del post è uniforme a quella degli alert personali.
  const parti: string[] = [
    BRAND_RIGA_TELEGRAM,
    HEADER_POST[categoria],
    dettagli.join('\n'),
    bloccoContatto,
    cta,
    CTA_NOTIZIE_TELEGRAM,
    hashtag,
  ];
  return parti.filter(Boolean).join('\n\n');
}

/**
 * Destinazioni di pubblicazione per un avviso (ordine di invio):
 *   1. il canale REGIONALE attivo della provincia (se la regione è tra le 10
 *      attive — altrimenti nessun canale regionale);
 *   2. il canale ATA nazionale per OGNI avviso ATA (🗂️), in qualunque regione
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
  /**
   * Motivo dell'ANNULLAMENTO preventivo (gate di link safety): nessuna
   * pubblicazione è stata tentata su nessun canale.
   */
  saltato?: string;
}

/**
 * Pubblica un avviso NUOVO su TUTTE le destinazioni corrette:
 *   - regionale: solo se la regione della provincia è tra i canali attivi;
 *   - ATA nazionale: SEMPRE in aggiunta se l'avviso è della categoria ATA.
 *
 * GATE DI LINK SAFETY (STRICT): un post di canale NON viene mai pubblicato senza
 * un link DIRETTO all'avviso specifico (`eUrlAvvisoDiretto`). Sui canali pubblici
 * non devono mai comparire home regionali, archivi, elenchi o pagine di ricerca:
 * in quel caso la pubblicazione è annullata (`saltato`) e nulla viene inviato.
 */
export async function pubblicaInterpelloSuCanali(
  interpello: InterpelloCanale,
  opts: {
    /** Canali da NON toccare in questa chiamata (es. già pubblicati: ledger). */
    escludi?: string[];
  } = {},
): Promise<EsitoPubblicazioneCanali> {
  if (!eUrlAvvisoDiretto(interpello.link)) {
    const saltato =
      'fonte ufficiale non diretta: pubblicazione annullata (serve l\'avviso specifico)';
    console.warn(
      `  ⛔ Canali Telegram: avviso non pubblicato — ${saltato} · ` +
        `${(interpello.title ?? '').slice(0, 60)} · link=${interpello.link ?? 'nessuno'}`,
    );
    return { destinazioni: [], pubblicati: 0, errori: [], saltato };
  }
  const esclusi = new Set((opts.escludi ?? []).map((c) => c.trim()).filter(Boolean));
  const destinazioni = destinazioniPubblicazione(interpello).filter((c) => !esclusi.has(c));
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

/* ============================= DIGEST GIORNALIERO ============================== */
/**
 * UN SOLO messaggio Telegram con il riepilogo della giornata: sostituisce N
 * messaggi (fatica da notifica). Ogni voce mantiene titolo, dettagli, la fonte
 * ESTERNA originale, il recapito della scuola e la guida operativa quando la
 * pagina di destinazione è un elenco/"Stampa".
 */

/** Massimo di opportunità elencate (poi si taglia per stare nei 4096 caratteri). */
export const MAX_VOCI_TELEGRAM_DIGEST = 8;

/** Limite della Bot API di Telegram. */
const LIMITE_TELEGRAM = 4096;
/** Margine di sicurezza per testata/intro/coda/footer e per gli escape. */
const MARGINE_TELEGRAM = 400;

/**
 * Testata del digest: NON ripete più il marchio (è già nella riga brand in
 * cima al messaggio) — resta la formula utile con il conteggio.
 */
export function testataDigest(numero: number): string {
  const n = Math.max(0, Math.trunc(numero));
  return `🗓️ <b>Oggi abbiamo trovato ${n} opportunità per te</b>`;
}

/** Valore di una riga dell'avviso strutturato (etichetta → valore). */
function valoreRiga(righe: Array<{ etichetta: string; valore: string }>, etichetta: string): string {
  return righe.find((r) => r.etichetta === etichetta)?.valore ?? '';
}

/** Blocco testuale di UNA voce del digest (numerato). */
function bloccoVoceTelegram(
  v: DettagliNotifica,
  numero: number,
  classiUtente: string[],
): string {
  const cl = classeRilevante(v, { email: '', province: [], classi: classiUtente.length > 0 ? classiUtente : (v.classi ?? []) });
  const provincia = nomeProvincia(v.province) ?? v.province;
  const avviso = costruisciAvviso({
    provincia,
    classCode: cl,
    classCodes: v.classi,
    materia: v.materia,
    scadenza: v.scadenza,
    schoolName: v.schoolName,
    email: v.contactEmail,
    titolo: v.title,
  });
  const righe: string[] = [
    `<b>${numero}. ${escapeHtml(pulisciTitoloAvviso(v.title, `Interpello ${[cl, v.province].filter(Boolean).join(' — ')}`))}</b>`,
  ];

  // Riga CONTESTO (compatta): scuola se nota + provincia.
  const scuola = valoreRiga(avviso.opzionali, 'Scuola');
  righe.push(
    [scuola ? `🏫 ${escapeHtml(scuola)}` : '', `📍 ${escapeHtml(provincia)}`].filter(Boolean).join(' · '),
  );

  // Riga COSA/QUANDO: classe-materia + scadenza — le informazioni per agire.
  // (L'ordine di scuola è derivabile dalla classe e resta nella scheda.)
  const classeMateria = valoreRiga(avviso.obbligatorie, 'Classe / Materia');
  const cosa = [
    classeMateria ? `📚 ${escapeHtml(classeMateria)}` : '',
    avviso.scadenzaValida ? `📅 ${escapeHtml(formatDataScadenza(v.scadenza))}` : '',
  ]
    .filter(Boolean)
    .join(' · ');
  if (cosa) righe.push(cosa);

  // Fonte ufficiale nel digest personale: stessa regola dei canali — SOLO un
  // avviso specifico (mai home/elenchi/ricerche), con l'etichetta canonica
  // `🔗 Fonte Ufficiale` e l'URL nascosto nell'href.
  const fonte = eUrlAvvisoDiretto(v.link) ? (v.link ?? '').trim() : null;
  if (fonte) righe.push(rigaAvvisoUfficiale(fonte));
  const email = avviso.email ?? emailAvviso(v.contactEmail);
  if (email) {
    righe.push(`${EMAIL_ICONA} ${EMAIL_ETICHETTA}: <a href="mailto:${escapeHtml(email)}">${escapeHtml(email)}</a>`);
  }
  // Guida operativa: si calcola sull'URL EFFETTIVAMENTE mostrato (`fonte`), non
  // su quello grezzo. Con un link non diretto la riga "nel link la scuola
  // pubblica un elenco…" sarebbe senza riferimento: in quel caso resta la sola
  // indicazione pulita (chiedi alla segreteria / scrivi al recapito).
  const guida = suggerimentoRicercaAvviso({
    url: fonte,
    classe: cl,
    provincia,
    schoolName: v.schoolName,
    email,
    // Versione BREVE: nel digest il recapito è già nella riga precedente.
    compatto: true,
  });
  if (guida) righe.push(`ℹ️ ${escapeHtml(guida)}`);
  return righe.join('\n');
}

/**
 * Formatta il DIGEST per Telegram: una testata, i blocchi numerati e una sola
 * CTA. Il numero di voci si riduce automaticamente per rispettare il limite di
 * caratteri della Bot API.
 */
export function formattaDigestTelegram(
  voci: DettagliNotifica[],
  opts: { dashboardUrl?: string; data?: string; classiUtente?: string[] } = {},
): string {
  if (voci.length === 0) return '';
  const classiUtente = opts.classiUtente ?? [];

  const testata = testataDigest(voci.length);
  const intro = opts.data ? `Riepilogo del <b>${escapeHtml(opts.data)}</b>.` : 'Riepilogo della giornata.';
  const introCompleta = `${intro} Una sola segnalazione al giorno, nel pomeriggio.`;
  // CTA Notizie (due righe esatte): identica a email e alert personali.
  const footer = CTA_NOTIZIE_TELEGRAM;

  // NIENTE prompt "Filtra per provincia e classi" nei messaggi PERSONALI: era una
  // riga di conversione ripetuta in ogni notifica (rumore). Restano i contenuti
  // utili (voci + CTA informativa). Il budget si calcola sulle parti rimaste.
  // `opts.dashboardUrl` è ancora accettato per compatibilità dei chiamanti.
  // Il BRAND (una riga compatta) apre SEMPRE il messaggio.
  const fissi =
    [BRAND_RIGA_TELEGRAM, testata, introCompleta, footer].join('\n\n').length + MARGINE_TELEGRAM;
  const budget = Math.max(500, LIMITE_TELEGRAM - fissi);

  const blocchi: string[] = [];
  let usati = 0;
  for (const v of voci.slice(0, MAX_VOCI_TELEGRAM_DIGEST)) {
    const blocco = bloccoVoceTelegram(v, blocchi.length + 1, classiUtente);
    if (usati + blocco.length > budget && blocchi.length > 0) break;
    blocchi.push(blocco);
    usati += blocco.length + 2;
  }
  const restanti = Math.max(voci.length - blocchi.length, 0);

  const parti: string[] = [
    BRAND_RIGA_TELEGRAM,
    testata,
    introCompleta,
    ...blocchi,
    restanti > 0 ? `…e altre <b>${restanti}</b> opportunità sono nel tuo Radar.` : '',
    footer,
  ];
  const testo = parti.filter(Boolean).join('\n\n');
  // Rete di sicurezza: un blocco eccezionale non deve mai far fallire l'invio.
  return testo.length > LIMITE_TELEGRAM
    ? `${testo.slice(0, LIMITE_TELEGRAM - 30)}\n\n[riepilogo troncato]`
    : testo;
}

/** Invia il digest Telegram: UN solo messaggio per tutte le opportunità. */
export async function inviaDigestTelegram(
  chatId: string,
  voci: DettagliNotifica[],
  opts: { dashboardUrl?: string; data?: string; classiUtente?: string[] } = {},
): Promise<EsitoTelegram> {
  const testo = formattaDigestTelegram(voci, opts);
  if (!testo) return { ok: false, error: 'nessuna opportunità da inviare' };
  return inviaMessaggioTelegram(chatId, testo);
}
