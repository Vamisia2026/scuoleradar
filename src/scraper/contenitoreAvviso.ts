/**
 * ScuoleRadar.it — IL CONTENITORE DELL'ATTO dentro una pagina HTML (§26.130).
 *
 * Perché esiste. Leggendo un avviso si vuole il TESTO DELL'ATTO, non il menu del
 * sito: `$('article, main, .entry-content, .avviso, #content, .contenuto')` sembra
 * una lista di priorità, ma per cheerio è un'unica espressione e `.first()`
 * restituisce il primo elemento nell'ORDINE DEL DOCUMENTO. Su un sito scolastico
 * WordPress quell'elemento è il `<main>` che *avvolge* anche la colonna «ultime
 * circolari», e la data di un'altra circolare diventa la scadenza di questa.
 *
 * Misurato il 2026-11-01 su `vergaviagrande.edu.it` (CT), circolare «Sciopero 30
 * ottobre 2026 – promemoria»:
 *   • pagina intera / `<main>` → `scadenzaDaTesto` = **2026-12-07**, che è il
 *     titolo di un'altra circolare nella colonna laterale («chiusura uffici 02
 *     novembre e 07 dicembre 2026»): una scadenza INVENTATA, quindi un'opportunità
 *     inventata in bacheca;
 *   • `<article>` → `null`: la circolare non dichiara alcun termine, ed è la
 *     risposta giusta.
 *
 * Regola: si prova la lista in ORDINE DI PRIORITÀ (dal contenitore più specifico
 * al più generico) e si accetta il primo che contiene abbastanza testo da essere
 * un atto. Menu, piede e colonne laterali si tolgono prima di leggere. Nessun
 * contenitore adeguato → si legge la pagina intera, come prima.
 *
 * PURO: nessuna rete, nessun orologio. Guardia: `npm run test:contenitore-avviso`
 * (incluso in `npm test`).
 */
import * as cheerio from 'cheerio';

/**
 * Contenitori in ORDINE DI PRIORITÀ: il primo che ha testo sufficiente vince.
 * `article` prima di `main`, perché `main` è l'involucro che porta con sé la
 * colonna laterale; `#content` per ultimo, perché è il nome più generico.
 */
export const SELETTORI_CONTENITORE: readonly string[] = [
  'article',
  '.avviso',
  '.entry-content',
  'main',
  '.contenuto',
  '#content',
];

/**
 * Testo minimo perché un contenitore sia credibile come atto: sotto questa
 * soglia è una card, un teaser o un riquadro «condividi», e si passa al
 * candidato successivo.
 */
export const MINIMO_TESTO_CONTENITORE = 120;

/** Ciò che non è mai il testo dell'atto: menu, piede, colonna laterale. */
const DA_SCARTARE = 'script, style, noscript, nav, footer, aside';

const normalizza = (testo: string): string => (testo ?? '').replace(/\s+/g, ' ').trim();

export interface ContenitoreScelto {
  /** Selettore che ha vinto; `null` quando si è dovuta leggere la pagina intera. */
  selettore: string | null;
  /** Testo del contenitore, spazi normalizzati. */
  testo: string;
}

/**
 * Il testo dell'atto: il contenitore più specifico che ne contiene abbastanza,
 * altrimenti il `<body>`. Non lancia mai (HTML rotto → testo vuoto).
 */
export function scegliContenitore(html: string): ContenitoreScelto {
  const $ = cheerio.load(html ?? '');
  $(DA_SCARTARE).remove();
  for (const selettore of SELETTORI_CONTENITORE) {
    const $candidato = $(selettore).first();
    if ($candidato.length === 0) continue;
    const testo = normalizza($candidato.text());
    if (testo.length >= MINIMO_TESTO_CONTENITORE) return { selettore, testo };
  }
  return { selettore: null, testo: normalizza($('body').text()) };
}
