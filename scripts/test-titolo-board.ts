/**
 * Verifica il modulo del TITOLO nella vetrina «Radar Live` (`src/lib/titoloBoard.ts`).
 *
 * Due domande, due funzioni, un solo gate (`nomeIstitutoPresentabile`):
 *
 *  1. `nomeScuolaDaTitolo` — QUAL È L'ISTITUTO? Strategia a tre passate:
 *     segmenti forti dal più esterno, poi teste d'istituto con la coda accorciata.
 *     Mai un codice amministrativo spacciato per nome: se il gate non approva si
 *     restituisce `null` e la riga resta fuori (`preparaRigheBoard`).
 *  2. `eTitoloSoloData` — IL TITOLO DICE QUALCOSA? «PUBBLICATO IL 18/10/2026» non
 *     descrive l'opportunità: in bacheca occuperebbe una riga senza dire nulla
 *     (§26.76, direttiva 22/10/2026).
 *
 * Uso: npm run test:titolo  (incluso in `npm test`)
 */
import { eTitoloSoloData, nomeScuolaDaTitolo } from '../src/lib/titoloBoard.ts';

let errori = 0;
function check(nome: string, atteso: unknown, ottenuto: unknown): void {
  const ok = JSON.stringify(atteso) === JSON.stringify(ottenuto);
  if (!ok) errori += 1;
  console.log(`${ok ? '✓' : '✗'} ${nome}: atteso=${JSON.stringify(atteso)} ottenuto=${JSON.stringify(ottenuto)}`);
}

console.log('— 1. Istituto ricavato dal titolo (titoli REALI delle fonti) —');
check(
  'nome dopo il separatore',
  'Liceo Scientifico Galilei',
  nomeScuolaDaTitolo('Interpello supplenza — Liceo Scientifico Galilei'),
);
check(
  'nome in coda dopo un trattino semplice',
  'IX IC Ricci Curbastro',
  nomeScuolaDaTitolo('IX IC Ricci Curbastro – nterpello per la copertura di posti Art. 13 C.'),
);
check(
  'classe di concorso in coda: il nome resta quello dell’istituto',
  'IC CARRARESE EUGANEO',
  nomeScuolaDaTitolo('Interpello supplenza IC CARRARESE EUGANEO A-022 del 20/10/2026'),
);
check(
  'sigla puntata e denominazione',
  'I.I.S. "L. Gigli"',
  nomeScuolaDaTitolo('Interpello — I.I.S. "L. Gigli" — supplenza A-022'),
);
check(
  'titolo con l’istituto in testa e la procedura in coda',
  'IC Carducci',
  nomeScuolaDaTitolo('IC Carducci, interpello per supplenza primaria'),
);

console.log('\n— 2. Mai un nome inventato: quando il titolo non nomina un istituto —');
check('frammento generico', null, nomeScuolaDaTitolo('Avviso supplenza — Scuola'));
check('soli codici classe', null, nomeScuolaDaTitolo('ADEE | EEEE | A042'));
check('etichetta di posto', null, nomeScuolaDaTitolo('Interpello generico su POSTO COMUNE INFANZIA fino a 10 giorni'));
check('atto amministrativo', null, nomeScuolaDaTitolo('annotazione_INTERPELLO – Classe di concorso A042 – 9H – Dal 01.10.2026'));
check('titolo vuoto', null, nomeScuolaDaTitolo('   '));
check('titolo assente', null, nomeScuolaDaTitolo(null));
check(
  'nessun codice amministrativo esce dal titolo',
  [],
  [
    'Interpello A-022 — I.C. A-48 Carducci',
    'Interpello — AAAA | A246',
    'Interpello supplenza — EEEE | ADEE',
  ].filter((t) => /\||\d[A-Za-zÀ-ÿ]|[A-Za-zÀ-ÿ]\d/.test(nomeScuolaDaTitolo(t) ?? '')),
);

console.log('\n— 3. Titolo fatto della sola riga di pubblicazione → riga fuori (§26.76) —');
check('solo «PUBBLICATO IL …»', true, eTitoloSoloData('PUBBLICATO IL 18/10/2026'));
check('«Avviso di pubblicazione del …»', true, eTitoloSoloData('Avviso di pubblicazione del 18/10/2026'));
check('data con protocollo', true, eTitoloSoloData('Prot. n. 1234 del 18/10/2026'));
check('titolo vuoto: nulla da mostrare', true, eTitoloSoloData(''));
check('titolo assente: nulla da mostrare', true, eTitoloSoloData(null));
check(
  'un titolo che descrive l’avviso NON è scartato',
  false,
  eTitoloSoloData('Interpello supplenza — Liceo Scientifico Galilei'),
);
check('«Graduatoria definitiva A-022» resta', false, eTitoloSoloData('Graduatoria definitiva A-022'));
check(
  'la stessa riga non entra anche se ha una scuola valida (gate del titolo in `preparaRigheBoard`)',
  true,
  eTitoloSoloData('PUBBLICATO IL 18/10/2026') && nomeScuolaDaTitolo('PUBBLICATO IL 18/10/2026') === null,
);

console.log(errori === 0 ? '\n✅ TITOLO BOARD: nessun problema' : `\n❌ TITOLO BOARD: ${errori} errore/i`);
process.exitCode = errori === 0 ? 0 : 1;
