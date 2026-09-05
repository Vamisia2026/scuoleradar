export type MacroArea =
  | 'Tutti'
  | 'Sostegno & Inclusione'
  | 'Supplenze e Interpelli'
  | 'Burocrazia & Permessi'
  | 'Candidature';

export interface Modulo {
  id: string;
  nome: string;
  categoria: string;
  macroArea: MacroArea;
  tipo: string;
  descrizione: string;
}

/** Voce dello storico "Modelli scaricati di recente" (persistita in localStorage). */
export interface ModuloScaricato {
  id: string;
  nome: string;
  tipo: string;
  scaricatoIl: string; // ISO date
}

export const STORAGE_KEY_MODULI_SCARICATI = 'scuoleradar:moduli_scaricati';

export const macroAree: MacroArea[] = [
  'Tutti',
  'Sostegno & Inclusione',
  'Supplenze e Interpelli',
  'Burocrazia & Permessi',
  'Candidature',
];

export const moduli: Modulo[] = [
  {
    id: 'supplenza-breve',
    nome: 'Domanda di supplenza breve',
    categoria: 'Supplenze',
    macroArea: 'Supplenze e Interpelli',
    tipo: 'DOCX',
    descrizione: 'Modello compilabile per la domanda di supplenza breve da inviare alle scuole.',
  },
  {
    id: 'mad',
    nome: 'Domanda di messa a disposizione (MAD)',
    categoria: 'Supplenze',
    macroArea: 'Supplenze e Interpelli',
    tipo: 'DOCX',
    descrizione: 'Modello aggiornato per la messa a disposizione per insegnamenti di ogni ordine e grado.',
  },
  {
    id: 'sostegno-disponibilita',
    nome: 'Domanda disponibilità incarico sostegno (ADEE/ADSS)',
    categoria: 'Sostegno',
    macroArea: 'Sostegno & Inclusione',
    tipo: 'DOCX',
    descrizione: 'Modello per manifestare la disponibilità a incarichi di sostegno nelle classi ADEE/ADSS.',
  },
  {
    id: 'pei-osservazioni',
    nome: 'Modello PEI – sezione osservazioni',
    categoria: 'Sostegno',
    macroArea: 'Sostegno & Inclusione',
    tipo: 'PDF',
    descrizione: 'Schema di osservazione per il PEI e per gli aggiornamenti del piano di inclusione.',
  },
  {
    id: 'autocertificazione-titoli',
    nome: 'Autocertificazione titoli di studio',
    categoria: 'Burocrazia',
    macroArea: 'Burocrazia & Permessi',
    tipo: 'PDF',
    descrizione: 'Dichiarazione sostitutiva di certificazione dei titoli posseduti (DPR 445/2000).',
  },
  {
    id: 'deleghe-privacy',
    nome: 'Modulo deleghe e consenso privacy',
    categoria: 'Burocrazia',
    macroArea: 'Burocrazia & Permessi',
    tipo: 'PDF',
    descrizione: 'Modello di delega e informativa privacy per i rapporti con le segreterie scolastiche.',
  },
  {
    id: 'checklist-mobilita',
    nome: 'Checklist mobilità annuale',
    categoria: 'Mobilità',
    macroArea: 'Burocrazia & Permessi',
    tipo: 'PDF',
    descrizione: 'Elenco dei documenti e delle scadenze da seguire per la mobilità annuale.',
  },
  {
    id: 'lettera-presentazione',
    nome: 'Lettera di presentazione',
    categoria: 'Candidature',
    macroArea: 'Candidature',
    tipo: 'DOCX',
    descrizione: 'Template professionale per presentare la tua candidatura alle istituzioni scolastiche.',
  },
];

/** Crea una nuova lista con il modulo scaricato in cima (max 20 voci, senza duplicati per id). */
export function conAggiuntaInCima(
  lista: ModuloScaricato[],
  m: Pick<ModuloScaricato, 'id' | 'nome' | 'tipo'>,
): ModuloScaricato[] {
  return [
    { id: m.id, nome: m.nome, tipo: m.tipo, scaricatoIl: new Date().toISOString() },
    ...lista.filter((x) => x.id !== m.id),
  ].slice(0, 20);
}

/** Legge lo storico dei moduli scaricati da localStorage (per il sync su Supabase). */
export function getModuliScaricati(): ModuloScaricato[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_MODULI_SCARICATI);
    return raw ? (JSON.parse(raw) as ModuloScaricato[]) : [];
  } catch {
    return [];
  }
}

/* ====================================================================== */
/*  Archivio Modulistica — struttura gerarchica (Macroaree → sottocartelle) */
/* ====================================================================== */

/**
 * Albero dell'Archivio Modulistica.
 *
 * Macroarea (tab) → Sottocategorie (cartelle, griglia 3×3 paginata) →
 * eventuali sottocartelle successive → singolo documento.
 *
 * Ogni documento terminale (`DocumentoModulistica`) porta con sé il
 * `profilo` dell'intervista che identifica in modo UNIVOCO la variante
 * esatta del modulo: è proprio quel profilo a generare l'"impronta
 * dell'intervista" usata come chiave di cache su `generated_modules`.
 */

/** Nome leggibile delle Macroaree dell'archivio. */
export type NomeMacroArea =
  | 'Infanzia'
  | 'Primaria'
  | 'Secondaria 1° Grado'
  | 'Secondaria 2° Grado'
  | 'Università'
  | 'Enti'
  | 'Altro'
  | 'Sostegno'
  | 'Comunicazione Interna';

/** Ordine esatto di visualizzazione delle Macroaree (menu a schede). */
export const ordineMacroAree: NomeMacroArea[] = [
  'Infanzia',
  'Primaria',
  'Secondaria 1° Grado',
  'Secondaria 2° Grado',
  'Università',
  'Enti',
  'Altro',
  'Sostegno',
  'Comunicazione Interna',
];

/** Documento terminale dell'archivio: la variante esatta del modulo. */
export interface DocumentoModulistica {
  id: string;
  nome: string;
  descrizione: string;
  tipo: string; // 'PDF' | 'DOCX'
  /**
   * Profilo dell'intervista (chiave→valore delle dimensioni).
   * Es. { tipo: 'sostegno', ordine: 'primaria', destinatario: 'comune' }.
   * L'impronta SHA-256 di questo profilo è la chiave di cache.
   */
  profilo: Record<string, string>;
  /** Eventuale modulo statico del catalogo collegato (bias del prompt DeepSeek). */
  catalogoId?: string;
}

/** Sottocartella dell'archivio: può contenere altre cartelle e/o documenti. */
export interface SottoCategoriaModulistica {
  id: string;
  nome: string;
  descrizione?: string;
  sotto?: SottoCategoriaModulistica[];
  documenti?: DocumentoModulistica[];
}

/** Macroarea: tab del menu (Sostegno per prima). */
export interface MacroAreaModulistica {
  id: string;
  nome: NomeMacroArea;
  /** Descrizione della macroarea (mostrata come sottotitolo quando la si apre). */
  descrizione?: string;
  /** Icona lucide della macroarea (fallback: FolderOpen nel menu a schede). */
  icona?: 'MessageSquare' | 'FileText';
  sotto: SottoCategoriaModulistica[];
}

/** Le 7 Macroaree dell'archivio (Sostegno ha la propria macroarea, per prima). */
/** Albero grezzo delle Macroaree (prima della normalizzazione "matrioska"). */
const macroAreeRaw: MacroAreaModulistica[] = [
  {
    id: 'sostegno',
    nome: 'Sostegno',
    sotto: [
      {
        id: 'richieste-sostegno',
        nome: 'Richieste di sostegno',
        descrizione: 'Domande di accertamento, assegnazione e revisione delle ore di sostegno.',
        documenti: [
          {
            id: 'richiesta-sostegno-infanzia',
            nome: 'Richiesta di sostegno – Scuola dell’Infanzia',
            descrizione: 'Domanda di accertamento e assegnazione delle ore di sostegno per la scuola dell’infanzia.',
            tipo: 'PDF',
            profilo: { tipo: 'sostegno', ordine: 'infanzia', scopo_sostegno: 'richiesta' },
          },
          {
            id: 'richiesta-sostegno-primaria',
            nome: 'Richiesta di sostegno – Scuola Primaria',
            descrizione: 'Domanda di accertamento e assegnazione delle ore di sostegno per la scuola primaria.',
            tipo: 'PDF',
            profilo: { tipo: 'sostegno', ordine: 'primaria', scopo_sostegno: 'richiesta' },
          },
          {
            id: 'richiesta-sostegno-secondaria1',
            nome: 'Richiesta di sostegno – Secondaria di I grado',
            descrizione: 'Domanda di accertamento e assegnazione delle ore di sostegno per la scuola secondaria di I grado.',
            tipo: 'PDF',
            profilo: { tipo: 'sostegno', ordine: 'secondaria1', scopo_sostegno: 'richiesta' },
          },
          {
            id: 'richiesta-sostegno-secondaria2',
            nome: 'Richiesta di sostegno – Secondaria di II grado',
            descrizione: 'Domanda di accertamento e assegnazione delle ore di sostegno per la scuola secondaria di II grado.',
            tipo: 'PDF',
            profilo: { tipo: 'sostegno', ordine: 'secondaria2', scopo_sostegno: 'richiesta' },
          },
        ],
        sotto: [
          {
            id: 'per-destinatario',
            nome: 'Per destinatario',
            descrizione: 'La richiesta può essere indirizzata all’istituzione scolastica, alla NPIA/ASL o al Comune.',
            documenti: [
              {
                id: 'richiesta-sostegno-npia',
                nome: 'Richiesta di accertamento – destinatario NPIA/ASL',
                descrizione: 'Richiesta alla NPIA/ASL di accertamento ai fini della certificazione per il sostegno.',
                tipo: 'PDF',
                profilo: { tipo: 'sostegno', scopo_sostegno: 'richiesta', destinatario: 'npia_asl' },
              },
              {
                id: 'richiesta-sostegno-comune-autonomia',
                nome: 'Richiesta Assistente all’Autonomia – Comune',
                descrizione: 'Richiesta al Comune di attivazione dell’Assistente all’Autonomia e alla Comunicazione.',
                tipo: 'PDF',
                profilo: { tipo: 'sostegno', scopo_sostegno: 'autonomia', destinatario: 'comune' },
              },
            ],
          },
        ],
      },

      {
        id: 'pei-documentazione',
        nome: 'PEI e documentazione dell’inclusione',
        descrizione: 'PEI, osservazioni, verbali e documentazione per la progettazione inclusiva.',
        documenti: [
          {
            id: 'pei-osservazioni',
            nome: 'Modello PEI – sezione osservazioni',
            descrizione: 'Schema di osservazione per il PEI e per gli aggiornamenti del piano di inclusione.',
            tipo: 'PDF',
            catalogoId: 'pei-osservazioni',
            profilo: { tipo: 'pei', scopo_sostegno: 'pei' },
          },
          {
            id: 'proposta-pei',
            nome: 'Proposta PEI compilabile',
            descrizione: 'Bozza di proposta PEI con i campi per la compilazione da parte del GLO.',
            tipo: 'PDF',
            profilo: { tipo: 'pei', scopo_sostegno: 'pei' },
          },
          {
            id: 'verbale-glho',
            nome: 'Verbale di accoglienza / GLHO',
            descrizione: 'Modello di verbale per la riunione di accoglienza e per il GLHO.',
            tipo: 'PDF',
            profilo: { tipo: 'pei', scopo_sostegno: 'pei' },
          },
        ],
        sotto: [
          {
            id: 'modelli-nazionali-pei',
            nome: 'Modelli nazionali (D.I. 182/2020)',
            descrizione: 'Modelli nazionali del PEI e documenti collegati.',
            documenti: [
              {
                id: 'pei-nazionale-dotazione',
                nome: 'Modello nazionale PEI – dotazione tipo',
                descrizione: 'Modello nazionale di PEI previsto dal D.I. 182/2020.',
                tipo: 'PDF',
                profilo: { tipo: 'pei', scopo_sostegno: 'pei' },
              },
              {
                id: 'pei-nazionale-calendario',
                nome: 'Calendario delle verifiche PEI',
                descrizione: 'Prospetto delle verifiche intermedie e finali del PEI.',
                tipo: 'PDF',
                profilo: { tipo: 'pei', scopo_sostegno: 'pei' },
              },
            ],
          },
        ],
      },
      {
        id: 'incarichi-sostegno',
        nome: 'Incarichi e disponibilità',
        descrizione: 'Manifestazioni di disponibilità e incarichi sul sostegno (ADEE/ADSS).',
        documenti: [
          {
            id: 'sostegno-disponibilita',
            nome: 'Domanda disponibilità incarico sostegno (ADEE/ADSS)',
            descrizione: 'Modello per manifestare la disponibilità a incarichi di sostegno nelle classi ADEE/ADSS.',
            tipo: 'DOCX',
            catalogoId: 'sostegno-disponibilita',
            profilo: { tipo: 'sostegno', scopo_sostegno: 'incarico' },
          },
        ],
      },
      {
        id: 'certificazione',
        nome: 'Certificazione e NPIA/ASL',
        descrizione: 'Richiesta e documentazione per la certificazione ai fini del sostegno.',
        documenti: [
          {
            id: 'richiesta-certificazione',
            nome: 'Richiesta certificazione alla NPIA/ASL',
            descrizione: 'Richiesta di valutazione e certificazione ai sensi della L.104/92.',
            tipo: 'PDF',
            profilo: { tipo: 'certificazione', scopo_sostegno: 'richiesta', destinatario: 'npia_asl' },
          },
          {
            id: 'autodichiarazione-104',
            nome: 'Autodichiarazione condizioni di salute (L.104/92)',
            descrizione: 'Dichiarazione sostitutiva per l’accesso ai benefici della L.104/92.',
            tipo: 'PDF',
            profilo: { tipo: 'certificazione' },
          },
        ],
      },

      {
        id: 'assistenza-autonomia',
        nome: 'Assistenza all’Autonomia (Comune)',
        descrizione: 'Richieste e accordi per l’Assistente all’Autonomia e alla Comunicazione.',
        documenti: [
          {
            id: 'richiesta-assistente-autonomia',
            nome: 'Richiesta Assistente all’Autonomia – Comune',
            descrizione: 'Richiesta al Comune di attivazione dell’Assistente all’Autonomia.',
            tipo: 'PDF',
            profilo: { tipo: 'sostegno', scopo_sostegno: 'autonomia', destinatario: 'comune' },
          },
          {
            id: 'patto-autonomia',
            nome: 'Patto di corresponsabilità – Assistente all’Autonomia',
            descrizione: 'Accordo tra famiglia, scuola e Comune per l’assistenza all’autonomia.',
            tipo: 'PDF',
            profilo: { tipo: 'sostegno', scopo_sostegno: 'autonomia' },
          },
        ],
      },
      {
        id: 'figure-supporto',
        nome: 'Figure di supporto',
        descrizione: 'Educatori, assistenti alla comunicazione e altre figure di supporto.',
        documenti: [
          {
            id: 'richiesta-educatore',
            nome: 'Richiesta educatore scolastico',
            descrizione: 'Richiesta di attivazione della figura dell’educatore scolastico.',
            tipo: 'PDF',
            profilo: { tipo: 'sostegno', scopo_sostegno: 'autonomia' },
          },
          {
            id: 'richiesta-assistente-comunicazione',
            nome: 'Richiesta assistente alla comunicazione',
            descrizione: 'Richiesta di assistente alla comunicazione per alunni con disabilità sensoriale.',
            tipo: 'PDF',
            profilo: { tipo: 'sostegno', scopo_sostegno: 'autonomia' },
          },
        ],
      },
      {
        id: 'laboratori-inclusivi',
        nome: 'Laboratori e progetti inclusivi',
        descrizione: 'Proposte progettuali per laboratori inclusivi e PON/PNRR.',
        documenti: [
          {
            id: 'proposta-laboratorio-inclusivo',
            nome: 'Proposta laboratorio inclusivo',
            descrizione: 'Scheda di proposta per un laboratorio a valenza inclusiva.',
            tipo: 'PDF',
            profilo: { tipo: 'sostegno', scopo_sostegno: 'pei' },
          },
        ],
      },
      {
        id: 'gruppi-lavoro',
        nome: 'Gruppi di lavoro (GLI, GLHO, GLO)',
        descrizione: 'Convocazioni, verbali e richieste dei gruppi per l\u2019inclusione.',
        sotto: [
          {
            id: 'convocazioni-glo',
            nome: 'Convocazioni',
            descrizione: 'Convocazioni delle riunioni dei gruppi per l\u2019inclusione.',
            documenti: [
              {
                id: 'convocazione-glo',
                nome: 'Convocazione GLO / GLHO / GLI',
                descrizione: 'Modello di convocazione per le riunioni dei gruppi per l\u2019inclusione.',
                tipo: 'PDF',
                profilo: { tipo: 'convocazione_glo', scopo_sostegno: 'pei' },
              },
            ],
          },
          {
            id: 'verbali-glo-gruppi',
            nome: 'Verbali GLO / GLHO',
            descrizione: 'Verbali di insediamento, verifica intermedia e finale del GLO.',
            documenti: [
              {
                id: 'verbale-insediamento-glo',
                nome: 'Verbale insediamento GLO',
                descrizione: 'Verbale della riunione di insediamento del Gruppo di Lavoro Operativo.',
                tipo: 'PDF',
                profilo: { tipo: 'verbale_glo', scopo_sostegno: 'pei' },
              },
              {
                id: 'verbale-verifica-intermedia-glo',
                nome: 'Verbale verifica intermedia GLO',
                descrizione: 'Verbale della verifica intermedia del PEI con il GLO.',
                tipo: 'PDF',
                profilo: { tipo: 'verbale_glo', scopo_sostegno: 'pei' },
              },
              {
                id: 'verbale-finale-glo',
                nome: 'Verbale finale GLO',
                descrizione: 'Verbale della verifica finale e della proposta di continuità.',
                tipo: 'PDF',
                profilo: { tipo: 'verbale_glo', scopo_sostegno: 'pei' },
              },
            ],
          },
          {
            id: 'ore-sostegno-glo',
            nome: 'Ore di sostegno',
            descrizione: 'Richieste di inserimento o variazione delle ore di sostegno.',
            documenti: [
              {
                id: 'richiesta-variazione-ore-sostegno',
                nome: 'Richiesta inserimento / variazione ore di sostegno',
                descrizione: 'Istanza di inserimento o variazione delle ore di sostegno assegnate.',
                tipo: 'PDF',
                profilo: { tipo: 'sostegno', scopo_sostegno: 'richiesta' },
              },
            ],
          },
        ],
      },
      {
        id: 'formazione-titoli',
        nome: 'Formazione e titoli',
        descrizione: 'Specializzazione sul sostegno, formazione e titoli di accesso.',
        documenti: [
          {
            id: 'specializzazione-sostegno',
            nome: 'Domanda di specializzazione sul sostegno',
            descrizione: 'Domanda di iscrizione ai percorsi di specializzazione sul sostegno.',
            tipo: 'PDF',
            profilo: { tipo: 'sostegno', scopo_sostegno: 'incarico' },
          },
        ],
      },
      {
        id: 'normativa-inclusione',
        nome: 'Normativa di riferimento',
        descrizione: 'Schemi e sintesi normative (L.104/92, D.Lgs.66/2017, D.I. 182/2020).',
        documenti: [
          {
            id: 'sintesi-normativa-inclusione',
            nome: 'Sintesi normativa inclusione (L.104/92, D.Lgs.66/2017)',
            descrizione: 'Promemoria operativo con i riferimenti normativi essenziali per il sostegno.',
            tipo: 'PDF',
            profilo: { tipo: 'sostegno' },
          },
        ],
      },
      {
        id: 'reclutamento-bandi',
        nome: 'Reclutamento e bandi',
        descrizione: 'Graduatorie, supplenze e bandi per il personale di sostegno.',
        documenti: [
          {
            id: 'domanda-graduatoria-sostegno',
            nome: 'Domanda inserimento in graduatoria',
            descrizione: 'Istanza di inserimento in graduatoria per il personale docente di sostegno.',
            tipo: 'PDF',
            profilo: { tipo: 'sostegno', scopo_sostegno: 'incarico' },
          },
        ],
      },
      {
        id: 'revisione-ore',
        nome: 'Revisione delle ore di sostegno',
        descrizione: 'Riduzione, revisione e integrazione delle ore assegnate.',
        documenti: [
          {
            id: 'istanza-revisione-ore',
            nome: 'Istanza di revisione ore di sostegno',
            descrizione: 'Richiesta di revisione delle ore di sostegno assegnate all’alunno.',
            tipo: 'PDF',
            profilo: { tipo: 'sostegno', scopo_sostegno: 'richiesta' },
          },
        ],
      },
      {
        id: 'tecnologie-assistive',
        nome: 'Tecnologie e ausili',
        descrizione: 'Richieste di ausili, tecnologie assistive e strumenti compensativi.',
        documenti: [
          {
            id: 'richiesta-ausili',
            nome: 'Richiesta ausili e tecnologie assistive',
            descrizione: 'Istanza per l’assegnazione di ausili e tecnologie assistive (Comune/ASL).',
            tipo: 'PDF',
            profilo: { tipo: 'sostegno', scopo_sostegno: 'richiesta', destinatario: 'comune' },
          },
        ],
      },
      {
        id: 'uscite-inclusive',
        nome: 'Uscite e gite inclusive',
        descrizione: 'Progetti e autorizzazioni per uscite didattiche inclusive.',
        documenti: [
          {
            id: 'progetto-gita-inclusiva',
            nome: 'Progetto gita inclusiva',
            descrizione: 'Scheda progettuale per uscite didattiche con alunni con disabilità.',
            tipo: 'PDF',
            profilo: { tipo: 'sostegno', scopo_sostegno: 'pei' },
          },
        ],
      },
      {
        id: 'spettro-autistico',
        nome: 'Disturbi dello spettro autistico',
        descrizione: 'Modelli e richieste per alunni con disturbi dello spettro autistico.',
        documenti: [
          {
            id: 'modello-autismo',
            nome: 'Modello segnalazione disturbo dello spettro autistico',
            descrizione: 'Segnalazione e richiesta di supporto per alunni con disturbi dello spettro autistico.',
            tipo: 'PDF',
            profilo: { tipo: 'sostegno', scopo_sostegno: 'richiesta' },
          },
        ],
      },
      {
        id: 'rapporti-enti',
        nome: 'Rapporti con associazioni ed enti',
        descrizione: 'Convenzioni e collaborazioni con associazioni ed enti del terzo settore.',
        documenti: [
          {
            id: 'convenzione-associazione',
            nome: 'Richiesta convenzione con associazione',
            descrizione: 'Istanza per attivare una convenzione con associazioni ed enti del terzo settore.',
            tipo: 'PDF',
            profilo: { tipo: 'sostegno' },
          },
        ],
      },
      {
        id: 'segnalazioni-asl',
        nome: 'Segnalazioni ASL e richieste di visita',
        descrizione: 'Segnalazioni ai servizi sanitari, richieste di visita e accertamenti.',
        documenti: [
          {
            id: 'segnalazione-asl-sostegno',
            nome: 'Segnalazione ASL per accertamento',
            descrizione: 'Segnalazione ai servizi ASL/NPIA per la valutazione ai fini del sostegno.',
            tipo: 'PDF',
            profilo: { tipo: 'sostegno', scopo_sostegno: 'richiesta', destinatario: 'npia_asl' },
          },
        ],
      },
      {
        id: 'richiesta-pei',
        nome: 'Richiesta PEI e aggiornamenti',
        descrizione: 'Richieste di compilazione, revisione e aggiornamento del PEI.',
        documenti: [
          {
            id: 'richiesta-compilazione-pei',
            nome: 'Richiesta compilazione PEI',
            descrizione: 'Istanza per la compilazione o la revisione del PEI da parte del GLO.',
            tipo: 'PDF',
            profilo: { tipo: 'pei', scopo_sostegno: 'pei' },
          },
        ],
      },
      {
        id: 'verbali-glo',
        nome: 'Verbali GLO e GLHO',
        descrizione: 'Verbali delle riunioni del GLO, del GLHO e del GLI.',
        documenti: [
          {
            id: 'verbale-glo-riunione',
            nome: 'Verbale riunione GLO',
            descrizione: 'Modello di verbale per le riunioni del Gruppo di Lavoro Operativo.',
            tipo: 'PDF',
            profilo: { tipo: 'verbale_glo', scopo_sostegno: 'pei' },
          },
        ],
      },
      {
        id: 'assistenza-specialistica',
        nome: 'Assistenza specialistica (Comune)',
        descrizione: 'Richieste al Comune per l’assistenza specialistica e socio-educativa.',
        documenti: [
          {
            id: 'richiesta-assistenza-specialistica',
            nome: 'Richiesta assistenza specialistica',
            descrizione: 'Istanza al Comune per l’attivazione dell’assistenza specialistica.',
            tipo: 'PDF',
            profilo: { tipo: 'assistenza_comune', scopo_sostegno: 'autonomia', destinatario: 'comune' },
          },
        ],
      },
      {
        id: 'trasporto-disabili',
        nome: 'Trasporto alunni disabili',
        descrizione: 'Richieste di trasporto dedicato per alunni con disabilità.',
        documenti: [
          {
            id: 'richiesta-trasporto-disabili',
            nome: 'Richiesta trasporto alunno disabile',
            descrizione: 'Istanza per il servizio di trasporto scolastico dedicato.',
            tipo: 'PDF',
            profilo: { tipo: 'sostegno', scopo_sostegno: 'richiesta' },
          },
        ],
      },
      {
        id: 'pdp-bes',
        nome: 'PDP e BES',
        descrizione: 'Piani Didattici Personalizzati per DSA e BES.',
        sotto: [
          {
            id: 'pdp-dsa',
            nome: 'PDP DSA (L. 170/2010)',
            descrizione: 'Piano Didattico Personalizzato per alunni con DSA certificati.',
            documenti: [
              {
                id: 'pdp-dsa',
                nome: 'Piano Didattico Personalizzato DSA (L. 170/2010)',
                descrizione: 'Modello di PDP per alunni con DSA certificati.',
                tipo: 'PDF',
                profilo: { tipo: 'pdp_dsa', scopo_sostegno: 'pdp_dsa' },
              },
            ],
          },
          {
            id: 'pdp-bes-non-certificati',
            nome: 'PDP BES non certificati',
            descrizione: 'PDP per alunni con BES non certificati (svantaggio).',
            documenti: [
              {
                id: 'pdp-bes-non-certificati',
                nome: 'PDP BES non certificati',
                descrizione: 'Piano Didattico Personalizzato per BES non certificati.',
                tipo: 'PDF',
                profilo: { tipo: 'pdp_bes', scopo_sostegno: 'pdp_bes' },
              },
            ],
          },
          {
            id: 'misure-compensative',
            nome: 'Misure compensative / dispensative',
            descrizione: 'Schede delle misure compensative e dispensative.',
            documenti: [
              {
                id: 'misure-compensative',
                nome: 'Misure compensative e dispensative',
                descrizione: 'Scheda delle misure compensative e dispensative adottate.',
                tipo: 'PDF',
                profilo: { tipo: 'pdp_bes', scopo_sostegno: 'misure' },
              },
            ],
          },
        ],
      },
      {
        id: 'documenti-pei-glo',
        nome: 'Documenti PEI e GLO',
        descrizione: 'Verbali di insediamento del GLO, schede di sintesi PEI e richieste di ore.',
        sotto: [
          {
            id: 'verbale-insediamento-glo',
            nome: 'Verbale insediamento GLO',
            descrizione: 'Verbale di insediamento del Gruppo di Lavoro Operativo.',
            documenti: [
              {
                id: 'verbale-insediamento-glo',
                nome: 'Verbale insediamento GLO',
                descrizione: 'Modello di verbale per l\u2019insediamento del GLO.',
                tipo: 'PDF',
                profilo: { tipo: 'pei', scopo_sostegno: 'pei' },
              },
            ],
          },
          {
            id: 'scheda-sintesi-pei',
            nome: 'Scheda di sintesi PEI (D.I. 182/2020)',
            descrizione: 'Scheda di sintesi del PEI secondo i modelli nazionali.',
            documenti: [
              {
                id: 'scheda-sintesi-pei',
                nome: 'Scheda di sintesi PEI (D.I. 182/2020)',
                descrizione: 'Scheda di sintesi del PEI conforme al D.I. 182/2020.',
                tipo: 'PDF',
                profilo: { tipo: 'pei', scopo_sostegno: 'pei' },
              },
            ],
          },
          {
            id: 'richiesta-ore-sostegno',
            nome: 'Richiesta ore di sostegno',
            descrizione: 'Richieste di ore di sostegno e assistenza specialistica.',
            documenti: [
              {
                id: 'richiesta-ore-sostegno',
                nome: 'Richiesta ore di sostegno / assistenza specialistica',
                descrizione: 'Istanza per l\u2019assegnazione di ore di sostegno e assistenza specialistica.',
                tipo: 'PDF',
                profilo: { tipo: 'sostegno', scopo_sostegno: 'richiesta' },
              },
            ],
          },
        ],
      },
      {
        id: 'verbali-relazioni',
        nome: 'Verbali e Relazioni',
        descrizione: 'Relazioni finali PEI/PDP, verbali di verifica e trasporto protetto.',
        sotto: [
          {
            id: 'relazione-finale-pei-pdp',
            nome: 'Relazione finale PEI / PDP',
            descrizione: 'Relazioni finali di verifica dei percorsi di inclusione.',
            documenti: [
              {
                id: 'relazione-finale-pei-pdp',
                nome: 'Relazione finale PEI / PDP',
                descrizione: 'Modello di relazione finale di verifica del PEI o del PDP.',
                tipo: 'PDF',
                profilo: { tipo: 'relazione_finale', scopo_sostegno: 'pei' },
              },
            ],
          },
          {
            id: 'verifica-intermedia-sostegno',
            nome: 'Verbale di verifica intermedia',
            descrizione: 'Verbali di verifica intermedia del PEI.',
            documenti: [
              {
                id: 'verifica-intermedia-sostegno',
                nome: 'Verbale di verifica intermedia PEI',
                descrizione: 'Modello di verbale per la verifica intermedia del PEI.',
                tipo: 'PDF',
                profilo: { tipo: 'pei', scopo_sostegno: 'pei' },
              },
            ],
          },
          {
            id: 'trasporto-protetto',
            nome: 'Trasporto scolastico protetto',
            descrizione: 'Richieste di trasporto scolastico protetto.',
            documenti: [
              {
                id: 'trasporto-protetto',
                nome: 'Richiesta trasporto scolastico protetto',
                descrizione: 'Istanza di trasporto scolastico protetto per alunni con disabilità.',
                tipo: 'PDF',
                profilo: { tipo: 'trasporto_protetto', scopo_sostegno: 'richiesta' },
              },
            ],
          },
        ],
      },
      {
        id: 'esoneri-sostegno',
        nome: 'Esoneri e riduzioni',
        descrizione: 'Esoneri da attività e riduzioni di orario per motivi di salute.',
        documenti: [
          {
            id: 'esonero-attivita-sostegno',
            nome: 'Richiesta esonero attività per motivi di salute',
            descrizione: 'Istanza di esonero dalle attività didattiche con certificato medico.',
            tipo: 'PDF',
            profilo: { tipo: 'certificazione' },
          },
        ],
      },
      {
        id: 'ricorsi-sostegno',
        nome: 'Ricorsi e opposizioni',
        descrizione: 'Ricorsi avverso dinieghi e provvedimenti in materia di sostegno.',
        documenti: [
          {
            id: 'ricorso-sostegno',
            nome: 'Ricorso avverso diniego di sostegno',
            descrizione: 'Modello di ricorso amministrativo avverso il diniego di sostegno.',
            tipo: 'PDF',
            profilo: { tipo: 'ricorso_reclamo' },
          },
        ],
      },
    ],
  },

  {
    id: 'infanzia',
    nome: 'Infanzia',
    sotto: [
      {
        id: 'iscrizione-infanzia',
        nome: 'Iscrizione e documenti',
        descrizione: 'Iscrizione alla scuola dell’infanzia e documentazione di accompagnamento.',
        documenti: [
          {
            id: 'iscrizione-infanzia',
            nome: 'Domanda di iscrizione – Scuola dell’Infanzia',
            descrizione: 'Modello di domanda di iscrizione per la scuola dell’infanzia.',
            tipo: 'PDF',
            profilo: { tipo: 'iscrizione', ordine: 'infanzia' },
          },
          {
            id: 'nullaosta-frequenza',
            nome: 'Nulla osta di frequenza',
            descrizione: 'Richiesta di nulla osta per la frequenza della scuola dell’infanzia.',
            tipo: 'PDF',
            profilo: { tipo: 'iscrizione', ordine: 'infanzia' },
          },
        ],
      },
      {
        id: 'mensa-diete',
        nome: 'Mensa e diete speciali',
        descrizione: 'Richieste per il servizio mensa e per le diete speciali.',
        documenti: [
          {
            id: 'richiesta-mensa-dieta',
            nome: 'Richiesta mensa e dieta speciale',
            descrizione: 'Modulo per la richiesta del servizio mensa e della dieta speciale certificata.',
            tipo: 'PDF',
            profilo: { tipo: 'mensa', ordine: 'infanzia' },
          },
        ],
      },
      {
        id: 'trasporto-infanzia',
        nome: 'Trasporto scolastico',
        descrizione: 'Domande per il servizio di trasporto scolastico.',
        documenti: [
          {
            id: 'richiesta-trasporto-infanzia',
            nome: 'Richiesta trasporto scolastico – Infanzia',
            descrizione: 'Domanda per l’attivazione del trasporto scolastico comunale.',
            tipo: 'PDF',
            profilo: { tipo: 'iscrizione', ordine: 'infanzia' },
          },
        ],
      },
      {
        id: 'sezioni-primavera',
        nome: 'Sezioni Primavera',
        descrizione: 'Iscrizione e documentazione per le Sezioni Primavera (0-3).',
        documenti: [
          {
            id: 'iscrizione-sezione-primavera',
            nome: 'Domanda di iscrizione – Sezione Primavera',
            descrizione: 'Domanda di iscrizione ai servizi educativi per la fascia 0-3 anni.',
            tipo: 'PDF',
            profilo: { tipo: 'iscrizione', ordine: 'infanzia' },
          },
        ],
      },
      {
        id: 'sostegno-infanzia',
        nome: 'Sostegno e inclusione',
        descrizione: 'Documentazione per l\u2019inclusione: PEI, PDP, NAI e relazioni finali.',
        sotto: [
          {
            id: 'pei-glo-infanzia',
            nome: 'PEI e Gestione GLO',
            descrizione: 'Verbali, proposte e gestione del Gruppo di Lavoro Operativo.',
            documenti: [
              {
                id: 'sostegno-infanzia',
                nome: 'Richiesta di sostegno – Scuola dell\u2019Infanzia',
                descrizione: 'Domanda di accertamento e assegnazione delle ore di sostegno per l\u2019infanzia.',
                tipo: 'PDF',
                profilo: { tipo: 'sostegno', ordine: 'infanzia', scopo_sostegno: 'richiesta' },
              },
              {
                id: 'verbale-glo-infanzia',
                nome: 'Verbale GLO / GLHO – Infanzia',
                descrizione: 'Verbale delle riunioni del GLO per la scuola dell\u2019infanzia.',
                tipo: 'PDF',
                profilo: { tipo: 'verbale_glo', ordine: 'infanzia', scopo_sostegno: 'pei' },
              },
              {
                id: 'proposta-pei-infanzia',
                nome: 'Proposta PEI – Infanzia',
                descrizione: 'Bozza di proposta PEI per la scuola dell\u2019infanzia.',
                tipo: 'PDF',
                profilo: { tipo: 'pei', ordine: 'infanzia', scopo_sostegno: 'pei' },
              },
            ],
          },
          {
            id: 'pdp-infanzia',
            nome: 'PDP (DSA e BES)',
            descrizione: 'Piani Didattici Personalizzati per DSA e BES.',
            documenti: [
              {
                id: 'pdp-dsa-infanzia',
                nome: 'PDP DSA (L. 170/2010) – Infanzia',
                descrizione: 'Piano Didattico Personalizzato per alunni con DSA certificati.',
                tipo: 'PDF',
                profilo: { tipo: 'pdp_dsa', ordine: 'infanzia', scopo_sostegno: 'pdp_dsa' },
              },
              {
                id: 'pdp-bes-infanzia',
                nome: 'PDP BES – Infanzia',
                descrizione: 'Piano Didattico Personalizzato per alunni con BES non certificati.',
                tipo: 'PDF',
                profilo: { tipo: 'pdp_bes', ordine: 'infanzia', scopo_sostegno: 'pdp_bes' },
              },
            ],
          },
          {
            id: 'nai-infanzia',
            nome: 'Inclusione NAI e Mediatori',
            descrizione: 'Piani personalizzati e progetti di alfabetizzazione per alunni stranieri.',
            documenti: [
              {
                id: 'piano-nai-infanzia',
                nome: 'Piano personalizzato NAI – Infanzia',
                descrizione: 'Piano di Studio Personalizzato per alunni NAI non alfabetizzati: scheda di ingresso QCER (A0-B1), laboratorio italiano L2 e progettazione per Assi/Macro-Aree.',
                tipo: 'PDF',
                profilo: { tipo: 'piano_personalizzato_nai', ordine: 'infanzia' },
              },
              {
                id: 'progetto-alfabetizzazione-infanzia',
                nome: 'Progetto alfabetizzazione / italiano L2 – Infanzia',
                descrizione: 'Progetto di alfabetizzazione e mediazione per alunni NAI.',
                tipo: 'PDF',
                profilo: { tipo: 'progetto_alfabetizzazione', ordine: 'infanzia' },
              },
            ],
          },
          {
            id: 'relazioni-finali-infanzia',
            nome: 'Relazioni e Monitoraggio Finale',
            descrizione: 'Relazioni finali di inclusione e monitoraggio del percorso.',
            documenti: [
              {
                id: 'relazione-finale-inclusione-infanzia',
                nome: 'Relazione finale inclusione – Infanzia',
                descrizione: 'Relazione finale di verifica del percorso di inclusione (PEI/PDP): 4 Dimensioni ICF strutturate (D.I. 182/2020), esiti e proposte di transizione (art. 10 D.Lgs. 66/2017).',
                tipo: 'PDF',
                profilo: { tipo: 'relazione_finale_inclusione', ordine: 'infanzia' },
              },
            ],
          },
        ],
      },
      {
        id: 'uscite-infanzia',
        nome: 'Uscite didattiche e autorizzazioni',
        descrizione: 'Autorizzazioni per uscite didattiche e attività fuori sede.',
        documenti: [
          {
            id: 'autorizzazione-uscita-infanzia',
            nome: 'Autorizzazione uscita didattica – Infanzia',
            descrizione: 'Modulo di autorizzazione per le uscite didattiche della scuola dell’infanzia.',
            tipo: 'PDF',
            profilo: { tipo: 'uscite_didattiche', ordine: 'infanzia' },
          },
        ],
      },
      {
        id: 'rette-convenzioni',
        nome: 'Rette e convenzioni',
        descrizione: 'Richiesta di riduzione retta e documentazione economica.',
        documenti: [
          {
            id: 'richiesta-riduzione-retta',
            nome: 'Richiesta riduzione retta mensa',
            descrizione: 'Domanda di riduzione della retta per il servizio mensa (ISEE).',
            tipo: 'PDF',
            profilo: { tipo: 'mensa', ordine: 'infanzia' },
          },
        ],
      },
      {
        id: 'documenti-famiglia-infanzia',
        nome: 'Documenti per la famiglia',
        descrizione: 'Modulistica per le famiglie: autocertificazioni, deleghe, assenze e privacy.',
        sotto: [
          {
            id: 'autocert-famiglia-infanzia',
            nome: 'Autocertificazioni e Stato Famiglia',
            descrizione: 'Dichiarazioni sostitutive e stato di famiglia.',
            documenti: [
              {
                id: 'dichiarazione-famiglia-infanzia',
                nome: 'Dichiarazione stato di famiglia',
                descrizione: 'Dichiarazione sostitutiva dello stato di famiglia per la scuola dell’infanzia.',
                tipo: 'PDF',
                profilo: { tipo: 'autocertificazione', ordine: 'infanzia' },
              },
            ],
          },
          {
            id: 'deleghe-ritiro-infanzia',
            nome: 'Deleghe e Ritiro Alunni',
            descrizione: 'Delega al ritiro del bambino da parte di parenti o conoscenti.',
            documenti: [
              {
                id: 'delega-ritiro-infanzia',
                nome: 'Delega ritiro bambino/a (parenti / conoscenti)',
                descrizione: 'Modulo di delega al ritiro del bambino da parte di parenti o conoscenti.',
                tipo: 'PDF',
                profilo: { tipo: 'delega_famiglia', ordine: 'infanzia' },
              },
            ],
          },
          {
            id: 'assenze-giustif-infanzia',
            nome: 'Assenze e Giustificazioni',
            descrizione: 'Comunicazioni di assenza, permessi orari e istruzione parentale.',
            documenti: [
              {
                id: 'istruzione-parentale-infanzia',
                nome: 'Comunicazione assenze / istruzione parentale',
                descrizione: 'Comunicazione dell’intenzione di avvalersi dell’istruzione parentale o assenze prolungate.',
                tipo: 'PDF',
                profilo: { tipo: 'istruzione_parentale', ordine: 'infanzia' },
              },
              {
                id: 'permesso-orario-infanzia',
                nome: 'Richiesta permesso orario / uscita anticipata',
                descrizione: 'Modulo per entrata posticipata, uscita anticipata o assenza breve.',
                tipo: 'PDF',
                profilo: { tipo: 'permesso_orario', ordine: 'infanzia' },
              },
              {
                id: 'congedo-maternita-infanzia',
                nome: 'Congedo di maternità / paternità',
                descrizione: 'Richiesta di congedo obbligatorio di maternità o paternità (D.Lgs. 151/2001).',
                tipo: 'PDF',
                profilo: { tipo: 'congedo_maternita', ordine: 'infanzia' },
              },
            ],
          },
          {
            id: 'accesso-privacy-infanzia',
            nome: 'Accesso agli Atti e Privacy',
            descrizione: 'Accesso agli atti (L. 241/1990) e consensi per immagini e dati personali.',
            documenti: [
              {
                id: 'accesso-atti-infanzia',
                nome: 'Richiesta accesso agli atti (L. 241/1990)',
                descrizione: 'Istanza di accesso ai documenti amministrativi della scuola.',
                tipo: 'PDF',
                profilo: { tipo: 'accesso_atti', ordine: 'infanzia' },
              },
              {
                id: 'consenso-foto-infanzia',
                nome: 'Consenso foto / video',
                descrizione: 'Consenso al trattamento e alla pubblicazione di immagini e riprese video.',
                tipo: 'PDF',
                profilo: { tipo: 'consenso_foto', ordine: 'infanzia' },
              },
            ],
          },
        ],
      },
      {
        id: 'didattica-progetti-infanzia',
        nome: 'Didattica e Progetti',
        descrizione: 'Schede di osservazione, progetti di continuità e autorizzazioni per uscite e laboratori.',
        sotto: [
          {
            id: 'schede-osservazione-infanzia',
            nome: 'Schede di osservazione',
            descrizione: 'Schede di osservazione delle competenze per la scuola dell\u2019infanzia.',
            documenti: [
              {
                id: 'scheda-osservazione-infanzia',
                nome: 'Scheda osservazione competenze – Infanzia',
                descrizione: 'Scheda di osservazione delle competenze per la scuola dell\u2019infanzia.',
                tipo: 'PDF',
                profilo: { tipo: 'schede_osservazione', ordine: 'infanzia' },
              },
            ],
          },
          {
            id: 'continuita-nido-infanzia',
            nome: 'Progetti continuità nido-infanzia',
            descrizione: 'Adesione ai progetti di continuità tra nido e scuola dell\u2019infanzia.',
            documenti: [
              {
                id: 'continuita-nido-infanzia',
                nome: 'Adesione progetto continuità nido-infanzia',
                descrizione: 'Consenso alla partecipazione al progetto continuità nido-infanzia.',
                tipo: 'PDF',
                profilo: { tipo: 'progetto_continuita', ordine: 'infanzia' },
              },
            ],
          },
          {
            id: 'uscite-laboratori-infanzia',
            nome: 'Uscite e laboratori',
            descrizione: 'Autorizzazioni per uscite didattiche e attività di laboratorio.',
            documenti: [
              {
                id: 'autorizzazione-uscite-laboratori',
                nome: 'Autorizzazione uscite / laboratori – Infanzia',
                descrizione: 'Modulo di autorizzazione per uscite didattiche e laboratori.',
                tipo: 'PDF',
                profilo: { tipo: 'uscite_didattiche', ordine: 'infanzia' },
              },
            ],
          },
        ],
      },
      {
        id: 'organizzazione-servizi-infanzia',
        nome: 'Organizzazione e Servizi',
        descrizione: 'Mensa, diete speciali, pre/post scuola e rinunce.',
        sotto: [
          {
            id: 'mensa-org-infanzia',
            nome: 'Mensa e diete speciali',
            descrizione: 'Richieste per il servizio mensa e le diete speciali.',
            documenti: [
              {
                id: 'mensa-diete-organizzazione',
                nome: 'Modulo mensa / diete speciali',
                descrizione: 'Richiesta del servizio mensa e della dieta speciale certificata.',
                tipo: 'PDF',
                profilo: { tipo: 'mensa', ordine: 'infanzia' },
              },
            ],
          },
          {
            id: 'prepost-infanzia',
            nome: 'Pre / Post scuola',
            descrizione: 'Richiesta del servizio di pre e post scuola.',
            documenti: [
              {
                id: 'servizio-prepost-infanzia',
                nome: 'Richiesta servizio pre / post scuola',
                descrizione: 'Domanda di attivazione del servizio pre / post scuola.',
                tipo: 'PDF',
                profilo: { tipo: 'servizi_prepost', ordine: 'infanzia' },
              },
            ],
          },
          {
            id: 'rinunce-infanzia',
            nome: 'Rinunce e ritiri',
            descrizione: 'Rinuncia o ritiro dell\u2019iscrizione.',
            documenti: [
              {
                id: 'rinuncia-iscrizione-infanzia',
                nome: 'Rinuncia / ritiro iscrizione – Infanzia',
                descrizione: 'Modulo di rinuncia o ritiro dell\u2019iscrizione.',
                tipo: 'PDF',
                profilo: { tipo: 'rinuncia_iscrizione', ordine: 'infanzia' },
              },
            ],
          },
        ],
      },
      {
        id: 'servizi-educativi',
        nome: 'Servizi educativi 0-6',
        descrizione: 'Nidi, sezioni primavera e servizi integrativi 0-6.',
        sotto: [
          {
            id: 'nidi-infanzia',
            nome: 'Nidi d’infanzia',
            descrizione: 'Iscrizione ai nidi e rette.',
            documenti: [
              {
                id: 'iscrizione-nido',
                nome: 'Domanda di iscrizione al nido d’infanzia',
                descrizione: 'Domanda di iscrizione ai nidi d’infanzia comunali.',
                tipo: 'PDF',
                profilo: { tipo: 'iscrizione', ordine: 'infanzia' },
              },
              {
                id: 'richiesta-retta-nido',
                nome: 'Richiesta agevolazione retta nido',
                descrizione: 'Domanda di agevolazione sulla retta del nido con ISEE.',
                tipo: 'PDF',
                profilo: { tipo: 'iscrizione', ordine: 'infanzia' },
              },
            ],
          },
          {
            id: 'liste-attesa',
            nome: 'Liste di attesa',
            descrizione: 'Iscrizione in lista d’attesa e comunicazioni.',
            documenti: [
              {
                id: 'iscrizione-lista-attesa',
                nome: 'Iscrizione in lista d’attesa',
                descrizione: 'Modulo per l’iscrizione in lista d’attesa dei servizi 0-6.',
                tipo: 'PDF',
                profilo: { tipo: 'iscrizione', ordine: 'infanzia' },
              },
            ],
          },
        ],
      },
      {
        id: 'richiesta-pei-infanzia',
        nome: 'Richiesta PEI – Infanzia',
        descrizione: 'Compilazione e aggiornamento del PEI per la scuola dell’infanzia.',
        documenti: [
          {
            id: 'richiesta-pei-infanzia-doc',
            nome: 'Richiesta compilazione PEI – Infanzia',
            descrizione: 'Istanza per la compilazione o la revisione del PEI nella scuola dell’infanzia.',
            tipo: 'PDF',
            profilo: { tipo: 'pei', ordine: 'infanzia', scopo_sostegno: 'pei' },
          },
        ],
      },
      {
        id: 'pdp-bes-infanzia',
        nome: 'PDP e BES – Infanzia',
        descrizione: 'Piani educativi personalizzati e percorsi per BES nella fascia 3-6.',
        documenti: [
          {
            id: 'pdp-infanzia',
            nome: 'Piano educativo personalizzato – Infanzia',
            descrizione: 'Modello di piano educativo personalizzato per la scuola dell’infanzia.',
            tipo: 'PDF',
            profilo: { tipo: 'pei', ordine: 'infanzia' },
          },
        ],
      },
      {
        id: 'segnalazioni-asl-infanzia',
        nome: 'Segnalazioni ASL – Infanzia',
        descrizione: 'Segnalazioni ai servizi sanitari e richieste di valutazione 0-6.',
        documenti: [
          {
            id: 'segnalazione-asl-infanzia',
            nome: 'Segnalazione ASL – Infanzia',
            descrizione: 'Segnalazione ai servizi sanitari per la valutazione di un bambino.',
            tipo: 'PDF',
            profilo: { tipo: 'certificazione', ordine: 'infanzia' },
          },
        ],
      },
      {
        id: 'assistenza-specialistica-infanzia',
        nome: 'Assistenza specialistica – Infanzia',
        descrizione: 'Richieste di assistenza specialistica e socio-educativa al Comune.',
        documenti: [
          {
            id: 'richiesta-assistenza-infanzia',
            nome: 'Richiesta assistenza specialistica – Infanzia',
            descrizione: 'Istanza al Comune per l’assistenza specialistica nella scuola dell’infanzia.',
            tipo: 'PDF',
            profilo: { tipo: 'sostegno', ordine: 'infanzia', scopo_sostegno: 'autonomia', destinatario: 'comune' },
          },
        ],
      },
      {
        id: 'trasporto-disabili-infanzia',
        nome: 'Trasporto disabili – Infanzia',
        descrizione: 'Trasporto dedicato per bambini con disabilità.',
        documenti: [
          {
            id: 'richiesta-trasporto-disabili-infanzia',
            nome: 'Richiesta trasporto dedicato – Infanzia',
            descrizione: 'Istanza per il trasporto scolastico dedicato di un bambino con disabilità.',
            tipo: 'PDF',
            profilo: { tipo: 'sostegno', ordine: 'infanzia' },
          },
        ],
      },
      {
        id: 'esoneri-infanzia',
        nome: 'Esoneri e deroghe – Infanzia',
        descrizione: 'Esoneri e deroghe per motivi di salute nella fascia 3-6.',
        documenti: [
          {
            id: 'esonero-infanzia',
            nome: 'Richiesta esonero – Infanzia',
            descrizione: 'Istanza di esonero dalle attività per motivi di salute certificati.',
            tipo: 'PDF',
            profilo: { tipo: 'certificazione', ordine: 'infanzia' },
          },
        ],
      },
      {
        id: 'ricorsi-infanzia',
        nome: 'Ricorsi e reclami – Infanzia',
        descrizione: 'Ricorsi e reclami per i servizi della prima infanzia.',
        documenti: [
          {
            id: 'ricorso-infanzia',
            nome: 'Reclamo servizi prima infanzia',
            descrizione: 'Modello di reclamo per i servizi educativi della prima infanzia.',
            tipo: 'PDF',
            profilo: { tipo: 'ricorso_reclamo', ordine: 'infanzia' },
          },
        ],
      },
    ],
  },

  {
    id: 'primaria',
    nome: 'Primaria',
    sotto: [
      {
        id: 'iscrizione-primaria',
        nome: 'Iscrizione e scelta scuola',
        descrizione: 'Iscrizione alla scuola primaria e scelte di indirizzo.',
        documenti: [
          {
            id: 'iscrizione-primaria',
            nome: 'Domanda di iscrizione – Scuola Primaria',
            descrizione: 'Modello di domanda di iscrizione per la scuola primaria.',
            tipo: 'PDF',
            profilo: { tipo: 'iscrizione', ordine: 'primaria' },
          },
        ],
      },
      {
        id: 'sostegno-primaria',
        nome: 'Sostegno e inclusione',
        descrizione: 'Documentazione per l\u2019inclusione: PEI, PDP, NAI e relazioni finali.',
        sotto: [
          {
            id: 'pei-glo-primaria',
            nome: 'PEI e Gestione GLO',
            descrizione: 'Verbali, proposte e gestione del Gruppo di Lavoro Operativo.',
            documenti: [
              {
                id: 'sostegno-primaria',
                nome: 'Richiesta di sostegno – Scuola Primaria',
                descrizione: 'Domanda di accertamento e assegnazione delle ore di sostegno per la primaria.',
                tipo: 'PDF',
                profilo: { tipo: 'sostegno', ordine: 'primaria', scopo_sostegno: 'richiesta' },
              },
              {
                id: 'verbale-glo-primaria',
                nome: 'Verbale di accoglienza / GLO – Primaria',
                descrizione: 'Modello di verbale di accoglienza e di riunione del GLO per la scuola primaria.',
                tipo: 'PDF',
                profilo: { tipo: 'verbale_glo', ordine: 'primaria', scopo_sostegno: 'pei' },
              },
              {
                id: 'verifica-intermedia-pei-primaria',
                nome: 'Scheda verifica intermedia PEI – Primaria',
                descrizione: 'Prospetto per la verifica intermedia del PEI nella scuola primaria.',
                tipo: 'PDF',
                profilo: { tipo: 'pei', ordine: 'primaria', scopo_sostegno: 'pei' },
              },
              {
                id: 'osservazioni-pei-primaria',
                nome: 'Scheda osservazioni PEI – Primaria',
                descrizione: 'Schema di osservazione per il PEI nella scuola primaria.',
                tipo: 'PDF',
                profilo: { tipo: 'pei', ordine: 'primaria', scopo_sostegno: 'pei' },
              },
              {
                id: 'pei-primaria',
                nome: 'Proposta PEI – Scuola Primaria',
                descrizione: 'Bozza di proposta PEI per la scuola primaria.',
                tipo: 'PDF',
                profilo: { tipo: 'pei', ordine: 'primaria', scopo_sostegno: 'pei' },
              },
            ],
          },
          {
            id: 'pdp-primaria',
            nome: 'PDP (DSA e BES)',
            descrizione: 'Piani Didattici Personalizzati per DSA e BES.',
            documenti: [
              {
                id: 'pdp-dsa-primaria',
                nome: 'PDP DSA (L. 170/2010) – Primaria',
                descrizione: 'Piano Didattico Personalizzato per alunni con DSA certificati.',
                tipo: 'PDF',
                profilo: { tipo: 'pdp_dsa', ordine: 'primaria', scopo_sostegno: 'pdp_dsa' },
              },
              {
                id: 'pdp-bes-primaria',
                nome: 'PDP BES – Primaria',
                descrizione: 'Piano Didattico Personalizzato per alunni con BES non certificati.',
                tipo: 'PDF',
                profilo: { tipo: 'pdp_bes', ordine: 'primaria', scopo_sostegno: 'pdp_bes' },
              },
            ],
          },
          {
            id: 'nai-primaria',
            nome: 'Inclusione NAI e Mediatori',
            descrizione: 'Piani personalizzati e progetti di alfabetizzazione per alunni stranieri.',
            documenti: [
              {
                id: 'piano-nai-primaria',
                nome: 'Piano personalizzato NAI – Primaria',
                descrizione: 'Piano di Studio Personalizzato per alunni NAI non alfabetizzati: scheda di ingresso QCER (A0-B1), laboratorio italiano L2 e progettazione per Assi/Macro-Aree.',
                tipo: 'PDF',
                profilo: { tipo: 'piano_personalizzato_nai', ordine: 'primaria' },
              },
              {
                id: 'progetto-alfabetizzazione-primaria',
                nome: 'Progetto alfabetizzazione / italiano L2 – Primaria',
                descrizione: 'Progetto di alfabetizzazione e mediazione per alunni NAI.',
                tipo: 'PDF',
                profilo: { tipo: 'progetto_alfabetizzazione', ordine: 'primaria' },
              },
            ],
          },
          {
            id: 'relazioni-finali-primaria',
            nome: 'Relazioni e Monitoraggio Finale',
            descrizione: 'Relazioni finali di inclusione e monitoraggio del percorso.',
            documenti: [
              {
                id: 'relazione-finale-inclusione-primaria',
                nome: 'Relazione finale inclusione – Primaria',
                descrizione: 'Relazione finale di verifica del percorso di inclusione (PEI/PDP): 4 Dimensioni ICF strutturate (D.I. 182/2020), esiti e proposte di transizione (art. 10 D.Lgs. 66/2017).',
                tipo: 'PDF',
                profilo: { tipo: 'relazione_finale_inclusione', ordine: 'primaria' },
              },
            ],
          },
        ],
      },
      {
        id: 'servizi-primaria',
        nome: 'Mensa, trasporto e pre/post',
        descrizione: 'Servizi scolastici complementari per la primaria.',
        documenti: [
          {
            id: 'richiesta-servizi-primaria',
            nome: 'Richiesta mensa, trasporto e pre/post scuola',
            descrizione: 'Domanda unica per i servizi scolastici della scuola primaria.',
            tipo: 'PDF',
            profilo: { tipo: 'iscrizione', ordine: 'primaria' },
          },
        ],
      },
      {
        id: 'uscite-primaria',
        nome: 'Uscite didattiche e autorizzazioni',
        descrizione: 'Autorizzazioni per uscite didattiche e attività fuori sede.',
        documenti: [
          {
            id: 'autorizzazione-uscita-primaria',
            nome: 'Autorizzazione uscita didattica – Primaria',
            descrizione: 'Modulo di autorizzazione per le uscite didattiche della scuola primaria.',
            tipo: 'PDF',
            profilo: { tipo: 'uscite_didattiche', ordine: 'primaria' },
          },
        ],
      },
      {
        id: 'valutazione-primaria',
        nome: 'Valutazione e scrutini',
        descrizione: 'Richiesta di accesso agli atti e documentazione valutativa.',
        documenti: [
          {
            id: 'accesso-atti-valutazione',
            nome: 'Richiesta accesso agli atti – valutazione',
            descrizione: 'Istanza di accesso agli atti relativi alla valutazione e agli scrutini.',
            tipo: 'PDF',
            profilo: { tipo: 'accesso_atti', ordine: 'primaria' },
          },
          {
            id: 'verbale-scrutini-primaria',
            nome: 'Verbale / Scheda di valutazione e scrutini',
            descrizione: 'Verbale di valutazione periodica e scrutinio per la scuola primaria.',
            tipo: 'PDF',
            profilo: { tipo: 'scrutini', ordine: 'primaria' },
          },
        ],
      },
      {
        id: 'documenti-famiglia-primaria',
        nome: 'Documenti per la famiglia',
        descrizione: 'Modulistica per le famiglie: autocertificazioni, deleghe, assenze e privacy.',
        sotto: [
          {
            id: 'autocert-famiglia-primaria',
            nome: 'Autocertificazioni e Stato Famiglia',
            descrizione: 'Dichiarazioni sostitutive e stato di famiglia.',
            documenti: [
              {
                id: 'dichiarazione-famiglia-primaria',
                nome: 'Dichiarazione stato di famiglia – Primaria',
                descrizione: 'Dichiarazione sostitutiva dello stato di famiglia per la scuola primaria.',
                tipo: 'PDF',
                profilo: { tipo: 'autocertificazione', ordine: 'primaria' },
              },
            ],
          },
          {
            id: 'deleghe-ritiro-primaria',
            nome: 'Deleghe e Ritiro Alunni',
            descrizione: 'Delega al ritiro da parte di terzi e uscita autonoma (L. 172/2017).',
            documenti: [
              {
                id: 'delega-ritiro-primaria',
                nome: 'Delega ritiro alunno (compagni / parenti)',
                descrizione: 'Modulo di delega al ritiro dell’alunno da parte di compagni o parenti.',
                tipo: 'PDF',
                profilo: { tipo: 'delega_famiglia', ordine: 'primaria' },
              },
              {
                id: 'uscita-autonoma-primaria',
                nome: 'Autorizzazione uscita autonoma (L. 172/2017)',
                descrizione: 'Autorizzazione all’uscita autonoma dell’alunno al termine delle lezioni.',
                tipo: 'PDF',
                profilo: { tipo: 'delega_famiglia', ordine: 'primaria' },
              },
            ],
          },
          {
            id: 'assenze-giustif-primaria',
            nome: 'Assenze e Giustificazioni',
            descrizione: 'Permessi orari, giustificazioni e istruzione parentale.',
            documenti: [
              {
                id: 'permesso-orario-primaria',
                nome: 'Richiesta permesso orario / uscita anticipata',
                descrizione: 'Modulo per entrata posticipata, uscita anticipata o assenza breve.',
                tipo: 'PDF',
                profilo: { tipo: 'permesso_orario', ordine: 'primaria' },
              },
              {
                id: 'congedo-maternita-primaria',
                nome: 'Congedo di maternità / paternità',
                descrizione: 'Richiesta di congedo obbligatorio di maternità o paternità (D.Lgs. 151/2001).',
                tipo: 'PDF',
                profilo: { tipo: 'congedo_maternita', ordine: 'primaria' },
              },
              {
                id: 'istruzione-parentale-primaria',
                nome: 'Comunicazione istruzione parentale',
                descrizione: 'Comunicazione dell’intenzione di avvalersi dell’istruzione parentale.',
                tipo: 'PDF',
                profilo: { tipo: 'istruzione_parentale', ordine: 'primaria' },
              },
            ],
          },
          {
            id: 'accesso-privacy-primaria',
            nome: 'Accesso agli Atti e Privacy',
            descrizione: 'Accesso agli atti (L. 241/1990) e consensi per immagini e dati personali.',
            documenti: [
              {
                id: 'accesso-atti-primaria',
                nome: 'Richiesta accesso agli atti (L. 241/1990)',
                descrizione: 'Istanza di accesso ai documenti amministrativi della scuola.',
                tipo: 'PDF',
                profilo: { tipo: 'accesso_atti', ordine: 'primaria' },
              },
              {
                id: 'consenso-foto-primaria',
                nome: 'Consenso foto / video',
                descrizione: 'Consenso al trattamento e alla pubblicazione di immagini e riprese video.',
                tipo: 'PDF',
                profilo: { tipo: 'consenso_foto', ordine: 'primaria' },
              },
            ],
          },
        ],
      },
      {
        id: 'valutazione-didattica-primaria',
        nome: 'Valutazione e Didattica',
        descrizione: 'Schede di valutazione, certificazione delle competenze e piani personalizzati.',
        sotto: [
          {
            id: 'schede-valutazione-primaria',
            nome: 'Schede di valutazione periodica',
            descrizione: 'Schede di valutazione periodica e finale degli apprendimenti.',
            documenti: [
              {
                id: 'scheda-valutazione-primaria',
                nome: 'Scheda di valutazione periodica – Primaria',
                descrizione: 'Scheda di valutazione periodica degli apprendimenti e del comportamento.',
                tipo: 'PDF',
                profilo: { tipo: 'scrutini', ordine: 'primaria' },
              },
            ],
          },
          {
            id: 'certificazione-competenze-primaria',
            nome: 'Certificazione delle competenze',
            descrizione: 'Certificazione delle competenze al termine della scuola primaria (D.M. 742/2017).',
            documenti: [
              {
                id: 'certificazione-competenze-primaria',
                nome: 'Certificazione delle competenze (D.M. 742/2017)',
                descrizione: 'Modello di certificazione delle competenze per la scuola primaria.',
                tipo: 'PDF',
                profilo: { tipo: 'certificazione_competenze', ordine: 'primaria' },
              },
            ],
          },
          {
            id: 'piani-personalizzati-primaria',
            nome: 'Piani di studio personalizzati',
            descrizione: 'Piani di studio personalizzati e flessibilità didattica.',
            documenti: [
              {
                id: 'piano-personalizzato-primaria',
                nome: 'Piano di studio personalizzato – Primaria',
                descrizione: 'Proposta di piano di studio personalizzato con flessibilità didattica.',
                tipo: 'PDF',
                profilo: { tipo: 'piano_personalizzato', ordine: 'primaria' },
              },
            ],
          },
        ],
      },
      {
        id: 'gite-progetti-primaria',
        nome: 'Gite e Progetti',
        descrizione: 'Consensi per uscite e viaggi, adesioni a progetti finanziati e liberatorie.',
        sotto: [
          {
            id: 'uscite-gite-primaria',
            nome: 'Uscite e viaggi di istruzione',
            descrizione: 'Consensi e autorizzazioni per uscite didattiche e viaggi di istruzione.',
            documenti: [
              {
                id: 'consenso-viaggio-primaria',
                nome: 'Consenso uscita didattica / viaggio di istruzione – Primaria',
                descrizione: 'Autorizzazione alla partecipazione a uscite didattiche e viaggi di istruzione.',
                tipo: 'PDF',
                profilo: { tipo: 'uscite_didattiche', ordine: 'primaria' },
              },
            ],
          },
          {
            id: 'progetti-fondi-primaria',
            nome: 'Progetti PON / POR / PNRR',
            descrizione: 'Adesioni ai progetti finanziati con fondi nazionali ed europei.',
            documenti: [
              {
                id: 'adesione-pon-primaria',
                nome: 'Adesione progetto PON / POR / PNRR',
                descrizione: 'Consenso alla partecipazione a progetti finanziati con fondi PON/POR/PNRR.',
                tipo: 'PDF',
                profilo: { tipo: 'progetti_fondi', ordine: 'primaria' },
              },
            ],
          },
          {
            id: 'attivita-sportive-primaria',
            nome: 'Liberatorie attività sportive',
            descrizione: 'Liberatorie per la partecipazione ad attività sportive.',
            documenti: [
              {
                id: 'liberatoria-sport-primaria',
                nome: 'Liberatoria attività sportive – Primaria',
                descrizione: 'Liberatoria per la partecipazione a tornei e attività motorie.',
                tipo: 'PDF',
                profilo: { tipo: 'liberatoria_sport', ordine: 'primaria' },
              },
            ],
          },
        ],
      },
      {
        id: 'esoneri-certificazioni',
        nome: 'Certificazioni ed esoneri',
        descrizione: 'Esoneri dall’educazione fisica e certificazioni sanitarie.',
        documenti: [
          {
            id: 'esonero-educazione-fisica',
            nome: 'Richiesta esonero educazione fisica',
            descrizione: 'Richiesta di esonero dalle attività di educazione fisica con certificato medico.',
            tipo: 'PDF',
            profilo: { tipo: 'certificazione', ordine: 'primaria' },
          },
        ],
      },
      {
        id: 'mad-primaria',
        nome: 'Messa a disposizione (MAD)',
        descrizione: 'MAD per la scuola primaria.',
        documenti: [
          {
            id: 'mad-primaria',
            nome: 'Domanda di messa a disposizione (MAD) – Primaria',
            descrizione: 'Modello aggiornato di MAD per insegnamenti nella scuola primaria.',
            tipo: 'DOCX',
            catalogoId: 'mad',
            profilo: { tipo: 'mad', ordine: 'primaria' },
          },
        ],
      },
      {
        id: 'supplenze-primaria',
        nome: 'Supplenze e interpelli',
        descrizione: 'Domande di supplenza e interpelli per la primaria.',
        documenti: [
          {
            id: 'supplenza-primaria',
            nome: 'Domanda di supplenza breve – Primaria',
            descrizione: 'Modello di domanda di supplenza breve per la scuola primaria.',
            tipo: 'DOCX',
            catalogoId: 'supplenza-breve',
            profilo: { tipo: 'supplenza', ordine: 'primaria' },
          },
        ],
      },
      {
        id: 'tempo-pieno',
        nome: 'Tempo pieno e prolungato',
        descrizione: 'Richiesta di tempo pieno, prolungato e servizi connessi.',
        sotto: [
          {
            id: 'tempo-pieno-40',
            nome: 'Tempo pieno (40 ore)',
            descrizione: 'Adesione al tempo pieno di 40 ore settimanali.',
            documenti: [
              {
                id: 'richiesta-tempo-pieno',
                nome: 'Richiesta tempo pieno 40 ore',
                descrizione: 'Domanda di adesione al tempo pieno di 40 ore settimanali.',
                tipo: 'PDF',
                profilo: { tipo: 'iscrizione', ordine: 'primaria' },
              },
            ],
          },
          {
            id: 'tempo-prolungato',
            nome: 'Tempo prolungato (36/38 ore)',
            descrizione: 'Adesione al tempo prolungato con mensa.',
            documenti: [
              {
                id: 'richiesta-tempo-prolungato',
                nome: 'Richiesta tempo prolungato',
                descrizione: 'Domanda di adesione al tempo prolungato con mensa.',
                tipo: 'PDF',
                profilo: { tipo: 'iscrizione', ordine: 'primaria' },
              },
            ],
          },
        ],
      },
      {
        id: 'segnalazioni-mediche-primaria',
        nome: 'Certificati e segnalazioni mediche',
        descrizione: 'Certificati medici, allergie e segnalazioni sanitarie.',
        documenti: [
          {
            id: 'certificato-medico-primaria',
            nome: 'Certificato medico per attività scolastica',
            descrizione: 'Modello di certificato medico per la partecipazione alle attività.',
            tipo: 'PDF',
            profilo: { tipo: 'certificazione', ordine: 'primaria' },
          },
        ],
      },
      {
        id: 'richiesta-pei-primaria',
        nome: 'Richiesta PEI e aggiornamenti',
        descrizione: 'Compilazione e aggiornamento del PEI nella scuola primaria.',
        documenti: [
          {
            id: 'richiesta-pei-primaria-doc',
            nome: 'Richiesta compilazione PEI – Primaria',
            descrizione: 'Istanza per la compilazione o la revisione del PEI nella scuola primaria.',
            tipo: 'PDF',
            profilo: { tipo: 'pei', ordine: 'primaria', scopo_sostegno: 'pei' },
          },
        ],
      },
      {
        id: 'pdp-bes-primaria',
        nome: 'PDP e BES',
        descrizione: 'Piani Didattici Personalizzati per alunni con BES.',
        documenti: [
          {
            id: 'pdp-primaria',
            nome: 'Modello PDP – Primaria',
            descrizione: 'Modello di Piano Didattico Personalizzato per la scuola primaria.',
            tipo: 'PDF',
            profilo: { tipo: 'pei', ordine: 'primaria' },
          },
        ],
      },
      {
        id: 'esoneri-primaria',
        nome: 'Esoneri attività didattiche',
        descrizione: 'Esoneri da educazione fisica e attività per motivi di salute.',
        documenti: [
          {
            id: 'esonero-primaria',
            nome: 'Richiesta esonero attività – Primaria',
            descrizione: 'Istanza di esonero con certificato medico per la scuola primaria.',
            tipo: 'PDF',
            profilo: { tipo: 'certificazione', ordine: 'primaria' },
          },
        ],
      },
      {
        id: 'ricorsi-primaria',
        nome: 'Ricorsi e reclami',
        descrizione: 'Reclami e ricorsi relativi alla scuola primaria.',
        documenti: [
          {
            id: 'ricorso-primaria',
            nome: 'Reclamo alla segreteria – Primaria',
            descrizione: 'Modello di reclamo per disservizi nella scuola primaria.',
            tipo: 'PDF',
            profilo: { tipo: 'autocertificazione', ordine: 'primaria' },
          },
        ],
      },
      {
        id: 'trasporto-disabili-primaria',
        nome: 'Trasporto alunni disabili',
        descrizione: 'Trasporto dedicato per alunni con disabilità nella primaria.',
        documenti: [
          {
            id: 'richiesta-trasporto-disabili-primaria',
            nome: 'Richiesta trasporto dedicato – Primaria',
            descrizione: 'Istanza per il trasporto scolastico dedicato di un alunno con disabilità.',
            tipo: 'PDF',
            profilo: { tipo: 'sostegno', ordine: 'primaria' },
          },
        ],
      },
      {
        id: 'assistenza-specialistica-primaria',
        nome: 'Assistenza specialistica (Comune)',
        descrizione: 'Richieste al Comune per l’assistenza specialistica nella primaria.',
        documenti: [
          {
            id: 'richiesta-assistenza-specialistica-primaria',
            nome: 'Richiesta assistenza specialistica – Primaria',
            descrizione: 'Istanza al Comune per l’assistenza specialistica nella scuola primaria.',
            tipo: 'PDF',
            profilo: { tipo: 'assistenza_comune', ordine: 'primaria', scopo_sostegno: 'autonomia', destinatario: 'comune' },
          },
        ],
      },
      {
        id: 'biblioteca-lettura',
        nome: 'Biblioteca e lettura',
        descrizione: 'Prestiti, progetti di lettura e biblioteca scolastica.',
        documenti: [
          {
            id: 'progetto-lettura-primaria',
            nome: 'Progetto biblioteca e lettura',
            descrizione: 'Scheda progettuale per iniziative di lettura nella scuola primaria.',
            tipo: 'PDF',
            profilo: { tipo: 'biblioteca', ordine: 'primaria' },
          },
        ],
      },
      {
        id: 'sport-teatro-musica',
        nome: 'Sport, teatro e musica',
        descrizione: 'Attività sportive, teatrali e musicali nella primaria.',
        documenti: [
          {
            id: 'adesione-sport-primaria',
            nome: 'Adesione attività sportiva – Primaria',
            descrizione: 'Modulo di adesione alle attività sportive scolastiche.',
            tipo: 'PDF',
            profilo: { tipo: 'extracurricolari', ordine: 'primaria' },
          },
        ],
      },
    ],
  },

  {
    id: 'secondaria1',
    nome: 'Secondaria 1° Grado',
    sotto: [
      {
        id: 'iscrizione-medie',
        nome: 'Iscrizione e scelta scuola',
        descrizione: 'Iscrizione alla scuola secondaria di I grado.',
        documenti: [
          {
            id: 'iscrizione-medie',
            nome: 'Domanda di iscrizione – Secondaria di I grado',
            descrizione: 'Modello di domanda di iscrizione per la scuola secondaria di I grado.',
            tipo: 'PDF',
            profilo: { tipo: 'iscrizione', ordine: 'secondaria1' },
          },
        ],
      },
      {
        id: 'sostegno-medie',
        nome: 'Sostegno e inclusione',
        descrizione: 'Documentazione per l\u2019inclusione: PEI, PDP, NAI e relazioni finali.',
        sotto: [
          {
            id: 'pei-glo-secondaria1',
            nome: 'PEI e Gestione GLO',
            descrizione: 'Verbali, proposte e gestione del Gruppo di Lavoro Operativo.',
            documenti: [
              {
                id: 'sostegno-medie',
                nome: 'Richiesta di sostegno – Secondaria di I grado',
                descrizione: 'Domanda di accertamento e assegnazione delle ore di sostegno per le medie.',
                tipo: 'PDF',
                profilo: { tipo: 'sostegno', ordine: 'secondaria1', scopo_sostegno: 'richiesta' },
              },
              {
                id: 'verbale-glo-secondaria1',
                nome: 'Verbale GLO / GLHO – Secondaria di I grado',
                descrizione: 'Verbale delle riunioni del GLO per la secondaria di I grado.',
                tipo: 'PDF',
                profilo: { tipo: 'verbale_glo', ordine: 'secondaria1', scopo_sostegno: 'pei' },
              },
              {
                id: 'proposta-pei-secondaria1',
                nome: 'Proposta PEI – Secondaria di I grado',
                descrizione: 'Bozza di proposta PEI per la secondaria di I grado.',
                tipo: 'PDF',
                profilo: { tipo: 'pei', ordine: 'secondaria1', scopo_sostegno: 'pei' },
              },
            ],
          },
          {
            id: 'pdp-secondaria1',
            nome: 'PDP (DSA e BES)',
            descrizione: 'Piani Didattici Personalizzati per DSA e BES.',
            documenti: [
              {
                id: 'pdp-dsa-secondaria1',
                nome: 'PDP DSA (L. 170/2010) – Secondaria di I grado',
                descrizione: 'Piano Didattico Personalizzato per alunni con DSA certificati.',
                tipo: 'PDF',
                profilo: { tipo: 'pdp_dsa', ordine: 'secondaria1', scopo_sostegno: 'pdp_dsa' },
              },
              {
                id: 'pdp-bes-secondaria1',
                nome: 'PDP BES – Secondaria di I grado',
                descrizione: 'Piano Didattico Personalizzato per alunni con BES non certificati.',
                tipo: 'PDF',
                profilo: { tipo: 'pdp_bes', ordine: 'secondaria1', scopo_sostegno: 'pdp_bes' },
              },
            ],
          },
          {
            id: 'nai-secondaria1',
            nome: 'Inclusione NAI e Mediatori',
            descrizione: 'Piani personalizzati e progetti di alfabetizzazione per alunni stranieri.',
            documenti: [
              {
                id: 'piano-nai-secondaria1',
                nome: 'Piano personalizzato NAI – Secondaria di I grado',
                descrizione: 'Piano di Studio Personalizzato per alunni NAI non alfabetizzati: scheda di ingresso QCER (A0-B1), laboratorio italiano L2 e progettazione per Assi/Macro-Aree.',
                tipo: 'PDF',
                profilo: { tipo: 'piano_personalizzato_nai', ordine: 'secondaria1' },
              },
              {
                id: 'progetto-alfabetizzazione-secondaria1',
                nome: 'Progetto alfabetizzazione / italiano L2 – Secondaria di I grado',
                descrizione: 'Progetto di alfabetizzazione e mediazione per alunni NAI.',
                tipo: 'PDF',
                profilo: { tipo: 'progetto_alfabetizzazione', ordine: 'secondaria1' },
              },
            ],
          },
          {
            id: 'relazioni-finali-secondaria1',
            nome: 'Relazioni e Monitoraggio Finale',
            descrizione: 'Relazioni finali di inclusione e monitoraggio del percorso.',
            documenti: [
              {
                id: 'relazione-finale-inclusione-secondaria1',
                nome: 'Relazione finale inclusione – Secondaria di I grado',
                descrizione: 'Relazione finale di verifica del percorso di inclusione (PEI/PDP): 4 Dimensioni ICF strutturate (D.I. 182/2020), esiti e proposte di transizione (art. 10 D.Lgs. 66/2017).',
                tipo: 'PDF',
                profilo: { tipo: 'relazione_finale_inclusione', ordine: 'secondaria1' },
              },
            ],
          },
        ],
      },
      {
        id: 'esami-medie',
        nome: 'Esame di Stato e scrutini',
        descrizione: 'Documentazione per l’esame di Stato conclusivo del primo ciclo.',
        documenti: [
          {
            id: 'domanda-esame-medie',
            nome: 'Domanda esame di Stato – I ciclo',
            descrizione: 'Domanda di ammissione e documentazione per l’esame di Stato del I ciclo.',
            tipo: 'PDF',
            profilo: { tipo: 'iscrizione', ordine: 'secondaria1' },
          },
        ],
      },
      {
        id: 'uscite-medie',
        nome: 'Uscite didattiche e autorizzazioni',
        descrizione: 'Autorizzazioni per uscite didattiche e viaggi di istruzione.',
        documenti: [
          {
            id: 'autorizzazione-uscita-medie',
            nome: 'Autorizzazione uscita didattica – Secondaria di I grado',
            descrizione: 'Modulo di autorizzazione per le uscite didattiche delle medie.',
            tipo: 'PDF',
            profilo: { tipo: 'uscite_didattiche', ordine: 'secondaria1' },
          },
        ],
      },
      {
        id: 'orientamento',
        nome: 'Orientamento scolastico',
        descrizione: 'Moduli per l’orientamento in uscita dalla secondaria di I grado.',
        documenti: [
          {
            id: 'richiesta-incontro-orientamento',
            nome: 'Richiesta colloquio di orientamento',
            descrizione: 'Modulo per richiedere un colloquio di orientamento con i docenti.',
            tipo: 'PDF',
            profilo: { tipo: 'iscrizione', ordine: 'secondaria1' },
          },
        ],
      },
      {
        id: 'mad-medie',
        nome: 'Messa a disposizione (MAD)',
        descrizione: 'MAD per la secondaria di I grado.',
        documenti: [
          {
            id: 'mad-medie',
            nome: 'Domanda di messa a disposizione (MAD) – Secondaria di I grado',
            descrizione: 'Modello aggiornato di MAD per insegnamenti nelle scuole medie.',
            tipo: 'DOCX',
            catalogoId: 'mad',
            profilo: { tipo: 'mad', ordine: 'secondaria1' },
          },
        ],
      },
      {
        id: 'supplenze-medie',
        nome: 'Supplenze e interpelli',
        descrizione: 'Domande di supplenza e interpelli per la secondaria di I grado.',
        documenti: [
          {
            id: 'supplenza-medie',
            nome: 'Domanda di supplenza breve – Secondaria di I grado',
            descrizione: 'Modello di domanda di supplenza breve per le scuole medie.',
            tipo: 'DOCX',
            catalogoId: 'supplenza-breve',
            profilo: { tipo: 'supplenza', ordine: 'secondaria1' },
          },
        ],
      },
      {
        id: 'carriera-studenti-medie',
        nome: 'Gestione Carriera e Modulistica Studenti',
        descrizione: 'Cambi di sezione e indirizzo, assemblee e agevolazioni economiche.',
        sotto: [
          {
            id: 'cambio-sezione-medie',
            nome: 'Cambio sezione / indirizzo',
            descrizione: 'Richieste di cambio di sezione, indirizzo o corso.',
            documenti: [
              {
                id: 'cambio-sezione-medie',
                nome: 'Richiesta cambio sezione / indirizzo',
                descrizione: 'Istanza di cambio di sezione, indirizzo o corso di studi.',
                tipo: 'PDF',
                profilo: { tipo: 'cambio_sezione', ordine: 'secondaria1' },
              },
            ],
          },
          {
            id: 'assemblee-studenti-medie',
            nome: 'Assemblee di classe / istituto',
            descrizione: 'Istanza di convocazione di assemblee studentesche.',
            documenti: [
              {
                id: 'istanza-assemblea-medie',
                nome: 'Istanza assemblea di classe / istituto',
                descrizione: 'Richiesta di convocazione di un\u2019assemblea di classe o d\u2019Istituto.',
                tipo: 'PDF',
                profilo: { tipo: 'assemblea_studenti', ordine: 'secondaria1' },
              },
            ],
          },
          {
            id: 'esonero-tasse-medie',
            nome: 'Esonero tasse e contributi',
            descrizione: 'Esoneri e riduzioni di tasse scolastiche e contributi.',
            documenti: [
              {
                id: 'esonero-tasse-medie',
                nome: 'Richiesta esonero tasse scolastiche / contributi',
                descrizione: 'Istanza di esonero o riduzione delle tasse scolastiche e dei contributi.',
                tipo: 'PDF',
                profilo: { tipo: 'esonero_tasse', ordine: 'secondaria1' },
              },
            ],
          },
        ],
      },
      {
        id: 'esami-certificazioni-medie',
        nome: 'Esami e Certificazioni',
        descrizione: 'Ammissione agli esami, crediti e certificati sostitutivi.',
        sotto: [
          {
            id: 'ammissione-esami-medie',
            nome: 'Ammissione agli esami',
            descrizione: 'Domande di ammissione agli esami di Stato.',
            documenti: [
              {
                id: 'ammissione-esami-medie',
                nome: 'Domanda ammissione esami di Stato – I ciclo',
                descrizione: 'Domanda di ammissione all\u2019esame di Stato conclusivo del primo ciclo.',
                tipo: 'PDF',
                profilo: { tipo: 'ammissione_esami', ordine: 'secondaria1' },
              },
            ],
          },
          {
            id: 'crediti-medie',
            nome: 'Crediti scolastici / formativi',
            descrizione: 'Riconoscimento di crediti scolastici e formativi.',
            documenti: [
              {
                id: 'crediti-medie',
                nome: 'Richiesta riconoscimento crediti scolastici / formativi',
                descrizione: 'Istanza di riconoscimento di crediti formativi e scolastici.',
                tipo: 'PDF',
                profilo: { tipo: 'crediti_scolastici', ordine: 'secondaria1' },
              },
            ],
          },
          {
            id: 'certificati-medie',
            nome: 'Certificati sostitutivi',
            descrizione: 'Certificati di diploma e copie conformi.',
            documenti: [
              {
                id: 'certificato-diploma-medie',
                nome: 'Richiesta certificato sostitutivo diploma',
                descrizione: 'Istanza di rilascio di certificato o copia conforme del diploma.',
                tipo: 'PDF',
                profilo: { tipo: 'certificato_diploma', ordine: 'secondaria1' },
              },
            ],
          },
        ],
      },
      {
        id: 'documenti-famiglia-medie',
        nome: 'Documenti per la famiglia',
        descrizione: 'Modulistica per le famiglie: autocertificazioni, deleghe, assenze e privacy.',
        sotto: [
          {
            id: 'autocert-famiglia-secondaria1',
            nome: 'Autocertificazioni e Stato Famiglia',
            descrizione: 'Dichiarazioni sostitutive e stato di famiglia.',
            documenti: [
              {
                id: 'dichiarazione-famiglia-medie',
                nome: 'Dichiarazione stato di famiglia – Secondaria di I grado',
                descrizione: 'Dichiarazione sostitutiva dello stato di famiglia per la scuola secondaria di I grado.',
                tipo: 'PDF',
                profilo: { tipo: 'autocertificazione', ordine: 'secondaria1' },
              },
            ],
          },
          {
            id: 'deleghe-ritiro-secondaria1',
            nome: 'Deleghe e Ritiro Alunni',
            descrizione: 'Delega al ritiro da parte di terzi e uscita autonoma (L. 172/2017).',
            documenti: [
              {
                id: 'delega-ritiro-medie',
                nome: 'Delega ritiro alunno (compagni / parenti)',
                descrizione: 'Modulo di delega al ritiro dell’alunno da parte di compagni o parenti.',
                tipo: 'PDF',
                profilo: { tipo: 'delega_famiglia', ordine: 'secondaria1' },
              },
              {
                id: 'uscita-autonoma-medie',
                nome: 'Autorizzazione uscita autonoma (L. 172/2017)',
                descrizione: 'Autorizzazione all’uscita autonoma dell’alunno al termine delle lezioni.',
                tipo: 'PDF',
                profilo: { tipo: 'delega_famiglia', ordine: 'secondaria1' },
              },
            ],
          },
          {
            id: 'assenze-giustif-secondaria1',
            nome: 'Assenze e Giustificazioni',
            descrizione: 'Permessi orari, giustificazioni, esoneri e istruzione parentale.',
            documenti: [
              {
                id: 'permesso-orario-medie',
                nome: 'Richiesta permesso orario / uscita anticipata',
                descrizione: 'Modulo per entrata posticipata, uscita anticipata o assenza breve.',
                tipo: 'PDF',
                profilo: { tipo: 'permesso_orario', ordine: 'secondaria1' },
              },
              {
                id: 'congedo-maternita-medie',
                nome: 'Congedo di maternità / paternità',
                descrizione: 'Richiesta di congedo obbligatorio di maternità o paternità (D.Lgs. 151/2001).',
                tipo: 'PDF',
                profilo: { tipo: 'congedo_maternita', ordine: 'secondaria1' },
              },
              {
                id: 'esonero-scienze-motorie-medie',
                nome: 'Richiesta esonero scienze motorie',
                descrizione: 'Richiesta di esonero dalle attività di scienze motorie con certificato medico.',
                tipo: 'PDF',
                profilo: { tipo: 'esonero_motoria', ordine: 'secondaria1' },
              },
              {
                id: 'istruzione-parentale-medie',
                nome: 'Comunicazione istruzione parentale',
                descrizione: 'Comunicazione dell’intenzione di avvalersi dell’istruzione parentale.',
                tipo: 'PDF',
                profilo: { tipo: 'istruzione_parentale', ordine: 'secondaria1' },
              },
            ],
          },
          {
            id: 'accesso-privacy-secondaria1',
            nome: 'Accesso agli Atti e Privacy',
            descrizione: 'Accesso agli atti (L. 241/1990) e consensi per immagini e dati personali.',
            documenti: [
              {
                id: 'accesso-atti-medie',
                nome: 'Richiesta accesso agli atti (L. 241/1990)',
                descrizione: 'Istanza di accesso ai documenti amministrativi della scuola.',
                tipo: 'PDF',
                profilo: { tipo: 'accesso_atti', ordine: 'secondaria1' },
              },
              {
                id: 'consenso-foto-medie',
                nome: 'Consenso foto / video',
                descrizione: 'Consenso al trattamento e alla pubblicazione di immagini e riprese video.',
                tipo: 'PDF',
                profilo: { tipo: 'consenso_foto', ordine: 'secondaria1' },
              },
            ],
          },
        ],
      },
      {
        id: 'viaggi-istruzione',
        nome: 'Viaggi di istruzione',
        descrizione: 'Autorizzazioni e documentazione per viaggi di istruzione.',
        sotto: [
          {
            id: 'viaggi-nazionali',
            nome: 'Viaggi nazionali',
            descrizione: 'Autorizzazioni per viaggi in Italia.',
            documenti: [
              {
                id: 'autorizzazione-viaggio-nazionale',
                nome: 'Autorizzazione viaggio di istruzione nazionale',
                descrizione: 'Modulo di autorizzazione per viaggi di istruzione in Italia.',
                tipo: 'PDF',
                profilo: { tipo: 'uscite_didattiche', ordine: 'secondaria1' },
              },
            ],
          },
          {
            id: 'viaggi-estero',
            nome: 'Viaggi all’estero',
            descrizione: 'Autorizzazioni con dati del documento di identità.',
            documenti: [
              {
                id: 'autorizzazione-viaggio-estero',
                nome: 'Autorizzazione viaggio di istruzione all’estero',
                descrizione: 'Modulo di autorizzazione con dati del documento di identità.',
                tipo: 'PDF',
                profilo: { tipo: 'uscite_didattiche', ordine: 'secondaria1' },
              },
            ],
          },
        ],
      },
      {
        id: 'pdp-bes-secondaria1',
        nome: 'PDP e BES',
        descrizione: 'Piani Didattici Personalizzati per alunni con BES.',
        documenti: [
          {
            id: 'pdp-secondaria1',
            nome: 'Modello PDP – Secondaria di I Grado',
            descrizione: 'Modello di Piano Didattico Personalizzato per la secondaria di I grado.',
            tipo: 'PDF',
            profilo: { tipo: 'pdp_bes', ordine: 'secondaria1' },
          },
        ],
      },
      {
        id: 'segnalazioni-asl-secondaria1',
        nome: 'Segnalazioni ASL',
        descrizione: 'Segnalazioni ai servizi sanitari e richieste di valutazione.',
        documenti: [
          {
            id: 'segnalazione-asl-secondaria1',
            nome: 'Segnalazione ASL – Secondaria di I Grado',
            descrizione: 'Segnalazione ai servizi sanitari per la valutazione di un alunno.',
            tipo: 'PDF',
            profilo: { tipo: 'certificazione', ordine: 'secondaria1' },
          },
        ],
      },
      {
        id: 'esoneri-secondaria1',
        nome: 'Esoneri e deroghe',
        descrizione: 'Esoneri da attività didattiche e deroghe per motivi di salute.',
        documenti: [
          {
            id: 'esonero-secondaria1',
            nome: 'Richiesta esonero – Secondaria di I Grado',
            descrizione: 'Istanza di esonero con certificato medico.',
            tipo: 'PDF',
            profilo: { tipo: 'certificazione', ordine: 'secondaria1' },
          },
        ],
      },
      {
        id: 'ricorsi-secondaria1',
        nome: 'Ricorsi e reclami',
        descrizione: 'Reclami e ricorsi relativi alla secondaria di I grado.',
        documenti: [
          {
            id: 'ricorso-secondaria1',
            nome: 'Reclamo alla segreteria – Secondaria di I Grado',
            descrizione: 'Modello di reclamo per disservizi nella secondaria di I grado.',
            tipo: 'PDF',
            profilo: { tipo: 'autocertificazione', ordine: 'secondaria1' },
          },
        ],
      },
      {
        id: 'trasporto-disabili-secondaria1',
        nome: 'Trasporto alunni disabili',
        descrizione: 'Trasporto dedicato per alunni con disabilità.',
        documenti: [
          {
            id: 'richiesta-trasporto-disabili-secondaria1',
            nome: 'Richiesta trasporto dedicato – Secondaria di I Grado',
            descrizione: 'Istanza per il trasporto scolastico dedicato di un alunno con disabilità.',
            tipo: 'PDF',
            profilo: { tipo: 'sostegno', ordine: 'secondaria1' },
          },
        ],
      },
      {
        id: 'sportello-psicologico',
        nome: 'Sportello psicologico e ascolto',
        descrizione: 'Richiesta di colloqui con lo sportello di ascolto.',
        documenti: [
          {
            id: 'richiesta-colloquio-sportello',
            nome: 'Richiesta colloquio sportello psicologico',
            descrizione: 'Istanza per un colloquio con lo sportello di ascolto scolastico.',
            tipo: 'PDF',
            profilo: { tipo: 'iscrizione', ordine: 'secondaria1' },
          },
        ],
      },
      {
        id: 'assemblee-rappresentanze',
        nome: 'Assemblee e rappresentanze',
        descrizione: 'Assemblee di classe, rappresentanti e organi collegiali.',
        documenti: [
          {
            id: 'candidatura-rappresentante',
            nome: 'Candidatura rappresentante di classe',
            descrizione: 'Modulo di candidatura a rappresentante dei genitori.',
            tipo: 'PDF',
            profilo: { tipo: 'autocertificazione', ordine: 'secondaria1' },
          },
        ],
      },
    ],
  },

  {
    id: 'secondaria2',
    nome: 'Secondaria 2° Grado',
    sotto: [
      {
        id: 'iscrizione-superiori',
        nome: 'Iscrizione e scelta scuola',
        descrizione: 'Iscrizione alla scuola secondaria di II grado.',
        documenti: [
          {
            id: 'iscrizione-superiori',
            nome: 'Domanda di iscrizione – Secondaria di II grado',
            descrizione: 'Modello di domanda di iscrizione per la scuola secondaria di II grado.',
            tipo: 'PDF',
            profilo: { tipo: 'iscrizione', ordine: 'secondaria2' },
          },
        ],
      },
      {
        id: 'sostegno-superiori',
        nome: 'Sostegno e inclusione',
        descrizione: 'Documentazione per l\u2019inclusione: PEI, PDP, NAI e relazioni finali.',
        sotto: [
          {
            id: 'pei-glo-secondaria2',
            nome: 'PEI e Gestione GLO',
            descrizione: 'Verbali, proposte e gestione del Gruppo di Lavoro Operativo.',
            documenti: [
              {
                id: 'sostegno-superiori',
                nome: 'Richiesta di sostegno – Secondaria di II grado',
                descrizione: 'Domanda di accertamento e assegnazione delle ore di sostegno per le superiori.',
                tipo: 'PDF',
                profilo: { tipo: 'sostegno', ordine: 'secondaria2', scopo_sostegno: 'richiesta' },
              },
              {
                id: 'verbale-glo-secondaria2',
                nome: 'Verbale GLO / GLHO – Secondaria di II grado',
                descrizione: 'Verbale delle riunioni del GLO per la secondaria di II grado.',
                tipo: 'PDF',
                profilo: { tipo: 'verbale_glo', ordine: 'secondaria2', scopo_sostegno: 'pei' },
              },
              {
                id: 'proposta-pei-secondaria2',
                nome: 'Proposta PEI – Secondaria di II grado',
                descrizione: 'Bozza di proposta PEI per la secondaria di II grado.',
                tipo: 'PDF',
                profilo: { tipo: 'pei', ordine: 'secondaria2', scopo_sostegno: 'pei' },
              },
            ],
          },
          {
            id: 'pdp-secondaria2',
            nome: 'PDP (DSA e BES)',
            descrizione: 'Piani Didattici Personalizzati per DSA e BES.',
            documenti: [
              {
                id: 'pdp-dsa-secondaria2',
                nome: 'PDP DSA (L. 170/2010) – Secondaria di II grado',
                descrizione: 'Piano Didattico Personalizzato per alunni con DSA certificati.',
                tipo: 'PDF',
                profilo: { tipo: 'pdp_dsa', ordine: 'secondaria2', scopo_sostegno: 'pdp_dsa' },
              },
              {
                id: 'pdp-bes-secondaria2',
                nome: 'PDP BES – Secondaria di II grado',
                descrizione: 'Piano Didattico Personalizzato per alunni con BES non certificati.',
                tipo: 'PDF',
                profilo: { tipo: 'pdp_bes', ordine: 'secondaria2', scopo_sostegno: 'pdp_bes' },
              },
            ],
          },
          {
            id: 'nai-secondaria2',
            nome: 'Inclusione NAI e Mediatori',
            descrizione: 'Piani personalizzati e progetti di alfabetizzazione per alunni stranieri.',
            documenti: [
              {
                id: 'piano-nai-secondaria2',
                nome: 'Piano personalizzato NAI – Secondaria di II grado',
                descrizione: 'Piano di Studio Personalizzato per alunni NAI non alfabetizzati: scheda di ingresso QCER (A0-B1), laboratorio italiano L2 e progettazione per Assi/Macro-Aree.',
                tipo: 'PDF',
                profilo: { tipo: 'piano_personalizzato_nai', ordine: 'secondaria2' },
              },
              {
                id: 'progetto-alfabetizzazione-secondaria2',
                nome: 'Progetto alfabetizzazione / italiano L2 – Secondaria di II grado',
                descrizione: 'Progetto di alfabetizzazione e mediazione per alunni NAI.',
                tipo: 'PDF',
                profilo: { tipo: 'progetto_alfabetizzazione', ordine: 'secondaria2' },
              },
            ],
          },
          {
            id: 'relazioni-finali-secondaria2',
            nome: 'Relazioni e Monitoraggio Finale',
            descrizione: 'Relazioni finali di inclusione e monitoraggio del percorso.',
            documenti: [
              {
                id: 'relazione-finale-inclusione-secondaria2',
                nome: 'Relazione finale inclusione – Secondaria di II grado',
                descrizione: 'Relazione finale di verifica del percorso di inclusione (PEI/PDP): 4 Dimensioni ICF strutturate (D.I. 182/2020), esiti e proposte di transizione (art. 10 D.Lgs. 66/2017).',
                tipo: 'PDF',
                profilo: { tipo: 'relazione_finale_inclusione', ordine: 'secondaria2' },
              },
            ],
          },
        ],
      },
      {
        id: 'pcto',
        nome: 'PCTO e uscite didattiche',
        descrizione: 'Convenzioni PCTO, autorizzazioni uscite e viaggi di istruzione.',
        documenti: [
          {
            id: 'autorizzazione-pcto',
            nome: 'Autorizzazione uscita didattica / PCTO – Secondaria di II grado',
            descrizione: 'Modulo di autorizzazione per uscite e attività PCTO delle superiori.',
            tipo: 'PDF',
            profilo: { tipo: 'uscite_didattiche', ordine: 'secondaria2' },
          },
        ],
      },
      {
        id: 'esami-superiori',
        nome: 'Esame di Stato',
        descrizione: 'Documentazione per l’esame di Stato del secondo ciclo.',
        documenti: [
          {
            id: 'domanda-esame-superiori',
            nome: 'Domanda esame di Stato – II ciclo',
            descrizione: 'Domanda di ammissione e documentazione per l’esame di Stato del II ciclo.',
            tipo: 'PDF',
            profilo: { tipo: 'iscrizione', ordine: 'secondaria2' },
          },
        ],
      },
      {
        id: 'mad-superiori',
        nome: 'Messa a disposizione (MAD)',
        descrizione: 'MAD per la secondaria di II grado.',
        documenti: [
          {
            id: 'mad-superiori',
            nome: 'Domanda di messa a disposizione (MAD) – Secondaria di II grado',
            descrizione: 'Modello aggiornato di MAD per insegnamenti nelle scuole superiori.',
            tipo: 'DOCX',
            catalogoId: 'mad',
            profilo: { tipo: 'mad', ordine: 'secondaria2' },
          },
        ],
      },
      {
        id: 'supplenze-superiori',
        nome: 'Supplenze e interpelli',
        descrizione: 'Domande di supplenza e interpelli per la secondaria di II grado.',
        documenti: [
          {
            id: 'supplenza-superiori',
            nome: 'Domanda di supplenza breve – Secondaria di II grado',
            descrizione: 'Modello di domanda di supplenza breve per le scuole superiori.',
            tipo: 'DOCX',
            catalogoId: 'supplenza-breve',
            profilo: { tipo: 'supplenza', ordine: 'secondaria2' },
          },
        ],
      },
      {
        id: 'candidature',
        nome: 'Candidature',
        descrizione: 'Lettere e documenti per candidarsi presso le istituzioni scolastiche.',
        documenti: [
          {
            id: 'lettera-presentazione',
            nome: 'Lettera di presentazione',
            descrizione: 'Template professionale per presentare la tua candidatura alle istituzioni scolastiche.',
            tipo: 'DOCX',
            catalogoId: 'lettera-presentazione',
            profilo: { tipo: 'lettera', ordine: 'secondaria2' },
          },
        ],
      },
      {
        id: 'certificazioni-crediti',
        nome: 'Certificazioni e crediti',
        descrizione: 'Certificazioni delle competenze e riconoscimento crediti.',
        documenti: [
          {
            id: 'richiesta-crediti',
            nome: 'Richiesta riconoscimento crediti formativi',
            descrizione: 'Istanza di riconoscimento dei crediti formativi per le superiori.',
            tipo: 'PDF',
            profilo: { tipo: 'crediti_formativi', ordine: 'secondaria2' },
          },
        ],
      },
      {
        id: 'carriera-studenti-superiori',
        nome: 'Gestione Carriera e Modulistica Studenti',
        descrizione: 'Cambi di sezione e indirizzo, assemblee e agevolazioni economiche.',
        sotto: [
          {
            id: 'cambio-sezione-superiori',
            nome: 'Cambio sezione / indirizzo',
            descrizione: 'Richieste di cambio di sezione, indirizzo o corso.',
            documenti: [
              {
                id: 'cambio-sezione-superiori',
                nome: 'Richiesta cambio sezione / indirizzo',
                descrizione: 'Istanza di cambio di sezione, indirizzo o corso di studi.',
                tipo: 'PDF',
                profilo: { tipo: 'cambio_sezione', ordine: 'secondaria2' },
              },
            ],
          },
          {
            id: 'assemblee-studenti-superiori',
            nome: 'Assemblee di classe / istituto',
            descrizione: 'Istanza di convocazione di assemblee studentesche.',
            documenti: [
              {
                id: 'istanza-assemblea-superiori',
                nome: 'Istanza assemblea di classe / istituto',
                descrizione: 'Richiesta di convocazione di un\u2019assemblea di classe o d\u2019Istituto.',
                tipo: 'PDF',
                profilo: { tipo: 'assemblea_studenti', ordine: 'secondaria2' },
              },
            ],
          },
          {
            id: 'esonero-tasse-superiori',
            nome: 'Esonero tasse e contributi',
            descrizione: 'Esoneri e riduzioni di tasse scolastiche e contributi.',
            documenti: [
              {
                id: 'esonero-tasse-superiori',
                nome: 'Richiesta esonero tasse scolastiche / contributi',
                descrizione: 'Istanza di esonero o riduzione delle tasse scolastiche e dei contributi.',
                tipo: 'PDF',
                profilo: { tipo: 'esonero_tasse', ordine: 'secondaria2' },
              },
            ],
          },
        ],
      },
      {
        id: 'esami-certificazioni-superiori',
        nome: 'Esami e Certificazioni',
        descrizione: 'Ammissione agli esami, crediti e certificati sostitutivi.',
        sotto: [
          {
            id: 'ammissione-esami-superiori',
            nome: 'Ammissione agli esami',
            descrizione: 'Domande di ammissione agli esami di Stato.',
            documenti: [
              {
                id: 'ammissione-esami-superiori',
                nome: 'Domanda ammissione esami di Stato – II ciclo',
                descrizione: 'Domanda di ammissione all\u2019esame di Stato conclusivo del secondo ciclo.',
                tipo: 'PDF',
                profilo: { tipo: 'ammissione_esami', ordine: 'secondaria2' },
              },
            ],
          },
          {
            id: 'crediti-superiori',
            nome: 'Crediti scolastici / formativi',
            descrizione: 'Riconoscimento di crediti scolastici e formativi.',
            documenti: [
              {
                id: 'crediti-superiori',
                nome: 'Richiesta riconoscimento crediti scolastici / formativi',
                descrizione: 'Istanza di riconoscimento di crediti formativi e scolastici.',
                tipo: 'PDF',
                profilo: { tipo: 'crediti_scolastici', ordine: 'secondaria2' },
              },
            ],
          },
          {
            id: 'certificati-superiori',
            nome: 'Certificati sostitutivi',
            descrizione: 'Certificati di diploma e copie conformi.',
            documenti: [
              {
                id: 'certificato-diploma-superiori',
                nome: 'Richiesta certificato sostitutivo diploma',
                descrizione: 'Istanza di rilascio di certificato o copia conforme del diploma.',
                tipo: 'PDF',
                profilo: { tipo: 'certificato_diploma', ordine: 'secondaria2' },
              },
            ],
          },
        ],
      },
      {
        id: 'documenti-famiglia-superiori',
        nome: 'Documenti per la famiglia',
        descrizione: 'Modulistica per le famiglie: autocertificazioni, deleghe, assenze e privacy.',
        sotto: [
          {
            id: 'autocert-famiglia-secondaria2',
            nome: 'Autocertificazioni e Stato Famiglia',
            descrizione: 'Dichiarazioni sostitutive e stato di famiglia.',
            documenti: [
              {
                id: 'dichiarazione-famiglia-superiori',
                nome: 'Dichiarazione stato di famiglia – Secondaria di II grado',
                descrizione: 'Dichiarazione sostitutiva dello stato di famiglia per la scuola secondaria di II grado.',
                tipo: 'PDF',
                profilo: { tipo: 'autocertificazione', ordine: 'secondaria2' },
              },
            ],
          },
          {
            id: 'deleghe-ritiro-secondaria2',
            nome: 'Deleghe e Ritiro Alunni',
            descrizione: 'Delega al ritiro da parte di terzi e uscita autonoma (L. 172/2017).',
            documenti: [
              {
                id: 'delega-ritiro-superiori',
                nome: 'Delega ritiro alunno (compagni / parenti)',
                descrizione: 'Modulo di delega al ritiro dell’alunno da parte di compagni o parenti.',
                tipo: 'PDF',
                profilo: { tipo: 'delega_famiglia', ordine: 'secondaria2' },
              },
              {
                id: 'uscita-autonoma-superiori',
                nome: 'Autorizzazione uscita autonoma (L. 172/2017)',
                descrizione: 'Autorizzazione all’uscita autonoma dell’alunno al termine delle lezioni.',
                tipo: 'PDF',
                profilo: { tipo: 'delega_famiglia', ordine: 'secondaria2' },
              },
            ],
          },
          {
            id: 'assenze-giustif-secondaria2',
            nome: 'Assenze e Giustificazioni',
            descrizione: 'Permessi orari, giustificazioni, esoneri e istruzione parentale.',
            documenti: [
              {
                id: 'permesso-orario-superiori',
                nome: 'Richiesta permesso orario / uscita anticipata',
                descrizione: 'Modulo per entrata posticipata, uscita anticipata o assenza breve.',
                tipo: 'PDF',
                profilo: { tipo: 'permesso_orario', ordine: 'secondaria2' },
              },
              {
                id: 'congedo-maternita-superiori',
                nome: 'Congedo di maternità / paternità',
                descrizione: 'Richiesta di congedo obbligatorio di maternità o paternità (D.Lgs. 151/2001).',
                tipo: 'PDF',
                profilo: { tipo: 'congedo_maternita', ordine: 'secondaria2' },
              },
              {
                id: 'esonero-scienze-motorie-superiori',
                nome: 'Richiesta esonero scienze motorie',
                descrizione: 'Richiesta di esonero dalle attività di scienze motorie con certificato medico.',
                tipo: 'PDF',
                profilo: { tipo: 'esonero_motoria', ordine: 'secondaria2' },
              },
              {
                id: 'istruzione-parentale-superiori',
                nome: 'Comunicazione istruzione parentale',
                descrizione: 'Comunicazione dell’intenzione di avvalersi dell’istruzione parentale.',
                tipo: 'PDF',
                profilo: { tipo: 'istruzione_parentale', ordine: 'secondaria2' },
              },
            ],
          },
          {
            id: 'accesso-privacy-secondaria2',
            nome: 'Accesso agli Atti e Privacy',
            descrizione: 'Accesso agli atti (L. 241/1990) e consensi per immagini e dati personali.',
            documenti: [
              {
                id: 'accesso-atti-superiori',
                nome: 'Richiesta accesso agli atti (L. 241/1990)',
                descrizione: 'Istanza di accesso ai documenti amministrativi della scuola.',
                tipo: 'PDF',
                profilo: { tipo: 'accesso_atti', ordine: 'secondaria2' },
              },
              {
                id: 'consenso-foto-superiori',
                nome: 'Consenso foto / video',
                descrizione: 'Consenso al trattamento e alla pubblicazione di immagini e riprese video.',
                tipo: 'PDF',
                profilo: { tipo: 'consenso_foto', ordine: 'secondaria2' },
              },
            ],
          },
        ],
      },
      {
        id: 'pcto-stage',
        nome: 'PCTO e stage',
        descrizione: 'Convenzioni, autorizzazioni e valutazione dei percorsi PCTO.',
        sotto: [
          {
            id: 'convenzioni-pcto',
            nome: 'Convenzioni con le aziende',
            descrizione: 'Istanze di convenzione per i percorsi PCTO.',
            documenti: [
              {
                id: 'richiesta-convenzione-pcto',
                nome: 'Richiesta convenzione PCTO con azienda',
                descrizione: 'Istanza per la stipula della convenzione PCTO con un’azienda.',
                tipo: 'PDF',
                profilo: { tipo: 'iscrizione', ordine: 'secondaria2' },
              },
            ],
          },
          {
            id: 'valutazione-pcto',
            nome: 'Valutazione e certificazione',
            descrizione: 'Certificazione delle competenze acquisite nel PCTO.',
            documenti: [
              {
                id: 'certificato-competenze-pcto',
                nome: 'Certificazione delle competenze PCTO',
                descrizione: 'Modello per la certificazione delle competenze acquisite nel PCTO.',
                tipo: 'PDF',
                profilo: { tipo: 'autocertificazione', ordine: 'secondaria2' },
              },
            ],
          },
        ],
      },
      {
        id: 'pdp-bes-secondaria2',
        nome: 'PDP e BES',
        descrizione: 'Piani Didattici Personalizzati per alunni con BES.',
        documenti: [
          {
            id: 'pdp-secondaria2',
            nome: 'Modello PDP – Secondaria di II Grado',
            descrizione: 'Modello di Piano Didattico Personalizzato per la secondaria di II grado.',
            tipo: 'PDF',
            profilo: { tipo: 'pdp_bes', ordine: 'secondaria2' },
          },
        ],
      },
      {
        id: 'ricorsi-secondaria2',
        nome: 'Ricorsi e reclami',
        descrizione: 'Reclami e ricorsi relativi alla secondaria di II grado.',
        documenti: [
          {
            id: 'ricorso-secondaria2',
            nome: 'Reclamo alla segreteria – Secondaria di II Grado',
            descrizione: 'Modello di reclamo per disservizi nella secondaria di II grado.',
            tipo: 'PDF',
            profilo: { tipo: 'ricorso_reclamo', ordine: 'secondaria2' },
          },
        ],
      },
      {
        id: 'esoneri-secondaria2',
        nome: 'Esoneri e deroghe',
        descrizione: 'Esoneri da attività didattiche e deroghe per motivi di salute.',
        documenti: [
          {
            id: 'esonero-secondaria2',
            nome: 'Richiesta esonero – Secondaria di II Grado',
            descrizione: 'Istanza di esonero con certificato medico.',
            tipo: 'PDF',
            profilo: { tipo: 'certificazione', ordine: 'secondaria2' },
          },
        ],
      },
      {
        id: 'orientamento-universitario',
        nome: 'Orientamento in uscita',
        descrizione: 'Orientamento universitario, saloni e test di ingresso.',
        documenti: [
          {
            id: 'richiesta-orientamento-universitario',
            nome: 'Richiesta incontro orientamento universitario',
            descrizione: 'Modulo per richiedere un incontro di orientamento universitario.',
            tipo: 'PDF',
            profilo: { tipo: 'iscrizione', ordine: 'secondaria2' },
          },
        ],
      },
      {
        id: 'sportello-psicologico-secondaria2',
        nome: 'Sportello psicologico e ascolto',
        descrizione: 'Richiesta di colloqui con lo sportello di ascolto.',
        documenti: [
          {
            id: 'richiesta-colloquio-sportello-secondaria2',
            nome: 'Richiesta colloquio sportello psicologico',
            descrizione: 'Istanza per un colloquio con lo sportello di ascolto scolastico.',
            tipo: 'PDF',
            profilo: { tipo: 'iscrizione', ordine: 'secondaria2' },
          },
        ],
      },
      {
        id: 'assemblee-studenti',
        nome: 'Assemblee studentesche',
        descrizione: 'Convocazioni, assemblee e rappresentanze studentesche.',
        documenti: [
          {
            id: 'convocazione-assemblea-studenti',
            nome: 'Convocazione assemblea studentesca',
            descrizione: 'Modello di convocazione dell’assemblea studentesca.',
            tipo: 'PDF',
            profilo: { tipo: 'autocertificazione', ordine: 'secondaria2' },
          },
        ],
      },
      {
        id: 'scambi-estero',
        nome: 'Scambi e progetti all’estero',
        descrizione: 'Scambi scolastici, soggiorni linguistici e progetti europei.',
        documenti: [
          {
            id: 'adesione-scambio-estero',
            nome: 'Adesione scambio scolastico all’estero',
            descrizione: 'Modulo di adesione a uno scambio o soggiorno linguistico.',
            tipo: 'PDF',
            profilo: { tipo: 'iscrizione', ordine: 'secondaria2' },
          },
        ],
      },
    ],
  },

  {
    id: 'universita',
    nome: 'Università',
    sotto: [
      {
        id: 'immatricolazione',
        nome: 'Immatricolazione',
        descrizione: 'Domande di immatricolazione e documentazione per l’accesso.',
        documenti: [
          {
            id: 'immatricolazione',
            nome: 'Domanda di immatricolazione',
            descrizione: 'Modello di domanda di immatricolazione ai corsi di laurea.',
            tipo: 'PDF',
            profilo: { tipo: 'iscrizione', ordine: 'universita' },
          },
          {
            id: 'iscrizione-corsi-singoli',
            nome: 'Iscrizione a corsi singoli / secondo titolo',
            descrizione: 'Domanda di iscrizione a corsi singoli o per il conseguimento di un secondo titolo.',
            tipo: 'PDF',
            profilo: { tipo: 'iscrizione', ordine: 'universita' },
          },
          {
            id: 'iscrizione-part-time',
            nome: 'Richiesta iscrizione a tempo parziale',
            descrizione: 'Istanza di iscrizione a tempo parziale (part-time) al corso di laurea.',
            tipo: 'PDF',
            profilo: { tipo: 'iscrizione', ordine: 'universita' },
          },
        ],
      },
      {
        id: 'corsi-piani',
        nome: 'Corsi e piani di studio',
        descrizione: 'Piani di studio e richieste di modifica.',
        documenti: [
          {
            id: 'richiesta-piano-studi',
            nome: 'Richiesta compilazione piano di studi',
            descrizione: 'Istanza per la compilazione o la modifica del piano di studi.',
            tipo: 'PDF',
            profilo: { tipo: 'iscrizione', ordine: 'universita' },
          },
          {
            id: 'approvazione-piano-studi',
            nome: 'Richiesta approvazione piano di studi',
            descrizione: 'Istanza di approvazione del piano di studi da parte del consiglio di corso.',
            tipo: 'PDF',
            profilo: { tipo: 'iscrizione', ordine: 'universita' },
          },
        ],
      },
      {
        id: 'borse-aiuti',
        nome: 'Borse di studio e aiuti',
        descrizione: 'Borse di studio, agevolazioni ISEE, sussidi e collaborazioni studentesche.',
        sotto: [
          {
            id: 'borse-regionali',
            nome: 'Borse di Studio EDISU / ALISEO / DSU',
            descrizione: 'Domande e ricorsi per le borse di studio regionali per il diritto allo studio.',
            documenti: [
              {
                id: 'richiesta-borsa-studio',
                nome: 'Domanda borsa di studio regionale',
                descrizione: 'Domanda di borsa di studio EDISU / ALISEO / DSU con dichiarazione ISEE.',
                tipo: 'PDF',
                profilo: { tipo: 'borsa_studio', ordine: 'universita' },
              },
              {
                id: 'ricorso-graduatoria-borse',
                nome: 'Richiesta riesame / ricorso graduatoria provvisoria',
                descrizione: 'Istanza di riesame o ricorso avverso la graduatoria delle borse di studio.',
                tipo: 'PDF',
                profilo: { tipo: 'ricorso_borsa', ordine: 'universita' },
              },
            ],
          },
          {
            id: 'agevolazioni-isee',
            nome: 'Agevolazioni e Riduzioni ISEE',
            descrizione: 'Dichiarazione ISEE e richieste di ricalcolo o riduzione dei contributi.',
            documenti: [
              {
                id: 'dichiarazione-isee-universita',
                nome: 'Dichiarazione ISEE Università',
                descrizione: 'Dichiarazione del valore ISEE ai fini delle agevolazioni universitarie.',
                tipo: 'PDF',
                profilo: { tipo: 'isee_universita', ordine: 'universita' },
              },
              {
                id: 'richiesta-riduzione-contributo',
                nome: 'Richiesta ricalcolo / riduzione contributo unico',
                descrizione: 'Istanza di ricalcolo o riduzione del contributo unico universitario.',
                tipo: 'PDF',
                profilo: { tipo: 'riduzione_contributi', ordine: 'universita' },
              },
            ],
          },
          {
            id: 'sussidi-mobilita',
            nome: 'Sussidi Straordinari e Mobilità',
            descrizione: 'Contributi straordinari per disagio economico e borse integrative per la mobilità.',
            documenti: [
              {
                id: 'contributo-straordinario',
                nome: 'Richiesta contributo straordinario per disagio economico',
                descrizione: 'Domanda di contributo straordinario per situazioni di disagio economico.',
                tipo: 'PDF',
                profilo: { tipo: 'contributo_straordinario', ordine: 'universita' },
              },
              {
                id: 'integrativo-erasmus',
                nome: 'Integrativo borsa Erasmus',
                descrizione: 'Richiesta di borsa integrativa per periodi di mobilità Erasmus+.',
                tipo: 'PDF',
                profilo: { tipo: 'integrativo_erasmus', ordine: 'universita' },
              },
            ],
          },
          {
            id: 'collaborazioni-studentesche',
            nome: 'Collaborazioni Studentesche',
            descrizione: 'Domande per collaborazioni part-time e tutorato retribuito.',
            documenti: [
              {
                id: 'domanda-collaborazioni',
                nome: 'Domanda 200 ore / tutorato retribuito',
                descrizione: 'Domanda di collaborazione studentesca (200 ore) o tutorato retribuito.',
                tipo: 'PDF',
                profilo: { tipo: 'collaborazioni_studentesche', ordine: 'universita' },
              },
            ],
          },
        ],
      },
      {
        id: 'riconoscimenti',
        nome: 'Riconoscimento titoli esteri',
        descrizione: 'Riconoscimento di titoli di studio conseguiti all’estero.',
        documenti: [
          {
            id: 'riconoscimento-titolo-estero',
            nome: 'Richiesta riconoscimento titolo estero',
            descrizione: 'Istanza di riconoscimento di un titolo di studio estero.',
            tipo: 'PDF',
            profilo: { tipo: 'autocertificazione', ordine: 'universita' },
          },
        ],
      },
      {
        id: 'autocertificazione',
        nome: 'Autocertificazioni',
        descrizione: 'Dichiarazioni sostitutive per la carriera universitaria.',
        documenti: [
          {
            id: 'autocertificazione-titoli',
            nome: 'Autocertificazione titoli di studio',
            descrizione: 'Dichiarazione sostitutiva di certificazione dei titoli posseduti (DPR 445/2000).',
            tipo: 'PDF',
            catalogoId: 'autocertificazione-titoli',
            profilo: { tipo: 'autocertificazione', ordine: 'universita' },
          },
        ],
      },
      {
        id: 'tirocini',
        nome: 'Tirocini',
        descrizione: 'Convenzioni e richieste di attivazione tirocini.',
        documenti: [
          {
            id: 'richiesta-tirocinio',
            nome: 'Richiesta attivazione tirocinio',
            descrizione: 'Istanza di attivazione di un tirocinio curriculare.',
            tipo: 'PDF',
            profilo: { tipo: 'iscrizione', ordine: 'universita' },
          },
        ],
      },
      {
        id: 'inclusione-universitaria',
        nome: 'Servizi di inclusione universitaria',
        descrizione: 'Servizi di tutorato specializzato e misure compensative.',
        documenti: [
          {
            id: 'richiesta-sostegno-universita',
            nome: 'Richiesta misure di sostegno – Università',
            descrizione: 'Richiesta di servizi di inclusione e tutorato specializzato all’università.',
            tipo: 'PDF',
            profilo: { tipo: 'sostegno', ordine: 'universita', scopo_sostegno: 'richiesta' },
          },
        ],
      },
      {
        id: 'passaggi-trasferimenti',
        nome: 'Passaggio e trasferimento di corso',
        descrizione: 'Passaggio di corso, trasferimento di sede e abbreviazione.',
        sotto: [
          {
            id: 'passaggio-corso',
            nome: 'Passaggio di corso',
            descrizione: 'Istanze per il passaggio a un altro corso di laurea.',
            documenti: [
              {
                id: 'domanda-passaggio-corso',
                nome: 'Domanda di passaggio di corso di laurea',
                descrizione: 'Istanza di passaggio a un altro corso di laurea.',
                tipo: 'PDF',
                profilo: { tipo: 'iscrizione', ordine: 'universita' },
              },
              {
                id: 'domanda-abbreviazione-corso',
                nome: 'Domanda di abbreviazione di corso',
                descrizione: 'Istanza di abbreviazione del corso per riconoscimento di carriera pregressa.',
                tipo: 'PDF',
                profilo: { tipo: 'iscrizione', ordine: 'universita' },
              },
            ],
          },
          {
            id: 'trasferimento-sede',
            nome: 'Trasferimento di sede',
            descrizione: 'Istanze di trasferimento a un’altra sede universitaria.',
            documenti: [
              {
                id: 'domanda-trasferimento-sede',
                nome: 'Domanda di trasferimento di sede',
                descrizione: 'Istanza di trasferimento a un’altra sede universitaria.',
                tipo: 'PDF',
                profilo: { tipo: 'iscrizione', ordine: 'universita' },
              },
              {
                id: 'trasferimento-uscita',
                nome: 'Richiesta trasferimento in entrata / uscita',
                descrizione: 'Istanza di trasferimento in entrata o in uscita da altro Ateneo.',
                tipo: 'PDF',
                profilo: { tipo: 'iscrizione', ordine: 'universita' },
              },
            ],
          },
        ],
      },
      {
        id: 'tasse-esenzioni',
        nome: 'Tasse ed esenzioni',
        descrizione: 'Esenzioni, riduzioni, rateizzazione ed esoneri delle tasse universitarie.',
        documenti: [
          {
            id: 'richiesta-esenzione-tasse',
            nome: 'Richiesta esenzione tasse universitarie',
            descrizione: 'Istanza di esenzione o riduzione delle tasse con ISEE.',
            tipo: 'PDF',
            profilo: { tipo: 'esenzione_tasse', ordine: 'universita' },
          },
          {
            id: 'richiesta-rateizzazione',
            nome: 'Richiesta rateizzazione tasse universitarie',
            descrizione: 'Istanza di rateizzazione del contributo unico e delle tasse.',
            tipo: 'PDF',
            profilo: { tipo: 'esenzione_tasse', ordine: 'universita' },
          },
          {
            id: 'esonero-tasse-merito',
            nome: 'Richiesta esonero tasse per merito',
            descrizione: 'Domanda di esonero totale o parziale dalle tasse per merito accademico.',
            tipo: 'PDF',
            profilo: { tipo: 'esenzione_tasse', ordine: 'universita' },
          },
        ],
      },
      {
        id: 'alloggi-residenze',
        nome: 'Alloggi e residenze',
        descrizione: 'Richieste di alloggio nelle residenze universitarie.',
        documenti: [
          {
            id: 'richiesta-alloggio',
            nome: 'Richiesta alloggio in residenza universitaria',
            descrizione: 'Domanda di assegnazione di un alloggio universitario.',
            tipo: 'PDF',
            profilo: { tipo: 'iscrizione', ordine: 'universita' },
          },
        ],
      },
      {
        id: 'mobilita-internazionale',
        nome: 'Erasmus e mobilità internazionale',
        descrizione: 'Candidature Erasmus e programmi di mobilità.',
        documenti: [
          {
            id: 'candidatura-erasmus',
            nome: 'Candidatura Erasmus+',
            descrizione: 'Domanda di partecipazione al programma Erasmus+.',
            tipo: 'PDF',
            profilo: { tipo: 'iscrizione', ordine: 'universita' },
          },
        ],
      },
      {
        id: 'servizio-civile',
        nome: 'Servizio civile e volontariato',
        descrizione: 'Candidature e documentazione per il servizio civile.',
        documenti: [
          {
            id: 'candidatura-servizio-civile',
            nome: 'Candidatura servizio civile universale',
            descrizione: 'Domanda di partecipazione al servizio civile universale.',
            tipo: 'PDF',
            profilo: { tipo: 'autocertificazione', ordine: 'universita' },
          },
        ],
      },
      {
        id: 'biblioteche-prestiti',
        nome: 'Biblioteche e prestiti',
        descrizione: 'Iscrizione alle biblioteche e prestiti bibliotecari.',
        documenti: [
          {
            id: 'richiesta-prestito',
            nome: 'Richiesta prestito bibliotecario',
            descrizione: 'Modulo di richiesta prestito presso le biblioteche universitarie.',
            tipo: 'PDF',
            profilo: { tipo: 'biblioteca', ordine: 'universita' },
          },
        ],
      },
      {
        id: 'certificati-carriera',
        nome: 'Certificati di carriera',
        descrizione: 'Certificati di iscrizione, esami e laurea.',
        documenti: [
          {
            id: 'richiesta-certificato-carriera',
            nome: 'Richiesta certificato di carriera',
            descrizione: 'Istanza di rilascio del certificato di carriera universitaria.',
            tipo: 'PDF',
            profilo: { tipo: 'autocertificazione', ordine: 'universita' },
          },
        ],
      },
      {
        id: 'laurea-abilitazione',
        nome: 'Laurea e abilitazione',
        descrizione: 'Domande di laurea, proclamazione e abilitazione professionale.',
        documenti: [
          {
            id: 'domanda-laurea',
            nome: 'Domanda di laurea',
            descrizione: 'Istanza di ammissione alla seduta di laurea.',
            tipo: 'PDF',
            profilo: { tipo: 'laurea', ordine: 'universita' },
          },
          {
            id: 'richiesta-proclamazione',
            nome: 'Richiesta proclamazione / prova finale',
            descrizione: 'Istanza di proclamazione o ammissione alla prova finale.',
            tipo: 'PDF',
            profilo: { tipo: 'laurea', ordine: 'universita' },
          },
          {
            id: 'richiesta-tesi',
            nome: 'Richiesta assegnazione tesi e relatore',
            descrizione: 'Istanza di assegnazione della tesi di laurea e del relatore.',
            tipo: 'PDF',
            profilo: { tipo: 'laurea', ordine: 'universita' },
          },
        ],
      },
    ],
  },

  {
    id: 'enti',
    nome: 'Enti',
    sotto: [
      {
        id: 'burocrazia-segreterie',
        nome: 'Burocrazia e segreterie',
        descrizione: 'Documenti per i rapporti con le segreterie e gli enti.',
        documenti: [
          {
            id: 'autocertificazione-titoli-enti',
            nome: 'Autocertificazione titoli di studio',
            descrizione: 'Dichiarazione sostitutiva di certificazione dei titoli posseduti (DPR 445/2000).',
            tipo: 'PDF',
            catalogoId: 'autocertificazione-titoli',
            profilo: { tipo: 'autocertificazione', ordine: 'enti' },
          },
          {
            id: 'deleghe-privacy',
            nome: 'Modulo deleghe e consenso privacy',
            descrizione: 'Modello di delega e informativa privacy per i rapporti con le segreterie scolastiche.',
            tipo: 'PDF',
            catalogoId: 'deleghe-privacy',
            profilo: { tipo: 'delega_privacy', ordine: 'enti' },
          },
        ],
      },
      {
        id: 'concorsi',
        nome: 'Concorsi e istruttorie',
        descrizione: 'Domande di partecipazione e documentazione per concorsi.',
        documenti: [
          {
            id: 'domanda-concorso',
            nome: 'Domanda di partecipazione a concorso',
            descrizione: 'Modello di domanda di partecipazione a concorsi e selezioni.',
            tipo: 'PDF',
            profilo: { tipo: 'autocertificazione', ordine: 'enti' },
          },
        ],
      },
      {
        id: 'incarichi-enti',
        nome: 'Incarichi con Enti locali',
        descrizione: 'Documentazione per incarichi con Comuni, Province e Regioni.',
        documenti: [
          {
            id: 'dichiarazione-incarico-ente',
            nome: 'Dichiarazione incarico con Ente locale',
            descrizione: 'Dichiarazione per lo svolgimento di incarichi con gli enti locali.',
            tipo: 'PDF',
            profilo: { tipo: 'autocertificazione', ordine: 'enti' },
          },
        ],
      },
      {
        id: 'mobilita',
        nome: 'Mobilità e trasferimenti',
        descrizione: 'Checklist e documenti per la mobilità annuale.',
        documenti: [
          {
            id: 'checklist-mobilita',
            nome: 'Checklist mobilità annuale',
            descrizione: 'Elenco dei documenti e delle scadenze da seguire per la mobilità annuale.',
            tipo: 'PDF',
            catalogoId: 'checklist-mobilita',
            profilo: { tipo: 'mobilita', ordine: 'enti' },
          },
        ],
      },
      {
        id: 'comunicazioni',
        nome: 'Comunicazioni con Comune/Provincia',
        descrizione: 'Comunicazioni e istanze verso gli enti territoriali.',
        documenti: [
          {
            id: 'istanza-comune',
            nome: 'Istanza al Comune / Provincia',
            descrizione: 'Modello di istanza generica verso il Comune o la Provincia.',
            tipo: 'PDF',
            profilo: { tipo: 'autocertificazione', ordine: 'enti' },
          },
        ],
      },
      {
        id: 'privacy',
        nome: 'Privacy e consensi',
        descrizione: 'Consensi al trattamento dei dati e informative.',
        documenti: [
          {
            id: 'consenso-privacy',
            nome: 'Consenso trattamento dati',
            descrizione: 'Modulo di consenso al trattamento dei dati personali.',
            tipo: 'PDF',
            profilo: { tipo: 'delega_privacy', ordine: 'enti' },
          },
        ],
      },
      {
        id: 'convenzioni',
        nome: 'Convenzioni e tirocini',
        descrizione: 'Convenzioni per tirocini con enti e istituzioni.',
        documenti: [
          {
            id: 'richiesta-convenzione',
            nome: 'Richiesta convenzione tirocinio',
            descrizione: 'Istanza per la stipula di una convenzione di tirocinio con un ente.',
            tipo: 'PDF',
            profilo: { tipo: 'autocertificazione', ordine: 'enti' },
          },
        ],
      },
      {
        id: 'rendicontazione',
        nome: 'Rendicontazione e rimborsi',
        descrizione: 'Rimborsi spese, rendiconti di progetto e documenti contabili.',
        sotto: [
          {
            id: 'rimborsi-spese',
            nome: 'Rimborsi spese',
            descrizione: 'Istanze di rimborso con elenco dei giustificativi.',
            documenti: [
              {
                id: 'richiesta-rimborso-spese',
                nome: 'Richiesta rimborso spese',
                descrizione: 'Istanza di rimborso spese con elenco dei giustificativi.',
                tipo: 'PDF',
                profilo: { tipo: 'autocertificazione', ordine: 'enti' },
              },
            ],
          },
          {
            id: 'rendiconti-progetto',
            nome: 'Rendiconti di progetto',
            descrizione: 'Modelli di rendiconto per progetti finanziati.',
            documenti: [
              {
                id: 'rendiconto-progetto',
                nome: 'Rendiconto di progetto',
                descrizione: 'Modello di rendiconto per progetti finanziati.',
                tipo: 'PDF',
                profilo: { tipo: 'autocertificazione', ordine: 'enti' },
              },
            ],
          },
        ],
      },
      {
        id: 'integrazione-territoriale',
        nome: 'Integrazione Territoriale',
        descrizione: 'Protocolli di intesa, patrocini, uso locali e convenzioni con il territorio.',
        sotto: [
          {
            id: 'protocolli-intesa',
            nome: 'Protocolli di intesa ASL / Comune',
            descrizione: 'Protocolli e accordi con ASL, Comune e servizi territoriali.',
            documenti: [
              {
                id: 'protocollo-intesa',
                nome: 'Protocollo di intesa ASL / Comune',
                descrizione: 'Modello di protocollo di intesa tra istituzione scolastica e ASL/Comune.',
                tipo: 'PDF',
                profilo: { tipo: 'protocollo_intesa', ordine: 'enti' },
              },
            ],
          },
          {
            id: 'patrocinio-locali',
            nome: 'Patrocinio e uso locali',
            descrizione: 'Richieste di patrocinio e concessione dei locali scolastici.',
            documenti: [
              {
                id: 'richiesta-patrocinio',
                nome: 'Richiesta patrocinio / uso locali scolastici',
                descrizione: 'Istanza di patrocinio o concessione in uso dei locali scolastici.',
                tipo: 'PDF',
                profilo: { tipo: 'patrocinio_locali', ordine: 'enti' },
              },
            ],
          },
          {
            id: 'convenzioni-pcto-tirocini',
            nome: 'Convenzioni PCTO / Tirocini',
            descrizione: 'Convenzioni per PCTO, tirocini e stage con aziende ed enti.',
            documenti: [
              {
                id: 'convenzione-pcto',
                nome: 'Convenzione PCTO / tirocinio',
                descrizione: 'Modello di convenzione per PCTO, tirocini curriculari e stage.',
                tipo: 'PDF',
                profilo: { tipo: 'convenzione_pcto', ordine: 'enti' },
              },
            ],
          },
        ],
      },
      {
        id: 'ricorsi-tutela',
        nome: 'Ricorsi e Tutela',
        descrizione: 'Reclami, ricorsi amministrativi e segnalazioni di anomalie.',
        sotto: [
          {
            id: 'reclami-ricorsi',
            nome: 'Reclamo e ricorso amministrativo',
            descrizione: 'Modelli di reclamo e ricorso amministrativo.',
            documenti: [
              {
                id: 'reclamo-ricorso-amministrativo',
                nome: 'Modulo reclamo / ricorso amministrativo',
                descrizione: 'Modello di reclamo o ricorso amministrativo.',
                tipo: 'PDF',
                profilo: { tipo: 'ricorso_reclamo', ordine: 'enti' },
              },
            ],
          },
          {
            id: 'riesame-autotutela',
            nome: 'Riesame in autotutela',
            descrizione: 'Istanze di riesame in autotutela di provvedimenti.',
            documenti: [
              {
                id: 'istanza-riesame-autotutela',
                nome: 'Istanza di riesame in autotutela',
                descrizione: 'Istanza di riesame di un provvedimento ai sensi della L. 241/1990.',
                tipo: 'PDF',
                profilo: { tipo: 'ricorso_reclamo', ordine: 'enti' },
              },
            ],
          },
          {
            id: 'segnalazioni-anomalie',
            nome: 'Segnalazione anomalie servizio',
            descrizione: 'Segnalazioni di anomalie e disservizi.',
            documenti: [
              {
                id: 'segnalazione-anomalia',
                nome: 'Segnalazione anomalie del servizio',
                descrizione: 'Modulo di segnalazione di anomalie o disservizi.',
                tipo: 'PDF',
                profilo: { tipo: 'segnalazione_anomalia', ordine: 'enti' },
              },
            ],
          },
        ],
      },
      {
        id: 'accesso-atti',
        nome: 'Accesso agli atti',
        descrizione: 'Istanze di accesso agli atti e trasparenza.',
        documenti: [
          {
            id: 'istanza-accesso-atti',
            nome: 'Istanza di accesso agli atti',
            descrizione: 'Richiesta di accesso ai documenti amministrativi.',
            tipo: 'PDF',
            profilo: { tipo: 'accesso_atti', ordine: 'enti' },
          },
        ],
      },
      {
        id: 'protocollo-istanze',
        nome: 'Protocollo e istanze',
        descrizione: 'Istanze e comunicazioni da protocollare presso gli enti.',
        documenti: [
          {
            id: 'istanza-generica-protocollo',
            nome: 'Istanza generica da protocollare',
            descrizione: 'Modello di istanza generica con spazio per il protocollo.',
            tipo: 'PDF',
            profilo: { tipo: 'autocertificazione', ordine: 'enti' },
          },
        ],
      },
      {
        id: 'bandi-avvisi',
        nome: 'Bandi e avvisi',
        descrizione: 'Domande di partecipazione a bandi e avvisi pubblici.',
        documenti: [
          {
            id: 'domanda-bando',
            nome: 'Domanda di partecipazione a bando',
            descrizione: 'Modello di domanda per bandi e avvisi pubblici.',
            tipo: 'PDF',
            profilo: { tipo: 'autocertificazione', ordine: 'enti' },
          },
        ],
      },
      {
        id: 'contributi-finanziamenti',
        nome: 'Contributi e finanziamenti',
        descrizione: 'Richieste di contributi e finanziamenti pubblici.',
        documenti: [
          {
            id: 'richiesta-contributo',
            nome: 'Richiesta contributo',
            descrizione: 'Istanza di richiesta contributo a un ente pubblico.',
            tipo: 'PDF',
            profilo: { tipo: 'autocertificazione', ordine: 'enti' },
          },
        ],
      },
      {
        id: 'dichiarazioni-sostitutive',
        nome: 'Dichiarazioni sostitutive',
        descrizione: 'Dichiarazioni sostitutive di certificazione e atto notorio.',
        documenti: [
          {
            id: 'dichiarazione-sostitutiva-enti',
            nome: 'Dichiarazione sostitutiva per enti',
            descrizione: 'Modello di dichiarazione sostitutiva per pratiche presso gli enti.',
            tipo: 'PDF',
            profilo: { tipo: 'autocertificazione', ordine: 'enti' },
          },
        ],
      },
      {
        id: 'istruttorie-pareri',
        nome: 'Istruttorie e pareri',
        descrizione: 'Richiesta di pareri, nulla osta e istruttorie.',
        documenti: [
          {
            id: 'richiesta-nulla-osta',
            nome: 'Richiesta nulla osta',
            descrizione: 'Istanza di richiesta nulla osta a un ente.',
            tipo: 'PDF',
            profilo: { tipo: 'autocertificazione', ordine: 'enti' },
          },
        ],
      },
      {
        id: 'sanzioni-ricorsi',
        nome: 'Sanzioni e ricorsi',
        descrizione: 'Ricerche di sanzioni e modelli di ricorso.',
        documenti: [
          {
            id: 'ricorso-sanzione',
            nome: 'Ricorso avverso sanzione',
            descrizione: 'Modello di ricorso amministrativo avverso una sanzione.',
            tipo: 'PDF',
            profilo: { tipo: 'autocertificazione', ordine: 'enti' },
          },
        ],
      },
    ],
  },
  {
    id: 'altro',
    nome: 'Altro',
    sotto: [
      {
        id: 'certificati-anagrafe',
        nome: 'Certificati e anagrafe',
        descrizione: 'Certificati anagrafici, di residenza e dichiarazioni varie.',
        documenti: [
          {
            id: 'richiesta-certificato-residenza',
            nome: 'Richiesta certificato di residenza',
            descrizione: 'Domanda di rilascio del certificato di residenza.',
            tipo: 'PDF',
            profilo: { tipo: 'autocertificazione' },
          },
        ],
      },
      {
        id: 'autocertificazioni',
        nome: 'Autocertificazioni',
        descrizione: 'Dichiarazioni sostitutive per i casi più comuni.',
        sotto: [
          {
            id: 'autocertificazioni-base',
            nome: 'Autocertificazioni di base',
            descrizione: 'Modelli liberi di dichiarazione sostitutiva.',
            documenti: [
              {
                id: 'autocertificazione-generica',
                nome: 'Autocertificazione generica (DPR 445/2000)',
                descrizione: 'Modello libero di dichiarazione sostitutiva di certificazione.',
                tipo: 'PDF',
                profilo: { tipo: 'autocertificazione' },
              },
            ],
          },
        ],
      },
      {
        id: 'deleghe-prelievo',
        nome: 'Deleghe e prelievo dei minori',
        descrizione: 'Deleghe per il prelievo degli alunni e per i rapporti con la scuola.',
        documenti: [
          {
            id: 'delega-prelievo',
            nome: 'Delega prelievo minore',
            descrizione: 'Modulo di delega per il prelievo di un minore da parte di terzi.',
            tipo: 'PDF',
            profilo: { tipo: 'delega_famiglia' },
          },
        ],
      },
      {
        id: 'denunce-segnalazioni',
        nome: 'Denunce e segnalazioni',
        descrizione: 'Segnalazioni di disservizi, infortuni e situazioni da tutelare.',
        documenti: [
          {
            id: 'segnalazione-disservizio',
            nome: 'Segnalazione disservizio',
            descrizione: 'Modello di segnalazione di un disservizio scolastico.',
            tipo: 'PDF',
            profilo: { tipo: 'autocertificazione' },
          },
        ],
      },
      {
        id: 'assicurazioni',
        nome: 'Assicurazioni scolastiche',
        descrizione: 'Adesione alle polizze assicurative e denunce sinistri.',
        sotto: [
          {
            id: 'adesioni-polizza',
            nome: 'Adesioni e polizze',
            descrizione: 'Moduli di adesione alle coperture assicurative.',
            documenti: [
              {
                id: 'adesione-polizza',
                nome: 'Adesione polizza assicurativa',
                descrizione: 'Modulo di adesione alla polizza assicurativa della scuola.',
                tipo: 'PDF',
                profilo: { tipo: 'delega_privacy' },
              },
            ],
          },
        ],
      },
      {
        id: 'comodato-materiali',
        nome: 'Comodato e materiali',
        descrizione: 'Comodato d’uso di libri e dispositivi, materiali didattici.',
        documenti: [
          {
            id: 'comodato-libri',
            nome: 'Richiesta comodato libri di testo',
            descrizione: 'Istanza di comodato d’uso dei libri di testo.',
            tipo: 'PDF',
            profilo: { tipo: 'autocertificazione' },
          },
        ],
      },
      {
        id: 'pagamenti-rate',
        nome: 'Pagamenti e rate',
        descrizione: 'Rateizzazioni, esoneri e solleciti di pagamento.',
        documenti: [
          {
            id: 'richiesta-rateizzazione',
            nome: 'Richiesta rateizzazione pagamento',
            descrizione: 'Istanza di rateizzazione di un pagamento dovuto alla scuola.',
            tipo: 'PDF',
            profilo: { tipo: 'autocertificazione' },
          },
        ],
      },
      {
        id: 'moduli-liberi',
        nome: 'Modelli liberi e promemoria',
        descrizione: 'Modelli generici compilabili per ogni esigenza.',
        documenti: [
          {
            id: 'modello-libero',
            nome: 'Modello libero compilabile',
            descrizione: 'Modello generico con campi da compilare per ogni comunicazione.',
            tipo: 'PDF',
            profilo: { tipo: 'autocertificazione' },
          },
        ],
      },
      {
        id: 'ricorsi-altro',
        nome: 'Ricorsi e reclami',
        descrizione: 'Modelli di ricorso e reclamo per ogni ambito.',
        documenti: [
          {
            id: 'ricorso-generico',
            nome: 'Ricorso generico',
            descrizione: 'Modello di ricorso amministrativo generico.',
            tipo: 'PDF',
            profilo: { tipo: 'ricorso_reclamo' },
          },
        ],
      },
      {
        id: 'sanzioni-altro',
        nome: 'Sanzioni e contravvenzioni',
        descrizione: 'Documentazione relativa a sanzioni e contravvenzioni.',
        documenti: [
          {
            id: 'dichiarazione-sanzione',
            nome: 'Dichiarazione in merito a sanzione',
            descrizione: 'Modello di dichiarazione per pratiche relative a sanzioni.',
            tipo: 'PDF',
            profilo: { tipo: 'autocertificazione' },
          },
        ],
      },
      {
        id: 'successioni',
        nome: 'Successioni e pratiche',
        descrizione: 'Documentazione per successioni e pratiche familiari.',
        documenti: [
          {
            id: 'dichiarazione-successione',
            nome: 'Dichiarazione per pratica di successione',
            descrizione: 'Modello di dichiarazione per pratiche di successione.',
            tipo: 'PDF',
            profilo: { tipo: 'autocertificazione' },
          },
        ],
      },
      {
        id: 'certificati-varie',
        nome: 'Certificati vari',
        descrizione: 'Richieste di certificati non standard.',
        documenti: [
          {
            id: 'richiesta-certificato-varie',
            nome: 'Richiesta certificato generico',
            descrizione: 'Modello di richiesta di un certificato generico.',
            tipo: 'PDF',
            profilo: { tipo: 'autocertificazione' },
          },
        ],
      },
      {
        id: 'modulistica-dat',
        nome: 'Modulistica per la DAT',
        descrizione: 'Documentazione per disposizioni anticipate di trattamento.',
        documenti: [
          {
            id: 'dat-modello',
            nome: 'Modello DAT',
            descrizione: 'Modello per la registrazione delle disposizioni anticipate di trattamento.',
            tipo: 'PDF',
            profilo: { tipo: 'autocertificazione' },
          },
        ],
      },
      {
        id: 'associazioni-comitati',
        nome: 'Associazioni e comitati',
        descrizione: 'Documentazione per associazioni, comitati e gruppi.',
        documenti: [
          {
            id: 'statuto-associazione',
            nome: 'Modello statuto associazione',
            descrizione: 'Modello di statuto per associazioni e comitati.',
            tipo: 'PDF',
            profilo: { tipo: 'autocertificazione' },
          },
        ],
      },
      {
        id: 'sportello-cittadino',
        nome: 'Sportello del cittadino',
        descrizione: 'Segnalazioni e richieste allo sportello del cittadino.',
        documenti: [
          {
            id: 'segnalazione-sportello',
            nome: 'Segnalazione allo sportello del cittadino',
            descrizione: 'Modello di segnalazione per lo sportello del cittadino.',
            tipo: 'PDF',
            profilo: { tipo: 'autocertificazione' },
          },
        ],
      },
    ],
  },

  {
    id: 'comunicazione-interna',
    nome: 'Comunicazione Interna',
    icona: 'MessageSquare',
    descrizione:
      'Modulistica gestionale per Personale ATA, Docenti e Collaboratori per la gestione interna e cartacea.',
    sotto: [
      {
        id: 'ci-personale-ata-collaboratori',
        nome: 'Personale ATA e Collaboratori',
        descrizione:
          'Richieste, segnalazioni e registri per il Personale ATA e i collaboratori scolastici.',
        sotto: [
          {
            id: 'ci-cambio-turno-sostituzione',
            nome: 'Richiesta Cambio Turno e Sostituzione',
            descrizione:
              'Modulo per la richiesta di cambio turno e di sostituzione di un collega.',
            documenti: [
              {
                id: 'ci-richiesta-cambio-turno-sostituzione',
                nome: 'Richiesta cambio turno e sostituzione',
                descrizione:
                  'Template compilabile per richiedere il cambio di turno e l’eventuale sostituzione, da consegnare alla segreteria.',
                tipo: 'DOCX',
                profilo: {
                  tipo: 'comunicazione_interna',
                  area: 'personale_ata',
                  pratica: 'cambio_turno',
                },
              },
            ],
          },
          {
            id: 'ci-segnalazione-guasti-manutenzione',
            nome: 'Segnalazione Guasti e Manutenzione Plesso',
            descrizione:
              'Segnalazione di guasti e richiesta di intervento di manutenzione nel plesso.',
            documenti: [
              {
                id: 'ci-segnalazione-guasto-pleso',
                nome: 'Segnalazione guasti e manutenzione plesso',
                descrizione:
                  'Modulo per segnalare guasti o criticità e richiedere l’intervento di manutenzione dell’edificio scolastico.',
                tipo: 'DOCX',
                profilo: {
                  tipo: 'comunicazione_interna',
                  area: 'personale_ata',
                  pratica: 'guasti_manutenzione',
                },
              },
            ],
          },
          {
            id: 'ci-registro-consegna-materiali-chiavi',
            nome: 'Registro Consegna Materiali e Chiavi',
            descrizione:
              'Registro per la tracciabilità di consegna e riconsegna di materiali e chiavi.',
            documenti: [
              {
                id: 'ci-registro-consegne-materiali-chiavi',
                nome: 'Registro consegna materiali e chiavi',
                descrizione:
                  'Registro DOCX da compilare per la consegna e la riconsegna di materiali e chiavi in uso al personale.',
                tipo: 'DOCX',
                profilo: {
                  tipo: 'comunicazione_interna',
                  area: 'personale_ata',
                  pratica: 'registro_consegne',
                },
              },
            ],
          },
        ],
      },
      {
        id: 'ci-circolari-verbali',
        nome: 'Circolari e Verbali',
        descrizione:
          'Verbali di riunione e dichiarazioni di presa visione delle circolari interne.',
        sotto: [
          {
            id: 'ci-verbale-riunione-dipartimento',
            nome: 'Verbale Riunione di Dipartimento',
            descrizione:
              'Modello di verbale per la riunione di dipartimento disciplinare.',
            documenti: [
              {
                id: 'ci-verbale-riunione-dipartimento-modello',
                nome: 'Verbale riunione di dipartimento',
                descrizione:
                  'Verbale compilabile della riunione di dipartimento: ordine del giorno, interventi, decisioni e firme dei partecipanti.',
                tipo: 'PDF',
                profilo: {
                  tipo: 'comunicazione_interna',
                  area: 'circolari_verbali',
                  pratica: 'verbale_dipartimento',
                },
              },
            ],
          },
          {
            id: 'ci-dichiarazione-presa-visione-circolare',
            nome: 'Dichiarazione Presa Visione Circolare',
            descrizione:
              'Dichiarazione di presa visione di una circolare interna.',
            documenti: [
              {
                id: 'ci-dichiarazione-presa-visione-circolare-modello',
                nome: 'Dichiarazione presa visione circolare',
                descrizione:
                  'Dichiarazione da firmare per attestare la presa visione di una circolare interna dell’istituto.',
                tipo: 'PDF',
                profilo: {
                  tipo: 'comunicazione_interna',
                  area: 'circolari_verbali',
                  pratica: 'presa_visione_circolare',
                },
              },
            ],
          },
        ],
      },
      {
        id: 'ci-permessi-assenze-cartaceo',
        nome: 'Permessi e Assenze (Cartaceo)',
        descrizione:
          'Modulistica cartacea per permessi, assenze e congedi del personale.',
        sotto: [
          {
            id: 'ci-permesso-breve-recupero-ore',
            nome: 'Richiesta Permesso Breve e Recupero Ore',
            descrizione:
              'Richiesta di permesso breve o di recupero ore da consegnare alla segreteria.',
            documenti: [
              {
                id: 'ci-richiesta-permesso-breve-recupero-ore',
                nome: 'Richiesta permesso breve e recupero ore',
                descrizione:
                  'Modulo per richiedere un permesso breve e concordare il recupero delle ore.',
                tipo: 'DOCX',
                profilo: {
                  tipo: 'comunicazione_interna',
                  area: 'permessi_assenze',
                  pratica: 'permesso_breve_recupero_ore',
                },
              },
            ],
          },
          {
            id: 'ci-assenza-visita-medica',
            nome: 'Comunicazione Assenza e Visita Medica',
            descrizione:
              'Comunicazione di assenza dal servizio per malattia o visita medica.',
            documenti: [
              {
                id: 'ci-comunicazione-assenza-visita-medica',
                nome: 'Comunicazione assenza e visita medica',
                descrizione:
                  'Comunicazione di assenza dal servizio con allegazione del certificato di visita medica.',
                tipo: 'DOCX',
                profilo: {
                  tipo: 'comunicazione_interna',
                  area: 'permessi_assenze',
                  pratica: 'assenza_visita_medica',
                },
              },
            ],
          },
          {
            id: 'ci-congedo-l104',
            nome: 'Richiesta Congedo e L. 104',
            descrizione:
              'Richiesta di congedo ai sensi della Legge 104/1992.',
            documenti: [
              {
                id: 'ci-richiesta-congedo-l104',
                nome: 'Richiesta congedo e L. 104',
                descrizione:
                  'Domanda di congedo o di permessi ex L. 104/1992 da presentare all’ufficio del personale.',
                tipo: 'PDF',
                profilo: {
                  tipo: 'comunicazione_interna',
                  area: 'permessi_assenze',
                  pratica: 'congedo_l104',
                },
              },
            ],
          },
        ],
      },
      {
        id: 'ci-incarichi-progetti-interni',
        nome: 'Incarichi e Progetti Interni',
        descrizione:
          'Candidature a incarichi e funzioni strumentali e relazioni finali delle attività.',
        sotto: [
          {
            id: 'ci-candidatura-incarico-funzione-strumentale',
            nome: 'Candidatura Incarico o Funzione Strumentale',
            descrizione:
              'Candidatura a un incarico o a una funzione strumentale del PTOF.',
            documenti: [
              {
                id: 'ci-candidatura-incarico-funzione-strumentale-modello',
                nome: 'Candidatura incarico o funzione strumentale',
                descrizione:
                  'Domanda di candidatura per l’attribuzione di un incarico o di una funzione strumentale.',
                tipo: 'DOCX',
                profilo: {
                  tipo: 'comunicazione_interna',
                  area: 'incarichi_progetti',
                  pratica: 'candidatura_incarico',
                },
              },
            ],
          },
          {
            id: 'ci-relazione-finale-attivita-aggiuntiva',
            nome: 'Relazione Finale Attività Aggiuntiva',
            descrizione:
              'Relazione conclusiva delle attività aggiuntive svolte.',
            documenti: [
              {
                id: 'ci-relazione-finale-attivita-aggiuntiva-modello',
                nome: 'Relazione finale attività aggiuntiva',
                descrizione:
                  'Relazione finale da presentare al termine delle attività aggiuntive e dei progetti interni.',
                tipo: 'DOCX',
                profilo: {
                  tipo: 'comunicazione_interna',
                  area: 'incarichi_progetti',
                  pratica: 'relazione_finale_attivita',
                },
              },
            ],
          },
        ],
      },
    ],
  },

];

/**
 * Normalizzazione "matrioska" dell'archivio.
 *
 * La navigazione manuale deve procedere SOLO di sottocategoria in
 * sottocategoria: i documenti finali compaiono esclusivamente quando si
 * arriva in fondo all'albero (cartella finale con 1 solo modulo).
 *
 *  - un nodo con PIÙ documenti viene splittato in cartelle finali (1 per modulo);
 *  - un nodo con documenti E sottocategorie sposta i documenti in una cartella
 *    dedicata "Pratiche", così non si mescolano mai moduli e cartelle;
 *  - un nodo con un solo documento resta una cartella finale con 1 solo modulo.
 */
function normalizzaMatrioska(nodo: SottoCategoriaModulistica): SottoCategoriaModulistica {
  const documenti = nodo.documenti ?? [];
  const figli: SottoCategoriaModulistica[] = (nodo.sotto ?? []).map(normalizzaMatrioska);

  if (documenti.length === 0) {
    return { ...nodo, sotto: figli };
  }

  if (figli.length > 0) {
    // Documenti + sottocategorie: i documenti finiscono in una cartella dedicata.
    figli.push({
      id: `${nodo.id}-pratiche`,
      nome: 'Pratiche',
      descrizione: 'Moduli della pratica in questione.',
      sotto: documenti.map((d) => ({
        id: `${nodo.id}-${d.id}`,
        nome: d.nome,
        descrizione: d.descrizione,
        documenti: [d],
      })),
    });
    return { ...nodo, sotto: figli, documenti: [] };
  }

  if (documenti.length === 1) {
    // Cartella finale con 1 solo modulo.
    return { ...nodo, sotto: [], documenti };
  }

  // Più documenti: ogni modulo diventa una cartella finale (1 solo per cartella).
  return {
    ...nodo,
    sotto: documenti.map((d) => ({
      id: `${nodo.id}-${d.id}`,
      nome: d.nome,
      descrizione: d.descrizione,
      documenti: [d],
    })),
    documenti: [],
  };
}

/**
 * Macroaree dell'archivio già normalizzate a matrioska:
 * la navigazione mostra SOLO sottocategorie, i documenti appaiono
 * esclusivamente nelle cartelle finali.
 */
export const macroAreeModulistica: MacroAreaModulistica[] = macroAreeRaw.map((m) => ({
  ...m,
  sotto: m.sotto.map(normalizzaMatrioska),
}));

/** Cerca una macroarea dell'archivio per id. */
export function macroAreaById(id: string | null): MacroAreaModulistica | null {
  if (!id) return null;
  return macroAreeModulistica.find((m) => m.id === id) ?? null;
}

/**
 * Cerca il documento terminale dell'archivio (variante con `profilo`) per id,
 * attraversando l'albero normalizzato delle Macroaree. Usato per aprire
 * l'anteprima locale istantanea anche dai "Modelli Scaricati" (storico).
 */
export function trovaDocumentoModulisticaById(id: string | null): DocumentoModulistica | null {
  if (!id) return null;
  const esploraNodi = (nodi: SottoCategoriaModulistica[]): DocumentoModulistica | null => {
    for (const nodo of nodi) {
      const diretto = nodo.documenti?.find((d) => d.id === id);
      if (diretto) return diretto;
      if (nodo.sotto?.length) {
        const ricorsivo = esploraNodi(nodo.sotto);
        if (ricorsivo) return ricorsivo;
      }
    }
    return null;
  };
  for (const area of macroAreeModulistica) {
    const trovato = esploraNodi(area.sotto);
    if (trovato) return trovato;
  }
  return null;
}

