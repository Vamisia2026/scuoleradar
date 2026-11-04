/**
 * TEST — LESSICO E TARGET DELL'INGESTIONE (§26.141).
 *
 * «Trovare è più importante che scartare» vale anche a monte: un bando vero che non
 * si chiama «interpello» usciva dal perimetro. Questa guardia fissa:
 *   · le parole che l'ingestione DEVE riconoscere (`supplenza`, `MAD`, «messa a
 *     disposizione», «ricerca di personale», «avviso pubblico», «esperto esterno»,
 *     «collaboratore scolastico», «assistente amministrativo») e la categoria
 *     `Personale ATA`, ammessa in bacheca;
 *   · i nuovi TARGET: Albo Pretorio e Amministrazione Trasparente → Bandi di
 *     concorso entrano fra le pagine-elenco, e i loro allegati fra i bandi;
 *   · il confine INVARIATO del rumore: scioperi, organi collegiali e circolari fuori
 *     dal pre-filtro; «consigli di classe» e «menu mensa» fuori al gate di pertinenza;
 *     «concorso» NON è un indicatore positivo (in una scuola è anche quello degli alunni);
 *   · il rumore che si è STRETTO (§26.142): gli atti interni — «permessi retribuiti»,
 *     «diritto allo studio 150 ore», «riconoscimento dei servizi», «proclamazione
 *     degli eletti» — sono silenziati anche quando il titolo dice «interpello».
 *
 * Uso: npm run test:lessico-ingestione  (incluso in `npm test`)
 */
import { readFileSync } from 'node:fs';
import { CATEGORIE_AMMESSE, motivoScartoOpportunita } from '../src/scraper/qualitaOpportunita.ts';
import { rilevaCategoriaAvviso, sembraOpportunita } from '../src/scraper/parser.ts';
import { isAdministrativeNoise } from '../src/lib/noiseFilter.ts';
import { INDICATORI_RECLUTAMENTO } from '../src/lib/noiseFilterReclutamento.ts';
import { allegatiBando } from '../src/scraper/allegatiBando.ts';
import { linkInterpelliScuola } from '../src/scraper/linkScuola.ts';
import { eUrlElenco } from '../src/scraper/paginaElenco.ts';

declare const process: { exitCode?: number };

let errori = 0;
function check(nome: string, atteso: unknown, ottenuto: unknown): void {
  const ok = JSON.stringify(atteso) === JSON.stringify(ottenuto);
  if (!ok) errori += 1;
  console.log(`${ok ? '✓' : '✗'} ${nome}: atteso=${JSON.stringify(atteso)} ottenuto=${JSON.stringify(ottenuto)}`);
}

const leggi = (p: string): string => readFileSync(p, 'utf8');
const OGGI = new Date().toISOString().slice(0, 10);

/* --------------------- 1) IL DIZIONARIO DELLE FONTI ---------------------- */

console.log('\n— 1. Le parole con cui le scuole pubblicano il reclutamento —');
const POSITIVI = [
  'Supplenza per la classe A022',
  'MAD scuola secondaria di primo grado',
  'Messa a disposizione per supplenza',
  'Ricerca di personale docente',
  'Avviso pubblico per il conferimento di incarichi',
  'Collaboratore scolastico a tempo determinato',
  'Assistente amministrativo — graduatoria',
  'Esperto esterno per progetto PNRR',
];
for (const testo of POSITIVI) check(`«${testo}» è un’opportunità`, true, sembraOpportunita(testo));
for (const testo of ['Menu mensa della settimana', 'Sciopero nazionale', 'Consigli di classe — convocazione']) {
  check(`«${testo}» NON è un’opportunità`, false, sembraOpportunita(testo));
}

console.log('\n— 2. Le categorie: il personale ATA esiste, e si può pubblicare —');
check('bando ATA → categoria «Personale ATA»', 'Personale ATA', rilevaCategoriaAvviso('Avviso per collaboratore scolastico'));
check('MAD → interpello', 'Interpello / Supplenza', rilevaCategoriaAvviso('MAD per supplenza A022'));
check('un interpello che cita l’ATA resta un interpello', 'Interpello / Supplenza', rilevaCategoriaAvviso('Interpello supplenza A022 — personale ATA in servizio'));
check('la categoria ATA è AMMESSA (non finisce nell’«Altro»)', true, (CATEGORIE_AMMESSE as readonly string[]).includes('Personale ATA'));


/* ------------------ 3) IL RUMORE RESTA FUORI (invariato) ------------------ */

console.log('\n— 3. Il filtro del rumore NON si allarga —');
const preFiltro = leggi('src/lib/noiseFilter.ts');
check('gli indicatori nuovi vivono nel modulo sorello e sono cablati', true, /\.\.\.INDICATORI_RECLUTAMENTO/.test(preFiltro));
check('il pre-filtro resta sotto la soglia di attenzione (250 righe)', true, preFiltro.split('\n').length <= 250);
check('«concorso» NON è un indicatore positivo', false, INDICATORI_RECLUTAMENTO.some((re) => re.test('Concorso di poesia per gli alunni')));
for (const [titolo, testo] of [
  ['Sciopero nazionale del personale', ''],
  ['Elezioni degli organi collegiali', ''],
  ['Circolare n. 12', 'Circolare per le famiglie: uscita didattica al museo'],
] as Array<[string, string]>) {
  check(`pre-filtro: «${titolo}» è rumore`, true, isAdministrativeNoise(testo, titolo).isNoise);
}
for (const titolo of ['Convocazione consigli di classe', 'Menu mensa della settimana']) {
  check(`gate di pertinenza: «${titolo}» non è un’opportunità`, true, motivoScartoOpportunita({ title: titolo }, OGGI) !== null);
}
for (const [titolo, testo] of [
  ['Interpello 52. Personale Docente e A.T.A. Permessi retribuiti per la partecipazione a corsi', ''],
  ['Permessi retribuiti per il diritto allo studio (150 ore)', ''],
  ['Decreto di riconoscimento dei servizi prestati in altro ruolo', ''],
  ['Proclamazione degli eletti al Consiglio di Istituto', ''],
] as Array<[string, string]>) {
  check(`atto interno (§26.142): «${titolo.slice(0, 34)}…» è rumore`, true, isAdministrativeNoise(testo, titolo).isNoise);
}
check(
  'ma un interpello che li cita nel corpo resta (§26.142)',
  false,
  isAdministrativeNoise(
    'Interpello per supplenza A-022: l’incarico dà diritto ai permessi retribuiti per il diritto allo studio.',
    'Interpello supplenza A-022',
  ).isNoise,
);
check('ma il reclutamento vero non è rumore', false, isAdministrativeNoise('Ricerca di personale docente — selezione per esperto esterno', 'Avviso').isNoise);

/* --------------------- 4) I TARGET: ALBO E TRASPARENZA ------------------- */

console.log('\n— 4. Albo Pretorio e Amministrazione Trasparente sono elenchi —');
for (const url of [
  'https://www.istituto.edu.it/albo-pretorio/',
  'https://www.istituto.edu.it/amministrazione-trasparente/bandi-di-concorso/',
  'https://www.istituto.edu.it/personale/',
]) {
  check(`«${url}» è una pagina-elenco`, true, eUrlElenco(url));
}
const home = `<html><body>
  <a href="/interpelli/">Interpelli</a>
  <a href="/amministrazione-trasparente/bandi-di-concorso/">Amministrazione trasparente — Bandi di concorso</a>
  <a href="/personale-ata/">Personale ATA</a>
  <a href="/login">Login</a>
</body></html>`;
const linkTrovati = linkInterpelliScuola(home, 'https://www.istituto.edu.it/', 3).map((l) => l.url);
check('il deep crawl trova il target «bandi di concorso»', true, linkTrovati.some((u) => u.includes('bandi-di-concorso')));
check('e continua a preferire gli interpelli', true, Boolean(linkTrovati[0]?.includes('interpelli')));
check('il login resta escluso', false, linkTrovati.some((u) => u.includes('login')));

const albo = `<html><body>
  <a href="/documenti/bando-assistente-amministrativo.pdf">Bando assistente amministrativo</a>
  <a href="/documenti/circolare-mensa.pdf">Circolare mensa</a>
</body></html>`;
const allegati = allegatiBando(albo, 'https://www.istituto.edu.it/albo-pretorio/', 4).map((a) => a.url);
check('il PDF del bando ATA è un allegato di bando', true, allegati.some((u) => u.includes('bando-assistente-amministrativo')));
check('la circolare della mensa no', false, allegati.some((u) => u.includes('circolare-mensa')));

console.log('\n— 5. Cablaggio —');
const pkg = leggi('package.json');
check('guardia dedicata in package.json', true, /"test:lessico-ingestione": "tsx scripts\/test-lessico-ingestione.ts"/.test(pkg));
check('guardia nella catena di `npm test`', true, /scripts\/test-lessico-ingestione\.ts/.test(pkg));

console.log(
  errori === 0
    ? '\n✅ LESSICO E TARGET: si cercano le parole delle fonti, il rumore resta fuori.'
    : `\n❌ LESSICO E TARGET: ${errori} errore/i`,
);
process.exitCode = errori === 0 ? 0 : 1;
