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
 *  - tetto settimanale: MASSIMO 3 articoli ad alto valore a settimana
 *    (`MAX_ARTICOLI_SETTIMANA`); se non ci sono provvedimenti vincolanti si
 *    pubblicano 0 articoli;
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
}

/** Parole che identificano l'ambito/categoria del personale scolastico. */
const PAROLE_CATEGORIA: Record<string, string[]> = {
  'GPS': [
    'gps', 'graduatoria provinciale', 'graduatorie provinciali', 'supplenze',
    'nomina', 'nomine', 'algoritmo', 'algoritmi',
  ],
  'Mobilità': ['mobilità', 'mobilita', 'trasferimento', 'assegnazione provvisoria', 'utilizzazione', 'comma 5'],
  'Concorsi': ['concorso', 'bando di concorso', 'selezione', 'assunzione', 'immissione in ruolo', 'reclutamento'],
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
  'assunzione', 'concorso', 'mobilità', 'mobilita', 'pensioni', 'supplenze', 'sostegno',
  'rettifica', 'integrazione', 'proroga', 'avviso di avvio', 'apertura delle domande',
  'riserva', 'assegnazione', 'conferimento', 'scelta delle sedi',
  'nomina', 'nomine', 'algoritmo', 'algoritmi', 'presa di servizio', 'primo settembre',
  '1° settembre', 'pnrr', 'bollettini', 'ccnl', 'contratto collettivo',
  'verbale di accordo', 'sottoscrizione', 'riconoscimento', 'equipollenza',
  'ricostruzione', 'riscatto laurea', 'assegnazioni provvisorie', 'sentenza',
  'deciso', 'conciliazione', 'ordinanza cautelare',
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
];

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
 * Valuta la rilevanza editoriale di una notizia in ingresso.
 * Regola: niente contenuti non vincolanti; solo provvedimenti, note e
 * scadenze operative per il personale scolastico.
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

  const categoria = classificaCategoria(testo);
  const operativa = PAROLE_ACCETTA.some((p) => testo.includes(p));

  if (!categoria || !operativa) {
    return {
      rilevante: false,
      categoria,
      deadline: null,
      motivo: 'Annuncio generico o non inerente a scadenze per il personale scolastico',
    };
  }

  return { rilevante: true, categoria, deadline: estraiDeadline(testo) };
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

/** Tetto settimanale: massimo 3 articoli ad alto valore ogni 7 giorni. */
export const MAX_ARTICOLI_SETTIMANA = 3;

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
 * True se l'URL è una FONTE CANONICA (il singolo articolo/atto) e non una
 * pagina generica del sito (es. `https://www.mim.gov.it/web/guest/home`).
 * Per il dominio MIM è richiesto il pattern canonico degli articoli
 * `/web/guest/-/<slug>`.
 */
export function èFonteCanonica(url: string): boolean {
  try {
    const parsed = new URL(url);
    let percorso = parsed.pathname.toLowerCase();
    if (percorso.length > 1 && percorso.endsWith('/')) percorso = percorso.slice(0, -1);
    if (PERCORSI_GENERICI.has(percorso)) return false;
    // MIM: gli articoli canonici seguono il pattern /web/guest/-/<slug>.
    if (parsed.hostname.endsWith('mim.gov.it')) {
      return /\/web\/guest\/-\//.test(percorso);
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
 *  - mai segnaposto/mockup.
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
  const radiceNuda = parsed.pathname === '' || parsed.pathname === '/';
  if (radiceNuda && !PORTALI_SERVIZIO.has(parsed.origin)) {
    return `Root-domain generico non consentito (${parsed.origin}/)`;
  }
  return null;
}

/**
 * Applica il tetto settimanale: al massimo `max` articoli con data di
 * pubblicazione nella finestra mobile degli ultimi 7 giorni. Gli articoli più
 * rilevanti (punteggio, poi data) vengono tenuti; gli esuberi sono scartati.
 * Gli articoli più vecchi della finestra non vengono toccati (accumulo).
 */
export function limitaArticoliSettimanali(
  articoli: NewsArticle[],
  oggi: Date = new Date(),
  max: number = MAX_ARTICOLI_SETTIMANA,
): { mantenuti: NewsArticle[]; rimossi: NewsArticle[] } {
  const soglia = oggi.getTime() - 7 * 24 * 60 * 60 * 1000;
  const recenti: NewsArticle[] = [];
  const storici: NewsArticle[] = [];
  for (const a of articoli) {
    const t = a.published_at ? new Date(a.published_at).getTime() : Number.NaN;
    if (Number.isNaN(t) || t >= soglia) recenti.push(a);
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
  const a = ARTICOLO[cat] ?? ARTICOLO['Scuole'];
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

