/**
 * GUARDIA · PRESIDIO DEL LINK IN INGRESSO (`src/scraper/presidioLinkIngresso.ts`).
 *
 * Perché esiste: la §26.104 ha portato la validità del link nella bacheca, ma la
 * pulizia dati lavora su righe GIÀ scritte. Questo test fissa il punto in cui la
 * stessa regola (`lib/validitaLink.ts`) decide PRIMA dell'upsert, cioè quando si
 * può ancora evitare di scrivere un URL morto — e quando invece NON si deve
 * distruggere un link buono solo perché il server non ha risposto in 6 secondi.
 *
 * Verifiche:
 *   · matrice completa dei 5 stati (ok, bloccato, assente, instabile, non controllato);
 *   · `404`/`410` → home ufficiale se nota, altrimenti fuori;
 *   · timeout/5xx → link specifico mantenuto (upsert `ignoreDuplicates`: irreversibile);
 *   · record strutturati mai pingati; link non `http(s)` mai pubblicati;
 *   · cablaggio: la pipeline usa `verificaLinkInLotti` e non ha più un ping proprio.
 *
 * Uso: npm run test:gate-link-ingresso (incluso in `npm test`)
 */
import { readFileSync } from 'node:fs';
import {
  daControllareInIngresso,
  valutaIngressoPerLink,
} from '../src/scraper/presidioLinkIngresso.ts';

let errori = 0;
function check(nome: string, atteso: unknown, ottenuto: unknown): void {
  const ok = JSON.stringify(atteso) === JSON.stringify(ottenuto);
  if (!ok) errori += 1;
  console.log(`${ok ? '✓' : '✗'} ${nome}: atteso=${JSON.stringify(atteso)} ottenuto=${JSON.stringify(ottenuto)}`);
}

const AVVISO = {
  title: 'Interpello supplenza A-022 Matematica — Liceo Manzoni',
  link: 'https://www.liceomanzoni.edu.it/interpelli/avviso-a022',
  classCodes: [] as string[],
  materia: null,
  contactEmail: null,
};
const STRUTTURATO = { ...AVVISO, classCodes: ['A-022'], contactEmail: 'miic81200x@istruzione.it' };
/** Home ufficiale normalizzata da `homeEduIt`: senza `www.`, come la scrive la bacheca. */
const HOME = 'https://liceomanzoni.edu.it';
/** Verdetto essenziale: cosa finisce in `source_url` e se la riga entra. */
const v = (a: object, esito: Parameters<typeof valutaIngressoPerLink>[1], home?: string | null) => {
  const r = valutaIngressoPerLink(a, esito, home ?? null);
  return { accetta: r.accetta, link: r.link, stato: r.stato, sostituito: r.sostituito };
};


/* --------------------- 1 · Matrice degli stati del link --------------------- */

console.log('\n— 1. I cinque stati e la loro decisione —');
check('200 → avviso pubblicato, verificato', { accetta: true, link: AVVISO.link, stato: 'ok', sostituito: false }, v(AVVISO, { status: 200 }));
check('301 → avviso pubblicato (redirect seguito)', { accetta: true, link: AVVISO.link, stato: 'ok', sostituito: false }, v(AVVISO, { status: 301 }));
check('403 → tenuto: il server rifiuta i client automatici', { accetta: true, link: AVVISO.link, stato: 'bloccato', sostituito: false }, v(AVVISO, { status: 403 }));
check('429 → tenuto (rate limit, non link morto)', { accetta: true, link: AVVISO.link, stato: 'bloccato', sostituito: false }, v(AVVISO, { status: 429 }));
check('nessun esito (non controllato) → tenuto', { accetta: true, link: AVVISO.link, stato: 'non-verificabile', sostituito: false }, v(AVVISO, null));
check('timeout → tenuto con il link specifico', { accetta: true, link: AVVISO.link, stato: 'instabile', sostituito: false }, v(AVVISO, { status: null, errore: 'timeout' }, HOME));
check('500 → tenuto con il link specifico', { accetta: true, link: AVVISO.link, stato: 'instabile', sostituito: false }, v(AVVISO, { status: 500 }, HOME));

/* -------------------- 2 · Link morto: home o fuori -------------------- */

console.log('\n— 2. Avviso sparito: home ufficiale se nota, altrimenti fuori —');
check('404 + home → si pubblica la home', { accetta: true, link: HOME, stato: 'assente', sostituito: true }, v(AVVISO, { status: 404 }, HOME));
check('410 + home → si pubblica la home', { accetta: true, link: HOME, stato: 'assente', sostituito: true }, v(AVVISO, { status: 410 }, HOME));
check('404 senza home → riga fuori', { accetta: false, link: null, stato: 'assente', sostituito: false }, v(AVVISO, { status: 404 }));
check(
  '404 sul link che È già la home → resta (niente di meglio)',
  { accetta: true, link: `${HOME}/`, stato: 'assente', sostituito: false },
  v({ ...AVVISO, link: `${HOME}/` }, { status: 404 }, HOME),
);
check(
  'home dichiarata non `.edu.it` → non è una home ufficiale',
  { accetta: false, link: null, stato: 'assente', sostituito: false },
  v(AVVISO, { status: 404 }, 'https://www.liceomanzoni.it'),
);


/* ------------------ 3 · Record strutturato e link pubblicabile ------------------ */

console.log('\n— 3. Cosa si pinga e cosa non si pubblica mai —');
check('record strutturato → NON si pinga', false, daControllareInIngresso(STRUTTURATO));
check('record incompleto → si pinga', true, daControllareInIngresso(AVVISO));
check('link assente → non c’è niente da pingare', false, daControllareInIngresso({ ...AVVISO, link: null }));
check(
  'link non http(s) → mai in bacheca, nemmeno se strutturato',
  { accetta: false, link: null, stato: 'non-verificabile', sostituito: false },
  v({ ...STRUTTURATO, link: 'mailto:segreteria@liceomanzoni.edu.it' }, { status: 200 }),
);
check(
  'spazi attorno al link non impediscono il controllo',
  { accetta: true, link: AVVISO.link, stato: 'ok', sostituito: false },
  v({ ...AVVISO, link: `  ${AVVISO.link}  ` }, { status: 200 }),
);
check(
  'il motivo è sempre esplicito (mai uno scarto silenzioso)',
  true,
  /nessuna home ufficiale/.test(valutaIngressoPerLink(AVVISO, { status: 404 }).motivo),
);

/* ------------------------- 4 · Cablaggio nella pipeline ------------------------- */

console.log('\n— 4. La pipeline di ingestione usa questa regola (una sola verità) —');
const pipeline = readFileSync(new URL('../src/scraper/index.ts', import.meta.url), 'utf8');
check('importa il presidio', true, /presidioLinkIngresso\.ts/.test(pipeline));
check('usa valutaIngressoPerLink', true, /valutaIngressoPerLink\(/.test(pipeline));
check('controlla i link con verificaLinkInLotti', true, /verificaLinkInLotti\(/.test(pipeline));
check('il ping locale duplicato è stato rimosso', false, /function linkRaggiungibile|mappaRaggiungibilita/.test(pipeline));
check('la home arriva dall’anagrafica (non inventata)', true, /homeUfficialeAvviso\(/.test(pipeline));

if (errori > 0) {
  console.error(`\n✗ ${errori} verifiche fallite.`);
  process.exitCode = 1;
} else {
  console.log('\n✅ GATE LINK IN INGRESSO: nessun URL morto in bacheca.');
}
