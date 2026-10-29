/**
 * ScuoleRadar.it — LA PAGINA SUCCESSIVA DI UN ELENCO (§26.102).
 *
 * Perché esiste: un hub USR che pubblica «Interpelli» su WordPress mostra 10 voci
 * per pagina e ne tiene 200 in archivio. Il runner legge UNA pagina per target,
 * quindi le pagine 2…N non esistono per il radar: misurato il 29/10/2026,
 * `…/tag/interpelli/page/2/` dell'AT di Napoli restituisce **altre 12 voci
 * apribili** che il giro nazionale non ha mai visto.
 *
 * Qui si legge l'URL della pagina successiva **dichiarata dalla pagina stessa**
 * (mai costruita a indovinare), in tre passi:
 *   1. `rel="next"` (`<link>` o `<a>`) — dichiarazione esplicita;
 *   2. ancora «successiva / next / › / avanti» DENTRO un contenitore di
 *      paginazione (fuori è un avviso che si chiama così, non una pagina);
 *   3. paginazione NUMERICA «1 2 3 … N» senza alcuna «successiva» (tema Roma Tre
 *      `rt-pagination`, molti temi WP e dei portali PA): si segue l'etichetta
 *      `corrente + 1`, dove la pagina corrente viene dall'URL (`/page/3/`,
 *      `?paged=3`) o dal marcatore `active`/`current` della paginazione. Se la
 *      pagina non dice dove siamo, non si indovina.
 *
 * Estratto da `universalHtml.ts` per la soglia dei 250 righe (§26.84): il lettore
 * HTML resta un tokenizzatore puro, la paginazione ha un modulo suo.
 * Guardie: `npm run test:paginazione`, `npm run test:elenchi:paginati`.
 */

import { testo } from './universalHtml.ts';

const RE_ANCORA_TAG = /<a\b([^>]*)>([\s\S]*?)<\/a>/gi;
const RE_LINK_TAG = /<link\b([^>]*)>/gi;
const RE_HREF = /href\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+))/i;
const RE_REL = /rel\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i;
/** Contenitori (o classi dell'ancora) che sono navigazione di paginazione. */
const RE_PAGINAZIONE =
  /\b(?:pagination|paginazione|pager|paging|page-numbers|wp-pagenavi|nav-links|page-links)\b/i;
/** Testo di un'ancora che dichiara la pagina successiva. */
const RE_TESTO_SUCCESSIVA =
  /^(?:next(?:\s+page)?|pagina\s+successiva|successiv[ao]|avanti|›|»|>|→)[\s»›>→]*$/i;
/** Marcatore della pagina CORRENTE dentro la paginazione (`active`/`current`). */
const RE_PAGINA_CORRENTE =
  /class\s*=\s*(?:"[^"]*\b(?:current|active)\b[^"]*"|'[^']*\b(?:current|active)\b[^']*')[^>]*>([\s\S]{0,120}?)<\/(?:span|li|a|strong|em)>/i;
/**
 * Primo TAG con classe di paginazione. Deve essere un TAG e non una classe nel
 * CSS: il `<style>` inline contiene `.pagination` prima del markup, e un blocco
 * che parte dal foglio di stile non trova né il marcatore né le etichette.
 */
const RE_TAG_PAGINAZIONE =
  /<(?:nav|div|ul|ol|section|table|span|p|form)\b[^>]*\b(?:pagination|paginazione|pager|paging|page-numbers|wp-pagenavi|nav-links|page-links)\b[^>]*>/i;

/** Vero se l'attributo `rel` contiene `next`. */
function eRelNext(attributi: string): boolean {
  const m = RE_REL.exec(attributi);
  if (!m) return false;
  return /(?:^|\s)next(?:\s|$)/i.test(m[1] ?? m[2] ?? m[3] ?? '');
}

/** URL assoluta e diversa dalla pagina corrente, `undefined` altrimenti. */
function risolviPagina(href: string, base: URL): string | undefined {
  const grezzo = testo(href);
  if (!grezzo || grezzo.startsWith('#')) return undefined;
  let url: URL;
  try {
    url = new URL(grezzo, base);
  } catch {
    return undefined;
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return undefined;
  // Stessa pagina (anche con `#ancora` o con la sola differenza di slash finale):
  // seguire sé stessi è un ciclo, non una pagina successiva.
  const chiave = (u: URL): string => `${u.host}${u.pathname.replace(/\/+$/, '')}${u.search}`;
  return chiave(url) === chiave(base) ? undefined : url.href;
}

/**
 * Vero se l'ancora sta dentro un contenitore di paginazione: la classe del
 * contenitore compare poco prima dell'ancora (`nav.pagination`, `.wp-pagenavi`,
 * `.nav-links`, `.page-numbers` in un `div`). L'ancora stessa può dichiararla.
 */
function inPaginazione(html: string, inizioAncora: number, attributi: string): boolean {
  if (RE_PAGINAZIONE.test(attributi)) return true;
  const contesto = html.slice(Math.max(0, inizioAncora - 3_000), inizioAncora);
  const classi = contesto.match(/class\s*=\s*(?:"([^"]*)"|'([^']*)')/gi);
  if (!classi) return false;
  return classi.some((classe) => RE_PAGINAZIONE.test(classe));
}

/** Blocco HTML della paginazione: dal primo TAG riconosciuto in avanti. */
function bloccoPaginazione(html: string): string | undefined {
  const m = RE_TAG_PAGINAZIONE.exec(html);
  return m ? html.slice(m.index, m.index + 8_000) : undefined;
}

/**
 * Numero della pagina che stiamo leggendo: dall'URL (`/page/3/`, `?paged=3`,
 * pattern WordPress) oppure dal marcatore `active`/`current` della paginazione.
 * `undefined` quando la pagina non lo dichiara: senza sapere DOVE siamo non si
 * può dire qual è la successiva, e non si indovina.
 */
function numeroPaginaCorrente(base: URL, blocco: string): number | undefined {
  const daUrl =
    /\/page\/(\d+)\/?$/i.exec(base.pathname)?.[1] ?? base.searchParams.get('paged') ?? undefined;
  const n = Number(daUrl ?? Number.NaN);
  if (Number.isInteger(n) && n > 0 && n < 1_000) return n;
  const m = RE_PAGINA_CORRENTE.exec(blocco);
  if (!m) return undefined;
  const cifre = /\d{1,3}/.exec(testo(m[1]));
  const k = Number(cifre?.[0] ?? Number.NaN);
  return Number.isInteger(k) && k > 0 ? k : undefined;
}

/**
 * URL della PAGINA SUCCESSIVA di un elenco, se la pagina la dichiara.
 * `undefined` quando non c'è: nessuna URL inventata, nessun ciclo.
 */
export function urlPaginaSuccessiva(html: string, baseUrl: string): string | undefined {
  let base: URL;
  try {
    base = new URL(baseUrl);
  } catch {
    return undefined;
  }
  // 1. dichiarazione esplicita: `<link rel="next">`, `<a rel="next">`.
  for (const m of html.matchAll(RE_LINK_TAG)) {
    if (!eRelNext(m[1])) continue;
    const href = RE_HREF.exec(m[1]);
    if (!href) continue;
    const url = risolviPagina(href[1] ?? href[2] ?? href[3] ?? '', base);
    if (url) return url;
  }
  // 2. ancora di navigazione: «successiva», «next», «›» (anche senza `rel`).
  for (const m of html.matchAll(RE_ANCORA_TAG)) {
    const attributi = m[1];
    const testoAncora = testo(m[2]);
    const esplicita = eRelNext(attributi);
    if (!esplicita && !RE_TESTO_SUCCESSIVA.test(testoAncora)) continue;
    if (!esplicita && !inPaginazione(html, m.index ?? 0, attributi)) continue;
    const href = RE_HREF.exec(attributi);
    if (!href) continue;
    const url = risolviPagina(href[1] ?? href[2] ?? href[3] ?? '', base);
    if (url) return url;
  }
  // 3. paginazione NUMERICA: si segue l'etichetta `corrente + 1`.
  const blocco = bloccoPaginazione(html);
  if (blocco) {
    const corrente = numeroPaginaCorrente(base, blocco);
    if (corrente !== undefined) {
      const cercata = String(corrente + 1);
      for (const m of blocco.matchAll(RE_ANCORA_TAG)) {
        if (testo(m[2]) !== cercata) continue;
        const href = RE_HREF.exec(m[1]);
        if (!href) continue;
        const url = risolviPagina(href[1] ?? href[2] ?? href[3] ?? '', base);
        if (url) return url;
      }
    }
  }
  return undefined;
}

