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

/**
 * Scarica un URL restituendo testo e status HTTP, con log esplicito di ogni
 * richiesta: nessun silent-fail, ogni fonte è tracciata nei log del cron
 * (es. "✓ HTTP 200 - https://www.mim.gov.it/rss.xml").
 */
export async function fetchTestoConStato(
  url: string,
): Promise<{ testo: string | null; status: number | null }> {
  try {
    const { data, status } = await axios.get<string>(url, {
      timeout: HTTP_TIMEOUT,
      headers: HTTP_HEADERS,
      responseType: 'text',
      validateStatus: (s) => s >= 200 && s < 400,
    });
    console.log(`✓ HTTP ${status} - ${url}`);
    return { testo: typeof data === 'string' ? data : null, status };
  } catch (err) {
    const status =
      (err as { response?: { status?: number } })?.response?.status ?? null;
    console.warn(`✗ HTTP ${status ?? 'ERRORE'} - ${url} (${(err as Error).message})`);
    return { testo: null, status };
  }
}

/** Scarica un URL e restituisce il testo; null in caso di errore/timeout. */
export async function fetchTesto(url: string): Promise<string | null> {
  const { testo } = await fetchTestoConStato(url);
  return testo;
}

/**
 * Verifica che un link ufficiale risponda HTTP 200/3xx (STRICT URL INTEGRITY).
 * Prova prima HEAD; se il server lo nega (403/405), ripiega su GET. Usato in
 * fase di ingestione prima della pubblicazione: nessun link rotto in bacheca.
 */
export async function verificaUrlUfficiale(
  url: string,
): Promise<{ ok: boolean; status: number | null }> {
  const tentativo = async (metodo: 'head' | 'get') => {
    try {
      const config = {
        timeout: 12000,
        headers: HTTP_HEADERS,
        validateStatus: (s: number) => s >= 200 && s < 400,
        ...(metodo === 'get'
          ? { responseType: 'arraybuffer' as const, maxContentLength: 5 * 1024 * 1024 }
          : {}),
      };
      const r =
        metodo === 'head'
          ? await axios.head(url, config)
          : await axios.get(url, config);
      return { ok: true, status: r.status };
    } catch (err) {
      const status =
        (err as { response?: { status?: number } })?.response?.status ?? null;
      return { ok: false, status };
    }
  };

  const head = await tentativo('head');
  if (head.ok) {
    console.log(`✓ LINK OK ${head.status} - ${url}`);
    return head;
  }
  const get = await tentativo('get');
  if (get.ok) {
    console.log(`✓ LINK OK ${get.status} (GET) - ${url}`);
  } else {
    console.warn(`✗ LINK ${get.status ?? 'ERRORE'} - ${url}`);
  }
  return get;
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
        const url = urlAssoluto(link, baseUrl);
        // STRICT URL INTEGRITY: per il MIM si accettano SOLO gli articoli
        // canonici /web/guest/-/<slug> — mai homepage o liste generiche
        // (es. https://www.mim.gov.it/web/guest/home). Se il feed non li
        // fornisce, il fallback di scraping recupera i link corretti.
        if (fonte === 'MIM' && !url.includes('/web/guest/-/')) {
          continue;
        }
        voci.push({
          title,
          link: url,
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
/**
 * Feed RSS del MIM: DISMESSI. Verificato il 21/09/2026 — `rss.xml`,
 * `feeds/notizie` e `feed` rispondono tutti HTTP 404 (log `✗ HTTP 404` nel
 * cron). L'elenco resta VUOTO per non sprecare tre richieste a ogni run:
 * la raccolta prosegue direttamente con lo scraping delle pagine notizie,
 * che è la fonte effettiva delle voci MIM.
 */
const FONTI_MIM_RSS: string[] = [];

/** Prova i feed RSS del MIM; se nessuno risponde, fa fallback sullo scraping HTML. */
export async function fetchNotizieMim(): Promise<{ voci: VoceFonte[]; raggiunta: boolean }> {
  let raggiunta = false;
  for (const url of FONTI_MIM_RSS) {
    const { testo, status } = await fetchTestoConStato(url);
    if (status !== null && status >= 200 && status < 400) raggiunta = true;
    if (!testo) continue;
    const voci = parseRss(testo, 'MIM', BASE_MIM);
    if (voci.length > 0) {
      console.log(`• MIM RSS: ${voci.length} voci da ${url}`);
      return { voci, raggiunta };
    }
  }
  console.log('• MIM RSS non disponibile: provo lo scraping della pagina notizie.');
  return scrapeMimNotizie();
}

/**
 * Pagine di elenco NAZIONALI del MIM (canonical + legacy Liferay).
 * NB NAZIONALI: le pagine regionali `/web/usr-*` sono ESCLUSE per policy —
 * ScuoleRadar copre il livello nazionale (MIM + Gazzetta Ufficiale).
 * Le voci di TUTTE le pagine vengono UNITE con dedupe per link, così una
 * pagina con meno card (es. "avvisi") non viene mai persa.
 */
const PAGINE_MIM_NOTIZIE = [
  `${BASE_MIM}/web/guest/notizie`,
  `${BASE_MIM}/web/guest/avvisi`,
  `${BASE_MIM}/`,
  `${BASE_MIM}/notizie`,
];

/**
 * Scraping della pagina notizie del MIM.
 * La pagina è server-rendered: le card degli articoli usano link Liferay
 * `/web/guest/-/<slug>` con la data di pubblicazione in `<span class="date">`.
 */
export async function scrapeMimNotizie(): Promise<{ voci: VoceFonte[]; raggiunta: boolean }> {
  let raggiunta = false;
  const voci: VoceFonte[] = [];
  const linkVisti = new Set<string>();
  for (const pagina of PAGINE_MIM_NOTIZIE) {
    const { testo, status } = await fetchTestoConStato(pagina);
    if (status !== null && status >= 200 && status < 400) raggiunta = true;
    if (!testo) continue;
    const $ = cheerio.load(testo);
    const trovate: VoceFonte[] = [];
    $('a[href*="/web/guest/-/"]').each((_, el) => {
      const $el = $(el);
      const title = $el.text().replace(/\s+/g, ' ').trim();
      const href = $el.attr('href');
      if (!title || !href || title.length < 12) return;
      const link = urlAssoluto(href, BASE_MIM);
      if (!link.includes('/web/guest/-/')) return;
      // Data: si cerca nel PRIMO contenitore che la espone. Le pagine MIM usano
      // sia `h3` + `.date` (pagina notizie) sia `li.li-asset-tab-home` con
      // `<time datetime="gg/mm/aaaa">` (home/avvisi). Si preferisce `datetime`.
      const contenitori = [
        $el.closest('li').first(),
        $el.closest('article').first(),
        $el.closest('h3').parent(),
        $el.closest('div').first(),
      ];
      let dataTesto = '';
      for (const c of contenitori) {
        if (c.length === 0) continue;
        const attr = c.find('time[datetime]').first().attr('datetime');
        if (attr) {
          dataTesto = attr;
          break;
        }
        const testo = c.find('time, .date, [class*="date"]').first().text().trim();
        if (testo) {
          dataTesto = testo;
          break;
        }
      }
      const pubDate = dataTesto ? (estraiDeadline(dataTesto) ?? null) : null;
      if (!trovate.some((v) => v.link === link) && !linkVisti.has(link)) {
        trovate.push({ title, link, pubDate, description: '', fonte: 'MIM' });
      }
    });
    // Log esplicito (nessun silent-fail): senza questa riga un cambio di markup
    // del MIM che azzera le voci non sarebbe distinguibile da "0 notizie".
    console.log(`• MIM scraping: ${trovate.length} voci da ${pagina}`);
    for (const v of trovate) {
      linkVisti.add(v.link);
      voci.push(v);
    }
  }
  return { voci: voci.slice(0, 60), raggiunta };
}

/* ------------------------- Gazzetta Ufficiale ------------------------- */

const BASE_GU = 'https://www.gazzettaufficiale.it';
const FONTI_GU_RSS = [
  'https://www.gazzettaufficiale.it/rss/concorsi',
  'https://www.gazzettaufficiale.it/rss/istruzione',
  'https://www.gazzettaufficiale.it/feed/istruzione',
];

/**
 * Scraping dell'elenco ATTI della home della Gazzetta Ufficiale.
 * I feed RSS storici sono stati dismessi (oggi restituiscono HTML): la home
 * espone i link canonici degli atti `/eli/id/AAAA/MM/GG/<codice>/<serie>`
 * insieme al titolo ufficiale ("D.L. 10 settembre 2026, n. 157"). La data di
 * pubblicazione si ricava dal PERCORSO dell'URL (fonte certa, nessuna data
 * inventata). Gazzetta Ufficiale = fonte NAZIONALE per definizione.
 */
export async function scrapeGazzettaHome(): Promise<{ voci: VoceFonte[]; raggiunta: boolean }> {
  const pagina = `${BASE_GU}/home`;
  const { testo, status } = await fetchTestoConStato(pagina);
  const raggiunta = status !== null && status >= 200 && status < 400;
  if (!testo) return { voci: [], raggiunta };
  const $ = cheerio.load(testo);
  const voci: VoceFonte[] = [];
  const visti = new Set<string>();
  $('a[href*="/eli/id/"]').each((_, el) => {
    const $el = $(el);
    const href = ($el.attr('href') ?? '').trim();
    const titolo = $el.text().replace(/\s+/g, ' ').trim();
    if (!href || titolo.length < 6) return;
    let link: string;
    try {
      link = new URL(href, BASE_GU).toString();
    } catch {
      return;
    }
    link = link.replace(/^http:\/\//i, 'https://');
    if (visti.has(link)) return;
    visti.add(link);
    const m = link.match(/\/eli\/id\/(\d{4})\/(\d{2})\/(\d{2})\//);
    voci.push({
      title: titolo,
      link,
      pubDate: m ? `${m[1]}-${m[2]}-${m[3]}` : null,
      description: '',
      fonte: 'Gazzetta Ufficiale',
    });
  });
  console.log(`• Gazzetta Ufficiale scraping: ${voci.length} voci da ${pagina}`);
  return { voci: voci.slice(0, 40), raggiunta };
}

/** Recupera gli aggiornamenti della Gazzetta Ufficiale (feed RSS, poi elenco atti). */
export async function fetchNotizieGazzetta(): Promise<{ voci: VoceFonte[]; raggiunta: boolean }> {
  let raggiunta = false;
  for (const url of FONTI_GU_RSS) {
    const { testo, status } = await fetchTestoConStato(url);
    if (status !== null && status >= 200 && status < 400) raggiunta = true;
    if (!testo) continue;
    const voci = parseRss(testo, 'Gazzetta Ufficiale', BASE_GU);
    if (voci.length > 0) {
      console.log(`• GU RSS: ${voci.length} voci da ${url}`);
      return { voci, raggiunta };
    }
  }
  // Fallback (i feed RSS sono dismessi): elenco ATTI dalla home della Gazzetta.
  const scraping = await scrapeGazzettaHome();
  if (scraping.voci.length === 0 && !raggiunta && !scraping.raggiunta) {
    console.warn('⚠ Gazzetta Ufficiale: nessun feed né elenco atti raggiungibile.');
  }
  return { voci: scraping.voci, raggiunta: raggiunta || scraping.raggiunta };
}

/* ----------------------------------------------------------------------- */
/* Fonti NAZIONALI del waterfall (ARAN · giurisdizione · previdenza)        */
/* ----------------------------------------------------------------------- */

export interface FonteIstituzionale {
  etichetta: string;
  base: string;
  /**
   * LIVELLO di priorità nel waterfall NAZIONALE:
   *   1 = MIM (nazionale) · 2 = Gazzetta Ufficiale · 3 = ARAN · 4 = giurisdizione/previdenza.
   * La pipeline scende al livello successivo SOLO se quello corrente non produce
   * alcun articolo valido (vedi `raccogliNotizieRawPerLivello`).
   */
  priorita: number;
  /** Feed RSS/Atom ufficiali candidati (il primo che restituisce voci vince). */
  rss: string[];
  /** Pagine di elenco ufficiali usate come fallback di scraping (atti datati). */
  liste: string[];
}

/** Livelli del waterfall nazionale (etichette per i log della pipeline). */
export const LIVELLI_NAZIONALI: Array<{ priorita: number; etichetta: string }> = [
  { priorita: 1, etichetta: 'MIM (nazionale)' },
  { priorita: 2, etichetta: 'Gazzetta Ufficiale' },
  { priorita: 3, etichetta: 'ARAN (contrattazione nazionale)' },
  { priorita: 4, etichetta: 'Giurisdizione e previdenza' },
];

/**
 * Registro delle fonti istituzionali NAZIONALI (ScuoleRadar è nazionale).
 *
 * POLICY: le fonti REGIONALI/LOCALI (pagine USR `/web/usr-*`, AT provinciali)
 * sono state RIMOSSE: la bacheca pubblica solo copertura nazionale (MIM,
 * Gazzetta Ufficiale, ARAN, giurisdizione contabile/amministrativa, previdenza).
 * Ogni richiesta è loggata esplicitamente (✓/✗ HTTP), nessun silent-fail.
 */
export const FONTI_ISTITUZIONALI: FonteIstituzionale[] = [
  {
    etichetta: 'ARAN',
    base: 'https://www.aranagenzia.it',
    priorita: 3,
    rss: [
      'https://www.aranagenzia.it/index.php?format=feed&type=rss',
      'https://www.aranagenzia.it/index.php?format=feed&type=atom',
    ],
    liste: ['https://www.aranagenzia.it/contrattazione/contratti.html'],
  },
  {
    etichetta: 'INPS',
    base: 'https://www.inps.it',
    priorita: 4,
    rss: [
      'https://www.inps.it/it/it/rss.xml',
      'https://www.inps.it/rss.aspx',
    ],
    liste: ['https://www.inps.it/it/it/notizie.html'],
  },
  {
    etichetta: 'Corte dei Conti',
    base: 'https://www.corteconti.it',
    priorita: 4,
    rss: [
      'https://www.corteconti.it/rss/notizie',
      'https://www.corteconti.it/feed',
    ],
    liste: ['https://www.corteconti.it/home/notizie.html'],
  },
  {
    etichetta: 'Consiglio di Stato',
    base: 'https://www.giustizia-amministrativa.it',
    priorita: 4,
    rss: [],
    liste: ['https://www.giustizia-amministrativa.it/-/decisioni-e-pareri'],
  },
];

/** Percorsi che NON sono un atto/articolo singolo (indici, home, ricerca). */
const PERCORSI_NON_ARTICOLO = new Set([
  '', '/', '/home', '/index', '/index.html', '/notizie', '/news',
  '/ricerca', '/web/guest/home', '/web/guest/notizie', '/contratti.html',
]);

/** Prova i feed RSS candidati di una fonte; ritorna le prime voci utili. */
async function raccogliRssFonte(fonte: FonteIstituzionale): Promise<VoceFonte[]> {
  for (const url of fonte.rss) {
    const { testo, status } = await fetchTestoConStato(url);
    if (status !== null && status >= 200 && status < 400 && testo) {
      const voci = parseRss(testo, fonte.etichetta, fonte.base);
      if (voci.length > 0) {
        console.log(`• ${fonte.etichetta} RSS: ${voci.length} voci da ${url}`);
        return voci.slice(0, 30);
      }
    }
  }
  return [];
}

/**
 * Fallback di scraping: estrae dalla prima pagina di elenco raggiungibile i
 * link ad atti/articoli reali (stesso dominio, testo lungo, NON pagine di
 * indice). La data viene letta vicino al link quando disponibile.
 */
async function scrapeListaFonte(fonte: FonteIstituzionale): Promise<VoceFonte[]> {
  const voci: VoceFonte[] = [];
  for (const url of fonte.liste) {
    const { testo, status } = await fetchTestoConStato(url);
    if (!testo || status === null || status < 200 || status >= 400) continue;
    const $ = cheerio.load(testo);
    const hostFonte = new URL(fonte.base).hostname;
    $('a[href]').each((_, el) => {
      if (voci.length >= 30) return;
      const $el = $(el);
      const title = $el.text().replace(/\s+/g, ' ').trim();
      if (!title || title.length < 25) return;
      const href = $el.attr('href');
      if (!href) return;
      const link = urlAssoluto(href, fonte.base);
      let parsed: URL;
      try {
        parsed = new URL(link);
      } catch {
        return;
      }
      if (parsed.hostname !== hostFonte) return;
      if (PERCORSI_NON_ARTICOLO.has(parsed.pathname.replace(/\/$/, ''))) return;
      // Evita menù/navigazione: i link d'atto hanno path lunghi e testi descrittivi.
      if (parsed.pathname.length < 10 && !parsed.pathname.includes('-')) return;
      if (voci.some((v) => v.link === link)) return;
      // Data: cerca nel contesto del link (testo + genitori), max 300 caratteri.
      const contesto = `${title} ${$el.closest('article, li, div').first().text().replace(/\s+/g, ' ').slice(0, 300)}`;
      voci.push({
        title,
        link,
        pubDate: estraiDeadline(contesto),
        description: contesto,
        fonte: fonte.etichetta,
      });
    });
    if (voci.length > 0) {
      console.log(`• ${fonte.etichetta} scraping: ${voci.length} voci da ${url}`);
      return voci;
    }
  }
  return [];
}

/** Raccolta per una singola nuova fonte (RSS first, poi scraping di lista). */
export async function fetchDaFonteIstituzionale(
  fonte: FonteIstituzionale,
): Promise<{ voci: VoceFonte[]; raggiunta: boolean }> {
  const rssVoci = fonte.rss.length > 0 ? await raccogliRssFonte(fonte) : [];
  if (rssVoci.length > 0) return { voci: rssVoci, raggiunta: true };

  const listeVoci = await scrapeListaFonte(fonte);
  if (listeVoci.length > 0) return { voci: listeVoci, raggiunta: true };

  // Nessuna pagina/feed risponde: la fonte resta tracciata ma non raggiunta.
  console.warn(`⚠ ${fonte.etichetta}: nessuna voce disponibile (RSS o pagina di elenco).`);
  return { voci: [], raggiunta: false };
}

/** Esito aggregato della raccolta: voci + numero di fonti raggiunte (0-2). */
export interface EsitoRaccolta {
  voci: VoceFonte[];
  fontiRaggiunte: number;
}

/** Esito di un LIVELLO del waterfall nazionale. */
export interface LivelloRaccolta {
  priorita: number;
  etichetta: string;
  voci: VoceFonte[];
  raggiunta: boolean;
}

/**
 * WATERFALL NAZIONALE — raccoglie le voci di UN livello, in ordine di priorità:
 *   1. MIM (nazionale)               → feed RSS (dismessi) + pagine notizie/avvisi/home;
 *   2. Gazzetta Ufficiale            → feed RSS + elenco atti della home;
 *   3. ARAN                          → contrattazione nazionale (CCNL);
 *   4. Giurisdizione e previdenza    → Corte dei Conti, INPS, Consiglio di Stato.
 *
 * La pipeline (`ingestNotizie`) interroga un livello alla volta e scende al
 * successivo SOLO se quello corrente non produce articoli validi.
 */
export async function raccogliLivello(priorita: number): Promise<LivelloRaccolta | null> {
  const meta = LIVELLI_NAZIONALI.find((l) => l.priorita === priorita);
  if (!meta) return null;

  if (priorita === 1) {
    const r = await fetchNotizieMim();
    return { priorita, etichetta: meta.etichetta, voci: r.voci, raggiunta: r.raggiunta };
  }
  if (priorita === 2) {
    const r = await fetchNotizieGazzetta();
    return { priorita, etichetta: meta.etichetta, voci: r.voci, raggiunta: r.raggiunta };
  }

  const fonti = FONTI_ISTITUZIONALI.filter((f) => f.priorita === priorita);
  const voci: VoceFonte[] = [];
  let raggiunta = false;
  const esiti = await Promise.allSettled(fonti.map((f) => fetchDaFonteIstituzionale(f)));
  for (const r of esiti) {
    if (r.status === 'fulfilled') {
      voci.push(...r.value.voci);
      if (r.value.raggiunta) raggiunta = true;
    } else {
      console.warn('⚠ Fonte non disponibile:', (r.reason as Error)?.message);
    }
  }
  return { priorita, etichetta: meta.etichetta, voci, raggiunta };
}

/** Aggrega le voci da tutte le fonti ufficiali, tracciando quali hanno risposto. */
export async function raccogliNotizieRaw(): Promise<EsitoRaccolta> {
  const legacy = await Promise.allSettled([
    fetchNotizieMim(),
    fetchNotizieGazzetta(),
  ]);
  const nuove = await Promise.allSettled(
    FONTI_ISTITUZIONALI.map((f) => fetchDaFonteIstituzionale(f)),
  );
  const voci: VoceFonte[] = [];
  let fontiRaggiunte = 0;
  for (const r of [...legacy, ...nuove]) {
    if (r.status === 'fulfilled') {
      voci.push(...r.value.voci);
      if (r.value.raggiunta) fontiRaggiunte += 1;
    } else {
      console.warn('⚠ Fonte non disponibile:', (r.reason as Error)?.message);
    }
  }
  return { voci, fontiRaggiunte };
}
