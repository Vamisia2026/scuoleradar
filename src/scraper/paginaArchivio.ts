/**
 * ScuoleRadar.it — PAGINE-CONTENITORE E VOCI DI MENU (§26.122) — Node-only, puro.
 *
 * Perché esiste. Accanto ai bandi, i siti degli istituti pubblicano pagine che
 * NON sono un avviso ma un CONTENITORE: «La segreteria comunica», «Comunicazioni»,
 * «Archivio», «Circolari». Sono pagine utili e caotiche: un elenco indistinto di
 * trafiletti e di PDF, senza una scadenza e senza una classe. Ingestite come
 * avvisi riempiono la bacheca di righe che l'utente apre e richiude.
 *
 * Il secondo difetto è più sottile: il MENU del sito. Molti portali hanno una voce
 * «Interpelli» in testa a ogni pagina; un estratto che legge il testo della pagina
 * trova la parola e conclude che è un'opportunità — anche quando il bando non c'è
 * (caso Orvieto-Montecchio). La parola nel menu non è un atto: lo è solo se il
 * TITOLO della voce la dichiara (regola già attiva in `lib/noiseFilter.ts`).
 *
 * LA REGOLA (due domande, nessuna euristica fragile)
 *   1. `motivoPaginaContenitore`: la pagina si scarta quando NON dichiara né una
 *      scadenza né una classe (senza quei dati non c'è nulla a cui candidarsi) e
 *      (a) il titolo è una pura etichetta di navigazione — «Interpelli»,
 *      «Comunicazioni», «La segreteria comunica», «Archivio»… — oppure (b) il
 *      percorso dell'URL è un contenitore (`/la-segreteria-comunica/`,
 *      `/archivio`, `/comunicazioni`) e il titolo non ha un segnale di
 *      reclutamento.
 *   2. `documentoUnicoDaContenitore`: se il contenitore porta UN SOLO allegato di
 *      bando pertinente, il link da pubblicare è QUELLO — il PDF ufficiale, non la
 *      pagina-elenco che lo contiene. Con più PDF pertinenti non si indovina: si
 *      scarta (un archivio non dice quale sia l'interpello).
 *
 * Cosa NON fa: non inventa titoli, non costruisce URL, non legge la rete. Riceve
 * HTML e testi già scaricati e restituisce un giudizio con il motivo leggibile.
 *
 * Guardia: `npm run test:pagina-archivio` (incluso in `npm test`).
 */
import { allegatiBando } from './allegatiBando.ts';

/** Etichette di navigazione: sono voci di menu, non avvisi. */
const ETICHETTE_MENU: readonly RegExp[] = [
  /^interpelli?(?:\s+e\s+supplenze?)?$/i,
  /^supplenze?$/i,
  /^bandi(?:\s+e\s+avvisi)?$/i,
  /^avvisi$/i,
  /^comunicazioni?(?:\s+generali)?$/i,
  /^circolari$/i,
  /^archivio(?:\s+\w+)?$/i,
  /^news$/i,
  /^notizie$/i,
  /^albo(?:\s+pretorio)?$/i,
  /^la\s+segreteria\s+comunica$/i,
  /^documenti$/i,
  /^modulistica$/i,
];

/** Segnali di reclutamento nel titolo: se ci sono, la pagina parla di un bando. */
const RE_RECLUTAMENTO =
  /interpell|supplenz|conferimento|incarico|reclutament|messa\s+a\s+disposizione|selezione|bando|graduator|assunzion/i;

/** Percorsi di un contenitore generico (archivio, comunicazioni, circolari). */
const RE_PATH_CONTENITORE =
  /(segreteria-comunica|la-segreteria|comunicazion|circolar|archivi|albo|documenti|news|avvisi)/i;

/** Riga da giudicare: tutti i campi sono facoltativi (dato assente ≠ giudizio). */
export interface PaginaDaGiudicare {
  titolo?: string | null;
  /** Testo leggibile della pagina/documento (secondo bacino di segnali). */
  testo?: string | null;
  /** URL della pagina: serve solo a riconoscere il contenitore dal percorso. */
  url?: string | null;
  /** Scadenza DICHIARATA: se c'è, la pagina è un bando e non un contenitore. */
  scadenza?: string | null;
  /** Classi riconosciute: se ce ne sono, la pagina è un bando. */
  classi?: readonly string[] | null;
}

/** Spazi compattati e caratteri di controllo rimossi. */
function compatto(valore?: string | null): string {
  return (valore ?? '')
    .replace(/[\u00a0\u2007\u202f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Percorso (con query) di un URL; stringa vuota se l'URL non è leggibile. */
function percorso(url?: string | null): string {
  const u = compatto(url);
  if (!/^https?:\/\//i.test(u)) return '';
  try {
    const p = new URL(u);
    return `${p.pathname}${p.search}`;
  } catch {
    return '';
  }
}

/** true = la pagina dichiara una scadenza o una classe: è un bando, non un contenitore. */
function dichiaraUnBando(pagina: PaginaDaGiudicare): boolean {
  if (compatto(pagina.scadenza).length > 0) return true;
  return (pagina.classi ?? []).some((classe) => compatto(classe).length > 0);
}

/** true = il titolo è una pura etichetta di menu («Interpelli», «Comunicazioni», …). */
export function eEtichettaMenu(titolo?: string | null): boolean {
  const t = compatto(titolo);
  if (!t) return false;
  return ETICHETTE_MENU.some((re) => re.test(t));
}

/**
 * Motivo per cui la pagina NON è un'opportunità (`null` = nessun segnale: decide il
 * resto del filtro). Non scarta mai una pagina che dichiari scadenza o classe.
 */
export function motivoPaginaContenitore(pagina: PaginaDaGiudicare): string | null {
  if (dichiaraUnBando(pagina)) return null;
  const titolo = compatto(pagina.titolo);
  if (eEtichettaMenu(titolo)) {
    return `voce di menu / pagina-contenitore («${titolo}», senza scadenza né classe)`;
  }
  const path = percorso(pagina.url);
  const segnaleTitolo = RE_RECLUTAMENTO.test(titolo);
  if (!segnaleTitolo && path && RE_PATH_CONTENITORE.test(path)) {
    return `pagina-contenitore di archivio (${path}, senza scadenza né classe)`;
  }
  return null;
}

/** Scorciatoia booleana (stessa implementazione, un solo punto). */
export function ePaginaContenitore(pagina: PaginaDaGiudicare): boolean {
  return motivoPaginaContenitore(pagina) !== null;
}

/**
 * L'unico allegato di bando di un contenitore, se è davvero UNO: in quel caso il
 * link da pubblicare è il PDF ufficiale (link assoluto, risolto sull'URL della
 * pagina). Con zero o più allegati pertinenti restituisce `null`: un archivio non
 * dice quale sia l'interpello, e indovinare sarebbe peggio che scartare.
 */
export function documentoUnicoDaContenitore(
  html?: string | null,
  baseUrl?: string | null,
): string | null {
  if (typeof html !== 'string' || html.trim() === '') return null;
  const base = compatto(baseUrl);
  if (!/^https?:\/\//i.test(base)) return null;
  const allegati = allegatiBando(html, base, 3);
  return allegati.length === 1 ? allegati[0].url : null;
}
