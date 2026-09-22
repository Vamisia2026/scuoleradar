/**
 * Modulistica · composizione degli stili del documento.
 *
 * Il CSS del documento stampabile era un unico template literal di ~590 righe
 * dentro `pdfGenerator.ts`: ora vive in quattro parti monotematiche.
 *
 * ATTENZIONE: le parti iniziano e finiscono con una riga vuota che fa parte del
 * CSS; il documento finale è `\n + parte1 + parte2 + … + \n`. Qualsiasi
 * riformattazione cambia l'HTML generato (i test `npm run test:pdf*` producono
 * gli stessi file byte per byte).
 */
import { STILI_BASE } from './stiliBase';
import { STILI_BLOCCHI } from './stiliBlocchi';
import { STILI_DENSITA } from './stiliDensita';
import { STILI_STAMPA } from './stiliStampa';

/** CSS completo del documento (tutte le parti, nell'ordine di stampa). */
export const STILI_DOCUMENTO = STILI_BASE + STILI_BLOCCHI + STILI_DENSITA + STILI_STAMPA + '\n';
