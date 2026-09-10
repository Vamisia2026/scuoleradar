import type { ObiettivoUtenteCfu } from '../shared/types';

/** Opzione dello Step A "Perché sei qui?" con il focus del calcolo. */
export interface OpzioneObiettivoCfu {
  chiave: ObiettivoUtenteCfu;
  etichetta: string;
  descrizione: string;
  /** Testo mostrato sotto la card come "Dove ci concentreremo". */
  focus: string;
}

export const OBIETTIVI_UTENTE: OpzioneObiettivoCfu[] = [
  {
    chiave: 'obiettivo',
    etichetta: 'Ho una classe obiettivo',
    descrizione: 'Verifica diretta per una classe di concorso specifica.',
    focus:
      'Verifica binaria (Idoneo / Non Idoneo) con conteggio esatto dei soli CFU e SSD mancanti per la classe scelta.',
  },
  {
    chiave: 'analisi',
    etichetta: 'Calcolo della laurea',
    descrizione: 'Panoramica completa di tutte le classi di concorso accessibili.',
    focus:
      "Scansione ad ampio spettro su tutto il piano di studi per elencare tutte le classi a cui il tuo titolo dà accesso immediato o con integrazioni.",
  },
  {
    chiave: 'concorso',
    etichetta: 'Preparazione concorso',
    descrizione: 'Verifica requisiti per la partecipazione ai bandi.',
    focus:
      "Controllo rigoroso sui decreti e le tabelle concorsuali vigenti prima dell'iscrizione.",
  },
  {
    chiave: 'chiarezza',
    etichetta: 'Voglio capire cosa ho e cosa mi manca',
    descrizione: 'Mappatura guidata della tua carriera universitaria.',
    focus:
      "Bilancio didattico dei CFU, SSD ed ECTS organizzato per macro-aree, per darti massima chiarezza sul tuo piano di studi.",
  },
];
