/**
 * ScuoleRadar.it — Dipartimento Notizie · GUARDIA del RUMORE EDITORIALE (§26.98).
 * -----------------------------------------------------------------------------------
 * PERCHÉ ESISTE. La bacheca Notizie non è un albo: uno sciopero, un'assemblea
 * sindacale o l'orario estivo degli uffici sono avvisi veri ma non hanno valore
 * per chi cerca lavoro, e restavano in pagina perché nessun gate li nominava.
 * La regola vive in `services/filtroRumore.ts`; qui si verifica che scarti il
 * rumore, che NON scarti le notizie utili per sei mesi e che sia davvero cablata
 * nella pipeline (ingestione, riserva settimanale, igiene dell'archivio).
 *
 * Uso: npm run test:notizie-rumore (incluso in `npm test`)
 */
import { readFileSync } from 'node:fs';
import process from 'node:process';
import {
  DURATA_UTILE_MINIMA_MESI,
  articoloRumoroso,
  haValoreDuraturo,
  rilevaRumoreEditoriale,
  rumoreSindacale,
  rumoreTemporaneo,
} from '../services/filtroRumore.ts';
import {
  articoloValido,
  èRiservaSettimanale,
  valutaRilevanza,
} from '../services/relevanceEngine.ts';
import { notizieIngestite } from '../data/notizieIngestite.ts';
import { notizieSeed } from '../data/notizieSeed.ts';

let errori = 0;
function check(nome: string, atteso: unknown, ottenuto: unknown): void {
  const ok = JSON.stringify(atteso) === JSON.stringify(ottenuto);
  if (!ok) errori += 1;
  console.log(`${ok ? '✓' : '✗'} ${nome}: atteso=${JSON.stringify(atteso)} ottenuto=${JSON.stringify(ottenuto)}`);
}

console.log('— 1. Orizzonte di validità: sei mesi, non un giorno —');
check('la soglia dichiarata è di 6 mesi', 6, DURATA_UTILE_MINIMA_MESI);

console.log('\n— 2. RUMORE SINDACALE E POLITICO: sempre fuori —');
const RUMORE: Array<[string, string]> = [
  ['Sciopero del personale docente il 12 novembre 2026', 'sciopero'],
  ['Assemblea sindacale: lezioni sospese il 5 novembre', 'assemblea sindacale'],
  ['Protesta dei precari davanti al Ministero', 'protesta'],
  ['Cobas: blocco degli scrutini di dicembre', 'cobas'],
  ['Flc Cgil: comunicato sulla mobilità 2027', 'flc cgil'],
  ['Scioperi e presidi davanti agli uffici scolastici', 'sciopero'],
];
for (const [testo, motivo] of RUMORE) {
  check(`«${testo.slice(0, 42)}…» → ${motivo}`, motivo, rumoreSindacale(testo));
}
// Le sigle sono un segnale SOFT: da sole sono rumore, dentro un atto no.
check('«i sindacati chiedono un incontro» → soft «sindacato»', 'sindacato', rilevaRumoreEditoriale('I sindacati chiedono un incontro urgente al Ministero'));
check('nessun rumore in un testo neutro', null, rilevaRumoreEditoriale('Graduatorie di istituto: pubblicato il decreto di aggiornamento'));


console.log('\n— 3. AVVISI TEMPORANEI: valgono giorni, non mesi —');
const TEMPORANEI: Array<[string, string]> = [
  ['Chiusura degli uffici di segreteria dal 27 al 31 dicembre', 'avviso temporaneo (chiusura/orario/servizio)'],
  ['Orario estivo degli uffici: apertura al pubblico dalle 8 alle 12', 'orario temporaneo'],
  ['Manutenzione straordinaria: disservizio sul portale delle istanze', 'disservizio temporaneo'],
];
for (const [testo, motivo] of TEMPORANEI) {
  check(`«${testo.slice(0, 42)}…» → temporaneo`, motivo, rumoreTemporaneo(testo));
}
// «Riapertura dei termini» è un fatto operativo: NON deve cadere.
check('riapertura dei termini NON è un avviso temporaneo', null, rumoreTemporaneo('Riapertura dei termini per la domanda di mobilità 2027'));

console.log('\n— 4. VALORE DURATURO: le notizie che restano si pubblicano —');
const UTILI: string[] = [
  'CCNL scuola 2025-2027: le organizzazioni sindacali firmano l’ipotesi di accordo',
  'PNRR: 450 milioni per la formazione dei docenti, candidature entro il 30 novembre 2026',
  'Linee guida MIM per l’orientamento: candidature entro il 15 dicembre 2026 per i docenti tutor',
];
for (const testo of UTILI) {
  const valutazione = valutaRilevanza({ title: testo, data: '2026-10-20' });
  check(`AMMESSA · ${testo.slice(0, 40)}…`, true, valutazione.rilevante);
}
check('un CCNL firmato ha ancoraggio duraturo', true, haValoreDuraturo('CCNL 2025-2027: ipotesi di accordo'));
check('una sigla da sola non ha ancoraggio', false, haValoreDuraturo('Comunicato delle sigle sindacali'));

console.log('\n— 5. Il rumore non passa NEPPURE dalla riserva settimanale —');
for (const [testo] of RUMORE) {
  check(`riserva respinta · ${testo.slice(0, 34)}…`, false, èRiservaSettimanale(testo));
}


console.log('\n— 6. Igiene dell’archivio: nessuna notizia pubblicata è rumore —');
const archivio = [...notizieIngestite, ...notizieSeed];
const rumorose = archivio
  .map((a) => ({ id: a.id, motivo: rilevaRumoreEditoriale(a.title) }))
  .filter((v) => v.motivo !== null);
check('nessun titolo pubblicato contiene rumore', [], rumorose);
// E la validazione di un articolo già in archivio rifiuta un rumore, anche se
// il titolo è formalmente corretto: è la rete che ripulisce al primo ingest.
const modello = notizieSeed[0] ?? notizieIngestite[0];
check(
  'articoloValido respinge uno sciopero',
  false,
  articoloValido({
    ...modello,
    id: 'rumore-test',
    title: 'Sciopero del personale docente il 12 novembre 2026',
    content_html: '<p>Lo sciopero riguarda tutto il personale.</p>',
  }),
);
check(
  'articoloRumoroso legge anche il corpo HTML',
  'sciopero',
  articoloRumoroso({
    title: 'Comunicazione alle famiglie',
    content_html: '<p>Si comunica lo sciopero del 12 novembre.</p>',
  }),
);

console.log('\n— 7. La guardia è nella catena di `npm test` —');
const pkg = JSON.parse(readFileSync('package.json', 'utf8')) as { scripts: Record<string, string> };
check('script dedicato (`npm run test:notizie-rumore`)', true, 'test:notizie-rumore' in pkg.scripts);
check('guardia nella catena di `npm test`', true, (pkg.scripts.test ?? '').includes('src/departments/notizie/__tests__/rumoreEditoriale.test.ts'));

console.log('\n──────────────────────────────────────────────────────────');
if (errori > 0) {
  console.log(`❌ NOTIZIE RUMORE: ${errori} verifiche fallite`);
  process.exitCode = 1;
} else {
  console.log('✅ NOTIZIE RUMORE: scioperi, assemblee, proteste e avvisi temporanei fuori dalla bacheca.');
}
