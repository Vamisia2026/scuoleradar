/**
 * ScuoleRadar.it — Dipartimento Radar · metriche del «Radar Live» (homepage).
 *
 * La vetrina della bacheca non deve mai far sembrare la banca dati un mock vuoto:
 * le etichette delle pagine e degli avvisi attivi si calcolano su numeri REALI.
 * Qui si fissano le regole di quella traduzione (`flightBoard/metricaBoard.ts`):
 *
 *   1. le pagine mostrate sono quelle delle righe DAVVERO in tabellone: nessun
 *      tetto di lettura da esibire (la bacheca legge a pagine TUTTI gli avvisi
 *      attivi — vedi `letturaBoard.test.ts`). Il `+` compare solo quando il
 *      database ha più avvisi attivi di quelli letti (`Pagina 7 di 150+`);
 *   2. conteggio esatto formattato `it-IT` (`3.412 avvisi attivi in Italia`),
 *      singolare compreso;
 *   3. quando il conteggio NON arriva si dichiara solo la scala caricata, senza
 *      attribuirla all'Italia intera (`30 avvisi in bacheca`): mai un numero che
 *      dica più di quanto sappiamo;
 *   4. robustezza: zero righe, righe/pagina non valide e pagina fuori scala non
 *      producono etichette rotte.
 *
 * Uso: npm run test:board:metriche  (incluso in `npm test`)
 */
import {
  etichettaPagina,
  etichettaTotaleAvvisi,
  metricaBoard,
  pagineBoard,
} from '../metricaBoard';

/** Interfaccia minima per l'ambiente (come gli altri test di prodotto). */
declare const process: { exitCode?: number };

let errori = 0;
function check(nome: string, atteso: unknown, ottenuto: unknown): void {
  const ok = JSON.stringify(atteso) === JSON.stringify(ottenuto);
  if (!ok) errori += 1;
  console.log(`${ok ? '✓' : '✗'} ${nome}: atteso=${JSON.stringify(atteso)} ottenuto=${JSON.stringify(ottenuto)}`);
}

console.log('— 1. Pagine sulle righe presenti (nessun tetto da esibire) —');
check('1.000 avvisi in tabellone = 200 pagine da 5 righe', 200, pagineBoard(1_000, 5));
const pieno = metricaBoard({ righeCaricate: 750, totaleReale: 3412, righePerPagina: 5, pagina: 7 });
check('150 pagine oltre il limite: «150+»', true, pieno.oltreIlLimite);
check(
  'etichetta di pagina con il `+`',
  'Pagina 7 di 150+ - Aggiornamento automatico',
  pieno.etichettaPagine,
);
check('totale reale in migliaia, formattato it-IT', '3.412 avvisi attivi in Italia', pieno.etichettaTotale);
check('totale minore del caricato: nessun `+`', false, metricaBoard({ righeCaricate: 40, totaleReale: 40, righePerPagina: 5 }).oltreIlLimite);
check(
  'etichetta senza `+` quando il tabellone copre tutto',
  'Pagina 1 di 8 - Aggiornamento automatico',
  metricaBoard({ righeCaricate: 40, totaleReale: 40, righePerPagina: 5 }).etichettaPagine,
);
/**
 * Scala REALE misurata sulla banca dati (28/09/2026): 61 avvisi attivi con
 * scadenza non passata, 17 dei quali presentabili in tabellone (gli altri sono
 * avvisi senza scuola identificabile). L'etichetta deve parlare di 4 pagine (le
 * righe che ci sono) e il `+` deve ricordare che il database ne ha altre: mai un
 * «150 pagine» che non esiste nei dati.
 */
const reale = metricaBoard({ righeCaricate: 17, totaleReale: 61, righePerPagina: 5 });
check('scala reale: 17 righe in bacheca = 4 pagine', 4, reale.pagine);
check(
  'etichetta sulle righe presenti, con `+` perché il DB ne ha altre',
  'Pagina 1 di 4+ - Aggiornamento automatico',
  reale.etichettaPagine,
);
check('conteggio esatto mostrato così com’è', '61 avvisi attivi in Italia', reale.etichettaTotale);

console.log('\n— 2. Contatore degli avvisi attivi: singolare, plurale, formattazione —');
check('singolare', '1 avviso attivo in Italia', etichettaTotaleAvvisi(1, 1));
check('plurale senza separatore sotto le mille', '750 avvisi attivi in Italia', etichettaTotaleAvvisi(750, 750));
check('plurale con separatore migliaia', '2.480 avvisi attivi in Italia', etichettaTotaleAvvisi(2480, 750));

console.log('\n— 3. Conteggio assente: si dichiara solo ciò che è caricato —');
const senzaConteggio = etichettaTotaleAvvisi(null, 30);
check('nessuna attribuzione all’Italia', '30 avvisi in bacheca', senzaConteggio);
check('nessun «Italia» senza conteggio esatto', false, /Italia/.test(String(senzaConteggio)));
check('nessuna etichetta vuota (−)', null, etichettaTotaleAvvisi(0, 0));
check('righe caricate a zero → nessuna etichetta', null, etichettaTotaleAvvisi(null, 0));

console.log('\n— 4. Robustezza: liste vuote, pagine non valide, pagina fuori scala —');
check('zero righe = 1 pagina (nessuna divisione per zero)', 1, pagineBoard(0, 5));
check('righe/pagina non valide = 1 pagina', 1, pagineBoard(750, 0));
check('pagina fuori scala riportata a 1', 'Pagina 1 di 150 - Aggiornamento automatico', etichettaPagina(0, 150, false));
check('pagine non valide riportate a 1', 'Pagina 3 di 1 - Aggiornamento automatico', etichettaPagina(3, 0, false));

process.exitCode = errori === 0 ? 0 : 1;
console.log(
  errori === 0
    ? '\n✅ METRICHE RADAR LIVE: scale reali, nessun numero inventato.'
    : `\n❌ METRICHE RADAR LIVE: ${errori} errore/i.`,
);
