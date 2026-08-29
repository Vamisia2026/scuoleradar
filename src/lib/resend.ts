/**
 * ScuoleRadar.it — Sistema di notifiche email via Resend
 *
 * Implementa la sequenza di messaggi definita da Bartolo (8 tipologie):
 *   welcome / prova1 / prova2 / prova3 / extra / recap / welcome_pro / notifica_pro
 *
 * Variabili d'ambiente:
 *   RESEND_API_KEY        (obbligatoria) — chiave API Resend
 *   RESEND_FROM_EMAIL     (opzionale)    — mittente (default "ScuoleRadar <onboarding@resend.dev>")
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
 * Le 8 tipologie di messaggio del sistema (sequenza copywriting di Bartolo):
 *  1. welcome      — registrazione account Base
 *  2. prova1       — prima opportunità di prova
 *  3. prova2       — seconda opportunità di prova
 *  4. prova3       — terza e ultima opportunità di prova
 *  5. extra        — quarta opportunità rilevata post-prova (blocco soft)
 *  6. recap        — riepilogo blocco definitivo
 *  7. welcome_pro  — conferma attivazione abbonamento PRO
 *  8. notifica_pro — notifica standard per abbonati PRO
 */
export type TipoMessaggio =
  | 'welcome'
  | 'prova1'
  | 'prova2'
  | 'prova3'
  | 'extra'
  | 'recap'
  | 'welcome_pro'
  | 'notifica_pro';

/* ----------------------------- Configurazione ----------------------------- */

const RESEND_FROM_EMAIL =
  process.env.RESEND_FROM_EMAIL ?? 'ScuoleRadar <onboarding@resend.dev>';
const DASHBOARD_URL =
  process.env.RESEND_DASHBOARD_URL ?? 'https://scuoleradar.it/dashboard/radar';

/** Tag sempre inclusi nel payload per separare le metriche dagli altri progetti. */
const RESEND_TAGS = [{ name: 'project', value: 'scuoleradar' }];

/** Restituisce il client Resend o `null` se `RESEND_API_KEY` non è configurata. */
export function getResendClient(): Resend | null {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey || apiKey.includes('xxxx') || apiKey.includes('your-')) {
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
  if (/\bpnrr\b/.test(t)) return 'PNRR';
  if (/\bpon\b/.test(t)) return 'PON';
  if (/\bpor\b/.test(t)) return 'POR';
  if (/esperto/.test(t)) return 'Bando Esperti';
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
  welcome: 'Benvenuto in ScuoleRadar',
  prova1: 'Abbiamo trovato una nuova opportunità per te!',
  prova2: 'Abbiamo trovato un\'altra opportunità che potrebbe interessarti',
  prova3: 'Terza e ultima segnalazione di prova + ScuoleRadar',
  extra: 'Questa opportunità non dovevamo mandartela...',
  recap: 'Il tuo periodo di prova su ScuoleRadar è terminato',
  welcome_pro: 'Benvenuto in ScuoleRadar PRO!',
  notifica_pro: 'Nuova opportunità trovata per te!',
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
  'extra',
  'notifica_pro',
]);

/**
 * Copy esatto della sequenza di Bartolo.
 * Il saluto "Ciao, ..." viene aggiunto dal renderer con il nome del destinatario.
 */
const CORPO_MESSAGGI: Record<TipoMessaggio, ContenutoMessaggio> = {
  welcome: {
    paragrafi: [
      'Benvenuto in ScuoleRadar.',
      'Abbiamo iniziato a cercare per te le opportunità più interessanti in base al tuo profilo: interpelli, supplenze, incarichi, PNRR, PON, POR e altro ancora.',
      'Per provare il servizio hai a disposizione <strong>3 segnalazioni ultra personalizzate</strong>.',
      'Noi cerchiamo. Tu decidi quali opportunità cogliere.',
      'Se vuoi che continuiamo a farlo per te, ScuoleRadar PRO costa <strong>49 € all\'anno</strong>, con tutti i nostri servizi inclusi.',
    ],
    cta: { label: 'Attiva PRO →', destinazione: 'prezzi' },
  },
  prova1: {
    paragrafi: [
      'Abbiamo trovato una nuova opportunità per te.',
      'Questa è la <strong>prima</strong> opportunità che abbiamo trovato per te.',
      'Te ne restano <strong>2</strong> per provare il servizio.',
      'Come vedi, non ti intasiamo l\'email di segnalazioni inutili solo per fare volume: cerchiamo proprio quell\'opportunità che può fare la differenza.',
      'Una buona opportunità può valere mesi, o persino un anno, di lavoro. Per questo facciamo molta attenzione a ciò che ti segnaliamo.',
      'Se vuoi che continuiamo a cercare per te, ScuoleRadar PRO costa <strong>49 € all\'anno</strong>.',
    ],
    cta: { label: 'Continua con PRO →', destinazione: 'prezzi' },
  },
  prova2: {
    paragrafi: [
      'Abbiamo trovato un\'altra opportunità che potrebbe interessarti.',
      'Questa è la <strong>seconda</strong> segnalazione che ti inviamo.',
      'Te ne resta <strong>1</strong>.',
      'Facciamo ogni giorno del nostro meglio per trovare le migliori opportunità per te, in modo che tu non debba sprecare il tuo tempo a farlo.',
      'Una sola opportunità andata a buon fine può valere migliaia di euro. E se ti sfugge, sono migliaia di euro che perdi, non soltanto un\'email.',
      'ScuoleRadar PRO costa <strong>49 € all\'anno</strong> e comprende tutti i nostri servizi per la scuola.',
    ],
    cta: { label: 'Continua con PRO →', destinazione: 'prezzi' },
  },
  prova3: {
    paragrafi: [
      'Abbiamo trovato un\'altra opportunità per te.',
      'Questa è la <strong>terza e ultima</strong> segnalazione del tuo periodo di prova.',
      'Se nel frattempo hai trovato quello che cercavi grazie a noi e non vuoi abbonarti, siamo contenti per te.',
      'Dillo ai tuoi amici e siamo pari.',
      'Se invece vuoi che continuiamo a cercare opportunità per te, puoi attivare ScuoleRadar PRO a <strong>49 € all\'anno</strong>.',
      'Nel prezzo sono inclusi anche la modulistica, il nostro strumento per costruire e aggiornare il CV, il calcolatore di CFU e gli altri servizi per chi lavora nella scuola.',
    ],
    cta: { label: 'Continua con PRO →', destinazione: 'prezzi' },
  },
  extra: {
    paragrafi: [
      'Questa opportunità non dovevamo mandartela.',
      'Il periodo di prova è terminato, ma quando l\'abbiamo vista ci è sembrata davvero adatta al tuo profilo ed era un peccato non fartela vedere.',
      'Ecco, questa volta te l\'abbiamo offerta noi. 😊',
      'Se vuoi che continuiamo a cercare opportunità per te, ScuoleRadar PRO costa <strong>49 € all\'anno</strong>.',
      'Hai anche accesso a tutta la modulistica, al nostro strumento per costruire il CV, al calcolatore di CFU, a Pure Focus e agli altri servizi che stiamo sviluppando per chi lavora nella scuola.',
      'Buona giornata, e buona vita!',
    ],
    cta: { label: 'Attiva PRO →', destinazione: 'prezzi' },
  },
  recap: {
    paragrafi: [
      'Hai ricevuto le <strong>3 segnalazioni gratuite</strong> di ScuoleRadar.',
      'Da questo momento il tuo account passa al piano <strong>Free</strong>: puoi continuare a usare i servizi disponibili gratuitamente, consultare il blog, scaricare la modulistica e usare gli strumenti che mettiamo a disposizione.',
      'Quello che cambia è che smettiamo di cercare opportunità personalizzate per te.',
      'Se vuoi continuare a ricevere interpelli, supplenze, incarichi, PNRR, PON, POR e altre opportunità selezionate in base al tuo profilo, puoi attivare ScuoleRadar PRO a <strong>49 € all\'anno</strong>.',
      'Una sola buona opportunità può valere migliaia di euro.',
      'E nel frattempo hai tutto il resto: CV, calcolo CFU, Pure Focus, modulistica e gli altri servizi PRO.',
      'Se invece preferisci restare sul piano Free, nessun problema.',
      'Buona vita. Se cambi idea, noi siamo qui.',
    ],
    cta: { label: 'Attiva PRO →', destinazione: 'prezzi' },
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
  notifica_pro: {
    paragrafi: [
      'Abbiamo trovato una nuova opportunità per te.',
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
          const dettagli: string[] = [categoriaOpportunita(interpello.title)];
          if (interpello.schoolName) dettagli.push(interpello.schoolName);
          dettagli.push(interpello.province);
          if (classe) dettagli.push(classe);
          return `
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 20px; border:1px solid #e2e8f0; border-radius:12px; background:#f8fafc;">
                  <tr>
                    <td style="padding:16px 20px;">
                      <h2 style="margin:0 0 8px; font-size:18px; font-weight:800; line-height:1.35; color:#14354e;">${escapeHtml(interpello.title)}</h2>
                      <p style="margin:0; font-size:14px; line-height:1.6; color:#475569;">${dettagli.join(' · ')}</p>
                      <p style="margin:8px 0 0; font-size:13px; color:#64748b;">Scadenza: ${formatDataScadenza(interpello.scadenza)}</p>
                      <p style="margin:12px 0 0;"><a href="${escapeHtml(urlOpportunita)}" target="_blank" rel="noopener" style="font-size:14px; font-weight:700; color:#2B6F9E; text-decoration:underline;">Apri l'avviso e candidati →</a></p>
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
