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
    tipo: 'PDF',
    descrizione: 'Modello compilabile per la domanda di supplenza breve da inviare alle scuole.',
  },
  {
    id: 'mad',
    nome: 'Domanda di messa a disposizione (MAD)',
    categoria: 'Supplenze',
    macroArea: 'Supplenze e Interpelli',
    tipo: 'PDF',
    descrizione: 'Modello aggiornato per la messa a disposizione per insegnamenti di ogni ordine e grado.',
  },
  {
    id: 'sostegno-disponibilita',
    nome: 'Domanda disponibilità incarico sostegno (ADEE/ADSS)',
    categoria: 'Sostegno',
    macroArea: 'Sostegno & Inclusione',
    tipo: 'PDF',
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
    tipo: 'PDF',
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
  tipo: string; // 'PDF'
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
import { macroAreaEnti, macroAreaAltro } from './moduliEntiAltro';
import { macroAreaSostegno, macroAreaUniversita, macroAreaComunicazioneInterna } from './moduliAltreAree';

import {
  macroAreaInfanzia,
  macroAreaPrimaria,
  macroAreaSecondaria1,
  macroAreaSecondaria2,
} from './moduliOrdiniScuola';

/**
 * Albero grezzo delle Macroaree dell'archivio (prima della normalizzazione "matrioska"):
 * Sostegno · Infanzia · Primaria · Secondaria 1°/2° · Università · Enti · Altro · Comunicazione Interna.
 * Gli alberi dei 4 ordini di scuola vivono in `moduliOrdiniScuola.ts` (3 livelli coerenti).
 */
const macroAreeRaw: MacroAreaModulistica[] = [
  macroAreaSostegno,
  macroAreaInfanzia,
  macroAreaPrimaria,
  macroAreaSecondaria1,
  macroAreaSecondaria2,
  macroAreaUniversita,
  macroAreaEnti,
  macroAreaAltro,
  macroAreaComunicazioneInterna,
];

/**
 * Normalizzazione "matrioska" dell'archivio.
 *
 * L'albero rispecchia FEDELMENTE i dati dichiarati in `moduli.ts`:
 *  - i documenti restano nella loro sottocartella e sono resi come cards;
 *  - se un nodo ha SIA documenti SIA sottocartelle, i documenti confluiscono in
 *    una cartella dedicata "Pratiche" (mai mescolati con le cartelle).
 */
function normalizzaMatrioska(nodo: SottoCategoriaModulistica): SottoCategoriaModulistica {
  const figli: SottoCategoriaModulistica[] = (nodo.sotto ?? []).map(normalizzaMatrioska);
  const documenti = nodo.documenti ?? [];

  // I documenti restano DIRETTAMENTE nella loro sottocartella (rese come cards):
  // l'albero rispecchia i dati, senza creare sottocartelle omonime inutili.
  // Se un nodo ha SIA documenti SIA sottocartelle, i documenti confluiscono in
  // una cartella dedicata "Pratiche" per non mescolare moduli e cartelle.
  if (documenti.length > 0 && figli.length > 0) {
    figli.push({
      id: `${nodo.id}-pratiche`,
      nome: 'Pratiche',
      descrizione: 'Moduli della pratica in questione.',
      documenti,
    });
    return { ...nodo, sotto: figli, documenti: [] };
  }
  return { ...nodo, sotto: figli, documenti };
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

