/**
 * ScuoleRadar.it — GUARDIA del CONTO ALLA ROVESCIA delle vacanze (§26.98).
 * -----------------------------------------------------------------------------------
 * PERCHÉ ESISTE. Il numero mostrato sotto il widget Scadenze era rimasto fermo
 * a «56 giorni» per giorni: un valore calcolato e poi congelato. La regola ora è
 * una sola — il 23 dicembre dell'anno scolastico in corso — e il conteggio si
 * ricalcola a ogni lettura dell'orologio. Qui si verifica che:
 *   1. ogni giorno che passa il numero diminuisca di UNO (mai fermo, mai a salti);
 *   2. la data d'arrivo sia dichiarata e sia il 23 dicembre dell'anno scolastico;
 *   3. i confini (estate, 23 dicembre, Pasqua, 30 giugno) non lascino buchi;
 *   4. i cambi di ora legale non spostino il conto di un giorno.
 *
 * Uso: npm run test:vacanze (incluso in `npm test`)
 */
import process from 'node:process';
import {
  GIORNO_INIZIO_VACANZE_NATALE,
  annoScolasticoCorrente,
  dataLungaIt,
  dataPasqua,
  inizioVacanzeNatale,
  prossimeVacanze,
} from '../vacanzeScolastiche.ts';

let errori = 0;
function check(nome: string, atteso: unknown, ottenuto: unknown): void {
  const ok = JSON.stringify(atteso) === JSON.stringify(ottenuto);
  if (!ok) errori += 1;
  console.log(`${ok ? '✓' : '✗'} ${nome}: atteso=${JSON.stringify(atteso)} ottenuto=${JSON.stringify(ottenuto)}`);
}

/** Giorno locale a mezzanotte (stessa unità di misura del modulo). */
const giorno = (anno: number, mese: number, giornoDelMese: number): Date =>
  new Date(anno, mese - 1, giornoDelMese);

console.log('— 1. L’ancora è il 23 dicembre dell’anno scolastico —');
check('giorno d’inizio delle vacanze di Natale', 23, GIORNO_INIZIO_VACANZE_NATALE);
check(
  'inizio vacanze 2026/2027 → 23 dicembre 2026',
  '2026-12-23',
  inizioVacanzeNatale(2026).toISOString().slice(0, 10),
);
check('anno scolastico a settembre = anno solare', 2026, annoScolasticoCorrente(giorno(2026, 9, 15)));
check('anno scolastico a gennaio = anno precedente', 2026, annoScolasticoCorrente(giorno(2027, 1, 10)));
check('anno scolastico a giugno = anno precedente', 2027, annoScolasticoCorrente(giorno(2028, 6, 10)));

console.log('— 2. Il numero è DINAMICO: un giorno in meno ogni giorno (ottobre 2026) —');
const oggi = giorno(2026, 10, 26);
const conto = prossimeVacanze(oggi);
check('26/10/2026 → 58 giorni', 58, conto.giorni);
check('26/10/2026 → vacanze di Natale', 'vacanze di Natale', conto.nome);
check('26/10/2026 → data dichiarata (23 dicembre 2026)', '2026-12-23', conto.dataTarget);
check('26/10/2026 → anno scolastico 2026', 2026, conto.annoScolastico);
check('non è estate', false, conto.estate);
// Il difetto segnalato: «56 giorni» fermo. Con l'orologio vero il numero cambia.
const domani = prossimeVacanze(giorno(2026, 10, 27));
check('27/10/2026 → 57 (un giorno in meno, non lo stesso numero)', 57, domani.giorni);
check('28/10/2026 → 56 (il valore che restava congelato)', 56, prossimeVacanze(giorno(2026, 10, 28)).giorni);

console.log('\n— 3. Nessun salto: dal 1 settembre al 22 dicembre —');
check('1 settembre 2026 → 113 giorni', 113, prossimeVacanze(giorno(2026, 9, 1)).giorni);
let anomalie: string[] = [];
let atteso = prossimeVacanze(giorno(2026, 9, 1)).giorni;
for (let d = 2; d <= 30; d += 1) {
  atteso -= 1;
  const corrente = prossimeVacanze(giorno(2026, 9, d)).giorni;
  if (corrente !== atteso) anomalie.push(`${d}/09: ${corrente} ≠ ${atteso}`);
}
check('settembre: −1 giorno esatto ogni giorno', [], anomalie);
anomalie = [];
atteso = prossimeVacanze(giorno(2026, 10, 1)).giorni;
for (let d = 2; d <= 31; d += 1) {
  atteso -= 1;
  const corrente = prossimeVacanze(giorno(2026, 10, d)).giorni;
  if (corrente !== atteso) anomalie.push(`${d}/10: ${corrente} ≠ ${atteso}`);
}
check('ottobre (cambio ora legale il 25): −1 giorno esatto ogni giorno', [], anomalie);
anomalie = [];
atteso = prossimeVacanze(giorno(2026, 11, 1)).giorni;
for (let d = 2; d <= 30; d += 1) {
  atteso -= 1;
  const corrente = prossimeVacanze(giorno(2026, 11, d)).giorni;
  if (corrente !== atteso) anomalie.push(`${d}/11: ${corrente} ≠ ${atteso}`);
}
check('novembre: −1 giorno esatto ogni giorno', [], anomalie);
anomalie = [];
atteso = prossimeVacanze(giorno(2026, 12, 1)).giorni;
for (let d = 2; d <= 22; d += 1) {
  atteso -= 1;
  const corrente = prossimeVacanze(giorno(2026, 12, d));
  if (corrente.giorni !== atteso) anomalie.push(`${d}/12: ${corrente.giorni} ≠ ${atteso}`);
  if (corrente.nome !== 'vacanze di Natale' || corrente.dataTarget !== '2026-12-23') {
    anomalie.push(`${d}/12: ${corrente.nome} → ${corrente.dataTarget}`);
  }
}
check('dicembre (fino al 22): sempre Natale del 23/12/2026, −1 al giorno', [], anomalie);
check('22 dicembre 2026 → 1 giorno', 1, prossimeVacanze(giorno(2026, 12, 22)).giorni);

console.log('\n— 4. Confini: estate, 23 dicembre, Pasqua, 30 giugno —');
const pasqua2027 = dataPasqua(2027);
check('Pasqua 2027 = 28 marzo', '2027-03-28', pasqua2027.toISOString().slice(0, 10));
const nataleFinito = prossimeVacanze(giorno(2026, 12, 23));
check('23 dicembre 2026 → si conta già Pasqua', 'vacanze di Pasqua', nataleFinito.nome);
check('23 dicembre 2026 → data 28 marzo 2027', '2027-03-28', nataleFinito.dataTarget);
check('23 dicembre 2026 → 95 giorni', 95, nataleFinito.giorni);
check('5 gennaio 2027 → Pasqua (non il Natale dell’anno dopo)', '2027-03-28', prossimeVacanze(giorno(2027, 1, 5)).dataTarget);
check('5 gennaio 2027 → 82 giorni', 82, prossimeVacanze(giorno(2027, 1, 5)).giorni);

const dopoPasqua = prossimeVacanze(giorno(2027, 5, 1));
check('1 maggio 2027 → vacanze estive', 'vacanze estive', dopoPasqua.nome);
check('1 maggio 2027 → 30 giugno 2027', '2027-06-30', dopoPasqua.dataTarget);
check('1 maggio 2027 → 60 giorni', 60, dopoPasqua.giorni);

for (const [mese, d] of [[6, 30], [7, 15], [8, 31]] as Array<[number, number]>) {
  const estate = prossimeVacanze(giorno(2026, mese, d));
  check(`${d}/${mese} → conteggio nascosto`, true, estate.estate);
  check(`${d}/${mese} → nessuna data dichiarata`, null, estate.dataTarget);
}
check('1 settembre 2026 → Natale (non più estate)', false, prossimeVacanze(giorno(2026, 9, 1)).estate);

console.log('\n— 5. Data leggibile del tooltip —');
check('data ISO → «23 dicembre 2026»', '23 dicembre 2026', dataLungaIt('2026-12-23'));
check('data assente → stringa vuota (nessun segnaposto)', '', dataLungaIt(null));
check('data illeggibile → stringa vuota', '', dataLungaIt('23/12/2026'));
check('mese fuori scala → stringa vuota', '', dataLungaIt('2026-13-23'));

console.log('\n— 6. Purezza: due letture identiche danno lo stesso numero —');
const a = prossimeVacanze(giorno(2026, 10, 26));
const b = prossimeVacanze(giorno(2026, 10, 26));
check('stessa data → stesso esito (nessuno stato interno)', JSON.stringify(a), JSON.stringify(b));

console.log('\n──────────────────────────────────────────────────────────');
if (errori > 0) {
  console.log(`❌ VACANZE: ${errori} verifiche fallite`);
  process.exitCode = 1;
} else {
  console.log('✅ VACANZE: conto alla rovescia dinamico, ancorato al 23 dicembre dell’anno scolastico.');
}


