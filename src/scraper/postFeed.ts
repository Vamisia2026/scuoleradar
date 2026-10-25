/**
 * ScuoleRadar.it — POST DICHIARATI DA UN FEED RSS/ATOM — Node-only, puro.
 *
 * Seconda metà di §26.88 (la prima è `postElenco.ts`): gli uffici pubblicano
 * lo stesso elenco di interpelli anche come feed della categoria
 * (`/category/interpelli-docenti/feed/`). Il feed costa UNA richiesta e porta
 * già titolo, link e data di ogni post: è la via più economica per scoprire gli
 * avvisi nuovi, mentre il testo completo resta sulla pagina dell'articolo
 * (`articoloPost.ts`, usato da `postRaccolta.ts`).
 *
 * Niente rete e niente decisioni sul territorio: qui si leggono solo i
 * riferimenti dichiarati dal feed.
 */

import * as cheerio from 'cheerio';
import { normalizzaData } from './parser.ts';
import { chiave, eUrlPost, MIN_TITOLO, risolvi, testo, type PostElenco } from './postElenco.ts';

/** Data RFC 822 dei feed: «Fri, 23 Oct 2026 08:00:00 +0000». */
const RE_DATA_RFC822 = /^(?:[a-z]{3},\s*)?\d{1,2}\s+[a-z]{3}\s+\d{4}(?:\s+\d{1,2}:\d{2})?/i;

/** True se il documento è un feed RSS/Atom/RDF (non una pagina HTML). */
export function eFeedDocumento(documento: string): boolean {
  const t = (documento ?? '').slice(0, 4000);
  return /<rss[\s>]|<feed[\s>]|<rdf:RDF[\s>]/i.test(t);
}

/**
 * Data dichiarata da un feed: ISO/italiana (`normalizzaData`) oppure RFC 822 in
 * inglese, il formato predefinito dei `pubDate` di WordPress (`normalizzaData`
 * non lo conosce: i mesi sono inglesi, non italiani).
 * Del valore si prende il GIORNO UTC: la data di pubblicazione non deve cambiare
 * con il fuso orario del server che esegue lo scraping.
 */
export function dataDelFeed(valore: string): string | null {
  const diretto = normalizzaData(valore);
  if (diretto) return diretto;
  const v = (valore ?? '').trim();
  if (!RE_DATA_RFC822.test(v)) return null;
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return null;
  const mese = String(d.getUTCMonth() + 1).padStart(2, '0');
  const giorno = String(d.getUTCDate()).padStart(2, '0');
  return `${d.getUTCFullYear()}-${mese}-${giorno}`;
}

/**
 * Post dichiarati da un feed RSS/Atom: titolo, link e data di pubblicazione.
 * `contesto` è la descrizione del feed (spesso contiene classi e scadenze):
 * serve al parser quando la pagina dell'articolo non è raggiungibile.
 */
export function estraiPostDaFeed(xml: string, baseUrl: string, max = 20): PostElenco[] {
  const $ = cheerio.load(xml, { xmlMode: true });
  const out: PostElenco[] = [];
  const visti = new Set<string>();

  $('item, entry').each((_, el) => {
    if (out.length >= max) return false;
    const $i = $(el);
    const titolo = testo($i.find('title').first().text(), 300);
    if (titolo.length < MIN_TITOLO) return;
    const grezzo =
      $i.find('link').first().text().trim() ||
      $i.find('link').first().attr('href') ||
      $i.find('guid').first().text().trim();
    const url = risolvi(grezzo, baseUrl);
    if (!url || !eUrlPost(url, baseUrl)) return;
    const k = chiave(url);
    if (visti.has(k)) return;
    visti.add(k);
    out.push({
      titolo,
      url,
      contesto: testo($i.find('description, summary').first().text(), 800) || titolo,
      dataPubblicazione: dataDelFeed(
        $i.find('pubDate').first().text() ||
          $i.find('published').first().text() ||
          $i.find('updated').first().text(),
      ),
    });
  });

  return out;
}
