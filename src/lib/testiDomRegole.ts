/**
 * ScuoleRadar.it — «EDITOR TESTI RAPIDO» (DEV Toolbar): REGOLE e NOMI della scansione.
 *
 * Primo pezzo della scansione universale (`src/lib/testiDomNodi.ts` legge il DOM,
 * `src/lib/testiDom.ts` tiene l'elenco dell'editor). Qui si stabilisce COSA è un testo
 * modificabile e COME si chiama/identifica, senza toccare il DOM:
 *
 *   · `normalizzaTesto` → confronti a prova di spazi inutili;
 *   · `impronta` / `chiaveTestoDom` → identità STABILE di un'occorrenza di testo;
 *   · `TAG_IGNORATI` → contenitori tecnici (script, style, svg, codice…) fuori dall'editor;
 *   · `campoDi` / `contenitoreDi` → nomi leggibili («sezione · Paragrafo») per il pannello.
 *
 * Modulo PURO e isomorfo: nessun React, nessun DOM, nessuna dipendenza.
 */

/** Contenitori tecnici: dentro non c'è copy da mostrare all'editor. */
export const TAG_IGNORATI = new Set([
  'SCRIPT', 'STYLE', 'NOSCRIPT', 'TEXTAREA', 'TITLE', 'OPTION',
  'SVG', 'CANVAS', 'IFRAME', 'CODE', 'PRE',
]);

/** Contenitori della pagina, in parole (per l'etichetta «contenitore · campo»). */
const CONTENITORI: Record<string, string> = {
  MAIN: 'pagina', SECTION: 'sezione', ARTICLE: 'scheda', NAV: 'navigazione', HEADER: 'testata',
  FOOTER: 'piede', ASIDE: 'pannello', FORM: 'modulo', DIALOG: 'finestra', TABLE: 'tabella',
  UL: 'elenco', OL: 'elenco', LI: 'elenco',
};

/** Mappatura estesa dei selettori e dei tag per includere card, articoli e sezioni di Chi Siamo / Notizie. */
export const SELETTORI_TARGET = [
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'span', 'strong', 'em', 'b', 'small',
  'li', 'td', 'th', 'caption', 'dd', 'dt', 'button', 'a', 'label', 'blockquote',
  'figcaption', 'summary', 'legend', 'div',
  // Selettori strutturali specifici per card e sezioni testuali complesse
  'article p', 'article h2', 'article h3', 'section p', 'section h2',
  '.notizia-card-content', '.chi-siamo-text'
];

/** Nome leggibile del campo, dedotto dal tag che contiene il testo. */
const CAMPI: Record<string, string> = {
  H1: 'Titolo', H2: 'Titolo', H3: 'Titolo', H4: 'Titolo', H5: 'Titolo', H6: 'Titolo',
  P: 'Paragrafo', SPAN: 'Frase', STRONG: 'Frase', EM: 'Frase', B: 'Frase', SMALL: 'Nota',
  LI: 'Voce', TD: 'Cella', TH: 'Intestazione', CAPTION: 'Didascalia', DD: 'Definizione',
  DT: 'Voce', BUTTON: 'Pulsante', A: 'Collegamento', LABEL: 'Etichetta campo',
  BLOCKQUOTE: 'Citazione', FIGCAPTION: 'Didascalia', SUMMARY: 'Riga richiudibile',
  LEGEND: 'Titolo gruppo', DIV: 'Testo',
};

/** Nome del campo per un tag (`H2` → «Titolo»), altrimenti «Testo». */
export function campoDi(tag: string): string {
  return CAMPI[tag] ?? 'Testo';
}

/** Nome del contenitore per un tag (`UL` → «elenco»), altrimenti null. */
export function contenitoreDi(tag: string): string | null {
  return CONTENITORI[tag] ?? null;
}

/** Testo «logico»: spazi collassati e bordi tolti (per confronti e impronte). */
export function normalizzaTesto(testo: string): string {
  return testo.replace(/\s+/g, ' ').trim();
}

/** Impronta compatta e stabile di un testo (djb2 in base 36): niente chiavi kilometriche. */
export function impronta(testo: string): string {
  let hash = 5381;
  for (let i = 0; i < testo.length; i += 1) hash = (hash * 33) ^ testo.charCodeAt(i);
  return (hash >>> 0).toString(36);
}

/**
 * Identità di un'occorrenza di testo: `p#1a2b3c#0` = tag + impronta del testo di default + n°
 * di occorrenza. È STABILE fra una scansione e l'altra (e fra i reload): non dipende dalla
 * posizione nel DOM, quindi l'override resta agganciato al suo testo anche se la pagina cambia.
 */
export function chiaveTestoDom(tag: string, testo: string, occorrenza: number): string {
  return `${tag.toLowerCase()}#${impronta(normalizzaTesto(testo))}#${occorrenza}`;
}