/**
 * ScuoleRadar.it — ALLEGATI SERVITI DA UNA PIATTAFORMA DOCUMENTALE (§26.96).
 *
 * Perché esiste: l'esempio dell'albo di Arezzo (Gecodoc) chiude la questione. La
 * pagina-elenco dell'Ufficio non contiene tabelle: contiene RIGHE con un link che
 * porta a `gecodoc.it/…/documento/1234` oppure `…portaleargo.it/…/avviso.pdf`.
 * Il vecchio filtro scartava tutto ciò che stava su una piattaforma — giusto per
 * una pagina di login, SBAGLIATO per un file: quel PDF *è* l'avviso ufficiale,
 * con la scadenza e il codice meccanografico dentro.
 *
 * COSA DISTINGUE QUESTO MODULO
 *  · `eFileDocumento` — l'URL è un documento (`.pdf`, `.p7m`, oppure un endpoint
 *    di download/visualizzazione, oppure un viewer che porta un `.pdf` in query);
 *  · `eAllegatoPiattaforma` — documento **E** host di una piattaforma scolastica
 *    (`lib/piattaformeLink.PIATTAFORME_SCOLASTICHE`: Argo, Nuvola, Spaggiari,
 *    ClasseViva, Gecodoc). Solo questa combinazione scavalca le regole di
 *    «stesso sito / mai una piattaforma»: un link di LOGIN resta escluso;
 *  · `urlDocumentoInHtml` — quando la piattaforma risponde con una pagina
 *    contenitore (un viewer con `<iframe>`/`<embed>`), qui si trova l'URL del
 *    PDF vero: UN salto, nessuna URL costruita a mano.
 *
 * Zero dipendenze, nessun accesso a `node:*`, nessuna rete: solo URL e stringhe.
 * Guardia: `npm run test:piattaforme-documentali` (incluso in `npm test`).
 */

import { piattaformaScolastica, type PiattaformaScolastica } from '../lib/piattaformeLink.ts';

/**
 * Estensione di un documento scaricabile (il `.p7m` è il PDF firmato).
 * §26.101 — l'estensione può stare anche PRIMA della fine del percorso: il
 * repository Liferay del MIM serve i propri allegati come
 * `/documents/9081047/10244555/Interpelli+n.+72.pdf/<uuid>?version=1.0`.
 * Con la sola estensione finale quei documenti non erano riconosciuti e 200
 * avvisi per ufficio restavano senza scadenza («Data Scadenza: -», il termine
 * era dentro il PDF).
 */
const RE_ESTENSIONE_DOCUMENTO = /\.(?:pdf|p7m)(?:$|[/?#])/i;

/**
 * Endpoint tipici dei gestori documentali: la pagina non ha estensione ma serve
 * un file (`/documento/12`, `/documents/9081047/…`, `?docId=…`, `/download/…`).
 */
const RE_ENDPOINT_DOCUMENTO =
  /\/(?:document[oi]|documents|allegat[oi]|download|openfile|getfile|visualizza|anteprima|viewer|file)\b|[?&](?:doc(?:umento)?_?id|id_documento|allegato|file|doc)=/i;

/** Un `.pdf` può comparire anche in query (viewer Google: `?url=…pdf`). */
const RE_PDF_IN_URL = /\.pdf(?:$|[&#?])/i;

/** URL assoluto `http(s)` della stringa, `null` se non è un URL valido. */
function urlAssoluta(grezzo: string, baseUrl: string): string | null {
  try {
    const url = new URL(grezzo.trim(), baseUrl);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    url.hash = '';
    return url.href;
  } catch {
    return null;
  }
}

/**
 * True se l'URL serve un DOCUMENTO (e non una pagina di credenziali):
 * estensione `.pdf`/`.p7m`, endpoint di download, o un `.pdf` dentro la query.
 * Il controllo è sull'URL intero: un percorso `/argo/` su un sito di scuola non
 * basta a dichiarare «documento», mentre `/argo/avviso.pdf` sì.
 */
export function eFileDocumento(url?: string | null): boolean {
  const testo = (url ?? '').trim();
  if (!testo) return false;
  let parsed: URL;
  try {
    parsed = new URL(testo);
  } catch {
    return false;
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return false;
  if (RE_ESTENSIONE_DOCUMENTO.test(parsed.pathname) || RE_PDF_IN_URL.test(testo)) return true;
  return RE_ENDPOINT_DOCUMENTO.test(`${parsed.pathname}${parsed.search}`);
}

/**
 * La piattaforma scolastica che serve questo link come ALLEGATO, oppure `null`.
 * Un `.pdf` su Argo/Gecodoc/Nuvola è l'avviso; la home della stessa piattaforma
 * resta un muro di login e vale `null` (quindi resta esclusa da tutti i filtri).
 */
export function piattaformaAllegato(url?: string | null): PiattaformaScolastica | null {
  if (!eFileDocumento(url)) return null;
  return piattaformaScolastica(url);
}

/** True se l'URL è un allegato servito da una piattaforma documentale. */
export function eAllegatoPiattaforma(url?: string | null): boolean {
  return piattaformaAllegato(url) !== null;
}

/** Segmenti finali che sono una pagina di ACCESSO, non un avviso. */
const RE_SEGMENTO_LOGIN =
  /^(?:login|log-in|signin|sign-in|accedi|accesso|home|index\.php\d?|index\.html?)$/i;

/**
 * §26.101 — AVVISO su una piattaforma: un link PROFONDO (almeno tre segmenti di
 * percorso) su Argo / Nuvola–Spaggiari / Gecodoc / ClasseViva.
 *
 * Perché serve: la tabella di un documento dichiara l'avviso della SINGOLA
 * scuola proprio così —
 * `nuvola.madisoft.it/bacheca-digitale/bacheca/BGIC85100N/4/IN_PUBBLICAZIONE/…`
 * — e quel link non è una pagina di credenziali: è il documento che la scuola ha
 * pubblicato. Senza questa distinzione la regola «mai una piattaforma» buttava
 * via la riga, pur avendo codice, classe e scadenza certificati.
 *
 * Restano fuori, come sempre: la home (`/`), `/login`, `/argoweb/login`, un
 * sottosito di un segmento solo. Nessun URL costruito: si guarda quello letto.
 */
export function eAvvisoSuPiattaforma(url?: string | null): boolean {
  if (eFileDocumento(url)) return piattaformaScolastica(url) !== null;
  if (piattaformaScolastica(url) === null) return false;
  try {
    const segmenti = new URL(String(url)).pathname.split('/').filter(Boolean);
    if (segmenti.length < 3) return false;
    return !RE_SEGMENTO_LOGIN.test(segmenti[segmenti.length - 1]);
  } catch {
    return false;
  }
}

const RE_CONTENITORE = /<(?:iframe|embed|object)\b[^>]*\bsrc\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+))/gi;
const RE_ANCORA = /<a\b[^>]*\bhref\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+))/gi;

/**
 * Il documento DENTRO una pagina contenitore: prima il `<iframe>`/`<embed>` del
 * viewer, poi il primo link a un file. Massimo `max` risultati, senza duplicati.
 * Nessun URL costruito: si restituisce solo ciò che è scritto nell'HTML.
 */
export function urlDocumentoInHtml(html: string, baseUrl: string, max = 1): string[] {
  if (typeof html !== 'string' || html.trim() === '') return [];
  const trovati = new Map<string, string>();
  const base = (() => {
    try {
      return new URL(baseUrl).href;
    } catch {
      return null;
    }
  })();
  if (!base) return [];
  const raccogli = (re: RegExp): void => {
    for (const m of html.matchAll(re)) {
      if (trovati.size >= Math.max(1, max)) return;
      const url = urlAssoluta(m[1] ?? m[2] ?? m[3] ?? '', base);
      if (!url || !eFileDocumento(url) || trovati.has(url)) continue;
      trovati.set(url, url);
    }
  };
  raccogli(RE_CONTENITORE);
  if (trovati.size < Math.max(1, max)) raccogli(RE_ANCORA);
  return [...trovati.values()].slice(0, Math.max(0, max));
}
