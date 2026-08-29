/**
 * ScuoleRadar.it — Motore di rilevanza e matching del dipartimento Notizie.
 *
 * Modulo PURO (nessuna dipendenza dalla rete né da Node): valuta le notizie
 * reali in ingresso e applica le regole editoriali:
 *  - RIFIUTA comunicati stampa, discorsi politici, dichiarazioni non
 *    vincolanti e annunci generici;
 *  - ACCETTA SOLO decreti, note normative, bandi e scadenze operative per il
 *    personale scolastico (GPS, Mobilità, Concorsi, Pensioni, Sostegno, …);
 *  - estrae la data di scadenza ufficiale (`deadline_date`) se dichiarata;
 *  - genera articoli giornalistici con date esatte, acronimi spiegati alla
 *    prima menzione e link contestuali ai portali ufficiali (il blog NON
 *    promuove moduli o template interni).
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
  '1° settembre', 'pnrr', 'bollettini',
];

/** Parole che segnalano contenuti NON vincolanti (da rifiutare). */
const PAROLE_RIFIUTA: string[] = [
  'intervista', 'discorso', 'dichiarazione del ministro', 'saluto', 'auguri', 'cerimonia',
  'inaugurazione', 'premiazione', 'spettacolo', 'spot', 'campagna di comunicazione',
  'messaggio del ministro', 'video', 'podcast', 'mostra', 'fiera', 'concorso letterario',
  'bandiera', 'festa', 'progetto di lettura', 'evento sportivo', 'manifestazione',
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
 * strutturata JSON delle notizie raccolte.
 */
export function promptFiltroLLM(voci: VoceInValutazione[]): string {
  return `Sei il filtro editoriale del servizio Notizie di ScuoleRadar per i docenti italiani.
Per ciascuna notizia valuta:
1) RILEVANZA: accetta SOLO decreti, note normative, bandi e scadenze operative per il personale scolastico (GPS, mobilità, concorsi, pensioni, sostegno, supplenze, graduatorie). RIFIUTA comunicati stampa, discorsi, dichiarazioni politiche e annunci generici non vincolanti.
2) CATEGORIA: una tra GPS, Mobilità, Concorsi, Pensioni, Sostegno, Graduatorie, Supplenze, Scuole, PNRR.
3) DEADLINE: la data di scadenza ufficiale in formato ISO (YYYY-MM-DD) se presente, altrimenti null.

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
    Pensioni: 82,
    Supplenze: 80,
    PNRR: 80,
    Graduatorie: 78,
    Scuole: 70,
  };
  const base = categoria ? (priorita[categoria] ?? 65) : 60;
  return Math.min(100, base + (hasDeadline ? 8 : 0));
}

/** Valida la coerenza di un articolo costruito prima dell'inserimento. */
export function articoloValido(a: NewsArticle): boolean {
  return (
    Boolean(a.id) &&
    Boolean(a.title) &&
    Boolean(a.official_source_url) &&
    a.official_source_url.startsWith('http')
  );
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
    portale: 'la pagina del Ministero',
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
    portale: 'la pagina del Ministero',
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
 * URL di ingresso REALE degli enti e portali istituzionali citati negli
 * articoli. I link contestuali devono puntare qui (non alla pagina della
 * singola notizia); l'URL della fonte resta il fallback se il portale non è
 * presente in questa mappa.
 */
const URL_PORTALI: Record<string, string> = {
  'Istanze Online': 'https://www.istanze.istruzione.it/',
  'POLIS': 'https://www.istanze.istruzione.it/',
  'InPA': 'https://www.inpa.gov.it/',
  'MIM': 'https://www.mim.gov.it/',
  'Ministero': 'https://www.mim.gov.it/',
  'la pagina del Ministero': 'https://www.mim.gov.it/',
  'INPS': 'https://www.inps.it/',
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
 * (3 paragrafi fluidi, tono giornalistico, zero cliché, link contestuale).
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
1. Che cosa è successo: il fatto, il decreto o la data, con la scadenza ESATTA (es. "Il termine per presentare la domanda è il 30 settembre 2026"). MAI scrivere "le date saranno confermate" o altri testi vaghi.
2. Chi è coinvolto e che cosa significa in pratica.
3. Dove e come agire: portale ufficiale, modalità e link contestuale obbligatorio <a href="${d.official_url ?? ''}" target="_blank" rel="noopener noreferrer">Accedi al portale</a>.

Regole:
- Spiega SEMPRE gli acronimi alla prima menzione (es. "GPS (Graduatorie Provinciali per le Supplenze, le liste per gli incarichi annuali)", "SPID (Sistema Pubblico di Identità Digitale)").
- Ogni menzione di portali esterni deve essere un link HTML cliccabile (target="_blank" rel="noopener noreferrer") che punta all'URL REALE del portale: Istanze Online/POLIS → https://www.istanze.istruzione.it/, InPA → https://www.inpa.gov.it/, MIM → https://www.mim.gov.it/, INPS → https://www.inps.it/. Usa l'URL della fonte (${d.official_url ?? ''}) SOLO come fallback se il portale menzionato non è tra questi.
- VIETATO usare cliché da chatbot: "C'è una novità ufficiale", "La fonte ufficiale segnala", "Vale la pena di leggere subito", "non perdere tempo". Niente <h2>, niente riempitivi, niente dati inventati. Restituisci SOLO i 3 paragrafi in HTML.`;
}

