/**
 * ScuoleRadar.it — Fetcher Notizie (servizio di ingestione).
 *
 * Modulo Node-only (axios + cheerio): recupera le notizie reali dalle fonti
 * ufficiali e le restituisce come voci grezze pronte per il motore di
 * rilevanza e la pipeline di ingestione.
 *
 * Fonti:
 *  - MIM (Ministero dell'Istruzione e del Merito): feed RSS e/o scraping
 *    della pagina https://www.mim.gov.it/notizie
 *  - Gazzetta Ufficiale: feed RSS della sezione istruzione/concorsi
 */
import axios from 'axios';
import * as cheerio from 'cheerio';
import { estraiDeadline } from './relevanceEngine.ts';

export interface VoceFonte {
  title: string;
  link: string;
  /** Data di pubblicazione (RFC2822/ISO grezza come da fonte). */
  pubDate: string | null;
  /** Descrizione/sommario della fonte (può contenere HTML). */
  description: string;
  /** Etichetta della fonte (es. "MIM", "Gazzetta Ufficiale"). */
  fonte: string;
}

const HTTP_TIMEOUT = 15000;
const HTTP_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (compatible; ScuoleRadarBot/1.0; +https://www.scuoleradar.it)',
  Accept: 'application/rss+xml, application/xml, text/xml, text/html;q=0.9',
};

/** Scarica un URL e restituisce il testo; null in caso di errore/timeout. */
export async function fetchTesto(url: string): Promise<string | null> {
  try {
    const { data } = await axios.get<string>(url, {
      timeout: HTTP_TIMEOUT,
      headers: HTTP_HEADERS,
      responseType: 'text',
      validateStatus: (s) => s >= 200 && s < 400,
    });
    return typeof data === 'string' ? data : null;
  } catch (err) {
    console.warn(`⚠ Fetch fallito: ${url} — ${(err as Error).message}`);
    return null;
  }
}

/** Normalizza un URL relativo in assoluto rispetto a una base. */
function urlAssoluto(href: string, base: string): string {
  try {
    return new URL(href, base).toString();
  } catch {
    return href;
  }
}

/** Parsa un feed RSS/Atom XML in voci semplici. */
export function parseRss(xml: string, fonte: string, baseUrl: string): VoceFonte[] {
  const voci: VoceFonte[] = [];
  try {
    const $ = cheerio.load(xml, { xmlMode: true });
    const items = $('item, entry').toArray();
    for (const el of items) {
      const $el = $(el);
      const title = $el.find('title').first().text().trim();
      const link =
        $el.find('link').first().attr('href')?.trim() ||
        $el.find('link').first().text().trim();
      const pubDate =
        $el.find('pubDate').first().text().trim() ||
        $el.find('updated').first().text().trim() ||
        $el.find('dc\\:date').first().text().trim();
      const description =
        $el.find('description').first().text().trim() ||
        $el.find('encoded').first().text().trim() ||
        $el.find('summary').first().text().trim();
      if (title && link) {
        voci.push({
          title,
          link: urlAssoluto(link, baseUrl),
          pubDate: pubDate || null,
          description,
          fonte,
        });
      }
    }
  } catch (err) {
    console.warn(`⚠ Parse RSS fallito (${fonte}): ${(err as Error).message}`);
  }
  return voci;
}

/* ------------------------------ Fonti MIM ------------------------------ */

const BASE_MIM = 'https://www.mim.gov.it';
const FONTI_MIM_RSS = [
  'https://www.mim.gov.it/rss.xml',
  'https://www.mim.gov.it/feeds/notizie',
  'https://www.mim.gov.it/feed',
];

/** Prova i feed RSS del MIM; se nessuno risponde, fa fallback sullo scraping HTML. */
export async function fetchNotizieMim(): Promise<VoceFonte[]> {
  for (const url of FONTI_MIM_RSS) {
    const xml = await fetchTesto(url);
    if (!xml) continue;
    const voci = parseRss(xml, 'MIM', BASE_MIM);
    if (voci.length > 0) {
      console.log(`• MIM RSS: ${voci.length} voci da ${url}`);
      return voci;
    }
  }
  console.log('• MIM RSS non disponibile: provo lo scraping della pagina notizie.');
  return scrapeMimNotizie();
}

/**
 * Scraping della pagina https://www.mim.gov.it/web/guest/notizie.
 * La pagina è server-rendered: le card degli articoli usano link Liferay
 * `/web/guest/-/<slug>` con la data di pubblicazione in `<span class="date">`.
 */
export async function scrapeMimNotizie(): Promise<VoceFonte[]> {
  const html = await fetchTesto(`${BASE_MIM}/web/guest/notizie`);
  if (!html) return [];
  const $ = cheerio.load(html);
  const voci: VoceFonte[] = [];
  $('a[href*="/web/guest/-/"]').each((_, el) => {
    const $el = $(el);
    const title = $el.text().replace(/\s+/g, ' ').trim();
    const href = $el.attr('href');
    if (!title || !href || title.length < 12) return;
    const link = urlAssoluto(href, BASE_MIM);
    if (!link.includes('/web/guest/-/')) return;
    // La data è nel contenitore della card (span.date).
    const card = $el.closest('h3').parent();
    const dataTesto = card.find('.date, time, [class*="date"]').first().text().trim();
    const pubDate = dataTesto ? (estraiDeadline(dataTesto) ?? null) : null;
    if (!voci.some((v) => v.link === link)) {
      voci.push({ title, link, pubDate, description: '', fonte: 'MIM' });
    }
  });
  return voci.slice(0, 40);
}

/* ------------------------- Gazzetta Ufficiale ------------------------- */

const BASE_GU = 'https://www.gazzettaufficiale.it';
const FONTI_GU_RSS = [
  'https://www.gazzettaufficiale.it/rss/concorsi',
  'https://www.gazzettaufficiale.it/rss/istruzione',
  'https://www.gazzettaufficiale.it/feed/istruzione',
];

/** Recupera gli aggiornamenti della Gazzetta Ufficiale (sezione istruzione). */
export async function fetchNotizieGazzetta(): Promise<VoceFonte[]> {
  for (const url of FONTI_GU_RSS) {
    const xml = await fetchTesto(url);
    if (!xml) continue;
    const voci = parseRss(xml, 'Gazzetta Ufficiale', BASE_GU);
    if (voci.length > 0) {
      console.log(`• GU RSS: ${voci.length} voci da ${url}`);
      return voci;
    }
  }
  console.warn('⚠ Gazzetta Ufficiale: nessun feed disponibile.');
  return [];
}

/** Aggrega le voci da tutte le fonti ufficiali. */
export async function raccogliNotizieRaw(): Promise<VoceFonte[]> {
  const [mim, gu] = await Promise.allSettled([
    fetchNotizieMim(),
    fetchNotizieGazzetta(),
  ]);
  const voci: VoceFonte[] = [];
  for (const r of [mim, gu]) {
    if (r.status === 'fulfilled') voci.push(...r.value);
    else console.warn('⚠ Fonte non disponibile:', (r.reason as Error)?.message);
  }
  return voci;
}
