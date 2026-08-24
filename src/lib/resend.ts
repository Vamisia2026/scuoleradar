/**
 * ScuoleRadar.it — Invio notifiche email via Resend (FASE 4)
 *
 * Helper autonomo usato dallo scraper (Node): riceve un interpello e la
 * lista di utenti qualificati (dal Matching Engine) e invia una mail HTML
 * pulita e responsive. L'autenticazione avviene tramite `RESEND_API_KEY`.
 *
 * Variabili d'ambiente:
 *   RESEND_API_KEY        (obbligatoria) — chiave API Resend
 *   RESEND_FROM_EMAIL     (opzionale)    — mittente, default "ScuoleRadar <onboarding@resend.dev>"
 *   RESEND_DASHBOARD_URL  (opzionale)    — URL della dashboard per il pulsante CTA
 *
 * NOTA: questo modulo usa solo API Node (Resend SDK) ed è escluso dal
 * typecheck/build del frontend (tsconfig.app.json); viene compilato e
 * verificato dallo tsconfig dello scraper.
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
  /** Identificativo dell'interpello (per il link di fallback `/interpello/:id`). */
  id?: string;
  title: string;
  schoolName: string | null;
  province: string;
  /** Classi di concorso dell'interpello (es. ['A-22', 'ADEE']) */
  classi: string[];
  scadenza: string | null;
  /** URL del bando/interpello originale della scuola */
  link: string | null;
}

export interface EsitoInvio {
  inviate: number;
  fallite: number;
}

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
  return comune ?? interpello.classi[0] ?? 'non specificata';
}

/** Costruisce l'oggetto `subject` della notifica per l'utente. */
export function subjectNotifica(
  interpello: DettagliNotifica,
  destinatario: DestinatarioNotifica,
): string {
  return `🎯 Nuovo Interpello trovato per la tua classe di concorso ${classeRilevante(interpello, destinatario)}`;
}

/* --------------------------- Template email HTML --------------------------- */

export function renderEmailHtml(
  interpello: DettagliNotifica,
  destinatario: DestinatarioNotifica,
  dashboardUrl: string = DASHBOARD_URL,
): string {
  const classe = classeRilevante(interpello, destinatario);
  const titolo = escapeHtml(interpello.title);
  const scuola = escapeHtml(interpello.schoolName || 'Scuola non indicata');
  const provincia = escapeHtml(interpello.province);
  const scadenza = formatDataScadenza(interpello.scadenza);
  const link = interpello.link ? escapeHtml(interpello.link) : dashboardUrl;
  const saluto = destinatario.nome ? `Ciao ${escapeHtml(destinatario.nome)},` : 'Ciao,';

  return `<!DOCTYPE html>
<html lang="it">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta http-equiv="X-UA-Compatible" content="IE=edge" />
    <title>Nuovo interpello: ${escapeHtml(classe)}</title>
    <style>
      @media only screen and (max-width: 620px) {
        .container { padding: 0 16px !important; }
        .dettagli-td { display: block !important; width: 100% !important; box-sizing: border-box; }
        .cta { padding: 14px 28px !important; font-size: 15px !important; }
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
                <p style="margin:0 0 16px; font-size:15px; line-height:1.5; color:#14354e;">${saluto}</p>
                <p style="margin:0 0 20px; font-size:15px; line-height:1.5; color:#14354e;">
                  Abbiamo trovato un nuovo <strong>interpello</strong> che corrisponde al tuo profilo:
                </p>

                <!-- Titolo interpello -->
                <h1 style="margin:0 0 20px; font-size:20px; font-weight:800; line-height:1.35; color:#2B6F9E;">${titolo}</h1>

                <!-- Dettagli -->
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e2e8f0; border-radius:12px; overflow:hidden;">
                  <tr>
                    <td class="dettagli-td" style="width:50%; padding:12px 16px; border-bottom:1px solid #e2e8f0; background:#f8fafc;">
                      <p style="margin:0; font-size:11px; text-transform:uppercase; letter-spacing:0.5px; color:#64748b;">Scuola</p>
                      <p style="margin:4px 0 0; font-size:14px; font-weight:600; color:#0f172a;">${scuola}</p>
                    </td>
                    <td class="dettagli-td" style="width:50%; padding:12px 16px; border-bottom:1px solid #e2e8f0; background:#f8fafc; border-left:1px solid #e2e8f0;">
                      <p style="margin:0; font-size:11px; text-transform:uppercase; letter-spacing:0.5px; color:#64748b;">Provincia</p>
                      <p style="margin:4px 0 0; font-size:14px; font-weight:600; color:#0f172a;">${provincia}</p>
                    </td>
                  </tr>
                  <tr>
                    <td class="dettagli-td" style="width:50%; padding:12px 16px; background:#f8fafc;">
                      <p style="margin:0; font-size:11px; text-transform:uppercase; letter-spacing:0.5px; color:#64748b;">Classe di Concorso</p>
                      <p style="margin:4px 0 0; font-size:14px; font-weight:600; color:#0f172a;">${escapeHtml(classe)}</p>
                    </td>
                    <td class="dettagli-td" style="width:50%; padding:12px 16px; background:#f8fafc; border-left:1px solid #e2e8f0;">
                      <p style="margin:0; font-size:11px; text-transform:uppercase; letter-spacing:0.5px; color:#64748b;">Scadenza</p>
                      <p style="margin:4px 0 0; font-size:14px; font-weight:600; color:#0f172a;">${scadenza}</p>
                    </td>
                  </tr>
                </table>

                <!-- CTA -->
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:24px;">
                  <tr>
                    <td align="center">
                      <a href="${link}" class="cta" target="_blank" rel="noopener"
                         style="display:inline-block; padding:14px 36px; border-radius:12px; background-color:#2B6F9E; color:#ffffff; font-size:15px; font-weight:700; text-decoration:none;">
                        🎯 Apri nella Dashboard di ScuoleRadar
                      </a>
                    </td>
                  </tr>
                </table>

                <p style="margin:20px 0 0; font-size:13px; line-height:1.5; color:#475569;">
                  Hai ricevuto questa email perché nel tuo profilo ScuoleRadar sono impostate
                  notifiche per ${escapeHtml(interpello.classi.join(', '))} in ${provincia}.
                </p>
              </td>
            </tr>
            <!-- Footer -->
            <tr>
              <td align="center" style="padding-top:16px;">
                <p style="margin:0; font-size:12px; color:#94a3b8;">
                  ScuoleRadar.it — Interpelli, supplenze e opportunità per i docenti<br />
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
 * Invia la notifica email di un interpello a un singolo destinatario.
 * Usata dal Notifier per inviare email e Telegram in parallelo per utente.
 */
export async function inviaNotificaEmail(
  client: Resend | null,
  interpello: DettagliNotifica,
  destinatario: DestinatarioNotifica,
  opts: { dryRun?: boolean; dashboardUrl?: string } = {},
): Promise<{ inviata: boolean; error?: string }> {
  if (!client) return { inviata: false, error: 'Client Resend non configurato' };

  const { dryRun = false, dashboardUrl = DASHBOARD_URL } = opts;
  const subject = subjectNotifica(interpello, destinatario);
  const html = renderEmailHtml(interpello, destinatario, dashboardUrl);

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

/**
 * Invia la notifica email di un interpello alla lista di utenti qualificati.
 * - `client`: client Resend (da `getResendClient()`); se `null` restituisce 0/0.
 * - `dryRun`: logga le email senza inviarle (per test).
 */
export async function inviaNotificheInterpello(
  client: Resend | null,
  interpello: DettagliNotifica,
  destinatari: DestinatarioNotifica[],
  opts: { dryRun?: boolean; dashboardUrl?: string } = {},
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