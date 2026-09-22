/**
 * Modulistica · escape dei testi interpolati nell'HTML del documento.
 *
 * Estratto da `pdfGenerator.ts`. Usato dall'interpolazione del titolo, dalle
 * voci dell'indice e da `cacheService`/`templatePrescrittivi` per i campi
 * compilati dall'utente (profilo, anagrafica istituto).
 */

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
