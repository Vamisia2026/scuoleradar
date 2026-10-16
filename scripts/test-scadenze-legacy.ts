/**
 * ScuoleRadar.it — GUARDIA della normalizzazione delle SCADENZE LEGACY.
 *
 * Il vecchio table-reporter scriveva la scadenza in `deadline` (text) con forme
 * MISTE; `scripts/lib/scadenzeLegacy.ts` le riporta in ISO e
 * `scripts/allinea-scadenze-interpelli.ts` riempie la colonna canonica. Questa
 * guardia blocca le regressioni sulle forme realmente MISURATE il 15/10/2026 nel
 * database di produzione (639 `YYYY-MM-DD`, 226 `YY-MM-DD`, 127 `D-M-YYYY`) e
 * sulle date impossibili: ciò che non si sa leggere deve restare NON
 * riconosciuto, perché nei dati pubblici un vuoto dichiarato è meglio di un falso.
 *
 * Uso: npm run test:scadenze
 * Exit: 0 = tutte le asserzioni passano · 1 = almeno una regressione.
 */
import {
  costruisciPiano,
  dataValida,
  normalizzaScadenza,
  righeDelPiano,
  type RigaScadenza,
} from './lib/scadenzeLegacy.ts';

let errori = 0;

function check(etichetta: string, atteso: unknown, ottenuto: unknown): void {
  const ok = atteso === ottenuto;
  if (!ok) errori += 1;
  console.log(`${ok ? '✓' : '✗'} ${etichetta} → ${JSON.stringify(ottenuto)}`);
  if (!ok) console.log(`    atteso: ${JSON.stringify(atteso)}`);
}

console.log('— Forme reali della colonna legacy —');
check('ISO 2026-09-30 (già canonica)', '2026-09-30', normalizzaScadenza('2026-09-30'));
check('troncata 26-09-30 = 2026-09-30', '2026-09-30', normalizzaScadenza('26-09-30'));
check('troncata 27-06-30 = 2027-06-30', '2027-06-30', normalizzaScadenza('27-06-30'));
check('giorno-prima 30/09/2026', '2026-09-30', normalizzaScadenza('30/09/2026'));
check('giorno-prima 24/9/2026 (una cifra)', '2026-09-24', normalizzaScadenza('24/9/2026'));
check('giorno-prima 21-09-2026', '2026-09-21', normalizzaScadenza('21-09-2026'));
check('giorno-prima 30.09.2026', '2026-09-30', normalizzaScadenza('30.09.2026'));
check('spazi ai bordi tollerati', '2026-09-30', normalizzaScadenza('  2026-09-30  '));

console.log('\n— Ciò che non si sa leggere resta intatto —');
check('vuoto → null', null, normalizzaScadenza(''));
check('assente → null', null, normalizzaScadenza(null));
check('31 febbraio → null', null, normalizzaScadenza('31/02/2026'));
check('ISO impossibile 2026-02-31 → null', null, normalizzaScadenza('2026-02-31'));
check('mese 13 → null', null, normalizzaScadenza('13/13/2026'));
check('testo libero → null', null, normalizzaScadenza('da definirsi'));
check('anno a 3 cifre → null', null, normalizzaScadenza('30/09/226'));
check('2026 non è bisestile: 29/02 → null', null, normalizzaScadenza('2026-02-29'));
check('2028 bisestile: 29/02 valido', '2028-02-29', normalizzaScadenza('2028-02-29'));
check('dataValida(2026, 2, 31) = false', false, dataValida(2026, 2, 31));
check('dataValida(2026, 2, 28) = true', true, dataValida(2026, 2, 28));

console.log('\n— Piano di riparazione —');
const righe: RigaScadenza[] = [
  { id: 'a', deadline: '2026-09-30', expiration_date: null },
  { id: 'b', deadline: '26-09-30', expiration_date: '2026-09-30T00:00:00+00:00' },
  { id: 'c', deadline: '2026-09-30', expiration_date: '2026-09-30T00:00:00+00:00' },
  { id: 'd', deadline: 'da definirsi', expiration_date: null },
  { id: 'e', deadline: '30/09/2026', expiration_date: null },
];
const piano = costruisciPiano(righe);
const conti = righeDelPiano(piano);
const idToccati = [...piano.daRiempire.values(), ...piano.daNormalizzare.values()].flat();

check('canonica nulla → da riempire', 2, conti.daRiempire);
check('solo testo legacy → da normalizzare', 1, conti.daNormalizzare);
check('non riconoscibili contate', 1, piano.scartate.length);
check('la riga già a posto NON si tocca', false, idToccati.includes('c'));
check('due riempimenti sotto la stessa data', 2, piano.daRiempire.get('2026-09-30')?.length);

if (errori > 0) {
  console.error(`\n✗ ${errori} asserzione/i fallita/e.`);
  process.exit(1);
}
console.log('\n✅ Scadenze legacy: normalizzazione conforme.');
