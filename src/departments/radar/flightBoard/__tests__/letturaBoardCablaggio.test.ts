/**
 * ScuoleRadar.it — «Radar Live»: CABLAGGIO della lettura a pagine della bacheca.
 *
 * Il comportamento della lettura si verifica sui client finti
 * (`flightBoard/__tests__/letturaBoard.test.ts`); qui si controlla che i PEZZI
 * siano collegati come dichiarato, perché è da un cablaggio sbagliato che nasce
 * il troncamento silenzioso:
 *
 *   1. la geometria delle pagine vive SOLO in `flightBoard/letturaBoard.ts`, che
 *      è puro e isomorfo (nessuna dipendenza da React, da Supabase o dall'alias
 *      `@/`) — riceve la funzione di lettura, non la conosce;
 *   2. `FlightBoardInterpelli.tsx` legge A PAGINE con `.range()`, NON ha più il
 *      `.limit()` che tagliava la vetrina, passa `attese` (il conteggio esatto
 *      chiude la lettura) e ordina con `id` come ultimo criterio, senza il quale
 *      la paginazione potrebbe ripetere o saltare righe;
 *   3. il filtro di prodotto resta quello condiviso (`filtroAttivi`), non una
 *      copia locale;
 *   4. il tetto di lettura non esiste più come costante della metrica: chi cerca
 *      `LIMITE_RIGHE_LETTE` non deve trovarlo in giro (una sola sorgente di verità);
 *   5. la guardia è nella catena di `npm test` (non solo invocabile a mano).
 *
 * La verifica vive DENTRO il dipartimento (`flightBoard/__tests__/`), accanto ai
 * moduli che controlla: il gate strutturale ammette gli import fra moduli dello
 * stesso dominio e vieta di scavalcare l'`index.ts` solo da FUORI il dipartimento.
 *
 * Uso: npm run test:board:lettura  (secondo script della catena; incluso in `npm test`)
 */
import { readFileSync } from 'node:fs';
import process from 'node:process';
import { RIGHE_PER_PAGINA_QUERY, MAX_PAGINE_LETTURA } from '../letturaBoard.ts';

const leggi = (p: string): string => readFileSync(p, 'utf8');
let errori = 0;
function check(nome: string, atteso: unknown, ottenuto: unknown): void {
  const ok = JSON.stringify(atteso) === JSON.stringify(ottenuto);
  if (!ok) errori += 1;
  console.log(`${ok ? '✓' : '✗'} ${nome}: atteso=${JSON.stringify(atteso)} ottenuto=${JSON.stringify(ottenuto)}`);
}

const modulo = leggi('src/departments/radar/flightBoard/letturaBoard.ts');
const componente = leggi('src/departments/radar/FlightBoardInterpelli.tsx');
const metrica = leggi('src/departments/radar/flightBoard/metricaBoard.ts');
const catena = JSON.parse(leggi('package.json')) as { scripts: Record<string, string> };

console.log('— 1. La lettura a pagine è un modulo puro: nessun client, nessun React —');
check('finestra di pagine: il massimo di PostgREST', 1_000, RIGHE_PER_PAGINA_QUERY);
check('guardia anti-anello dichiarata', 50, MAX_PAGINE_LETTURA);
check('nessun import da React', false, /from 'react'/.test(modulo));
check('nessun client importato (Supabase lo passa chi legge)', false, /from '\S*supabase/.test(modulo));
check('nessun alias `@/` (testabile dallo script, che non passa l’alias)', false, /from '@\//.test(modulo));
check('il client lo riceve come funzione', true, /chiediPagina/.test(modulo));

console.log('\n— 2. Il tabellone legge a pagine e non taglia più la vetrina —');
check('usa la lettura a pagine', true, /leggiTutteLePagine</.test(componente));
check('la finestra è passata col `range` di PostgREST', true, /\.range\(da, a\)/.test(componente));
check('il `.limit()` che troncava è sparito', false, /\.limit\(/.test(componente));
check('nessun riferimento alla vecchia costante', false, /LIMITE_RIGHE_LETTE/.test(componente));
check(
  'il conteggio esatto viene PRIMA della lettura (chiude il ciclo)',
  true,
  componente.indexOf("count: 'exact'") > 0 &&
    componente.indexOf("count: 'exact'") < componente.indexOf('leggiTutteLePagine<'),
);
check('il conteggio è passato come `attese`', true, /\n\s+attese: typeof count === 'number'/.test(componente));
check('chiave di riga: l’id (mai doppioni in tabellone)', true, /chiave: \(r\) => r\.id/.test(componente));
check(
  'ordinamento stabile: `id` come ultimo criterio della paginazione',
  true,
  /\.order\('id', \{ ascending: false \}\)/.test(componente),
);
check('una sola definizione delle colonne lette', true, /COLONNE_INTERPELLI/.test(componente));
check('filtro di prodotto: quello condiviso, non una copia locale', true, /filtroAttivi\(adesso\)/.test(componente));
check('gli errori di lettura sono dichiarati in console, mai muti', true, /\[flight-board\]/.test(componente));

console.log('\n— 3. Una sola sorgente di verità per le pagine —');
check('la metrica non contiene più un tetto di lettura', false, /LIMITE_RIGHE_LETTE/.test(metrica));
check('la metrica calcola ancora le pagine sulle righe presenti', true, /pagineBoard/.test(metrica));

console.log('\n— 4. La guardia è nella catena di `npm test` —');
check('script dedicato', true, 'test:board:lettura' in catena.scripts);
check(
  'il test di comportamento è nella catena',
  true,
  (catena.scripts.test ?? '').includes('flightBoard/__tests__/letturaBoard.test.ts'),
);
check(
  'il cablaggio è nella catena',
  true,
  (catena.scripts.test ?? '').includes('flightBoard/__tests__/letturaBoardCablaggio.test.ts'),
);
check(
  'lettura e cablaggio sono lo stesso npm script',
  true,
  (catena.scripts['test:board:lettura'] ?? '').includes('letturaBoardCablaggio.test.ts'),
);

console.log(
  errori === 0
    ? '\n✅ RADAR LIVE (cablaggio): la bacheca legge tutto, e non lo fa in silenzio.'
    : `\n❌ RADAR LIVE (cablaggio): ${errori} errore/i`,
);
process.exitCode = errori === 0 ? 0 : 1;
