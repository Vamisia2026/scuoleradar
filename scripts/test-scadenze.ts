/**
 * TEST — Deadlines Engine (ScuoleRadar).
 * Esecuzione: npm run test:scadenze  (dalla cartella project/)
 *
 * Verifica i comportamenti chiave del motore:
 *   · coda sempre di 10 elementi, ordine cronologico, nessun item scaduto;
 *   · visibilità fino alle 23:59:59.999 e decadenza alla mezzanotte;
 *   · rollover annuale delle date relative "MM-DD" nell'anno scolastico;
 *   · supporto alle date assolute "YYYY-MM-DD" (esatta e finestra).
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  codaScadenze,
  prossimaOccorrenza,
  faseOperativa,
  giorniCalendarioTra,
} from '../src/departments/scadenze/engine.ts';
import type { DeadlineRecord } from '../src/departments/scadenze/types.ts';

const fallback = JSON.parse(
  readFileSync(
    fileURLToPath(new URL('../src/data/deadlinesFallback.json', import.meta.url)),
    'utf8',
  ),
) as DeadlineRecord[];

let falliti = 0;

function check(nome: string, condizione: boolean, dettaglio = ''): void {
  if (condizione) {
    console.log(`  ✓ ${nome}`);
  } else {
    falliti += 1;
    console.error(`  ✗ ${nome}${dettaglio ? ` — ${dettaglio}` : ''}`);
  }
}

const oggi = (a: number, m: number, g: number, h = 10): Date =>
  new Date(a, m - 1, g, h, 0, 0, 0);

/* 1 — Queue Limit: coda di 10 elementi, ordine cronologico, nessuno scaduto. */
{
  console.log('\n1) Coda 10 scadenze (20 set 2026):');
  const coda = codaScadenze(fallback, oggi(2026, 9, 20));
  check('lunghezza coda = 10', coda.length === 10, `trovate ${coda.length}`);
  check(
    'primo item = uni-04 (iscrizioni master, apre il 1 set)',
    coda[0]?.record.id === 'uni-04',
    coda[0]?.record.id,
  );
  check(
    'secondo item = did-03 (finestra attiva dal 15 set)',
    coda[1]?.record.id === 'did-03',
    coda[1]?.record.id,
  );
  const ordinate = coda.every(
    (s, i) => i === 0 || coda[i - 1].inizio.getTime() <= s.inizio.getTime(),
  );
  check('ordine cronologico crescente per inizio', ordinate);
  check(
    'nessun item con scadenza passata',
    coda.every((s) => s.giorniAllaScadenza >= 0),
  );
}

/* 2 — Visibilità: attivo fino alle 23:59:59.999 del giorno esatto, poi rollover. */
{
  console.log('\n2) Visibilità/decadenza (did-02, data esatta 09-30):');
  const did02 = fallback.find((r) => r.id === 'did-02');
  if (!did02) throw new Error('record did-02 assente dal fallback');
  const inData = prossimaOccorrenza(did02, oggi(2026, 9, 30, 12));
  check(
    'il 30 set resta attivo fino alle 23:59:59.999',
    !!inData && inData.scadenza.getHours() === 23 && inData.scadenza.getMinutes() === 59,
  );
  const dopo = prossimaOccorrenza(did02, oggi(2026, 10, 1, 0, 1));
  check(
    'il 1 ott rollover al ciclo successivo → 2027-09-30',
    !!dopo && dopo.scadenza.getFullYear() === 2027 && dopo.scadenza.getMonth() === 8,
    dopo?.scadenza.toISOString(),
  );
}

/* 3 — Rollover annuale di una finestra già conclusa (lav-08: 03-25 → 04-10). */
{
  console.log('\n3) Rollover annuale finestra (lav-08, oggi 21 mag 2027):');
  const lav08 = fallback.find((r) => r.id === 'lav-08');
  if (!lav08) throw new Error('record lav-08 assente dal fallback');
  const occ = prossimaOccorrenza(lav08, oggi(2027, 5, 21));
  check(
    'finestra 2027 conclusa → prossima ricorrenza marzo 2028',
    !!occ && occ.inizio.getFullYear() === 2028 && occ.inizio.getMonth() === 2,
    occ?.inizio.toISOString(),
  );
}

/* 4 — Exact annuale agostana: fis-10 (08-31) già trascorsa. */
{
  console.log('\n4) Exact annuale agostana (fis-10, oggi 1 ott 2026):');
  const fis10 = fallback.find((r) => r.id === 'fis-10');
  if (!fis10) throw new Error('record fis-10 assente dal fallback');
  const occ = prossimaOccorrenza(fis10, oggi(2026, 10, 1));
  check(
    'rollover → 2027-08-31',
    !!occ && occ.scadenza.getFullYear() === 2027 && occ.scadenza.getMonth() === 7,
    occ?.scadenza.toISOString(),
  );
}

/* 5 — Date assolute "YYYY-MM-DD": valide fino al termine, poi niente rollover. */
{
  console.log('\n5) Date assolute (esatta e finestra):');
  const assoluta: DeadlineRecord = {
    id: 'test-ass',
    category: 'Test',
    title: 'Evento unico',
    type: 'exact',
    date: '2026-05-20',
  };
  check(
    'esatta: il 19 mag 2026 è programmata',
    prossimaOccorrenza(assoluta, oggi(2026, 5, 19)) !== null,
  );
  check(
    'esatta: il 21 mag 2026 è scaduta (niente rollover automatico)',
    prossimaOccorrenza(assoluta, oggi(2026, 5, 21)) === null,
  );

  const finestra: DeadlineRecord = {
    id: 'test-fin',
    category: 'Test',
    title: 'Finestra unica',
    type: 'window',
    startDate: '2026-04-15',
    endDate: '2026-04-30',
  };
  check(
    'finestra: dentro i limiti è attiva',
    prossimaOccorrenza(finestra, oggi(2026, 4, 20)) !== null,
  );
  check(
    'finestra: dopo l’endDate decade senza rollover',
    prossimaOccorrenza(finestra, oggi(2026, 5, 1)) === null,
  );
}

/* 6 — Fase operativa con fallback editoriale. */
{
  console.log('\n6) Fase operativa:');
  check(
    'record con phase → ritorna la fase',
    faseOperativa({
      id: 'x',
      category: 'C',
      title: 'T',
      type: 'window',
      phase: 'Somministrazione prove CBT',
    }) === 'Somministrazione prove CBT',
  );
  check(
    'window senza phase → "Finestra operativa"',
    faseOperativa({
      id: 'x',
      category: 'C',
      title: 'T',
      type: 'window',
    }) === 'Finestra operativa',
  );
  check(
    'exact senza phase → "Termine ultimo"',
    faseOperativa({
      id: 'x',
      category: 'C',
      title: 'T',
      type: 'exact',
    }) === 'Termine ultimo',
  );
}

/* 7 — Limite personalizzato e giorni residui. */
{
  console.log('\n7) Limite personalizzato + giorni residui (15 dic 2026):');
  const coda = codaScadenze(fallback, oggi(2026, 12, 15), 5);
  check('limite 5 rispettato', coda.length === 5, `trovate ${coda.length}`);
  const oggiT = oggi(2026, 12, 15);
  const inCoda = coda.every((s) => giorniCalendarioTra(oggiT, s.scadenza) >= 0);
  check('giorni residui sempre >= 0', inCoda);
}

/* Riepilogo. */
console.log(
  falliti === 0
    ? '\n✅ TUTTI I TEST SUPERATI'
    : `\n❌ ${falliti} test falliti`,
);
process.exitCode = falliti === 0 ? 0 : 1;
