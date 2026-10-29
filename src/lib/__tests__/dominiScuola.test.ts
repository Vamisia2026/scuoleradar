/**
 * TEST — DOMINI ISTITUZIONALI delle scuole (`src/lib/dominiScuola.ts`).
 *
 * È la regola UNICA con cui l'app riconosce il sito di un istituto: se sbaglia,
 * la bacheca pubblica link di terzi spacciati per «sito della scuola». La guardia
 * fissa:
 *   1. i FORMati che arrivano davvero dai file MIM e dagli avvisi — URL, host
 *      nudo, recapito, schema malformato (`https//host/`, misurato il 22/10/2026 su
 *      SCUANAGRAFE), porta, punto finale, punteggiatura incollata;
 *   2. i domini da RIFIUTARE: `istruzione.it` (casella di servizio del Ministero),
 *      caselle personali, domini storici non `.edu.it`, `edu.it` nudo;
 *   3. la mappa `codice → host`: «primo vince», il dominio dell'istituto vale per
 *      i plessi che non dichiarano nulla, i codici sono normalizzati;
 *   4. le statistiche (codici con dominio, domini distinti) e il cablaggio in
 *      `npm test`.
 *
 * Uso: npm run test:domini  (incluso in `npm test`)
 */
import { readFileSync } from 'node:fs';
import {
  costruisciMappaDomini,
  dominioDaCodice,
  homeDaCodice,
  homeEduIt,
  hostEduIt,
  statisticheMappa,
} from '../dominiScuola.ts';

/** Interfaccia minima per l'ambiente (come gli altri test di prodotto). */
declare const process: { exitCode?: number };

let errori = 0;
function check(nome: string, atteso: unknown, ottenuto: unknown): void {
  const ok = JSON.stringify(atteso) === JSON.stringify(ottenuto);
  if (!ok) errori += 1;
  console.log(`${ok ? '✓' : '✗'} ${nome}: atteso=${JSON.stringify(atteso)} ottenuto=${JSON.stringify(ottenuto)}`);
}

/* ---------------- 1) LE FORME REALI DEL DOMINIO ---------------- */

console.log('— 1. Forme reali: URL, host nudo, recapito, schema malformato —');
const ospiti: ReadonlyArray<readonly [string, string | null | undefined, string | null]> = [
  ['URL completo con percorso', 'https://www.iccarducci.edu.it/avvisi/interpello-1', 'iccarducci.edu.it'],
  ['host nudo', 'www.iccarducci.edu.it', 'iccarducci.edu.it'],
  ['host senza www', 'iccarducci.edu.it', 'iccarducci.edu.it'],
  ['maiuscole', 'ICCARDUCCI.EDU.IT', 'iccarducci.edu.it'],
  ['recapito PEO', 'segreteria@iccarducci.edu.it', 'iccarducci.edu.it'],
  ['recapito fra parentesi angolari', '<segreteria@iccarducci.edu.it>', 'iccarducci.edu.it'],
  ['schema malformato del file MIM', 'https//www.liceoaugustomonti.edu.it/albo', 'liceoaugustomonti.edu.it'],
  ['porta esplicita', 'https://iccarducci.edu.it:8443/albo', 'iccarducci.edu.it'],
  ['punto finale', 'iccarducci.edu.it.', 'iccarducci.edu.it'],
  ['spazi attorno', '  iccarducci.edu.it  ', 'iccarducci.edu.it'],
  ['dominio con trattino e sottodominio', 'www.istituto-comprensivo-3.edu.it', 'istituto-comprensivo-3.edu.it'],
];
for (const [nome, valore, atteso] of ospiti) check(nome, atteso, hostEduIt(valore));

/* ---------------- 2) I DOMINI DA RIFIUTARE ---------------- */

console.log('\n— 2. Ciò che NON è il sito di un istituto —');
const rifiutati: ReadonlyArray<readonly [string, string | null | undefined]> = [
  ['casella di servizio del Ministero', 'segreteria@istruzione.it'],
  ['casella personale', 'segreteria@gmail.com'],
  ['dominio storico non .edu.it', 'www.iccarducci.it'],
  ['dominio `edu.it` nudo', 'https://edu.it/'],
  ['vuoto', ''],
  ['assente', null],
  ['solo punteggiatura', '---'],
];
for (const [nome, valore] of rifiutati) check(nome, null, hostEduIt(valore));

check('home composta in un punto solo', 'https://iccarducci.edu.it', homeEduIt('www.iccarducci.edu.it'));
check('home da recapito', 'https://iccarducci.edu.it', homeEduIt('segreteria@iccarducci.edu.it'));
check('home inesistente senza dominio valido', null, homeEduIt('segreteria@gmail.com'));

/* ---------------- 3) LA MAPPA CODICE → DOMINIO ---------------- */

console.log('\n— 3. Mappa codice → dominio: primo vince, istituto sui plessi —');
const mappa = costruisciMappaDomini([
  { codice: 'BIIC815007', sito: 'https://www.icbiella.edu.it/avvisi' },
  { codice: 'BIIC815007', sito: 'dominio-sbagliato.edu.it' },
  { codice: 'BIAA815047', sito: 'Non Disponibile' },
  { codice: 'BIEE815011', istitutoCodice: 'BIIC815007', sito: 'www.icbiella.edu.it' },
  { codice: 'BIMM81501X', istitutoCodice: 'BIIC815007', sito: 'https//icbiella.edu.it' },
  { codice: null, sito: 'orfano.edu.it' },
]);
check('sede: il primo dominio vince', 'icbiella.edu.it', dominioDaCodice(mappa, 'BIIC815007'));
check('codice normalizzato (minuscolo e spazi)', 'icbiella.edu.it', dominioDaCodice(mappa, ' biic815007 '));
check('plesso senza sito eredita quello dell’istituto', 'icbiella.edu.it', dominioDaCodice(mappa, 'BIEE815011'));
check('plesso con schema malformato', 'icbiella.edu.it', dominioDaCodice(mappa, 'BIMM81501X'));
check('“Non Disponibile” non entra nella mappa', null, dominioDaCodice(mappa, 'BIAA815047'));
check('codice sconosciuto', null, dominioDaCodice(mappa, 'XXIC000000'));
check('mappa assente → nessun dominio', null, dominioDaCodice(null, 'BIIC815007'));
check('home del codice', 'https://icbiella.edu.it', homeDaCodice(mappa, 'BIIC815007'));
check(
  'statistiche: codici con dominio e domini distinti',
  { codici: 3, domini: 1 },
  statisticheMappa(mappa),
);
check('statistiche di una mappa assente', { codici: 0, domini: 0 }, statisticheMappa(null));

/* ---------------- 4) IL CABLAGGIO ---------------- */

console.log('\n— 4. Cablaggio: script dedicato e catena di `npm test` —');
const pkg = JSON.parse(readFileSync('package.json', 'utf8')) as { scripts: Record<string, string> };
check('script dedicato', true, 'test:domini' in pkg.scripts);
check(
  'guardia nella catena di `npm test`',
  true,
  (pkg.scripts.test ?? '').includes('src/lib/__tests__/dominiScuola.test.ts'),
);

console.log(
  errori === 0
    ? '\n✅ DOMINI SCUOLA: un solo dominio ufficiale per istituto, nessun dominio altrui.'
    : `\n❌ DOMINI SCUOLA: ${errori} errore/i`,
);
process.exitCode = errori === 0 ? 0 : 1;
