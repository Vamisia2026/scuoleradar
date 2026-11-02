/**
 * TEST — IL CONTENITORE DELL'ATTO E IL TITOLO DI RUMORE (§26.130).
 *
 * Perché serve. Su CT, il 2026-11-01, la bacheca conteneva una sola riga:
 * la circolare «Sciopero 30 ottobre 2026 – promemoria» di `vergaviagrande.edu.it`,
 * con scadenza **2026-12-07**. Quella data non era nella circolare: era il titolo
 * di un'ALTRA circolare nella colonna laterale («chiusura uffici 02 novembre e 07
 * dicembre 2026»). Due difetti, una sola riga inventata:
 *
 *   1. `$('article, main, …').first()` non è una lista di priorità: per cheerio
 *      è un'unica espressione e `.first()` prende il primo elemento nell'ORDINE
 *      DEL DOCUMENTO — il `<main>` che avvolge anche la colonna laterale. Ora la
 *      priorità è esplicita (`src/scraper/contenitoreAvviso.ts`).
 *   2. il giudizio di rumore si applicava solo alle RIGHE di tabella: né l'elenco
 *      adattivo né la sgranatura chiedevano niente al TITOLO della voce, che è
 *      l'unico testo disponibile prima di aprire l'avviso.
 *
 * La guardia fissa tre cose: il contenitore scelto è l'atto (e la trappola della
 * colonna laterale è documentata), il pre-filtro non blocca gli interpelli veri
 * (sostegno compreso) e i tre percorsi di scrittura lo applicano davvero.
 *
 * Uso: npm run test:contenitore-avviso  (incluso in `npm test`)
 */
import { readFileSync } from 'node:fs';
import {
  MINIMO_TESTO_CONTENITORE,
  SELETTORI_CONTENITORE,
  scegliContenitore,
} from '../src/scraper/contenitoreAvviso.ts';
import { scadenzaDaTesto } from '../src/lib/scadenzaTesto.ts';
import { isAdministrativeNoise } from '../src/lib/noiseFilter.ts';

declare const process: { exitCode?: number };

let errori = 0;
function check(nome: string, atteso: unknown, ottenuto: unknown): void {
  const ok = JSON.stringify(atteso) === JSON.stringify(ottenuto);
  if (!ok) errori += 1;
  console.log(`${ok ? '✓' : '✗'} ${nome}: atteso=${JSON.stringify(atteso)} ottenuto=${JSON.stringify(ottenuto)}`);
}

const leggi = (p: string): string => readFileSync(p, 'utf8');
const spazi = (t: string): string => t.replace(/\s+/g, ' ').trim();
/** Il giudizio di `titoloVoceERumore` in `table-reporter`, riprodotto sul modulo puro. */
const rumoreDiTitolo = (titolo: string): boolean =>
  !spazi(titolo) || isAdministrativeNoise(titolo, titolo).isNoise;

/* ---------------- 1) LA PAGINA VERA: l'atto, non la colonna laterale --------- */

console.log('\n— 1. Circolare di sciopero su WordPress scolastico (caso CT) —');

const PAGINA_CT = `<!doctype html><html><head>
<title>Sciopero 30 ottobre 2026 - promemoria - Istituto Comprensivo Giovanni Verga</title>
</head><body>
<nav class="menu"><a href="/">Home</a><a href="/circolari">Le circolari</a></nav>
<main id="content">
  <article class="post">
    <h1>Circolare 84 — Sciopero 30 ottobre 2026 – promemoria</h1>
    <p>Si ricorda alle famiglie che è stato indetto uno sciopero generale per il
    30/10/2026 dal sindacato Ctic856009-psc. Si invitano i sig.ri genitori a
    verificare la presenza del personale scolastico e a comunicare l'eventuale
    mancata fruizione del servizio.</p>
  </article>
  <aside class="sidebar">
    <h2>Ultime circolari</h2>
    <ul>
      <li><a href="/circolare/83/">Circ. n. 83 Sospensione attività didattica e chiusura uffici 02 novembre e 07 dicembre 2026</a></li>
      <li><a href="/circolare/82/">Circ. n. 82 Variazione temporanea del servizio scuolabus</a></li>
    </ul>
  </aside>
</main>
<footer><p>Scadenza presentazione domande: 31/12/2026 — sito realizzato con WordPress</p></footer>
</body></html>`;

const scelto = scegliContenitore(PAGINA_CT);
check('il contenitore scelto è l’atto', 'article', scelto.selettore);
check('la colonna laterale non entra nel testo', false, scelto.testo.includes('Sospensione attività didattica'));
check('il piede non entra nel testo', false, scelto.testo.includes('31/12/2026'));
check('la circolare non dichiara alcun termine', null, scadenzaDaTesto(scelto.testo));
console.log(
  `  · la pagina INTERA invece inventa una scadenza: ${scadenzaDaTesto(PAGINA_CT) ?? 'nessuna'} ` +
    '(è il titolo di un’altra circolare)',
);
check('la pagina intera inventa una scadenza (la trappola è reale)', true, scadenzaDaTesto(PAGINA_CT) !== null);

/* ------------------------- 2) Priorità e ripieghi --------------------------- */

console.log('\n— 2. Ordine di priorità, soglia minima e ripiego —');

check('il primo selettore è il più specifico', 'article', SELETTORI_CONTENITORE[0]);
check(
  '`article` viene prima di `main` (l’involucro con la colonna laterale)',
  true,
  SELETTORI_CONTENITORE.indexOf('article') < SELETTORI_CONTENITORE.indexOf('main'),
);
check('soglia minima dichiarata', true, MINIMO_TESTO_CONTENITORE >= 100);

const SOLO_MAIN = `<main><p>${'atto '.repeat(60)}</p></main>`;
check('senza `article` si legge `main`', 'main', scegliContenitore(SOLO_MAIN).selettore);

const CARD_CORTA = `<main><article>Condividi</article><p>${'atto '.repeat(60)}</p></main>`;
check('una card troppo corta non è l’atto', 'main', scegliContenitore(CARD_CORTA).selettore);

const DUE_CANDIDATI = `<article>${'a'.repeat(150)}</article><div class="entry-content">${'b'.repeat(150)}</div>`;
check('a parità di testo vince il primo in priorità', 'article', scegliContenitore(DUE_CANDIDATI).selettore);

const SENZA_CONTENITORE = `<div><p>${'testo '.repeat(40)}</p></div>`;
const ripiego = scegliContenitore(SENZA_CONTENITORE);
check('nessun contenitore → si legge la pagina', null, ripiego.selettore);
check('nessun contenitore → il testo c’è', true, ripiego.testo.length >= MINIMO_TESTO_CONTENITORE);

check('HTML vuoto non lancia', '', scegliContenitore('').testo);

const SENZA_SPAZI = `<article>  entro   il\n 12/11/2026 ${'x'.repeat(200)}</article>`;
check(
  'gli spazi sono normalizzati',
  true,
  spazi(scegliContenitore(SENZA_SPAZI).testo).startsWith('entro il 12/11/2026'),
);

/* --------------------- 3) Il titolo: rumore sì, interpello no ---------------- */

console.log('\n— 3. Il pre-filtro sul TITOLO della voce —');

const RUMORE: readonly string[] = [
  'Sciopero 30 ottobre 2026 – promemoria',
  'Circolare 84 Sciopero 30 ottobre 2026',
  'Circolare per le famiglie: assemblea sindacale del 12 novembre',
  'Determina a contrarre per la fornitura di carta — CIG Z1A2B3C4D5',
  '',
];
for (const titolo of RUMORE) {
  check(`rumore: «${titolo || '(titolo vuoto)'}»`, true, rumoreDiTitolo(titolo));
}

const OPPORTUNITA: readonly string[] = [
  'Interpello per supplenza su posto di sostegno — AAAA scuola primaria',
  'Avviso di selezione per il conferimento di supplenza A022',
  'Interpello ADSS scuola secondaria di secondo grado',
  'Disponibilità per supplenza breve classe di concorso A013',
  'Interpello per il conferimento di supplenza — progetto PCTO entro il 12/11/2026',
];
for (const titolo of OPPORTUNITA) {
  check(`opportunità: «${titolo}»`, false, rumoreDiTitolo(titolo));
}

// Il titolo che DICHIARA sciopero è rumore anche se dice «interpello»: è la
// regola 1 del modulo (l'atto nel titolo vince), la stessa che già si applica
// alle righe di tabella. Un interpello che *parla* di sciopero nel corpo resta,
// ma il corpo qui non esiste ancora: esiste solo il titolo.
console.log('  · un titolo che dichiara sciopero è rumore anche con «interpello» (regola delle righe)');
check(
  'titolo con sciopero: stessa regola delle righe di tabella',
  true,
  rumoreDiTitolo('Interpello A022 — sciopero del 30 ottobre'),
);


/* ------------------------ 4) Le tre porte di scrittura ----------------------- */

console.log('\n— 4. I percorsi di scrittura applicano il pre-filtro —');

const fonte = leggi('scripts/table-reporter.ts');
function sezione(da: string, a: string): string {
  const inizio = fonte.indexOf(da);
  const fine = fonte.indexOf(a, inizio + 1);
  return inizio < 0 || fine < 0 ? '' : fonte.slice(inizio, fine);
}

check(
  'la lettura dell’avviso usa il contenitore in priorità',
  true,
  sezione('async function leggiAvvisoCompleto(', 'async function leggiAvvisoPdf(').includes('scegliContenitore('),
);
check('la vecchia lista-ordine non è più nel codice', false, fonte.includes("$('article, main, .entry-content"));
check(
  'la porta di scrittura adattiva chiede il titolo',
  true,
  sezione('function recordDaVoceAdattiva(', 'function recordsDaElencoAdattivo(').includes(
    'titoloVoceERumore(voce.title)',
  ),
);
check(
  'l’elenco adattivo conta il rumore',
  true,
  sezione('function recordsDaElencoAdattivo(', 'async function approfondisciVociSenzaScadenza(').includes(
    'titoloVoceERumore(voce.title)',
  ),
);
const sgranatura = sezione(
  'async function approfondisciVociSenzaScadenza(',
  'function extractRecordsFromHtml(',
);
check('la sgranatura non apre i titoli di rumore', true, sgranatura.includes('titoloVoceERumore(voce.title)'));
check(
  'il gate precede la richiesta: il rumore non entra in «documenti letti»',
  true,
  sgranatura.indexOf('titoloVoceERumore(voce.title)') < sgranatura.indexOf('esito.richieste += 1'),
);
check(
  'la misura si stampa anche con soli titoli di rumore',
  true,
  sgranatura.includes('esito.rumore > 0'),
);

console.log(
  errori === 0
    ? '\n✅ CONTENITORE DELL’ATTO: l’atto è l’atto, e il rumore non entra dai titoli.'
    : `\n❌ CONTENITORE DELL’ATTO: ${errori} errore/i`,
);
if (errori > 0) process.exitCode = 1;


