/**
 * ScuoleRadar.it — Costruttore di AVVISI STRUTTURATI (card/messaggi puliti).
 * Trasforma i dati grezzi di un interpello (che nelle fonti appaiono come righe
 * di tabella lunghe e disomogenee) in una gerarchia informativa STRETTA:
 *   OBBLIGATORI (sempre presenti): Provincia · Ordine di scuola · Classe/Materia · Scadenza
 *   OPZIONALI  (mostrati SOLO se estratti): Scuola · Data di pubblicazione
 * Regole:
 *   - i campi opzionali assenti NON vengono resi (nessun placeholder tipo "N/D");
 *   - la Scadenza è valida solo se è una data reale (altrimenti è "mancante");
 *   - completo === true solo quando TUTTI i campi obbligatori sono presenti:
 *     i messaggi/notifiche usano questo flag per SALTARE in modo sicuro gli avvisi
 *     incompleti, mentre le card gestiscono la scadenza assente in modo garbato.
 * Modulo PURO: usabile sia dal frontend sia dallo scraper/notifier (Node).
 */

import type { OrdineScuola } from '../data/ordiniMaterie';
import { classeByCodice, etichettaClasseMateria } from '../data/classiConcorso';

/** Etichetta leggibile dell'ordine di scuola. */
export const ORDINE_ETICHETTA: Record<OrdineScuola, string> = {
  infanzia: "Scuola dell'Infanzia",
  primaria: 'Scuola Primaria',
  secondaria1: 'Secondaria di I grado',
  secondaria2: 'Secondaria di II grado',
  cpia: 'CPIA / Adulti',
  serali: 'Corsi serali',
  pon: 'PON / PNRR',
  ata: 'Personale ATA',
};

/** Codici ATA abbreviati usati dalle fonti → ordine "ata". */
const ATA_ALIAS = new Set(['AA', 'AT', 'CS', 'DSGA', 'ATA-AA', 'ATA-AT', 'ATA-CS']);

const MESI_BREVI = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic'];
const MESI_LUNGHI = [
  'gennaio',
  'febbraio',
  'marzo',
  'aprile',
  'maggio',
  'giugno',
  'luglio',
  'agosto',
  'settembre',
  'ottobre',
  'novembre',
  'dicembre',
];
const GIORNI = ['domenica', 'lunedì', 'martedì', 'mercoledì', 'giovedì', 'venerdì', 'sabato'];

/** True se il valore è una data ISO interpretabile. */
export function dataIsoValida(valore?: string | null): boolean {
  const s = (valore ?? '').trim();
  if (!s) return false;
  return !Number.isNaN(new Date(s).getTime());
}

/** Data breve "15 set 2026" (UTC, nessuno slittamento di fuso). */
export function formatDataAvviso(iso?: string | null): string {
  if (!dataIsoValida(iso)) return '';
  const d = new Date(iso as string);
  return `${String(d.getUTCDate()).padStart(2, '0')} ${MESI_BREVI[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

/** Data estesa "martedì 15 settembre 2026" (UTC). */
export function formatDataAvvisoLunga(iso?: string | null): string {
  if (!dataIsoValida(iso)) return '';
  const d = new Date(iso as string);
  return `${GIORNI[d.getUTCDay()]} ${d.getUTCDate()} ${MESI_LUNGHI[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

/**
 * Etichetta della SCADENZA per le superfici pubbliche (§26.65): la scadenza vera
 * quando c'è, altrimenti la data di PUBBLICAZIONE dichiarata («Pubblicato 12 set
 * 2026») — mai una data inventata. Un campo vuoto non è una data: la card della
 * bacheca stampava `Invalid Date` (reso in maiuscolo) sulle righe che la fonte
 * non data, che è una bugia, non un dato. Stessa regola della tavola «Radar Live»
 * (`rigaBoardDati.ottieniUrgenzaOAnzianita`).
 */
export function etichettaScadenzaAvviso(
  iso?: string | null,
  pubblicato?: string | null,
): string {
  const scadenza = formatDataAvviso(iso);
  if (scadenza) return scadenza;
  const pubblicazione = formatDataAvviso(pubblicato);
  return pubblicazione ? `Pubblicato ${pubblicazione}` : 'Senza scadenza dichiarata';
}

/* --------------------- Email di candidatura (asset PRO) --------------------- */

/**
 * Etichetta/icona UNICA del recapito di candidatura: le stesse stringhe in ogni
 * superficie (email, Telegram, post canale, Edge send-notification, viste web),
 * così il contatto è sempre riconoscibile a colpo d'occhio.
 */
export const EMAIL_ICONA = '📧';
/** Etichetta dei MESSAGGI (📧 Candidature: …). */
export const EMAIL_ETICHETTA = 'Candidature';
/** Etichetta delle VISTE WEB (📧 Email candidature). */
export const EMAIL_ETICHETTA_WEB = 'Email candidature';

/* ------------------ Brand e CTA informative (notifiche) ------------------ */

/**
 * BRAND COMPATTO — piccola icona pulita + nome ufficiale come LINK, sulla stessa riga.
 * Regole di prodotto (identiche in Telegram e in email):
 *   - nessun logo gigante/deformato: il marchio è una RIGA compatta in testa al
 *     messaggio, mai un'immagine grande che spinge il contenuto fuori schermo;
 *   - il nome ufficiale è Scuole Radar.it (con lo spazio: è la firma pubblica) ed
 *     è INTERAMENTE cliccabile verso la home del sito (URL_HOME);
 *   - BRAND_RIGA_TELEGRAM è la PRIMA riga di OGNI messaggio Telegram.
 */
export const BRAND_ICONA = '📡';
/** Nome ufficiale del brand nelle notifiche. */
export const BRAND_NOME = 'Scuole Radar.it';
/** Home ufficiale del sito: destinazione del brand cliccabile. */
export const URL_HOME = 'https://www.scuoleradar.it';
/** Testata brand per Telegram: icona + nome ufficiale CLICCABILE (parse_mode HTML). */
export const BRAND_RIGA_TELEGRAM = `${BRAND_ICONA} <a href="${URL_HOME}">${BRAND_NOME}</a>`;

/** URL canonico della sezione Notizie (CTA informativa, mai promozionale). */
export const URL_NOTIZIE = 'https://www.scuoleradar.it/notizie';

/**
 * CTA "Notizie" — formato ESATTO a due righe, unico per Telegram ed email
 * (verificato dai test test:telegram:template e test:email):
 * 📌 https://www.scuoleradar.it/notizie
 * Quando vuoi sapere cosa succede di importante nella scuola, vieni qui
 * La riga del link NON ha etichette: l'URL è visibile e verificabile.
 */
export const CTA_NOTIZIE_RIGA = `📌 ${URL_NOTIZIE}`;
/** Seconda riga della CTA Notizie (testo informativo, non promozionale). */
export const CTA_NOTIZIE_TESTO = 'Quando vuoi sapere cosa succede di importante nella scuola, vieni qui';
/** CTA Notizie COMPLETA (due righe, per Telegram e per il testo piano). */
export const CTA_NOTIZIE_TELEGRAM = `${CTA_NOTIZIE_RIGA}\n${CTA_NOTIZIE_TESTO}`;

/**
 * Etichetta UNICA e onesta del link alla fonte ufficiale dell'avviso: descrive
 * l'azione senza promettere una candidatura che il link non garantisce.
 *
 * Testo richiesto dal prodotto (04/10/2026): «Guarda la fonte ufficiale» — UNA
 * sola stringa per TUTTE le superfici di notifica (email, Telegram, Edge) e per
 * OGNI tipo di messaggio (alert PRO, digest, promemoria).
 */
export const ETICHETTA_AVVISO_UFFICIALE = 'Guarda la fonte ufficiale';

/**
 * Normalizza il recapito di candidatura della scuola: trim + minuscolo e
 * validazione minima. Ritorna null per valori vuoti/plausibilmente non-email
 * (nessun placeholder, nessuno stato negativo).
 */
export function emailAvviso(email?: string | null): string | null {
  const e = (email ?? '').trim().toLowerCase();
  if (!e) return null;
  return /^[^\s@]+@[^\s@.]+(?:\.[^\s@.]+)+$/.test(e) ? e : null;
}

/** Dati grezzi accettati dal costruttore (frontend e scraper). */
export interface DatiAvviso {
  provincia?: string | null;
  classCodes?: string[] | null;
  classCode?: string | null;
  materia?: string | null;
  ordine?: OrdineScuola | string | null;
  scadenza?: string | null;
  schoolName?: string | null;
  pubblicazione?: string | null;
  email?: string | null;
  titolo?: string | null;
}

export interface RigaAvviso {
  etichetta: string;
  valore: string;
}

export interface AvvisoStrutturato {
  obbligatorie: RigaAvviso[];
  opzionali: RigaAvviso[];
  email: string | null;
  mancanti: string[];
  completo: boolean;
  scadenzaValida: boolean;
}

function ordineDaClasse(classCode?: string | null): string {
  const c = (classCode ?? '').trim().toUpperCase();
  if (!c) return '';
  if (ATA_ALIAS.has(c)) return ORDINE_ETICHETTA.ata;
  const ordine = classeByCodice(c)?.ordine;
  return ordine ? ORDINE_ETICHETTA[ordine] ?? '' : '';
}

export function inferisciOrdineDaTesto(testo?: string | null): OrdineScuola | null {
  const t = (testo ?? '').toLowerCase();
  if (!t) return null;
  if (/\b(?:personale\s+ata|dsga|assistent\w\s+(?:amministrativ|tecn|scolastic)\w*|collaborator\w*\s+scolastic\w*|guardarobier\w*)\b/.test(t)) {
    return 'ata';
  }
  if (/(?:scuola\s+dell['’]?\sinfanzia|dell['’]infanzia|\binfanzia\b|scuola\s+materna|\bmaterna\b)/.test(t)) {
    return 'infanzia';
  }
  if (/(?:scuola\s+primaria|\bprimaria\b|scuole\s+elementari|\belementari\b)/.test(t)) {
    return 'primaria';
  }
  if (/(?:secondaria\s+di\s+(?:i|1|primo)\s+grado|scuola\s+media\b|\bmedie\b|\badmm\b|\bad21\b)/.test(t)) {
    return 'secondaria1';
  }
  if (/(?:secondaria\s+di\s+(?:ii|2|secondo)\s*grado|secondaria\s+superiore|\bliceo\b|licei\b|istituto\s+tecnico|istituto\s+professionale|\bipsia\b|\bitis\b|\bitc\b|\bitn\b)/.test(t)) {
    return 'secondaria2';
  }
  return null;
}

function ordineDiClasse(codice: string): OrdineScuola | null {
  const c = (codice ?? '').trim().toUpperCase();
  if (!c) return null;
  if (ATA_ALIAS.has(c)) return 'ata';
  return classeByCodice(c)?.ordine ?? null;
}

export function scegliClasseRilevante(codici?: string[] | null, titolo?: string | null): string {
  const lista = (codici ?? []).map((c) => (c ?? '').trim()).filter(Boolean);
  if (lista.length === 0) return '';
  if (lista.length === 1) return lista[0];

  const testo = (titolo ?? '').toLowerCase();
  if (testo) {
    const citata = lista.find((c) => {
      const compatta = c.replace(/-/g, '').toLowerCase();
      return compatta.length >= 3 && testo.includes(compatta);
    });
    if (citata) return citata;
  }

  const livelloTitolo = inferisciOrdineDaTesto(titolo);
  if (livelloTitolo) {
    const coerente = lista.find((c) => ordineDiClasse(c) === livelloTitolo);
    if (coerente) return coerente;
  }
  return lista[0];
}

export function scadenzaUtilizzabile(
  scadenza?: string | null,
  pubblicazione?: string | null,
  oggi: Date = new Date(),
): boolean {
  if (!dataIsoValida(scadenza)) return false;
  const d = new Date(scadenza as string);
  const giorno = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  const oggiUtc = Date.UTC(oggi.getUTCFullYear(), oggi.getUTCMonth(), oggi.getDate());
  if (giorno < oggiUtc) return false;
  if (dataIsoValida(pubblicazione)) {
    const p = new Date(pubblicazione as string);
    const giornoPub = Date.UTC(p.getUTCFullYear(), p.getUTCMonth(), p.getUTCDate());
    if (giorno === giornoPub) return false;
  }
  return true;
}

export function costruisciAvviso(dati: DatiAvviso): AvvisoStrutturato {
  const obbligatorie: RigaAvviso[] = [];
  const opzionali: RigaAvviso[] = [];
  const mancanti: string[] = [];

  const provincia = (dati.provincia ?? '').trim();
  if (provincia) obbligatorie.push({ etichetta: 'Provincia', valore: provincia });
  else mancanti.push('Provincia');

  const classCode = (dati.classCode ?? dati.classCodes?.[0] ?? '').trim();
  const livelloTitolo = inferisciOrdineDaTesto(dati.titolo);
  const ordine =
    ordineDaClasse(classCode) ||
    (livelloTitolo ? ORDINE_ETICHETTA[livelloTitolo] : '') ||
    (dati.ordine ? ORDINE_ETICHETTA[dati.ordine as OrdineScuola] ?? String(dati.ordine) : '');
  if (ordine) obbligatorie.push({ etichetta: 'Ordine di scuola', valore: ordine });
  else mancanti.push('Ordine di scuola');

  const classe = etichettaClasseMateria(classCode, dati.materia).trim();
  if (classe) obbligatorie.push({ etichetta: 'Classe / Materia', valore: classe });
  else mancanti.push('Classe / Materia');

  const scadenzaValida = scadenzaUtilizzabile(dati.scadenza, dati.pubblicazione);
  if (scadenzaValida) {
    obbligatorie.push({ etichetta: 'Scadenza', valore: formatDataAvviso(dati.scadenza) });
  } else {
    mancanti.push('Scadenza');
  }

  const scuola = (dati.schoolName ?? '').trim();
  if (scuola) opzionali.push({ etichetta: 'Scuola', valore: scuola });
  if (dataIsoValida(dati.pubblicazione)) {
    opzionali.push({ etichetta: 'Pubblicato', valore: formatDataAvviso(dati.pubblicazione) });
  }

  return {
    obbligatorie,
    opzionali,
    email: emailAvviso(dati.email),
    mancanti,
    completo: mancanti.length === 0,
    scadenzaValida,
  };
}

export function avvisoNotificabile(dati: DatiAvviso): boolean {
  return costruisciAvviso(dati).completo;
}

export const ICONA_RIGA: Record<string, string> = {
  Provincia: '📍',
  'Ordine di scuola': '🎓',
  'Classe / Materia': '📚',
  Scadenza: '📅',
  Scuola: '🏫',
  Pubblicato: '🗓️',
};

export function righeTestoAvviso(dati: DatiAvviso): string[] {
  const a = costruisciAvviso(dati);
  const righe: string[] = [];
  for (const r of a.obbligatorie) righe.push(`${ICONA_RIGA[r.etichetta] ?? '•'} ${r.etichetta}: ${r.valore}`);
  for (const r of a.opzionali) righe.push(`${ICONA_RIGA[r.etichetta] ?? '•'} ${r.etichetta}: ${r.valore}`);
  return righe;
}

const RE_SOLO_CODICE = /^(?:[A-Z]{1,2}-?\d{2,3}|A[DS][A-Z]{2}|[A-Z]{4}|[A-Z]{2}\d{2})$/;

function soloCodiciClasse(segmento: string): boolean {
  const pulito = segmento.replace(/[()[\]{},/·•|;–—]/g, ' ').replace(/\s+/g, ' ').trim();
  if (!pulito) return true;
  const token = pulito.split(' ');
  return token.every((tk) => RE_SOLO_CODICE.test(tk.toUpperCase()) || /^\d{1,3}\s*(?:ore|h)$/i.test(tk));
}

export function pulisciTitoloAvviso(titolo?: string | null, fallback?: string | null): string {
  const grezzo = (titolo ?? '').replace(/\s+/g, ' ').trim();
  const fb = (fallback ?? '').replace(/\s+/g, ' ').trim();
  if (!grezzo) return fb || 'Avviso ufficiale';

  const segmenti = grezzo
    .split(/\s*[|•·]\s*|\s+[–—]\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
  const tenuti = segmenti.filter((s) => !soloCodiciClasse(s));

  let pulito = (tenuti.length > 0 ? tenuti.join(' — ') : '')
    .replace(/timbro[\s-]*firmato[\s-]*/gi, '')
    .replace(/\btimbro\b/gi, '')
    .replace(/[_]{2,}/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .replace(/^[\s–—-]+|[\s–—-]+$/g, '')
    .trim();

  if (pulito.length < 8 || soloCodiciClasse(pulito)) pulito = fb;
  return pulito || 'Avviso ufficiale';
}

export type DestinazioneFonte = 'pdf' | 'albo' | 'stampa' | 'avviso';

const RE_HOST_INTERNO = /(^|\.)scuoleradar\.(it|com)$|(^|\.)purefocus\.one$|localhost|127\.0\.0\.1|0\.0\.0\.0/i;
const RE_URL_SEGNAPOSTO = /(example\.(com|org|net|it)|localhost|127\.0\.0\.1|0\.0\.0\.0|:5173|:3000|:8080|mockup|\bmock\b|\bsample\b|\bdummy\b|placeholder|\bfixture\b|esempio)/i;

/**
 * PULIZIA dell'URL PRIMA di ogni controllo e di ogni formattazione.
 *
 * Le fonti pubblicano i link dentro celle di tabella o paragrafi: capita di
 * trovarli con entità HTML (`&amp;`), racchiusi fra virgolette/angolari/caporalia
 * di markdown, o seguiti dalla punteggiatura della frase (`…avviso.pdf.`). Senza
 * questa pulizia un link perfettamente valido veniva RIFIUTATO dal gate (e la
 * riga della fonte spariva dai messaggi) o spedito con caratteri di troppo
 * (link rotto). La funzione è pura e idempotente: si può applicare più volte.
 */
export function pulisciUrlEsterna(url?: string | null): string {
  let u = (url ?? '').replace(/&amp;/gi, '&').replace(/&#0*38;/g, '&').trim();
  // Rimozione ITERATIVA dei contorni (`<…>.`, «…», "…", spazi): un solo passaggio
  // non basta quando i caratteri si alternano (`<url>.`).
  let precedente = '';
  while (u !== precedente) {
    precedente = u;
    u = u.replace(/^[<([{'"`«»\s]+/, '').replace(/[>)\]}'"`«»\s.,;:]+$/, '');
  }
  return u.replace(/\s+/g, '');
}

export function eLinkEsterno(url?: string | null): boolean {
  const u = pulisciUrlEsterna(url);
  if (!/^https?:\/\//i.test(u)) return false;
  if (RE_URL_SEGNAPOSTO.test(u)) return false;
  try {
    const host = new URL(u).host.toLowerCase();
    if (!host) return false;
    return !RE_HOST_INTERNO.test(host);
  } catch {
    return false;
  }
}

export function urlEsterna(url?: string | null): string | null {
  const pulito = pulisciUrlEsterna(url);
  return eLinkEsterno(pulito) ? pulito : null;
}

export function ePaginaRiepilogo(url?: string | null): boolean {
  const u = (url ?? '').toLowerCase();
  if (!u) return false;
  return /(?:[?&]\b|\/(?:stampa|print|riepilogo)(?:\/|$|[?#])|\bstampa\b|riepilogo|tabell(?:a|are|one)|elenco|indice)/.test(u);
}

const RE_URL_ARCHIVIO = /(?:^|\/)(?:tag|tags|category|categorie|search|ricerca|cerca|elenco|elenchi|lista|liste|indice|archivio|archive|pagin(?:a|e)|page|feed)(?:\/|$)/i;

/** Parametri di query che indicano una RICERCA/FILTRO: mai il singolo avviso (checklist email §5). */
const RE_QUERY_RICERCA = /[?&](?:s|q|query|search|ricerca|cerca|keyword|filtro|filtri|anno|mese|tag|category|categoria|archivio|page|paged|offset|limit|classe|provincia|data|dal|al)=/i;

/** Parametri che IDENTIFICANO il singolo avviso: pagina tabellare «Stampa» del singolo avviso. */
const RE_QUERY_ID_AVVISO = /[?&](?:cod|codice|id|uid|prot|protocollo|num|numero|atto|pratica|doc|documento|file|allegato|news|nid|post|articolo|p)=/i;

export function eUrlAvvisoDiretto(url?: string | null): boolean {
  if (!eLinkEsterno(url)) return false;
  const u = pulisciUrlEsterna(url);
  let percorso = '';
  let query = '';
  try {
    const p = new URL(u);
    percorso = p.pathname.replace(/\/+$/, '').toLowerCase();
    query = p.search;
  } catch {
    return false;
  }
  // Percorso vuoto = home dell'ente: esclusa, a MENO che la query identifichi il
  // singolo avviso (`https://www.scuola.it/?p=1234` è l'avviso, non la home);
  // una ricerca/filtro resta comunque fuori.
  if (!percorso) {
    return Boolean(query) && RE_QUERY_ID_AVVISO.test(query) && !RE_QUERY_RICERCA.test(query);
  }
  if (RE_URL_ARCHIVIO.test(percorso)) return false;
  const segmenti = percorso.split('/').filter(Boolean);
  if (segmenti.length === 1 && /^(?:interpelli|avvisi|bandi|supplenze|opportunita)/.test(segmenti[0])) {
    return false;
  }
  // Query string: una RICERCA/FILTRO (`?s=`, `?q=`, `?classe=`…) non è mai il
  // singolo avviso; ogni altro parametro deve IDENTIFICARLO (`?cod=`, `?id=`):
  // la pagina tabellare «Stampa» del singolo avviso è una destinazione AMMESSA.
  if (query && (RE_QUERY_RICERCA.test(query) || !RE_QUERY_ID_AVVISO.test(query))) return false;
  return true;
}

/**
 * URL PULITO della FONTE UFFICIALE: la stringa da mettere in un `href`.
 *
 * Punto unico per ogni superficie (Telegram, email, canali): il link viene prima
 * PULITO (`pulisciUrlEsterna`) e poi passato dall'UNICO gate sulla destinazione
 * (`eUrlAvvisoDiretto`). Ritorna `''` quando non esiste un avviso specifico e
 * diretto: mai home/elenchi/ricerche, mai un fallback alla piattaforma.
 *
 * Perché il gate si applica alla stringa PULITA: un URL corretto ma incollato
 * con punteggiatura o entità HTML (`&amp;`) risultava "non diretto" e la riga
 * della fonte spariva dal messaggio — ora entra in formato pulito e cliccabile.
 */
export function urlFonteAvviso(url?: string | null): string {
  const pulito = pulisciUrlEsterna(url);
  return eUrlAvvisoDiretto(pulito) ? pulito : '';
}

export interface DatiQualitaAvviso {
  link?: string | null;
  email?: string | null;
}

/**
 * MOTIVO dell'AVVERTENZA di qualità: il recapito di candidatura non è risolto.
 *
 * Da §26.68 (direttiva 06/10/2026) **non è più un motivo di blocco**: una
 * opportunità genuina con la fonte ufficiale diretta si invia anche senza
 * recapito — il blocco contatto si OMETTE dal messaggio (mai «Email non
 * disponibile») e la riga resta segnalata come da arricchire. La stringa resta
 * identica perché è il metro dei report (`npm run admin:health`) e delle guardie:
 * cambia la conseguenza, non la misura.
 */
export const MOTIVO_RECAPITO_MANCANTE = 'recapito di candidatura mancante';

/**
 * Avvertenza di qualità sull'invio: `null` quando il recapito c'è (email della
 * fonte, PEO/PEC da anagrafica, storico o convenzione MIM), altrimenti il motivo.
 * Non è un blocco: chi invia logga l'avvertenza e procede senza la riga contatto.
 */
export function avvisoSenzaRecapito(dati: DatiQualitaAvviso = {}): string | null {
  return emailAvviso(dati.email) ? null : MOTIVO_RECAPITO_MANCANTE;
}

/**
 * Motivo per cui un avviso NON è inviabile (`null` = inviabile).
 *
 * INDEROGABILE: il LINK DIRETTO alla fonte ufficiale (`eUrlAvvisoDiretto`). Un
 * avviso senza la sua pagina ufficiale non è verificabile e non parte.
 *
 * Il RECAPITO di candidatura NON è più un requisito di blocco (§26.68): un
 * interpello reale non si perde per un'anagrafica incompleta. Il Tailoring
 * (`lib/tailoringContatti.ts`) prova prima a recuperarlo (fonte → anagrafica →
 * storico → convenzione MIM); se non riesce, `avvisoSenzaRecapito` lo segnala e
 * il messaggio parte senza il blocco contatto.
 */
export function motivoAvvisoNonInviabile(dati: DatiQualitaAvviso = {}): string | null {
  if (!eUrlAvvisoDiretto(dati.link)) return 'fonte ufficiale non diretta';
  return null;
}

export function avvisoInviabile(dati: DatiQualitaAvviso = {}): boolean {
  return motivoAvvisoNonInviabile(dati) === null;
}

export function classificaFonteLink(url?: string | null): DestinazioneFonte {
  const u = (url ?? '').toLowerCase();
  if (!u) return 'avviso';
  if (/\.pdf(?:$|[?#])/.test(u) || /[?&]=pdf\b/.test(u)) return 'pdf';
  if (ePaginaRiepilogo(u)) return 'stampa';
  if (/albo|pretorio|pubblicazion|atti\b|determin|deliber|ordinanz|decret/.test(u)) return 'albo';
  return 'avviso';
}

export function etichettaFonteLink(url?: string | null): string {
  const u = (url ?? '').toLowerCase();
  if (eLinkEsterno(url) && /\/interpello\//.test(u)) return "Apri la scheda dell'avviso";
  switch (classificaFonteLink(url)) {
    case 'pdf':
      return 'Apri il bando ufficiale (PDF)';
    case 'albo':
      return "Apri l'avviso sull'Albo Pretorio";
    case 'stampa':
      return 'Apri la pagina di riepilogo';
    default:
      return "Apri l'avviso ufficiale";
  }
}

export interface DatiSuggerimento {
  url?: string | null;
  classe?: string | null;
  provincia?: string | null;
  schoolName?: string | null;
  email?: string | null;
  compatto?: boolean;
}

export const ISTRUZIONE_AVVISO_UFFICIALE = "Guarda la fonte ufficiale (clicca STAMPA dove possibile, per candidarti)";

export function suggerimentoRicercaAvviso(dati: DatiSuggerimento = {}): string | null {
  const email = emailAvviso(dati.email);
  const classe = (dati.classe ?? '').trim();
  const provincia = (dati.provincia ?? '').trim();
  const url = (dati.url ?? '').trim();
  const esterna = eLinkEsterno(url);

  if (esterna && !ePaginaRiepilogo(url)) return null;

  const dove = [classe ? `«${classe}»` : 'la tua classe di concorso', provincia || null].filter(Boolean).join(' per ');

  if (esterna) {
    const cerca = `Cerca la riga con ${dove} e leggi lì date e classi.`;
    // Anche la versione COMPATTA (digest Telegram) tiene la direttiva standard
    // E la riga da cercare: senza il riferimento alla riga l'utente non saprebbe
    // cosa cercare nell'elenco (test: test-digest, test-link-esterno).
    // La riga da cercare entra in MINUSCOLO dopo i due punti: è la forma attesa da
    // test-digest e test-link-esterno (match case-sensitive su «cerca la riga»).
    if (dati.compatto) return `${ISTRUZIONE_AVVISO_UFFICIALE}: cerca la riga con ${dove} e leggi lì date e classi.`;
    const testo = [
      'Nel link la scuola pubblica un elenco, non la scheda del singolo avviso.',
      `${ISTRUZIONE_AVVISO_UFFICIALE}.`,
      cerca,
    ];
    if (email) {
      testo.push(
        `Per candidarti puoi scrivere direttamente a ${email}: è il recapito ufficiale della scuola. Indica ${dove} e chiedi conferma dei termini.`,
      );
    }
    return testo.join(' ');
  }

  const chiedi = `Chiedi alla segreteria la riga con ${dove} oppure il testo dell'avviso.`;
  if (dati.compatto) return chiedi;
  const testo = ['Questo avviso non indica la pagina ufficiale su cui è pubblicato.', chiedi];
  if (email) {
    testo.push(
      `Per candidarti puoi scrivere direttamente a ${email}: è il recapito ufficiale della scuola. Indica ${dove} e chiedi conferma dei termini.`,
    );
  }
  return testo.join(' ');
}