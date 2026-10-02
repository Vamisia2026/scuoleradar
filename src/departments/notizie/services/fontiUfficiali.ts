/**
 * ScuoleRadar.it — Dipartimento Notizie · Perimetro fonti e igiene dei link.
 *
 * AMMISSIBILITÀ di un indirizzo: fonti NAZIONALI accreditate (MIM, Gazzetta
 * Ufficiale, ARAN, giurisdizione, previdenza), canonicità degli URL di
 * articolo e igiene di base (mockup, login, PDF). Le pagine regionali (USR)
 * sono fuori perimetro. Modulo puro: nessuna rete, nessun accesso al motore.
 */

/* ============ PERIMETRO NAZIONALE (ScuoleRadar è una piattaforma nazionale) ============ */

/**
 * Siti ACCREDITATI a livello NAZIONALE. ScuoleRadar copre il livello nazionale:
 * MIM (Ministero dell'Istruzione e del Merito), Gazzetta Ufficiale, ARAN
 * (contrattazione), giurisdizione contabile/amministrativa e previdenza.
 * Le pagine REGIONALI (`/web/usr-*`, USR/AT) sono ESCLUSE per policy.
 */
const HOST_NAZIONALI = [
  'mim.gov.it',
  'istruzione.it',
  'gazzettaufficiale.it',
  'aranagenzia.it',
  'corteconti.it',
  'giustizia-amministrativa.it',
  'inps.it',
  'inpa.gov.it',
];

/** True se l'URL appartiene a una fonte NAZIONALE accreditata (e non regionale). */
export function èFonteNazionale(url: string): boolean {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();
    const percorso = parsed.pathname.toLowerCase();
    // Le pagine regionali del MIM (USR) non sono nazionali.
    if (/\/web\/usr-/.test(percorso)) return false;
    return HOST_NAZIONALI.some((h) => host === h || host.endsWith(`.${h}`));
  } catch {
    return false;
  }
}

/** True se l'URL è pubblicato dal MIM (o dal dominio storico istruzione.it). */
export function èFonteMim(url?: string | null): boolean {
  try {
    const host = new URL(url ?? '').hostname.toLowerCase();
    return host.endsWith('mim.gov.it') || host.endsWith('istruzione.it');
  } catch {
    return false;
  }
}

/**
 * Portali istituzionali il cui dominio RADICE È la destinazione operativa del
 * servizio (l'utente accede da lì): esenti dal divieto di "root-domain".
 * Per TUTTI gli altri domini vale il divieto assoluto di homepage generiche
 * (vedi docs/BLOG_EDITORIAL_GUIDELINES.md, sez. 5).
 */
const PORTALI_SERVIZIO = new Set<string>([
  'https://www.inpa.gov.it', // Portale del Reclutamento (InPA)
  'https://www.inps.it', // Portale INPS
]);

/** Segnali di URL segnaposto/mockup: vietati nei link pubblicati. */
export const SEGNALI_MOCKUP = [
  'example.com', 'example.org', 'localhost', 'mockup', 'placeholder',
  'yourdomain', 'lorem-ipsum', '.test', ':3000', ':5173',
];

/**
 * Segnali di pagine generiche di ACCESSO (login / area riservata): non sono
 * contenuti informativi e vengono scartate (anti-rumore, es. `/aran/login`).
 */
export const SEGNALI_LOGIN = [
  '/login', '/log-in', '/signin', '/sign-in', '/accedi',
  '/area-riservata', '/areariservata', '/area_riservata', '/accesso-riservato',
];

/** True se l'URL punta a un file PDF (es. fonte ufficiale in PDF). */
export function èLinkPdf(url: string): boolean {
  try {
    return new URL(url).pathname.toLowerCase().endsWith('.pdf');
  } catch {
    return false;
  }
}

/**
 * Percorsi generici che NON sono un articolo/atto specifico: usati come
 * radice di fallback (homepage, liste notizie, indici). Vietati come
 * `official_source_url` ("Leggi la fonte ufficiale" deve puntare all'articolo).
 */
const PERCORSI_GENERICI = new Set([
  '', '/', '/home', '/home.html', '/index', '/index.html',
  '/notizie', '/news', '/news.html', '/comunicati', '/atti',
  '/atti-pubblici', '/web/guest', '/web/guest/home', '/web/guest/notizie',
  '/web/guest/ricerca',
]);

/**
 * Slug delle PAGINE OPERATIVE delle USR/MIM pubblicate a `/web/<sito>/<slug>`
 * (senza il segmento Liferay `/-/`): sono la destinazione corrente e stabile
 * di provvedimenti per il personale scolastico (elenchi interpelli, mobilità,
 * concorsi, graduatorie, calendario regionale…). A differenza delle homepage e
 * delle pagine di elenco generiche, hanno un contenuto operativo specifico e
 * vengono accettate come fonte canonica (il gate di rilevanza le filtra comunque).
 */
const RE_SLUG_OPERATIVO =
  /interpell|supplenz|graduator|concors|reclutament|assunz|mobilita|assegnazion|nomine?|reggenz|avvis|selezion|contratt|personale|organico|trasferiment|pension|sostegno|calendario-scolastic|prese-di-servizio|ricerca-supplenti/;

/**
 * True se l'URL è una FONTE CANONICA (il singolo articolo/atto) e non una
 * pagina generica del sito (es. `https://www.mim.gov.it/web/guest/home`).
 * Per il dominio MIM (incluse le pagine USR regionali) sono accettati:
 *   1. gli articoli canonici Liferay `/web/<sito>/-/<slug>` — es.
 *      `/web/guest/-/…` oppure `/web/usr-lombardia/-/…`;
 *   2. le PAGINE OPERATIVE delle USR `/web/<sito>/<slug>` (es.
 *      `/web/usr-lombardia/interpelli-ricerca-supplenti`), che dal 2026 sono la
 *      destinazione stabile di interpelli/concorsi/graduatorie: senza questo
 *      caso la pipeline non trova più alcuna fonte nuova (stallo).
 * Homepage, indici e pagine di elenco generiche restano sempre escluse.
 */
export function èFonteCanonica(url: string): boolean {
  try {
    const parsed = new URL(url);
    let percorso = parsed.pathname.toLowerCase();
    if (percorso.length > 1 && percorso.endsWith('/')) percorso = percorso.slice(0, -1);
    if (PERCORSI_GENERICI.has(percorso)) return false;
    // MIM + siti regionali (USR)
    if (parsed.hostname.endsWith('mim.gov.it')) {
      // 1. Articolo canonico Liferay.
      if (/\/web\/[^/]+\/-\/.+/.test(percorso)) return true;
      // 2. Pagina operativa USR/MIM: `/web/<sito>/<slug-operativo>`.
      const m = percorso.match(/^\/web\/[^/]+\/([^/]+)$/);
      return Boolean(m && RE_SLUG_OPERATIVO.test(m[1]));
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Controllo PURO (senza rete) di integrità di un link ufficiale:
 *  - solo http(s);
 *  - mai root-domain generici (es. https://www.mim.gov.it/) a meno che il
 *    dominio non sia un portale di servizio esplicitamente autorizzato;
 *  - mai segnaposto/mockup;
 *  - mai pagine generiche di login/area riservata.
 * Ritorna null se valido, altrimenti una stringa col motivo del rifiuto.
 */
export function validaUrlDeepLink(url: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return 'URL non valido';
  }
  if (!/^https?:$/.test(parsed.protocol)) return 'Solo URL HTTP(S)';
  const indizi = `${parsed.hostname}${parsed.pathname}${parsed.search}`.toLowerCase();
  if (SEGNALI_MOCKUP.some((m) => indizi.includes(m))) {
    return 'URL segnaposto/mockup non consentito';
  }
  // Anti-rumore: le pagine di login/area riservata non sono contenuti informativi.
  const percorso = parsed.pathname.toLowerCase();
  if (SEGNALI_LOGIN.some((s) => percorso.includes(s))) {
    return 'Pagina di login/area riservata non consentita';
  }
  const radiceNuda = parsed.pathname === '' || parsed.pathname === '/';
  if (radiceNuda && !PORTALI_SERVIZIO.has(parsed.origin)) {
    return `Root-domain generico non consentito (${parsed.origin}/)`;
  }
  return null;
}
