/**
 * ScuoleRadar.it — QUALITÀ/CONFORMITÀ dell'OPPORTUNITÀ (Node-only, PURO).
 *
 * Tre guardie, una per ogni disposizione inderogabile del motore interpelli:
 *   1. SEPARAZIONE DEI DOMINI — `eContenutoEditoriale`: un comunicato stampa, una
 *      dichiarazione istituzionale, una rassegna o un evento NON sono
 *      opportunità di lavoro e non entrano nella bacheca né nelle notifiche;
 *   2. SOLO OPPORTUNITÀ ATTIVE E IN TARGET — `motivoScartoOpportunita`: categoria
 *      di reclutamento (interpelli/supplenze, ATA, PNRR/PON, esperti esterni) e
 *      bando NON scaduto (una scadenza assente non è una prova di scadenza);
 *   3. RECORD STRUTTURATO — `eRecordStrutturato`: se il bando dichiara
 *      classe/materia + email di candidatura, il ping del link non è attendibile
 *      (i server scolastici rispondono `403` ai client automatici) e il record
 *      non si controlla dal vivo. La decisione sul link vive in
 *      `lib/validitaLink.ts` + `presidioLinkIngresso.ts` (§26.104): qui resta solo
 *      il riconoscimento del record, che è un dato del bando, non una politica.
 */

import { eScaduto } from '../lib/scadenza.ts';
import { emailAvviso } from '../lib/alertInterpello.ts';
import { isAdministrativeNoise } from '../lib/noiseFilter.ts';
import { valutaAttoConcluso } from './attiConclusi.ts';
import { motivoPaginaServizio } from './paginaServizio.ts';
import { rilevaCategoriaAvviso, sembraOpportunita } from './parser.ts';

/* ----------------------- 1 · Filtro editoriale (domini) ----------------------- */

/**
 * Segnali di CONTENUTO EDITORIALE/ISTITUZIONALE (notizie, non opportunità).
 * Derivano dalla policy editoriale del dipartimento Notizie (`PAROLE_RIFIUTA`):
 * qui servono a escludere quelle voci dal motore degli interpelli.
 */
const RE_EDITORIALE: RegExp[] = [
  /\bcomunicat[oi]\s+stampa\b/i,
  /\bconferenza\s+stampa\b/i,
  /\brassegna\s+stampa\b/i,
  /\bufficio\s+stampa\b/i,
  /\bdichiarazion[ei]\b/i,
  /\bintervista\b/i,
  /\b(il|la|lo)\s+ministr[oa]\s+ha\b/i,
  /\bnota\s+del\s+ministr[oa]\b/i,
  /\blettera\s+del\s+ministr[oa]\b/i,
  /\bcerimonia\b/i,
  /\binaugurazione\b/i,
  /\bpremiazione\b|\bpremio\s+(letterario|nazionale|di\s+poesia)\b/i,
  /\bseminario\b|\bconvegno\b|\bwebinar\b|\bpodcast\b/i,
  /\bspettacolo\b|\brassegna\s+teatrale\b/i,
  /\bcampagna\s+di\s+comunicazione\b|\bcampagna\s+social\b/i,
  /\bnotizie\s+per\s+la\s+scuola\b/i,
  /\beditoriale\b/i,
];

/** True se il testo è contenuto editoriale/istituzionale (mai un'opportunità). */
export function eContenutoEditoriale(testo?: string | null): boolean {
  const t = (testo ?? '').trim();
  if (!t) return false;
  return RE_EDITORIALE.some((re) => re.test(t));
}

/** Segnali editoriali in forma leggibile (documentazione e guardie). */
export const SEGNALI_EDITORIALI = RE_EDITORIALE.map((re) => String(re));

/**
 * Titoli INFORMATIVI/AMMINISTRATIVI: esiti, graduatorie, nomine, contratti.
 *
 * §26.115 — la regola NON vive più qui: `attiConclusi.ts` conosce anche la
 * forma «nel titolo ma senza apertura» (Chieti-Pescara, Cuneo) e protegge gli
 * interpelli che *citano* una graduatoria. Questa funzione resta la scorciatoia
 * pubblica usata da guardie e chiamanti storici: stessa risposta, una sola
 * verità.
 */
export function eTitoloInformativo(titolo?: string | null): boolean {
  return valutaAttoConcluso(titolo).concluso;
}

/* ------------- 2 · Categorie ammesse (docenti, ATA, PNRR, esperti) ------------- */

/** Categorie di reclutamento pubblicabili in bacheca. */
export const CATEGORIE_AMMESSE = [
  'Interpello / Supplenza',
  'Bando Esperti',
  'PNRR',
  'PON',
  'POR',
  'Bando / Avviso',
] as const;

/** True se la categoria rilevata è una procedura di reclutamento ammessa. */
export function eCategoriaAmmessa(categoria: string): boolean {
  return (CATEGORIE_AMMESSE as readonly string[]).includes(categoria);
}

/** Dati minimi per valutare un'opportunità. */
export interface CandidatoOpportunita {
  title: string;
  /** Contesto della riga (città, classi, scadenze, email): secondo bacino di segnali. */
  corpo?: string | null;
  expirationDate?: string | null;
  /** Classi di concorso riconosciute: una pagina che le dichiara non è «di servizio». */
  classCodes?: readonly string[] | null;
}

/** Opzioni della valutazione di conformità. */
export interface OpzioniConformita {
  /**
   * `true` quando la riga viene da un FEED STRUTTURATO di interpelli (post
   * dell'aggregatore, elenco di avvisi dell'ente): la natura di opportunità è
   * garantita dalla fonte, quindi non si richiede la parola chiave nel titolo.
   * Il filtro EDITORIALE resta comunque obbligatorio.
   */
  daFonteInterpelli?: boolean;
}

/** Motivo per cui un testo è contenuto editoriale (`null` = nessun segnale). */
export function motivoScartoEditoriale(testo?: string | null): string | null {
  return eContenutoEditoriale(testo)
    ? 'contenuto editoriale/istituzionale (notizia, non opportunità)'
    : null;
}

/**
 * Motivo per cui un avviso NON entra nella bacheca (`null` = ammesso).
 * Ordine: contenuto editoriale → atto concluso → pagina di servizio → rumore
 * amministrativo/informativo → non-opportunità → categoria fuori target →
 * scaduto. Con `daFonteInterpelli` si salta il solo controllo "parola chiave
 * nel titolo".
 */
export function motivoScartoOpportunita(
  a: CandidatoOpportunita,
  oggi: Date = new Date(),
  opts: OpzioniConformita = {},
): string | null {
  const testo = `${a.title ?? ''} ${a.corpo ?? ''}`.replace(/\s+/g, ' ').trim();
  const editoriale = motivoScartoEditoriale(a.title);
  if (editoriale) return editoriale;
  if (eContenutoEditoriale(testo) && !sembraOpportunita(a.title ?? '')) {
    return 'contenuto editoriale/istituzionale (notizia, non opportunità)';
  }
  // §26.115 — ATTO CONCLUSO: graduatoria, esito, nomina, contratto,
  // aggiudicazione, individuazione di una persona. Il messaggio resta quello
  // storico (le guardie lo citano alla lettera); il dettaglio del tipo vive in
  // `attiConclusi.valutaAttoConcluso` ed è quello che si legge nei log.
  if (valutaAttoConcluso(a.title).concluso) {
    return 'atto informativo/esito (non un\'opportunità aperta)';
  }
  // §26.115 — PAGINA DI SERVIZIO: spiega come ci si candida (MAD, «modalità di
  // invio», FAQ) e non porta né una scadenza né una classe: non è un'opportunità.
  const servizio = motivoPaginaServizio({
    titolo: a.title,
    testo: a.corpo,
    scadenza: a.expirationDate,
    classi: a.classCodes,
  });
  if (servizio) return servizio;
  // PREFILTRO SEMANTICO (§26.82): la STESSA regola del discovery engine e del
  // table-reporter — gare, circolari, burocrazia e PAGINE INFORMATIVE (PCTO,
  // progetti, corsi, elenchi di scuole) con una sola verità. Una pagina
  // informativa resta solo se il titolo dichiara un reclutamento specifico e il
  // testo una finestra di candidatura: qui si ingerisce l'avviso, non il contorno.
  const rumore = isAdministrativeNoise(testo, a.title ?? '');
  if (rumore.isNoise) return `rumore amministrativo/informativo (${rumore.reason})`;
  if (!opts.daFonteInterpelli) {
    if (!sembraOpportunita(testo)) return 'nessun segnale di opportunità di lavoro';
    const categoria = rilevaCategoriaAvviso(testo);
    if (!eCategoriaAmmessa(categoria)) return `categoria fuori target (${categoria})`;
  }
  if (eScaduto(a.expirationDate ?? null, oggi)) return 'bando scaduto';
  return null;
}

/* -------- 3 · Record strutturato: il ping non è attendibile (anti-bot) -------- */

/** Dati per il gate del link. */
export interface CandidatoLink {
  title?: string | null;
  link?: string | null;
  classCodes?: string[] | null;
  materia?: string | null;
  contactEmail?: string | null;
}

/**
 * True se il bando è STRUTTURATO e verificabile senza leggere la pagina:
 * ha classe di concorso o materia **e** un'email di candidatura valida.
 *
 * Serve al presidio del link in ingresso (`presidioLinkIngresso.ts`): questi
 * record non si pingano, perché un server scolastico risponde `403` a un client
 * automatico qualunque sia lo stato del bando.
 */
export function eRecordStrutturato(a: CandidatoLink): boolean {
  const classeOMateria = Boolean((a.classCodes ?? []).length > 0 || (a.materia ?? '').trim());
  const email = emailAvviso(a.contactEmail ?? undefined);
  return Boolean(classeOMateria && email);
}

