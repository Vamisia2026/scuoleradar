/**
 * TEST — DATI STATICI DI FALLBACK UI (anti-mock / anti-segnaposto)
 * ---------------------------------------------------------------
 * Garantisce che i dati statici in `src/data/` non contengano URL segnaposto o
 * di prova: ogni URL presente deve superare `eSorgenteVerificata()` (la stessa
 * regola della pipeline di ingestione). Verifica inoltre che il feed di
 * fallback degli interpelli sia VUOTO: nessun avviso dimostrativo nella UI.
 *
 * Esecuzione: npm run test:dati-fallback
 */

import { readdirSync, readFileSync } from 'node:fs';
import { eSorgenteVerificata } from '../src/scraper/parser.ts';
import { interpelli } from '../src/data/interpelli.ts';

declare const process: { exitCode?: number };

let falliti = 0;
function check(descrizione: string, atteso: unknown, ottenuto: unknown): void {
  const ok = JSON.stringify(atteso) === JSON.stringify(ottenuto);
  if (!ok) {
    falliti += 1;
    console.log(`  ✗ ${descrizione}\n      atteso: ${JSON.stringify(atteso)}\n      ottenuto: ${JSON.stringify(ottenuto)}`);
  } else {
    console.log(`  ✓ ${descrizione}`);
  }
}

const CARTELLA_DATI = new URL('../src/data/', import.meta.url);
const RE_URL = /https?:\/\/[^\s"'`)\]<>]+/g;
/** Marcatori di URL fittizio/segnaposto (allineati alla pipeline). */
const RE_SEGNAPOSTO =
  /(esempio|example\.(com|org|net)|localhost|127\.0\.0\.1|0\.0\.0\.0|:5173|:3000|:8080|mockup|\bmock\b|\bsample\b|\bdummy\b|placeholder|\bfixture\b)/i;

const fileDati = readdirSync(CARTELLA_DATI).filter((f) => /\.(ts|json)$/i.test(f));

console.log('──────────────────────────────────────────────────────────');
console.log('🧪 TEST DATI DI FALLBACK (anti-mock / anti-segnaposto)');
console.log('──────────────────────────────────────────────────────────');

console.log('\n— Feed interpelli di fallback —');
check('è un array', true, Array.isArray(interpelli));
check('nessun interpello dimostrativo', 0, interpelli.length);

console.log('\n— URL presenti nei dati statici (src/data) —');
const urlTrovati: Array<{ file: string; url: string }> = [];
for (const file of fileDati) {
  const testo = readFileSync(new URL(file, CARTELLA_DATI), 'utf8');
  for (const url of testo.match(RE_URL) ?? []) urlTrovati.push({ file, url });
}
for (const { file, url } of urlTrovati) {
  check(`${file}: URL senza segnaposto (${url})`, false, RE_SEGNAPOSTO.test(url));
  check(`${file}: fonte verificata (${url})`, true, eSorgenteVerificata(url));
}
console.log(`  · ${urlTrovati.length} URL in ${fileDati.length} file di dati statici`);

console.log('\n— Parser: rifiuto dei segnaposto —');
check('"esempio-N" → rifiutato', false, eSorgenteVerificata('https://www.istruzione.it/interpelli/esempio-1'));
check('example.com → rifiutato', false, eSorgenteVerificata('https://example.com/interpello'));
check('localhost → rifiutato', false, eSorgenteVerificata('http://localhost:5173/avviso'));
check('deep-link ufficiale → accettato', true, eSorgenteVerificata('https://www.mim.gov.it/web/bergamo/-/interpelli-supplenza'));

console.log('\n──────────────────────────────────────────────────────────');
if (falliti === 0) {
  console.log('✅ DATI DI FALLBACK: tutti i controlli superati');
} else {
  console.log(`❌ DATI DI FALLBACK: ${falliti} controllo/i fallito/i`);
  process.exitCode = 1;
}
console.log('──────────────────────────────────────────────────────────');
