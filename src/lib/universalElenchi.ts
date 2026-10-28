/**
 * ScuoleRadar.it — LETTURA ADATTIVA DI ELENCHI E CARD HTML (§26.93).
 *
 * Perché esiste: metà dei portali USR/USP non pubblica `<table>`. Pubblicano
 * liste di `<li>`, card di `<div class="avviso">`, `<article>` di WordPress,
 * titoli `<h3><a>` con la data in uno `<span>` accanto — e a volte un elenco
 * paginato (`?page=2`) in cui ogni voce è solo un link con la data nel contesto.
 * Il lettore tabellare li scarta tutti: qui si legge il SIGNIFICATO della voce
 * (titolo = link, data etichettata, codice meccanografico, classi) e si
 * restituisce una lista di avvisi apribili.
 *
 * REGOLE DICHIARATE (le stesse di `universalEuristica.ts` e §26.75):
 *  · `expirationDate` esiste SOLO se la pagina scrive l'etichetta («Scadenza»,
 *    «entro il», «termine», «presentazione delle domande»): una data di
 *    pubblicazione non diventa mai una scadenza;
 *  · l'URL deve essere un documento (mai home, ricerca, ancora o piattaforma);
 *  · nessuna rete, nessun LLM, nessuna dipendenza: stesso HTML + stesso
 *    `baseUrl` = stesse voci (guardia: `npm run test:universal-elenchi`).
 *
 * La forma dell'output è COMPATIBILE con `ExtractedInterpello` di
 * `universalEuristica.ts` (stessi nomi di campo): il chiamante la usa così com'è,
 * senza un secondo tipo da mantenere allineato.
 */

import { estraiCodiciClasse } from './pdfDeterminist';
import { dateNelTesto, scadenzaDaMetadati, scadenzaDaTesto } from './scadenzaTesto';
import { blocchi, metadatiAncora, primoLink, testo, urlUtile } from './universalHtml';

// Compatibilità: `dateNelTesto` vive in `scadenzaTesto.ts` insieme alla lettura
// delle etichette (§26.94); qui resta esportata perché è la superficie pubblica
// storica del lettore d'elenchi.
export { dateNelTesto };

/** Una voce di elenco pronta per l'ingestione (forma di `ExtractedInterpello`). */
export interface VoceElenco {
  title: string;
  schoolName?: string;
  schoolCode?: string;
  classCodes: string[];
  /** Data della voce quando NON è una scadenza (tipicamente pubblicazione). */
  publicationDate?: string;
  /** Data dichiarata come termine: l'unica che può diventare `deadline`. */
  expirationDate?: string;
  directUrl: string;
}

/** Tetto di voci per pagina: un archivio può averne centinaia. */
export const MAX_VOCI_ELENCO = 200;
/** Oltre questa soglia si sta leggendo la coda della pagina, non l'elenco. */
const MAX_HTML_ELENCO = 400_000;

/* ------------------------- scadenze e metadati ---------------------------- */
// La lettura delle date e delle etichette (§26.94) vive in `scadenzaTesto.ts`:
// qui si usa, non si duplica.

/**
 * Scadenza della voce: prima quella DICHIARATA nel testo del blocco, poi quella
 * scritta nei metadati del link (titolo, `aria-label`, nome del file). Sempre e
 * solo con una qualifica di termine (§26.94).
 */
function scadenzaVoce(corpo: string, titolo: string, metadati: { titolo?: string; ariaLabel?: string }, url: string): string | undefined {
  return (
    scadenzaDaTesto(corpo) ??
    scadenzaDaMetadati({ titolo: metadati.titolo ?? titolo, ariaLabel: metadati.ariaLabel, url }) ??
    undefined
  );
}

/* ------------------------------- candidati -------------------------------- */

/** Parole che fanno di un titolo un avviso (mai una voce di menu). */
const RE_TITOLO_AVVISO =
  /interpell|supplenz|disponibilit|messa\s+a\s+disposizione|incaric|reclutament|band[oi]|selezion|esperto|tutor|docent|ATA\b|concors/i;

/** Titoli di ARCHIVIO, non di avviso: «Categoria: interpelli», «Tag: …». */
const RE_TITOLO_ARCHIVIO = /^(?:categor|tag|archivi|archives|etichett|categoria:)/i;

/** Blocchi che possono contenere una voce (mai tabelle: quelle le legge l'altro lettore). */
const RE_TAG_ELENCO = /^(?:li|article|div|section|figure)$/;

/** Classi che segnalano UNA card/voce (un contenitore `.cards` non lo è). */
const RE_BLOCCO_ELENCO =
  /class\s*=\s*["'][^"']*\b(?:avvis|interpell|band[oi]|news|post|card|item|entry|risultat|elenco|list|archive|notice|circolar|evento)\b/i;

/** Blocchi di navigazione: link sempre presenti, avvisi mai. */
const RE_BLOCCO_ESCLUSO =
  /class\s*=\s*["'][^"']*\b(?:menu|nav|navbar|breadcrumb|footer|sidebar|widget|social|pagination|paginazione|cookie|banner)\b/i;

const RE_ANCORA = /<a\b([^>]*)>([\s\S]*?)<\/a>/gi;
const RE_HREF = /href\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+))/i;
const RE_MECCANOGRAFICO = /\b([A-Z]{2}[A-Z0-9]{8})\b/;
/**
 * Archivi, categorie, tag e paginazione NON sono l'avviso: la regola dei canali
 * (`comunicazione/04_canali_regionali/checklist_regionali.md`) vuole il link
 * diretto al documento, mai un elenco.
 */
const RE_URL_ARCHIVIO =
  /\/(?:category|categoria|tag|tags|archivio|archive|author|autore|page|pagina)\//i;
const RE_QUERY_PAGINA = /[?&](?:page|paged|p)=\d/i;

/** URL di una VOCE: documento apribile, mai un elenco o una pagina di archivio. */
function urlElencoUtile(href: string, baseUrl: string): string | undefined {
  const url = urlUtile(href, baseUrl);
  if (!url) return undefined;
  try {
    const parsed = new URL(url);
    if (RE_URL_ARCHIVIO.test(parsed.pathname) || RE_QUERY_PAGINA.test(parsed.search)) {
      return undefined;
    }
  } catch {
    return undefined;
  }
  return url;
}

/** Titolo della voce: il testo del link, altrimenti la prima intestazione. */
function titoloVoce(blocco: string, titoloLink: string): string {
  if (titoloLink.length >= 8) return titoloLink;
  const intestazione = /<h[1-6]\b[^>]*>([\s\S]*?)<\/h[1-6]>/i.exec(blocco);
  return testo(intestazione?.[1] ?? '');
}

/** Voce da un blocco (`<li>`, card, `<article>`) oppure `null`. */
function voceDaBlocco(blocco: string, baseUrl: string): VoceElenco | null {
  const link = primoLink(blocco, baseUrl);
  if (!link) return null;
  const urlVoce = urlElencoUtile(link.url, baseUrl);
  if (!urlVoce) return null;
  const titolo = titoloVoce(blocco, link.testo);
  if (titolo.length < 8 || RE_TITOLO_ARCHIVIO.test(titolo)) return null;

  const corpo = testo(blocco);
  const date = dateNelTesto(corpo);
  const scadenza = scadenzaVoce(corpo, titolo, link.metadati, urlVoce);
  if (!RE_TITOLO_AVVISO.test(titolo) && date.length === 0) return null;

  const codice = RE_MECCANOGRAFICO.exec(`${titolo} ${corpo.slice(0, 300)}`.toUpperCase())?.[1];
  return {
    title: titolo,
    schoolCode: codice,
    classCodes: estraiCodiciClasse(`${titolo} ${corpo.slice(0, 300)}`),
    publicationDate: date.find((d) => d.iso !== scadenza)?.iso,
    expirationDate: scadenza,
    directUrl: urlVoce,
  };
}

/**
 * Voce da un'ancora «a titolo» (elenchi paginati senza wrapper): la data si
 * legge nel contesto che segue il link (la stessa riga di elenco). È il
 * ripiego per i portali che marcano solo `<h3><a>` e uno `<span class="data">`.
 */
function voceDaAncora(html: string, m: RegExpExecArray, baseUrl: string): VoceElenco | null {
  const titolo = testo(m[2]);
  if (titolo.length < 8 || RE_TITOLO_ARCHIVIO.test(titolo) || !RE_TITOLO_AVVISO.test(titolo)) {
    return null;
  }
  const href = RE_HREF.exec(m[1]);
  const url = href ? urlElencoUtile(href[1] ?? href[2] ?? href[3] ?? '', baseUrl) : undefined;
  if (!url) return null;

  const contesto = testo(html.slice(m.index ?? 0, (m.index ?? 0) + 500));
  const date = dateNelTesto(contesto);
  const scadenza = scadenzaVoce(contesto, titolo, metadatiAncora(m[1]), url);
  const codice = RE_MECCANOGRAFICO.exec(`${titolo} ${contesto}`.toUpperCase())?.[1];
  return {
    title: titolo,
    schoolCode: codice,
    classCodes: estraiCodiciClasse(`${titolo} ${contesto}`),
    publicationDate: date.find((d) => d.iso !== scadenza)?.iso,
    expirationDate: scadenza,
    directUrl: url,
  };
}

/**
 * Elenchi, card, liste di post e pagine di archivio: le voci con un documento
 * apribile e, quando la pagina la dichiara, la scadenza. Non lancia mai.
 */
export function vociDaElenco(html: string, baseUrl: string): VoceElenco[] {
  if (typeof html !== 'string' || html.trim() === '') return [];
  try {
    new URL(baseUrl);
  } catch {
    return [];
  }
  const documento = html.slice(0, MAX_HTML_ELENCO);
  const voci = new Map<string, VoceElenco>();
  const aggiungi = (voce: VoceElenco | null): void => {
    if (!voce || voci.size >= MAX_VOCI_ELENCO) return;
    if (!voci.has(voce.directUrl)) voci.set(voce.directUrl, voce);
  };

  // 1) Blocchi semantici: `<li>`, `<article>`, card `<div class="avviso">`.
  for (const blocco of blocchi(
    documento,
    (tag, attributi) =>
      RE_TAG_ELENCO.test(tag) &&
      !RE_BLOCCO_ESCLUSO.test(attributi) &&
      (tag === 'li' || tag === 'article' || RE_BLOCCO_ELENCO.test(attributi)),
  )) {
    aggiungi(voceDaBlocco(blocco.html, baseUrl));
  }

  // 2) Ripiego: ancore con testo da avviso, data nel contesto che segue.
  let esaminate = 0;
  for (const m of documento.matchAll(RE_ANCORA)) {
    esaminate += 1;
    if (esaminate > 600 || voci.size >= MAX_VOCI_ELENCO) break;
    aggiungi(voceDaAncora(documento, m, baseUrl));
  }

  return [...voci.values()];
}
