/**
 * ScuoleRadar.it — Dipartimento Notizie · LESSICO SCOLASTICO condiviso.
 *
 * Riferimento permanente: docs/BLOG_EDITORIAL_GUIDELINES.md
 *
 * Blocco lessicale dello standard editoriale (usato da `relevanceEngine.ts`):
 * qui stanno le voci che NON dipendono dal punteggio di rilevanza, cioè
 *  - il GLOSSARIO degli acronimi spiegati alla prima menzione negli articoli;
 *  - le FRASI DI FLUFF (promesse vuote) mai pubblicabili;
 *  - la tassonomia PEDAGOGICA per ordine di scuola: riferimenti culturali
 *    (infanzia/primaria, secondaria di I grado, secondaria di II grado) e
 *    parole della didattica tipiche di ciascun ordine.
 *
 * Modulo PURO: nessuna dipendenza dalla rete né da Node.
 */

/**
 * Acronimi ufficiali del mondo scuola. Vengono spiegati tra parentesi alla
 * prima occorrenza negli articoli (`espandiAcronimi`), una sola volta per
 * sigla: l'obiettivo è rendere leggibile il testo anche a chi non è del settore.
 */
export const GLOSSARIO_ACRONIMI: Record<string, string> = {
  MIM: 'Ministero dell\u2019Istruzione e del Merito',
  GPS: 'Graduatorie Provinciali per le Supplenze',
  GAE: 'Graduatorie ad Esaurimento',
  GI: 'Graduatorie di Istituto',
  PNRR: 'Piano Nazionale di Ripresa e Resilienza',
  PON: 'Programma Operativo Nazionale',
  ATA: 'personale Amministrativo, Tecnico e Ausiliario',
  DSGA: 'Direttore dei Servizi Generali e Amministrativi',
  CCNL: 'Contratto Collettivo Nazionale di Lavoro',
  ARAN: 'Agenzia per la Rappresentanza Negoziale delle Pubbliche Amministrazioni',
  INPS: 'Istituto Nazionale della Previdenza Sociale',
  SPID: 'Sistema Pubblico di Identit\u00e0 Digitale',
  CIE: 'Carta d\u2019Identit\u00e0 Elettronica',
  SIDI: 'Sistema Informativo dell\u2019Istruzione',
  POLIS: 'la piattaforma unica dei servizi pubblici di istruzione',
  USR: 'Ufficio Scolastico Regionale',
  USP: 'Ufficio Scolastico Provinciale',
  OM: 'Ordinanza Ministeriale',
  DM: 'Decreto Ministeriale',
  MAD: 'Messa A Disposizione',
  TFA: 'Tirocinio Formativo Attivo (specializzazione per il sostegno)',
  CFU: 'Crediti Formativi Universitari',
  CPIA: 'Centro Provinciale per l\u2019Istruzione degli Adulti',
  IA: 'Intelligenza Artificiale',
  PNSD: 'Piano Nazionale Scuola Digitale',
  PCTO: 'Percorsi per le Competenze Trasversali e per l\u2019Orientamento',
  BES: 'Bisogni Educativi Speciali',
  DSA: 'Disturbi Specifici dell\u2019Apprendimento',
  PEI: 'Piano Educativo Individualizzato',
  PDP: 'Piano Didattico Personalizzato',
  GLO: 'Gruppo di Lavoro Operativo per l\u2019inclusione',
  STEAM: 'Scienza, Tecnologia, Ingegneria, Arte e Matematica',
  STEM: 'Scienza, Tecnologia, Ingegneria e Matematica',
};

/**
 * FRASI DI FLUFF / PROMESSE VUOTE — mai pubblicabili.
 *
 * Sono riempitivi che non danno nulla di operativo al lettore ("ti avvisiamo
 * appena esce", "la scadenza non è ancora pubblicata", "verifica nel testo
 * ufficiale"): un articolo che ne contiene una viene scartato, in generazione e
 * in igiene dell'archivio. La notizia parla solo se ha fatti completi: scadenza,
 * requisiti, modalità e link diretti.
 */
export const FRASI_FLUFF: string[] = [
  'ti avvisiamo appena esce',
  'ti avviseremo appena esce',
  'appena esce',
  'non ancora pubblicata',
  'non ancora pubblicate',
  'non è ancora indicata',
  'non sono ancora indicati',
  'non è ancora stata fissata',
  'prossimo aggiornamento è in arrivo',
  'prossimo aggiornamento',
  'resta aggiornato',
  'continua a seguirci',
  'sarà pubblicata prossimamente',
  'verifica apertura nel testo ufficiale',
  'verifica nel testo ufficiale',
  'controlla nel testo ufficiale',
  'ti aggiorneremo',
  'le date saranno confermate',
];

/**
 * LESSICO OPERATIVO del dipartimento: le parole che rendono una voce
 * "azionabile" per il personale scolastico (provvedimenti, scadenze, domande,
 * nomine, graduatorie, procedure di reclutamento) comprese le voci della scuola
 * a 360 gradi: personale ATA e segreterie, DSGA, insegnanti di sostegno, CPIA e
 * istruzione degli adulti, TFA e CFU, classi di concorso, immissioni in ruolo e
 * anno di prova.
 *
 * ATTENZIONE: il gate editoriale VERO è l'allow-list dei temi
 * (`TEMI_OPERATIVI` in `editorialStandard.ts`): una parola di questo elenco NON
 * basta da sola a pubblicare. Qui resta il vocabolario di riferimento del
 * dipartimento (audit, roadmap dei temi, copy) ed è esposto storicamente come
 * `PAROLE_ACCETTA` da `relevanceEngine.ts`.
 */
const PAROLE_OPERATIVE_STORICHE: string[] = [
  'decreto', 'decreto ministeriale', 'd.m.', 'ordinanza', 'nota', 'nota prot.',
  'circolare', 'bando', 'avviso', 'scadenza', 'termine', 'termine ultimo',
  'entro il', 'domanda', 'domande', 'istanza', 'presentazione', 'pubblicato',
  'pubblicazione', 'aggiornamento', 'calendario', 'requisiti', 'modalità',
  'modalita', 'graduatoria', 'graduatorie', 'assunzione', 'assunzioni',
  'concorso', 'concorsi', 'reclutamento', 'mobilità', 'mobilita', 'pensioni',
  'supplenza', 'supplenze', 'sostegno', 'rettifica', 'integrazione', 'proroga',
  'avviso di avvio', 'apertura delle domande', 'riserva', 'assegnazione',
  'assegnazioni', 'conferimento', 'scelta delle sedi', 'nomina', 'nomine',
  'algoritmo', 'algoritmi', 'presa di servizio', 'presa in servizio',
  'primo settembre', '1° settembre', 'pnrr', 'bollettino', 'bollettini',
  'ccnl', 'contratto collettivo', 'verbale di accordo', 'sottoscrizione',
  'riconoscimento', 'equipollenza', 'ricostruzione', 'riscatto laurea',
  'assegnazioni provvisorie', 'sentenza', 'deciso', 'conciliazione',
  'ordinanza cautelare', 'interpello', 'interpelli', 'reggenza', 'reggenze',
];

/** Voci della scuola a 360 gradi (personale, ATA, CPIA, titoli, inclusione). */
const PAROLE_OPERATIVE_360: string[] = [
  'personale ata', 'dsga', 'collaboratore scolastico', 'collaboratori scolastici',
  'assistente amministrativo', 'assistenti amministrativi', 'assistente tecnico',
  'assistenti tecnici', 'segreteria scolastica', 'segreterie scolastiche',
  'graduatorie ata', 'terza fascia', 'carrelli di lavoro', 'organico ata',
  'cpia', 'istruzione degli adulti', 'educazione degli adulti', 'percorsi serali',
  'corsi serali', 'secondo livello', 'insegnante di sostegno',
  'insegnanti di sostegno', 'docenti di sostegno', 'posti di sostegno',
  'inclusione scolastica', 'tfa', 'tfa sostegno', '24 cfu', '30 cfu', '60 cfu',
  'classi di concorso', 'classe di concorso', 'immissioni in ruolo',
  'immissione in ruolo', 'anno di prova', 'neoassunti', 'transizione scuola',
  'titoli di accesso', 'domanda di partecipazione', 'candidature',
  'procedura di reclutamento', 'organico di fatto', 'organico di diritto',
  'carta del docente', 'polizza sanitaria', 'welfare scolastico',
  'sicurezza sui luoghi di lavoro', 'rspp', 'formazione obbligatoria',
  'corso di formazione', 'utilizzazioni e assegnazioni', 'vincolo triennale',
];

/** Lessico operativo completo (storico + 360°), senza duplicati. */
export const PAROLE_OPERATIVE: string[] = [
  ...new Set([...PAROLE_OPERATIVE_STORICHE, ...PAROLE_OPERATIVE_360]),
];

/** Lessico di un ordine di scuola: riferimenti culturali + parole della didattica. */
export interface LessicoOrdineScuola {
  /** Ordine di scuola di riferimento. */
  ordine: string;
  /** Autori/metodi riconosciuti nel testo (minuscolo: il match è su stem). */
  riferimenti: string[];
  /** Parole della didattica tipiche dell'ordine di scuola. */
  parole: string[];
}

/**
 * PEDAGOGIA, FILOSOFIA E DIDATTICA per ordine di scuola: la scuola a 360 gradi
 * non è solo interpelli e graduatorie, ma anche il dibattito culturale che
 * orienta la didattica quotidiana (metodo Montessori, Barbiana, competenze…).
 * Le voci qui sotto alimentano i temi 'Pedagogia' e 'Didattica' dello standard
 * editoriale: restano SEMPRE subordinate al filtro anti-rumore, perché la
 * pubblicazione richiede comunque un fatto concreto (scadenza o canale
 * ufficiale) oltre al contesto di personale scolastico.
 */
export const PEDAGOGIA_PER_ORDINE: LessicoOrdineScuola[] = [
  {
    ordine: 'Infanzia e primaria',
    riferimenti: [
      'montessori', 'dewey', 'piaget', 'vygotskij', 'vygotsky', 'malaguzzi',
      'reggio children', 'reggio emilia', 'diderot', 'encyclop', 'encicloped',
    ],
    parole: [
      'metodo montessori', 'didattica ludica', 'gioco simbolico',
      'alfabetizzazione emotiva', 'intelligenza emotiva',
      'educazione all\u2019immagine', 'laboratori espressivi',
      'continuit\u00e0 educativa', 'campi di esperienza',
    ],
  },
  {
    ordine: 'Secondaria di I grado',
    riferimenti: [
      'don milani', 'barbiana', 'scuola di barbiana', 'gramsci', 'scuola unitaria',
      'bruner', 'cooperative learning', 'apprendimento cooperativo',
    ],
    parole: [
      'orientamento scolastico', 'dispersione scolastica', 'educazione civica',
      'cittadinanza attiva', 'costituzione',
      'patto educativo di corresponsabilit\u00e0', 'consiglio di classe', 'scrutini',
    ],
  },
  {
    ordine: 'Secondaria di II grado',
    riferimenti: [
      'kant', 'kantismo', 'illuminism', 'idealismo', 'hegel', 'marx', 'nietzsche',
      'popper', 'esistenzial', 'epistemolog', 'storicismo',
    ],
    parole: [
      'pcto', 'alternanza scuola-lavoro', 'didattica per competenze',
      'competenze trasversali', 'debate', 'pensiero critico', 'argomentazione',
      'secondaria di secondo grado', 'liceo', 'istituto tecnico',
      'istituto professionale', 'esame di stato',
    ],
  },
];

/** Riferimenti culturali riconoscibili (unione dei riferimenti per ordine). */
export const RIFERIMENTI_PEDAGOGICI: string[] = [
  ...new Set(PEDAGOGIA_PER_ORDINE.flatMap((o) => o.riferimenti)),
];

/** Parole della didattica riconoscibili (unione delle parole per ordine). */
export const PAROLE_DIDATTICA_ORDINI: string[] = [
  ...new Set(PEDAGOGIA_PER_ORDINE.flatMap((o) => o.parole)),
];

/**
 * LESSICO DELL'INTELLIGENZA ARTIFICIALE: le parole che rendono riconoscibile
 * una notizia sull'IA a scuola. Alimenta il tema autonomo 'Intelligenza
 * Artificiale' (`standardTemiIA.ts`), separato da 'Innovazione Digitale'
 * (PNSD, coding, robotica educativa, didattica digitale): la categoria ha così
 * badge, peso e copy propri.
 *
 * NOTA: come per ogni altro tema, il lessico NON basta a pubblicare: restano
 * attivi il filtro anti-rumore e il gate del fatto concreto (scadenza reale o
 * canale ufficiale di domanda/candidatura) dello standard editoriale.
 */
export const PAROLE_IA: string[] = [
  'intelligenza artificiale',
  'ia generativa',
  'generative ai',
  'machine learning',
  'apprendimento automatico',
  'deep learning',
  'reti neurali',
  'modelli linguistici',
  'large language model',
  'chatbot',
  'chat bot',
  'assistente virtuale',
  'tutor virtuale',
  'prompt',
  'llm',
  'chatgpt',
  'copilot',
];
