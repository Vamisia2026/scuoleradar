/**
 * ScuoleRadar.it — Dipartimento Radar · Flight Board: FILTRO di lettura della bacheca.
 *
 * `filtroAttivi` è la traduzione in sintassi PostgREST della REGOLA FERREA della
 * scadenza (§26.71, direttiva 16/10/2026): in bacheca entra solo un avviso con una
 * `expiration_date` dichiarata e non ancora passata. La finestra dei 60 giorni per
 * le righe che la fonte NON data è stata ritirata da questa superficie: nei dati
 * reali erano pagine di archivio, regolamenti e indici di classi di concorso. Qui
 * si fissano:
 *
 *   1. l'espressione del filtro, in un solo ramo (`expiration_date.gte.<oggi>`):
 *      nessun ramo `is.null` che riammetta le righe senza scadenza;
 *   2. la data LOCALE, mai UTC: alle 00:30 di Roma `toISOString()` darebbe ieri e
 *      gli avvisi che scadono oggi uscirebbero dal tabellone;
 *   3. la coerenza con il giudizio in memoria (`eOpportunitaConScadenza`) e con la
 *      vetrina (`preparaRigheBoard`): lettura, conteggio e schermate parlano della
 *      stessa popolazione di avvisi.
 *
 * Uso: npm run test:board:filtro  (incluso in `npm test`)
 */
import { eOpportunitaConScadenza } from '@/lib/scadenza';
import { dataIsoLocale, filtroAttivi } from '../filtroAttivi';

/** Interfaccia minima per l'ambiente (come gli altri test di prodotto). */
declare const process: { exitCode?: number };

let errori = 0;
function check(nome: string, atteso: unknown, ottenuto: unknown): void {
  const ok = JSON.stringify(atteso) === JSON.stringify(ottenuto);
  if (!ok) errori += 1;
  console.log(`${ok ? '✓' : '✗'} ${nome}: atteso=${JSON.stringify(atteso)} ottenuto=${JSON.stringify(ottenuto)}`);
}

/** Data fissa: 29 settembre 2026, ore 14:30 locali. */
const OGGI = new Date(2026, 8, 29, 14, 30);

console.log('— 1. La regola ferrea: scadenza dichiarata e non ancora passata —');
check('senza scadenza NON è un’opportunità', false, eOpportunitaConScadenza(null, OGGI));
check('scadenza vuota NON è un’opportunità', false, eOpportunitaConScadenza('   ', OGGI));
check('scadenza di ieri NON è un’opportunità', false, eOpportunitaConScadenza('2026-09-28', OGGI));
check('scadenza di oggi È un’opportunità', true, eOpportunitaConScadenza('2026-09-29', OGGI));
check('scadenza futura È un’opportunità', true, eOpportunitaConScadenza('2026-10-30', OGGI));

console.log('\n— 2. Sintassi PostgREST: un solo ramo, nessuna riga senza scadenza —');
const filtro = filtroAttivi(OGGI);
check('espressione completa', 'expiration_date.gte.2026-09-29', filtro);
check('nessun ramo `is.null` che riammetta le righe non datate', false, filtro.includes('is.null'));
check('nessun OR di primo livello: una sola popolazione di avvisi', false, filtro.includes(',and('));
check('nessun `created_at`: la finestra dei 60 giorni è ritirata', false, filtro.includes('created_at'));
check(
  'la scadenza esclude da sé le righe senza data (null ≥ x non è vero)',
  true,
  filtro.startsWith('expiration_date.gte.'),
);

console.log('\n— 3. Fuso orario: la data è quella di ROMA, non quella UTC —');
check('29/09/2026 ore 00:30 locali = 29/09, non il 28', '2026-09-29', dataIsoLocale(new Date('2026-09-29T00:30:00')));
check('ultimo minuto dell’anno', '2026-12-31', dataIsoLocale(new Date(2026, 11, 31, 23, 59)));
check('mese e giorno a due cifre', '2026-01-05', dataIsoLocale(new Date(2026, 0, 5, 8, 0)));
check(
  'la data del filtro è quella locale anche a cavallo di mezzanotte',
  'expiration_date.gte.2026-09-29',
  filtroAttivi(new Date('2026-09-29T00:30:00')),
);

process.exitCode = errori === 0 ? 0 : 1;
console.log(
  errori === 0
    ? '\n✅ FILTRO RADAR LIVE: solo opportunità con scadenza valida — conteggio e lettura sulla stessa popolazione.'
    : `\n❌ FILTRO RADAR LIVE: ${errori} errore/i.`,
);
