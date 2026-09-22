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
import { SOGLIA_IMMINENTE, SOGLIA_VICINA, eInterpelloAttivo, giorniRimanenti } from './scadenza';
import { province as provinceData } from '../data/province';
import { gateEmail } from '../config/gateNotifiche';
import {
  BRAND_NOME,
  EMAIL_ETICHETTA,
  EMAIL_ICONA,
  ETICHETTA_AVVISO_UFFICIALE,
  ICONA_RIGA,
  URL_NOTIZIE,
  costruisciAvviso,
  eUrlAvvisoDiretto,
  pulisciTitoloAvviso,
  scegliClasseRilevante,
} from './alertInterpello';
import { normalizzaClasse } from './matchingEngine';

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

/** Nome esteso della provincia quando arriva il solo codice (es. "TO" → "Torino"). */
function nomeProvincia(codice?: string | null): string | null {
  const p = (codice ?? '').trim().toUpperCase();
  if (!p) return null;
  return provinceData.find((x) => x.codice === p)?.nome ?? null;
}

/* ------------------------- Brand e CTA informative ------------------------- */

/** URL del logo ufficiale: unico asset grafico delle email. */
export const LOGO_URL = 'https://www.scuoleradar.it/logo.png';

/**
 * INTESTAZIONE BRAND COMPATTA: logo PICCOLO (32 px, mai allargato oltre la sua
 * dimensione naturale) accanto al nome ufficiale `Scuole Radar.it`, sulla stessa
 * riga. Sostituisce il vecchio logo da 200 px che dominava l'email e risultava
 * "gigante"/deformato sugli schermi piccoli.
 */
export function intestazioneBrandHtml(): string {
  return `
                <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto 18px;">
                  <tr>
                    <td style="vertical-align:middle; padding-right:8px;">
                      <img src="${LOGO_URL}" alt="Scuole Radar" width="32" height="32"
                           style="display:block; width:32px; height:32px; border:0; outline:none; text-decoration:none;" />
                    </td>
                    <td style="vertical-align:middle; font-size:15px; font-weight:700; color:#14354e;">
                      ${BRAND_NOME}
                    </td>
                  </tr>
                </table>`;
}

/**
 * URL della sezione Notizie mostrato all'utente: formato breve e verificabile
 * richiesto dal prodotto (`scuoleradar.it/notizie`). L'`href` resta assoluto.
 */
export const URL_NOTIZIE_VISIBILE = 'scuoleradar.it/notizie';

/** Seconda riga della CTA Notizie nelle EMAIL (testo esatto richiesto). */
export const CTA_NOTIZIE_TESTO_EMAIL =
  'Quando vuoi sapere cosa succede di importante nella scuola vieni qui!';

/** Avviso di casella non monitorata: è l'ULTIMA riga di ogni email. */
export const TESTO_NON_RISPOSTA =
  'Ti preghiamo di non rispondere a questo messaggio perché questa casella serve solo per inviare le segnalazioni e non è monitorata.';

/**
 * CTA Notizie delle EMAIL — ESATTAMENTE due righe:
 *
 *   scuoleradar.it/notizie
 *   Quando vuoi sapere cosa succede di importante nella scuola vieni qui!
 *
 * Tipografia CRISP (14 px, blu brand, link sottolineato e cliccabile): niente
 * testo sbiadito che sembra una trappola di disiscrizione.
 */
export function ctaNotizieHtml(): string {
  return (
    `<p style="margin:6px 0 0; font-size:14px; line-height:1.5; font-weight:600;">` +
    `<a href="${URL_NOTIZIE}" style="color:#2B6F9E; text-decoration:underline;">${URL_NOTIZIE_VISIBILE}</a></p>` +
    `<p style="margin:2px 0 0; font-size:14px; line-height:1.5; color:#14354e;">${CTA_NOTIZIE_TESTO_EMAIL}</p>`
  );
}

/**
 * FOOTER UNICO delle email (alert, digest e promemoria), in quest'ordine:
 *   1. firma del team;
 *   2. CTA Notizie (due righe esatte);
 *   3. link per MODIFICARE IL RADAR — in PICCOLO (12.5 px), visibile e con URL in
 *      chiaro: non è la CTA del messaggio (la CTA è il link ufficiale di ogni voce);
 *   4. riga di brand (servizi);
 *   5. avviso di casella non monitorata — SEMPRE per ULTIMO.
 *
 * Nessun blocco "P.S.", nessun testo grigio chiaro (`#94a3b8`) che sembri una
 * nota legale nascosta: colori leggibili (`#14354e` / `#475569`) e link espliciti.
 */
export function footerEmailHtml(dashboardUrl: string = DASHBOARD_URL): string {
  const radarUrl = dashboardUrl || DASHBOARD_URL;
  return (
    `<p style="margin:22px 0 0; font-size:15px; line-height:1.6; color:#14354e;"><b>I tuoi colleghi di Scuole Radar</b></p>` +
    ctaNotizieHtml() +
    `<p style="margin:14px 0 0; font-size:12.5px; line-height:1.55; color:#475569;">` +
    `Se questi risultati non corrispondono più ai tuoi interessi, modifica il tuo radar su ` +
    `<a href="${radarUrl}" style="color:#2B6F9E; font-weight:600; text-decoration:underline;">${radarUrl}</a></p>` +
    `<p style="margin:16px 0 0; font-size:13px; line-height:1.6; color:#475569;">` +
    `ScuoleRadar.it — Interpelli, supplenze, incarichi, PNRR, PON, POR e opportunità per i docenti</p>` +
    `<p style="margin:16px 0 0; padding-top:12px; border-top:1px solid #d6eaf4; font-size:13px; line-height:1.6; color:#475569;">` +
    `${TESTO_NON_RISPOSTA}</p>`
  );
}

/**
 * Sceglie la classe di concorso più rilevante per il DESTINATARIO (intersezione
 * con le sue classi) e, tra le candidate, quella COERENTE con il titolo
 * (`scegliClasseRilevante`): evita alert con "Scuola Primaria" e un titolo della
 * secondaria, e mantiene Ordine di scuola ↔ Classe/Materia sempre allineati.
 *
 * Il confronto è NORMALIZZATO (`A-026` ≡ `A-26` ≡ `A042`), come nel Matching
 * Engine: senza questa canonicalizzazione un'opportunità scritta `A-022` non
 * veniva riconosciuta come "propria" da un profilo con classe `A-22` e la
 * notifica mostrava la classe sbagliata.
 */
export function classeRilevante(
  interpello: DettagliNotifica,
  destinatario: DestinatarioNotifica,
): string {
  const classi = interpello.classi ?? [];
  if (classi.length === 0) return '';
  const classiProfilo = new Set((destinatario.classi ?? []).map(normalizzaClasse));
  const comuni = classi.filter((c) => classiProfilo.has(normalizzaClasse(c)));
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
 * (allegato/PDF o pagina ufficiale dell'avviso), e SOLO se è un avviso
 * SPECIFICO (`eUrlAvvisoDiretto`).
 *
 * POLICY DI ROUTING (STRICT): mai home di ente, elenchi, pagine di
 * ricerca/archivio o URL della piattaforma. Se l'avviso non ha una fonte
 * diretta valida, la funzione ritorna `''`: il template mostra il recapito
 * della scuola + la guida operativa, invece di spacciare un archivio per
 * "avviso ufficiale".
 */
export function linkOpportunita(interpello: DettagliNotifica | null): string {
  if (!interpello) return '';
  return eUrlAvvisoDiretto(interpello.link) ? (interpello.link ?? '').trim() : '';
}

/**
 * Riga "IN EVIDENZA" del link ufficiale dell'avviso — unica resa per alert,
 * digest e promemoria.
 *
 * Mostra l'URL ESATTO dell'annuncio/bando pubblicato dalla scuola (dato dello
 * scraper) dentro una scatola blu brand, con il link in grassetto: è l'azione
 * principale del messaggio. Sostituisce il vecchio riquadro GIALLO di avvertenza
 * (checklist email §4: «zero riquadri/disclaimer gialli») e le diciture
 * restrittive del tipo «nel link la scuola pubblica un elenco…».
 *
 * Mostra SOLO avvisi SPECIFICI (`eUrlAvvisoDiretto`: pagina/PDF/tabella «Stampa»
 * del singolo avviso), con l'etichetta UNICA e standard
 * (`👉 Apri l'avviso ufficiale`). Quando la fonte è una home, un elenco, un archivio
 * o un URL interno la riga NON compare: la checklist vieta di sostituirla con un
 * link generico (e il gate di qualità blocca comunque l'invio). Mai «Candidati».
 */
export function fonteInEvidenza(url?: string | null): string {
  const diretta = eUrlAvvisoDiretto(url) ? (url ?? '').trim() : '';
  if (!diretta) return '';
  return `<p style="margin:12px 0 0; padding:10px 12px; border:1px solid #cfe3f2; background:#f2f9fd; border-radius:8px; font-size:13.5px; line-height:1.5;"><a href="${escapeHtml(diretta)}" target="_blank" rel="noopener" style="color:#2B6F9E; font-weight:700; text-decoration:underline;">${escapeHtml(ETICHETTA_AVVISO_UFFICIALE)}</a></p>`;
}

/**
 * Voci del digest EFFETTIVAMENTE INVIABILI: solo le opportunità ANCORA ATTIVE
 * (scadenza non passata; senza scadenza = attiva) con un link diretto valido.
 * Il digest giornaliero deve contenere SOLO ciò che l'utente può ancora usare.
 */
export function vociAttive(
  voci: DettagliNotifica[],
  oggi: Date = new Date(),
): DettagliNotifica[] {
  return (voci ?? []).filter((v) => eInterpelloAttivo(v.scadenza, oggi));
}

/* --------------------------- Soggetti e copy --------------------------- */

/** Nome di brand usato negli OGGETTI delle email (unico, con lo spazio). */
export const BRAND_OGGETTO = 'Scuole Radar';

/**
 * OGGETTO UNICO delle email di OPPORTUNITÀ (digest giornaliero e avvisi di
 * opportunità): testo standard richiesto dal prodotto, identico per ogni utente
 * e per ogni invio — `Nuove opportunità per te!`.
 *
 * Nota: gli oggetti dei messaggi di CICLO DI VITA (benvenuto, prova PRO,
 * avvisi di quota, rinnovo) restano specifici e descrittivi.
 */
export const OGGETTO_OPPORTUNITA = 'Nuove opportunità per te!';

/**
 * Oggetti STATICI di fallback (usati solo quando il messaggio non ha contesto:
 * messaggi transazionali, avvisi di quota, ecc.). Gli oggetti delle opportunità
 * sono COSTRUITI con il contesto reale (classe + provincia) da
 * `subjectOpportunita`: mai un oggetto generico "da supermercato".
 */
const SUBJECT: Record<TipoMessaggio, string> = {
  welcome: `${BRAND_OGGETTO} — Benvenuto: il tuo mese di PRO è attivo`,
  // OGGETTO STANDARD delle opportunità (uguale per prova1/2/3 e notifica_pro):
  // un unico testo, riconoscibile a colpo d'occhio nella casella di posta.
  prova1: OGGETTO_OPPORTUNITA,
  prova2: OGGETTO_OPPORTUNITA,
  prova3: OGGETTO_OPPORTUNITA,

  extra: `${BRAND_OGGETTO} — Notifiche del piano gratuito in pausa: attiva PRO`,
  recap: `${BRAND_OGGETTO} — Ultimo avviso automatico del piano gratuito`,
  welcome_pro: `${BRAND_OGGETTO} — Benvenuto in PRO!`,
  notifica_pro: OGGETTO_OPPORTUNITA,
  conferma_attivazione: `${BRAND_OGGETTO} — Il tuo Radar è attivo e operativo`,
  free_forever_preavviso: `${BRAND_OGGETTO} — Piano PRO Free Forever: rinnovo automatico`,
  // Il DIGEST usa lo stesso oggetto standard delle opportunità (`subjectDigest`).
  digest_giornaliero: OGGETTO_OPPORTUNITA,
};

export function subjectNotifica(tipo: TipoMessaggio): string {
  return SUBJECT[tipo];
}

/** Contesto (classe/provincia) usato per rendere gli oggetti SPECIFICI. */
export interface ContestoOggetto {
  /** Classe di concorso mostrata nell'avviso (es. `A-22`). */
  classe?: string | null;
  /** Provincia dell'avviso: codice (`TO`) o nome (`Torino`). */
  provincia?: string | null;
}

/** `A-22 (Torino)` · `A-22` · `Torino` · `''` (nessun contesto disponibile). */
export function contestoOggetto(dati: ContestoOggetto = {}): string {
  const classe = (dati.classe ?? '').trim();
  const provincia = (dati.provincia ?? '').trim();
  if (classe && provincia) return `${classe} (${provincia})`;
  return classe || provincia || '';
}

/**
 * OGGETTO delle email di opportunità: TESTO UNICO E STANDARD
 * (`Nuove opportunità per te!`) per ogni utente e per ogni opportunità.
 * Il contesto (classe/provincia) resta nel CORPO del messaggio, non nell'oggetto.
 */
export function subjectOpportunita(dati: ContestoOggetto = {}): string {
  // Il contesto (classe · provincia) NON entra più nell'oggetto: il testo è
  // unico e standard. Il parametro resta per compatibilità con i chiamanti.
  void dati;
  return OGGETTO_OPPORTUNITA;
}

/**
 * Oggetto delle email di opportunità a partire dalla tipologia + opportunità:
 * mantiene i messaggi transazionali sui loro oggetti e usa l'oggetto STANDARD
 * (`Nuove opportunità per te!`) per `prova1/2/3` e `notifica_pro`.
 */
export function subjectPerNotifica(
  tipo: TipoMessaggio,
  dati: ContestoOggetto = {},
): string {
  return TIPI_CON_OPPORTUNITA.has(tipo) ? subjectOpportunita(dati) : SUBJECT[tipo];
}

/**
 * OGGETTO del promemoria 24h (scadenza vicina): UNA sola email con TUTTE le
 * opportunità in scadenza, mai una email per avviso.
 */
export function subjectPromemoria(voci: ContestoOggetto[] = []): string {
  const n = voci.length;
  if (n === 0) return `${BRAND_OGGETTO} — Promemoria: opportunità in scadenza`;
  if (n === 1) {
    const contesto = contestoOggetto(voci[0]);
    return contesto
      ? `${BRAND_OGGETTO} — Scadenza vicina: ${contesto}`
      : `${BRAND_OGGETTO} — Scadenza vicina per un'opportunità del tuo profilo`;
  }
  return `${BRAND_OGGETTO} — Scadenza vicina: ${n} opportunità per il tuo profilo`;
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
  // BENVENUTO (post-registrazione): attivazione IMMEDIATA del mese di PRO in
  // omaggio + vantaggi già disponibili. Mai il vecchio modello "account Base" o
  // la quota di segnalazioni.
  welcome: {
    paragrafi: [
      'Il tuo account è attivo: benvenuto in ScuoleRadar!',
      'Il tuo <strong>mese di PRO in omaggio</strong> è già attivo: da questo momento hai tutto disponibile, senza restrizioni.',
      'Radar Scuole con notifiche illimitate, Modulistica scolastica, Crea CV e Calcolatore CFU: indica provincia e classi di concorso e da lì cerchiamo noi le opportunità per te, ogni giorno.',
    ],
    cta: { label: 'Vai a ScuoleRadar →', destinazione: 'dashboard' },
  },
  // Alert di opportunità: NESSUNA frase generica di apertura. Il contenuto è la
  // card dell'avviso (titolo + dettagli + fonte + recapito) e il bottone standard
  // "👉 Apri l'avviso ufficiale": struttura identica per prova1/2/3 e notifica_pro.
  prova1: {
    paragrafi: [],
    cta: { label: ETICHETTA_AVVISO_UFFICIALE, destinazione: 'opportunita' },
  },
  prova2: {
    paragrafi: [],
    cta: { label: ETICHETTA_AVVISO_UFFICIALE, destinazione: 'opportunita' },
  },
  prova3: {
    paragrafi: [],
    cta: { label: ETICHETTA_AVVISO_UFFICIALE, destinazione: 'opportunita' },
  },
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
      'Tu non devi passare ore a cercarle: quando troviamo qualcosa che corrisponde al tuo profilo, te lo segnaliamo.',
      'E hai accesso a tutti i servizi PRO di ScuoleRadar: CV, calcolo CFU, modulistica, Pure Focus e gli altri strumenti che stiamo sviluppando per chi lavora nella scuola.',
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
    paragrafi: [],
    cta: { label: ETICHETTA_AVVISO_UFFICIALE, destinazione: 'opportunita' },
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
    // Etichetta STANDARD del link di fonte: UNA sola stringa in ogni superficie
    // ("👉 Apri l'avviso ufficiale"), identica a Telegram. Mai "Candidati": il
    // link porta a un Albo Pretorio o a una pagina di avviso, non a un form.
    ctaLabel = versoOpportunita
      ? urlOpportunita
        ? ETICHETTA_AVVISO_UFFICIALE
        : 'Apri il tuo Radar Scuole →'
      : contenuto.cta.label;
  }

  // NOTA UX: il blocco opportunità mostra il link ufficiale IN EVIDENZA (scatola
  // blu brand, URL esatto dallo scraper) e il bottone CTA primario punta allo
  // STESSO URL con l'etichetta standard. Nessun riquadro giallo e nessuna dicitura
  // restrittiva sull'elenco: l'azione utile è il link stesso.
  const bloccoOpportunita =
    interpello && TIPI_CON_OPPORTUNITA.has(tipo)
      ? (() => {
          const classe = classeRilevante(interpello, destinatario);
          // Provincia: NOME esteso (stessa resa di Telegram), non il codice grezzo.
          const provinciaAvviso = nomeProvincia(interpello.province) ?? interpello.province;
          // Gerarchia STRETTA: obbligatorie (Provincia, Ordine, Classe/Materia) +
          // opzionali (Scuola) solo se presenti; la Scadenza ha una riga dedicata
          // e viene OMESSA se la fonte non la dichiara (nessun placeholder grezzo).
          const avviso = costruisciAvviso({
            provincia: provinciaAvviso,
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
          // LINK UFFICIALE IN EVIDENZA: l'annuncio/bando pubblicato dalla scuola
          // (URL dello scraper) dentro la scatola blu brand, con etichetta standard
          // o onesta. Nessun riquadro giallo e nessuna istruzione restrittiva
          // sull'elenco: l'azione utile è il link stesso (checklist email §4/§5).
          const fonteRiga = fonteInEvidenza(interpello.link);
          return `
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 20px; border:1px solid #e2e8f0; border-radius:12px; background:#f8fafc;">
                  <tr>
                    <td style="padding:16px 20px;">
                      <h2 style="margin:0 0 8px; font-size:18px; font-weight:800; line-height:1.35; color:#14354e;"><b>${escapeHtml(pulisciTitoloAvviso(interpello.title, `Interpello ${[classe, interpello.province].filter(Boolean).join(' — ')}`))}</b></h2>
                      <p style="margin:0; font-size:14px; line-height:1.6; color:#475569;">${dettagli.join(' · ')}</p>
                      ${scadenzaRiga}
                      ${fonteRiga}
                      ${emailRiga}
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
            <!-- Header brand: logo PICCOLO + nome ufficiale su una riga -->
            <tr>
              <td align="center">
                ${intestazioneBrandHtml()}
              </td>
            </tr>
            <!-- Card principale -->
            <tr>
              <td style="background-color:#ffffff; border-radius:16px; border:1px solid #d6eaf4; padding:32px 24px;" class="container">
                ${paragrafiHtml}

                ${bloccoOpportunita}

                ${ctaHtml}

                ${footerEmailHtml(dashboardUrl)}
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
 * GATE FEATURE FLAGS — unica porta d'ingresso delle email AUTOMATICHE.
 *
 * Applica lo stato del dipartimento Radar (`src/config/features.ts`) al recapito:
 *   · `on`   → invio invariato;
 *   · `test` → il messaggio parte SOLO verso l'account di test dell'admin
 *              (dirottato) — mai a utenti o beta tester;
 *   · `off`  → invio bloccato.
 *
 * Ritorna `null` quando l'invio va fermato; il motivo è loggato dal gate.
 */
function recapitoEmailAmmesso(destinatario: DestinatarioNotifica): DestinatarioNotifica | null {
  const esito = gateEmail('radar', destinatario.email);
  if (!esito.consentito || !esito.recapito) return null;
  if (esito.recapito === destinatario.email) return destinatario;
  return { ...destinatario, email: esito.recapito };
}

/**
 * Invia un'email di una delle 8 tipologie a un singolo destinatario.
 * - `interpello` può essere null per i messaggi transazionali (welcome, recap, welcome_pro).
 * - L'esito include l'eventuale errore restituito dall'API Resend.
 * - L'OGGETTO è specifico: per le opportunità include classe e provincia
 *   (`subjectPerNotifica` → "Scuole Radar — Nuova opportunità per A-22 (Torino)").
 */
export async function inviaNotificaEmail(
  client: Resend | null,
  interpello: DettagliNotifica | null,
  destinatario: DestinatarioNotifica,
  opts: { dryRun?: boolean; dashboardUrl?: string; tipo?: TipoMessaggio } = {},
): Promise<{ inviata: boolean; error?: string }> {
  if (!client) return { inviata: false, error: 'Client Resend non configurato' };
  // Gate dipartimenti (stato `test`/`off`) PRIMA di comporre e spedire.
  const dest = recapitoEmailAmmesso(destinatario);
  if (!dest) return { inviata: false, error: 'Invio email sospeso dal gate dipartimenti' };

  const { dryRun = false, dashboardUrl = DASHBOARD_URL, tipo = 'welcome' } = opts;
  const subject = subjectPerNotifica(
    tipo,
    interpello
      ? {
          classe: classeRilevante(interpello, dest),
          provincia: nomeProvincia(interpello.province) ?? interpello.province,
        }
      : {},
  );
  const html = renderEmailHtml(interpello, dest, dashboardUrl, tipo);

  if (dryRun) {
    console.log(`  ✉ [DRY-RUN] → ${dest.email} | ${subject}`);
    return { inviata: true };
  }

  try {
    const { error } = await client.emails.send({
      from: RESEND_FROM_EMAIL,
      to: [dest.email],
      subject,
      html,
      tags: RESEND_TAGS,
    });

    if (error) {
      console.warn(`  ✗ Invio email a ${dest.email} fallito: ${error.message}`);
      return { inviata: false, error: error.message };
    }
    console.log(`  ✓ Email inviata a ${dest.email}`);
    return { inviata: true };
  } catch (err) {
    // Un'eccezione (rete, timeout, rate-limit) NON deve silenziosamente
    // perdere l'email: viene loggata e riportata al notifier per il conteggio.
    const messaggio = (err as Error).message ?? 'Errore sconosciuto';
    console.warn(`  ✗ Invio email a ${dest.email} fallito (eccezione): ${messaggio}`);
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
 * Oggetto del digest giornaliero: OGGETTO STANDARD E UNICO
 * (`Nuove opportunità per te!`). Il numero di opportunità è nel CORPO, dove
 * serve davvero; l'oggetto resta identico per ogni invio.
 */
export function subjectDigest(numero: number): string {
  // Il numero di opportunità è nel CORPO dell'email, non nell'oggetto (unico e
  // standard). Il parametro resta per compatibilità con i chiamanti.
  void numero;
  return OGGETTO_OPPORTUNITA;
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
  // Provincia: NOME esteso (stessa resa di Telegram), non il codice grezzo.
  const provinciaVoce = nomeProvincia(v.province) ?? v.province;
  const avviso = costruisciAvviso({
    provincia: provinciaVoce,
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

  // Link ufficiale in evidenza: STESSA resa dell'alert (scatola blu brand) e
  // nessun riquadro giallo di istruzioni. Se la fonte è una pagina di riepilogo
  // l'etichetta resta onesta (`etichettaFonteLink`).
  const fonteRiga = fonteInEvidenza(v.link);

  const emailRiga = avviso.email
    ? `<p style="margin:6px 0 0; font-size:13px; color:#475569;">${EMAIL_ICONA} ${EMAIL_ETICHETTA}: <a href="mailto:${escapeHtml(avviso.email)}" style="color:#2B6F9E; font-weight:600;">${escapeHtml(avviso.email)}</a></p>`
    : '';

  return `
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 10px; border:1px solid #eef2f7; border-left:3px solid #cfe3f2; border-radius:10px; background:#ffffff;">
                  <tr>
                    <td style="padding:13px 15px;">
                      <h3 style="margin:0 0 6px; font-size:15.5px; font-weight:800; line-height:1.35; color:#14354e;"><span style="color:#475569; font-weight:700;">${numero}.</span> ${titolo}</h3>
                      <p style="margin:0; font-size:13px; line-height:1.55; color:#475569;">${dettagli}</p>
                      ${scadenzaRiga}
                      ${fonteRiga}
                      ${emailRiga}
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
      }
    </style>
  </head>
  <body style="margin:0; padding:0; background-color:#f1f5f9; font-family:Inter, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f1f5f9; padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px; width:100%;">
            <tr>
              <td align="center">
                ${intestazioneBrandHtml()}
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
  opts: { data?: string; oggetto?: string } = {},
): string {
  // SOLO opportunità ATTIVE: il digest non deve contenere avvisi scaduti.
  const attive = vociAttive(voci);
  const elenco = attive.slice(0, MAX_VOCI_EMAIL_DIGEST);
  const restanti = Math.max(attive.length - elenco.length, 0);
  const saluto = destinatario.nome ? `Ciao ${escapeHtml(destinatario.nome)},` : 'Ciao,';
  const quando = opts.data ? ` del ${escapeHtml(opts.data)}` : '';
  const conteggio = attive.length === 1 ? 'una opportunità' : `${attive.length} opportunità`;

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
  // NIENTE bottone gigante verso il Radar: la CTA primaria è il LINK UFFICIALE di
  // ogni voce (in evidenza nella card). Il link per modificare le preferenze del
  // Radar resta nel FOOTER, in piccolo (`footerEmailHtml`).
  const codaHtml =
    (restanti > 0
      ? `<p style="margin:16px 0 0; font-size:13px; line-height:1.5; color:#475569;">Nel tuo Radar ci sono altre <strong>${restanti}</strong> opportunità oltre a quelle elencate qui.</p>`
      : '') + footerEmailHtml(dashboardUrl);
  return involucroDigest(opts.oggetto?.trim() || subjectDigest(attive.length), introHtml, elencoHtml, codaHtml);
}

/**
 * Invia UN'email di digest a un destinatario. `voci` vuoto → nessun invio.
 * Stesso contratto di `inviaNotificaEmail` (esito + errore, mai eccezioni).
 */
export async function inviaDigestEmail(
  client: Resend | null,
  voci: DettagliNotifica[],
  destinatario: DestinatarioNotifica,
  opts: { dryRun?: boolean; dashboardUrl?: string; data?: string; oggetto?: string } = {},
): Promise<{ inviata: boolean; error?: string }> {
  if (!client) return { inviata: false, error: 'Client Resend non configurato' };
  if (voci.length === 0) return { inviata: false, error: 'nessuna opportunità da inviare' };
  // GATE FEATURE FLAGS: in stato `test` il digest va all'account di test, in `off` si ferma.
  const dest = recapitoEmailAmmesso(destinatario);
  if (!dest) return { inviata: false, error: 'Invio digest sospeso dal gate dipartimenti' };
  // UNA email al giorno con SOLO le opportunità ancora ATTIVE (mai gli scaduti).
  const attive = vociAttive(voci);
  if (attive.length === 0) {
    return { inviata: false, error: 'nessuna opportunità attiva da inviare' };
  }

  const { dryRun = false, dashboardUrl = DASHBOARD_URL, data, oggetto } = opts;
  // Oggetto: override dal pannello Admin (il notifier lo passa solo se il
  // catalogo lo consente: l'oggetto standard delle opportunità è vincolato).
  const subject = oggetto?.trim() || subjectDigest(attive.length);
  const html = renderDigestEmailHtml(attive, dest, dashboardUrl, { data, oggetto });

  if (dryRun) {
    console.log(`  ✉ [DRY-RUN] DIGEST → ${dest.email} | ${subject} (${voci.length} voci)`);
    return { inviata: true };
  }

  try {
    const { error } = await client.emails.send({
      from: RESEND_FROM_EMAIL,
      to: [dest.email],
      subject,
      html,
      tags: RESEND_TAGS,
    });
    if (error) {
      console.warn(`  ✗ Digest a ${dest.email} fallito: ${error.message}`);
      return { inviata: false, error: error.message };
    }
    console.log(`  ✓ Digest inviato a ${dest.email} (${voci.length} opportunità)`);
    return { inviata: true };
  } catch (err) {
    const messaggio = (err as Error).message ?? 'Errore sconosciuto';
    console.warn(`  ✗ Digest a ${dest.email} fallito (eccezione): ${messaggio}`);
    return { inviata: false, error: messaggio };
  }
}



/* ========================= PROMEMORIA 24h (scadenza vicina) ========================= */
/**
 * PROMEMORIA — UNA sola email per utente e UN SOLO promemoria per interpello.
 *
 * Quando: l'opportunità è stata consegnata (digest) da almeno 24 ore, non è
 * ancora scaduta e la scadenza è ormai VICINA (alta priorità). L'apertura della
 * mail non è tracciabile in modo lecito: la regola è quindi "alta priorità +
 * 24h", con guardia anti-duplicato per coppia (utente, interpello) — `promemoria.ts`.
 *
 * Anti-spam: le voci vengono riunite in UN solo messaggio (mai una email per
 * avviso) e ogni voce entra nel ledger con canale `promemoria`.
 */
export function renderPromemoriaEmailHtml(
  voci: DettagliNotifica[],
  destinatario: DestinatarioNotifica,
  dashboardUrl: string = DASHBOARD_URL,
  opts: { giorni?: number; oggetto?: string } = {},
): string {
  const saluto = destinatario.nome ? `Ciao ${escapeHtml(destinatario.nome)},` : 'Ciao,';
  const giorni = Math.max(1, Math.trunc(opts.giorni ?? 3));
  const conteggio = voci.length === 1 ? "un'opportunità" : `${voci.length} opportunità`;
  const introHtml =
    `<p style="margin:0 0 14px; font-size:15px; line-height:1.6; color:#14354e;">${saluto}</p>` +
    `<p style="margin:0 0 8px; font-size:15px; line-height:1.6; color:#14354e;">⏳ ` +
    `<b>Scadenza vicina</b>: ${conteggio} che ti abbiamo segnalato ${
      voci.length === 1 ? 'chiude' : 'chiudono'
    } entro <b>${giorni} ${giorni === 1 ? 'giorno' : 'giorni'}</b>.</p>` +
    `<p style="margin:0 0 18px; font-size:13px; line-height:1.6; color:#64748b;">Se non l'hai ancora aperta, questo è il momento giusto: in ogni voce trovi il link ufficiale e il recapito della scuola. <b>Un solo promemoria per avviso</b>: non ti riscriveremo su queste opportunità.</p>`;

  const elencoHtml = voci.map((v, i) => bloccoVoceDigest(v, destinatario, i + 1)).join('\n');

  // NIENTE bottone verso il Radar: la CTA primaria è il link ufficiale di ogni voce
  // (in evidenza nella card). Le preferenze del Radar stanno nel footer, in piccolo.
  const codaHtml = footerEmailHtml(dashboardUrl);

  return involucroDigest(
    opts.oggetto?.trim() ||
      subjectPromemoria(
        voci.map((v) => ({
          classe: classeRilevante(v, destinatario),
          provincia: nomeProvincia(v.province) ?? v.province,
        })),
      ),
    introHtml,
    elencoHtml,
    codaHtml,
  );
}

/**
 * Invia UN'email di promemoria a un destinatario. `voci` vuoto → nessun invio.
 * Stesso contratto di `inviaDigestEmail` (esito + errore, mai eccezioni).
 */
export async function inviaPromemoriaEmail(
  client: Resend | null,
  voci: DettagliNotifica[],
  destinatario: DestinatarioNotifica,
  opts: { dryRun?: boolean; dashboardUrl?: string; giorni?: number; oggetto?: string } = {},
): Promise<{ inviata: boolean; error?: string }> {
  if (!client) return { inviata: false, error: 'Client Resend non configurato' };
  if (voci.length === 0) return { inviata: false, error: 'nessuna opportunità da ricordare' };
  // GATE FEATURE FLAGS: in stato `test` il promemoria va all'account di test, in `off` si ferma.
  const dest = recapitoEmailAmmesso(destinatario);
  if (!dest) return { inviata: false, error: 'Invio promemoria sospeso dal gate dipartimenti' };

  const { dryRun = false, dashboardUrl = DASHBOARD_URL, giorni, oggetto } = opts;
  // Oggetto: override dal pannello Admin (o oggetto standard con contesto).
  const subject =
    oggetto?.trim() ||
    subjectPromemoria(
      voci.map((v) => ({
        classe: classeRilevante(v, dest),
        provincia: nomeProvincia(v.province) ?? v.province,
      })),
    );
  const html = renderPromemoriaEmailHtml(voci, dest, dashboardUrl, { giorni, oggetto });

  if (dryRun) {
    console.log(`  ⏳ [DRY-RUN] PROMEMORIA → ${dest.email} | ${subject} (${voci.length} voci)`);
    return { inviata: true };
  }

  try {
    const { error } = await client.emails.send({
      from: RESEND_FROM_EMAIL,
      to: [dest.email],
      subject,
      html,
      tags: RESEND_TAGS,
    });
    if (error) {
      console.warn(`  ✗ Promemoria a ${dest.email} fallito: ${error.message}`);
      return { inviata: false, error: error.message };
    }
    console.log(`  ✓ Promemoria inviato a ${dest.email} (${voci.length} opportunità)`);
    return { inviata: true };
  } catch (err) {
    const messaggio = (err as Error).message ?? 'Errore sconosciuto';
    console.warn(`  ✗ Promemoria a ${dest.email} fallito (eccezione): ${messaggio}`);
    return { inviata: false, error: messaggio };
  }
}
