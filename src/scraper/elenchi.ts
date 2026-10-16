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
 * Tabelle-dati (§26.72, 16/10/2026): in una tabella la SCADENZA non è scritta
 * accanto alla data, ma nell'INTESTAZIONE della colonna («Scadenza», «Data
 * chiusura avviso» — fonte Umbria, portali provinciali come Liguria). La voce
 * porta quindi anche le etichette di colonna in `suggerimenti`, ricomposte come
 * «Scadenza: 16/10/2026»: senza di esse la data della riga resta anonima e
 * l'avviso viene scartato come "senza scadenza".
 *
 * Griglie ARIA (§26.72, 16/10/2026): gli stessi elenchi tabellari sono pubblicati
 * anche SENZA tag `<table>` — `div[role="row"]` con celle `role="cell"` e
 * intestazioni `role="columnheader"` (USR Liguria, `provincia.php`). Righe e
 * celle ARIA sono trattate come righe e celle di tabella; i testi delle celle
 * vengono uniti con uno spazio dove due nodi HTML erano incollati
 * («A051»+«Spezzone» → «A051 Spezzone»). Menu, header e footer sono esclusi a
 * monte: non sono voci d'elenco.
 *
 * Le funzioni che leggono la SINGOLA riga-dati (`datiRiga`, `eRigaIntestazione`)
 * vivono nel modulo gemello `righeTabella.ts`, estratte per rispettare il limite
 * di 300 righe per file: qui restano il riconoscimento della pagina indice, il
 * ciclo sulle righe e la composizione delle voci.
 *
 * Nessuna dipendenza dalla rete: ricevuto l'HTML, restituisce gli avvisi.
 */

import * as cheerio from 'cheerio';
import { parseInterpello, type InterpelloParsato } from './parser.ts';
import { eUrlElenco, sembraTitoloElenco } from './paginaElenco.ts';
import { datiRiga, eRigaIntestazione, titoloVoce } from './righeTabella.ts';

/** Una voce (riga) di un elenco: un avviso individuale. */
export interface VoceElenco {
  /** Titolo della voce (testo del link o della riga). */
  titolo: string;
  /** URL ASSOLUTO della voce (mai la pagina indice). */
  url: string;
  /** Testo completo della riga: scuola, classi, scadenze… (contesto parser). */
  contesto: string;
  /**
   * Etichette di colonna della riga con il loro valore («Scadenza: 16/10/2026»),
   * solo per le tabelle-dati. In una tabella la parola chiave della scadenza sta
   * nell'intestazione: qui viene ricomposta accanto al valore.
   */
  suggerimenti?: string;
}

/** Link di navigazione/rumore: mai una voce d'elenco. */
const RE_URL_RUMORE =
  /(privacy|cookie|facebook|twitter|instagram|linkedin|youtube|tiktok|whatsapp|telegram|t\.me|mailto:|tel:|javascript:|wp-login|wp-admin|\/feed\/?$|\/page\/\d|\/pagina\/\d|paginazione|pagina-successiva|accessibilit|\/contatti?\/?$|\/chi-siamo)/i;

/** Contenitori tipici di una voce d'elenco (il più interno vince). */
const SELETTORI_RIGA = [
  'li',
  'tr',
  // Griglie ARIA: i portali provinciali (Liguria, `provincia.php`) pubblicano
  // l'elenco come `div[role="row"]` con celle `role="cell"` e intestazioni
  // `role="columnheader"` — è una tabella-dati SENZA tag `<table>`.
  '[role="row"]',
  'article',
  'div.card',
  'div.entry',
  'div.avviso',
  'div.item',
  'div.post',
  'div.riga',
  'div.list-item',
];

/** Riconoscimento della pagina-elenco (percorso/titolo): vedi `paginaElenco.ts`. */
export { eUrlElenco, sembraTitoloElenco };

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
      // Voci di MENU/NAVIGAZIONE (header, footer, briciole): non sono avvisi —
      // sono la causa tipica delle righe «vuote» raccolte dalle pagine degli enti.
      if ($riga.closest('nav, header, footer, [role="navigation"]').length > 0) return;
      // Contenitore (contiene altre righe): la voce vera è la riga interna.
      if ($riga.find(selettoriRiga).length > 0) return;
      // Riga di INTESTAZIONE (solo etichette di colonna): non è una voce.
      if (eRigaIntestazione($, el)) return;

      const links = linksUtili(el);
      const scelto = scegliLinkRiga(links);
      if (!scelto) return;
      if (urlVisti.has(scelto.href)) return;

      const dati = datiRiga($, el);
      const contesto = dati?.contesto ?? normalizza($riga.text(), 600);
      // Tabelle-dati: la parola chiave della scadenza sta nell'INTESTAZIONE della
      // colonna, non accanto alla data → si ricompone qui l'etichetta.
      const suggerimenti = dati?.suggerimenti ?? '';
      const titolo = titoloVoce(contesto, scelto.testo);
      if (titolo.length < 12) return;

      urlVisti.add(scelto.href);
      voci.push({ titolo, url: scelto.href, contesto, suggerimenti });
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
      // Le etichette di colonna («Scadenza: 16/10/2026») vanno PRIMA del testo
      // della riga: è la parola chiave che qualifica la data come scadenza.
      corpo: voce.suggerimenti ? `${voce.suggerimenti} · ${voce.contesto}` : voce.contesto,
      dataPubblicazione: ctx.dataPubblicazione ?? null,
    });
    if (hashVisti.has(avviso.hashId)) continue;
    hashVisti.add(avviso.hashId);
    out.push(avviso);
  }
  return out;
}

