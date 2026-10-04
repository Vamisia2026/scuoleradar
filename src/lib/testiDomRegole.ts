/**
 * ScuoleRadar.it — TESTI DEL DOM: REGOLE e NOMI (modulo condiviso).
 *
 * Era il primo pezzo della scansione dell'«Editor Testi Rapido» (rimosso il 03/10/2026,
 * §26.38); oggi serve al VISUAL EDITOR click-to-edit (§26.37), con le stesse identità dei
 * testi — senza toccare il DOM:
 *
 *   · `normalizzaTesto` → confronti a prova di spazi inutili;
 *   · `impronta` / `chiaveTestoDom` → identità STABILE di un'occorrenza di testo;
 *   · `campoDi` / `contenitoreDi` → nomi leggibili («sezione · Paragrafo»).
 *
 * Modulo PURO e isomorfo: nessun React, nessun DOM, nessuna dipendenza.
 */

/** Contenitori della pagina, in parole (per l'etichetta «contenitore · campo»). */
const CONTENITORI: Record<string, string> = {
  MAIN: 'pagina', SECTION: 'sezione', ARTICLE: 'scheda', NAV: 'navigazione', HEADER: 'testata',
  FOOTER: 'piede', ASIDE: 'pannello', FORM: 'modulo', DIALOG: 'finestra', TABLE: 'tabella',
  UL: 'elenco', OL: 'elenco', LI: 'elenco',
};

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