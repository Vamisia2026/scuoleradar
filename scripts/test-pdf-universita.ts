/**
 * TEST GENERAZIONE PDF — Moduli Università (motore locale reale)
 * --------------------------------------------------------------------------
 * Genera i 9 nuovi template universitari direttamente dal motore
 * (`creaDocumentoLocale` + `costruisciDocumento`), verificando che ogni
 * modulo resti su 1 pagina A4 con il BLOCCO FIRME UNIFICATO (Single Sign Box).
 *
 * Esecuzione:
 *   npm run test:pdf:universita
 * Poi apri `scripts/out/test-universita-*.html` nel browser e stampa
 * con "Salva come PDF".
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { creaDocumentoLocale } from '../src/modules/modulistica/creator/cacheService.ts';
import { costruisciDocumento } from '../src/modules/modulistica/creator/pdfGenerator.ts';

const casi = [
  { tipo: 'borsa_studio', file: 'test-universita-borsa.html' },
  { tipo: 'ricorso_borsa', file: 'test-universita-ricorso-borsa.html' },
  { tipo: 'isee_universita', file: 'test-universita-isee.html' },
  { tipo: 'riduzione_contributi', file: 'test-universita-riduzione.html' },
  { tipo: 'contributo_straordinario', file: 'test-universita-contributo.html' },
  { tipo: 'integrativo_erasmus', file: 'test-universita-erasmus.html' },
  { tipo: 'collaborazioni_studentesche', file: 'test-universita-collaborazioni.html' },
  { tipo: 'esenzione_tasse', file: 'test-universita-esenzione.html' },
  { tipo: 'laurea', file: 'test-universita-laurea.html' },
];

const outDir = fileURLToPath(new URL('./out/', import.meta.url));
mkdirSync(outDir, { recursive: true });

let ok = 0;
for (const c of casi) {
  const doc = creaDocumentoLocale('modulo università', { tipo: c.tipo, ordine: 'universita' });
  const pronto = costruisciDocumento(doc.title, doc.content_html);
  const outFile = `${outDir}${c.file}`;
  writeFileSync(outFile, pronto.html, 'utf8');
  const unico = (pronto.html.match(/class="blocco-convalida-unico"/g) ?? []).length === 1;
  const paginaUnica = pronto.layout === 'compatto' && pronto.pagineStimate === 1;
  if (paginaUnica && unico) ok++;
  console.log(
    `${c.tipo.padEnd(28)} | layout: ${pronto.layout.padEnd(9)} | pagine: ${pronto.pagineStimate} | blocco unico: ${unico ? 'OK' : 'NO'} | ${outFile}`,
  );
}
console.log(`Risultato: ${ok}/${casi.length} moduli universitari su 1 pagina A4 con blocco firme unico.`);
