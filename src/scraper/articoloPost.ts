/**
 * ScuoleRadar.it — TESTO DI UN ARTICOLO/AVVISO (Node-only, puro) — §26.88.
 *
 * Complemento di `postElenco.ts`: l'elenco dice QUALI post esistono, questo
 * modulo legge il post e ne restituisce il CONTENUTO che serve al parser
 * (`parser.ts`) per ricavare scuola, classi di concorso, scadenza ed email:
 *   · `corpo`   → testo dell'articolo, senza menu, briciole, sidebar e widget;
 *   · `titolo`  → intestazione vera del post (`h1`), non il `<title>` del sito;
 *   · `dataPubblicazione` → `<meta article:published_time>`, `<time datetime>`,
 *     etichetta «pubblicato il …» o la data con il giorno della settimana
 *     («Venerdì, 23 ottobre 2026» — formato degli e-portfolio Liferay del MIM);
 *   · `allegati`→ i documenti linkati nell'articolo (bando, tabella, domanda):
 *     sono i link candidati preferiti dal parser e dall'arricchimento contatti.
 *
 * Nessuna invenzione: se il contenuto non c'è, i campi restano vuoti e il post
 * viene comunque pubblicato con l'anteprima dell'elenco.
 */

import * as cheerio from 'cheerio';
import type { Element } from 'domhandler';
import { eTitoloNavigazione } from './hub.ts';
import { estraiDataPubblicazione, normalizzaData, normalizzaDataTestuale } from './parser.ts';

export interface ContenutoArticolo {
  /** Intestazione del post (`h1`), vuota se la pagina non ne ha una. */
  titolo: string;
  /** Testo dell'articolo, ripulito da menu/briciole/sidebar (max ~1800 caratteri). */
  corpo: string;
  /** Data di pubblicazione dichiarata dalla pagina, ISO `YYYY-MM-DD`. */
  dataPubblicazione: string | null;
  /** URL assoluti dei documenti allegati (PDF, DOCX, ODT, fogli di calcolo, ZIP). */
  allegati: string[];
}

/**
 * Contenitori del corpo, dal più specifico al più generico. `.elementor-*` e
 * `.portlet-body` coprono WordPress/Elementor e gli e-portfolio Liferay del MIM.
 */
const SELETTORI_CORPO = [
  'article .entry-content',
  '.entry-content',
  '.post-content',
  '.article-content',
  '.elementor-widget-theme-post-content',
  'main article',
  'article',
  '.portlet-body',
  '#content',
  'main',
  '[role="main"]',
];

/** Rumore da togliere PRIMA di leggere il testo (non è contenuto dell'avviso). */
const SELETTORI_RUMORE =
  'nav, header, footer, aside, script, style, form, noscript, .breadcrumbs, .breadcrumb, .menu, .navbar, .sidebar, .widget, .sharedaddy, .jp-relatedposts, .related-posts, .comments, .comment-respond, .post-navigation, .navigation, .pagination, .wp-block-latest-posts, .wp-block-tag-cloud, .screen-reader-text';

/** Le briciole di pane spesso NON hanno una classe dedicata: si tagliano per testo. */
const RE_BRICIOLE = /^(?:sei in|tu sei qui|home\s*[›»>]|dove sei)[\s\S]{0,120}?(?=[A-ZÀ-Ù])/i;

/** Allegati: documenti che il candidato deve leggere o compilare. */
const RE_ALLEGATO = /\.(?:pdf|docx?|odt|xlsx?|pptx?|zip|rar)$/i;

/** Lunghezza minima perché un contenitore sia considerato «corpo» della pagina. */
const MIN_CORPO = 200;

/** Lunghezza massima del testo restituito. */
const MAX_CORPO = 1800;

/** Data con il giorno della settimana premesso (formato degli e-portfolio MIM). */
const RE_DATA_CON_GIORNO =
  /(?:lunedì|martedì|mercoledì|giovedì|venerdì|sabato|domenica)\s*[,]?\s*(\d{1,2}\s+[a-zà-ù]+\s+\d{4})/i;

/** Testo compattato e troncato. */
function compatto(valore?: string | null, max = MAX_CORPO): string {
  return (valore ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
}

/** URL assoluti degli allegati presenti nel contenitore. */
function allegatiDi(
  $: cheerio.CheerioAPI,
  $radice: cheerio.Cheerio<Element>,
  baseUrl: string,
  max: number,
): string[] {
  const out: string[] = [];
  const visti = new Set<string>();
  $radice.find('a[href]').each((_, el) => {
    if (out.length >= max) return false;
    const href = ($(el).attr('href') ?? '').trim();
    if (!RE_ALLEGATO.test(href.split('?')[0])) return;
    let assoluto: string;
    try {
      assoluto = new URL(href, baseUrl).href;
    } catch {
      return;
    }
    if (visti.has(assoluto)) return;
    visti.add(assoluto);
    out.push(assoluto);
  });
  return out;
}

/** Data di pubblicazione dichiarata dalla pagina dell'articolo. */
function dataDellArticolo($: cheerio.CheerioAPI, corpo: string): string | null {
  const daMeta =
    normalizzaData($('meta[property="article:published_time"]').first().attr('content')) ??
    normalizzaData($('meta[itemprop="datePublished"]').first().attr('content')) ??
    normalizzaData($('time[datetime]').first().attr('datetime'));
  if (daMeta) return daMeta;

  const daEtichetta = estraiDataPubblicazione(
    compatto($('.entry-meta, .postmeta, .posted-on, .entry-date, .published, .date').first().text(), 160),
  );
  if (daEtichetta) return daEtichetta;

  // «Venerdì, 23 ottobre 2026»: la data dell'e-portfolio MIM, senza etichetta.
  const conGiorno = compatto(corpo, 400).match(RE_DATA_CON_GIORNO);
  if (conGiorno) return normalizzaDataTestuale(conGiorno[1]);
  return null;
}

/** Titoli candidati dell'articolo, dal più specifico al più generico. */
const SELETTORI_TITOLO = ['h1.entry-title', 'h1.post-title', 'article h1', 'main h1', 'h1.portlet-title-text', 'h1'];

/**
 * Intestazione VERA dell'articolo: primo `h1` che non sia un'etichetta di
 * navigazione. Sui portali MIM il primo `h1` della pagina è «Navigazione» (link
 * «salta al contenuto») e senza questo filtro diventava il TITOLO dell'avviso,
 * sostituendo quello del post letto dall'elenco (§23/10/2026).
 */
function titoloDellArticolo($: cheerio.CheerioAPI): string {
  for (const selettore of SELETTORI_TITOLO) {
    const candidati = $(selettore).toArray();
    for (const el of candidati) {
      const t = compatto($(el).text(), 300);
      if (t.length > 0 && !eTitoloNavigazione(t)) return t;
    }
  }
  return '';
}

/**
 * Estrae titolo, corpo, data di pubblicazione e allegati da una pagina di
 * articolo. `baseUrl` serve a rendere assoluti i link degli allegati.
 */
export function estraiContenutoArticolo(
  html: string,
  baseUrl: string,
  opts: { maxAllegati?: number } = {},
): ContenutoArticolo {
  const $ = cheerio.load(html);
  const titolo = titoloDellArticolo($);

  // Corpo: il primo contenitore con testo sufficiente (gli altri sono menu/footer).
  let $corpo: cheerio.Cheerio<Element> = $('html') as unknown as cheerio.Cheerio<Element>;
  for (const selettore of SELETTORI_CORPO) {
    const $candidato = $(selettore).first();
    if ($candidato.length > 0 && compatto($candidato.text(), 4000).length >= MIN_CORPO) {
      $corpo = $candidato;
      break;
    }
  }

  const radice = $corpo.length > 0 ? $corpo : $('body');
  const allegati = allegatiDi($, radice, baseUrl, opts.maxAllegati ?? 6);

  // Testo ripulito dal rumore, con le briciole in testa tagliate.
  const $pulito = radice.clone();
  $pulito.find(SELETTORI_RUMORE).remove();
  let corpo = compatto($pulito.text(), 4000).replace(RE_BRICIOLE, '').trim();

  // Briciole rimaste (senza markup): il testo ripete il titolo DOPO il percorso
  // di navigazione («USR Lombardia Bergamo Home Comunicazioni …»). Si parte dal
  // titolo, ma solo se compare entro la testa del corpo (mai a metà articolo).
  const posizioneTitolo = titolo.length >= 20 ? corpo.indexOf(titolo) : -1;
  if (posizioneTitolo > 40 && posizioneTitolo < 600) corpo = corpo.slice(posizioneTitolo);

  return {
    titolo,
    corpo: compatto(corpo),
    dataPubblicazione: dataDellArticolo($, corpo),
    allegati,
  };
}
