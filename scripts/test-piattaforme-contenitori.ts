/**
 * TEST — CONTENITORI PUBBLICI DI UNA PIATTAFORMA DI LOGIN (§26.108).
 *
 * Perché serve: la §26.101 aveva stabilito che un link PROFONDO su una
 * piattaforma scolastica (`nuvola.madisoft.it/bacheca-digitale/bacheca/…`) è
 * l'avviso che la scuola ha pubblicato, non un muro di credenziali. La condizione
 * era «almeno tre segmenti e l'ultimo non è una pagina di accesso», e con quella
 * misura passava anche
 * `nuvola.madisoft.it/interpelli/<CODICE>/docenti/<uuid>/candidatura`: pagina
 * 200, 1.281 byte, guscio JavaScript `noindex,nofollow`, e dopo il login il
 * modulo di candidatura del docente. Un click su un login spacciato per «avviso
 * ufficiale», cioè il difetto che la regola doveva impedire.
 *
 * Regola verificata qui: su una piattaforma di LOGIN il percorso deve stare in un
 * contenitore PUBBLICO (bacheca/albo/pubblicazioni/documenti) oppure essere un
 * documento; le piattaforme documentali pure (Gecodoc, `login: false`) restano
 * invariate.
 *
 * Perché un file separato: `scripts/test-sgranatura.ts` era già a 249 righe e il
 * gate strutturale ha il tetto delle 250 (soft) e delle 300 (errore) — le prove
 * della regola nuova vivono qui invece di sfondare quel tetto.
 *
 * Uso: npm run test:piattaforme-contenitori  (incluso in `npm test`)
 */
import { readFileSync } from 'node:fs';
import { eAvvisoSuPiattaforma } from '../src/scraper/allegatiPiattaforma.ts';

declare const process: { exitCode?: number };

let errori = 0;
function check(nome: string, atteso: unknown, ottenuto: unknown): void {
  const ok = JSON.stringify(atteso) === JSON.stringify(ottenuto);
  if (!ok) errori += 1;
  console.log(
    `${ok ? '✓' : '✗'} ${nome}: atteso=${JSON.stringify(atteso)} ottenuto=${JSON.stringify(ottenuto)}`,
  );
}

const leggi = (p: string): string => readFileSync(p, 'utf8');

/** Il caso segnalato: il modulo di candidatura di Nuvola (URL reale). */
const CANDIDATURA =
  'https://nuvola.madisoft.it/interpelli/COIC82200C/docenti/54c4e881-6a85-4fa8-a312-468bbcefdae9/candidatura';

/* ------------------- 1) L'AREA APPLICATIVA NON È UN AVVISO ---------------- */

console.log('\n— 1. Su una piattaforma di login il modulo privato resta fuori —');
check('modulo di candidatura (caso segnalato)', false, eAvvisoSuPiattaforma(CANDIDATURA));
check(
  'stessa area senza il segmento finale',
  false,
  eAvvisoSuPiattaforma(
    'https://nuvola.madisoft.it/interpelli/COIC82200C/docenti/54c4e881-6a85-4fa8-a312-468bbcefdae9',
  ),
);
check(
  'modulo di domanda su Nuvola',
  false,
  eAvvisoSuPiattaforma('https://nuvola.madisoft.it/area-riservata/docenti/domanda'),
);
check(
  'modulo dentro un contenitore pubblico (l’ultimo segmento vince)',
  false,
  eAvvisoSuPiattaforma('https://nuvola.madisoft.it/bacheca-digitale/bacheca/COIC82200C/candidatura'),
);

/* -------------- 2) IL CONTENITORE PUBBLICO RESTA UN AVVISO --------------- */

console.log('\n— 2. Bacheca, albo e documenti restano gli avvisi veri —');
check(
  'bacheca profonda (§26.101, invariata)',
  true,
  eAvvisoSuPiattaforma('https://nuvola.madisoft.it/bacheca-digitale/bacheca/BGIC85100N/4/IN_PUBBLICAZIONE/abc'),
);
check(
  'PDF su piattaforma di login',
  true,
  eAvvisoSuPiattaforma('https://nuvola.madisoft.it/bacheca-digitale/documenti/avviso-a022.pdf'),
);
check(
  'albo di una piattaforma documentale (Gecodoc, login: false)',
  true,
  eAvvisoSuPiattaforma('https://rmic81200p.gecodoc.it/albo/12/2027'),
);
check('login di piattaforma', false, eAvvisoSuPiattaforma('https://www.portaleargo.it/argoweb/login'));
check('home di piattaforma', false, eAvvisoSuPiattaforma('https://www.portaleargo.it/'));
check('sito di scuola (non è una piattaforma)', false, eAvvisoSuPiattaforma('https://www.zenale.edu.it/pagine/interpelli'));

/* ------------------- 3) LA REGOLA VIVE IN UN SOLO POSTO ------------------ */

console.log('\n— 3. Una sola dichiarazione, usata dall’ingestione —');
const allegati = leggi('src/scraper/allegatiPiattaforma.ts');
check('contenitori pubblici dichiarati', true, /RE_CONTENITORE_PUBBLICO/.test(allegati));
check('la condizione vale solo per le piattaforme di login', true, /piattaforma\.login\s*&&/.test(allegati));
check(
  'i segmenti-modulo sono esclusi sempre',
  true,
  /RE_SEGMENTO_LOGIN/.test(allegati) && /candidatur/.test(allegati),
);

const reporter = leggi('scripts/table-reporter.ts');
check('il runner usa la funzione, non una copia', true, /eAvvisoSuPiattaforma\(sourceUrl\)/.test(reporter));

const pkg = JSON.parse(leggi('package.json')) as { scripts: Record<string, string> };
check('script dedicato', true, 'test:piattaforme-contenitori' in pkg.scripts);
check('guardia nella catena', true, (pkg.scripts.test ?? '').includes('scripts/test-piattaforme-contenitori.ts'));

console.log(
  errori === 0
    ? '\n✅ CONTENITORI DI PIATTAFORMA: la bacheca è un avviso, l’area riservata no.'
    : `\n❌ CONTENITORI DI PIATTAFORMA: ${errori} errore/i`,
);
process.exitCode = errori === 0 ? 0 : 1;
