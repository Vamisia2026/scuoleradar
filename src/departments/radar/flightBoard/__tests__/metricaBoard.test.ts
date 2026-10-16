/**
 * ScuoleRadar.it — Dipartimento Radar · metriche del «Radar Live» (homepage).
 *
 * La vetrina della bacheca non deve mai far sembrare la banca dati un mock vuoto:
 * le etichette delle pagine e degli avvisi attivi si calcolano su numeri REALI.
 * Qui si fissano le regole di quella traduzione (`flightBoard/metricaBoard.ts`):
 *
 *   1. le schermate sono quelle delle righe DAVVERO in tabellone: elementi
 *      presenti ÷ righe per schermata, arrotondati per eccesso — un conto ESATTO
 *      e dinamico. Nessun `+` di maggiorazione («32+») e nessuna dicitura fissa
 *      (direttiva cliente 03/10/2026): l'etichetta è «Schermata X di Y», con X
 *      sempre compreso fra 1 e Y;
 *   2. il totale mostrato e le schermate nascono dallo **stesso** numero — le
 *      righe davvero in vetrina (§26.71) — formattato `it-IT`
 *      («396 avvisi attivi in Italia»): mai un totale che parli di avvisi
 *      diversi da quelli leggibili;
 *   3. quando il numero non arriva si dichiara solo la scala caricata, senza
 *      attribuirla all'Italia intera («30 avvisi in bacheca»): mai un numero che
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

console.log('— 1. Schermate sulle righe presenti: conto esatto, nessuna maggiorazione —');
check('1.000 avvisi in tabellone = 200 schermate da 5 righe', 200, pagineBoard(1_000, 5));
const pieno = metricaBoard({ righeCaricate: 750, totaleReale: 750, righePerPagina: 5, pagina: 7 });
check('scala sulle righe presenti: 750 righe = 150 schermate', 150, pieno.pagine);
check('etichetta della schermata corrente', 'Schermata 7 di 150', pieno.etichettaPagine);
check('nessun `+` e nessuna dicitura fissa', false, /\+|Aggiornamento/.test(pieno.etichettaPagine));
check('totale in migliaia, formattato it-IT', '750 avvisi attivi in Italia', pieno.etichettaTotale);
check(
  'etichetta quando il tabellone copre tutto',
  'Schermata 1 di 8',
  metricaBoard({ righeCaricate: 40, totaleReale: 40, righePerPagina: 5 }).etichettaPagine,
);
/**
 * Scala REALE misurata sulla banca dati (16/10/2026, §26.71): 869 righe contate
 * come «attive» nel database, **396** delle quali in vetrina (il resto non sono
 * opportunità: pagine di archivio, indici di classi di concorso e righe senza
 * istituto reale). Le schermate sono quindi 80 esatte (396 ÷ 5). Un «174»
 * (869 ÷ 5) sarebbe un numero che il tabellone non può mostrare: oltre la 80ª
 * schermata non c'è nessuna riga, e la rotazione mostrerebbe pagine vuote.
 */
const reale = metricaBoard({ righeCaricate: 396, totaleReale: 396, righePerPagina: 5 });
check('scala reale: 396 righe in vetrina = 80 schermate', 80, reale.pagine);
check('etichetta esatta sulle righe presenti', 'Schermata 1 di 80', reale.etichettaPagine);
check('il totale mostrato è quello delle righe in vetrina', '396 avvisi attivi in Italia', reale.etichettaTotale);

/**
 * §26.71 — ANTI-DIVERGENZA: il numero del badge è il DENOMINATORE delle schermate.
 * È il bug misurato in produzione il 16/10/2026: il badge contava il database
 * grezzo («869 avvisi attivi in Italia») mentre il tabellone poteva paginarne 396
 * («Schermata 1 di 80»). Con il totale preso dalle righe in vetrina i due numeri
 * non possono più raccontare due storie diverse.
 */
const numeroNelBadge = Number(String(reale.etichettaTotale).replace(/\D/g, ''));
check(
  'il numero del badge è il denominatore delle schermate',
  reale.pagine,
  pagineBoard(numeroNelBadge, 5),
);
check('nessuna divergenza nemmeno in scala (3.412 avvisi = 683 schermate)', 683, pagineBoard(3412, 5));

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

console.log('\n— 4. Robustezza: liste vuote, schermate non valide, schermata fuori scala —');
check('zero righe = 1 schermata (nessuna divisione per zero)', 1, pagineBoard(0, 5));
check('righe/pagina non valide = 1 schermata', 1, pagineBoard(750, 0));
check('schermata fuori scala riportata a 1', 'Schermata 1 di 150', etichettaPagina(0, 150));
check('schermata oltre il totale agganciata all’ultima', 'Schermata 32 di 32', etichettaPagina(99, 32));
check('schermate non valide riportate a 1', 'Schermata 1 di 1', etichettaPagina(3, 0));

process.exitCode = errori === 0 ? 0 : 1;
console.log(
  errori === 0
    ? '\n✅ METRICHE RADAR LIVE: scale reali, nessun numero inventato.'
    : `\n❌ METRICHE RADAR LIVE: ${errori} errore/i.`,
);
