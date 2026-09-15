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
import { SOGLIA_IMMINENTE, SOGLIA_VICINA, giorniRimanenti } from './scadenza';
import {
  EMAIL_ETICHETTA,
  EMAIL_ICONA,
  ICONA_RIGA,
  costruisciAvviso,
  etichettaFonteLink,
  pulisciTitoloAvviso,
  scegliClasseRilevante,
  suggerimentoRicercaAvviso,
  urlEsterna,
} from './alertInterpello';

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
 * Le 8 tipologie di messaggio del sistema (mese PRO gratuito + PRO):
 *  Email 1. welcome      — intake / conferma iscrizione (mese PRO gratuito attivo)
 *  Email 2. prova1       — notifica di opportunità (tipologia storica, copy neutra)
 *  Email 3. prova2       — notifica di opportunità (tipologia storica, copy neutra)
 *  Email 4. prova3       — notifica di opportunità (tipologia storica, copy neutra)
 *  Email 5. extra        — avviso: notifiche del piano gratuito in pausa
 *  Email 6. recap        — ultimo avviso automatico del piano gratuito
 *  PRO     welcome_pro   — conferma attivazione abbonamento PRO
 *  PRO     notifica_pro  — notifica standard per abbonati PRO
 *
 * NOTA: il servizio NON decrementa contatori di messaggi nel mese PRO gratuito.
 * I nomi `prova1/2/3` restano solo per compatibilità dei cron/DB.
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
  | 'free_forever_preavviso'
  /** Riepilogo giornaliero consolidato (una sola email con TUTTE le opportunità). */
  | 'digest_giornaliero';

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

/** URL assoluto della pagina prezzi per la CTA PRO. */
function proUrl(dashboardUrl: string): string {
  try {
    return new URL('/prezzi', dashboardUrl).toString();
  } catch {
    return 'https://scuoleradar.it/prezzi';
  }
}

/**
 * Link dell'opportunità: SOLO la fonte ESTERNA originale dell'istituzione
 * (allegato/PDF o pagina ufficiale dell'avviso).
 *
 * POLICY DI ROUTING: nessun fallback interno. Se l'avviso non ha una fonte
 * esterna valida, la funzione ritorna `''` e il template mostra il recapito
 * della scuola + la guida operativa, invece di rimandare a ScuoleRadar.
 */
export function linkOpportunita(interpello: DettagliNotifica | null): string {
  if (!interpello) return '';
  return urlEsterna(interpello.link) ?? '';
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
  // Il DIGEST usa un oggetto dinamico con il numero di opportunità
  // (`subjectDigest`): questa voce è il fallback statico della mappa.
  digest_giornaliero: 'ScuoleRadar — Oggi abbiamo trovato nuove opportunità per te',
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
  // Usato solo dal renderer di fallback: il digest reale viene composto da
  // `renderDigestEmailHtml` (una card per opportunità).
  digest_giornaliero: {
    paragrafi: ['Ecco il <strong>riepilogo delle opportunità</strong> di oggi per il tuo profilo.'],
    cta: { label: 'Apri il tuo Radar Scuole →', destinazione: 'dashboard' },
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

  // Link del bottone CTA.
  // POLICY DI ROUTING: il bottone di fonte punta SOLO all'URL esterno originale.
  // Se la fonte manca NON si ripiega su una pagina interna: il bottone porta al
  // proprio Radar (etichetta esplicita) e il blocco avviso espone email + guida.
  const urlOpportunita = linkOpportunita(interpello);
  let ctaHref = '';
  let ctaLabel = '';
  if (contenuto.cta) {
    const versoOpportunita = contenuto.cta.destinazione === 'opportunita';
    ctaHref =
      contenuto.cta.destinazione === 'prezzi'
        ? proUrl(dashboardUrl)
        : contenuto.cta.destinazione === 'dashboard'
          ? dashboardUrl
          : urlOpportunita || dashboardUrl;
    // Etichetta ONESTA: il bottone descrive DOVE porta il link. Mai "Candidati"
    // quando la destinazione è un Albo Pretorio o una pagina di avviso.
    ctaLabel = versoOpportunita
      ? urlOpportunita
        ? `${etichettaFonteLink(ctaHref)} →`
        : 'Apri il tuo Radar Scuole →'
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
            // L'email di candidatura è un ASSET del piano PRO: entra nell'avviso
            // strutturato e viene resa in OGNI email di opportunità (anche quando
            // il link è solo una pagina di riepilogo/"Stampa").
            email: interpello.contactEmail,
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
          // Recapito della scuola: riga dedicata, cliccabile e POSIZIONATA prima
          // del bottone CTA, così l'azione utile è immediata. Presente OGNI volta
          // che la pipeline ha estratto l'indirizzo.
          const emailRiga = avviso.email
            ? `<p style="margin:8px 0 0; font-size:13px; color:#64748b;">${EMAIL_ICONA} ${EMAIL_ETICHETTA}: <a href="mailto:${escapeHtml(avviso.email)}" style="color:#2B6F9E;font-weight:600;">${escapeHtml(avviso.email)}</a></p>`
            : '';
          // GUIDA OPERATIVA: se la destinazione è un elenco/tabella ("Stampa") o la
          // fonte ufficiale manca, spieghiamo come trovare la riga giusta e come
          // candidarsi. Mai un elenco lasciato senza istruzioni.
          const guida = suggerimentoRicercaAvviso({
            url: interpello.link,
            classe,
            provincia: interpello.province,
            schoolName: interpello.schoolName,
            email: avviso.email,
          });
          const guidaRiga = guida
            ? `<p style="margin:12px 0 0; padding:10px 12px; border-left:3px solid #f59e0b; background:#fffbeb; border-radius:6px; font-size:13px; line-height:1.55; color:#78350f;">ℹ️ ${escapeHtml(guida)}</p>`
            : '';
          return `
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 20px; border:1px solid #e2e8f0; border-radius:12px; background:#f8fafc;">
                  <tr>
                    <td style="padding:16px 20px;">
                      <h2 style="margin:0 0 8px; font-size:18px; font-weight:800; line-height:1.35; color:#14354e;"><b>${escapeHtml(pulisciTitoloAvviso(interpello.title, `Interpello ${[classe, interpello.province].filter(Boolean).join(' — ')}`))}</b></h2>
                      <p style="margin:0; font-size:14px; line-height:1.6; color:#475569;">${dettagli.join(' · ')}</p>
                      ${scadenzaRiga}
                      ${emailRiga}
                      ${guidaRiga}
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

/* ============================= DIGEST GIORNALIERO ============================== */
/**
 * RIEPILOGO GIORNALIERO consolidato: UNA sola email con TUTTE le opportunità del
 * giorno per l'utente. Sostituisce l'invio di un'email per ogni singolo avviso.
 *
 * Perché: un avviso per email significa fino a N messaggi al giorno — fatica da
 * notifica e rischio di disiscrizione. Il digest arriva una volta sola, alla
 * chiusura delle scuole (18:00), e riunisce tutto in un unico messaggio ordinato
 * per scadenza. Ogni voce mantiene la fonte ESTERNA originale, il recapito della
 * scuola e la guida operativa (pagine tabellari/"Stampa").
 */

/** Massimo di opportunità elencate nell'email: le altre restano nel Radar. */
export const MAX_VOCI_EMAIL_DIGEST = 12;

/**
 * Oggetto del digest — formula di prodotto:
 *   "ScuoleRadar — Oggi abbiamo trovato {N} opportunità per te"
 * Vale anche per N = 1 (`opportunità` è invariabile in italiano) e per N = 0.
 */
export function subjectDigest(numero: number): string {
  const n = Math.max(0, Math.trunc(numero));
  return `ScuoleRadar — Oggi abbiamo trovato ${n} opportunità per te`;
}

/** Valore di una riga dell'avviso strutturato (etichetta → valore). */
function valoreRigaDigest(righe: Array<{ etichetta: string; valore: string }>, etichetta: string): string {
  return righe.find((r) => r.etichetta === etichetta)?.valore ?? '';
}

/**
 * Blocco HTML di UNA voce del digest (numerata): titolo, dettagli essenziali,
 * scadenza, fonte ESTERNA (mai link interni), email della scuola e guida operativa
 * COMPATTA quando la pagina di destinazione è un elenco/"Stampa".
 *
 * Layout "crisp": card BIANCA con bordo tenue e accento laterale, titolo numerato.
 * Niente sfondi pieni ripetuti per ogni voce → il riepilogo resta leggibile e non
 * sembra una lista di riquadri.
 */
function bloccoVoceDigest(
  v: DettagliNotifica,
  destinatario: DestinatarioNotifica,
  numero: number,
): string {
  const classe = classeRilevante(v, destinatario);
  const avviso = costruisciAvviso({
    provincia: v.province,
    classCode: classe,
    classCodes: v.classi,
    materia: v.materia,
    scadenza: v.scadenza,
    schoolName: v.schoolName,
    email: v.contactEmail,
    titolo: v.title,
  });
  const titolo = escapeHtml(
    pulisciTitoloAvviso(v.title, `Interpello ${[classe, v.province].filter(Boolean).join(' — ')}`),
  );
  const classeMateria = valoreRigaDigest(avviso.obbligatorie, 'Classe / Materia');
  // Riga DETTAGLI compatta e senza ripetizioni: l'Ordine di scuola è già contenuto
  // nel nome ufficiale della classe ("… nell'istruzione secondaria di I e di II grado"),
  // quindi si mostra SOLO quando la classe manca (stessa regola dei post canale).
  const dettagli = avviso.obbligatorie
    .filter(
      (r) =>
        r.etichetta !== 'Scadenza' &&
        (r.etichetta !== 'Ordine di scuola' || !classeMateria),
    )
    .map((r) => `${ICONA_RIGA[r.etichetta] ?? '•'} ${escapeHtml(r.valore)}`)
    .join(' · ');

  const scadenzaRiga = avviso.scadenzaValida
    ? `<p style="margin:6px 0 0; font-size:13px; color:#475569;"><b>Scadenza:</b> ${escapeHtml(formatDataScadenza(v.scadenza))}</p>`
    : '';

  const fonte = urlEsterna(v.link);
  const fonteRiga = fonte
    ? `<p style="margin:6px 0 0; font-size:13px;"><a href="${escapeHtml(fonte)}" target="_blank" rel="noopener" style="color:#2B6F9E; font-weight:600; text-decoration:underline;">${escapeHtml(etichettaFonteLink(fonte))}</a></p>`
    : '';

  const emailRiga = avviso.email
    ? `<p style="margin:6px 0 0; font-size:13px; color:#475569;">${EMAIL_ICONA} ${EMAIL_ETICHETTA}: <a href="mailto:${escapeHtml(avviso.email)}" style="color:#2B6F9E; font-weight:600;">${escapeHtml(avviso.email)}</a></p>`
    : '';

  const guida = suggerimentoRicercaAvviso({
    url: v.link,
    classe,
    provincia: v.province,
    schoolName: v.schoolName,
    email: avviso.email,
    // Versione BREVE: nel digest il recapito è già sulla riga precedente.
    compatto: true,
  });
  const guidaRiga = guida
    ? `<p style="margin:10px 0 0; padding:8px 10px; border-left:3px solid #f59e0b; background:#fffbeb; border-radius:6px; font-size:12.5px; line-height:1.5; color:#78350f;">ℹ️ ${escapeHtml(guida)}</p>`
    : '';

  return `
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 10px; border:1px solid #eef2f7; border-left:3px solid #cfe3f2; border-radius:10px; background:#ffffff;">
                  <tr>
                    <td style="padding:13px 15px;">
                      <h3 style="margin:0 0 6px; font-size:15.5px; font-weight:800; line-height:1.35; color:#14354e;"><span style="color:#94a3b8; font-weight:700;">${numero}.</span> ${titolo}</h3>
                      <p style="margin:0; font-size:13px; line-height:1.55; color:#475569;">${dettagli}</p>
                      ${scadenzaRiga}
                      ${fonteRiga}
                      ${emailRiga}
                      ${guidaRiga}
                    </td>
                  </tr>
                </table>`;
}


/** Involucro HTML dell'email di digest (brand + card + firma + note legali). */
function involucroDigest(titolo: string, introHtml: string, elencoHtml: string, codaHtml: string): string {
  return `<!DOCTYPE html>
<html lang="it">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapeHtml(titolo)}</title>
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
            <tr>
              <td align="center" style="padding-bottom:18px;">
                <img src="https://www.scuoleradar.it/logo.png" alt="ScuoleRadar" width="200"
                     style="display:block; width:200px; max-width:70%; height:auto; border:0;" />
              </td>
            </tr>
            <tr>
              <td style="background-color:#ffffff; border-radius:16px; border:1px solid #d6eaf4; padding:32px 24px;" class="container">
                ${introHtml}
                ${elencoHtml}
                ${codaHtml}
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

/**
 * Gruppi di URGENZA del digest: stesse soglie del semaforo dell'app
 * (`scadenza.ts`). L'ordine è crescente per urgenza e MONOTONO rispetto
 * all'ordinamento per scadenza, quindi non "sparpaglia" le voci.
 */
const GRUPPI_DIGEST: Array<{ chiave: string; titolo: string }> = [
  { chiave: 'urgente', titolo: '🔴 Scadono entro 2 giorni' },
  { chiave: 'vicino', titolo: '🟡 Scadono entro una settimana' },
  { chiave: 'lungo', titolo: '🟢 Oltre una settimana' },
  { chiave: 'nd', titolo: '⚪ Scadenza non indicata' },
];

/** Gruppo di urgenza di una scadenza (`scaduto`/`oggi`/≤2 gg finiscono in cima). */
function chiaveGruppoDigest(scadenza?: string | null): string {
  const giorni = giorniRimanenti(scadenza);
  if (giorni === null) return 'nd';
  if (giorni <= SOGLIA_IMMINENTE) return 'urgente';
  if (giorni <= SOGLIA_VICINA) return 'vicino';
  return 'lungo';
}

/**
 * HTML dell'email di DIGEST: intro + voci NUMERATE, raggruppate per urgenza
 * quando i gruppi sono più di uno, + CTA verso il Radar. Nessun link interno.
 */
export function renderDigestEmailHtml(
  voci: DettagliNotifica[],
  destinatario: DestinatarioNotifica,
  dashboardUrl: string = DASHBOARD_URL,
  opts: { data?: string } = {},
): string {
  const elenco = voci.slice(0, MAX_VOCI_EMAIL_DIGEST);
  const restanti = Math.max(voci.length - elenco.length, 0);
  const saluto = destinatario.nome ? `Ciao ${escapeHtml(destinatario.nome)},` : 'Ciao,';
  const quando = opts.data ? ` del ${escapeHtml(opts.data)}` : '';
  const conteggio = voci.length === 1 ? 'una opportunità' : `${voci.length} opportunità`;

  // Raggruppamento per urgenza: le intestazioni compaiono SOLO se i gruppi sono
  // più di uno (con un solo gruppo sarebbero rumore).
  const gruppi = GRUPPI_DIGEST.map((g) => ({
    ...g,
    voci: elenco.filter((v) => chiaveGruppoDigest(v.scadenza) === g.chiave),
  })).filter((g) => g.voci.length > 0);
  const raggruppato = gruppi.length > 1;

  const introHtml =
    `<p style="margin:0 0 14px; font-size:15px; line-height:1.6; color:#14354e;">${saluto}</p>` +
    `<p style="margin:0 0 18px; font-size:15px; line-height:1.6; color:#14354e;">Ecco il <strong>riepilogo${quando}</strong>: ${conteggio} ${
      raggruppato ? 'raggruppate per urgenza di scadenza' : 'in ordine di scadenza'
    }. Una sola email, come promesso.</p>`;

  const blocchi: string[] = [];
  let numero = 0;
  for (const gruppo of gruppi) {
    if (raggruppato) {
      blocchi.push(
        `<p style="margin:${numero === 0 ? '0' : '20px'} 0 8px; font-size:11.5px; letter-spacing:.06em; text-transform:uppercase; font-weight:700; color:#64748b;">${gruppo.titolo} · ${gruppo.voci.length}</p>`,
      );
    }
    for (const v of gruppo.voci) {
      numero += 1;
      blocchi.push(bloccoVoceDigest(v, destinatario, numero));
    }
  }
  const elencoHtml = blocchi.join('\n');
  const ctaHtml = `
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:8px 0;">
                  <tr>
                    <td align="center">
                      <a href="${escapeHtml(dashboardUrl)}" class="cta" target="_blank" rel="noopener"
                         style="display:inline-block; padding:14px 32px; border-radius:12px; background-color:#2B6F9E; color:#ffffff; font-size:15px; font-weight:700; text-decoration:none;">
                        Apri il tuo Radar Scuole →
                      </a>
                    </td>
                  </tr>
                </table>`;
  const codaHtml =
    (restanti > 0
      ? `<p style="margin:16px 0 0; font-size:13px; line-height:1.5; color:#475569;">Nel tuo Radar ci sono altre <strong>${restanti}</strong> opportunità oltre a quelle elencate qui.</p>`
      : '') +
    ctaHtml +
    `<p style="margin:20px 0 0; font-size:15px; line-height:1.6; color:#14354e;"><b>I tuoi colleghi di Scuole Radar</b></p>` +
    `<p style="margin:10px 0 0; font-size:13px; line-height:1.5; color:#64748b;">P.S. Le opportunità arrivano <b>una volta al giorno</b>, dopo la chiusura delle scuole: un unico riepilogo, mai un flusso di messaggi.</p>` +
    `<p style="margin:14px 0 0; font-size:12px; line-height:1.5; color:#94a3b8;">⚠️ Ti preghiamo di non rispondere a questo messaggio perché questa casella serve solo per inviare le segnalazioni e non è monitorata.</p>` +
    `<p style="margin:20px 0 0; font-size:12px; line-height:1.5; color:#94a3b8;">ScuoleRadar.it — Interpelli, supplenze, incarichi, PNRR, PON, POR e opportunità per i docenti<br />Se queste informazioni non corrispondono più a quello che ti serve, <a href="https://www.scuoleradar.it/dashboard/radar" style="color:#2B6F9E;">modifica il radar qui</a>.</p>`;
  return involucroDigest(subjectDigest(voci.length), introHtml, elencoHtml, codaHtml);
}

/**
 * Invia UN'email di digest a un destinatario. `voci` vuoto → nessun invio.
 * Stesso contratto di `inviaNotificaEmail` (esito + errore, mai eccezioni).
 */
export async function inviaDigestEmail(
  client: Resend | null,
  voci: DettagliNotifica[],
  destinatario: DestinatarioNotifica,
  opts: { dryRun?: boolean; dashboardUrl?: string; data?: string } = {},
): Promise<{ inviata: boolean; error?: string }> {
  if (!client) return { inviata: false, error: 'Client Resend non configurato' };
  if (voci.length === 0) return { inviata: false, error: 'nessuna opportunità da inviare' };

  const { dryRun = false, dashboardUrl = DASHBOARD_URL, data } = opts;
  const subject = subjectDigest(voci.length);
  const html = renderDigestEmailHtml(voci, destinatario, dashboardUrl, { data });

  if (dryRun) {
    console.log(`  ✉ [DRY-RUN] DIGEST → ${destinatario.email} | ${subject} (${voci.length} voci)`);
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
      console.warn(`  ✗ Digest a ${destinatario.email} fallito: ${error.message}`);
      return { inviata: false, error: error.message };
    }
    console.log(`  ✓ Digest inviato a ${destinatario.email} (${voci.length} opportunità)`);
    return { inviata: true };
  } catch (err) {
    const messaggio = (err as Error).message ?? 'Errore sconosciuto';
    console.warn(`  ✗ Digest a ${destinatario.email} fallito (eccezione): ${messaggio}`);
    return { inviata: false, error: messaggio };
  }
}

