/**
 * ScuoleRadar.it — RICONOSCIMENTO DEGLI ELENCHI DI POST (WordPress, Liferay, feed) — Node-only, puro.
 *
 * PERCHÉ SERVE (§26.88, 23/10/2026). Gli uffici scolastici provinciali ormai
 * pubblicano gli interpelli come POST di un blog, non come righe di tabella:
 *   · WordPress con categoria (`/category/interpelli-docenti/`), in cui ogni
 *     interpello è un articolo con titolo, data e allegato;
 *   · WordPress «a blocchi» (titoli `h2` con link), temi magazine
 *     (`div.card-news`, `div.news`), e-portfolio Liferay del MIM
 *     (`/web/<ente>/-/<slug>`);
 *   · feed RSS della stessa categoria (`/category/.../feed/`), che porta titolo,
 *     link e data SENZA scaricare la pagina indice.
 * In tutti questi casi la pagina indice NON è un avviso: è un elenco di
 * riferimenti. `elenchi.ts` (righe di tabella) non li vede, quindi la vecchia
 * pipeline pubblicava il link alla lista master o perdeva l'avviso.
 *
 * Questo modulo risponde a tre domande, senza rete:
 *   1. `eFeedDocumento`      → il documento è un feed RSS/Atom?
 *   2. `estraiPostDaFeed`    → quali post dichiara il feed?
 *   3. `estraiPostElenco`    → quali post linka una pagina HTML?
 * Il testo dell'articolo si estrae in `articoloPost.ts`, l'uso (fetch + parser)
 * in `postRaccolta.ts`. Nessuna provincia inventata: qui non si decide nulla sul
 * territorio, si raccolgono solo i riferimenti.
 */

import * as cheerio from 'cheerio';
// Solo TIPI: `domhandler` è la libreria di nodi usata da cheerio (nessun runtime
// in più), serve a tipizzare gli elementi passati a `$(el)`.
import type { Element } from 'domhandler';
import { estraiDataPubblicazione, normalizzaData } from './parser.ts';
import { eTitoloNavigazione, stessoHost } from './hub.ts';

/** Un post linkato da una pagina indice o da un feed. */
export interface PostElenco {
  /** Titolo del post (testo del link, mai «Leggi tutto»). */
  titolo: string;
  /** URL ASSOLUTO del post (mai la pagina indice). */
  url: string;
  /** Testo del contenitore della voce: anteprima utile al parser (classi, date). */
  contesto: string;
  /** Data di pubblicazione dichiarata (`<time>`, data del feed), ISO `YYYY-MM-DD`. */
  dataPubblicazione: string | null;
}

/** Link di navigazione/rumore: mai un post. */
const RE_URL_RUMORE =
  /(privacy|cookie|facebook|twitter|instagram|linkedin|youtube|telegram|whatsapp|t\.me|mailto:|tel:|javascript:|wp-login|wp-admin|wp-json|\/feed\/?$|accessibilit|\/contatti?\/?$|amministrazione-trasparente|trasparenza|mappa-del-sito|note-legali|\/login|accedi|scrivania)/i;

/** Percorsi di SEZIONE (categorie, tag, archivi, ricerca, paginazione): non sono post. */
const RE_URL_SEZIONE = /(?:\/(?:category|tag|tagged|author|search|argomenti|temi|eventi)\/|\/page\/\d+|[?&](?:s|cat|tag|paged|feed|author|m)=)/i;

/** Archivi per data (`/2026/`, `/2026/10/`, `/2026/10/23/`): elenchi, non post. */
const RE_ARCHIVIO_DATA = /^\/\d{4}(?:\/\d{1,2})?(?:\/\d{1,2})?\/?$/;

/** Slug che è una SEZIONE e non un articolo (`/interpelli/`, `/avvisi/`). */
const RE_SLUG_SEZIONE =
  /^\/(?:interpelli|interpello|avvisi|avviso|comunicazioni|circolari|bandi|graduatorie|albo|notizie|news|documenti|archivio)\/?$/i;

/** Contenitori di NAVIGAZIONE (menu, testata, colonne, calendari): mai voci d'elenco. */
const SELETTORI_RUMORE =
  'nav, header, footer, aside, [role="navigation"], .menu, .menu-item, .sub-menu, .navbar, .site-header, .site-footer, .widget, .sidebar, .breadcrumbs, .breadcrumb, .wp-calendar-table, .calendar';

/** Un ARTICOLO pubblicato: dentro di lui `<header>`/`<footer>` sono della voce. */
const SELETTORI_ARTICOLO = 'article, .hentry, .entry-header, .card-news, .post';

/** Titoli di post: intestazioni di sezione e classi tipiche dei temi magazine. */
const SELETTORI_TITOLO =
  'h1 a[href], h2 a[href], h3 a[href], h4 a[href], .entry-title a[href], .card-news a[href], .card a[href], .news a[href]';

/** Contenitore della singola voce (per anteprima e data). */
const SELETTORI_CONTENITORE =
  'article, li, tr, .card-news, .card, .news, .post, .entry, .elementor-post, .wp-block-group';

/** Contenitori di CONTENUTO: la seconda passata (link lunghi) guarda solo qui. */
const SELETTORI_CONTENUTO =
  'main, #main, #content, .entry-content, .site-main, .posts, .elementor-widget-theme-post-content, #primary';

/** Lunghezza minima del titolo di un post (sotto è voce di menu). */
export const MIN_TITOLO = 12;

/** Lunghezza minima del testo di un link per la passata «link lungo». */
const MIN_LINK_LUNGO = 25;

/** Spazi compattati e testo troncato. */
export function testo(valore?: string | null, max = 600): string {
  return (valore ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
}

/** URL assoluto risolto rispetto alla pagina, senza frammento. */
export function risolvi(href: string | undefined, baseUrl: string): string | null {
  const h = (href ?? '').trim();
  if (!h || h.startsWith('#') || /^(?:mailto|tel|javascript):/i.test(h)) return null;
  try {
    return new URL(h, baseUrl).href.split('#')[0];
  } catch {
    return null;
  }
}

/** Chiave di deduplica: URL senza frammento e senza barra finale. */
export function chiave(url: string): string {
  return url.split('#')[0].replace(/\/+$/, '');
}

/**
 * True se l'URL può essere il POST di un avviso: stesso host della pagina,
 * percorso di articolo (mai categoria/tag/archivio/ricerca), non un documento
 * binario, non un link di navigazione.
 */
export function eUrlPost(url?: string | null, baseUrl?: string | null): boolean {
  const u = (url ?? '').trim();
  if (!/^https?:\/\//i.test(u)) return false;
  if (RE_URL_RUMORE.test(u)) return false;
  let p: URL;
  try {
    p = new URL(u);
  } catch {
    return false;
  }
  if (baseUrl && !stessoHost(u, baseUrl)) return false;
  if (RE_URL_SEZIONE.test(`${p.pathname}${p.search}`)) return false;
  if (RE_ARCHIVIO_DATA.test(p.pathname)) return false;
  if (RE_SLUG_SEZIONE.test(p.pathname)) return false;
  if (p.pathname.split('/').filter(Boolean).length === 0) return false;
  if (/\.(?:pdf|docx?|odt|xlsx?|pptx?|zip|rar|jpe?g|png|gif|svg|mp4)$/i.test(p.pathname)) return false;
  return true;
}

/** Data di pubblicazione dichiarata dal contenitore della voce. */
function dataDelContenitore($: cheerio.CheerioAPI, $cont: cheerio.Cheerio<Element>): string | null {
  if ($cont.length === 0) return null;
  const iso =
    normalizzaData($cont.find('time[datetime]').first().attr('datetime')) ??
    normalizzaData($cont.find('meta[property="article:published_time"]').first().attr('content'));
  if (iso) return iso;
  const etichetta = testo($cont.find('.entry-meta, .postmeta, .posted-on, .entry-date, .date').first().text(), 120);
  if (etichetta) return estraiDataPubblicazione(etichetta);
  return estraiDataPubblicazione(testo($cont.find('time').first().text(), 80));
}

/** Voce d'elenco costruita dall'ancora del titolo. */
function voceDaAncora(
  $: cheerio.CheerioAPI,
  el: Element,
  titolo: string,
  url: string,
): PostElenco {
  const $a = $(el);
  const $cont = $a.closest(SELETTORI_CONTENITORE).first();
  const contesto = testo(($cont.length > 0 ? $cont : $a.parent()).text(), 600);
  return { titolo, url, contesto, dataPubblicazione: dataDelContenitore($, $cont) };
}

/**
 * True se l'elemento sta in un contenitore di NAVIGAZIONE (menu, testata,
 * colonne): mai una voce d'elenco.
 *
 * Eccezione necessaria (§23/10/2026, WordPress di Ferrara): i temi magazine
 * mettono il titolo del post dentro `<header class="entry-header">`. Il tag
 * `<header>` da solo non basta a dire «testata del sito»: conta il fatto che
 * l'elemento sia in un ARTICOLO. Senza questa eccezione una categoria WordPress
 * con 10 interpelli restituiva 0 post (e le voci finivano in `parseAvvisi` come
 * righe «Continua a leggere»).
 */
function inNavigazione($: cheerio.CheerioAPI, el: Element): boolean {
  if ($(el).closest(SELETTORI_RUMORE).length === 0) return false;
  return $(el).closest(SELETTORI_ARTICOLO).length === 0;
}

/**
 * Post linkati da una pagina HTML, in ordine di documento. Prima le ancore
 * dentro le INTESTAZIONI (h1–h4, titoli dei temi magazine), poi — solo se il
 * contenuto ne ha meno di tre — i link lunghi dentro il contenuto principale
 * (temi a card senza heading).
 */
export function estraiPostElenco(html: string, baseUrl: string, opts: { max?: number } = {}): PostElenco[] {
  const max = opts.max ?? 20;
  const $ = cheerio.load(html);
  const out: PostElenco[] = [];
  const visti = new Set<string>();

  const aggiungi = (el: Element, testoLink: string): void => {
    if (out.length >= max) return;
    const titolo = testo(testoLink, 300);
    if (titolo.length < MIN_TITOLO || eTitoloNavigazione(titolo)) return;
    const url = risolvi($(el).attr('href'), baseUrl);
    if (!url || url === baseUrl || !eUrlPost(url, baseUrl)) return;
    const k = chiave(url);
    if (visti.has(k)) return;
    visti.add(k);
    out.push(voceDaAncora($, el, titolo, url));
  };

  $(SELETTORI_TITOLO).each((_, el) => {
    if (out.length >= max) return false;
    if (inNavigazione($, el)) return;
    aggiungi(el, $(el).text());
  });

  if (out.length < 3) {
    $(SELETTORI_CONTENUTO)
      .first()
      .find('a[href]')
      .each((_, el) => {
        if (out.length >= max) return false;
        if (inNavigazione($, el)) return;
        const t = testo($(el).text(), 300);
        if (t.length < MIN_LINK_LUNGO) return;
        aggiungi(el, t);
      });
  }

  return out;
}

/** True se la pagina è un ELENCO DI POST (almeno tre articoli linkati). */
export function ePaginaPostElenco(html: string, baseUrl: string): boolean {
  return estraiPostElenco(html, baseUrl, { max: 20 }).length >= 3;
}

