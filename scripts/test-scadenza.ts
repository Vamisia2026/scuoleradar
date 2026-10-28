/**
 * TEST — Semaforo SCADENZA + filtro "attivo" (helper condiviso `src/lib/scadenza.ts`).
 * Esecuzione: npm run test:interpello-scadenza
 */

import {
  GIORNI_FINESTRA_SENZA_SCADENZA,
  eAvvisoVivo,
  eInterpelloAttivo,
  eScaduto,
  giorniRimanenti,
} from '../src/lib/scadenza.ts';
import { SOGLIA_ARANCIO, SOGLIA_ROSSO, eTermineProssimo, stileScadenza } from '../src/lib/scadenzaSemaforo.ts';

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

console.log('\n— eAvvisoVivo: finestra dei 60 giorni per chi non data la scadenza —');
check('finestra dichiarata: 60 giorni', 60, GIORNI_FINESTRA_SENZA_SCADENZA);
check('con scadenza futura → vivo', true, eAvvisoVivo('2026-09-30', null, OGGI));
check('con scadenza oggi → vivo', true, eAvvisoVivo('2026-09-10', null, OGGI));
check('con scadenza passata → NON vivo', false, eAvvisoVivo('2026-08-01', null, OGGI));
check(
  'con scadenza futura la pubblicazione non conta → vivo',
  true,
  eAvvisoVivo('2026-09-30', '2020-01-01', OGGI),
);
check('senza scadenza, pubblicato 10 giorni fa → vivo', true, eAvvisoVivo(null, '2026-08-31', OGGI));
check('senza scadenza, al limite (60 giorni) → vivo', true, eAvvisoVivo(null, '2026-07-12', OGGI));
check(
  'senza scadenza, 61 giorni fa → NON vivo (fuori finestra)',
  false,
  eAvvisoVivo(null, '2026-07-11', OGGI),
);
check(
  'la finestra è per GIORNO (pubblicato a fine giornata del limite → vivo)',
  true,
  eAvvisoVivo(null, '2026-07-12T23:30:00Z', OGGI),
);
check('senza scadenza né pubblicazione → NON vivo', false, eAvvisoVivo(null, null, OGGI));
check('pubblicazione illeggibile → NON vivo', false, eAvvisoVivo(null, 'non-una-data', OGGI));
check('senza scadenza e stringa vuota → NON vivo', false, eAvvisoVivo('', '', OGGI));

console.log('\n— Semaforo a TRE luci: rosso < 24h · arancio 24–72h · verde ≥ 3 gg (§26.89) —');
// Rosso = SOLO le prossime 24 ore. Giallo scuro = azione richiesta (24–72 ore).
// Verde = c'è tempo (3 … 15 giorni). Ardesia = nessun allarme: scaduto, data
// assente, data fuori finestra.
check('soglia rossa = solo oggi', 0, SOGLIA_ROSSO);
check('soglia arancio = 2 giorni (72 ore)', 2, SOGLIA_ARANCIO);
check('in corso (10gg) → verde', 'in-corso', stileScadenza(10).livello);
check('in corso (10gg) label', 'In corso', stileScadenza(10).label);
check('in corso (3gg) → verde: dal terzo giorno c’è tempo', 'in-corso', stileScadenza(3).livello);
check('in corso (3gg) label', 'In corso', stileScadenza(3).label);
check('bordo finestra (15gg) → verde', 'in-corso', stileScadenza(15).livello);
check('oltre la finestra (16gg) → dichiarata', 'fuori-finestra', stileScadenza(16).livello);
check('oltre la finestra label', 'Scadenza fuori finestra', stileScadenza(16).label);
check('2 giorni (48–72h) → arancio', 'urgente', stileScadenza(2).livello);
check('2 giorni (48–72h) label', 'Ultime 72h', stileScadenza(2).label);
check('domani (24–48h) → arancio', 'urgente', stileScadenza(1).livello);
check('domani (24–48h) label', 'Scade domani', stileScadenza(1).label);
check('oggi (< 24h) → ROSSO', 'critico', stileScadenza(0).livello);
check('oggi (< 24h) label', 'Scade oggi', stileScadenza(0).label);
check('scaduto → ardesia', 'scaduto', stileScadenza(-3).livello);
check('sconosciuto → n/d', 'sconosciuto', stileScadenza(null).livello);
check('verde usa la tinta piena emerald-700', true, stileScadenza(10).className.includes('bg-emerald-700'));
check('luce media: giallo oro pieno yellow-700 (§26.97)', true, stileScadenza(2).className.includes('bg-yellow-700'));
check('rosso usa la tinta piena rose-700 (solo a 0 giorni)', true, stileScadenza(0).className.includes('bg-rose-700'));
check('il rosso NON si estende a domani', false, stileScadenza(1).className === stileScadenza(0).className);
check('la luce media NON si estende al terzo giorno', false, stileScadenza(3).className === stileScadenza(2).className);
check(
  'nessun giallo chiaro o ambra sotto AA in nessuna banda',
  false,
  [10, 3, 2, 1, 0, 16, -3, null].some((g) =>
    /bg-(?:amber|yellow)-(?:50|100|200|300|400|500|600)\b/.test(
      stileScadenza(g as number | null).className,
    ),
  ),
);
check('nessuna banda pastello (…-100/…-200)', false, /-(?:50|100|200)\b/.test(stileScadenza(10).className + stileScadenza(2).className + stileScadenza(1).className));
check('senza scadenza → ardesia piena, non un colore d’allarme', true, stileScadenza(null).className.includes('bg-slate-600'));
check('scaduto → ardesia scura', true, stileScadenza(-3).className.includes('bg-slate-700'));
check('fuori finestra → ardesia, mai verde', true, stileScadenza(30).className.includes('bg-slate-600'));
check('nessuna banda pulsa', false, [10, 2, 1, 0, -3, null].some((g) => stileScadenza(g as number | null).className.includes('animate-')));
check('testo bianco in grassetto su TUTTE le bande', true, [10, 5, 3, 2, 1, 0, -3, null].every((g) => {
  const c = stileScadenza(g as number | null).className;
  return c.includes('text-white') && c.includes('font-bold');
}));
check('«In scadenza» acceso per rosso/arancio/scaduto', true, [0, 1, 2, -1].every((g) => eTermineProssimo(stileScadenza(g).livello)));
check('«In scadenza» spento per verde e ardesia', false, [3, 10, 30, 16].some((g) => eTermineProssimo(stileScadenza(g).livello)));

console.log('\n──────────────────────────────────────────────────────────');
if (falliti === 0) {
  console.log('✅ SCADENZA: tutti i controlli superati');
} else {
  console.log(`❌ SCADENZA: ${falliti} controllo/i fallito/i`);
  process.exitCode = 1;
}
console.log('──────────────────────────────────────────────────────────');
