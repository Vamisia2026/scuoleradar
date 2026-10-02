/**
 * GUARDIA · FONTI INTERPELLI — Capoluoghi, hub metropolitani e copertura.
 *
 * Verifica il REGISTRO delle fonti (`src/scraper/fonti.ts` + dati in
 * `fontiRegistro.ts`):
 *   · igiene del registro (id unici, URL http(s) reali, niente URL di test);
 *   · fonti non attive SEMPRE con un motivo dichiarato (mai copertura finta);
 *   · copertura delle 20 regioni e dei 12 capoluoghi principali;
 *   · selezione per provincia/run (priorità hub, dedup per URL, tetti di budget);
 *   · scoperta delle SEZIONI di reclutamento dentro un hub (connettore capoluoghi).
 *
 * Uso: npm run test:scraper:fonti (incluso in `npm test`)
 */
import {
  DATA_VERIFICA_FONTI,
  FONTI_INTERPELLI,
  MAX_FONTI_PER_PROVINCIA,
  MAX_FONTI_PER_RUN,
  fontiAttive,
  fontiPerProvincia,
  fontiPerRun,
  regioneDiProvincia,
} from '../src/scraper/fonti.ts';
import {
  CAPOLUOGHI_PRINCIPALI,
  capoluoghiScoperti,
  fontiPerCapoluogo,
  regioniCoperte,
  regioniScoperte,
} from '../src/scraper/fontiCopertura.ts';
import { eUrlSezioneReclutamento, eTitoloNavigazione, scopriSezioniReclutamento } from '../src/scraper/hub.ts';

let errori = 0;
function check(nome: string, atteso: unknown, ottenuto: unknown): void {
  const ok = JSON.stringify(atteso) === JSON.stringify(ottenuto);
  if (!ok) errori += 1;
  console.log(`${ok ? '✓' : '✗'} ${nome}: atteso=${JSON.stringify(atteso)} ottenuto=${JSON.stringify(ottenuto)}`);
}

/* ------------------------------ A · Igiene registro ------------------------------ */

console.log('— A. Igiene del registro fonti —');
check(
  'id unici',
  FONTI_INTERPELLI.length,
  new Set(FONTI_INTERPELLI.map((f) => f.id)).size,
);
check(
  'URL uniche',
  FONTI_INTERPELLI.length,
  new Set(FONTI_INTERPELLI.map((f) => f.url)).size,
);
check(
  'URL http(s) reali (nessun mock)',
  [],
  FONTI_INTERPELLI.filter(
    (f) => !/^https?:\/\/[a-z0-9.-]+\.[a-z]{2,}/i.test(f.url) || /example\.|localhost|127\.0\.0\.1|mock/i.test(f.url),
  ).map((f) => f.url),
);
check(
  'fonti non attive: motivo dichiarato + mai "verificate"',
  [],
  FONTI_INTERPELLI.filter((f) => !f.attiva && (!f.note || f.note.length < 20 || f.verificata !== null)).map((f) => f.id),
);
check(
  'fonti attive: verifica datata',
  [],
  fontiAttive().filter((f) => f.verificata !== DATA_VERIFICA_FONTI).map((f) => f.id),
);
check(
  'hub attivi con capoluogo; aggregatori senza capoluogo',
  [],
  fontiAttive()
    .filter((f) => (f.tipo === 'hub-istituzionale' ? !f.capoluogo || f.nazionale : f.nazionale === false || f.capoluogo !== null))
    .map((f) => f.id),
);
check('hub istituzionali attivi (>= 15)', true, fontiAttive().filter((f) => f.tipo === 'hub-istituzionale').length >= 15);

/* --------------------------- B · Copertura del territorio --------------------------- */

console.log('\n— B. Copertura regioni e capoluoghi —');
check('regioni con fonte attiva (19/20)', 19, regioniCoperte(true).length);
check('regione senza hub dedicato (dichiarata)', ["Valle d'Aosta"], regioniScoperte());
check('esiste il feed nazionale', true, fontiAttive().some((f) => f.nazionale && f.regioni.length === 0));
check('capoluoghi principali scoperti', [], capoluoghiScoperti());
check(
  'ogni capoluogo principale ha almeno una fonte attiva',
  [],
  CAPOLUOGHI_PRINCIPALI.filter((c) => fontiPerCapoluogo(c.provincia).length === 0).map((c) => c.nome),
);
check('Torino/Milano/Genova/Bologna/Firenze/Roma/Napoli coperti', true, ['TO', 'MI', 'GE', 'BO', 'FI', 'RM', 'NA'].every((p) => fontiPerCapoluogo(p).length > 0));
check('regione di MI = Lombardia', 'Lombardia', regioneDiProvincia('MI'));
check('provincia inesistente → null', null, regioneDiProvincia('ZZ'));

/* --------------------------- C · Selezione per provincia/run --------------------------- */

console.log('\n— C. Selezione delle fonti (priorità, dedup, budget) —');
const perMilano = fontiPerProvincia('MI');
check('Milano: hub della Lombardia in testa', 'hub-istituzionale', perMilano[0]?.tipo);
check('Milano: entro il tetto per provincia', true, perMilano.length <= MAX_FONTI_PER_PROVINCIA);
check('Milano: include il feed nazionale', true, perMilano.some((f) => f.nazionale && f.regioni.length === 0));
check('Milano: nessun duplicato di URL', perMilano.length, new Set(perMilano.map((f) => f.url)).size);
check('Milano: solo fonti attive', true, perMilano.every((f) => f.attiva && f.verificata !== null));
check(
  'Milano: hub della Lombardia presenti',
  true,
  perMilano.filter((f) => f.tipo === 'hub-istituzionale').every((f) => f.regioni.includes('Lombardia')),
);

const run = fontiPerRun(['MI', 'TO']);
check('run: entro il tetto globale', true, run.length <= MAX_FONTI_PER_RUN);
check('run: nessun duplicato di URL', run.length, new Set(run.map((f) => f.url)).size);
check('run: prima gli hub locali', 'hub-istituzionale', run[0]?.tipo);
check('run: contiene hub di Milano e Torino', true, ['MI', 'TO'].every((p) => run.some((f) => f.capoluogo === p)));
check('run: la fonte del Piemonte resta coperta', true, run.some((f) => f.regioni.includes('Piemonte')));
check('provincia senza fonte dedicata → resta il feed nazionale', true, fontiPerProvincia('ZZ').some((f) => f.nazionale));
check(
  'run: archivi regionali esclusi per default (evita post nazionali duplicati)',
  0,
  run.filter((f) => f.tipo === 'aggregatore' && f.regioni.length > 0).length,
);
check(
  'run: archivi disponibili su richiesta (backfill)',
  true,
  fontiPerRun(['MI'], MAX_FONTI_PER_RUN, { includiArchivi: true }).some(
    (f) => f.tipo === 'aggregatore' && f.regioni.includes('Lombardia'),
  ),
);

/* ------------------------ D · Connettore hub: scoperta sezioni ------------------------ */

console.log('\n— D. Scoperta delle SEZIONI di reclutamento dentro un hub —');
check('home dell’ente non è una sezione', false, eUrlSezioneReclutamento('https://www.istruzionepiemonte.it/'));
check('privacy esclusa', false, eUrlSezioneReclutamento('https://www.istruzionepiemonte.it/privacy'));
check('PDF escluso', false, eUrlSezioneReclutamento('https://www.istruzionepiemonte.it/interpelli/avviso-a022.pdf'));
check('sezione interpelli riconosciuta', true, eUrlSezioneReclutamento('https://istruzione.umbria.it/interpelli/interpelli-aperti/'));
check(
  'sezione di reclutamento ATA riconosciuta',
  true,
  eUrlSezioneReclutamento('https://www.istruzionepiemonte.it/area-immissioni-in-ruolo/reclutamento-personale-ata/'),
);

const HUB_HTML = `
<html><head><title>USR di prova</title></head><body>
  <nav>
    <a href="/privacy">Privacy</a>
    <a href="https://www.facebook.com/usr">Facebook</a>
    <a href="https://esempio-esterno.example/interpelli/">Altro ente</a>
    <a href="/allegati/avviso.pdf">Avviso PDF</a>
  </nav>
  <main>
    <a href="/area/concorsi-e-nomine/">Concorsi e nomine</a>
    <a href="/avvisi-pubblici-3/">Avvisi pubblici</a>
    <a href="/interpelli/elenco-interpelli-aperti/">Elenco interpelli aperti</a>
    <a href="/interpelli/elenco-interpelli-aperti/#sezione">Elenco interpelli aperti</a>
  </main>
</body></html>`;
const sezioni = scopriSezioniReclutamento(HUB_HTML, 'https://www.usr-di-prova.it/');
check('sezioni scoperte', 3, sezioni.length);
check('la sezione INTERPELLI è la prima', true, sezioni[0]?.includes('/interpelli/elenco-interpelli-aperti/'));
check('nessun link di rumore fra le sezioni', [], sezioni.filter((s) => /privacy|facebook|esempio-esterno|\.pdf/i.test(s)));
check('frammento rimosso', true, sezioni.every((s) => !s.includes('#')));
check('max rispettato', true, scopriSezioniReclutamento(HUB_HTML, 'https://www.usr-di-prova.it/', 1).length === 1);
check(
  'host esterni esclusi dal connettore',
  [],
  scopriSezioniReclutamento(HUB_HTML, 'https://www.usr-di-prova.it/').filter((s) => !s.startsWith('https://www.usr-di-prova.it/')),
);

console.log('\n— E. Rumore di navigazione degli hub (menu/archivi/ricerca) —');
check('titolo di navigazione riconosciuto', true, eTitoloNavigazione('Categorie e tag'));
check('archivio comunicazioni riconosciuto', true, eTitoloNavigazione('Archivio comunicazioni globale'));
check('paginazione riconosciuta', true, eTitoloNavigazione('Pagina 2'));
check('titolo vuoto = navigazione', true, eTitoloNavigazione('   '));
check('avviso vero NON è navigazione', false, eTitoloNavigazione('Dirigenti scolastici: avviso di selezione esperti'));
check('elenco avvisi NON è navigazione', false, eTitoloNavigazione('Elenco interpelli aperti — USR Umbria'));
check('interpello vero NON è navigazione', false, eTitoloNavigazione('Interpello supplenza A-022 — Liceo Manzoni'));

console.log(`\n${errori === 0 ? '✅' : '❌'} FONTI INTERPELLI: ${errori} errore/i`);
if (errori > 0) process.exitCode = 1;

