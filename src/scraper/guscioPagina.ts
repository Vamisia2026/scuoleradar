/**
 * ScuoleRadar.it — PAGINE GUSCIO: si entra nel FRAME (§26.113).
 *
 * Perché esiste: molti siti di istituto non pubblicano l'albo nella pagina che
 * l'anagrafica dichiara. La home è un `frameset` (o un `<iframe>` a tutta
 * pagina) che carica il vero portale — o una pagina con solo un
 * `<meta http-equiv="refresh" content="0;url=…">`. In quei casi il deep crawl
 * (§26.94) leggeva la home, non trovava un solo link «Interpelli/Albo» e
 * chiudeva la scuola con `linkTrovati: 0`: zero avvisi, senza che nessuno
 * sapesse che la pagina non era vuota — era un guscio.
 *
 * LA REGOLA (una sola)
 *   si guarda l'HTML e si restituisce l'URL del contenuto VERO, in quest'ordine:
 *   `<iframe src>` / `<frame src>` → `<meta refresh>`; niente altro. Nessun URL
 *   costruito a mano: solo ciò che è scritto nella pagina.
 *
 * FUORI PER SCELTA: `about:blank`, `javascript:`, i contenitori pubblicitari e i
 * social (`google.com`, `youtube.com`, `facebook.com`, …) non sono contenuti —
 * sono contorni che porterebbero il crawler fuori dal sito della scuola.
 *
 * Modulo PURO: zero dipendenze, nessuna rete, nessun `node:*`.
 * Guardia: `npm run test:guscio-pagina` (incluso in `npm test`).
 */

/** Contenitore con `src` (iframe di ogni epoca e `frame` dei frameset). */
const RE_CONTENITORE = /<(?:iframe|frame)\b[^>]*\bsrc\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+))/gi;

/** Meta refresh: `<meta http-equiv="refresh" content="0;url=…">`. */
const RE_META = /<meta\b[^>]*>/gi;
const RE_HTTP_EQUIV_REFRESH = /http-equiv\s*=\s*(?:"refresh"|'refresh'|refresh)/i;
const RE_CONTENT = /content\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+))/i;
const RE_URL_NEL_CONTENT = /url\s*=\s*['"]?([^'";]+)/i;

/** Host che non sono mai «il contenuto» della scuola. */
const HOST_DA_IGNORARE: readonly string[] = [
  'about:blank',
  'google.com',
  'googletagmanager.com',
  'google-analytics.com',
  'doubleclick.net',
  'youtube.com',
  'facebook.com',
  'instagram.com',
  'linkedin.com',
  'twitter.com',
  'x.com',
];

/** URL assoluto `http(s)` della stringa, `null` se non è un URL valido. */
function urlAssoluta(grezzo: string, baseUrl: string): string | null {
  try {
    const url = new URL((grezzo ?? '').trim(), baseUrl);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    url.hash = '';
    return url.href;
  } catch {
    return null;
  }
}

/** Chiave di confronto senza frammento e senza barra finale. */
function chiave(url: string): string {
  return url.replace(/#.*$/, '').replace(/\/+$/, '');
}

/** `true` se l'host è un contorno pubblicitario/social da non seguire. */
function hostDaIgnorare(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return HOST_DA_IGNORARE.some(
      (voce) => host === voce || host.endsWith(`.${voce}`),
    );
  } catch {
    return true;
  }
}

/**
 * URL del contenuto vero quando la pagina è un GUSCIO, altrimenti `null`.
 * Non restituisce mai la pagina stessa (`baseUrl`): un frame che punta a sé è
 * un anello, non un contenuto.
 */
export function urlGuscio(html: string, baseUrl: string): string | null {
  if (typeof html !== 'string' || html.trim() === '') return null;
  const base = urlAssoluta(baseUrl, baseUrl);
  if (!base) return null;
  const baseChiave = chiave(base);

  const ammissibile = (grezzo: string): string | null => {
    const url = urlAssoluta(grezzo, base);
    if (!url || chiave(url) === baseChiave || hostDaIgnorare(url)) return null;
    return url;
  };

  for (const m of html.matchAll(RE_CONTENITORE)) {
    const url = ammissibile(m[1] ?? m[2] ?? m[3] ?? '');
    if (url) return url;
  }

  for (const m of html.matchAll(RE_META)) {
    const tag = m[0];
    if (!RE_HTTP_EQUIV_REFRESH.test(tag)) continue;
    const content = tag.match(RE_CONTENT);
    if (!content) continue;
    const valore = content[1] ?? content[2] ?? content[3] ?? '';
    const url = valore.match(RE_URL_NEL_CONTENT);
    if (!url) continue;
    const assoluto = ammissibile(url[1]);
    if (assoluto) return assoluto;
  }

  return null;
}
