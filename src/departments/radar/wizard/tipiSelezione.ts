/**
 * Wizard Radar — tipi delle selezioni del PASSO 3 (classi di concorso,
 * competenze/laboratori extra e ricerca unificata).
 *
 * Vivono qui (e non nel componente) perché sono condivisi fra il contenitore
 * (`RadarWizardModal`), il compositore del passo (`PassoClassiMaterie`) e le due
 * sezioni estratte (`SezioneClassiConcorso`, `SezioneCompetenzeExtra`): un solo
 * contratto, nessun ciclo di import fra i componenti.
 */
import type { ClasseConcorso } from '@/data/classiConcorso';
import type { GruppiRicercaSelezioni, SuggerimentoSelezione } from '@/lib/ricercaSelezioniRadar';

/**
 * Stato e azioni della sezione «Classi di concorso» (+ adesione al sostegno).
 *
 * Non c'è più una ricerca separata per la materia: la colonna mostra le classi
 * filtrate dalla RICERCA UNIFICATA del passo (`classiFiltrate`).
 */
export interface SelezioneClassi {
  classiCodici: string[];
  /** Classi mostrate nella colonna (già filtrate dalla ricerca unificata). */
  classiFiltrate: ClasseConcorso[];
  classiWarning: boolean;
  maxClassiConcorso: number;
  toggleClasse: (codice: string) => void;
  /** Preferenza SOSTEGNO (adesione esplicita): vive con le classi, nel medesimo passo. */
  sostegno: boolean;
  toggleSostegno: (prossimo: boolean) => void;
}

/** Stato e azioni della sezione «Competenze e laboratori extra». */
export interface SelezioneMaterie {
  materieId: string[];
  /** Parole chiave libere dell'utente (tag personali). */
  materieCustom: string[];
  toggleMateria: (id: string) => void;
  aggiungiCompetenzaSuggerita: (id: string) => void;
  /** Aggiunge un tag libero (usato anche dalla ricerca unificata). */
  aggiungiParolaChiave: (testo: string) => void;
  removeCustomMateria: (materia: string) => void;
}

/**
 * Campo di RICERCA UNIFICATA del passo: un solo input per entrambe le colonne
 * (classi + competenze + parole chiave). Stato e azioni arrivano dal contenitore,
 * il motore di ricerca dal modulo puro `lib/ricercaSelezioniRadar`.
 */
export interface RicercaSelezioniStato {
  query: string;
  setQuery: (valore: string) => void;
  gruppi: GruppiRicercaSelezioni;
  /** Applica un risultato: classe → la seleziona, competenza → la aggiunge. */
  onScegli: (suggerimento: SuggerimentoSelezione) => void;
  /** Aggiunge la parola digitata ai tag personali. */
  onParolaChiave: (testo: string) => void;
}
