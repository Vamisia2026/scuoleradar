/**
 * ScuoleRadar.it — Costruttore di AVVISI STRUTTURATI (card/messaggi puliti).
 *
 * Trasforma i dati grezzi di un interpello (che nelle fonti appaiono come righe
 * di tabella lunghe e disomogenee) in una gerarchia informativa STRETTA:
 *
 *   OBBLIGATORI (sempre presenti): Provincia · Ordine di scuola · Classe/Materia · Scadenza
 *   OPZIONALI  (mostrati SOLO se estratti): Scuola · Data di pubblicazione
 *
 * Regole:
 *  - i campi opzionali assenti NON vengono resi (nessun placeholder tipo "N/D");
 *  - la Scadenza è valida solo se è una data reale (altrimenti è "mancante");
 *  - `completo === true` solo quando TUTTI i campi obbligatori sono presenti:
 *    i messaggi/notifiche usano questo flag per SALTARE in modo sicuro gli avvisi
 *    incompleti, mentre le card gestiscono la scadenza assente in modo garbato.
 *
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
  'gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno',
  'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre',
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

/* --------------------- Email di candidatura (asset PRO) --------------------- */

/**
 * Etichetta/icona UNICA del recapito di candidatura: le stesse stringhe in ogni
 * superficie (email, Telegram, post canale, Edge `send-notification`, viste web),
 * così il contatto è sempre riconoscibile a colpo d'occhio.
 */
export const EMAIL_ICONA = '📧';
/** Etichetta dei MESSAGGI (`📧 Candidature: …`). */
export const EMAIL_ETICHETTA = 'Candidature';
/** Etichetta delle VISTE WEB (`📧 Email candidature`). */
export const EMAIL_ETICHETTA_WEB = 'Email candidature';

/* ------------------ Brand e CTA informative (notifiche) ------------------ */

/**
 * BRAND COMPATTO — piccola icona pulita + nome ufficiale come LINK, sulla stessa riga.
 *
 * Regole di prodotto (identiche in Telegram e in email):
 *  - nessun logo gigante/deformato: il marchio è una RIGA compatta in testa al
 *    messaggio, mai un'immagine grande che spinge il contenuto fuori schermo;
 *  - il nome ufficiale è `Scuole Radar.it` (con lo spazio: è la firma pubblica) ed
 *    è INTERAMENTE cliccabile verso la home del sito (`URL_HOME`);
 *  - `BRAND_RIGA_TELEGRAM` è la PRIMA riga di OGNI messaggio Telegram.
 */
export const BRAND_ICONA = '📡';
/** Nome ufficiale del brand nelle notifiche. */
export const BRAND_NOME = 'Scuole Radar.it';
/** Home ufficiale del sito: destinazione del brand cliccabile. */
export const URL_HOME = 'https://www.scuoleradar.it';
/** Testata brand per Telegram: icona + nome ufficiale CLIICCABILE (parse_mode HTML). */
export const BRAND_RIGA_TELEGRAM = `${BRAND_ICONA} <a href="${URL_HOME}">${BRAND_NOME}</a>`;

/** URL canonico della sezione Notizie (CTA informativa, mai promozionale). */
export const URL_NOTIZIE = 'https://www.scuoleradar.it/notizie';

/**
 * CTA "Notizie" — formato ESATTO a due righe, unico per Telegram ed email
 * (verificato dai test `test:telegram:template` e `test:email`):
 *
 *   📌 https://www.scuoleradar.it/notizie
 *   Quando vuoi sapere cosa succede di importante nella scuola, vieni qui
 *
 * La riga del link NON ha etichette: l'URL è visibile e verificabile.
 */
export const CTA_NOTIZIE_RIGA = `📌 ${URL_NOTIZIE}`;
/** Seconda riga della CTA Notizie (testo informativo, non promozionale). */
export const CTA_NOTIZIE_TESTO =
  'Quando vuoi sapere cosa succede di importante nella scuola, vieni qui';
/** CTA Notizie COMPLETA (due righe, per Telegram e per il testo piano). */
export const CTA_NOTIZIE_TELEGRAM = `${CTA_NOTIZIE_RIGA}\n${CTA_NOTIZIE_TESTO}`;

/**
 * Etichetta UNICA e onesta del link alla fonte ufficiale dell'avviso: descrive
 * l'azione senza promettere una candidatura che il link non garantisce.
 */
export const ETICHETTA_AVVISO_UFFICIALE = "👉 Apri l'avviso ufficiale";

/**
 * Normalizza il recapito di candidatura della scuola: trim + minuscolo e
 * validazione minima. Ritorna `null` per valori vuoti/plausibilmente non-email
 * (nessun placeholder, nessuno stato negativo).
 */
export function emailAvviso(email?: string | null): string | null {
  const e = (email ?? '').trim().toLowerCase();
  if (!e) return null;
  // Un solo `@`, almeno un punto nel dominio: evita di rendere cliccabile testo
  // che non è un indirizzo (es. "@" citato in prosa o URL spezzati).
  return /^[^\s@]+@[^\s@.]+(?:\.[^\s@.]+)+$/.test(e) ? e : null;
}

/** Dati grezzi accettati dal costruttore (frontend e scraper). */
export interface DatiAvviso {
  /** Nome leggibile della provincia (preferito) o, in mancanza, il codice. */
  provincia?: string | null;
  /** Codici di classe di concorso rilevati (il primo determina ordine + etichetta). */
  classCodes?: string[] | null;
  /** Codice classe singolo (alternativa a `classCodes`). */
  classCode?: string | null;
  /** Materia/settore (evidenza di ripiego quando manca la classe). */
  materia?: string | null;
  /** Ordine esplicito (dal feed); se assente è dedotto dalla classe. */
  ordine?: OrdineScuola | string | null;
  scadenza?: string | null;
  schoolName?: string | null;
  pubblicazione?: string | null;
  /**
   * Email/PEC di candidatura della scuola: è un ASSET a valore aggiunto per il
   * piano PRO, quindi viaggia dentro l'avviso strutturato (non accanto) ed è
   * resa in ogni superficie quando disponibile — anche se il link è solo un
   * riepilogo.
   */
  email?: string | null;
  /**
   * Titolo/descrizione grezza dell'avviso: serve a scegliere la classe
   * COERENTE con il livello dichiarato (evita contraddizioni tipo "Scuola
   * Primaria" + titolo della secondaria) e a dedurre l'ordine quando manca
   * la classe. Mai mostrato: è solo contesto.
   */
  titolo?: string | null;
}

export interface RigaAvviso {
  etichetta: string;
  valore: string;
}

export interface AvvisoStrutturato {
  /** Righe obbligatorie presenti (max 4: Provincia, Ordine, Classe/Materia, Scadenza). */
  obbligatorie: RigaAvviso[];
  /** Righe opzionali presenti (Scuola, Pubblicato) — solo se estratte. */
  opzionali: RigaAvviso[];
  /**
   * Email/PEC di candidatura normalizzata, se estratta (`null` se assente).
   * Campo a sé (non una riga di testo) perché ogni superficie la rende in modo
   * cliccabile (`mailto:`), mantenendo etichetta e posizione coerenti.
   */
  email: string | null;
  /** Etichette dei campi obbligatori RISULTATI MANCANTI. */
  mancanti: string[];
  /** true = tutti i campi obbligatori presenti. */
  completo: boolean;
  /** true = la scadenza è una data valida (per gestirla con garbo se assente). */
  scadenzaValida: boolean;
}

/** Deduce l'ordine di scuola (etichetta) dalla classe o dal codice ATA. */
function ordineDaClasse(classCode?: string | null): string {
  const c = (classCode ?? '').trim().toUpperCase();
  if (!c) return '';
  if (ATA_ALIAS.has(c)) return ORDINE_ETICHETTA.ata;
  const ordine = classeByCodice(c)?.ordine;
  return ordine ? ORDINE_ETICHETTA[ordine] ?? '' : '';
}

/**
 * Livello di scuola dichiarato NEL TESTO (titolo/descrizione), o null.
 * Serve quando manca il codice classe: senza questo, un avviso di scuola
 * primaria restava etichettato come "Secondaria di II grado" (default del feed).
 */
export function inferisciOrdineDaTesto(testo?: string | null): OrdineScuola | null {
  const t = (testo ?? '').toLowerCase();
  if (!t) return null;
  if (
    /\b(?:personale\s+ata|dsga|assistent\w*\s+(?:amministrativ|tecn|scolastic)\w*|collaborator\w*\s+scolastic\w*|guardarobier\w*)\b/.test(
      t,
    )
  ) {
    return 'ata';
  }
  if (/(?:scuola\s+dell['’]?\s*infanzia|dell['’]infanzia|\binfanzia\b|scuola\s+materna|\bmaterna\b)/.test(t)) {
    return 'infanzia';
  }
  if (/(?:scuola\s+primaria|\bprimaria\b|scuole\s+elementari|\belementari\b)/.test(t)) {
    return 'primaria';
  }
  if (
    /(?:secondaria\s+di\s+(?:i|1|primo)\s*grado|scuola\s+media\b|\bmedie\b|\badmm\b|\bad21\b)/.test(t)
  ) {
    return 'secondaria1';
  }
  if (
    /(?:secondaria\s+di\s+(?:ii|2|secondo)\s*grado|secondaria\s+superiore|\bliceo\b|licei\b|istituto\s+tecnico|istituto\s+professionale|\bipsia\b|\bitis\b|\bitc\b|\bitn\b)/.test(
      t,
    )
  ) {
    return 'secondaria2';
  }
  return null;
}

/** Ordine di una singola classe (codice ATA incluso), o null. */
function ordineDiClasse(codice: string): OrdineScuola | null {
  const c = (codice ?? '').trim().toUpperCase();
  if (!c) return null;
  if (ATA_ALIAS.has(c)) return 'ata';
  return classeByCodice(c)?.ordine ?? null;
}

/**
 * Sceglie il codice classe PIÙ COERENTE con l'avviso:
 *   1. la classe CITATA nel titolo (fonte primaria, evita i dump di codici
 *      ordinati arbitrariamente dalla tabella sorgente);
 *   2. altrimenti la prima classe il cui livello coincide con quello dichiarato
 *      nel titolo;
 *   3. in mancanza, la prima classe disponibile.
 * Evita la contraddizione "Ordine di scuola: Primaria" + titolo della
 * secondaria causata dal prendere acriticamente `classCodes[0]`.
 */
export function scegliClasseRilevante(
  codici?: string[] | null,
  titolo?: string | null,
): string {
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

/**
 * True se la scadenza è UTILIZZABILE in un avviso:
 *  · è una data reale;
 *  · NON è già passata (una scadenza nel passato è un errore di estrazione o un
 *    avviso chiuso: mostrarla è peggio che ometterla);
 *  · NON coincide con la data di pubblicazione (i bollettini/elenchi riportano
 *    la data di pubblicazione che veniva scambiata per scadenza).
 */
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

/**
 * Costruisce l'avviso strutturato con la gerarchia STRETTA.
 * I campi opzionali assenti non compaiono; la mancanza di obbligatori è esposta
 * in `mancanti` (per saltare in modo sicuro o gestire con garbo).
 */
export function costruisciAvviso(dati: DatiAvviso): AvvisoStrutturato {
  const obbligatorie: RigaAvviso[] = [];
  const opzionali: RigaAvviso[] = [];
  const mancanti: string[] = [];

  // 1) Provincia
  const provincia = (dati.provincia ?? '').trim();
  if (provincia) obbligatorie.push({ etichetta: 'Provincia', valore: provincia });
  else mancanti.push('Provincia');

  // 2) Ordine di scuola — SEMPRE coerente con la classe MOSTRATA; se la classe
  //    manca si deduce dal TESTO (mai un livello inventato tipo "Secondaria di II
  //    grado" per un avviso di scuola primaria).
  const classCode = (dati.classCode ?? dati.classCodes?.[0] ?? '').trim();
  const livelloTitolo = inferisciOrdineDaTesto(dati.titolo);
  const ordine =
    ordineDaClasse(classCode) ||
    (livelloTitolo ? ORDINE_ETICHETTA[livelloTitolo] : '') ||
    (dati.ordine ? ORDINE_ETICHETTA[dati.ordine as OrdineScuola] ?? String(dati.ordine) : '');
  if (ordine) obbligatorie.push({ etichetta: 'Ordine di scuola', valore: ordine });
  else mancanti.push('Ordine di scuola');

  // 3) Classe / Materia
  const classe = etichettaClasseMateria(classCode, dati.materia).trim();
  if (classe) obbligatorie.push({ etichetta: 'Classe / Materia', valore: classe });
  else mancanti.push('Classe / Materia');

  // 4) Scadenza: valida SOLO se reale, non passata e diversa dalla pubblicazione.
  const scadenzaValida = scadenzaUtilizzabile(dati.scadenza, dati.pubblicazione);
  if (scadenzaValida) {
    obbligatorie.push({ etichetta: 'Scadenza', valore: formatDataAvviso(dati.scadenza) });
  } else {
    mancanti.push('Scadenza');
  }

  // OPZIONALI — solo se estratti (nessun placeholder).
  const scuola = (dati.schoolName ?? '').trim();
  if (scuola) opzionali.push({ etichetta: 'Scuola', valore: scuola });
  if (dataIsoValida(dati.pubblicazione)) {
    opzionali.push({ etichetta: 'Pubblicato', valore: formatDataAvviso(dati.pubblicazione) });
  }

  return {
    obbligatorie,
    opzionali,
    // Email di candidatura: sempre presente nel modello quando la pipeline la
    // estrae, anche per i link di riepilogo/"Stampa" senza descrizione.
    email: emailAvviso(dati.email),
    mancanti,
    completo: mancanti.length === 0,
    scadenzaValida,
  };
}

/** True se l'avviso ha TUTTI i campi obbligatori (pronto per la notifica). */
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

/**
 * Righe di testo (con emoji) per i messaggi Telegram/email, rispettando la
 * gerarchia: obbligatorie SEMPRE, opzionali solo se presenti. La scadenza è la
 * sola obbligatoria che, se assente, viene OMESSA garbatamente (nessun blocco
 * "Scadenza: Non indicata").
 */
export function righeTestoAvviso(dati: DatiAvviso): string[] {
  const a = costruisciAvviso(dati);
  const righe: string[] = [];
  for (const r of a.obbligatorie) righe.push(`${ICONA_RIGA[r.etichetta] ?? '•'} ${r.etichetta}: ${r.valore}`);
  for (const r of a.opzionali) righe.push(`${ICONA_RIGA[r.etichetta] ?? '•'} ${r.etichetta}: ${r.valore}`);
  return righe;
}


/* --------------------- Pulizia dei titoli grezzi (tabelle) --------------------- */

/** True se il token è SOLO un codice classe (A042, A-041, ADEE, EEEE, AA56, BI02…). */
const RE_SOLO_CODICE = /^(?:[A-Z]{1,2}-?\d{2,3}|A[DS][A-Z]{2}|[A-Z]{4}|[A-Z]{2}\d{2})$/;

function soloCodiciClasse(segmento: string): boolean {
  const pulito = segmento
    .replace(/[()[\]{},/·•|;–—-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!pulito) return true;
  const token = pulito.split(' ');
  return token.every((tk) => RE_SOLO_CODICE.test(tk.toUpperCase()) || /^\d{1,3}\s*(?:ore|h)$/i.test(tk));
}

/**
 * Pulisce un titolo grezzo proveniente dalle TABELLE delle fonti: rimuove i
 * "dump" di codici classe separati da `|`/`·`/`–` (es. "ADEE | A042 | AAAA |
 * ADAA | EEEE | A042 | ADMM"), gli artefatti tipo "timbro_FIRMATO_" e gli spazi
 * multipli. Se resta troppo poco (titolo fatto solo di codici) usa il `fallback`
 * (es. "Interpello A-041 — Torino"), così l'alert resta leggibile e curato.
 */
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
    .replace(/timbro[_\s-]*firmato[_\s-]*/gi, '')
    .replace(/\btimbro\b/gi, '')
    .replace(/[_]{2,}/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .replace(/^[\s–—-]+|[\s–—-]+$/g, '')
    .trim();

  // Se è rimasto troppo poco (o è ancora un dump di codici) → fallback curato.
  if (pulito.length < 8 || soloCodiciClasse(pulito)) pulito = fb;
  return pulito || 'Avviso ufficiale';
}
/* --------------------- Etichetta ONESTA del link di fonte --------------------- */

/**
 * Classifica la DESTINAZIONE del link di fonte, così l'etichetta del bottone non
 * promette ciò che il link non è (mai "Candidati" se porta su un Albo Pretorio).
 *   · 'pdf'    → documento ufficiale (bando/avviso in PDF)
 *   · 'albo'   → Albo Pretorio / pubblicazione atti / determine / delibere
 *   · 'stampa' → pagina di RIEPILOGO/STAMPA o elenco tabellare (spesso senza la
 *                descrizione estesa dell'avviso)
 *   · 'avviso' → pagina di avviso/notizia ufficiale (default)
 */
export type DestinazioneFonte = 'pdf' | 'albo' | 'stampa' | 'avviso';

/** Host che NON sono fonti esterne: la piattaforma stessa e gli ambienti di prova. */
const RE_HOST_INTERNO =
  /(^|\.)scuoleradar\.(it|com)$|(^|\.)purefocus\.one$|localhost|127\.0\.0\.1|0\.0\.0\.0/i;

/** Segnali di URL di prova/segnaposto (mai una fonte pubblicabile). */
const RE_URL_SEGNAPOSTO =
  /(example\.(com|org|net|it)|localhost|127\.0\.0\.1|0\.0\.0\.0|:5173|:3000|:8080|mockup|\bmock\b|\bsample\b|\bdummy\b|placeholder|\bfixture\b|esempio)/i;

/**
 * True se l'URL è una FONTE ESTERNA valida: http(s) assoluto, mai un indirizzo
 * della piattaforma (ScuoleRadar/PureFocus) né un URL di prova.
 *
 * È il guard della POLITICA DI ROUTING delle notifiche: i link degli avvisi
 * devono puntare SOLO alla fonte originale dell'istituzione. Ogni fallback
 * interno (scheda ScuoleRadar, deep link `/interpello/…`) è vietato.
 */
export function eLinkEsterno(url?: string | null): boolean {
  const u = (url ?? '').trim();
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

/** URL della fonte esterna se valido, altrimenti `null` (nessun fallback interno). */
export function urlEsterna(url?: string | null): string | null {
  return eLinkEsterno(url) ? (url ?? '').trim() : null;
}

/**
 * True se l'URL è una pagina di RIEPILOGO/STAMPA o un elenco tabellare: sono le
 * pagine in cui spesso si arriva senza la descrizione estesa dell'avviso. In
 * questo caso il recapito della scuola diventa l'informazione più preziosa.
 */
export function ePaginaRiepilogo(url?: string | null): boolean {
  const u = (url ?? '').toLowerCase();
  if (!u) return false;
  return (
    /(?:[?&](?:stampa|print|sintesi|riepilogo|showall)\b|\/(?:stampa|print|riepilogo)(?:\/|$|[?#])|\bstampa\b|riepilogo|tabell(?:a|are|one)|elenco|indice)/.test(
      u,
    )
  );
}

/* ------------------ GATE DI QUALITÀ dell'invio (link + recapito) ------------------ */

/**
 * Percorsi che NON sono mai un avviso specifico: pagine di RICERCA, ELENCO,
 * ARCHIVIO o TAG di un sito istituzionale/aggregatore. Un link così NON può
 * essere mostrato come "👉 Apri l'avviso ufficiale": porterebbe l'utente su un
 * elenco, non sull'avviso.
 */
const RE_URL_ARCHIVIO =
  /(?:^|\/)(?:tag|tags|category|categorie|search|ricerca|cerca|elenco|elenchi|lista|liste|indice|archivio|archive|pagin(?:a|e)|page|feed)(?:\/|$)/i;

/**
 * True se l'URL è un AVVISO SPECIFICO e DIRETTO: pagina o documento puntuale
 * pubblicato dall'ente (scuola/USP/USR) — incluso il PDF e la **pagina
 * tabellare/“Stampa” del singolo avviso** (destinazioni ammesse dal prodotto).
 *
 * NON è mai un avviso: la HOME dell'ente, un elenco/archivio/tag, una pagina di
 * ricerca (`?s=`, `?q=`), la landing regionale di un aggregatore
 * (`/interpelli-lombardia/`) o un URL della piattaforma.
 *
 * È il guard della REGOLA di prodotto: "👉 Apri l'avviso ufficiale" deve puntare
 * all'URL esatto dell'avviso (o alla sua tabella/PDF), mai a un archivio di
 * ricerca o alla home.
 */
export function eUrlAvvisoDiretto(url?: string | null): boolean {
  if (!eLinkEsterno(url)) return false;
  const u = (url ?? '').trim();
  let percorso = '';
  let query = '';
  try {
    const p = new URL(u);
    percorso = p.pathname.replace(/\/+$/, '').toLowerCase();
    query = p.search;
  } catch {
    return false;
  }
  // Home dell'ente (es. la radice dell'USR): non è un avviso.
  if (!percorso) return false;
  // Elenchi, archivi, tag, pagine di ricerca.
  if (RE_URL_ARCHIVIO.test(percorso)) return false;
  const segmenti = percorso.split('/').filter(Boolean);
  // Landing/elenco di primo livello (es. `interpelli-lombardia`,
  // `interpelli-scuola-2026-09-17`): un solo segmento "contenitore".
  if (segmenti.length === 1 && /^(?:interpelli|avvisi|bandi|supplenze|opportunita)/.test(segmenti[0])) {
    return false;
  }
  // Ricerca interna (`?s=`, `?q=`, `?ricerca=`).
  if (/[?&](?:s|q|search|query|ricerca|filtro)=/i.test(query)) return false;
  return true;
}

/** Dati minimi per il gate di qualità dell'invio. */
export interface DatiQualitaAvviso {
  /** URL della fonte ufficiale dell'avviso. */
  link?: string | null;
  /** Email/PEC di candidatura della scuola. */
  email?: string | null;
}

/**
 * Motivo per cui un avviso NON è inviabile (`null` = pronto all'invio).
 * Serve a loggare in modo comprensibile perché un record è stato scartato.
 */
export function motivoAvvisoNonInviabile(dati: DatiQualitaAvviso = {}): string | null {
  if (!eUrlAvvisoDiretto(dati.link)) return 'fonte ufficiale non diretta';
  if (!emailAvviso(dati.email)) return 'recapito di candidatura mancante';
  return null;
}

/**
 * GATE DI QUALITÀ STRICT — un avviso si invia SOLO se ha:
 *   1. un link DIRETTO all'avviso ufficiale (non home, non elenco/ricerca);
 *   2. un recapito di candidatura valido (email/PEC della scuola).
 * Un avviso incompleto danneggia l'affidabilità del servizio: meglio non
 * inviarlo affatto. Usato da tutti i canali (Telegram, email, digest).
 */
export function avvisoInviabile(dati: DatiQualitaAvviso = {}): boolean {
  return motivoAvvisoNonInviabile(dati) === null;
}

export function classificaFonteLink(url?: string | null): DestinazioneFonte {
  const u = (url ?? '').toLowerCase();
  if (!u) return 'avviso';
  if (/\.pdf(?:$|[?#])/.test(u) || /[?&](?:format|ext)=pdf\b/.test(u)) return 'pdf';
  // RIEPILOGO prima di tutto: un marcatore esplicito di stampa/elenco ("Stampa",
  // `?stampa=1`, `/print`, tabella, elenco, indice) descrive la DESTINAZIONE reale
  // meglio del nome del contenitore (es. "albo"): l'etichetta resta onesta e la
  // guida operativa viene mostrata.
  if (ePaginaRiepilogo(u)) return 'stampa';
  if (/albo|pretorio|pubblicazion|atti\b|determin|deliber|ordinanz|decret/.test(u)) return 'albo';
  return 'avviso';
}

/**
 * Etichetta CHIARA e veritiera per il link alla fonte originale. Non usare MAI
 * "Candidati": non sappiamo se la pagina è un modulo di invio domanda.
 *
 * NOTA: le NOTIFICHE (Telegram, email, canali, Edge) usano l'etichetta UNICA e
 * standard `ETICHETTA_AVVISO_UFFICIALE` ("👉 Apri l'avviso ufficiale") — una sola
 * stringa in tutte le superfici. Questa funzione resta per le VISTE WEB
 * (`InterpelloCard`, `InterpelloDettaglioPage`), dove la distinzione
 * PDF/Albo/riepilogo aiuta a capire cosa si sta aprendo.
 */
export function etichettaFonteLink(url?: string | null): string {
  const u = (url ?? '').toLowerCase();
  // "Scheda dell'avviso" SOLO per le pagine di interpello ESTERNE (istituzionali):
  // i link interni della piattaforma non sono mai una fonte.
  if (eLinkEsterno(url) && /\/interpello\//.test(u)) return "Apri la scheda dell'avviso";
  switch (classificaFonteLink(url)) {
    case 'pdf':
      return 'Apri il bando ufficiale (PDF)';
    case 'albo':
      return "Apri l'avviso sull'Albo Pretorio";
    case 'stampa':
      // Onestà: è una pagina di riepilogo/elenco, non il testo integrale.
      return 'Apri la pagina di riepilogo';
    default:
      return "Apri l'avviso ufficiale";
  }
}

/* ------------- Guida operativa per pagine tabellari / senza fonte ------------- */

export interface DatiSuggerimento {
  /** URL della fonte (destinazione del bottone). */
  url?: string | null;
  /** Classe di concorso mostrata (es. `A-022`). */
  classe?: string | null;
  /** Provincia mostrata (es. `Asti (AT)`). */
  provincia?: string | null;
  /** Nome della scuola, se noto. */
  schoolName?: string | null;
  /** Email/PEC di candidatura della scuola, se nota. */
  email?: string | null;
  /**
   * Versione BREVE per il DIGEST giornaliero: un solo periodo, senza la frase
   * sull'email (nel digest il recapito è già mostrato sulla riga precedente).
   * Serve a tenere il riepilogo leggibile senza ripetizioni.
   */
  compatto?: boolean;
}

/**
 * ISTRUZIONE STANDARD per le pagine tabellari/di riepilogo: è la frase richiesta
 * dal prodotto e deve essere IDENTICA in ogni superficie (digest, email, scheda).
 * Costante esportata: unica fonte di verità (e verificabile dai test).
 */
export const ISTRUZIONE_AVVISO_UFFICIALE =
  "Apri l'avviso ufficiale (clicca STAMPA dove possibile, per candidarti)";

/**
 * GUIDA OPERATIVA mostrata sotto l'avviso quando la destinazione è una pagina
 * tabellare/di riepilogo ("Stampa", elenco) oppure quando la fonte ufficiale non
 * è disponibile. Serve a non lasciare l'utente davanti a un elenco senza sapere
 * cosa fare: spiega come trovare la riga giusta e come candidarsi.
 *
 * Ritorna `null` quando la destinazione è una pagina di dettaglio: nessun testo
 * inutile. Non promette mai ciò che la pagina non garantisce.
 *
 * Con `compatto: true` restituisce una sola frase (per il digest giornaliero).
 */
export function suggerimentoRicercaAvviso(dati: DatiSuggerimento = {}): string | null {
  const email = emailAvviso(dati.email);
  const classe = (dati.classe ?? '').trim();
  const provincia = (dati.provincia ?? '').trim();
  const url = (dati.url ?? '').trim();
  const esterna = eLinkEsterno(url);

  if (esterna && !ePaginaRiepilogo(url)) return null; // pagina di dettaglio: nessuna guida

  const dove = [classe ? `«${classe}»` : 'la tua classe di concorso', provincia || null]
    .filter(Boolean)
    .join(' per ');

  // RIEPILOGO/ELENCO con link disponibile: si apre la pagina e si cerca la riga.
  // La direttiva STAMPA è quella standard, sempre identica.
  if (esterna) {
    const cerca = `Cerca la riga con ${dove} e leggi lì date e classi.`;
    if (dati.compatto) return `${ISTRUZIONE_AVVISO_UFFICIALE}; ${cerca.replace(/^Cerca/, 'cerca')}`;
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

  // NESSUNA fonte ufficiale: non c'è nulla da "aprire", si chiede alla segreteria.
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


