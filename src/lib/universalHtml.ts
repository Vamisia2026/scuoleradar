/**
 * ScuoleRadar.it — LETTORE HTML MINIMO PER LE EURISTICHE (§26.84).
 *
 * `cheerio` è una dipendenza degli script, non della libreria: qui serve solo
 * sapere dove comincia e dove finisce un elemento e che testo contiene. Questo
 * modulo lo fa con un tokenizzatore di poche righe, **puro e senza dipendenze**:
 * risolve l'annidamento (il blocco si chiude sul `</tag>` corrispondente),
 * decodifica le entità che i portali italiani usano davvero (accenti, virgolette,
 * `&nbsp;`) e risolve gli `href` relativi sulla pagina.
 *
 * È il livello di lettura di `universalEuristica.ts`: non conosce né interpelli
 * né colonne, solo HTML. Guardia: `npm run test:universal-euristica`.
 */

/** Frammento di un elemento: contenuto interno e attributi del tag di apertura. */
export interface Blocco {
  html: string;
  attributi: string;
}

/** Come sono fatte le celle della griglia che si sta leggendo. */
export type TipoCelle = 'table' | 'aria' | 'div';

const ENTITA: Readonly<Record<string, string>> = {
  nbsp: ' ', amp: '&', quot: '"', apos: "'", lt: '<', gt: '>', ndash: '–', mdash: '—',
  laquo: '«', raquo: '»', deg: '°', euro: '€', agrave: 'à', egrave: 'è', eacute: 'é',
  igrave: 'ì', ograve: 'ò', ugrave: 'ù', ccedil: 'ç',
};

/** Testo leggibile di un frammento HTML: tag via, entità decodificate. */
export function testo(frammento: string): string {
  const senzaScript = frammento.replace(/<(script|style|noscript)\b[\s\S]*?<\/\1>/gi, ' ');
  return senzaScript
    .replace(/<[^>]*>/g, ' ')
    .replace(/&#x([0-9a-f]+);/gi, (_, esa) => String.fromCharCode(parseInt(String(esa), 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(Number(dec)))
    .replace(/&([a-z]+);/gi, (intero, nome) => ENTITA[String(nome).toLowerCase()] ?? intero)
    .replace(/[\u00a0\u2007\u202f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Elementi che soddisfano il filtro, con l'annidamento RISOLTO: il blocco si
 * chiude sul `</tag>` corrispondente, non sul primo che capita, e la scansione
 * riprende dopo il blocco (una tabella dentro una riga non vale due righe).
 */
export function blocchi(html: string, filtro: (tag: string, attributi: string) => boolean): Blocco[] {
  const trovati: Blocco[] = [];
  const apertura = /<([a-z][a-z0-9]*)\b([^>]*)>/gi;
  let m: RegExpExecArray | null;
  while ((m = apertura.exec(html)) !== null) {
    const tag = m[1].toLowerCase();
    if (!filtro(tag, m[2])) continue;
    const chiusura = new RegExp(`<(/?)${tag}\\b[^>]*>`, 'gi');
    chiusura.lastIndex = apertura.lastIndex;
    let profondita = 1;
    let fine = html.length;
    let t: RegExpExecArray | null;
    while ((t = chiusura.exec(html)) !== null && profondita > 0) {
      profondita += t[1] === '/' ? -1 : 1;
      if (profondita === 0) fine = t.index;
    }
    trovati.push({ html: html.slice(apertura.lastIndex, fine), attributi: m[2] });
    apertura.lastIndex = fine;
  }
  return trovati;
}

const RE_RUOLO_CELLA = /role\s*=\s*["']?(?:gridcell|cell|columnheader|rowheader)\b/i;

/** Celle di una riga: `<td>/<th>`, `role="cell"`, oppure i `<div>/<span>` figli. */
export function celle(riga: string, tipo: TipoCelle): string[] {
  const filtro = tipo === 'table'
    ? (tag: string): boolean => tag === 'td' || tag === 'th'
    : tipo === 'aria'
      ? (tag: string, attributi: string): boolean => tag !== 'tr' && RE_RUOLO_CELLA.test(attributi)
      : (tag: string): boolean => tag === 'div' || tag === 'span';
  return blocchi(riga, filtro).map((b) => b.html);
}

const RE_ANCORA = /<a\b([^>]*)>([\s\S]*?)<\/a>/gi;
const RE_HREF = /href\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+))/i;
const RE_URL_INUTILE = /^(?:#|javascript:|mailto:|tel:)/i;

/**
 * URL assoluto della voce, `undefined` se punta a una home, a una ricerca o a
 * un'ancora interna: una riga senza documento non è un interpello apribile, ed
 * è meglio nessuna voce che una voce che apre la pagina sbagliata.
 */
export function urlUtile(href: string, baseUrl: string): string | undefined {
  const grezzo = testo(href);
  if (!grezzo || RE_URL_INUTILE.test(grezzo)) return undefined;
  let url: URL;
  let base: URL;
  try {
    base = new URL(baseUrl);
    url = new URL(grezzo, base);
  } catch {
    return undefined;
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return undefined;
  if (/[?&](?:q|s|search|ricerca|keyword)=/i.test(url.search)) return undefined;
  if (/\/(?:cerca|search|ricerca)\b/i.test(url.pathname) || /(?:^|\.)google\./i.test(url.hostname)) {
    return undefined;
  }
  const percorso = url.pathname.replace(/\/+$/, '');
  if (percorso === '' || percorso === base.pathname.replace(/\/+$/, '')) return undefined;
  return url.href;
}

/** Metadati dichiarati sull'ancora: `title` e `aria-label` (§26.94). */
export interface MetadatiAncora {
  titolo?: string;
  ariaLabel?: string;
}

const RE_TITLE_ATTR = /title\s*=\s*(?:"([^"]*)"|'([^']*)')/i;
const RE_ARIA_ATTR = /aria-label\s*=\s*(?:"([^"]*)"|'([^']*)')/i;

/**
 * `title` / `aria-label` di un'ancora, già decodificati: su molti portali il
 * termine è scritto lì e non nel testo visibile («Scarica l'avviso — scadenza
 * 12/11/2026»).
 */
export function metadatiAncora(attributi: string): MetadatiAncora {
  const titolo = RE_TITLE_ATTR.exec(attributi);
  const aria = RE_ARIA_ATTR.exec(attributi);
  const out: MetadatiAncora = {};
  const valore = (m: RegExpExecArray | null): string =>
    m ? testo(m[1] ?? m[2] ?? '') : '';
  const testoTitle = valore(titolo);
  const testoAria = valore(aria);
  if (testoTitle) out.titolo = testoTitle;
  if (testoAria) out.ariaLabel = testoAria;
  return out;
}

/** Primo collegamento utile di un frammento, con testo e metadati dell'ancora. */
export function primoLink(
  frammento: string,
  baseUrl: string,
): { url: string; testo: string; metadati: MetadatiAncora } | undefined {
  for (const m of frammento.matchAll(RE_ANCORA)) {
    const href = RE_HREF.exec(m[1]);
    const url = href ? urlUtile(href[1] ?? href[2] ?? href[3] ?? '', baseUrl) : undefined;
    if (url) return { url, testo: testo(m[2]), metadati: metadatiAncora(m[1]) };
  }
  return undefined;
}
