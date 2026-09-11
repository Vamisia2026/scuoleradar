/**
 * TEST — Semaforo SCADENZA + filtro "attivo" (helper condiviso `src/lib/scadenza.ts`).
 * Esecuzione: npm run test:interpello-scadenza
 */

import {
  eInterpelloAttivo,
  eScaduto,
  giorniRimanenti,
  stileScadenza,
} from '../src/lib/scadenza.ts';

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

// OGGI fisso per test deterministici: 2026-09-10.
const OGGI = new Date('2026-09-10T12:00:00');

console.log('──────────────────────────────────────────────────────────');
console.log('🧪 TEST SCADENZA (giorni, semaforo, filtro attivo)');
console.log('──────────────────────────────────────────────────────────');

console.log('\n— giorniRimanenti —');
check('oggi → 0', 0, giorniRimanenti('2026-09-10', OGGI));
check('domani → 1', 1, giorniRimanenti('2026-09-11', OGGI));
check('tra 10 giorni → 10', 10, giorniRimanenti('2026-09-20', OGGI));
check('ieri → -1', -1, giorniRimanenti('2026-09-09', OGGI));
check('ISO con orario', 2, giorniRimanenti('2026-09-12T23:00:00+00:00', OGGI));
check('assente → null', null, giorniRimanenti(null, OGGI));
check('invalida → null', null, giorniRimanenti('non-una-data', OGGI));

console.log('\n— eScaduto / eInterpelloAttivo —');
check('scaduto ieri → true', true, eScaduto('2026-09-09', OGGI));
check('oggi → false (non scaduto)', false, eScaduto('2026-09-10', OGGI));
check('futuro → false', false, eScaduto('2026-09-30', OGGI));
check('attivo: futuro → true', true, eInterpelloAttivo('2026-09-30', OGGI));
check('attivo: oggi → true', true, eInterpelloAttivo('2026-09-10', OGGI));
check('attivo: scaduto → false', false, eInterpelloAttivo('2026-08-01', OGGI));
check('attivo: senza data → true', true, eInterpelloAttivo(null, OGGI));

console.log('\n— Semaforo (colori) —');
check('lungo (10gg) → verde', 'lungo', stileScadenza(10).livello);
check('lungo (10gg) label', 'In corso', stileScadenza(10).label);
check('vicino (5gg) → giallo', 'vicino', stileScadenza(5).livello);
check('vicino (5gg) label', 'Tra 5 giorni', stileScadenza(5).label);
check('imminente (2gg) → rosso', 'imminente', stileScadenza(2).livello);
check('imminente (2gg) label', 'Ultimi 2 giorni', stileScadenza(2).label);
check('oggi (0gg) label', 'Scade oggi', stileScadenza(0).label);
check('scaduto → grigio', 'scaduto', stileScadenza(-3).livello);
check('sconosciuto → n/d', 'sconosciuto', stileScadenza(null).livello);
check('verde usa classe emerald', true, stileScadenza(10).className.includes('emerald'));
check('giallo usa classe amber', true, stileScadenza(5).className.includes('amber'));
check('rosso usa classe red', true, stileScadenza(1).className.includes('red'));

console.log('\n──────────────────────────────────────────────────────────');
if (falliti === 0) {
  console.log('✅ SCADENZA: tutti i controlli superati');
} else {
  console.log(`❌ SCADENZA: ${falliti} controllo/i fallito/i`);
  process.exitCode = 1;
}
console.log('──────────────────────────────────────────────────────────');
