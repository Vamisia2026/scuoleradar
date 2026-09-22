/**
 * ScuoleRadar.it — PDF Generator (API pubblica del documento stampabile).
 *
 * Riferimento permanente: docs/PDF_DESIGN_SYSTEM.md
 *
 * Questo file è l'entry point stabile del generatore: l'implementazione vive
 * nei sotto-moduli di `./pdf/`.
 *  - `pdf/documento.ts`  → logo/footer ufficiali + `costruisciDocumento`;
 *  - `pdf/layout.ts`     → `calcolaLayout` (compatto/esteso), `stimaPagine`,
 *                          indice automatico (> 3 pagine);
 *  - `pdf/testo.ts`      → `escapeHtml` per i campi interpolati;
 *  - `pdf/stili*.ts`     → CSS del documento in quattro parti monotematiche.
 *
 * Contratto invariato per i consumatori (`cacheService`, `templatePrescrittivi`,
 * `ModuloPreview`, `scripts/test-pdf*.ts`).
 */
export {
  FOOTER_UFFICIALE_DOCUMENTO,
  LOGO_DOCUMENTO,
  costruisciDocumento,
  type DocumentoPronto,
} from './pdf/documento';
export { calcolaLayout, stimaPagine } from './pdf/layout';
export { escapeHtml } from './pdf/testo';
