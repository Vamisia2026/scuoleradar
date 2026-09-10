/**
 * ScuoleRadar.it — Dipartimento CFU · Matrice SSD (foundation).
 *
 * Catalogo iniziale dei Settori Scientifico-Disciplinari con il relativo ambito
 * disciplinare. È la "tavola di consultazione" del calcolatore: la versione
 * produttiva verrà estesa con l'intero elenco ministeriale e con la matrice
 * ufficiale delle classi di concorso (vedi `ClasseDiConcorso.requisitiDemo`).
 */

import type { AmbitoDisciplinare, SSD } from './types';

const ssd = (
  codice: string,
  denominazione: string,
  ambito: AmbitoDisciplinare,
): SSD => ({ codice, denominazione, ambito });

/** Catalogo SSD di avvio (settori chiave per il mondo scuola). */
export const SSD_CATALOGO: SSD[] = [
  // Area antropo-psico-pedagogica
  ssd('M-PED/01', 'Pedagogia generale e sociale', 'antropo-psico-pedagogico'),
  ssd('M-PED/02', 'Storia della pedagogia', 'antropo-psico-pedagogico'),
  ssd('M-PED/03', 'Didattica generale', 'antropo-psico-pedagogico'),
  ssd('M-PED/04', 'Pedagogia sperimentale', 'antropo-psico-pedagogico'),
  ssd('M-PSI/01', 'Psicologia generale', 'antropo-psico-pedagogico'),
  ssd('M-PSI/04', 'Psicologia dello sviluppo e dell’educazione', 'antropo-psico-pedagogico'),
  ssd('M-DEA/01', 'Discipline demoetnoantropologiche', 'antropo-psico-pedagogico'),
  // Area linguistico-letteraria
  ssd('L-LIN/01', 'Glottologia e linguistica', 'linguistico-letterario'),
  ssd('L-LIN/04', 'Lingua e traduzione — lingua francese', 'linguistico-letterario'),
  ssd('L-LIN/07', 'Lingua e traduzione — lingua spagnola', 'linguistico-letterario'),
  ssd('L-LIN/12', 'Lingua e traduzione — lingua inglese', 'linguistico-letterario'),
  ssd('L-FIL-LET/10', 'Letteratura italiana', 'linguistico-letterario'),
  ssd('L-FIL-LET/12', 'Linguistica italiana', 'linguistico-letterario'),
  // Area matematico-informatica
  ssd('MAT/02', 'Algebra', 'matematico-informatico'),
  ssd('MAT/03', 'Geometria', 'matematico-informatico'),
  ssd('MAT/05', 'Analisi matematica', 'matematico-informatico'),
  ssd('MAT/07', 'Fisica matematica', 'matematico-informatico'),
  ssd('INF/01', 'Informatica', 'matematico-informatico'),
  // Area fisica
  ssd('FIS/01', 'Fisica sperimentale', 'fisico'),
  ssd('FIS/02', 'Fisica teorica, modelli e metodi matematici', 'fisico'),
  ssd('FIS/03', 'Fisica della materia', 'fisico'),
  // Area scientifico-naturalistica
  ssd('CHIM/03', 'Chimica generale e inorganica', 'scientifico-naturalistico'),
  ssd('BIO/05', 'Biologia animale', 'scientifico-naturalistico'),
  ssd('BIO/10', 'Biochimica', 'scientifico-naturalistico'),
  ssd('GEO/04', 'Geografia fisica e geomorfologia', 'scientifico-naturalistico'),
  // Area giuridico-economica
  ssd('IUS/01', 'Diritto privato', 'giuridico-economico'),
  ssd('SECS-P/01', 'Economia politica', 'giuridico-economico'),
];

const INDICE_SSD = new Map<string, SSD>(
  SSD_CATALOGO.map((s) => [s.codice.toUpperCase(), s]),
);

/** Restituisce l'SSD dato il codice (senza distinzione maiuscole/spazi). */
export function ssdDaCodice(codice: string | null | undefined): SSD | null {
  if (!codice) return null;
  const chiave = codice.trim().toUpperCase().replace(/\s+/g, '');
  return INDICE_SSD.get(chiave) ?? null;
}

/** Nome esteso dell'SSD (o stringa vuota se sconosciuto). */
export function denominazioneSsd(codice: string | null | undefined): string {
  return ssdDaCodice(codice)?.denominazione ?? '';
}

/** Ambito disciplinare dell'SSD; 'altro' se il codice non è nel catalogo. */
export function ambitoDaCodiceSsd(codice: string | null | undefined): AmbitoDisciplinare {
  return ssdDaCodice(codice)?.ambito ?? 'altro';
}
