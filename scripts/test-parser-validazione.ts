/**
 * TEST — VALIDAZIONE FONTI (anti-mock/anti-dummy)
 * -----------------------------------------------
 * Verifica che `eSorgenteVerificata` / `verificaAvviso` rifiutino URL e titoli
 * di test/mock/non ufficiali, e che i nomi scuola fittizi vengano sanificati.
 *
 * Esecuzione: npm run test:parser:validazione
 */

import { eSorgenteVerificata, parseInterpello, verificaAvviso } from '../src/scraper/parser.ts';

declare const process: { exitCode?: number };

let falliti = 0;
function check(descrizione: string, atteso: unknown, ottenuto: unknown): void {
  const ok = JSON.stringify(atteso) === JSON.stringify(ottenuto);
  if (!ok) {
    falliti += 1;
    console.log(`  ✗ ${descrizione}`);
    console.log(`      atteso:   ${JSON.stringify(atteso)}`);
    console.log(`      ottenuto: ${JSON.stringify(ottenuto)}`);
  } else {
    console.log(`  ✓ ${descrizione}`);
  }
}

console.log('──────────────────────────────────────────────────────────');
console.log('🧪 TEST VALIDAZIONE FONTI (anti-mock / anti-dummy)');
console.log('──────────────────────────────────────────────────────────');

console.log('\n— Sorgenti NON verificate (devono essere rifiutate) —');
check('mock "esempio"', false, eSorgenteVerificata('https://www.istruzione.it/interpelli/esempio-1'));
check('example.com', false, eSorgenteVerificata('https://example.com/interpello'));
check('localhost', false, eSorgenteVerificata('http://localhost:5173/avviso'));
check('127.0.0.1', false, eSorgenteVerificata('http://127.0.0.1/avviso'));
check('url "mock/"', false, eSorgenteVerificata('https://scuola.edu.it/mock/avviso'));
check('solo root del dominio', false, eSorgenteVerificata('https://www.mim.gov.it/'));
check('social (facebook)', false, eSorgenteVerificata('https://facebook.com/pagina/avviso'));
check('mailto', false, eSorgenteVerificata('mailto:segreteria@scuola.edu.it'));
check('stringa non-URL', false, eSorgenteVerificata('non-un-url'));

console.log('\n— Sorgenti ufficiali (devono essere accettate) —');
check('MIM (deep link)', true, eSorgenteVerificata('https://www.mim.gov.it/web/bergamo/-/interpelli-per-il-conferimento-di-supplenza'));
check('USP L\u2019Aquila (istanza ufficiale)', true, eSorgenteVerificata('https://lnx.csalaquila.it/wp/wp-content/uploads/avviso.pdf'));
check('USP su .gov.it', true, eSorgenteVerificata('https://fc.istruzioneer.gov.it/2026/09/09/interpello-ata/'));

console.log('\n— verificaAvviso —');
check('titolo corto', false, verificaAvviso({ title: 'A-22', link: 'https://www.mim.gov.it/a/b' }).ok);
check('titolo con "esempio"', false, verificaAvviso({ title: 'Interpello di esempio A-22', link: 'https://www.mim.gov.it/a/b' }).ok);
check('fonte mancante', false, verificaAvviso({ title: 'Interpello supplenza A-022', link: '' }).ok);
check('fonte mock', false, verificaAvviso({ title: 'Interpello supplenza A-022', link: 'https://example.com/x' }).ok);
check('avviso valido', true, verificaAvviso({ title: 'Interpello supplenza A-022 — Liceo', link: 'https://www.mim.gov.it/web/bergamo/-/interpello-x' }).ok);

console.log('\n— Sanificazione nomi scuola fittizi —');
const conVisualizza = parseInterpello({
  title: 'ADEE | EEEE — VISUALIZZA INTERPELLI',
  link: 'https://www.mim.gov.it/web/x/-/avviso-y',
  provincia: 'BG',
  source: 'test',
});
check('"VISUALIZZA INTERPELLI" → schoolName null', null, conVisualizza.schoolName);
const conSigla = parseInterpello({
  title: 'Interpello supplenza — EEEE',
  link: 'https://www.mim.gov.it/web/x/-/avviso-z',
  provincia: 'BG',
  source: 'test',
});
check('sigla "EEEE" → schoolName null', null, conSigla.schoolName);

console.log('\n──────────────────────────────────────────────────────────');
if (falliti === 0) {
  console.log('✅ VALIDAZIONE: tutti i controlli superati');
} else {
  console.log(`❌ VALIDAZIONE: ${falliti} controllo/i fallito/i`);
  process.exitCode = 1;
}
console.log('──────────────────────────────────────────────────────────');
