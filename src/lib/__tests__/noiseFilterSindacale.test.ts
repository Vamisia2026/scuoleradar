/**
 * TEST — VITA SINDACALE del pre-filtro (`src/lib/noiseFilterSindacale.ts`, §26.91).
 *
 * Le regole su SCIOPERI e ASSEMBLEE sono state estratte dal pre-filtro per due
 * motivi: (1) `noiseFilter.ts` era a 260 righe, sopra la soglia di attenzione dei
 * 250 (`npm run test:architettura`, W-DIM); (2) un gruppo di regole con una sua
 * ragione — «non è un'opportunità di lavoro, ma non è nemmeno un atto» — merita
 * un file suo, come il vocabolario di `nomeIstituto`.
 *
 * La guardia fissa ciò che lo split NON deve rompere:
 *   1. la LISTA resta una sola (le regole del sotto-modulo sono, per identità,
 *      elementi di `ADMIN_NOISE_PATTERNS`, nello stesso ordine);
 *   2. sono SOFT: salvate da un qualsiasi indicatore di reclutamento, mai
 *      bloccanti né «informative»;
 *   3. la `reason` più specifica vince («assemblea sindacale» ≠ «assemblea»);
 *   4. il modulo è puro e il file principale resta sotto i 250 righe;
 *   5. la guardia è in catena in `npm test`.
 *
 * Uso: npm run test:noise-filter-sindacale  (incluso in `npm test`)
 */
import { readFileSync } from 'node:fs';
import { ADMIN_NOISE_PATTERNS, isAdministrativeNoise } from '../noiseFilter.ts';
import { PATTERN_VITA_SINDACALE } from '../noiseFilterSindacale.ts';

/** Interfaccia minima per l'ambiente (come gli altri test di prodotto). */
declare const process: { exitCode?: number };

let errori = 0;
function check(nome: string, atteso: unknown, ottenuto: unknown): void {
  const ok = JSON.stringify(atteso) === JSON.stringify(ottenuto);
  if (!ok) errori += 1;
  console.log(`${ok ? '✓' : '✗'} ${nome}: atteso=${JSON.stringify(atteso)} ottenuto=${JSON.stringify(ottenuto)}`);
}

const leggi = (p: string): string => readFileSync(p, 'utf8');
/** Rumore sì/no senza ripetere l'oggetto dell'esito in ogni caso. */
const rumore = (testo: string, titolo = ''): boolean => isAdministrativeNoise(testo, titolo).isNoise;

/* --------------------- 1) UNA SOLA LISTA, NELLO STESSO ORDINE ------------ */

console.log('\n— 1. Le regole entrano nella lista unica (spread, non copia) —');
check('tre regole sindacali', 3, PATTERN_VITA_SINDACALE.length);
check(
  'sono gli STESSI oggetti di `ADMIN_NOISE_PATTERNS`',
  PATTERN_VITA_SINDACALE.length,
  PATTERN_VITA_SINDACALE.filter((p) => ADMIN_NOISE_PATTERNS.includes(p)).length,
);
const posizioni = PATTERN_VITA_SINDACALE.map((p) => ADMIN_NOISE_PATTERNS.indexOf(p));
check('ordine di valutazione conservato', true, posizioni.every((n, i) => n >= 0 && (i === 0 || n > posizioni[i - 1])));
check(
  'dal più specifico al più generico',
  ['assemblea sindacale', 'sciopero', 'assemblea'],
  PATTERN_VITA_SINDACALE.map((p) => p.reason),
);

/* --------------------------- 2) RUMORE SOFT ----------------------------- */

console.log('\n— 2. Scioperi e assemblee: rumore SOFT, mai bloccante —');
check(
  'nessuna regola è bloccante o informativa',
  [],
  PATTERN_VITA_SINDACALE.filter((p) => p.hard || p.informativa).map((p) => p.reason),
);
check('sciopero (solo titolo) è rumore', true, rumore('', 'Sciopero del personale docente 12 novembre'));
check('assemblea è rumore', true, rumore('Assemblea del personale, ordine del giorno approvato.', ''));
check('«scioperi» plurale riconosciuto', true, rumore('Calendario degli scioperi di novembre.', ''));
check(
  'la `reason` più specifica vince',
  'assemblea sindacale',
  isAdministrativeNoise('Assemblea sindacale del 12 novembre', 'Assemblea sindacale del 12 novembre').reason,
);
check(
  'un interpello che CITA l’assemblea resta un interpello',
  false,
  rumore('Interpello supplenza: l’assemblea sindacale del 12 novembre non sospende i termini.', 'Interpello supplenza'),
);
check('un interpello che cita lo sciopero resta', false, rumore('Interpello supplenza: le domande vanno inviate anche in caso di sciopero.', 'Interpello supplenza'));

/* ------------------------- 3) PUREZZA E DIMENSIONE --------------------- */

console.log('\n— 3. Modulo puro, pre-filtro sotto i 250 righe —');
const sindacale = leggi('src/lib/noiseFilterSindacale.ts');
const esterne = [...sindacale.matchAll(/from\s+'([^']+)'/g)].map((m) => m[1]).filter((s) => !s.startsWith('./'));
check('dipendenze: solo file sorelli (`./…`)', [], esterne);
check('nessuna chiamata di rete', false, /fetch\s*\(|axios|supabase/i.test(sindacale));
const righe = leggi('src/lib/noiseFilter.ts').split('\n').length;
check('pre-filtro sotto la soglia di attenzione (250 righe)', true, righe <= 250);

/* ------------------------- 4) LA GUARDIA È IN CATENA ------------------- */

console.log('\n— 4. La guardia è nella catena di `npm test` —');
const pkg = JSON.parse(leggi('package.json')) as { scripts: Record<string, string> };
check('script dedicato', true, 'test:noise-filter-sindacale' in pkg.scripts);
check(
  'guardia nella catena',
  true,
  (pkg.scripts.test ?? '').includes('src/lib/__tests__/noiseFilterSindacale.test.ts'),
);

console.log(
  errori === 0
    ? '\n✅ VITA SINDACALE: soft, una sola lista, pre-filtro sotto i 250 righe.'
    : `\n❌ VITA SINDACALE: ${errori} errore/i`,
);
process.exitCode = errori === 0 ? 0 : 1;
