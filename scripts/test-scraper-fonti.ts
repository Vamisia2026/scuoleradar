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
  MAX_HUB_PER_REGIONE,
  fontiAttive,
  fontiPerProvincia,
  fontiPerRun,
  hubDellaRegione,
  regioneDiProvincia,
} from '../src/scraper/fonti.ts';
import { DATA_VERIFICA_AGGIORNATI, DATA_VERIFICA_TERRITORI } from '../src/scraper/fontiTerritoriali.ts';
import { DATA_VERIFICA_WHITELIST } from '../src/scraper/fontiWhitelist2610.ts';
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

/** Blocchi di verifica HTTP dichiarati dal registro (le date sono contratti). */
const DATE_VERIFICA = new Set([
  DATA_VERIFICA_FONTI, DATA_VERIFICA_TERRITORI, DATA_VERIFICA_AGGIORNATI, DATA_VERIFICA_WHITELIST,
]);

console.log('— A. Igiene del registro fonti —');
check('id unici', FONTI_INTERPELLI.length, new Set(FONTI_INTERPELLI.map((f) => f.id)).size);
check('URL uniche', FONTI_INTERPELLI.length, new Set(FONTI_INTERPELLI.map((f) => f.url)).size);
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
  'fonti attive: verifica datata (blocchi 2026-09-28 / 2026-10-23 / 2026-10-25 / 2026-10-26)',
  [],
  fontiAttive().filter((f) => !DATE_VERIFICA.has(f.verificata ?? '')).map((f) => f.id),
);
check(
  'fonti attive: data di verifica in formato ISO',
  [],
  fontiAttive().filter((f) => !/^\d{4}-\d{2}-\d{2}$/.test(f.verificata ?? '')).map((f) => f.id),
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
check('ogni capoluogo principale ha almeno una fonte attiva', [], CAPOLUOGHI_PRINCIPALI.filter((c) => fontiPerCapoluogo(c.provincia).length === 0).map((c) => c.nome));
check('Torino/Milano/Genova/Bologna/Firenze/Roma/Napoli coperti', true, ['TO', 'MI', 'GE', 'BO', 'FI', 'RM', 'NA'].every((p) => fontiPerCapoluogo(p).length > 0));
// Blocco territoriale (§26.89) + aggiornamento 2026-10-25 + whitelist 2026-10-26:
// in Liguria le fonti sono le pagine per provincia (URL senza anno); il modulo
// «per ambito» del Piemonte resta escluso (righe senza link).
const liguriaAttive = fontiAttive().filter((f) => f.regioni.includes('Liguria') && /provincia\.php/.test(f.url));
check('Liguria: le 4 province hanno un elenco attivo', ['GE', 'IM', 'SP', 'SV'], [
  ...new Set(liguriaAttive.map((f) => f.capoluogo ?? '')),
].sort());
check('Liguria: nessuna fonte legata a un anno scolastico', [], liguriaAttive.filter((f) => /[?&]as=/.test(f.url)).map((f) => f.id));
// La home del portale NON è una fonte: le sue righe sono i quattro indici provinciali, non interpelli.
// §26.97 — la whitelist 26/10/2026 la riproponeva: resta fuori (in `ALIAS_SCARTATI`), con la stessa regola.
check('Liguria: la home del portale non è una fonte', [], FONTI_INTERPELLI.filter((f) => /servizi\.istruzioneliguria\.gov\.it\/?$/.test(f.url)).map((f) => f.id));
check('Piemonte: il modulo «per ambito» resta escluso', 0, fontiAttive().filter((f) => /ric_interpello_ambito/.test(f.url)).length);
check('Piemonte: gli esclusi del modulo dichiarano il motivo', [], FONTI_INTERPELLI.filter((f) => /ric_interpello_ambito/.test(f.url) && (!f.note || f.note.length < 40)).map((f) => f.id));

/* Aggiornamento 2026-10-25: territori prima scoperti e ora con un elenco verificato. */
const provinceAttive = (regione: string) => [...new Set(fontiAttive().filter((f) => f.regioni.includes(regione) && f.capoluogo).map((f) => f.capoluogo ?? ''))];
check('Molise: entrambe le province coperte', ['CB', 'IS'], provinceAttive('Molise').filter((p) => ['CB', 'IS'].includes(p)).sort());
check('Veneto: le sei province dell’aggiornamento sono attive', ['PD', 'RO', 'TV', 'VE', 'VI', 'VR'], provinceAttive('Veneto').sort());
check('Sardegna: Oristano coperta', true, provinceAttive('Sardegna').includes('OR'));
check('Emilia-Romagna: Rimini coperta', true, provinceAttive('Emilia-Romagna').includes('RN'));
// Le province provate e non servibili restano DICHIARATE scoperte, mai coperte «per finta».
check('Veneto: Belluno dichiarata scoperta', [], fontiAttive().filter((f) => f.capoluogo === 'BL').map((f) => f.id));
// §26.97 — Salerno non è più scoperta (ATP Salerno verificato il 26/10/2026); Benevento resta scoperta (403 anti-bot).
check('Campania: Benevento resta scoperta (Salerno coperta dall’ATP)', [], fontiAttive().filter((f) => f.capoluogo === 'BN').map((f) => f.id));
check('Campania: Salerno coperta da una fonte attiva', true, fontiAttive().some((f) => f.capoluogo === 'SA'));
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

/* Blocco territoriale: tetti e rotazione degli hub per regione (§26.89). */
const hubLombardia = hubDellaRegione('Lombardia');
check('regione: hub entro il tetto per regione', true, hubLombardia.length <= MAX_HUB_PER_REGIONE);
check('regione: nessuna URL ripetuta', hubLombardia.length, new Set(hubLombardia.map((f) => f.url)).size);
check(
  'regione: solo hub della regione richiesta',
  true,
  hubLombardia.every((f) => f.tipo === 'hub-istituzionale' && f.regioni.includes('Lombardia')),
);
check(
  'provincia: il suo hub passa davanti agli altri',
  'MI',
  fontiPerProvincia('MI').filter((f) => f.tipo === 'hub-istituzionale')[0]?.capoluogo,
);
check(
  'provincia: il feed nazionale resta nel budget',
  true,
  fontiPerProvincia('MI').some((f) => f.nazionale && f.regioni.length === 0),
);
const hubLombardiaTutti = fontiAttive()
  .filter((f) => f.tipo === 'hub-istituzionale' && f.regioni.includes('Lombardia'))
  .map((f) => f.id)
  .sort();
const vistiInRotazione = new Set<string>();
for (let g = 0; g < hubLombardiaTutti.length; g += 1) {
  for (const f of hubDellaRegione('Lombardia', [], g)) vistiInRotazione.add(f.id);
}
check('regione: la rotazione copre TUTTI gli hub nel ciclo', hubLombardiaTutti, [...vistiInRotazione].sort());

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
// Liferay del MIM: l'avviso è un POST con slug «…interpelli-…» (`/web/<territorio>/-/`);
// senza `eUrlArticolo` occupava le posizioni di `MAX_SEZIONI_HUB` e la sezione vera
// (`/web/<territorio>/interpelli`) non veniva mai raggiunta.
const SEZIONE_MIM = 'https://www.mim.gov.it/web/bergamo/-/interpelli-per-il-conferimento-di-supplenza-n-65';
check('post Liferay del MIM non è una sezione', false, eUrlSezioneReclutamento(SEZIONE_MIM));
check('sezione dell’e-portfolio MIM riconosciuta', true, eUrlSezioneReclutamento('https://www.mim.gov.it/web/milano/interpelli'));
// Portali provinciali: `interpello.php?id=1322` è UN avviso (pagina di dettaglio),
// non un elenco da esplorare; seguirla spendeva le posizioni di `MAX_SEZIONI_HUB`.
const AVVISO_LIGURIA = 'https://servizi.istruzioneliguria.gov.it/interpello.php?id=1322';
check('pagina di dettaglio provinciale non è una sezione', false, eUrlSezioneReclutamento(AVVISO_LIGURIA));

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

