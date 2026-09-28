/**
 * ScuoleRadar.it — Dipartimento Notizie · STANDARD EDITORIALE · TEMI DEL PERSONALE.
 *
 * Riferimento permanente: docs/BLOG_EDITORIAL_GUIDELINES.md
 *
 * Primo blocco dell'allow-list: i temi operativi che riguardano il lavoro
 * quotidiano di docenti di ruolo e precari, personale ATA e segreterie, DSGA e
 * dirigenti (contratti, mobilità, graduatorie, supplenze, interpelli, concorsi,
 * immissioni in ruolo, PNRR, sicurezza, fonti normative).
 *
 * Qui stanno anche i tipi e le macro-aree condivisi con gli altri blocchi:
 * l'aggregatore è `editorialStandard.ts` (temi uniti + matrice di scoring).
 */

/** Tema operativo dell'allow-list editoriale. */
export interface TemaOperativo {
  /** Categoria pubblicata (badge nel feed e copy dedicato dell'articolo). */
  categoria: string;
  /** Macro-area di appartenenza (tassonomia di riferimento per audit e guardie). */
  area: string;
  /** Parole chiave riconosciute nel testo (minuscolo; radici per coprire i plurali). */
  parole: string[];
  /** true = le parole del tema bastano; false = serve un contesto di personale. */
  autosufficiente: boolean;
  /** Peso 0-100 nella matrice di scoring (`PESI_CATEGORIA`). */
  peso: number;
  /** true = pubblicabile solo con un fatto concreto (scadenza o canale ufficiale). */
  fattoConcreto?: boolean;
}

/** Macro-aree di copertura editoriale: la tassonomia di riferimento del blog. */
export const AREE_TEMATICHE: readonly string[] = [
  'Normativa, concorsi e reclutamento',
  'Personale ATA e segreterie',
  'Istruzione degli adulti (CPIA)',
  'Formazione, titoli e CFU',
  'Pedagogia, filosofia e riferimenti culturali',
  'Innovazione didattica e strumenti',
  'Inclusione e sostegno',
  'Contratti, previdenza e welfare',
  'Organizzazione, sicurezza e fonti normative',
];

/**
 * TEMI DEL PERSONALE, in ordine di PRIORITÀ: la prima voce che corrisponde
 * assegna la categoria. L'ordine dei temi storici (CCNL → Concorsi) è
 * intenzionalmente invariato per non cambiare la categorizzazione già
 * pubblicata; i temi nuovi si inseriscono dove non rubano il match ai vecchi.
 */
export const TEMI_PERSONALE: TemaOperativo[] = [
  {
    categoria: 'CCNL',
    area: 'Contratti, previdenza e welfare',
    autosufficiente: true,
    peso: 84,
    parole: [
      'ccnl', 'contratto collettivo', 'contrattazione', 'rinnovo del contratto',
      'comparto istruzione e ricerca', 'area istruzione e ricerca', 'stipendi',
      'retribuzion', 'indennit', 'progressioni economiche', 'busta paga',
    ],
  },
  {
    categoria: 'Pensioni',
    area: 'Contratti, previdenza e welfare',
    autosufficiente: true,
    peso: 82,
    parole: [
      'previdenz', 'pension', 'riscatto', 'ricongiunzione', 'contributiv',
      'cessazione dal servizio', 'ricostruzione di carriera',
      'ricostruzione carriera', 'buonuscita',
    ],
  },
  {
    categoria: 'Welfare',
    area: 'Contratti, previdenza e welfare',
    autosufficiente: true,
    peso: 80,
    parole: [
      'welfare', 'welfare scolastico', 'polizza', 'polizza sanitaria', 'sanitari',
      'assistenza sanitaria integrativa', 'benefit', 'tutela della salute',
      'carta del docente',
    ],
  },
  {
    categoria: 'Mobilità',
    area: 'Normativa, concorsi e reclutamento',
    autosufficiente: true,
    peso: 85,
    parole: [
      'mobilit', 'trasferiment', 'passaggio di ruolo', 'passaggio di cattedra',
      'assegnazioni provvisorie', 'utilizzazioni', 'comandi', 'assegnazione',
      'vincolo triennale', 'vincoli di mobilità',
    ],
  },
  {
    categoria: 'Sostegno',
    area: 'Inclusione e sostegno',
    autosufficiente: true,
    peso: 88,
    parole: [
      'sostegno', 'docenti di sostegno', 'insegnante di sostegno',
      'ore di sostegno', 'posti di sostegno', 'pei', 'pdp', 'glo', 'bes', 'dsa',
      'inclusione scolastica', 'educazione inclusiva', 'disabilità', 'disabilita',
      'assistente all\u2019autonomia',
    ],
  },
  {
    categoria: 'ATA',
    area: 'Personale ATA e segreterie',
    autosufficiente: true,
    peso: 84,
    parole: [
      'personale ata', 'collaboratore scolastico', 'collaboratori scolastici',
      'assistente amministrativo', 'assistenti amministrativi',
      'assistente tecnico', 'assistenti tecnici', 'dsga',
      'direttore dei servizi generali', 'graduatorie ata', 'terza fascia',
      'carrelli di lavoro', 'organico ata', 'segreteria scolastica',
      'segreterie scolastiche', 'operatore scolastico',
    ],
  },
  {
    categoria: 'Istruzione Adulti',
    area: 'Istruzione degli adulti (CPIA)',
    autosufficiente: true,
    peso: 71,
    parole: [
      'cpia', 'centro provinciale per l\u2019istruzione degli adulti',
      'istruzione degli adulti', 'educazione degli adulti', 'corsi serali',
      'percorsi serali', 'percorsi di secondo livello', 'secondo livello',
      'apprendimento permanente',
    ],
  },
  {
    categoria: 'GPS',
    area: 'Normativa, concorsi e reclutamento',
    autosufficiente: true,
    peso: 95,
    parole: [
      'gps', 'graduator', 'gae', 'graduatorie ad esaurimento',
      'graduatorie di istituto', 'supplenz', 'interpello', 'interpelli',
      'messa a disposizione', 'scelta delle sedi', 'ruoli docenti', 'nomine',
      'nomina', 'convocazion', 'bollettin', 'algoritmo', 'algoritmi',
      'contratto a tempo determinato', 'incarichi a tempo determinato',
    ],
  },
  {
    categoria: 'Organico',
    area: 'Organizzazione, sicurezza e fonti normative',
    autosufficiente: true,
    peso: 79,
    parole: [
      'organico', 'organici', 'cattedre', 'dotazione organica', 'organico di fatto',
      'organico di diritto', 'posti di ruolo', 'esuberi', 'reggenz',
      'posti di sostegno',
    ],
  },
  {
    categoria: 'Formazione',
    area: 'Formazione, titoli e CFU',
    autosufficiente: true,
    peso: 78,
    parole: [
      'formazione', 'formazione obbligatoria', 'aggiornamento professionale',
      'abilitazione', 'specializzazione', 'tfa', 'tfa sostegno', 'cfu', '24 cfu',
      '30 cfu', '60 cfu', 'classi di concorso', 'classe di concorso',
      'titoli di accesso', 'requisiti di accesso', 'accreditamento',
      'enti accreditati',
    ],
  },
  {
    categoria: 'Reclutamento e Ruolo',
    area: 'Normativa, concorsi e reclutamento',
    autosufficiente: false,
    peso: 87,
    parole: [
      'immissioni in ruolo', 'immissione in ruolo', 'assunzioni in ruolo',
      'assunzione in ruolo', 'anno di prova', 'neoassunt', 'transizione scuola',
      'procedure di reclutamento',
    ],
  },
  {
    categoria: 'PNRR',
    area: 'Normativa, concorsi e reclutamento',
    autosufficiente: true,
    peso: 80,
    parole: [
      'pnrr', 'piano nazionale di ripresa', 'piano scuola 4.0', 'scuola 4.0',
      'esperti pnrr', 'tutor pnrr', 'finanziament', 'edilizia scolastica',
      'divari territoriali',
    ],
  },
  {
    categoria: 'Sicurezza',
    area: 'Organizzazione, sicurezza e fonti normative',
    autosufficiente: true,
    peso: 76,
    parole: [
      'sicurezza sui luoghi di lavoro', 'tutela della sicurezza', 'infortuni',
      'stress lavoro-correlato', 'sorveglianza sanitaria', 'rspp',
      'formazione sulla sicurezza',
    ],
  },
  {
    categoria: 'Normativa',
    area: 'Organizzazione, sicurezza e fonti normative',
    autosufficiente: false,
    peso: 70,
    parole: [
      'nuove regole', 'nuova disciplina', 'linee guida', 'semplificazione',
      'modifiche al regolamento', 'requisiti', 'decreto legge', 'disegno di legge',
      'ddl', 'statuto', 'autonomia scolastica', 'regolamento',
    ],
  },
  {
    categoria: 'Scadenze',
    area: 'Organizzazione, sicurezza e fonti normative',
    autosufficiente: false,
    peso: 72,
    parole: [
      'scadenza', 'entro il', 'termine ultimo', 'presentazione delle domande',
      'riapertura dei termini', 'proroga', 'istanze',
    ],
  },
  {
    categoria: 'Concorsi',
    area: 'Normativa, concorsi e reclutamento',
    autosufficiente: false,
    peso: 90,
    parole: [
      'concorso', 'concorsi', 'reclutament', 'assunzion', 'graduatorie di merito',
      'concorso docenti', 'concorso dirigenti', 'prova scritta', 'prova orale',
      'commissioni giudicatrici',
    ],
  },
];
