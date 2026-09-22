/**
 * Modulistica · tipi condivisi dell'intervista dell'Archivista Capo.
 *
 * Vivono qui e non nel hook perché li usano sia il motore dell'intervista sia i
 * sotto-componenti di presentazione: così le viste non dipendono dall'hook.
 */

/** Domanda corrente dell'intervista (testo, opzioni e id del passo). */
export interface DomandaCorrente {
  testo: string;
  opzioni: string[];
  passo: string;
}

/** Fasi del bancone dell'Archivista Capo. */
export type Fase = 'attesa' | 'domanda' | 'recupero' | 'pronto' | 'errore';
