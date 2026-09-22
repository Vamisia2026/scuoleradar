/**
 * ScuoleRadar.it — Dipartimento CFU · Modello dati del dominio (isolato).
 *
 * Queste interfacce rappresentano il linguaggio del calcolatore: esami
 * universitari, settori scientifico-disciplinari (SSD), classi di concorso e
 * dossier finale. Nessun altro modulo dell'app importa direttamente da questo
 * file: l'accesso avviene solo tramite `src/departments/cfu/index.ts`.
 */

/** Ambiti disciplinari usati dalla matrice (denominazioni compatte). */
export type AmbitoDisciplinare =
  | 'antropo-psico-pedagogico'
  | 'linguistico-letterario'
  | 'matematico-informatico'
  | 'fisico'
  | 'scientifico-naturalistico'
  | 'giuridico-economico'
  | 'tecnico-pratico'
  | 'altro';

/** Denominazione leggibile di un ambito disciplinare. */
export const ETICHETTE_AMBITI: Record<AmbitoDisciplinare, string> = {
  'antropo-psico-pedagogico': 'Antropo-psico-pedagogico',
  'linguistico-letterario': 'Linguistico-letterario',
  'matematico-informatico': 'Matematico-informatico',
  fisico: 'Fisico',
  'scientifico-naturalistico': 'Scientifico-naturalistico',
  'giuridico-economico': 'Giuridico-economico',
  'tecnico-pratico': 'Tecnico-pratico',
  altro: 'Altro',
};

/** Settore Scientifico-Disciplinare (es. M-PED/01, L-LIN/12, MAT/05). */
export interface SSD {
  codice: string;
  denominazione: string;
  ambito: AmbitoDisciplinare;
}

/** Requisito CFU di una classe di concorso in un ambito disciplinare. */
export interface RequisitoAmbito {
  ambito: AmbitoDisciplinare;
  cfuRichiesti: number;
}

/**
 * Classe di concorso della scuola italiana (Tabelle A/B del D.P.R. 19/2016).
 * NB: nella fondazione del Dipartimento i requisiti sono DEMO/illustrativi;
 * il motore produttivo riceverà la matrice normativa ufficiale validata.
 */
export interface ClasseDiConcorso {
  codice: string;
  denominazione: string;
  tabella: 'A' | 'B';
  ordineScuola: 'secondaria-1-grado' | 'secondaria-2-grado';
  requisiti: RequisitoAmbito[];
  /** true = requisiti dimostrativi di avvio, da sostituire con la matrice ufficiale. */
  requisitiDemo: boolean;
}

/** Origine di un esame inserito nel calcolatore. */
export type FonteEsame = 'manuale' | 'testo-incollato' | 'documento';

/** Affidabilità del riconoscimento OCR/parsing di un singolo esame. */
export type AffidabilitaRiconoscimento = 'alta' | 'media' | 'bassa';

/** Esame universitario riconosciuto o inserito manualmente. */
export interface Esame {
  id: string;
  denominazione: string;
  /** CFU/ECTS maturati (es. 6, 9, 12). */
  cfu: number;
  /** SSD attribuito (es. "M-PED/01"); null = non riconosciuto. */
  ssd: string | null;
  /** Voto in trentesimi, quando disponibile (utile al calcolatore). */
  voto?: number | null;
  annoAccademico?: string | null;
  fonte: FonteEsame;
  affidabilita?: AffidabilitaRiconoscimento | null;
}

/** Copertura CFU rilevata per un singolo ambito disciplinare. */
export interface CoperturaAmbito {
  ambito: AmbitoDisciplinare;
  cfuPosseduti: number;
}

/** Esito dell'analisi per una singola classe di concorso. */
export interface EsitoClasse {
  classe: ClasseDiConcorso;
  coperture: CoperturaAmbito[];
  cfuMancanti: number;
  accessibile: boolean;
}

/**
 * Diagnosi strutturata restituita dal calcolatore dopo l'analisi (Step D):
 * punti di forza, classi accessibili e obiettivi secondari (con CFU mancanti).
 */
export interface DiagnosiCFU {
  esamiAnalizzati: Esame[];
  cfuTotali: number;
  cfuPerAmbito: CoperturaAmbito[];
  puntiDiForza: string[];
  classiAccessibili: EsitoClasse[];
  classiSecondarie: EsitoClasse[];
  dataAnalisi: string;
  notaMetodologica: string;
}
