/**
 * ScuoleRadar.it — TRACCIAMENTO della fonte granulare (Node-only).
 *
 * Quando la voce raccolta punta a una pagina-contenitore (indice, elenco,
 * archivio circolari, pagina "notizie"), questo modulo RISALE alla voce
 * specifica — sottopagina, circolare, avviso o documento (PDF) — che è la base
 * fattuale della notizia, confrontando il titolo con i link e i testi della
 * pagina. Se non trova nulla di affidabile NON inventa e NON blocca: restituisce
 * la pagina di partenza come traccia.
 *
 * La parte di MATCHING è pura (cheerio) e testabile offline; la parte di rete
 * riusa `fetchTesto` di newsFetcher.
 */

import * as cheerio from 'cheerio';
import { classificaLink, èLinkPdf } from './relevanceEngine.ts';
import { fetchTesto } from './newsFetcher.ts';

export interface LinkTracciato {
  url: string;
  /** Testo del link scelto (o del contenitore). */
  testo: string;
  /** Punteggio di pertinenza (0-100). */
  punteggio: number;
  pdf: boolean;
}

export interface EsitoTracciamento {
  /** URL della fonte scelto per l'articolo (specifico se trovato). */
  url: string;
  /** PDF ufficiale collegato alla voce, se individuato. */
  pdf: string | null;
  /** true quando è stata trovata la voce specifica. */
  tracciato: boolean;
  punteggio?: number;
  motivo?: string;
}

/** Parole non significative per il confronto dei titoli. */
const PAROLE_VUOTE = new Set([
  'a', 'ad', 'al', 'alla', 'alle', 'agli', 'allo', 'e', 'ed', 'di', 'del', 'della',
  'delle', 'dei', 'degli', 'il', 'lo', 'la', 'le', 'gli', 'i', 'in', 'per', 'con',
  'su', 'da', 'dal', 'dalla', 'dalle', 'dallo', 'dai', 'dagli', 'nel', 'nella',
  'nelle', 'negli', 'tra', 'fra', 'non', 'piu', 'come', 'sul', 'sulla', 'che',
  'sono', 'essere', 'anche', 'dopo', 'prima', 'loro', 'suo', 'sua', 'suoi', 'sue',
  'anno', 'anni', 'scuola', 'scuole', 'ministero', 'istruzione', 'merito',
]);

/** Link di servizio/navigazione da ignorare. */
const RUMORE =
  /(privacy|cookie|facebook|twitter|instagram|linkedin|youtube|tiktok|whatsapp|t\.me|mailto:|tel:|javascript:|wp-login|wp-admin|\/feed\/?$|\/page\/\d|\/pagina\/\d|accessibilit|\/contatti?\/?$|\/chi-siamo|\/login|\/accedi|\/area-riservata)/i;

/** Normalizza e tokenizza un testo (minuscolo, senza accenti, senza stopword). */
export function tokenizza(testo?: string | null): string[] {
  return (testo ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length >= 2 && !PAROLE_VUOTE.has(t));
}

function èNumero(token: string): boolean {
  return /^\d+$/.test(token);
}

/**
 * Valutazione di un candidato: pertinenza (0-100) + NUMERI del titolo non
 * trovati nel candidato. I numeri (n. 1095, 10, 2026) sono l'identificativo più
 * forte di un atto: se il titolo cita un numero che l'entry NON contiene, quel
 * candidato non è la voce giusta.
 */
export function valutaCandidato(
  titolo: string,
  testoLink: string,
  contesto = '',
  url = '',
): { punteggio: number; numeriMancanti: number } {
  const tTok = new Set(tokenizza(titolo));
  if (tTok.size === 0) return { punteggio: 0, numeriMancanti: 0 };
  const lTok = new Set(tokenizza(testoLink));
  const cTok = new Set(tokenizza(contesto));
  const slug = (url ?? '').toLowerCase();

  const presente = (t: string): boolean => lTok.has(t) || cTok.has(t) || slug.includes(t);

  let condivisiLink = 0;
  let condivisiContesto = 0;
  let numeriTrovati = 0;
  let numeriMancanti = 0;
  let slugHit = 0;
  for (const t of tTok) {
    if (lTok.has(t)) condivisiLink += 1;
    if (cTok.has(t)) condivisiContesto += 1;
    if (èNumero(t)) {
      if (presente(t)) numeriTrovati += 1;
      else numeriMancanti += 1;
    }
    if (t.length >= 5 && slug.includes(t)) slugHit += 1;
  }

  const punti =
    condivisiLink * 20 +
    condivisiContesto * 5 +
    numeriTrovati * 15 +
    slugHit * 6 -
    numeriMancanti * 20;
  const punteggio = Math.max(0, Math.min(100, Math.round((punti / (tTok.size * 20)) * 100)));
  return { punteggio, numeriMancanti };
}

/**
 * Pertinenza (0-100) tra il titolo della notizia e un candidato (testo del link
 * + contesto della riga): pesa le parole condivise, i NUMERI (n. 1095/163,
 * anni) e la corrispondenza nello slug dell'URL.
 */
export function punteggioPertinenza(
  titolo: string,
  testoLink: string,
  contesto = '',
  url = '',
): number {
  return valutaCandidato(titolo, testoLink, contesto, url).punteggio;
}


/**
 * Sceglie il link SPECIFICO della pagina più pertinente al titolo dato.
 * Ritorna `null` quando nessun candidato supera la soglia di affidabilità.
 */
export function scegliLinkSpecifico(
  html: string,
  baseUrl: string,
  titolo: string,
  opts: { soglia?: number } = {},
): LinkTracciato | null {
  const soglia = opts.soglia ?? 22;
  const $ = cheerio.load(html ?? '');
  const base = baseUrl.split('#')[0];
  const candidati: LinkTracciato[] = [];
  const visti = new Set<string>();

  $('a[href]').each((_, el) => {
    const $a = $(el);
    const href = ($a.attr('href') ?? '').trim();
    if (!href || href.startsWith('#') || /^(mailto|tel|javascript):/i.test(href)) return;
    let url: string;
    try {
      url = new URL(href, baseUrl).href;
    } catch {
      return;
    }
    if (!/^https?:/i.test(url) || RUMORE.test(url)) return;
    if (url.split('#')[0] === base) return;
    if (visti.has(url)) return;
    visti.add(url);

    // Contesto: riga/card che contiene il link (scuola, classi, date…).
    const contenitore = $a.closest('li, tr, article, .card, .entry, .avviso, p').first();
    const contesto = (contenitore.length > 0 ? contenitore.text() : '')
      .replace(/\s+/g, ' ')
      .trim();
    const testoLink = $a.text().replace(/\s+/g, ' ').trim();

    let forza = valutaCandidato(titolo, testoLink, contesto, url);
    let punteggio = forza.punteggio;
    if (èLinkPdf(url)) punteggio += 10;
    if (classificaLink(url).classe === 'contenitore') punteggio -= 30;
    punteggio = Math.max(0, Math.min(100, Math.round(punteggio)));
    // Se il titolo cita numeri che il candidato non contiene, non è quella voce
    // (evita di agganciare un avviso diverso solo perché condivide l'anno).
    if (forza.numeriMancanti > 0) punteggio = 0;

    candidati.push({ url, testo: testoLink || contesto, punteggio, pdf: èLinkPdf(url) });
  });

  const ordinati = candidati
    .filter((c) => c.punteggio >= soglia)
    .sort((x, y) => {
      if (y.punteggio !== x.punteggio) return y.punteggio - x.punteggio;
      const classeX = classificaLink(x.url).classe === 'diretto' ? 1 : 0;
      const classeY = classificaLink(y.url).classe === 'diretto' ? 1 : 0;
      if (classeY !== classeX) return classeY - classeX;
      return Number(y.pdf) - Number(x.pdf);
    });

  return ordinati[0] ?? null;
}

/**
 * Risolve la fonte granulare di una voce:
 *   1. se il link della voce è già specifico → niente da tracciare;
 *   2. link specifici presenti nella descrizione della fonte (RSS) → gratis;
 *   3. altrimenti scarica la pagina e cerca la voce specifica.
 * Non lancia mai e non blocca: senza match restituisce la pagina di partenza
 * (`tracciato: false`), così la notizia esce comunque con la sua traccia.
 */
export async function risolviFonteGranulare(voce: {
  title: string;
  link: string;
  description?: string | null;
}): Promise<EsitoTracciamento> {
  const link = (voce.link ?? '').trim();
  const classe = classificaLink(link).classe;
  if (classe === 'diretto') {
    return {
      url: link,
      pdf: èLinkPdf(link) ? link : null,
      tracciato: false,
      motivo: 'fonte già specifica',
    };
  }
  if (classe === 'non-valido') {
    return { url: link, pdf: null, tracciato: false, motivo: 'link non valido' };
  }

  // 2) Link specifici già presenti nella descrizione della fonte (nessuna rete).
  const descrizione = voce.description ?? '';
  const dallaDescrizione = descrizione.includes('href=')
    ? scegliLinkSpecifico(descrizione, link, voce.title)
    : null;
  if (dallaDescrizione) {
    return {
      url: dallaDescrizione.url,
      pdf: dallaDescrizione.pdf ? dallaDescrizione.url : null,
      tracciato: true,
      punteggio: dallaDescrizione.punteggio,
    };
  }

  // 3) Tracciamento sulla pagina-contenitore.
  const html = await fetchTesto(link).catch(() => null);
  if (!html) {
    return { url: link, pdf: null, tracciato: false, motivo: 'pagina non raggiungibile' };
  }
  const trovato = scegliLinkSpecifico(html, link, voce.title);
  if (!trovato) {
    return {
      url: link,
      pdf: null,
      tracciato: false,
      motivo: 'nessuna voce specifica riconosciuta',
    };
  }
  return {
    url: trovato.url,
    pdf: trovato.pdf ? trovato.url : null,
    tracciato: true,
    punteggio: trovato.punteggio,
  };
}
