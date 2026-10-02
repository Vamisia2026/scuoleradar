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
 *   3. NIENTE SCARTI PER PING FALLACE — `valutaGateLink`: se il bando è
 *      STRUTTURATO (classe/materia + email di candidatura) il record si accetta
 *      anche quando il server blocca i bot (`403`/timeout/TLS) o quando il ping
 *      non è stato eseguito; il link deve però restare una fonte ufficiale
 *      verificata (gate `verificaAvviso` di `parser.ts`, applicato a valle).
 */

import { eScaduto } from '../lib/scadenza.ts';
import { emailAvviso } from '../lib/alertInterpello.ts';
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
 * Titoli INFORMATIVI/AMMINISTRATIVI: esiti, graduatorie, approvazioni, revoche.
 * Non sono opportunità a cui candidarsi (sono l'esito di una procedura): restano
 * fuori dalla bacheca degli interpelli aperti. Il confronto è sull'inizio del
 * titolo, quindi un interpello che *parla* di graduatorie resta ammesso.
 */
const RE_TITOLO_INFORMATIVO =
  /^(?:esit[oi]|risultanz[ae]|verbale|graduatori[ae](?:\s+(?:definitive?|provvisorie?|di istituto|per supplenze))?|elenco (?:degli )?ammess[ie]|ammess[ie]|approvazion[ei]|annullamento|revoca|rettifica|decreto|nomina|pubblicazione degli esiti)/i;

/** True se il titolo annuncia un esito/un atto amministrativo, non un bando aperto. */
export function eTitoloInformativo(titolo?: string | null): boolean {
  const t = (titolo ?? '').replace(/\s+/g, ' ').trim();
  if (!t) return false;
  return RE_TITOLO_INFORMATIVO.test(t);
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
 * Ordine: contenuto editoriale → non-opportunità → categoria fuori target → scaduto.
 * Con `daFonteInterpelli` si salta il solo controllo "parola chiave nel titolo".
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
  if (eTitoloInformativo(a.title)) {
    return 'atto informativo/esito (non un\'opportunità aperta)';
  }
  if (!opts.daFonteInterpelli) {
    if (!sembraOpportunita(testo)) return 'nessun segnale di opportunità di lavoro';
    const categoria = rilevaCategoriaAvviso(testo);
    if (!eCategoriaAmmessa(categoria)) return `categoria fuori target (${categoria})`;
  }
  if (eScaduto(a.expirationDate ?? null, oggi)) return 'bando scaduto';
  return null;
}

/* ------------- 3 · Gate del link: ping fallace ≠ record scartato ------------- */

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
 */
export function eRecordStrutturato(a: CandidatoLink): boolean {
  const classeOMateria = Boolean((a.classCodes ?? []).length > 0 || (a.materia ?? '').trim());
  const email = emailAvviso(a.contactEmail ?? undefined);
  return Boolean(classeOMateria && email);
}

export interface EsitoGateLink {
  accetta: boolean;
  /** True se il link è stato verificato dal vivo (ping riuscito). */
  verificato: boolean;
  motivo: string;
}

/**
 * Decide se tenere un record in base alla raggiungibilità del link.
 *
 * `raggiungibile` = `true` link verificato · `false` ping fallito (403/timeout/
 * anti-bot) · `null` ping non eseguito (record già strutturato).
 * Un ping fallito NON è più una condanna: se il record è strutturato (classe o
 * materia + email di candidatura) si accetta, loggando lo scarto di verifica.
 */
export function valutaGateLink(a: CandidatoLink, raggiungibile: boolean | null): EsitoGateLink {
  if (raggiungibile === true) {
    return { accetta: true, verificato: true, motivo: 'link raggiungibile' };
  }
  if (eRecordStrutturato(a)) {
    return {
      accetta: true,
      verificato: false,
      motivo:
        'record strutturato (classe/materia + email di candidatura): accettato senza ' +
        'verifica del link (blocco anti-bot del server)',
    };
  }
  return {
    accetta: false,
    verificato: false,
    motivo:
      'link non verificabile e record incompleto: manca la classe/materia o l’email di candidatura',
  };
}

