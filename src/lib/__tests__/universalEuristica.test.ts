/**
 * TEST — EURISTICA UNIVERSALE PER TABELLE E LISTE HTML (`src/lib/universalEuristica.ts`).
 *
 * La stessa pagina deve dare le stesse voci qualunque sia il layout (tabella
 * HTML, griglia ARIA, `results-row` di un tabellone, lista WordPress), deve
 * scartare il rumore amministrativo e le righe senza documento apribile, e deve
 * dire `unknown` — non lanciare — quando non riconosce nulla. Verifica anche la
 * purezza (niente rete, LLM, dipendenze), il limite di 250 righe e il cablaggio
 * in `table-reporter` e in `npm test`.
 *
 * Uso: npm run test:universal-euristica  (incluso in `npm test`)
 */
import { readFileSync } from 'node:fs';
import { MAX_HTML_CHARS, MAX_VOCI, parseUniversalHtml, type ExtractedInterpello } from '../universalEuristica.ts';

/** Interfaccia minima per l'ambiente (come gli altri test di prodotto). */
declare const process: { exitCode?: number };

let errori = 0;
function check(nome: string, atteso: unknown, ottenuto: unknown): void {
  const ok = JSON.stringify(atteso) === JSON.stringify(ottenuto);
  if (!ok) errori += 1;
  console.log(`${ok ? '✓' : '✗'} ${nome}: atteso=${JSON.stringify(atteso)} ottenuto=${JSON.stringify(ottenuto)}`);
}

const leggi = (p: string): string => readFileSync(p, 'utf8');
const BASE = 'https://www.icpascoli.edu.it/interpelli/';
const prima = (voci: ExtractedInterpello[]): ExtractedInterpello => voci[0];

/* ------------------- 1) TABELLA HTML (USR: thead + tbody) ------------------ */

const TABELLA_USR = `<html><body>
<table class="tabella-interpelli">
  <thead>
    <tr>
      <th>Oggetto</th><th>Istituto</th><th>Classe di concorso</th>
      <th>Pubblicato il</th><th>Scadenza</th><th>Contatti</th><th>Allegato</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>Interpello per supplenza classe di concorso A022 &ndash; Scienze e tecnologie informatiche</td>
      <td>Istituto Comprensivo &quot;G. Pascoli&quot; (GEIC85000H)</td>
      <td>A022</td>
      <td>12/11/2027</td>
      <td>15/11/2027</td>
      <td>PEC: geic85000h@pec.istruzione.it</td>
      <td><a href="/allegati/bando_4821.pdf">Scarica l'allegato</a></td>
    </tr>
    <tr>
      <td>Determina a contrarre per la fornitura di cancelleria</td>
      <td>Istituto Comprensivo &quot;G. Pascoli&quot;</td>
      <td>&mdash;</td>
      <td>12/11/2027</td>
      <td>20/11/2027</td>
      <td></td>
      <td><a href="/allegati/determina_12.pdf">Scarica</a></td>
    </tr>
    <tr>
      <td>Interpello per supplenza classe di concorso A012 &ndash; Scienze naturali</td>
      <td>Liceo Scientifico G. Galilei</td>
      <td>A012</td>
      <td>12/11/2027</td>
      <td>18/11/2027</td>
      <td></td>
      <td>Nessun allegato disponibile</td>
    </tr>
  </tbody>
</table>
</body></html>`;

console.log('\n— Tabella HTML: colonne lette per significato —');
const tabella = parseUniversalHtml(TABELLA_USR, BASE);
const voceTabella = prima(tabella.items);
check('layout tabella', 'table', tabella.layoutDetected);
check('success', true, tabella.success);
check('rumore e righe senza documento scartati', 1, tabella.items.length);
check('titolo dalla colonna Oggetto', true, voceTabella.title.startsWith('Interpello per supplenza'));
check('istituto senza codice né etichette', 'Istituto Comprensivo "G. Pascoli"', voceTabella.schoolName);
check('codice meccanografico', 'GEIC85000H', voceTabella.schoolCode);
check('classe normalizzata', ['A-22'], voceTabella.classCodes);
check('pubblicazione distinta dalla scadenza', '2027-11-12', voceTabella.publicationDate);
check('scadenza dalla colonna', '2027-11-15', voceTabella.expirationDate);
check('URL assoluto dell’allegato', 'https://www.icpascoli.edu.it/allegati/bando_4821.pdf', voceTabella.directUrl);
check('recapito PEC', 'geic85000h@pec.istruzione.it', voceTabella.contactEmail);
check('deterministico', JSON.stringify(tabella), JSON.stringify(parseUniversalHtml(TABELLA_USR, BASE)));

/* ----------------------- 2) GRIGLIA ARIA (Liguria) ------------------------ */

const GRIGLIA_ARIA = `<div class="results" role="grid">
  <div class="results-head" role="row">
    <div role="columnheader">Scuola</div>
    <div role="columnheader">Codice / Tipologia</div>
    <div role="columnheader">Interpello</div>
    <div role="columnheader">Scadenza</div>
    <div role="columnheader">Azione</div>
  </div>
  <div class="results-row" role="row">
    <div role="cell"><span>Istituto Comprensivo Savona 2</span> <small>STATALE</small></div>
    <div role="cell"><strong>ADEE</strong> Posto intero</div>
    <div role="cell">Interpello per supplenza scuola dell'infanzia</div>
    <div role="cell">Scadenza: 22/11/2027</div>
    <div role="cell"><a href="/dettaglio.php?id=8812">Stampa</a></div>
  </div>
  <div class="results-row" role="row">
    <div role="cell">Istituto Comprensivo Savona 2</div>
    <div role="cell">A022</div>
    <div role="cell">Assemblea sindacale del personale docente</div>
    <div role="cell">Scadenza: 23/11/2027</div>
    <div role="cell"><a href="/dettaglio.php?id=8813">Stampa</a></div>
  </div>
</div>`;

console.log('\n— Griglia ARIA: role="row" e role="cell" —');
const griglia = parseUniversalHtml(GRIGLIA_ARIA, 'https://www.istruzioneliguria.it/interpelli/');
const voceGriglia = prima(griglia.items);
check('layout aria_grid', 'aria_grid', griglia.layoutDetected);
check('una voce: l’assemblea sindacale è rumore', 1, griglia.items.length);
check('titolo dalla colonna Interpello', "Interpello per supplenza scuola dell'infanzia", voceGriglia.title);
check('sostegno ADEE conservato', ['ADEE'], voceGriglia.classCodes);
check('istituto senza etichetta STATALE', 'Istituto Comprensivo Savona 2', voceGriglia.schoolName);
check('scadenza con etichetta', '2027-11-22', voceGriglia.expirationDate);
check('URL di dettaglio assoluto', 'https://www.istruzioneliguria.it/dettaglio.php?id=8812', voceGriglia.directUrl);

/* ------------- 3) TABELLONE A CLASSI (results-row senza ARIA) ------------- */

const TABELLONE_A_CLASSI = `<div class="results">
  <div class="results-head">
    <span>Data</span><span>Scuola</span><span>CDC</span>
    <span>Interpello</span><span>Scadenza</span><span>Azione</span>
  </div>
  <div class="results-row">
    <span>18/11/2027</span><span>Liceo Scientifico G. Galilei</span><span>A026</span>
    <span>Interpello per supplenza di matematica e fisica</span>
    <span>Scadenza: 25/11/2027</span>
    <span><a href="https://www.liceogalilei.edu.it/avviso-881.pdf">Apri</a></span>
  </div>
</div>`;

console.log('\n— Tabellone a classi: stessa lettura, senza attributi ARIA —');
const tabellone = parseUniversalHtml(TABELLONE_A_CLASSI, 'https://www.usrpiemonte.it/interpelli/');
const voceTabellone = prima(tabellone.items);
check('layout griglia', 'aria_grid', tabellone.layoutDetected);
check('una voce', 1, tabellone.items.length);
check('classe A026 → A-26', ['A-26'], voceTabellone.classCodes);
check('istituto', 'Liceo Scientifico G. Galilei', voceTabellone.schoolName);
check('scadenza', '2027-11-25', voceTabellone.expirationDate);
check('pubblicazione', '2027-11-18', voceTabellone.publicationDate);


/* -------------------------- 4) LISTA WORDPRESS ---------------------------- */

const LISTA_WORDPRESS = `<div class="site-main">
  <article class="post type-post">
    <h2 class="entry-title"><a href="https://www.liceogalilei.edu.it/2027/02/interpello-a012/">Interpello per supplenza classe di concorso A012 &ndash; Scienze naturali</a></h2>
    <div class="entry-content"><p>Pubblicato il 3 febbraio 2027. Le domande vanno inviate entro il 12/02/2027 alla PEC geic85000h@pec.istruzione.it</p></div>
  </article>
  <article class="post type-post">
    <h2 class="entry-title"><a href="/2027/02/circolare-famiglie/">Circolare per le famiglie: uscita didattica a Firenze</a></h2>
    <div class="entry-content"><p>Pubblicato il 4 febbraio 2027</p></div>
  </article>
  <article class="post type-post">
    <h2 class="entry-title">Avviso di selezione per supplenza classe A022</h2>
    <div class="entry-content"><p>Testo senza alcun collegamento al documento.</p></div>
  </article>
</div>`;

console.log('\n— Lista WordPress: titolo dal post, date dal corpo —');
const wordpress = parseUniversalHtml(LISTA_WORDPRESS, 'https://www.liceogalilei.edu.it/');
const vocePost = prima(wordpress.items);
check('layout wp_posts', 'wp_posts', wordpress.layoutDetected);
check('una voce: circolare e post senza link scartati', 1, wordpress.items.length);
check('titolo dal titolo del post', true, vocePost.title.startsWith('Interpello per supplenza'));
check('classe dal titolo', ['A-12'], vocePost.classCodes);
check('pubblicazione', '2027-02-03', vocePost.publicationDate);
check('scadenza dal corpo', '2027-02-12', vocePost.expirationDate);
check('URL del permalink', 'https://www.liceogalilei.edu.it/2027/02/interpello-a012/', vocePost.directUrl);
check('PEC dal corpo', 'geic85000h@pec.istruzione.it', vocePost.contactEmail);

/* -------------------- 5) PAGINE CHE NON SI SANNO LEGGERE ------------------ */

const SENZA_ELENCO = `<!DOCTYPE html><html><body><h1>Benvenuti</h1>
  <p>Nessun avviso pubblicato in questa pagina.</p></body></html>`;
const soloLinkInutili = `<table>
  <tr><th>Oggetto</th><th>Scadenza</th></tr>
  <tr><td><a href="/">Interpello per supplenza classe A022</a></td><td>15/11/2027</td></tr>
  <tr><td><a href="/cerca?q=interpello">Interpello per supplenza classe A012</a></td><td>16/11/2027</td></tr>
</table>`;

console.log('\n— Nessun layout riconosciuto: quarantena, non eccezione —');
const sconosciuta = parseUniversalHtml(SENZA_ELENCO, BASE);
check('success false', false, sconosciuta.success);
check('layout unknown', 'unknown', sconosciuta.layoutDetected);
check('nessuna voce inventata', 0, sconosciuta.items.length);
check('motivo esplicito', true, (sconosciuta.error ?? '').includes('nessuna tabella'));
check('home e ricerche non sono documenti', 'unknown', parseUniversalHtml(soloLinkInutili, BASE).layoutDetected);
check('HTML vuoto', 'HTML vuoto', parseUniversalHtml('   ', BASE).error);
check('URL non valido', 'URL sorgente non valido', parseUniversalHtml(SENZA_ELENCO, 'non-un-url').error);
check('nessuna eccezione su HTML malformato', false, parseUniversalHtml('<table><tr><td>', BASE).success);

/* ---------------------- 6) PUREZZA E CABLAGGIO --------------------------- */

console.log('\n— Modulo puro, compatto e cablato nel runner —');
const sorgente = leggi('src/lib/universalEuristica.ts');
check('nessuna rete o LLM', false, /fetch\s*\(|axios|openai|anthropic|supabase|XMLHttpRequest/i.test(sorgente));
check('nessuna dipendenza esterna', false, /from '[^.]/i.test(sorgente));
check(
  'import solo dai moduli condivisi',
  true,
  (sorgente.match(/^import .*$/gm) ?? []).every((riga) =>
    /from '\.\/(?:noiseFilter|pdfDeterminist|universalHtml)'/.test(riga),
  ),
);

const lettore = leggi('src/lib/universalHtml.ts');
check('lettore senza rete', false, /fetch\s*\(|axios|XMLHttpRequest/i.test(lettore));
check('lettore senza import', false, /^\s*import\s/m.test(lettore));

const righe = (p: string): number => leggi(p).split('\n').length;
check('universalEuristica sotto 250 righe', true, righe('src/lib/universalEuristica.ts') <= 250);
check('universalHtml sotto 250 righe', true, righe('src/lib/universalHtml.ts') <= 250);
check('tetto dell’HTML', 400_000, MAX_HTML_CHARS);
check('tetto delle voci', 300, MAX_VOCI);

const reporter = leggi('scripts/table-reporter.ts');
check('il runner importa l’euristica', true, /from '\.\.\/src\/lib\/universalEuristica\.ts'/.test(reporter));
check('il runner la esegue sulla pagina', true, /parseUniversalHtml\(html, target\.url\)/.test(reporter));

const pkg = JSON.parse(leggi('package.json')) as { scripts: Record<string, string> };
check('script dedicato', true, 'test:universal-euristica' in pkg.scripts);
check('CLI di diagnosi', true, 'tabella:universale' in pkg.scripts);
check(
  'guardia nella catena',
  true,
  (pkg.scripts.test ?? '').includes('src/lib/__tests__/universalEuristica.test.ts'),
);

console.log(
  errori === 0
    ? '\n✅ EURISTICA UNIVERSALE: tabelle, griglie e liste lette per significato.'
    : `\n❌ EURISTICA UNIVERSALE: ${errori} errore/i`,
);
process.exitCode = errori === 0 ? 0 : 1;

