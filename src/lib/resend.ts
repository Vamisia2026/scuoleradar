/**
 * ScuoleRadar.it — Sistema di notifiche email via Resend
 *
 * Implementa la sequenza di messaggi definita da Bartolo (8 tipologie):
 *   welcome / prova1 / prova2 / prova3 / extra / recap / welcome_pro / notifica_pro
 *
 * Variabili d'ambiente:
 *   RESEND_API_KEY        (obbligatoria) — chiave API Resend
 *   RESEND_FROM_EMAIL     (opzionale)    — mittente (default "ScuoleRadar (Notifiche Automatiche) <notifiche@scuoleradar.it>")
 *   RESEND_DASHBOARD_URL  (opzionale)    — URL base dell'app per i link CTA
 *
 * NOTA: modulo solo-Node (usato da scraper/notifier), verificato da tsconfig.scraper.json.
 */

import { Resend } from 'resend';

/** Interfaccia per l'ambiente (evita la dipendenza da @types/node nel frontend). */
declare const process: { env: Record<string, string | undefined> };

/* ------------------------------- Tipi ------------------------------- */

export interface DestinatarioNotifica {
  email: string;
  nome?: string;
  /** Province di interesse del profilo (es. ['AT', 'MI']) */
  province: string[];
  /** Classi di concorso del profilo (es. ['A-22', 'ADEE']) */
  classi: string[];
}

export interface DettagliNotifica {
  /** Identificativo dell'opportunità (per il link di fallback). */
  id?: string;
  title: string;
  schoolName: string | null;
  province: string;
  /** Classi di concorso dell'opportunità (es. ['A-22', 'ADEE']) */
  classi: string[];
  scadenza: string | null;
  /** URL del bando/avviso originale */
  link: string | null;
}

export interface EsitoInvio {
  inviate: number;
  fallite: number;
}

/**
 * Le 8 tipologie di messaggio del sistema (sequenza BASE + PRO):
 *  Email 1. welcome      — intake / conferma iscrizione account Base
 *  Email 2. prova1       — prima opportunità di prova
 *  Email 3. prova2       — seconda opportunità di prova
 *  Email 4. prova3       — terza e ultima opportunità di prova
 *  Email 5. extra        — avviso: periodo di prova terminato (upgrade PRO)
 *  Email 6. recap        — avviso finale (servizio di notifica sospeso)
 *  PRO     welcome_pro   — conferma attivazione abbonamento PRO
 *  PRO     notifica_pro  — notifica standard per abbonati PRO
 */
export type TipoMessaggio =
  | 'welcome'
  | 'prova1'
  | 'prova2'
  | 'prova3'
  | 'extra'
  | 'recap'
  | 'welcome_pro'
  | 'notifica_pro'
  | 'conferma_attivazione'
  | 'free_forever_preavviso';

/* ----------------------------- Configurazione ----------------------------- */

const RESEND_FROM_EMAIL =
  process.env.RESEND_FROM_EMAIL ?? 'ScuoleRadar (Notifiche Automatiche) <notifiche@scuoleradar.it>';
const DASHBOARD_URL =
  process.env.RESEND_DASHBOARD_URL ?? 'https://scuoleradar.it/dashboard/radar';

/** Tag sempre inclusi nel payload per separare le metriche dagli altri progetti. */
const RESEND_TAGS = [{ name: 'project', value: 'scuoleradar' }];

/** Restituisce il client Resend o `null` se `RESEND_API_KEY` non è configurata. */
export function getResendClient(): Resend | null {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey || apiKey.includes('xxxx') || apiKey.includes('your-') || apiKey.includes('inserisci')) {
    console.warn('⚠ RESEND_API_KEY non configurata: notifiche email disattivate.');
    return null;
  }
  return new Resend(apiKey);
}

/* ------------------------------- Helpers ------------------------------- */

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function formatDataScadenza(data: string | null): string {
  if (!data) return 'Non indicata';
  const d = new Date(data);
  if (Number.isNaN(d.getTime())) return data;
  return d.toLocaleDateString('it-IT', { day: '2-digit', month: 'long', year: 'numeric' });
}

/** Sceglie la classe di concorso più rilevante: intersezione con le classi dell'utente. */
export function classeRilevante(
  interpello: DettagliNotifica,
  destinatario: DestinatarioNotifica,
): string {
  const comune = interpello.classi.find((c) => destinatario.classi.includes(c));
  return comune ?? interpello.classi[0] ?? '';
}

/** Rileva la categoria dell'opportunità dal titolo (Interpelli, PNRR, PON, Bandi Esperti). */
export function categoriaOpportunita(title: string): string {
  const t = title.toLowerCase();
  if (/\bpnrr\b|next generation eu/.test(t)) return 'PNRR';
  if (/\bpon\b|programma operativo nazionale|\bfse\b/.test(t)) return 'PON';
  if (/\bpor\b|programma operativo regionale|\bfesr\b/.test(t)) return 'POR';
  if (/espert|reclutamento/.test(t)) return 'Bando Esperti';
  if (/interpello|supplenza/.test(t)) return 'Interpello / Supplenza';
  return 'Opportunità';
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

/** Link dell'opportunità (bando originale, con fallback alla pagina di dettaglio). */
export function linkOpportunita(interpello: DettagliNotifica | null, dashboardUrl: string): string {
  if (!interpello) return dashboardUrl;
  if (interpello.link) return interpello.link;
  if (interpello.id) return `${baseUrl(dashboardUrl)}interpello/${encodeURIComponent(interpello.id)}`;
  return dashboardUrl;
}

/* --------------------------- Soggetti e copy --------------------------- */

const SUBJECT: Record<TipoMessaggio, string> = {
  welcome: 'Conferma attivazione: il tuo account Base è attivo',
  prova1: 'Questa è la prima opportunità che abbiamo trovato per te. Te ne restano 2',
  prova2: 'Questa è la seconda opportunità che abbiamo trovato per te. Te ne resta 1',
  prova3: 'Questa è la terza e ultima opportunità di prova che abbiamo trovato per te',

  extra: 'Il tuo periodo di prova è terminato: passa a PRO per continuare a ricevere le opportunità',
  recap: 'Avviso finale: le notifiche di prova sono terminate',
  welcome_pro: 'Benvenuto in ScuoleRadar PRO!',
  notifica_pro: 'Nuova opportunità trovata per te!',
  conferma_attivazione: 'Conferma attivazione: il tuo piano PRO è attivo',
  free_forever_preavviso: 'Piano PRO Free Forever: il rinnovo gratuito è automatico',
};

export function subjectNotifica(tipo: TipoMessaggio): string {
  return SUBJECT[tipo];
}

interface CtaMessaggio {
  label: string;
  /** Destinazione del bottone: pagina prezzi, dashboard o link dell'opportunità. */
  destinazione: 'prezzi' | 'dashboard' | 'opportunita';
}

interface ContenutoMessaggio {
  paragrafi: string[];
  cta: CtaMessaggio | null;
}

/** Tipologie che includono il blocco dell'opportunità (titolo + dettagli + link). */
export const TIPI_CON_OPPORTUNITA: ReadonlySet<TipoMessaggio> = new Set([
  'prova1',
  'prova2',
  'prova3',
  'notifica_pro',
]);

/**
 * Copy esatto della sequenza di Bartolo.
 * Il saluto "Ciao, ..." viene aggiunto dal renderer con il nome del destinatario.
 */
const CORPO_MESSAGGI: Record<TipoMessaggio, ContenutoMessaggio> = {
  welcome: {
    paragrafi: [
      'Il tuo account <strong>Base</strong> è attivo: benvenuto in ScuoleRadar!',
      'Hai già accesso gratuito a Modulistica, Crea CV, Calcolatore CFU e Radar Scuole con <strong>3 segnalazioni</strong> di opportunità.',
      'Quando vuoi sapere cosa succede di importante nella scuola, passa dal nostro Notiziario: controlliamo noi le fonti ufficiali per te.',
    ],
    cta: { label: 'Vai a ScuoleRadar →', destinazione: 'dashboard' },
  },
  prova1: {
    paragrafi: ['Questa è la <strong>prima opportunità</strong> che abbiamo trovato per te. Te ne <strong>restano 2</strong>.'],
    cta: { label: 'Guarda l\'opportunità e candidati →', destinazione: 'opportunita' },
  },
  prova2: {
    paragrafi: ['Questa è la <strong>seconda opportunità</strong> che abbiamo trovato per te. Te ne <strong>resta 1</strong>.'],
    cta: { label: 'Guarda l\'opportunità e candidati →', destinazione: 'opportunita' },
  },
  prova3: {
    paragrafi: ['Questa è la <strong>terza e ultima opportunità</strong> di prova che abbiamo trovato per te.'],
    cta: { label: 'Guarda l\'opportunità e candidati →', destinazione: 'opportunita' },
  },
  extra: {
    paragrafi: [
      'Le tue <strong>3 notifiche di prova sono terminate</strong>.',
      'Per continuare a ricevere le opportunità su misura per te in tempo reale, passa al piano PRO.',
    ],
    cta: { label: 'Attiva PRO →', destinazione: 'prezzi' },
  },
  recap: {
    paragrafi: [
      'Questo è l\'ultimo avviso del periodo di prova.',
      'Il servizio di notifiche automatiche dell\'Account Base è terminato: non riceverai più nuove segnalazioni.',
      'Se vuoi riattivarlo, passa al piano PRO: notifiche illimitate e tutti gli strumenti ScuoleRadar.',
    ],
    cta: { label: 'Passa a PRO →', destinazione: 'prezzi' },
  },
  welcome_pro: {
    paragrafi: [
      'Benvenuto in ScuoleRadar <strong>PRO</strong>.',
      'Da oggi continuiamo a cercare per te le opportunità più interessanti in base al tuo profilo: interpelli, supplenze, incarichi, PNRR, PON, POR e altro ancora.',
      'Tu non devi passare ore a cercarle: quando troviamo qualcosa che sembra fatto per te, te lo segnaliamo.',
      'E hai accesso a tutti i servizi PRO di ScuoleRadar: CV, calcolo CFU, modulistica, Pure Focus e gli altri strumenti che stiamo sviluppando per chi lavora nella scuola.',
      'Hai fatto un buon investimento.',
      'Noi continuiamo a cercare per te!',
      'A presto!',
    ],
    cta: { label: 'Vai a ScuoleRadar →', destinazione: 'dashboard' },
  },
  conferma_attivazione: {
    paragrafi: [
      'La tua attivazione è confermata: il piano <strong>PRO</strong> di ScuoleRadar è attivo.',
      'Hai accesso a notifiche illimitate, strumenti docenti completi, modulistica sempre aggiornata e Pure Focus.',
      'Nessun altro passaggio: noi continuiamo a cercare per te.',
    ],
    cta: { label: 'Vai a ScuoleRadar →', destinazione: 'dashboard' },
  },
  free_forever_preavviso: {
    paragrafi: [
      'Il tuo piano <strong>PRO Free Forever</strong> si sta avvicinando alla scadenza annuale.',
      'Tranquillo: nessun pagamento, nessuna azione richiesta. Alla scadenza il rinnovo parte automaticamente a <strong>0€</strong>, per sempre.',
      'Non riceverai mai solleciti di pagamento né avvisi di mancato rinnovo: la tua gratuità è garantita.',
    ],
    cta: { label: 'Vai a ScuoleRadar →', destinazione: 'dashboard' },
  },
  notifica_pro: {
    paragrafi: [
      'Abbiamo trovato una <strong>nuova opportunità</strong> per te.',
      'Ci è sembrata interessante per il tuo profilo e abbiamo pensato che valesse la pena fartela vedere.',
      'Continuiamo a cercare per te.',
      'A presto!',
    ],
    cta: { label: 'Guarda l\'opportunità e candidati →', destinazione: 'opportunita' },
  },
};
/* --------------------------- Template email HTML --------------------------- */

export function renderEmailHtml(
  interpello: DettagliNotifica | null,
  destinatario: DestinatarioNotifica,
  dashboardUrl: string = DASHBOARD_URL,
  tipo: TipoMessaggio = 'welcome',
): string {
  const contenuto = CORPO_MESSAGGI[tipo];
  const saluto = destinatario.nome ? `Ciao ${escapeHtml(destinatario.nome)},` : 'Ciao,';

  // Link del bottone CTA
  const urlOpportunita = linkOpportunita(interpello, dashboardUrl);
  let ctaHref = '';
  let ctaLabel = '';
  if (contenuto.cta) {
    ctaLabel = contenuto.cta.label;
    ctaHref =
      contenuto.cta.destinazione === 'prezzi'
        ? proUrl(dashboardUrl)
        : contenuto.cta.destinazione === 'dashboard'
          ? dashboardUrl
          : urlOpportunita;
  }

  // Blocco opportunità: titolo + dettagli compatti + link diretto all'avviso
  const bloccoOpportunita =
    interpello && TIPI_CON_OPPORTUNITA.has(tipo)
      ? (() => {
          const classe = classeRilevante(interpello, destinatario);
          const dettagli: string[] = [];
          if (interpello.schoolName) dettagli.push(`🏫 ${escapeHtml(interpello.schoolName)}`);
          if (classe) dettagli.push(`📚 ${escapeHtml(classe)}`);
          dettagli.push(`📍 ${escapeHtml(interpello.province)}`);
          dettagli.push(`🏷️ ${escapeHtml(categoriaOpportunita(interpello.title))}`);
          return `
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 20px; border:1px solid #e2e8f0; border-radius:12px; background:#f8fafc;">
                  <tr>
                    <td style="padding:16px 20px;">
                      <h2 style="margin:0 0 8px; font-size:18px; font-weight:800; line-height:1.35; color:#14354e;"><b>${escapeHtml(interpello.title)}</b></h2>
                      <p style="margin:0; font-size:14px; line-height:1.6; color:#475569;">${dettagli.join(' · ')}</p>
                      <p style="margin:8px 0 0; font-size:13px; color:#64748b;">⏳ Scadenza: ${formatDataScadenza(interpello.scadenza)}</p>
                      <p style="margin:12px 0 0;">${interpello.link ? `<a href="${escapeHtml(interpello.link)}" target="_blank" rel="noopener" style="font-size:14px; font-weight:700; color:#2B6F9E; text-decoration:underline;">🔗 Fonte ufficiale verificata (Albo Pretorio) — apri e candidati →</a>` : ''}</p>
                    </td>
                  </tr>
                </table>`;
        })()
      : '';

  // Paragrafi di testo (saluto + copy della tipologia)
  const paragrafiHtml = [saluto, ...contenuto.paragrafi]
    .map((p) => `<p style="margin:0 0 14px; font-size:15px; line-height:1.6; color:#14354e;">${p}</p>`)
    .join('\n');

  // Bottone CTA principale
  const ctaHtml = ctaHref
    ? `
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0 8px;">
                  <tr>
                    <td align="center">
                      <a href="${escapeHtml(ctaHref)}" class="cta" target="_blank" rel="noopener"
                         style="display:inline-block; padding:14px 36px; border-radius:12px; background-color:#2B6F9E; color:#ffffff; font-size:15px; font-weight:700; text-decoration:none;">
                        ${ctaLabel}
                      </a>
                    </td>
                  </tr>
                </table>`
    : '';

  return `<!DOCTYPE html>
<html lang="it">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta http-equiv="X-UA-Compatible" content="IE=edge" />
    <title>${SUBJECT[tipo]}</title>
    <style>
      @media only screen and (max-width: 620px) {
        .container { padding: 0 16px !important; }
        .cta { display: block !important; width: 100% !important; box-sizing: border-box; }
      }
    </style>
  </head>
  <body style="margin:0; padding:0; background-color:#f1f5f9; font-family:Inter, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f1f5f9; padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px; width:100%;">
            <!-- Header brand -->
            <tr>
              <td align="center" style="padding-bottom:16px;">
                <span style="font-size:22px; font-weight:800; color:#14354e;">📡 ScuoleRadar</span>
              </td>
            </tr>
            <!-- Card principale -->
            <tr>
              <td style="background-color:#ffffff; border-radius:16px; border:1px solid #d6eaf4; padding:32px 24px;" class="container">
                ${paragrafiHtml}

                ${bloccoOpportunita}

                ${ctaHtml}

                <p style="margin:20px 0 0; font-size:15px; line-height:1.6; color:#14354e;"><b>I tuoi colleghi di Scuole Radar</b></p>
                <p style="margin:10px 0 0; font-size:13px; line-height:1.5; color:#64748b;">P.S. Approfondimenti e novità sul blog: <a href="https://scuoleradar.it/notizie" style="color:#2B6F9E;">scuoleradar.it/notizie</a></p>

                <p style="margin:14px 0 0; font-size:12px; line-height:1.5; color:#94a3b8;">
                  ⚠️ Questa è un'email automatica generata dal sistema. Ti preghiamo di non rispondere a questo
                  messaggio perché la casella non viene letta. Se hai bisogno di aiuto o vuoi segnalarci qualcosa,
                  usa il nostro Form di Contatto (<a href="https://scuoleradar.it/contatti" style="color:#94a3b8;">scuoleradar.it/contatti</a>).
                </p>

                <p style="margin:20px 0 0; font-size:12px; line-height:1.5; color:#94a3b8;">
                  ScuoleRadar.it — Interpelli, supplenze, incarichi, PNRR, PON, POR e opportunità per i docenti<br />
                  Se non desideri ricevere queste email, modifica le preferenze nel tuo profilo.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

/* ------------------------------ Invio email ------------------------------ */

/**
 * Invia un'email di una delle 8 tipologie a un singolo destinatario.
 * - `interpello` può essere null per i messaggi transazionali (welcome, recap, welcome_pro).
 * - L'esito include l'eventuale errore restituito dall'API Resend.
 */
export async function inviaNotificaEmail(
  client: Resend | null,
  interpello: DettagliNotifica | null,
  destinatario: DestinatarioNotifica,
  opts: { dryRun?: boolean; dashboardUrl?: string; tipo?: TipoMessaggio } = {},
): Promise<{ inviata: boolean; error?: string }> {
  if (!client) return { inviata: false, error: 'Client Resend non configurato' };

  const { dryRun = false, dashboardUrl = DASHBOARD_URL, tipo = 'welcome' } = opts;
  const subject = subjectNotifica(tipo);
  const html = renderEmailHtml(interpello, destinatario, dashboardUrl, tipo);

  if (dryRun) {
    console.log(`  ✉ [DRY-RUN] → ${destinatario.email} | ${subject}`);
    return { inviata: true };
  }

  try {
    const { error } = await client.emails.send({
      from: RESEND_FROM_EMAIL,
      to: [destinatario.email],
      subject,
      html,
      tags: RESEND_TAGS,
    });

    if (error) {
      console.warn(`  ✗ Invio email a ${destinatario.email} fallito: ${error.message}`);
      return { inviata: false, error: error.message };
    }
    console.log(`  ✓ Email inviata a ${destinatario.email}`);
    return { inviata: true };
  } catch (err) {
    // Un'eccezione (rete, timeout, rate-limit) NON deve silenziosamente
    // perdere l'email: viene loggata e riportata al notifier per il conteggio.
    const messaggio = (err as Error).message ?? 'Errore sconosciuto';
    console.warn(`  ✗ Invio email a ${destinatario.email} fallito (eccezione): ${messaggio}`);
    return { inviata: false, error: messaggio };
  }
}

/** Invia la notifica a una lista di destinatari (utile per lanci multi-utente). */
export async function inviaNotificheInterpello(
  client: Resend | null,
  interpello: DettagliNotifica | null,
  destinatari: DestinatarioNotifica[],
  opts: { dryRun?: boolean; dashboardUrl?: string; tipo?: TipoMessaggio } = {},
): Promise<EsitoInvio> {
  if (!client || destinatari.length === 0) {
    return { inviate: 0, fallite: 0 };
  }

  let inviate = 0;
  let fallite = 0;
  for (const destinatario of destinatari) {
    const esito = await inviaNotificaEmail(client, interpello, destinatario, opts);
    if (esito.inviata) inviate += 1;
    else fallite += 1;
  }
  return { inviate, fallite };
}
