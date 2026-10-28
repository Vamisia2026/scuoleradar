/**
 * GUARDIA · FIXTURE HTML/XML degli elenchi di post (WordPress, MIM, feed RSS).
 *
 * Frammenti costruiti sui DOM REALI verificati il 23/10/2026, usati da
 * `scripts/test-post-elenco.ts`. Stanno qui e non dentro il test per due motivi:
 *   · il test resta sotto la soglia di 250 righe (`scripts/check-architettura.ts`);
 *   · gli stessi frammenti servono a più prove (indice, articolo, feed → avvisi).
 *
 *   · indice Joomla di un portale aggregato (USP Arezzo, direttiva 27/10/2026),
 *     in cui accanto al post vero compaiono due voci che sono a loro volta un
 *     INDICE (la sotto-sezione e la pagina 2): non devono mai essere pubblicate.
 *
 * Nessuna rete e nessuna logica: solo stringhe costanti.
 */

/** Category WordPress dell'Ufficio VI (Emilia-Romagna): indice con articoli. */
export const WP_BASE = 'https://fe.istruzioneer.gov.it/category/interpelli_docenti/';
export const WP_ELENCO = `
<html><head><title>Interpelli docenti – Ufficio VI</title></head><body>
  <nav class="menu">
    <a href="/">Home</a>
    <a href="/category/interpelli_docenti/">Interpelli docenti</a>
    <a href="https://www.facebook.com/usr">Facebook</a>
  </nav>
  <main id="content">
    <article class="post">
      <h2 class="entry-title"><a href="/2026/10/23/interpello-per-supplenza-su-classe-di-concorso-a042-scienze/">Interpello per supplenza su classe di concorso A042 – Scienze e tecnologie</a></h2>
      <div class="entry-meta"><time datetime="2026-10-23T12:02:04+00:00">23 ottobre 2026</time></div>
    </article>
    <article class="post">
      <h2 class="entry-title"><a href="/2026/10/22/interpello-per-una-supplenza-su-classe-di-concorso-a022-italiano/">Interpello per una supplenza su classe di concorso A022 – Italiano</a></h2>
      <div class="entry-meta"><time datetime="2026-10-22T09:00:00+00:00">22 ottobre 2026</time></div>
    </article>
    <article class="post">
      <h2 class="entry-title"><a href="/2026/10/21/interpello-per-supplenze-su-diverse-classi-di-concorso-primaria/">Interpello per supplenze su diverse classi di concorso PRIMARIA e INFANZIA</a></h2>
      <div class="entry-meta"><time datetime="2026-10-21T15:30:00+00:00">21 ottobre 2026</time></div>
    </article>
    <div class="pagination"><a href="/category/interpelli_docenti/page/2/">Pagina 2</a></div>
  </main>
  <aside class="sidebar">
    <a href="/category/interpelli_docenti/">Tutti gli interpelli docenti</a>
    <a href="https://www.istruzioneer.gov.it/privacy/">Privacy e cookie</a>
  </aside>
  <footer><a href="/chi-siamo/">Chi siamo dell'ufficio scolastico</a></footer>
</body></html>`;

/** E-portfolio Liferay del MIM (Bergamo): card con link `/-/<slug>`. */
export const MIM_BASE = 'https://www.mim.gov.it/web/bergamo/interpelli-ricerca-supplenti';
export const MIM_ELENCO = `
<html><body>
  <nav><a href="/web/bergamo">Bergamo</a><a href="/web/bergamo/comunicazioni">Comunicazioni</a></nav>
  <div class="portlet-body">
    <div class="card"><h3><a href="/web/bergamo/-/interpelli-per-il-conferimento-di-supplenza-personale-docente-n-65-1">Interpelli per il conferimento di supplenza personale docente n. 65</a></h3></div>
    <div class="card"><h3><a href="/web/bergamo/-/interpelli-per-il-conferimento-di-supplenza-personale-docente-n-64-1">Interpelli per il conferimento di supplenza personale docente n. 64</a></h3></div>
    <div class="card"><h3><a href="/web/bergamo/-/interpelli-per-la-selezione-di-esperti-esterni-pnrr">Interpelli per la selezione di esperti esterni PNRR</a></h3></div>
  </div>
</body></html>`;

/** Pagina dell'articolo WordPress corrispondente alla prima voce dell'indice. */
export const ARTICOLO_WP = `
<html><head>
  <meta property="article:published_time" content="2026-10-23T12:02:04+00:00">
  <title>Interpello A042 – Ufficio VI</title></head><body>
  <nav><a href="/">Home</a><a href="/interpelli/">Interpelli</a></nav>
  <article>
    <h1 class="entry-title">Interpello per supplenza su classe di concorso A042 – Scienze e tecnologie</h1>
    <div class="entry-content">
      <p>Si pubblica l’interpello, ai sensi dell’articolo 13, comma 23, dell’Ordinanza ministeriale del 16 maggio 2024, n. 88, per provvedere al conferimento di una supplenza per la classe di concorso A042 – Scienze e tecnologie, presso ISTITUTO COMPRENSIVO STATALE n. 5 «Dante Alighieri» di Ferrara.</p>
      <p>Scadenza dell’interpello: entro e non oltre le ore 8:00 del 26/10/2026, inviando la disponibilità al link indicato nella domanda.</p>
      <p><a href="/wp-content/uploads/2026/10/interpello-a042-46.pdf">Interpello A042 n. 46 (PDF)</a></p>
    </div>
    <div class="comments"><p>Commento del lettore con data 01/01/2020.</p></div>
  </article>
  <aside class="sidebar"><p>Ultimi interpelli</p></aside>
</body></html>`;

/** Pagina dell'articolo e-portfolio MIM: data in italiano esteso, breadcrumb nel testo. */
export const ARTICOLO_MIM = `
<html><body>
  <div class="portlet-body">
    <h1>Interpelli per il conferimento di supplenza personale docente n. 65</h1>
    <p>USR LOMBARDIA Bergamo Home Comunicazioni Interpelli Ricerca Supplenti Interpelli per il conferimento di supplenza personale docente n. 65</p>
    <p>Si pubblica la tabella riassuntiva degli interpelli per il conferimento di supplenza al personale docente per l’A.S. 2026/2027 – n. 65.</p>
    <p>Venerdì, 23 ottobre 2026</p>
    <p>Documenti Allegati <a href="/documents/20142/0/Interpelli+n.+65.pdf">Interpelli n. 65.pdf</a></p>
  </div>
</body></html>`;

/** Feed RSS della categoria (Modena): `pubDate` in RFC 822. */
export const FEED_BASE = 'https://mo.istruzioneer.gov.it/category/interpelli/feed/';
export const FEED = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"><channel><title>Interpelli docenti</title>
  <item>
    <title>Interpello per supplenza su classe di concorso A042 – Scienze e tecnologie</title>
    <link>https://mo.istruzioneer.gov.it/2026/10/23/interpello-posto-comune-scuola-infanzia-mirandola/</link>
    <pubDate>Fri, 23 Oct 2026 08:00:00 +0000</pubDate>
    <description>Interpello presso I.C. Fiorano Modenese, scadenza 26/10/2026.</description>
  </item>
  <item>
    <title>Interpello – Direzione Didattica di Mirandola posto comune scuola infanzia</title>
    <link>https://mo.istruzioneer.gov.it/2026/10/22/interpello-posto-comune-scuola-infanzia-mirandola-2/</link>
    <pubDate>Thu, 22 Oct 2026 16:10:00 +0000</pubDate>
    <description><![CDATA[<p>Interpello classe A042.</p>]]></description>
  </item>
</channel></rss>`;

/**
 * Indice Joomla di un portale aggregato (USP Arezzo): il post VERO più due voci
 * che sono a loro volta un indice — la sotto-sezione `graduatorie-e-interpelli`
 * e la pagina 2 (`?start=10`). Nessuna delle due deve diventare un avviso:
 * «un avviso si apre su un avviso» (direttiva 27/10/2026).
 */
export const AREZZO_BASE = 'https://www.arezzoistruzione.it/usparezzo/index.php/interpelli';
export const AREZZO_INDICE = `
<html><head><title>Interpelli – USP Arezzo</title></head><body>
  <nav class="menu">
    <a href="/usparezzo/">USP Arezzo</a>
    <a href="/usparezzo/index.php/interpelli">Interpelli degli istituti aretini</a>
  </nav>
  <main id="content">
    <h2><a href="/usparezzo/index.php/interpelli/2159-interpello-per-supplenza-a022-italiano">Interpello per supplenza su classe di concorso A022 – Italiano</a></h2>
    <h2><a href="/usparezzo/index.php/interpelli/graduatorie-e-interpelli-docenti">Graduatorie e interpelli docenti: elenco aggiornato dell’ufficio</a></h2>
    <div class="pagination">
      <a href="/usparezzo/index.php/interpelli?start=10">Pagina successiva degli interpelli pubblicati</a>
    </div>
  </main>
</body></html>`;

