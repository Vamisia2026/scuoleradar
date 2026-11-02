/**
 * ScuoleRadar.it — GUARDIA DEL PERIMETRO DI INGESTIONE (§26.131).
 * -----------------------------------------------------------------------------------
 * PERCHÉ ESISTE. Dal 02/11/2026 il crawler lavora **due** province (AT, CT) più le
 * fonti ufficiali in whitelist. Il perimetro è una regola di prodotto e vive in un
 * solo posto (`src/lib/perimetroIngestione.ts`): questa guardia fissa il contratto
 * — quali province, come si normalizza un codice, come si dichiara uno scarto —
 * e, soprattutto, il **cablaggio**: se una delle tre porte (runner, comando
 * manuale, reset) smettesse di leggere quel modulo, il perimetro tornerebbe a
 * essere un commento.
 *
 * Esecuzione: `npm run test:perimetro` (inclusa in `npm test`).
 */
import { readFileSync } from 'node:fs';
import { province } from '../src/data/province.ts';
import {
  PROVINCE_PERIMETRO,
  descrizionePerimetro,
  eProvinciaPerimetro,
  fuoriPerimetro,
  messaggioFuoriPerimetro,
  nomeProvinciaPerimetro,
} from '../src/lib/perimetroIngestione.ts';

let errori = 0;
function check(nome: string, atteso: unknown, ottenuto: unknown): void {
  const ok = JSON.stringify(atteso) === JSON.stringify(ottenuto);
  if (!ok) errori += 1;
  console.log(`${ok ? '✓' : '✗'} ${nome}: atteso=${JSON.stringify(atteso)} ottenuto=${JSON.stringify(ottenuto)}`);
}
const leggi = (p: string): string => readFileSync(p, 'utf8');

console.log('— 1. Il perimetro sono due province, e nessuna è inventata —');
check('PROVINCE_PERIMETRO', ['AT', 'CT'], [...PROVINCE_PERIMETRO]);
check(
  'ogni codice esiste nel catalogo delle province',
  [],
  PROVINCE_PERIMETRO.filter((c) => !province.some((p) => p.codice === c)),
);
check('descrizione leggibile', 'AT (Asti) + CT (Catania)', descrizionePerimetro());

console.log('\n— 2. eProvinciaPerimetro: normalizza, non indovina —');
check('CT dentro', true, eProvinciaPerimetro('CT'));
check('AT dentro', true, eProvinciaPerimetro('AT'));
check('« ct » (spazi e minuscolo) dentro', true, eProvinciaPerimetro(' ct '));
check('TO fuori', false, eProvinciaPerimetro('TO'));
check('MI fuori', false, eProvinciaPerimetro('MI'));
check('stringa vuota fuori', false, eProvinciaPerimetro(''));
check('assente fuori', false, eProvinciaPerimetro(null));
check('codice incompleto fuori', false, eProvinciaPerimetro('C'));

console.log('\n— 3. fuoriPerimetro: elenca lo scarto, non lo nasconde —');
check('mescola dentro e fuori', ['TO', 'MI'], fuoriPerimetro(['AT', 'TO', 'CT', 'MI']));
check('senza duplicati', ['TO'], fuoriPerimetro(['TO', 'TO', ' to ']));
check('ignora i vuoti', ['NA'], fuoriPerimetro(['', null, undefined, 'NA']));
check('tutto dentro → nessuno scarto', [], fuoriPerimetro(['AT', 'CT']));

console.log('\n— 4. Nomi e messaggio: chi rifiuta deve spiegare —');
check('nome di CT', 'Catania', nomeProvinciaPerimetro('CT'));
check('nome di AT', 'Asti', nomeProvinciaPerimetro('AT'));
check('codice sconosciuto → il codice stesso', 'ZZ', nomeProvinciaPerimetro('ZZ'));
const messaggio = messaggioFuoriPerimetro('TO');
check('il messaggio nomina la provincia richiesta', true, messaggio.includes('TO'));
check('e il perimetro', true, messaggio.includes('AT (Asti) + CT (Catania)'));
check('e il file da cambiare', true, messaggio.includes('PROVINCE_PERIMETRO'));
check('senza codice → N/D (nessun nome inventato)', true, messaggioFuoriPerimetro(null).includes('N/D'));

console.log('\n— 5. Cablaggio: le tre porte leggono lo stesso modulo —');
for (const file of ['scripts/table-reporter.ts', 'scripts/crawl-provincia.ts', 'scripts/reset-coda-perimetro.ts']) {
  check(`${file} importa il perimetro`, true, /perimetroIngestione\.ts'/.test(leggi(file)));
}
check(
  'il runner ha la via d’uscita dichiarata per la diagnosi',
  true,
  /--tutte-le-province/.test(leggi('scripts/table-reporter.ts')),
);
check(
  'il crawler manuale si ferma prima della rete',
  true,
  /messaggioFuoriPerimetro/.test(leggi('scripts/crawl-provincia.ts')),
);
const pkg = leggi('package.json');
check('comando di reset dichiarato', true, /"reset:coda:perimetro"/.test(pkg));
check('guardia dedicata dichiarata', true, /"test:perimetro": "tsx scripts\/test-perimetro-ingestione\.ts"/.test(pkg));
check('guardia nella catena di `npm test`', true, /test-perimetro-ingestione\.ts/.test(pkg));

console.log('\n' + '─'.repeat(70));
if (errori === 0) {
  console.log('✅ PERIMETRO: AT + CT, whitelist ufficiale, tre porte che lo fanno rispettare.');
} else {
  console.log(`❌ PERIMETRO: ${errori} controllo/i fallito/i`);
  process.exitCode = 1;
}
