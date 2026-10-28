/**
 * ScuoleRadar.it — QUALI LINK DI UN ISTITUTO PORTANO A UN INTERPELLO (§26.94).
 *
 * Perché esiste come modulo a sé: la scelta «questo link è un elenco di
 * interpelli?» è una REGOLA DI PRODOTTO, non un dettaglio del crawler, e vale sia
 * per le pagine-elenco sia per gli allegati PDF (§26.95). Tenerla qui permette
 * di provarla senza rete e di usarla in entrambi i giri.
 *
 * Le due domande che questo modulo risponde:
 *  · `linkInterpelliScuola`: quali PAGINE della home elencano interpelli (stesso
 *    host, mai piattaforma privata, mai un file, mai una ricerca/paginazione);
 *  · `linkAllegatiInterpello`: quali ALLEGATI PDF di un albo dichiarano il
 *    termine (il documento vive lì quando la pagina elenca solo file).
 *
 * §26.96 — L'ECCEZIONE DEI GESTORI DOCUMENTALI. Un albo può elencare solo righe
 * con il link al PDF su Gecodoc, Argo o Nuvola/Spaggiari: quei file sono gli
 * avvisi veri, mentre la HOME della stessa piattaforma resta un login. La regola
 * «stesso istituto» si applica quindi a tutti gli host TRANNE a un allegato
 * servito da una piattaforma documentale (`allegatiPiattaforma.ts`).
 *
 * Nessuna URL costruita a mano: solo link presenti nell'HTML letto.
 * Guardie: `npm run test:deep-crawl`, `npm run test:pdf-testo`,
 * `npm run test:piattaforme-documentali`.
 */

import { eAllegatoPiattaforma } from './allegatiPiattaforma.ts';
import { ePiattaformaPrivata } from '../lib/piattaformeLink.ts';
import { testo, urlUtile } from '../lib/universalHtml.ts';

/** Un link candidato della home di un istituto. */
export interface LinkScuola {
  url: string;
  testo: string;
}

/** Un allegato PDF di una pagina-elenco: il documento che dichiara il termine. */
export interface AllegatoPdf {
  url: string;
  testo: string;
}

/** Parole che indicano la sezione in cui un istituto pubblica gli interpelli. */
const RE_LINK_INTERPELLI =
  /interpell|supplenz|messa\s+a\s+disposizione|incaric|disponibilit|albo|avvis|graduator|band[oi]|selezion/i;

/** Link di servizio che non portano mai a un avviso. */
const RE_LINK_ESCLUSO =
  /login|registro|argo|nuvola|classeviva|spaggiari|madisoft|facebook|instagram|youtube|twitter|linkedin|telegram|whatsapp|privacy|cookie|contatti|wp-login|wp-admin|\/feed\b|mappa|\/serviz[io]+\//i;

/** Un permalink di un SINGOLO avviso (`/2026/02/10/avviso-…`): non è un elenco. */
const RE_URL_PERMALINK = /\/(?:19|20)\d{2}\/\d{1,2}\/\d{1,2}\//;

/**
 * `/notizie/122-graduatorie-…`: un ARTICOLO, non la pagina che li elenca. Una
 * categoria resta valida (`/notizie/interpelli/`), perché lo slug è una parola
 * di elenco.
 */
function eArticoloSingolo(pathname: string): boolean {
  const m = /^\/(?:notizie|news|comunicati)\/([\w-]{6,})\/?$/i.exec(pathname);
  if (!m) return false;
  // Una categoria comincia con la parola di elenco («/notizie/interpelli/»);
  // un articolo comincia con un id o con un titolo («/notizie/122-graduatorie…»).
  return !/^(?:interpell|supplenz|albo|avvis|band[oi]|graduator|categor|archivi)/i.test(m[1]);
}

/** File: un allegato non è la pagina che elenca gli interpelli. */
const RE_FILE = /\.(?:pdf|docx?|xlsx?|pptx?|zip|rar|7z|jpe?g|png|gif|svg|mp4)$/i;

const RE_ANCORA = /<a\b([^>]*)>([\s\S]*?)<\/a>/gi;
const RE_HREF = /href\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+))/i;

/** Stesso istituto: host uguale, oppure sottodominio dell'uno o dell'altro. */
function stessaCasa(url: URL, base: URL): boolean {
  const host = url.hostname.toLowerCase().replace(/^www\./, '');
  const hostBase = base.hostname.toLowerCase().replace(/^www\./, '');
  return host === hostBase || host.endsWith(`.${hostBase}`) || hostBase.endsWith(`.${host}`);
}

/** Punteggio del link: 2 = interpelli/supplenze, 1 = albo/avvisi, 0 = altro. */
function punteggioLink(testoLink: string, url: string): number {
  const insieme = `${testoLink} ${url}`;
  if (/interpell|supplenz|messa\s+a\s+disposizione|incaric|disponibilit/i.test(insieme)) return 2;
  if (/albo|avvis|graduator|band[oi]|selezion/i.test(insieme)) return 1;
  return 0;
}

/** Le ancore dell'HTML con un href valido: url assoluta, testo del link, URL parsata. */
function* ancore(
  html: string,
  baseUrl: string,
): Generator<{ url: string; testoLink: string; parsed: URL }> {
  for (const m of html.matchAll(RE_ANCORA)) {
    const href = RE_HREF.exec(m[1]);
    const url = href ? urlUtile(href[1] ?? href[2] ?? href[3] ?? '', baseUrl) : undefined;
    if (!url) continue;
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      continue;
    }
    yield { url, testoLink: testo(m[2]), parsed };
  }
}

/**
 * Link della home di un istituto che possono contenere l'elenco degli
 * interpelli, nell'ordine di pertinenza (poi ordine di pagina). Massimo
 * `max` risultati, senza duplicati.
 */
export function linkInterpelliScuola(html: string, homeUrl: string, max = 3): LinkScuola[] {
  if (typeof html !== 'string' || html.trim() === '') return [];
  let base: URL;
  try {
    base = new URL(homeUrl);
  } catch {
    return [];
  }
  const trovati = new Map<string, LinkScuola & { punteggio: number }>();
  for (const { url, testoLink, parsed } of ancore(html, homeUrl)) {
    if (RE_FILE.test(parsed.pathname) || !stessaCasa(parsed, base)) continue;
    if (RE_URL_PERMALINK.test(parsed.pathname)) continue;
    if (eArticoloSingolo(parsed.pathname)) continue;
    if (ePiattaformaPrivata(url)) continue;
    const insieme = `${testoLink} ${parsed.pathname}`;
    if (!RE_LINK_INTERPELLI.test(insieme) || RE_LINK_ESCLUSO.test(insieme)) continue;
    if (trovati.has(url)) continue;
    trovati.set(url, { url, testo: testoLink, punteggio: punteggioLink(testoLink, url) });
  }
  return [...trovati.values()]
    .sort((a, b) => b.punteggio - a.punteggio)
    .slice(0, Math.max(0, max))
    .map(({ url, testo: testoLink }) => ({ url, testo: testoLink }));
}

/**
 * §26.95 — gli ALLEGATI PDF di una pagina d'albo.
 *
 * Perché separato da `linkInterpelliScuola`: un PDF non è una pagina-elenco (lì
 * resta escluso, giustamente), ma è il documento che dichiara «entro le ore
 * 12:00 del 12/11/2026». Quando l'albo elenca solo file, il termine vive lì.
 *
 * Regole: stesso istituto, mai una piattaforma privata, e il testo del link o il
 * nome del file deve parlare di interpello/supplenza/avviso (un allegato
 * qualsiasi non si scarica).
 */
export function linkAllegatiInterpello(html: string, baseUrl: string, max = 3): AllegatoPdf[] {
  if (typeof html !== 'string' || html.trim() === '') return [];
  let base: URL;
  try {
    base = new URL(baseUrl);
  } catch {
    return [];
  }
  const trovati = new Map<string, AllegatoPdf>();
  for (const { url, testoLink, parsed } of ancore(html, baseUrl)) {
    // §26.96 — un allegato su piattaforma documentale è un DOCUMENTO (il PDF
    // dell'avviso), non una pagina di login: si accetta anche fuori dall'host
    // della scuola. Per tutti gli altri host valgono le regole di sempre.
    const daPiattaforma = eAllegatoPiattaforma(url);
    if (!daPiattaforma) {
      if (!/\.pdf$/i.test(parsed.pathname) || !stessaCasa(parsed, base)) continue;
      if (ePiattaformaPrivata(url)) continue;
    }
    const nome = decodeURIComponent(parsed.pathname.split('/').pop() ?? '');
    if (!RE_LINK_INTERPELLI.test(`${testoLink} ${nome}`)) continue;
    if (RE_LINK_ESCLUSO.test(`${testoLink} ${nome}`)) continue;
    if (trovati.has(url)) continue;
    trovati.set(url, { url, testo: testoLink });
  }
  return [...trovati.values()].slice(0, Math.max(0, max));
}

