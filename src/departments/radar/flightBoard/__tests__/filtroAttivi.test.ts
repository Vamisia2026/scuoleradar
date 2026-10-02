/**
 * ScuoleRadar.it — Dipartimento Radar · Flight Board: FILTRO di lettura della bacheca.
 *
 * `filtroAttivi` è la traduzione in sintassi PostgREST della regola di prodotto:
 * un avviso è in bacheca se la scadenza NON è ancora passata **oppure** se — senza
 * scadenza pubblicata — è stato creato negli ultimi 60 giorni. Qui si fissano:
 *
 *   1. la finestra di prodotto (60 giorni) e la sua soglia, calcolata per GIORNO
 *      di calendario e non "due mesi" (che sarebbero 59–62);
 *   2. la sintassi PostgREST dell'OR, con il ramo `is.null` per le righe che la
 *      fonte non data: è l'unico modo per non farle sparire in silenzio;
 *   3. la data LOCALE, mai UTC: alle 00:30 di Roma `toISOString()` darebbe ieri e
 *      gli avvisi che scadono oggi uscirebbero dal tabellone.
 *
 * Uso: npm run test:board:filtro  (incluso in `npm test`)
 */
import { GIORNI_FINESTRA_SENZA_SCADENZA } from '@/lib/liveBoard';
import { dataIsoLocale, dataLimiteFinestraSenzaScadenza, filtroAttivi } from '../filtroAttivi';

/** Interfaccia minima per l'ambiente (come gli altri test di prodotto). */
declare const process: { exitCode?: number };

let errori = 0;
function check(nome: string, atteso: unknown, ottenuto: unknown): void {
  const ok = JSON.stringify(atteso) === JSON.stringify(ottenuto);
  if (!ok) errori += 1;
  console.log(`${ok ? '✓' : '✗'} ${nome}: atteso=${JSON.stringify(atteso)} ottenuto=${JSON.stringify(ottenuto)}`);
}

/** Data fissa: 29 settembre 2026, ore 14:30 locali. Finestra dal 31 luglio 2026. */
const OGGI = new Date(2026, 8, 29, 14, 30);

console.log('— 1. Finestra di prodotto: 60 giorni, per giorno di calendario —');
check('finestra dichiarata: 60 giorni', 60, GIORNI_FINESTRA_SENZA_SCADENZA);
check('soglia dal 29/09/2026 = 31/07/2026', '2026-07-31', dataLimiteFinestraSenzaScadenza(OGGI));
check(
  'non è "due mesi" (marzo 31 → 31 giorni + 29 = 30 gennaio)',
  '2026-01-30',
  dataLimiteFinestraSenzaScadenza(new Date(2026, 2, 31, 9, 0)),
);

console.log('\n— 2. Sintassi PostgREST: scadenza futura OPPURE senza scadenza in finestra —');
const filtro = filtroAttivi(OGGI);
check(
  'espressione completa',
  'expiration_date.gte.2026-09-29,and(expiration_date.is.null,created_at.gte.2026-07-31)',
  filtro,
);
check('il ramo delle righe senza scadenza esiste (is.null)', true, filtro.includes('expiration_date.is.null'));
check('i due rami sono un OR: nessun `and(` di primo livello', true, filtro.includes(',and('));
check('la scadenza NON è filtrata con un `is.null` di esclusione', false, filtro.includes('not.is.null'));

console.log('\n— 3. Fuso orario: la data è quella di ROMA, non quella UTC —');
check('29/09/2026 ore 00:30 locali = 29/09, non il 28', '2026-09-29', dataIsoLocale(new Date('2026-09-29T00:30:00')));
check('ultimo minuto dell’anno', '2026-12-31', dataIsoLocale(new Date(2026, 11, 31, 23, 59)));
check('mese e giorno a due cifre', '2026-01-05', dataIsoLocale(new Date(2026, 0, 5, 8, 0)));
check(
  'la soglia segue la data locale anche a cavallo di mezzanotte',
  '2026-07-31',
  dataLimiteFinestraSenzaScadenza(new Date('2026-09-29T00:30:00')),
);

process.exitCode = errori === 0 ? 0 : 1;
console.log(
  errori === 0
    ? '\n✅ FILTRO RADAR LIVE: finestra 60 giorni e doppio ramo, nessun avviso perso in silenzio.'
    : `\n❌ FILTRO RADAR LIVE: ${errori} errore/i.`,
);
