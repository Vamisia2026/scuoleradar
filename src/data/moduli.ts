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
