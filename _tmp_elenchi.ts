/**
 * ScuoleRadar.it — ESPANSIONE DEGLI ELENCHI (pagine indice) — Node-only, puro.
 *
 * Problema risolto: molti enti (es. gli elenchi degli Uffici Scolastici
 * Regionali, USR Lombardia, USP, Albo delle scuole) pubblicano una pagina
 * INDICE con TANTI avvisi, uno per riga. La vecchia pipeline la trattava come
 * un singolo avviso e finiva per notificare il link alla "lista master",
 * accumulando più avvisi distinti sullo stesso URL condiviso.
 *
 * Qui invece ogni VOCE dell'elenco diventa un avviso a sé, con:
 *   · il PROPRIO URL (il documento/pagina dell'avviso, mai la pagina indice);
 *   · la riga intera come contesto (scuola, classi, date) per il parser;
 *   · titolo descrittivo della voce (mai "Elenco avvisi" come titolo unico).
 *
 * Nessuna dipendenza dalla rete: ricevuto l'HTML, restituisce gli avvisi.
 */

import * as cheerio from 'cheerio';
import { parseInterpello, type InterpelloParsato } from './parser.ts';

/** Una voce (riga) di un elenco: un avviso individuale. */
export interface VoceElenco {
  /** Titolo della voce (testo del link o della riga). */
  titolo: string;
  /** URL ASSOLUTO della voce (mai la pagina indice). */
  url: string;
  /** Testo completo della riga: scuola, classi, scadenze… (contesto parser). */
  contesto: string;
}

/** Percorsi tipici di una pagina INDICE/ELENCO. */
const RE_PATH_ELENCO =
  /(elenco|elenchi|indice|lista|liste|avvisi|interpelli|bandi|graduator|albo|pubblicazion|circolari|comunicazioni|scadenze|notizie)/i;

/** Titoli tipici di una pagina INDICE. */
const RE_TITOLO_ELENCO = /(elenco|elenchi|indice|lista|tutti gli|avvisi pubblicati|graduatorie|scadenze)/i;

/** Link di navigazione/rumore: mai una voce d'elenco. */
const RE_URL_RUMORE =
  /(privacy|cookie|facebook|twitter|instagram|linkedin|youtube|tiktok|whatsapp|telegram|t\.me|mailto:|tel:|javascript:|wp-login|wp-admin|\/feed\/?$|\/page\/\d|\/pagina\/\d|paginazione|pagina-successiva|accessibilit|\/contatti?\/?$|\/chi-siamo)/i;

/** Etichette di link non descrittive (il titolo va preso dalla riga). */
const RE_TESTO_LINK_GENERICO = /^(scarica|leggi|apri|visualizza|dettagli|dettaglio|vai|pdf|documento|link|qui|elenco)\b/i;

/** Contenitori tipici di una voce d'elenco (il più interno vince). */
const SELETTORI_RIGA = [
  'li',
  'tr',
  'article',
  'div.card',
  'div.entry',
  'div.avviso',
  'div.item',
  'div.post',
  'div.riga',
  'div.list-item',
];

/** True se l'URL "sembra" una pagina indice/elenco (euristica sul percorso). */
export function eUrlElenco(url?: string | null): boolean {
  const u = (url ?? '').trim();
  if (!/^https?:\/\//i.test(u)) return false;
  try {
    const p = new URL(u);
    return RE_PATH_ELENCO.test(`${p.pathname}${p.search}`);
  } catch {
    return false;
  }
}

/** True se il titolo dichiara un elenco ("Elenco interpelli…", "Indice avvisi"). */
export function sembraTitoloElenco(titolo?: string | null): boolean {
  return RE_TITOLO_ELENCO.test((titolo ?? '').toLowerCase());
}

function normalizza(testo: string, max: number): string {
  return testo.replace(/\s+/g, ' ').trim().slice(0, max);
}

/** Scrive la voce migliore per una riga (documento/avviso/pagina specifica). */
function scegliLinkRiga(links: { href: string; testo: string }[]): { href: string; testo: string } | null {
  if (links.length === 0) return null;
  const documento = links.find((l) => /\.(?:pdf|docx?|odt)(?:$|[?#])/i.test(l.href));
  if (documento) return documento;
  const specifico = links.find((l) =>
    /(avviso|interpell|bando|graduator|circolare|protocollo|documento|allegato|selezione|supplenz|decreto|determina)/i.test(
      l.href,
    ),
  );
  return specifico ?? links[0];
}

/**
 * Estrae TUTTE le voci di un elenco: una voce per avviso, ciascuna con il
 * proprio URL. Le righe contenitore (che racchiudono altre righe) vengono
 * saltate: si tengono le voci più specifiche, senza duplicati.
 */
export function estraiVociElenco(
  html: string,
  baseUrl: string,
  opts: { max?: number } = {},
): VoceElenco[] {
  const max = opts.max ?? 60;
  const $ = cheerio.load(html);
  const voci: VoceElenco[] = [];
  const urlVisti = new Set<string>();
  const selettoriRiga = SELETTORI_RIGA.join(', ');
  const base = baseUrl.split('#')[0];

  /** Link utili della riga: http(s) assoluti, senza rumore né auto-link. */
  const linksUtili = (riga: Parameters<cheerio.CheerioAPI>[0]): { href: string; testo: string }[] => {
    const out: { href: string; testo: string }[] = [];
    const vistiLink = new Set<string>();
    $(riga)
      .find('a[href]')
      .each((_, a) => {
        const href = ($(a).attr('href') ?? '').trim();
        if (!href || href.startsWith('#')) return;
        if (/^(mailto|tel|javascript):/i.test(href)) return;
        let assoluto: string;
        try {
          assoluto = new URL(href, baseUrl).href;
        } catch {
          return;
        }
        if (!/^https?:\/\//i.test(assoluto)) return;
        if (RE_URL_RUMORE.test(assoluto)) return;
        // La voce deve puntare a qualcosa di DIVERSO dalla pagina indice stessa.
        if (assoluto.split('#')[0] === base) return;
        if (vistiLink.has(assoluto)) return;
        vistiLink.add(assoluto);
        out.push({
          href: assoluto,
          testo: normalizza($(a).text(), 220).replace(
            /\s*\[\d+(?:[.,]\d+)?\s*(?:KB|MB)\]\s*$/i,
            '',
          ),
        });
      });
    return out;
  };

  for (const selettore of SELETTORI_RIGA) {
    $(selettore).each((_, el) => {
      const $riga = $(el);
      // Contenitore (contiene altre righe): la voce vera è la riga interna.
      if ($riga.find(selettoriRiga).length > 0) return;

      const links = linksUtili(el);
      const scelto = scegliLinkRiga(links);
      if (!scelto) return;
      if (urlVisti.has(scelto.href)) return;

      const contesto = normalizza($riga.text(), 600);
      // Titolo: testo del link se descrittivo, altrimenti la riga stessa
      // (ripulita dal testo del link e dalle etichette generiche).
      let titolo =
        scelto.testo.length >= 12 && !RE_TESTO_LINK_GENERICO.test(scelto.testo) ? scelto.testo : '';
      if (!titolo) {
        const residuo = contesto
          .replace(scelto.testo, '')
          .replace(/^[\s\-–—:|·]+|[\s\-–—:|·]+$/g, '');
        titolo = residuo.length >= 12 ? residuo : '';
      }
      if (!titolo) titolo = contesto;
      titolo = normalizza(titolo, 220);
      if (titolo.length < 12) return;

      urlVisti.add(scelto.href);
      voci.push({ titolo, url: scelto.href, contesto });
    });
    if (voci.length >= max) break;
  }

  return voci.slice(0, max);
}

/**
 * True se l'HTML è una pagina INDICE/ELENCO: almeno 3 voci distinte, oppure 2
 * voci quando il percorso/titolo dichiara esplicitamente un elenco.
 */
export function ePaginaElenco(html: string, baseUrl: string, url?: string | null): boolean {
  const voci = estraiVociElenco(html, baseUrl, { max: 40 });
  if (voci.length < 2) return false;
  const $ = cheerio.load(html);
  const titoloPagina = normalizza($('h1, title, .entry-title, .page-title').first().text(), 200);
  const esplicito = eUrlElenco(url ?? baseUrl) || sembraTitoloElenco(titoloPagina);
  return esplicito ? voci.length >= 2 : voci.length >= 5;
}

/**
 * Trasforma un elenco in avvisi STRUTTURATI (uno per voce). Ogni avviso ha il
 * proprio link ufficiale: la pagina indice non viene MAI pubblicata come se
 * fosse un avviso singolo.
 */
export function espandiElencoInAvvisi(
  html: string,
  ctx: {
    baseUrl: string;
    provincia: string;
    source?: string;
    dataPubblicazione?: string | null;
  },
  opts: { max?: number } = {},
): InterpelloParsato[] {
  const base = ctx.baseUrl.split('#')[0];
  const out: InterpelloParsato[] = [];
  const hashVisti = new Set<string>();
  for (const voce of estraiVociElenco(html, ctx.baseUrl, opts)) {
    if (voce.url.split('#')[0] === base) continue;
    const avviso = parseInterpello({
      title: voce.titolo.slice(0, 300),
      link: voce.url,
      linkCandidati: [voce.url],
      provincia: ctx.provincia,
      source: ctx.source ?? ctx.baseUrl,
      corpo: voce.contesto,
      dataPubblicazione: ctx.dataPubblicazione ?? null,
    });
    if (hashVisti.has(avviso.hashId)) continue;
    hashVisti.add(avviso.hashId);
    out.push(avviso);
  }
  return out;
}

