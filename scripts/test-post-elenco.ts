/**
 * GUARDIA · ELENCHI DI POST (WordPress, Liferay/MIM, feed RSS).
 *
 * Copre `src/scraper/postElenco.ts` (quali post?), `postFeed.ts` (feed RSS),
 * `articoloPost.ts` (che cosa dice il post?) e `postRaccolta.ts` (post → avvisi)
 * con HTML/XML costruiti sui DOM REALI verificati il 23/10/2026:
 *   · category WordPress (`fe.istruzioneer.gov.it/category/interpelli_docenti/`),
 *     con articoli, paginazione, sidebar e menu da scartare;
 *   · e-portfolio Liferay del MIM (`mim.gov.it/web/bergamo/-/…`), breadcrumb nel
 *     testo e data «Venerdì, 23 ottobre 2026»;
 *   · feed RSS della categoria (titolo, link, `pubDate` in RFC 822).
 *
 * I frammenti stanno in `scripts/fixtures/postElencoHtml.ts` (il test resta sotto
 * le 250 righe del gate strutturale). Nessuna rete: il downloader dei post è
 * iniettato. Le prove dal vivo stanno in `scripts/verifica-fonti-scraper.ts`
 * (npm run fonti:verifica).
 *
 * Uso: npm run test:scraper:post
 */
import { estraiContenutoArticolo } from '../src/scraper/articoloPost.ts';
import { eFeedDocumento, estraiPostDaFeed } from '../src/scraper/postFeed.ts';
import { eUrlArticolo } from '../src/scraper/paginaElenco.ts';
import { ePaginaPostElenco, eUrlPost, estraiPostElenco } from '../src/scraper/postElenco.ts';
import { espandiPostInAvvisi } from '../src/scraper/postRaccolta.ts';
import {
  ARTICOLO_MIM,
  ARTICOLO_WP,
  FEED,
  FEED_BASE,
  MIM_BASE,
  MIM_ELENCO,
  WP_BASE,
  WP_ELENCO,
} from './fixtures/postElencoHtml.ts';

let errori = 0;
function check(nome: string, atteso: unknown, ottenuto: unknown): void {
  const ok = JSON.stringify(atteso) === JSON.stringify(ottenuto);
  if (!ok) errori += 1;
  console.log(`${ok ? '✓' : '✗'} ${nome}: atteso=${JSON.stringify(atteso)} ottenuto=${JSON.stringify(ottenuto)}`);
}

console.log('— A. Pagina indice WordPress: quali post? —');
const postWp = estraiPostElenco(WP_ELENCO, WP_BASE);
check('post distinti riconosciuti', 3, postWp.length);
check('URL assoluto del post', true, postWp[0]?.url.startsWith('https://fe.istruzioneer.gov.it/2026/10/23/'));
check('titolo del post (non «Pagina 2»)', true, postWp.every((p) => p.titolo.length > 40));
check('data dall’attributo <time>', '2026-10-23', postWp[0]?.dataPubblicazione);
check(
  'nessuna voce di menu/sidebar/privacy/paginazione',
  [],
  postWp.filter((p) => /facebook|privacy|cookie|chi-siamo|\/page\/\d/i.test(p.url)),
);
check('pagina riconosciuta come elenco di post', true, ePaginaPostElenco(WP_ELENCO, WP_BASE));

console.log('\n— B. Pagina indice MIM (e-portfolio Liferay) —');
const postMim = estraiPostElenco(MIM_ELENCO, MIM_BASE);
check('card MIM riconosciute', 3, postMim.length);
check('URL del post MIM (mai la sezione)', true, postMim.every((p) => p.url.includes('/-/')));

console.log('\n— C. Feed RSS della categoria —');
check('documento riconosciuto come feed', true, eFeedDocumento(FEED));
check('pagina HTML non è un feed', false, eFeedDocumento(WP_ELENCO));
const postFeed = estraiPostDaFeed(FEED, FEED_BASE);
check('voci del feed', 2, postFeed.length);
check('pubDate RFC 822 → data ISO', '2026-10-23', postFeed[0]?.dataPubblicazione);
check('descrizione del feed come contesto', true, (postFeed[0]?.contesto ?? '').includes('scadenza 26/10/2026'));

console.log('\n— D. Filtro degli URL di post —');
check('articolo WordPress valido', true, eUrlPost('https://fe.istruzioneer.gov.it/2026/10/23/interpello-a042/', WP_BASE));
check('categoria esclusa', false, eUrlPost('https://fe.istruzioneer.gov.it/category/interpelli_docenti/', WP_BASE));
check('autore/archivio escluso', false, eUrlPost('https://fe.istruzioneer.gov.it/author/redazione/', WP_BASE));
check('allegato PDF escluso', false, eUrlPost('https://fe.istruzioneer.gov.it/wp-content/uploads/bando.pdf', WP_BASE));
check('sezione «/avvisi/» esclusa', false, eUrlPost('https://atavellino.it/avvisi/', 'https://atavellino.it/avvisi/'));
check('host diverso escluso', false, eUrlPost('https://www.usp-rieti.it/interpelli/un-interpello-2026/', WP_BASE));

console.log('\n— D2. Foglia (articolo) o sezione espandibile? —');
check('articolo WordPress datato = foglia', true, eUrlArticolo('https://fe.istruzioneer.gov.it/2026/10/23/interpello-a042/'));
check(
  'articolo Liferay MIM = foglia',
  true,
  eUrlArticolo('https://www.mim.gov.it/web/bergamo/-/interpelli-per-il-conferimento-di-supplenza-n-65'),
);
check('sezione MIM resta espandibile', false, eUrlArticolo('https://www.mim.gov.it/web/milano/interpelli'));
check(
  'sezione dell’ente resta espandibile',
  false,
  eUrlArticolo('https://www.istruzionepiemonte.it/avvisi-pubblici-3/'),
);

console.log('\n— E. Contenuto dell’articolo (WordPress) —');
const art = estraiContenutoArticolo(ARTICOLO_WP, 'https://fe.istruzioneer.gov.it/2026/10/23/interpello-a042-46/');
check('titolo dal h1', 'Interpello per supplenza su classe di concorso A042 – Scienze e tecnologie', art.titolo);
check('data di pubblicazione dal meta', '2026-10-23', art.dataPubblicazione);
check('corpo senza commenti/sidebar/menu', false, /Commento del lettore|Ultimi interpelli|Home Interpelli/.test(art.corpo));
check('corpo con la scuola', true, art.corpo.includes('Dante Alighieri'));
check(
  'allegato PDF in URL assoluto',
  ['https://fe.istruzioneer.gov.it/wp-content/uploads/2026/10/interpello-a042-46.pdf'],
  art.allegati,
);

console.log('\n— F. Contenuto dell’articolo (e-portfolio MIM) —');
const artMim = estraiContenutoArticolo(
  ARTICOLO_MIM,
  'https://www.mim.gov.it/web/bergamo/-/interpelli-per-il-conferimento-di-supplenza-personale-docente-n-65-1',
);
check('data MIM con il giorno della settimana', '2026-10-23', artMim.dataPubblicazione);
check('corpo senza percorso di briciole', true, artMim.corpo.startsWith('Interpelli per il conferimento di supplenza'));
check('corpo con il riferimento all’A.S.', true, artMim.corpo.includes('A.S. 2026/2027'));
check('allegato MIM assoluto', true, (artMim.allegati[0] ?? '').startsWith('https://www.mim.gov.it/documents/'));


console.log('\n— G. Da elenco di post ad avvisi —');
/** Pagina di articolo coerente con la voce d'indice: titolo e data del post. */
const articoloDelPost = (titolo: string, data: string): string => `
<html><head><meta property="article:published_time" content="${data}T12:00:00+00:00"></head><body>
  <nav><a href="/">Home</a></nav>
  <article>
    <h1 class="entry-title">${titolo}</h1>
    <div class="entry-content">
      <p>Si pubblica l’interpello per la classe di concorso A042 – Scienze e tecnologie, presso ISTITUTO COMPRENSIVO STATALE n. 5 «Dante Alighieri» di Ferrara.</p>
      <p>Scadenza dell’interpello: entro e non oltre le ore 8:00 del 26/10/2026.</p>
      <p><a href="/wp-content/uploads/2026/10/bando-a042.pdf">Bando (PDF)</a></p>
    </div>
  </article>
</body></html>`;

const avvisiWp = await espandiPostInAvvisi(
  WP_ELENCO,
  { baseUrl: WP_BASE, provincia: 'FE', source: WP_BASE },
  {
    max: 5,
    scarica: async (url) => {
      const p = postWp.find((v) => v.url === url);
      return articoloDelPost(p?.titolo ?? 'Interpello', p?.dataPubblicazione ?? '2026-10-23');
    },
  },
);
check('un avviso per post', 3, avvisiWp.avvisi.length);
check('tipo di indice riconosciuto', 'elenco', avvisiWp.tipo);
check('pagine dei post lette', 3, avvisiWp.postLetti);
check('link = pagina del post (mai la categoria)', [], avvisiWp.avvisi.filter((a) => a.link === WP_BASE));
check('provincia della fonte conservata', ['FE'], [...new Set(avvisiWp.avvisi.map((a) => a.province))]);
check(
  'data di pubblicazione di ogni post',
  ['2026-10-21', '2026-10-22', '2026-10-23'],
  avvisiWp.avvisi.map((a) => a.publishedAt).sort(),
);
check('classe di concorso dal testo dell’articolo', true, avvisiWp.avvisi.every((a) => a.classCodes.includes('A-042')));
check('scadenza letta dall’articolo', '2026-10-26', avvisiWp.avvisi[0]?.expirationDate);
check(
  'allegato fra i link candidati',
  true,
  (avvisiWp.avvisi[0]?.linkCandidati ?? []).some((l) => l.endsWith('.pdf')),
);

const avvisiFeed = await espandiPostInAvvisi(
  FEED,
  { baseUrl: FEED_BASE, provincia: 'MO', source: FEED_BASE },
  {
    max: 5,
    scarica: async (url) => {
      const p = postFeed.find((v) => v.url === url);
      return articoloDelPost(p?.titolo ?? 'Interpello', p?.dataPubblicazione ?? '2026-10-23');
    },
  },
);
check('feed: un avviso per voce', 2, avvisiFeed.avvisi.length);
check('feed: tipo riconosciuto', 'feed', avvisiFeed.tipo);
check('feed: link delle voci, mai il feed', [], avvisiFeed.avvisi.filter((a) => a.link === FEED_BASE));

const senzaRete = await espandiPostInAvvisi(
  WP_ELENCO,
  { baseUrl: WP_BASE, provincia: 'FE', source: WP_BASE },
  {
    max: 5,
    scarica: async () => {
      throw new Error('offline');
    },
  },
);
check('post illeggibile: l’avviso NON si perde', 3, senzaRete.avvisi.length);
check('post illeggibile: nessuna pagina letta', 0, senzaRete.postLetti);
check(
  'post illeggibile: link del post conservato',
  true,
  senzaRete.avvisi.every((a) => (a.link ?? '').includes('/2026/10/')),
);

console.log('\n— H. Pagine che NON sono indici di post —');
check('articolo singolo non è un indice', false, ePaginaPostElenco(ARTICOLO_WP, WP_BASE));
const nessuno = await espandiPostInAvvisi(
  ARTICOLO_WP,
  { baseUrl: WP_BASE, provincia: 'FE', source: WP_BASE },
  { max: 5, scarica: async () => ARTICOLO_WP },
);
check('articolo: nessuna espansione', 'nessuno', nessuno.tipo);
check('articolo: nessun avviso inventato', 0, nessuno.avvisi.length);

console.log(`\n${errori === 0 ? '✅' : '❌'} ELENCHI DI POST: ${errori} errore/i`);
if (errori > 0) process.exitCode = 1;

