/**
 * ScuoleRadar.it — Motore di rilevanza e redazione del Dipartimento Notizie.
 *
 * Riferimento permanente: docs/BLOG_EDITORIAL_GUIDELINES.md
 *
 * Modulo PURO (nessuna dipendenza dalla rete né da Node): valuta le notizie
 * reali in ingresso e applica le regole editoriali STRETTE:
 *  - ZERO rumore: RIFIUTA comunicati stampa, discorsi, interviste, campagne e
 *    qualsiasi annuncio NON vincolante;
 *  - ACCETTA SOLO provvedimenti vincolanti: decreti, ordinanze ministeriali,
 *    note, circolari, bandi e scadenze operative per il personale scolastico
 *    (GPS, Mobilità, Concorsi, Pensioni, Sostegno, …);
 *  - validità giuridica: la notizia deve riferirsi a un atto ufficiale preciso
 *    (Ordinanza Ministeriale, Decreto, articolo di legge), mai a generiche
 *    comunicazioni;
 *  - tetto articoli: MASSIMO `MAX_ARTICOLI_FINESTRA` (6) articoli ad alto valore
 *    nella finestra di lookback di 15 giorni (`FINESTRA_LOOKBACK_GIORNI`) —
 *    ~3 a settimana; se non ci sono provvedimenti vincolanti si pubblicano 0;
 *  - soglia di rilevanza per l'AVVIO ANNO SCOLASTICO: oltre al gate operativo,
 *    la categoria si assegna SOLO se il titolo ha una parola-categoria ufficiale
 *    oppure un termine "FORTE" di avvio anno (`PAROLE_FORTI_INIZIO_ANNO`:
 *    interpelli, supplenze, presa di servizio, reggenze, bollettini…), così si
 *    scartano gli avvisi tecnici/amministrativi generali;
 *  - integrità degli URL: niente mockup né root-domain generici, solo link di
 *    approfondimento reali validati HTTP 200;
 *  - PDF ufficiali: se la fonte è un PDF, il link dedicato deve aprire il PDF
 *    direttamente (target="_blank");
 *  - linguaggio chiaro: acronimi spiegati alla prima menzione, burocrazia
 *    semplificata, zero cliché da chatbot (il blog NON promuove moduli o
 *    template interni).
 */
import type { NewsArticle } from '../types';

export interface ValutazioneNotizia {
  rilevante: boolean;
  categoria: string | null;
  deadline: string | null;
  motivo?: string;
}

export interface VoceInValutazione {
  title: string;
  description?: string;
  /** URL della fonte ufficiale (serve al gate NAZIONALE e agli atti MIM). */
  url?: string;
  /** Data di pubblicazione dichiarata dalla fonte (ISO), se disponibile. */
  data?: string | null;
}

/** Parole che identificano l'ambito/categoria del personale scolastico. */
const PAROLE_CATEGORIA: Record<string, string[]> = {
  'GPS': [
    'gps', 'graduatoria provinciale', 'graduatorie provinciali', 'supplenze',
    'nomina', 'nomine', 'algoritmo', 'algoritmi',
  ],
  'Mobilità': ['mobilità', 'mobilita', 'trasferimento', 'assegnazione provvisoria', 'utilizzazione', 'comma 5'],
  'Concorsi': ['concorso', 'concorsi', 'bando di concorso', 'selezione', 'assunzione', 'immissione in ruolo', 'reclutamento'],
  'Pensioni': ['pensione', 'pensioni', 'cessazione dal servizio', 'riscatto', 'buonuscita', 'quota'],
  'Sostegno': ['sostegno', 'pei', 'inclusione', 'disabilità', 'disabilita', 'bes', 'assistente all’autonomia', 'glo'],
  'Graduatorie': ['graduatoria', 'graduatorie', 'gae', 'gps', 'istanze online'],
  'Supplenze': ['supplenza', 'supplenze', 'incarico', 'interpello', 'mad', 'messa a disposizione'],
  'Scuole': [
    'organico', 'istituzione scolastica', 'anno scolastico', 'calendario scolastico',
    'protocollo d’intesa', 'presa di servizio', 'primo settembre',
  ],
  'PNRR': [
    'pnrr', 'piano nazionale di ripresa e resilienza', 'fondi pnrr', 'bandi pnrr',
    'scuola 4.0', 'nuove competenze',
  ],
  'CCNL': [
    'ccnl', 'contratto collettivo nazionale', 'comparto istruzione e ricerca',
    'area istruzione e ricerca', 'verbale di accordo', 'contrattazione collettiva',
  ],
  'Assegnazioni Provvisorie': ['assegnazioni provvisorie', 'assegnazione provvisoria', 'utilizzazioni'],
  'Ricostruzione Carriera': ['ricostruzione carriera', 'ricostruzione di carriera', 'ricongiunzione'],
  'Riconoscimento Titoli': [
    'riconoscimento titoli', 'riconoscimento dei titoli', 'titolo estero',
    'titoli esteri', 'equipollenza', 'equiparazione',
  ],
};

/** Parole che rendono la notizia OPERATIVA (accettabile). */
const PAROLE_ACCETTA: string[] = [
  'decreto', 'decreto ministeriale', 'd.m.', 'ordinanza', 'nota', 'nota prot.', 'circolare',
  'bando', 'avviso', 'scadenza', 'termine', 'termine ultimo', 'entro il', 'domande',
  'domanda', 'istanza', 'presentazione', 'pubblicato', 'pubblicazione', 'aggiornamento',
  'calendario', 'requisiti', 'modalità', 'modalita', 'graduatoria', 'graduatorie',
  'assunzione', 'assunzioni', 'concorso', 'concorsi', 'reclutamento',
  'mobilità', 'mobilita', 'pensioni', 'supplenze', 'sostegno',
  'rettifica', 'integrazione', 'proroga', 'avviso di avvio', 'apertura delle domande',
  'riserva', 'assegnazione', 'assegnazioni', 'conferimento', 'scelta delle sedi',
  'nomina', 'nomine', 'algoritmo', 'algoritmi', 'presa di servizio', 'primo settembre',
  '1° settembre', 'pnrr', 'bollettini', 'ccnl', 'contratto collettivo',
  'verbale di accordo', 'sottoscrizione', 'riconoscimento', 'equipollenza',
  'ricostruzione', 'riscatto laurea', 'assegnazioni provvisorie', 'sentenza',
  'deciso', 'conciliazione', 'ordinanza cautelare',
  // AVVIO ANNO SCOLASTICO — soglia di rilevanza abbassata: cattura presa di
  // servizio, interpelli, supplenze, nomine, reggenze, assegnazioni, bollettini.
  'interpello', 'interpelli', 'reggenza', 'reggenze', 'supplenza',
  'bollettino', 'assegnazioni', 'presa in servizio',
];

/**
 * Parole "FORTI" dell'avvio anno scolastico: sono la CONDIZIONE NECESSARIA per
 * assegnare la categoria INFERITA quando il titolo non contiene una
 * parola-categoria ufficiale. Servono a scartare gli avvisi tecnici/
 * amministrativi generali (bandi di raffrescamento, enti del Terzo settore,
 * manifestazioni, ecc.) che non interessano a docenti e personale ATA.
 */
export const PAROLE_FORTI_INIZIO_ANNO: string[] = [
  'interpello', 'interpelli', 'supplenza', 'supplenze',
  'presa di servizio', 'presa in servizio', 'reggenza', 'reggenze',
  'bollettino', 'bollettini',
];

/** Parole che segnalano contenuti NON vincolanti (zero rumore: da rifiutare). */
const PAROLE_RIFIUTA: string[] = [
  // Contenuti NON vincolanti: nessun rumore da marketing / press-release.
  'intervista', 'discorso', 'dichiarazione del ministro', 'messaggio del ministro',
  'comunicato stampa', 'conferenza stampa', 'saluto', 'auguri', 'cerimonia',
  'inaugurazione', 'premiazione', 'premio letterario', 'spettacolo', 'esibizione',
  'spot', 'spot pubblicitario', 'campagna di comunicazione', 'campagna social',
  'campagna pubblicitaria', 'iniziativa promozionale', 'webinar', 'seminario',
  'video', 'podcast', 'mostra', 'fiera', 'concorso artistico', 'progetto di lettura',
  'bandiera', 'festa', 'evento sportivo', 'manifestazione', 'sondaggio',
  'ipotesi', 'ipotesi di', 'bozza', 'bozze', 'preliminare', 'preliminari',
  'in preparazione', 'proposta preliminare', 'draft', 'avvio dei lavori preparatori',
  // Protocolli d'intesa, memorandum e visite: diplomazia istituzionale, non
  // notizie operative per docenti e ATA.
  'memorandum', 'incontro bilaterale', 'vertice bilaterale', 'visita ufficiale',
  'dichiarazione congiunta', 'missione istituzionale',
];

/* ============ PERIMETRO NAZIONALE (ScuoleRadar è una piattaforma nazionale) ============ */

/**
 * Siti ACCREDITATI a livello NAZIONALE. ScuoleRadar copre il livello nazionale:
 * MIM (Ministero dell'Istruzione e del Merito), Gazzetta Ufficiale, ARAN
 * (contrattazione), giurisdizione contabile/amministrativa e previdenza.
 * Le pagine REGIONALI (`/web/usr-*`, USR/AT) sono ESCLUSE per policy.
 */
const HOST_NAZIONALI = [
  'mim.gov.it',
  'istruzione.it',
  'gazzettaufficiale.it',
  'aranagenzia.it',
  'corteconti.it',
  'giustizia-amministrativa.it',
  'inps.it',
  'inpa.gov.it',
];

/** True se l'URL appartiene a una fonte NAZIONALE accreditata (e non regionale). */
export function èFonteNazionale(url: string): boolean {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();
    const percorso = parsed.pathname.toLowerCase();
    // Le pagine regionali del MIM (USR) non sono nazionali.
    if (/\/web\/usr-/.test(percorso)) return false;
    return HOST_NAZIONALI.some((h) => host === h || host.endsWith(`.${h}`));
  } catch {
    return false;
  }
}

/** True se l'URL è pubblicato dal MIM (o dal dominio storico istruzione.it). */
export function èFonteMim(url?: string | null): boolean {
  try {
    const host = new URL(url ?? '').hostname.toLowerCase();
    return host.endsWith('mim.gov.it') || host.endsWith('istruzione.it');
  } catch {
    return false;
  }
}

/** Designazione formale di un ATTO ufficiale (provvedimento vincolante). */
const RE_ATTO_UFFICIALE =
  /\b(?:ordinanza\s+ministeriale|decreto\s+(?:ministeriale|direttoriale|dirigenziale|legislativo|del\s+presidente)|d\.?\s*m\.?|d\.?\s*d\.?|d\.?\s*p\.?\s*r\.?|d\.?\s*p\.?\s*c\.?\s*m\.?|legge|nota\s+prot(?:ocollo)?|circolare)\b/;

/** Riferimento NUMERICO dell'atto (n. 1095, 2939/2025, L. 157): rende l'atto
 *  identificabile e verificabile. Senza numero si tratta di cronaca, non di atto.
 *  NB: `(?<![\\d/])` evita di scambiare una DATA `gg/mm/aaaa` per un riferimento
 *  d'atto (es. "04/08/2026" non deve produrre "08/2026"). */
const RE_RIF_ATTO = /(?:\bn\.?\s?\d{1,6}\b)|(?:(?<![\d/])\d{1,4}\/\d{4}\b)/;

/** Finestra (giorni) entro cui un ATTO nazionale è considerato corrente. */
export const FINESTRA_ATTI_NAZIONALI_GIORNI = 45;

/** Parole del COMPARTO SCUOLA (docenti, ATA, dirigenti scolastici…). */
const PAROLE_SCUOLA =
  /(?:istruzione e ricerca|comparto istruzione|scuol|docenti|personale ata|\bata\b|dirigenti scolastici|supplent|graduator|interpell|organico|sostegno|scrutini|valutazion|iscrizion|studenti|alunni|educazione|reclutament|mobilit[aà])/;

/* ============ GIORNALISMO UTILE: burocrazia vuota fuori, impatto dentro ============ */

/**
 * Designazione FORMALE di un atto/avviso amministrativo (l'inizio tipico dei
 * titoli "burocratici" copiati dalle fonti): decreto, ordinanza, nota,
 * circolare, DPR, DPCM, D.L., comunicato, delibera, determina.
 */
const RE_DESIGNAZIONE_ATTO =
  /^\s*(?:d\.?\s*p\.?\s*r\.?|d\.?\s*p\.?\s*c\.?\s*m\.?|d\.?\s*l\.?|decreto(?:\s+(?:ministeriale|direttoriale|dirigenziale|legislativo|del\s+presidente))?|ordinanza(?:\s+ministeriale)?|nota(?:\s+prot(?:ocollo)?\.?)?|circolare|comunicato|delibera|determina|avviso)\b/i;

/** Riferimento formale (numero e/o data) tipico dei titoli svuotati. */
const RE_RIFERIMENTO_ATTO =
  /\bn\.?\s*\d+|(?:\bdel(?:l['’])?\s*\d{1,2}\s+[a-zà-ù]+)|(?:\b\d{1,2}\/\d{1,2}\/\d{2,4}\b)|(?:\b(?:19|20)\d{2}\b)/i;

/**
 * Parole di IMPATTO PRATICO per chi lavora a scuola: se compaiono nel titolo,
 * la notizia merita di essere raccontata anche senza una parola-categoria
 * ufficiale (welfare e polizza sanitaria del personale, formazione ATA,
 * sicurezza, organico, stipendi…).
 */
const PAROLE_IMPATTO =
  /(?:stipend|paga|retribuzion|indennit|contratt|ccnl|welfare|polizza|sanitari|previdenz|contributiv|formazione|aggiornamento professionale|abilitazione|specializzazione|sicurezza|edilizia|digitalizzazione|organico|cattedre|classi|iscrizion|scrutini|esam[ei]|valutazion|orientamento|inclusione|bullismo|tutor|supplent|interpell|graduator|mobilit[aà]|trasferiment|assegnazion|nomine|assunzion|reclutament|pension|riscatto|ricostruzione|concors|reggenz|comandi|utilizzazion|permessi|aspettativa|telelavoro)/i;

/**
 * TITOLO DI BUROCRAZIA VUOTA: è SOLO il riferimento formale di un atto
 * ("Decreto Direttoriale n. 1095 del 10 settembre 2026", "Ordinanza
 * Ministeriale n. 163 del 7 agosto 2026") e non contiene NIENTE di ciò che
 * cambia la giornata di un docente o di un ATA. Questi contenuti NON si
 * pubblicano: il blog non fa da Gazzetta Ufficiale.
 */
export function attoBurocraticoVuoto(titolo?: string | null): boolean {
  const t = (titolo ?? '').replace(/\s+/g, ' ').trim();
  if (!t) return false;
  if (!RE_DESIGNAZIONE_ATTO.test(t)) return false;
  if (PAROLE_IMPATTO.test(t)) return false;
  return RE_RIFERIMENTO_ATTO.test(t);
}

/**
 * TITOLO INFORMATIVO: dice CHI/CHE COSA. Titoli-lista come "Concorso",
 * "Avviso", "Comunicazione" non diventano notizie: non dicono nulla al lettore.
 */
export function titoloInformativo(titolo?: string | null): boolean {
  const t = (titolo ?? '').replace(/\s+/g, ' ').trim();
  if (t.length < 25) return false;
  const significative = t.split(/\s+/).filter((w) => w.replace(/[^\p{L}\p{N}]/gu, '').length >= 4);
  return significative.length >= 4;
}

/** Categorie "di impatto" per argomento (la prima che corrisponde vince). */
const CATEGORIE_IMPATTO: Array<{ categoria: string; parole: string[] }> = [
  {
    categoria: 'CCNL',
    parole: ['contratto', 'ccnl', 'stipend', 'retribuzion', 'indennit'],
  },
  {
    categoria: 'Pensioni',
    parole: ['previdenz', 'contributiv', 'pension', 'riscatto'],
  },
  {
    categoria: 'PNRR',
    parole: ['pnrr', 'pon ', 'fondi', 'finanziament', 'edilizia', 'digitalizzazione'],
  },
  {
    categoria: 'Scuole',
    parole: [
      'welfare', 'polizza', 'sanitari', 'formazione', 'aggiornamento professionale',
      'sicurezza', 'organico', 'cattedre', 'iscrizion', 'orientamento',
      'inclusione', 'bullismo',
    ],
  },
];

/**
 * RIFERIMENTI OBSOLETI: il testo cita solo anni vecchi (es. "Avviso n. 33 del
 * 06/07/2020") e la FONTE non dichiara una data recente → è materiale
 * d'archivio rispolverato dagli elenchi: non si pubblica come novità.
 */
export function riferimentiObsoleti(
  testo: string,
  dataFonte?: string | null,
  oggi: Date = new Date(),
): boolean {
  const t = (testo ?? '').toLowerCase();
  const anni = [...t.matchAll(/\b(?:19|20)\d{2}\b/g)].map((m) => Number(m[0]));
  const annoTesto = anni.length > 0 ? Math.max(...anni) : null;
  const annoCorrente = oggi.getUTCFullYear();

  const data = dataFonte ? new Date(dataFonte) : null;
  const annoFonte = data && !Number.isNaN(data.getTime()) ? data.getUTCFullYear() : null;

  // Vecchio se il riferimento più recente nel testo è di oltre un anno fa…
  if (annoTesto !== null && annoTesto < annoCorrente - 1) {
    // …e la fonte NON attesta una pubblicazione recente.
    return !(annoFonte !== null && annoFonte >= annoCorrente - 1);
  }
  return false;
}

/** Categoria dedotta dall'IMPATTO del titolo (o null se non riconosciuto). */
export function categoriaDaImpatto(testo: string): string | null {
  const t = (testo ?? '').toLowerCase();
  if (!t || t.length < 20) return null;
  for (const { categoria, parole } of CATEGORIE_IMPATTO) {
    if (parole.some((p) => t.includes(p))) return categoria;
  }
  return null;
}

/** Data breve italiana (UTC) per l'urgenza nel titolo: "16 lug". */
function dataBreveIt(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const mesi = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic'];
  return `${d.getUTCDate()} ${mesi[d.getUTCMonth()]}`;
}

/**
 * Riscrive il titolo in chiave AZIONE ("che cosa cambia per me"): elimina le
 * intestazioni e le code burocratiche, tiene il SOGGETTO della notizia e,
 * quando esiste, aggiunge l'urgenza con la scadenza. Non inventa nulla: se la
 * pulizia svuota il titolo, torna l'originale.
 */
export function titoloAzione(
  titolo: string,
  categoria?: string | null,
  deadline?: string | null,
): string {
  const originale = (titolo ?? '').replace(/\s+/g, ' ').trim();
  let t = originale;

  // 1) Via l'intestazione burocratica: designazione + numero + data.
  t = t.replace(
    /^\s*(?:d\.?\s*p\.?\s*r\.?|d\.?\s*p\.?\s*c\.?\s*m\.?|d\.?\s*l\.?|decreto(?:\s+(?:ministeriale|direttoriale|dirigenziale|legislativo|del\s+presidente))?|ordinanza(?:\s+ministeriale)?|nota(?:\s+prot(?:ocollo)?\.?)?|circolare|comunicato|delibera|determina)\s*(?:n\.?\s*\d+)?(?:\s*del(?:l['’])?\s*\d{1,2}\s+[a-zà-ù]+\s+\d{4})?\s*[-–—:]\s*/i,
    '',
  );

  // 2) Via le code burocratiche ("— Pubblicazione dell'Ordinanza Ministeriale").
  t = t.replace(
    /\s*[-–—:]\s*(?:pubblicazione|pubblicato|trasmissione|comunicazione|decreto|ordinanza|nota|avviso)\b[^.]*$/i,
    '',
  );

  // 3) Pulizia e salvagente: mai svuotare o stravolgere il titolo.
  t = t
    .replace(/^[\s\-–—:.,;]+|[\s\-–—:.,;]+$/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
  if (t.length < Math.min(20, originale.length)) t = originale;
  t = t.charAt(0).toUpperCase() + t.slice(1);

  // 4) Categoria in testa solo se aiuta (titolo che inizia in modo generico).
  const cat = (categoria ?? '').trim();
  const categorieChiare = [
    'GPS', 'Supplenze', 'Concorsi', 'Mobilità', 'Graduatorie', 'Pensioni', 'CCNL', 'PNRR', 'Sostegno',
  ];
  if (
    cat &&
    categorieChiare.includes(cat) &&
    !t.toLowerCase().includes(cat.toLowerCase()) &&
    /^(?:aggiornamento|avviso|nota|comunicazione|nuove|nuovo|disposizioni|indicazioni|modalità)\b/i.test(t)
  ) {
    t = `${cat}: ${t}`;
  }

  // 5) Urgenza: la scadenza va in fondo, solo se la fonte la dichiara davvero.
  const conScadenza = /(?:entro|scadenz|termine|domand|istanz|candidatur)/i.test(
    `${originale} ${t}`,
  );
  if (deadline && conScadenza && !t.toLowerCase().includes('entro il')) {
    t = `${t.replace(/[.\s]+$/, '')} — domande entro il ${dataBreveIt(deadline)}`;
  }

  return t.length >= 12 ? t : originale;
}

const MESI_ITALIANI: Record<string, number> = {
  gennaio: 1, febbraio: 2, marzo: 3, aprile: 4, maggio: 5, giugno: 6,
  luglio: 7, agosto: 8, settembre: 9, ottobre: 10, novembre: 11, dicembre: 12,
};

/**
 * Estrae la data di scadenza (ISO YYYY-MM-DD) da un testo, se dichiarata.
 * Gestisce anche ordinali ("1°luglio") e l'anno implicito (si usa l'anno
 * corrente quando non dichiarato, come accade nei titoli recenti del MIM).
 */
export function estraiDeadline(testo: string, oggi: Date = new Date()): string | null {
  const t = testo.toLowerCase();
  const nomiMesi = Object.keys(MESI_ITALIANI).join('|');
  const re = new RegExp(
    `(?:entro il|scadenza|scade il|termine ultimo|termine)?\\s*(\\d{1,2})\\s*(?:°|º|a)?\\s*(${nomiMesi})\\s*(\\d{4})?`,
    'g',
  );
  let match: RegExpExecArray | null;
  let ultima: string | null = null;
  while ((match = re.exec(t)) !== null) {
    const mese = MESI_ITALIANI[match[2]];
    if (!mese) continue;
    const anno = match[3] ? Number(match[3]) : oggi.getUTCFullYear();
    const d = new Date(Date.UTC(anno, mese - 1, Number(match[1])));
    if (!Number.isNaN(d.getTime())) ultima = d.toISOString().slice(0, 10);
  }
  if (ultima) return ultima;

  // Formato numerico gg/mm/aaaa.
  const numerica = t.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (numerica) {
    const d = new Date(Date.UTC(Number(numerica[3]), Number(numerica[2]) - 1, Number(numerica[1])));
    if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  }
  return null;
}

/** Classifica la categoria di appartenenza (per il personale scolastico). */
export function classificaCategoria(testo: string): string | null {
  const t = testo.toLowerCase();
  for (const [categoria, parole] of Object.entries(PAROLE_CATEGORIA)) {
    if (parole.some((p) => t.includes(p))) return categoria;
  }
  return null;
}

/**
 * Categorie di FALLBACK per l'AVVIO dell'anno scolastico: quando il titolo è
 * chiaramente operativo (interpelli, supplenze, nomine, reggenze, presa di
 * servizio…) ma non contiene una parola-categoria mappata, si assegna la
 * categoria più coerente. Il gate operativo resta comunque obbligatorio.
 */
const CATEGORIE_INIZIO_ANNO: Array<{ categoria: string; parole: string[] }> = [
  {
    categoria: 'Supplenze',
    parole: [
      'interpello', 'interpelli', 'supplenza', 'supplenze', 'nomina', 'nomine',
      'reggenza', 'reggenze', 'messa a disposizione', 'contratto a tempo determinato',
    ],
  },
  {
    categoria: 'Graduatorie',
    parole: ['bollettino', 'bollettini', 'graduatoria', 'graduatorie'],
  },
  {
    categoria: 'Scuole',
    parole: [
      'presa di servizio', 'presa in servizio', 'avvio anno scolastico',
      'inizio anno scolastico', 'calendario scolastico', 'assegnazione',
      'assegnazioni', 'conferimento',
    ],
  },
];

/** Categoria inferita per l'avvio dell'anno scolastico (o null se non deducibile). */
function categoriaInizioAnno(testo: string): string | null {
  for (const { categoria, parole } of CATEGORIE_INIZIO_ANNO) {
    if (parole.some((p) => testo.includes(p))) return categoria;
  }
  return null;
}

/**
 * Valuta la rilevanza editoriale di una notizia in ingresso.
 * Regola: niente contenuti non vincolanti; solo provvedimenti, note e
 * scadenze operative per il personale scolastico.
 *
 * SOGLIA (avvio anno scolastico): resta obbligatorio il gate OPERATIVO (almeno
 * una parola di `PAROLE_ACCETTA`). La categoria si assegna SOLO se:
 *   1. il titolo contiene una parola-categoria ufficiale (`PAROLE_CATEGORIA`); oppure
 *   2. contiene un termine "FORTE" di avvio anno (`PAROLE_FORTI_INIZIO_ANNO`) →
 *      categoria inferita (`CATEGORIE_INIZIO_ANNO`, fallback 'Scuole').
 * In assenza di entrambi, l'avviso viene SCARTATO: sono gli avvisi tecnici/
 * amministrativi generali che non interessano a docenti e ATA. Il filtro
 * anti-rumore (`PAROLE_RIFIUTA`) resta pienamente attivo.
 */
export function valutaRilevanza(voce: VoceInValutazione): ValutazioneNotizia {
  const testo = `${voce.title} ${voce.description ?? ''}`.toLowerCase();

  for (const parola of PAROLE_RIFIUTA) {
    if (testo.includes(parola)) {
      return {
        rilevante: false,
        categoria: null,
        deadline: null,
        motivo: `Contenuto non vincolante rilevato ("${parola}")`,
      };
    }
  }

  // 0) BUROCRAZIA VUOTA: un titolo che è SOLO il riferimento formale di un atto
  //    ("Decreto Direttoriale n. 1095 del 10 settembre 2026", "Ordinanza
  //    Ministeriale n. 163 del 7 agosto 2026") non dice al lettore che cosa
  //    cambia: fuori dal blog, che non fa da Gazzetta Ufficiale.
  if (attoBurocraticoVuoto(voce.title)) {
    return {
      rilevante: false,
      categoria: null,
      deadline: null,
      motivo: 'Atto burocratico senza contenuto: nessun impatto pratico per docenti e ATA',
    };
  }

  // 0-bis) MATERIALE D'ARCHIVIO: riferimenti solo a vecchi anni (avvisi 2019/
  //    2020 rispolverati dagli elenchi) senza una fonte recente → fuori.
  if (riferimentiObsoleti(`${voce.title} ${voce.description ?? ''}`, voce.data)) {
    return {
      rilevante: false,
      categoria: null,
      deadline: null,
      motivo: 'Contenuto d\'archivio (riferimenti obsoleti, nessuna attualità)',
    };
  }

  // 0-ter) TITOLO INFORMATIVO: un titolo che non dice NULLA (es. "Concorso",
  //    "Avviso", "Comunicazione") non può diventare una notizia: si scarta
  //    (nessun titolo pigro copiato dalle liste delle fonti).
  if (!titoloInformativo(voce.title)) {
    return {
      rilevante: false,
      categoria: null,
      deadline: null,
      motivo: 'Titolo senza contenuto informativo: non dice che cosa cambia',
    };
  }

  // 1) Categoria UFFICIALE mappata: specifica per il personale scolastico.
  const categoriaMappata = classificaCategoria(testo);
  if (categoriaMappata) {
    // I contratti collettivi valgono SOLO per il comparto SCUOLA: i CCNL di
    // Sanità, Funzioni Locali, Presidenza del Consiglio… non interessano a
    // docenti e ATA (ScuoleRadar è una piattaforma nazionale per la scuola).
    if (categoriaMappata === 'CCNL' && !PAROLE_SCUOLA.test(testo)) {
      return {
        rilevante: false,
        categoria: null,
        deadline: null,
        motivo: 'Contratto non pertinente al comparto scuola',
      };
    }
    return { rilevante: true, categoria: categoriaMappata, deadline: estraiDeadline(testo) };
  }

  // 2) IMPATTO PRATICO: la notizia cambia qualcosa per chi lavora a scuola
  //    (welfare e polizza sanitaria del personale, formazione ATA, sicurezza,
  //    organico, iscrizioni…): si racconta anche senza una parola-categoria
  //    ufficiale e senza una parola "operativa" da burocrazia.
  const categoriaImpatto = categoriaDaImpatto(voce.title);
  if (categoriaImpatto && PAROLE_IMPATTO.test(voce.title)) {
    return { rilevante: true, categoria: categoriaImpatto, deadline: estraiDeadline(testo) };
  }

  // 3) Rete di sicurezza: avviso OPERATIVO con un termine "FORTE" di avvio anno.
  const operativa = PAROLE_ACCETTA.some((p) => testo.includes(p));
  if (operativa && PAROLE_FORTI_INIZIO_ANNO.some((p) => testo.includes(p))) {
    return {
      rilevante: true,
      categoria: categoriaInizioAnno(testo) ?? 'Scuole',
      deadline: estraiDeadline(testo),
    };
  }

  return {
    rilevante: false,
    categoria: null,
    deadline: null,
    motivo: 'Avviso tecnico/amministrativo generale non pertinente a docenti e ATA',
  };
}

/**
 * Helper per la valutazione con LLM (filtro editoriale assistito).
 * Produce il prompt da inviare al modello per ottenere una validazione
 * strutturata JSON delle notizie raccolte (vedi docs/BLOG_EDITORIAL_GUIDELINES.md).
 */
export function promptFiltroLLM(voci: VoceInValutazione[]): string {
  return `Sei il filtro editoriale del servizio Notizie di ScuoleRadar per i docenti italiani.

REGOLE VINCOLANTI (strict editorial guidelines):
1) ZERO RUMORE: rifiuta discorsi, interviste, dichiarazioni non vincolanti, comunicati stampa, campagne di comunicazione ed eventi promozionali. Accetta SOLO provvedimenti VINCOLANTI per il personale scolastico: decreti, ordinanze ministeriali, note, circolari, bandi, avvisi e scadenze operative (GPS, mobilità, concorsi, pensioni, sostegno, supplenze, graduatorie).
2) VALIDITÀ GIURIDICA: la notizia DEVE riferirsi a un atto ufficiale preciso (Ordinanza Ministeriale, Decreto, articolo di legge, nota protocollata). Se titolo/descrizione non citano un riferimento ufficiale specifico, rilevanza = false.
3) CAPACITÀ SETTIMANALE: al massimo 3 articoli ad alto valore per settimana. Se nessun provvedimento è vincolante, la risposta deve avere "items" vuoti (0 articoli pubblicati).
4) CATEGORIA: una tra GPS, Mobilità, Assegnazioni Provvisorie, Concorsi, Pensioni, Ricostruzione Carriera, Riconoscimento Titoli, CCNL, Sostegno, Graduatorie, Supplenze, Scuole, PNRR.
5) DEADLINE: la data di scadenza ufficiale in formato ISO (YYYY-MM-DD) se presente, altrimenti null.

Rispondi SOLO in JSON:
{"items":[{"rilevante":bool,"categoria":"...","deadline":"YYYY-MM-DD"|null}]}

Notizie da valutare:
${voci.map((v) => `- ${v.title} | ${v.description ?? ''}`).join('\n')}`;
}

/** Punteggio di rilevanza 0-100 per l'ordinamento. */
export function punteggioRilevanza(categoria: string | null, hasDeadline: boolean): number {
  const priorita: Record<string, number> = {
    GPS: 95,
    Concorsi: 90,
    Sostegno: 88,
    Mobilità: 85,
    'Assegnazioni Provvisorie': 86,
    CCNL: 84,
    Pensioni: 82,
    Supplenze: 80,
    PNRR: 80,
    Graduatorie: 78,
    'Ricostruzione Carriera': 76,
    'Riconoscimento Titoli': 74,
    Scuole: 70,
  };
  const base = categoria ? (priorita[categoria] ?? 65) : 60;
  return Math.min(100, base + (hasDeadline ? 8 : 0));
}

/** Tetto settimanale "di riferimento": ~3 articoli ad alto valore a settimana. */
export const MAX_ARTICOLI_SETTIMANA = 3;

/**
 * Finestra di LOOKBACK (giorni) della pipeline Notizie: copre l'avvio
 * dell'anno scolastico (presa di servizio, interpelli, supplenze…). Le notizie
 * pubblicate oltre questa finestra non vengono acquisite; le voci senza data
 * restano ammesse (non dimostrabili come "vecchie").
 */
export const FINESTRA_LOOKBACK_GIORNI = 15;

/**
 * Finestra di lookback per gli ATTI NAZIONALI STRUTTURALI (contratti collettivi,
 * decreti e ordinanze ministeriali): un CCNL firmato o un decreto nazionale
 * restano vincolanti per mesi, quindi una finestra di 15 giorni li
 * scarterebbe. NON si applica alle pagine di notizie quotidiane.
 */
export const FINESTRA_LOOKBACK_NAZIONALE_GIORNI = 60;

/**
 * Tetto articoli ad alto valore nella finestra di lookback: ~3 a settimana su
 * 15 giorni → 6 (copre le due settimane di avvio anno scolastico).
 */
export const MAX_ARTICOLI_FINESTRA = 6;

/**
 * Portali istituzionali il cui dominio RADICE È la destinazione operativa del
 * servizio (l'utente accede da lì): esenti dal divieto di "root-domain".
 * Per TUTTI gli altri domini vale il divieto assoluto di homepage generiche
 * (vedi docs/BLOG_EDITORIAL_GUIDELINES.md, sez. 5).
 */
const PORTALI_SERVIZIO = new Set<string>([
  'https://www.inpa.gov.it', // Portale del Reclutamento (InPA)
  'https://www.inps.it', // Portale INPS
]);

/** Segnali di URL segnaposto/mockup: vietati nei link pubblicati. */
const SEGNALI_MOCKUP = [
  'example.com', 'example.org', 'localhost', 'mockup', 'placeholder',
  'yourdomain', 'lorem-ipsum', '.test', ':3000', ':5173',
];

/**
 * Segnali di pagine generiche di ACCESSO (login / area riservata): non sono
 * contenuti informativi e vengono scartate (anti-rumore, es. `/aran/login`).
 */
const SEGNALI_LOGIN = [
  '/login', '/log-in', '/signin', '/sign-in', '/accedi',
  '/area-riservata', '/areariservata', '/area_riservata', '/accesso-riservato',
];

/** True se l'URL punta a un file PDF (es. fonte ufficiale in PDF). */
export function èLinkPdf(url: string): boolean {
  try {
    return new URL(url).pathname.toLowerCase().endsWith('.pdf');
  } catch {
    return false;
  }
}

/**
 * Percorsi generici che NON sono un articolo/atto specifico: usati come
 * radice di fallback (homepage, liste notizie, indici). Vietati come
 * `official_source_url` ("Leggi la fonte ufficiale" deve puntare all'articolo).
 */
const PERCORSI_GENERICI = new Set([
  '', '/', '/home', '/home.html', '/index', '/index.html',
  '/notizie', '/news', '/news.html', '/comunicati', '/atti',
  '/atti-pubblici', '/web/guest', '/web/guest/home', '/web/guest/notizie',
  '/web/guest/ricerca',
]);

/**
 * Slug delle PAGINE OPERATIVE delle USR/MIM pubblicate a `/web/<sito>/<slug>`
 * (senza il segmento Liferay `/-/`): sono la destinazione corrente e stabile
 * di provvedimenti per il personale scolastico (elenchi interpelli, mobilità,
 * concorsi, graduatorie, calendario regionale…). A differenza delle homepage e
 * delle pagine di elenco generiche, hanno un contenuto operativo specifico e
 * vengono accettate come fonte canonica (il gate di rilevanza le filtra comunque).
 */
const RE_SLUG_OPERATIVO =
  /interpell|supplenz|graduator|concors|reclutament|assunz|mobilita|assegnazion|nomine?|reggenz|avvis|selezion|contratt|personale|organico|trasferiment|pension|sostegno|calendario-scolastic|prese-di-servizio|ricerca-supplenti/;

/**
 * True se l'URL è una FONTE CANONICA (il singolo articolo/atto) e non una
 * pagina generica del sito (es. `https://www.mim.gov.it/web/guest/home`).
 * Per il dominio MIM (incluse le pagine USR regionali) sono accettati:
 *   1. gli articoli canonici Liferay `/web/<sito>/-/<slug>` — es.
 *      `/web/guest/-/…` oppure `/web/usr-lombardia/-/…`;
 *   2. le PAGINE OPERATIVE delle USR `/web/<sito>/<slug>` (es.
 *      `/web/usr-lombardia/interpelli-ricerca-supplenti`), che dal 2026 sono la
 *      destinazione stabile di interpelli/concorsi/graduatorie: senza questo
 *      caso la pipeline non trova più alcuna fonte nuova (stallo).
 * Homepage, indici e pagine di elenco generiche restano sempre escluse.
 */
export function èFonteCanonica(url: string): boolean {
  try {
    const parsed = new URL(url);
    let percorso = parsed.pathname.toLowerCase();
    if (percorso.length > 1 && percorso.endsWith('/')) percorso = percorso.slice(0, -1);
    if (PERCORSI_GENERICI.has(percorso)) return false;
    // MIM + siti regionali (USR)
    if (parsed.hostname.endsWith('mim.gov.it')) {
      // 1. Articolo canonico Liferay.
      if (/\/web\/[^/]+\/-\/.+/.test(percorso)) return true;
      // 2. Pagina operativa USR/MIM: `/web/<sito>/<slug-operativo>`.
      const m = percorso.match(/^\/web\/[^/]+\/([^/]+)$/);
      return Boolean(m && RE_SLUG_OPERATIVO.test(m[1]));
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Controllo PURO (senza rete) di integrità di un link ufficiale:
 *  - solo http(s);
 *  - mai root-domain generici (es. https://www.mim.gov.it/) a meno che il
 *    dominio non sia un portale di servizio esplicitamente autorizzato;
 *  - mai segnaposto/mockup;
 *  - mai pagine generiche di login/area riservata.
 * Ritorna null se valido, altrimenti una stringa col motivo del rifiuto.
 */
export function validaUrlDeepLink(url: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return 'URL non valido';
  }
  if (!/^https?:$/.test(parsed.protocol)) return 'Solo URL HTTP(S)';
  const indizi = `${parsed.hostname}${parsed.pathname}${parsed.search}`.toLowerCase();
  if (SEGNALI_MOCKUP.some((m) => indizi.includes(m))) {
    return 'URL segnaposto/mockup non consentito';
  }
  // Anti-rumore: le pagine di login/area riservata non sono contenuti informativi.
  const percorso = parsed.pathname.toLowerCase();
  if (SEGNALI_LOGIN.some((s) => percorso.includes(s))) {
    return 'Pagina di login/area riservata non consentita';
  }
  const radiceNuda = parsed.pathname === '' || parsed.pathname === '/';
  if (radiceNuda && !PORTALI_SERVIZIO.has(parsed.origin)) {
    return `Root-domain generico non consentito (${parsed.origin}/)`;
  }
  return null;
}

/**
 * Applica il tetto articoli: al massimo `max` articoli con data di
 * pubblicazione nella finestra di lookback (`FINESTRA_LOOKBACK_GIORNI`, 15 gg).
 * Gli articoli più rilevanti (punteggio, poi data) vengono tenuti; gli esuberi
 * sono scartati. Gli articoli più vecchi della finestra non vengono toccati
 * (accumulo).
 */
export function limitaArticoliSettimanali(
  articoli: NewsArticle[],
  oggi: Date = new Date(),
  max: number = MAX_ARTICOLI_FINESTRA,
): { mantenuti: NewsArticle[]; rimossi: NewsArticle[] } {
  const soglia = oggi.getTime() - FINESTRA_LOOKBACK_GIORNI * 24 * 60 * 60 * 1000;
  const recenti: NewsArticle[] = [];
  const storici: NewsArticle[] = [];
  for (const a of articoli) {
    const t = a.published_at ? new Date(a.published_at).getTime() : Number.NaN;
    // Gli articoli SENZA data di fonte (pagine operative USR "evergreen") vanno
    // negli storici: NON consumano il tetto settimanale. Se li trattassimo come
    // recenti occuperebbero tutti gli slot del cap (max 6) bloccando ogni nuovo
    // articolo → bacheca "ferma".
    if (!Number.isNaN(t) && t >= soglia) recenti.push(a);
    else storici.push(a);
  }
  recenti.sort(
    (a, b) =>
      b.relevance_score - a.relevance_score ||
      (b.published_at || '').localeCompare(a.published_at || ''),
  );
  const tenuti = recenti.slice(0, max);
  const rimossi = recenti.slice(max);
  return { mantenuti: [...storici, ...tenuti], rimossi };
}

/* ---------------------- Cadenza settimanale (1–3 / settimana) ---------------------- */

/**
 * CADENZA SETTIMANALE BLOCCATA (1–3 articoli/settimana): mantiene al massimo
 * `max` articoli **datati** nella finestra di 7 giorni; gli altri articoli
 * recenti vengono scartati, mentre lo storico (più vecchio di 7 giorni) resta
 * intatto e non consuma la cadenza.
 *
 * Criterio di scelta: prima la **data più recente**, poi il punteggio. La
 * freschezza vince: il feed mostra sempre gli aggiornamenti nazionali del
 * momento (`newsArticles` è ordinato per data decrescente).
 */
export function limitaCadenzaSettimanale(
  articoli: NewsArticle[],
  oggi: Date = new Date(),
  max: number = MAX_ARTICOLI_SETTIMANA,
): { mantenuti: NewsArticle[]; rimossi: NewsArticle[] } {
  const soglia = oggi.getTime() - 7 * 24 * 60 * 60 * 1000;
  const recenti: NewsArticle[] = [];
  const storici: NewsArticle[] = [];
  for (const a of articoli) {
    const t = a.published_at ? new Date(a.published_at).getTime() : Number.NaN;
    if (!Number.isNaN(t) && t >= soglia) recenti.push(a);
    else storici.push(a);
  }
  recenti.sort(
    (a, b) =>
      (b.published_at || '').localeCompare(a.published_at || '') ||
      b.relevance_score - a.relevance_score,
  );
  return { mantenuti: [...storici, ...recenti.slice(0, max)], rimossi: recenti.slice(max) };
}

/** Valida la coerenza di un articolo costruito prima dell'inserimento. */
export function articoloValido(a: NewsArticle): boolean {
  const base =
    Boolean(a.id) &&
    Boolean(a.title) &&
    Boolean(a.official_source_url) &&
    a.official_source_url.startsWith('http');
  if (!base) return false;
  const motivo = validaUrlDeepLink(a.official_source_url);
  if (motivo) {
    console.warn(`✗ Articolo scartato (${a.id}): URL fonte non valido — ${motivo}`);
    return false;
  }
  if (!èFonteCanonica(a.official_source_url)) {
    console.warn(
      `✗ Articolo scartato (${a.id}): la fonte non è un URL canonico di articolo — ${a.official_source_url}`,
    );
    return false;
  }
  // PERIMETRO NAZIONALE: fuori le fonti regionali/locali (es. pagine USR
  // `/web/usr-*`): ScuoleRadar pubblica solo copertura nazionale (MIM, Gazzetta
  // Ufficiale, ARAN, giurisdizione). L'igiene dell'archivio rimuove le voci
  // regionali già presenti.
  if (!èFonteNazionale(a.official_source_url)) {
    console.warn(
      `✗ Articolo scartato (${a.id}): fonte non nazionale — ${a.official_source_url}`,
    );
    return false;
  }
  return true;
}


/* --------------------- Generazione articoli editoriali --------------------- */

export interface DatiArticoloEditoriale {
  title: string;
  categoria: string | null;
  deadline: string | null;
  fonte: string;
  descrizione?: string;
  /** URL ufficiale della fonte (per il link contestuale nel testo). */
  official_url?: string | null;
}

interface ArticoloCopy {
  /** Apertura già completa che termina con "…con l'avviso"; il titolo viene appeso in «…». */
  fatto: string;
  chi: string;
  pratica: string;
  /** Come agire: la menzione del portale ufficiale è segnata con %LINK% e diventa un <a> cliccabile. */
  come: string;
  /** Etichetta del link al portale ufficiale usata in `come` (es. "Istanze Online"). */
  linkLabel: string;
  /** Nome del portale per la frase di fallback quando la scadenza non è ancora dichiarata. */
  portale: string;
}

const ARTICOLO_BASE: Record<string, ArticoloCopy> = {
  'GPS': {
    fatto:
      'Il Ministero dell\u2019Istruzione e del Merito (MIM) ha aperto la procedura per l\u2019aggiornamento e l\u2019inserimento nelle Graduatorie Provinciali per le Supplenze (GPS, le liste da cui le scuole convocano i docenti per gli incarichi annuali), con la pubblicazione dell\u2019avviso',
    chi:
      'docenti e aspiranti docenti che devono aggiornare punteggi e titoli o entrare in graduatoria',
    pratica:
      'La posizione in GPS decide l\u2019ordine delle convocazioni per gli incarichi dell\u2019anno: un punteggio sbagliato o un titolo non dichiarato si riflette su tutte le chiamate successive.',
    come:
      'La domanda si presenta esclusivamente online, dal portale %LINK% con identità digitale SPID (Sistema Pubblico di Identità Digitale) o CIE (Carta d\u2019Identità Elettronica). Prima dell\u2019invio controlla con calma la sezione dei punteggi e conserva la ricevuta di presentazione.',
    linkLabel: 'Istanze Online',
    portale: 'Istanze Online',
  },
  'Mobilità': {
    fatto:
      'Il Ministero dell\u2019Istruzione e del Merito (MIM) ha pubblicato date e modalità della mobilità annuale del personale scolastico, con l\u2019avviso',
    chi:
      'docenti di ruolo che chiedono un trasferimento, un passaggio di cattedra o un rientro nella provincia di origine',
    pratica:
      'La domanda si compila sulla base delle preferenze e delle precedenze riconosciute: vincoli triennali e precedenze di legge possono cambiare l\u2019esito della richiesta.',
    come:
      'La procedura si svolge interamente online dal portale %LINK% con accesso SPID o CIE. Controlla la finestra temporale e allega la documentazione che certifica le precedenze.',
    linkLabel: 'Istanze Online',
    portale: 'Istanze Online',
  },
  'Concorsi': {
    fatto:
      'È stato pubblicato un bando di concorso per l\u2019accesso o il passaggio di ruolo nella scuola, con l\u2019avviso',
    chi:
      'candidati in possesso dei requisiti indicati nel bando per la classe di concorso di interesse',
    pratica:
      'La selezione prevede una o più prove e la valutazione dei titoli: conviene leggere il bando per intero prima di compilare la domanda, perché requisiti e modalità cambiano di bando in bando.',
    come:
      'La domanda si presenta online dal portale %LINK% (Portale del Reclutamento della Pubblica Amministrazione) con accesso SPID o CIE, entro i termini indicati nel bando. Predisponi in anticipo i titoli e l\u2019autocertificazione.',
    linkLabel: 'InPA',
    portale: 'InPA',
  },
  'Pensioni': {
    fatto:
      'Il Ministero dell\u2019Istruzione e del Merito (MIM) e l\u2019INPS (Istituto Nazionale della Previdenza Sociale) hanno aggiornato le procedure per la cessazione dal servizio e le domande di pensione del personale scolastico, con l\u2019avviso',
    chi:
      'personale scolastico che intende cessare dal servizio o deve regolarizzare la propria posizione contributiva',
    pratica:
      'La domanda di cessazione segue finestre e requisiti precisi: un errore nei tempi può far slittare l\u2019intera decorrenza della pensione.',
    come:
      'La domanda si presenta sul portale %LINK% con identità SPID o CIE. Controlla la posizione contributiva e, se serve, presenta la domanda di riscatto o ricongiunzione.',
    linkLabel: 'dell\u2019INPS',
    portale: 'INPS',
  },
};

function escapeHtmlEditoriale(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formattaDataItaliana(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('it-IT', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  } catch {
    return iso;
  }
}


const ARTICOLO_ALTRE: Record<string, ArticoloCopy> = {
  'Sostegno': {
    fatto:
      'Il Ministero dell\u2019Istruzione e del Merito (MIM) ha aggiornato le indicazioni sull\u2019assegnazione delle ore di sostegno e sulla documentazione di inclusione, con la circolare',
    chi: 'consigli di classe, docenti di sostegno, GLO (Gruppo di Lavoro Operativo) e famiglie',
    pratica:
      'La documentazione di inclusione \u2014 il PEI (Piano Educativo Individualizzato), i verbali e le osservazioni \u2014 va predisposta e verificata nei tempi previsti: le verifiche del GLO scandiscono l\u2019intero anno scolastico.',
    come:
      'Le indicazioni complete sono consultabili nella pagina %LINK%; le scadenze interne alla scuola vengono comunicate dalla segreteria. Raccogli in anticipo la documentazione di accoglienza.',
    linkLabel: 'ufficiale del Ministero',
    portale: 'la pagina del Ministero',
  },
  'Graduatorie': {
    fatto:
      'Il Ministero dell\u2019Istruzione e del Merito (MIM) ha aggiornato le graduatorie del personale scolastico, con l\u2019avviso',
    chi:
      'docenti iscritti o in attesa di iscrizione nelle graduatorie provinciali e di istituto',
    pratica:
      'La posizione pubblicata determina l\u2019ordine delle convocazioni: eventuali errori nei punteggi vanno segnalati nei termini previsti per rettifiche e ricorsi.',
    come:
      'Le rettifiche e i ricorsi si presentano online dal portale %LINK% con identità SPID o CIE. Controlla la tua posizione appena pubblicata e prepara la documentazione.',
    linkLabel: 'Istanze Online',
    portale: 'Istanze Online',
  },
  'Supplenze': {
    fatto:
      'Il Ministero dell\u2019Istruzione e del Merito (MIM) ha aggiornato le regole per supplenze e incarichi del personale docente, con l\u2019avviso',
    chi:
      'docenti in graduatoria, aspiranti supplenti e personale che presenta la messa a disposizione',
    pratica:
      'Le convocazioni seguono l\u2019ordine di graduatoria: chi non risponde nei tempi previsti può essere saltato, quindi conviene tenere monitorata la propria posizione.',
    come:
      'Domande e accettazioni si gestiscono online dal portale %LINK% con identità SPID o CIE. Tieni a portata di mano la documentazione di servizio.',
    linkLabel: 'Istanze Online',
    portale: 'Istanze Online',
  },
  'Scuole': {
    fatto:
      'Il Ministero dell\u2019Istruzione e del Merito (MIM) ha pubblicato un aggiornamento sull\u2019organizzazione dell\u2019anno scolastico, con la comunicazione',
    chi: 'dirigenti, docenti, personale ATA (Amministrativo, Tecnico e Ausiliario) e famiglie',
    pratica:
      'La comunicazione introduce novità o conferme su scadenze e adempimenti dell\u2019anno: i dettagli completi sono riportati nella pagina ufficiale.',
    come:
      'Le informazioni complete sono consultabili sul sito del %LINK%. Se la notizia riguarda la tua scuola, la segreteria provvederà a comunicare le scadenze interne.',
    linkLabel: 'Ministero',
    portale: 'Notizie del Ministero',
  },
  'PNRR': {
    fatto:
      'Il Ministero dell\u2019Istruzione e del Merito (MIM) ha aggiornato le scadenze operative del PNRR (Piano Nazionale di Ripresa e Resilienza) per il settore istruzione, con l\u2019avviso',
    chi:
      'scuole, dirigenti scolastici, docenti e personale che partecipa ai bandi e alle iniziative finanziate dal PNRR',
    pratica:
      'Le scadenze degli avvisi PNRR determinano l\u2019accesso ai finanziamenti per edilizia, digitalizzazione, nuove competenze e inclusione: un termine mancato può far perdere la quota assegnata.',
    come:
      'Le istanze e gli allegati si gestiscono online dalle piattaforme del %LINK% e da quelle dedicate al PNRR Istruzione. Controlla la scadenza del bando e conserva la ricevuta di invio.',
    linkLabel: 'Ministero',
    portale: 'Notizie del Ministero',
  },
};

const ARTICOLO: Record<string, ArticoloCopy> = {
  ...ARTICOLO_BASE,
  ...ARTICOLO_ALTRE,
};

/**
 * COPY DEDICATO alle notizie di IMPATTO PRATICO: quando il titolo parla di
 * welfare/polizza, formazione o organizzazione, l'apertura dice subito che cosa
 * cambia (e per chi) invece del generico template di categoria.
 */
const IMPATTO_COPY: Array<{ re: RegExp; copy: ArticoloCopy }> = [
  {
    re: /(?:welfare|polizza|sanitari|assistenza)/i,
    copy: {
      fatto: 'Una novità concreta per il personale scolastico: è stata annunciata',
      chi: 'tutto il personale della scuola — docenti e ATA — e le loro famiglie',
      pratica:
        'Non è una circolare operativa ma un cambio di condizioni: conviene leggere i dettagli per capire coperture, decorrenza e come aderire, così non resti fuori da un beneficio previsto per te.',
      come: 'I dettagli e le modalità di adesione sono nella pagina ufficiale del %LINK%: in caso di dubbi, chiedi alla segreteria della tua scuola.',
      linkLabel: 'Ministero',
      portale: 'Notizie del Ministero',
    },
  },
  {
    re: /(?:formazione|aggiornamento professionale|MIMeraviglIA)/i,
    copy: {
      fatto: "Un'opportunità di formazione per il personale scolastico: è online",
      chi: 'docenti, personale ATA e dirigenti scolastici',
      pratica:
        'Aggiornarsi conta su punteggi, incarichi e crescita professionale: verifica requisiti, tempi e modalità di iscrizione prima che la finestra chiuda.',
      come: 'Iscrizioni e dettagli sono nella pagina ufficiale del %LINK%: leggi requisiti e tempi prima di iscriverti.',
      linkLabel: 'Ministero',
      portale: 'Notizie del Ministero',
    },
  },
  {
    re: /(?:sicurezza|edilizia|digitalizzazione|organico|cattedre)/i,
    copy: {
      fatto: "Un cambiamento che riguarda l'organizzazione delle scuole: è stato pubblicato",
      chi: "il personale scolastico e l'organizzazione della scuola",
      pratica:
        'Sono le decisioni che poi ricadono su orari, incarichi e dotazioni: leggerle adesso aiuta a capire in anticipo che cosa cambia nella tua scuola.',
      come: 'Il testo completo è nella pagina ufficiale del %LINK%: controlla che cosa cambia per la tua scuola.',
      linkLabel: 'Ministero',
      portale: 'Notizie del Ministero',
    },
  },
];

/**
 * Genera un articolo giornalistico naturale in 3 paragrafi fluidi, basato solo
 * sui dati reali della fonte. Nessun cliché da chatbot e nessuna sezione in
 * <h2>: si racconta il fatto, chi è coinvolto e come agire, con il link
 * contestuale alla procedura ufficiale.
 */
/**
 * URL di ingresso REALE e DI APPROFONDIMENTO degli enti e portali
 * istituzionali citati negli articoli (STRICT URL INTEGRITY):
 *  - niente mockup, niente homepage di radice generiche (mai www.mim.gov.it/);
 *  - i link devono essere risorse di profondità, validati HTTP 200;
 *  - le uniche radici ammesse sono i portali di servizio (Istanze Online/POLIS,
 *    InPA, INPS) dove la radice È l'accesso operativo.
 * L'URL della fonte resta il fallback solo se il portale non è in mappa.
 */
const URL_PORTALI: Record<string, string> = {
  'Istanze Online': 'https://www.istruzione.it/polis/Istanzeonline.htm', // Istanze Online / POLIS (200 ✓)
  'POLIS': 'https://www.istruzione.it/polis/Istanzeonline.htm',
  'InPA': 'https://www.inpa.gov.it/', // Portale del Reclutamento (200 ✓)
  'MIM': 'https://www.mim.gov.it/web/guest/notizie', // deep: pagina Notizie (200 ✓)
  'Ministero': 'https://www.mim.gov.it/web/guest/notizie',
  'la pagina del Ministero': 'https://www.mim.gov.it/web/guest/notizie',
  'Notizie del Ministero': 'https://www.mim.gov.it/web/guest/notizie',
  'INPS': 'https://www.inps.it/', // Portale INPS (200 ✓)
};

export function generaArticoloEditoriale(
  d: DatiArticoloEditoriale,
): { content_html: string; summary_points: string[] } {
  const cat = d.categoria ?? 'Scuole';
  const override = IMPATTO_COPY.find((o) => o.re.test(d.title));
  const a = override?.copy ?? ARTICOLO[cat] ?? ARTICOLO['Scuole'];
  const scadenza = d.deadline ? formattaDataItaliana(d.deadline) : null;
  const link = d.official_url ?? '';

  // Ogni menzione del portale è SEMPRE un link cliccabile verso l'URL reale
  // dell'ente (mappa), con fallback all'URL della fonte della notizia.
  const hrefPortale = URL_PORTALI[a.portale] ?? link;
  const anchor = (testo: string): string =>
    hrefPortale
      ? `<a href="${escapeHtmlEditoriale(hrefPortale)}" target="_blank" rel="noopener noreferrer">${escapeHtmlEditoriale(testo)}</a>`
      : escapeHtmlEditoriale(testo);

  const par1 = `${a.fatto} \u00ab${escapeHtmlEditoriale(d.title)}\u00bb. ${
    scadenza
      ? `Il termine per presentare la domanda è il ${scadenza}.`
      : `La scadenza non è ancora indicata nell'avviso: la finestra ufficiale comparirà su ${anchor(a.portale)} e ti avviseremo appena esce.`
  }`;

  const par2 = `La notizia riguarda ${a.chi}. ${a.pratica}`;

  const par3 = a.come.split('%LINK%').join(anchor(a.linkLabel));

  const content_html = `<p>${par1}</p>\n    <p>${par2}</p>\n    <p>${par3}</p>`;

  const summary_points = [
    d.title,
    `Interessati: ${a.chi}.`,
    scadenza ? `Scadenza: ${scadenza}.` : `Come: procedi su ${a.portale}.`,
  ];

  return { content_html, summary_points };
}

/**
 * Prompt per la scrittura dell'articolo con LLM: stesse regole editoriali
 * STRETTE (3 paragrafi fluidi, validità giuridica, linguaggio chiaro, strict
 * URL integrity, PDF ufficiali) — vedi docs/BLOG_EDITORIAL_GUIDELINES.md.
 */
export function promptScritturaArticolo(d: DatiArticoloEditoriale): string {
  return `Sei una giornalista esperta di scuola per ScuoleRadar, il sito per la scuola che fa risparmiare tempo.
Scrivi un articolo di 3 paragrafi fluidi e naturali, in italiano, basandoti SOLO sui dati reali della fonte:
- Titolo: ${d.title}
- Categoria: ${d.categoria ?? 'n/d'}
- Scadenza (ISO): ${d.deadline ?? 'n/d'}
- Fonte: ${d.fonte}
- URL fonte: ${d.official_url ?? ''}
- Descrizione della fonte: ${d.descrizione ?? ''}

Struttura (3 paragrafi, senza titoli di sezione):
1. Che cosa è successo: il fatto e il RIFERIMENTO UFFICIALE ESATTO (es. "l'Ordinanza Ministeriale n. X del ...", "il Decreto Ministeriale ...", "la Nota prot. ...", "l'articolo X della legge ...") con la scadenza ESATTA (es. "Il termine per presentare la domanda è il 30 settembre 2026"). MAI scrivere "le date saranno confermate" o altri testi vaghi.
2. Chi è coinvolto e che cosa significa in pratica, spiegando la burocrazia in LINGUAGGIO SEMPLICE per docenti e personale ATA.
3. Dove e come agire: portale ufficiale, modalità e link contestuale obbligatorio <a href="${d.official_url ?? ''}" target="_blank" rel="noopener noreferrer">Accedi al portale</a>.

REGOLE VINCOLANTI:
- VALIDITÀ GIURIDICA: cita SEMPRE il riferimento normativo preciso (Ordinanza Ministeriale, Decreto, Nota prot., articolo di legge) quando la fonte lo contiene; mai riferimenti generici.
- LINGUAGGIO CHIARO: spiega la procedura come la spiegheresti a un docente o a un ATA, senza tecnicismi inutili, senza fluff e senza cliché da chatbot ("C'è una novità ufficiale", "La fonte ufficiale segnala", "Vale la pena di leggere subito", "non perdere tempo").
- ZERO RUMORE: nessun contenuto promozionale, nessun riferimento a discorsi, interviste o dichiarazioni non vincolanti.
- STRICT URL INTEGRITY: ogni link deve puntare a una risorsa REALE di approfondimento, mai a homepage di radice (es. https://www.mim.gov.it/ è VIETATA come destinazione; usa https://www.mim.gov.it/web/guest/notizie). Portali di servizio consentiti SOLO come destinazione operativa: Istanze Online/POLIS → https://www.istruzione.it/polis/Istanzeonline.htm, InPA → https://www.inpa.gov.it/, INPS → https://www.inps.it/. Vietato inventare URL o usare segnaposto.
- PDF UFFICIALE: se la fonte è un documento PDF ufficiale o ne fornisce uno allegato, nel paragrafo 3 includi un link dedicato che apra il PDF in una nuova scheda (target="_blank" rel="noopener noreferrer").
- Spiega SEMPRE gli acronimi alla prima menzione (es. "GPS (Graduatorie Provinciali per le Supplenze, le liste per gli incarichi annuali)", "SPID (Sistema Pubblico di Identità Digitale)").
- Niente <h2>, niente riempitivi, niente dati inventati. Restituisci SOLO i 3 paragrafi in HTML.`;
}

