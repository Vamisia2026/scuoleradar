/**
 * ScuoleRadar.it — Dipartimento CFU · Fixture della valutazione V1 sul motore reale.
 *
 * Carriera di riferimento (A-11: 96 CFU nei settori citati dalla fonte) e
 * helper per ottenere le classi coperte dal registro condiviso.
 */
import { classiCoperteAttive, type ClasseCoperta } from '../calcolatore/classi';
import type { Esame } from '../shared/types';

/** Data della procedura usata nei casi di prova (ISO). */
export const DATA_PROCEDURA = '2026-03-01';

/** Carriera completa per A-11 (96 CFU nei settori citati dalla fonte). */
export const ESAMI_A11: Esame[] = [
  { id: 'e1', denominazione: 'Lingua e letteratura latina', cfu: 24, ssd: 'L-FIL-LET/04', fonte: 'manuale', affidabilita: 'alta' },
  { id: 'e2', denominazione: 'Letteratura greca', cfu: 12, ssd: 'L-FIL-LET/05', fonte: 'manuale', affidabilita: 'alta' },
  { id: 'e3', denominazione: 'Letteratura italiana', cfu: 12, ssd: 'L-FIL-LET/10', fonte: 'manuale', affidabilita: 'alta' },
  { id: 'e4', denominazione: 'Storia greca', cfu: 12, ssd: 'L-ANT/02', fonte: 'manuale', affidabilita: 'alta' },
  { id: 'e5', denominazione: 'Storia medievale', cfu: 24, ssd: 'M-STO/01', fonte: 'manuale', affidabilita: 'alta' },
  { id: 'e6', denominazione: 'Glottologia', cfu: 12, ssd: 'L-LIN/01', fonte: 'manuale', affidabilita: 'alta' },
];

/** Esame privo di settore dichiarato (l'utente ha risposto «non lo so»). */
export const ESAME_SENZA_SETTORE: Esame = {
  id: 'x1',
  denominazione: 'Esame senza settore',
  cfu: 6,
  ssd: null,
  fonte: 'manuale',
  affidabilita: 'media',
};

/** Carriera A-11 con un esame in più. */
export function esamiCon(extra: Esame): Esame[] {
  return [...ESAMI_A11, extra];
}

/** Carriera A-11 senza l'esame che copre la clausola L-ANT/02 o L-ANT/03. */
export function esamiSenzaClausolaAntica(extra?: Esame): Esame[] {
  const senzaAntica = ESAMI_A11.filter((esame) => esame.id !== 'e4');
  return extra ? [...senzaAntica, extra] : senzaAntica;
}

/** Classe coperta dal registro (errore esplicito se la copertura cambia). */
export function classeCoperta(codice: string): ClasseCoperta {
  const classe = classiCoperteAttive().find((voce) => voce.codice === codice);
  if (!classe) throw new Error(`Classe ${codice} non coperta: la prova non può proseguire.`);
  return classe;
}
