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
import {
  ICONA_RIGA,
  costruisciAvviso,
  etichettaFonteLink,
  pulisciTitoloAvviso,
  scegliClasseRilevante,
} from './alertInterpello';
import { urlSchedaInterpello } from './interpelloRouting';

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
  /** Materia/settore dell'avviso (dal testo) o nome ufficiale della classe. */
  materia?: string | null;
  scadenza: string | null;
  /** URL del bando/avviso originale */
  link: string | null;
  /** Email di candidatura della scuola (PEC/istituzionale), se presente nei dati. */
  contactEmail?: string | null;

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

/**
 * Sceglie la classe di concorso più rilevante per il DESTINATARIO (intersezione
 * con le sue classi) e, tra le candidate, quella COERENTE con il titolo
 * (`scegliClasseRilevante`): evita alert con "Scuola Primaria" e un titolo della
 * secondaria, e mantiene Ordine di scuola ↔ Classe/Materia sempre allineati.
 */
export function classeRilevante(
  interpello: DettagliNotifica,
  destinatario: DestinatarioNotifica,
): string {
  const classi = interpello.classi ?? [];
  if (classi.length === 0) return '';
  const comuni = classi.filter((c) => destinatario.classi.includes(c));
  const candidate = comuni.length > 0 ? comuni : classi;
  if (candidate.length === 1) return candidate[0];
  return scegliClasseRilevante(candidate, interpello.title) || candidate[0];
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

/**
 * Link dell'opportunità: usa SEMPRE il link diretto alla risorsa più specifica
 * (allegato/PDF o pagina ufficiale dell'interpello). Se assente o malformato →
 * pagina di dettaglio, quindi la dashboard. Mai link relativi/rotti.
 */
export function linkOpportunita(interpello: DettagliNotifica | null, dashboardUrl: string): string {
  if (!interpello) return dashboardUrl;
  const link = (interpello.link ?? '').trim();
  if (/^https?:\/\//i.test(link)) {
    try {
      new URL(link);
      return link;
    } catch {
      // link malformato → si prosegue con il fallback
    }
  }
  // Fallback: scheda INTERNA dell'avviso (`/interpello/<hash_id>`), rotta che
  // esiste davvero (prima il deep link finiva sul catch-all → HOME).
  if (interpello.id) return urlSchedaInterpello(baseUrl(dashboardUrl), interpello.id);
  return dashboardUrl;
}

/* --------------------------- Soggetti e copy --------------------------- */

const SUBJECT: Record<TipoMessaggio, string> = {
  welcome: 'Benvenuto in ScuoleRadar: il tuo mese di PRO è attivo',
  prova1: 'Abbiamo trovato una nuova opportunità per te',
  prova2: "Un'altra opportunità per te",
  prova3: 'Nuova opportunità per te',

  extra: 'Notifiche del piano gratuito in pausa: attiva PRO',
  recap: 'Ultimo avviso automatico del piano gratuito',
  welcome_pro: 'Benvenuto in ScuoleRadar PRO!',
  notifica_pro: 'Nuova opportunità trovata per te!',
  conferma_attivazione: '🎯 Scuole Radar: il tuo Radar è attivo e operativo!',
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
      'Il tuo account è attivo: benvenuto in ScuoleRadar!',
      'Per i primi 30 giorni hai il <strong>piano PRO gratuito</strong>: Radar Scuole con notifiche illimitate, Modulistica, Crea CV e Calcolatore CFU senza limiti.',
      'Quando vuoi sapere cosa succede di importante nella scuola, passa dal nostro Notiziario: controlliamo noi le fonti ufficiali per te.',
    ],
    cta: { label: 'Vai a ScuoleRadar →', destinazione: 'dashboard' },
  },
  prova1: {
    paragrafi: ['Abbiamo trovato una <strong>nuova opportunità</strong> per te.'],
    cta: { label: "Apri l'avviso ufficiale →", destinazione: 'opportunita' },  },
  prova2: {
    paragrafi: ['Abbiamo trovato una <strong>nuova opportunità</strong> per te.'],
    cta: { label: "Apri l'avviso ufficiale →", destinazione: 'opportunita' },  },
  prova3: {
    paragrafi: ['Abbiamo trovato una <strong>nuova opportunità</strong> per te.'],
    cta: { label: "Apri l'avviso ufficiale →", destinazione: 'opportunita' },  },
  extra: {
    paragrafi: [
      'Con il piano gratuito ricevi un numero limitato di segnalazioni.',
      'Con <strong>PRO</strong> ricevi ogni opportunità in tempo reale, senza limiti.',
    ],
    cta: { label: 'Attiva PRO →', destinazione: 'prezzi' },  },
  recap: {
    paragrafi: [
      'Da adesso non riceverai più notifiche automatiche.',
      'I tuoi dati e la Modulistica restano attivi: riattiva gli avvisi quando vuoi con <strong>PRO</strong>.',
    ],
    cta: { label: 'Attiva PRO →', destinazione: 'prezzi' },  },
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
      'Ti confermiamo che abbiamo attivato il tuo Radar con le impostazioni che hai scelto. Puoi cambiarle quando vuoi, andando sul tuo profilo su scuoleradar.it.',
      'Ora controlleremo noi per te sui canali ufficiali, quando ci saranno delle opportunità interessanti per te.',
      'Non inviamo spam, solo segnalazioni rilevanti, perciò, quando ricevi una nostra segnalazione, è importante aprirla ed eventualmente applicare al più presto.',
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
    paragrafi: ['Abbiamo trovato una <strong>nuova opportunità</strong> per te.'],
    cta: { label: "Apri l'avviso ufficiale →", destinazione: 'opportunita' },
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
    ctaHref =
      contenuto.cta.destinazione === 'prezzi'
        ? proUrl(dashboardUrl)
        : contenuto.cta.destinazione === 'dashboard'
          ? dashboardUrl
          : urlOpportunita;
    // Etichetta ONESTA: il bottone descrive DOVE porta il link. Mai "Candidati"
    // quando la destinazione è un Albo Pretorio o una pagina di avviso.
    ctaLabel =
      contenuto.cta.destinazione === 'opportunita'
        ? `${etichettaFonteLink(ctaHref)} →`
        : contenuto.cta.label;
  }

  // NOTA UX: il blocco opportunità contiene UN SOLO link di fonte (il bottone CTA
  // in fondo, con etichetta onesta). La riga duplicata "Fonte ufficiale verificata
  // (Albo Pretorio) — apri e candidati" è stata RIMOSSA: portava allo stesso URL
  // del bottone e prometteva una candidatura che il link non garantisce.
  const bloccoOpportunita =
    interpello && TIPI_CON_OPPORTUNITA.has(tipo)
      ? (() => {
          const classe = classeRilevante(interpello, destinatario);
          // Gerarchia STRETTA: obbligatorie (Provincia, Ordine, Classe/Materia) +
          // opzionali (Scuola) solo se presenti; la Scadenza ha una riga dedicata
          // e viene OMESSA se la fonte non la dichiara (nessun placeholder grezzo).
          const avviso = costruisciAvviso({
            provincia: interpello.province,
            classCode: classe,
            classCodes: interpello.classi,
            materia: interpello.materia,
            scadenza: interpello.scadenza,
            schoolName: interpello.schoolName,
            // Il titolo rende il LIVELLO coerente con la classe mostrata e lo
            // deduce quando la classe manca (nessun campo contraddittorio).
            titolo: interpello.title,
          });
          const dettagli: string[] = [];
          for (const r of avviso.obbligatorie) {
            if (r.etichetta === 'Scadenza') continue; // riga dedicata sotto
            dettagli.push(`${ICONA_RIGA[r.etichetta] ?? '•'} ${escapeHtml(r.valore)}`);
          }
          // NB: nessuna riga "🏷️ <categoria>" — metadato vuoto e ripetitivo.
          const scadenzaRiga = avviso.scadenzaValida
            ? `<p style="margin:8px 0 0; font-size:13px; color:#64748b;">📅 Scadenza: ${escapeHtml(formatDataScadenza(interpello.scadenza))}</p>`
            : '';
          return `
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 20px; border:1px solid #e2e8f0; border-radius:12px; background:#f8fafc;">
                  <tr>
                    <td style="padding:16px 20px;">
                      <h2 style="margin:0 0 8px; font-size:18px; font-weight:800; line-height:1.35; color:#14354e;"><b>${escapeHtml(pulisciTitoloAvviso(interpello.title, `Interpello ${[classe, interpello.province].filter(Boolean).join(' — ')}`))}</b></h2>
                      <p style="margin:0; font-size:14px; line-height:1.6; color:#475569;">${dettagli.join(' · ')}</p>
                      ${scadenzaRiga}
                      ${interpello.contactEmail ? `<p style="margin:8px 0 0; font-size:13px; color:#64748b;">📧 Candidature: <a href="mailto:${escapeHtml(interpello.contactEmail)}" style="color:#2B6F9E;">${escapeHtml(interpello.contactEmail)}</a></p>` : ''}
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
              <td align="center" style="padding-bottom:18px;">
                <img src="https://www.scuoleradar.it/logo.png" alt="ScuoleRadar" width="200"
                     style="display:block; width:200px; max-width:70%; height:auto; border:0; outline:none; text-decoration:none;" />
              </td>
            </tr>
            <!-- Card principale -->
            <tr>
              <td style="background-color:#ffffff; border-radius:16px; border:1px solid #d6eaf4; padding:32px 24px;" class="container">
                ${paragrafiHtml}

                ${bloccoOpportunita}

                ${ctaHtml}

                <p style="margin:20px 0 0; font-size:15px; line-height:1.6; color:#14354e;"><b>I tuoi colleghi di Scuole Radar</b></p>
                <p style="margin:10px 0 0; font-size:13px; line-height:1.5; color:#64748b;">P.S. 📌 Quando vuoi sapere cosa succede di importante, vieni qui: <a href="https://scuoleradar.it/notizie" style="color:#2B6F9E;">scuoleradar.it/notizie</a></p>

                <p style="margin:14px 0 0; font-size:12px; line-height:1.5; color:#94a3b8;">
                  ⚠️ Ti preghiamo di non rispondere a questo messaggio perché questa casella serve solo per inviare
                  le segnalazioni e non è monitorata.
                </p>

                <p style="margin:20px 0 0; font-size:12px; line-height:1.5; color:#94a3b8;">
                  ScuoleRadar.it — Interpelli, supplenze, incarichi, PNRR, PON, POR e opportunità per i docenti<br />
                  Se queste informazioni non corrispondono più a quello che ti serve,
                  <a href="https://www.scuoleradar.it/dashboard/radar" style="color:#2B6F9E;">modifica il radar qui</a>.
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
