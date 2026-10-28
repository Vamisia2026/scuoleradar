/**
 * ScuoleRadar.it — DA ELENCO DI POST AD AVVISI STRUTTURATI — Node-only.
 *
 * Punto di innesto fra `postElenco.ts` (quali post?) + `articoloPost.ts` (che
 * cosa dice il post?) e il parser: riceve l'HTML della pagina indice, la
 * interpreta come feed o come elenco HTML, scarica (al massimo `max`) le pagine
 * dei post e restituisce un avviso per ciascuno.
 *
 * Regole di prodotto rispettate:
 *   · si pubblica sempre il link del POST, mai quello della pagina indice;
 *   · una voce che è a sua volta un INDICE (paginazione dell'indice, sezione
 *     collegata) viene scartata: «un avviso si apre su un avviso» (direttiva
 *     27/10/2026, regola condivisa col tabellone in `lib/urlAvviso.ts`);
 *   · provincia e fonte sono quelle dell'indice (il post non le ridiscute);
 *   · la data di pubblicazione segue questo ordine: dati dell'articolo →
 *     `<time>`/`data` dell'elenco → data dichiarata dalla fonte;
 *   · un post illeggibile NON viene perso: si pubblica con l'anteprima
 *     dell'elenco (titolo + contesto), che basta al parser per classi e scuola.
 *
 * Il downloader è iniettato: qui non si apre nessuna connessione, così il
 * modulo resta puro e testabile (vedi `scripts/test-post-elenco.ts`).
 */

import { eUrlIndicePortale } from '../lib/urlAvviso.ts';
import { estraiContenutoArticolo, type ContenutoArticolo } from './articoloPost.ts';
import { eFeedDocumento, estraiPostDaFeed } from './postFeed.ts';
import { estraiPostElenco, type PostElenco } from './postElenco.ts';
import { parseInterpello, type InterpelloParsato } from './parser.ts';

/** Come è stata riconosciuta la pagina indice. */
export type TipoElencoPost = 'feed' | 'articolo' | 'elenco' | 'nessuno';

export interface EsitoPostElenco {
  /** `feed` (RSS), `elenco` (HTML con post linkati) o `nessuno`. */
  tipo: TipoElencoPost;
  /** Un avviso per post (link = pagina del post). */
  avvisi: InterpelloParsato[];
  /** Post riconosciuti nell'indice. */
  postTrovati: number;
  /** Post la cui pagina è stata letta davvero (gli altri: solo anteprima). */
  postLetti: number;
  /** Voci scartate perché erano a loro volta un indice/elenco. */
  indiciScartati: number;
}

export interface ContestoPostElenco {
  /** URL della pagina indice/feed (base per i link relativi). */
  baseUrl: string;
  /** Provincia della fonte (fallback: il post non la ridiscute). */
  provincia: string;
  /** Nome della sorgente per il parser (URL dell'indice). */
  source: string;
  /** Data di pubblicazione dichiarata dalla voce d'indice, se nota. */
  dataPubblicazione?: string | null;
}

/**
 * Espande una pagina indice di POST in avvisi: feed RSS se il documento è un
 * feed, altrimenti elenco HTML. Restituisce `tipo: 'nessuno'` quando la pagina
 * non è un indice di post (in quel caso il chiamante tiene l'avviso originale).
 */
export async function espandiPostInAvvisi(
  html: string,
  ctx: ContestoPostElenco,
  opts: { max?: number; scarica: (url: string) => Promise<string> },
): Promise<EsitoPostElenco> {
  const max = Math.max(1, opts.max ?? 8);
  const daFeed = eFeedDocumento(html);
  const post: PostElenco[] = daFeed
    ? estraiPostDaFeed(html, ctx.baseUrl, max)
    : estraiPostElenco(html, ctx.baseUrl, { max });

  if (post.length === 0)
    return { tipo: 'nessuno', avvisi: [], postTrovati: 0, postLetti: 0, indiciScartati: 0 };

  const base = ctx.baseUrl.split('#')[0].replace(/\/+$/, '');
  const avvisi: InterpelloParsato[] = [];
  const hashVisti = new Set<string>();
  let postLetti = 0;
  let indiciScartati = 0;

  for (const p of post) {
    // Il post non può essere l'indice stesso (feed che linka la categoria).
    if (p.url.split('#')[0].replace(/\/+$/, '') === base) continue;

    // Né può essere un'ALTRA pagina indice (paginazione dell'indice, sezione
    // collegata, archivio): pubblicarla rimetterebbe in bacheca una riga che
    // apre una lista. La regola è la STESSA del tabellone (`lib/urlAvviso.ts`),
    // così ingestione e vetrina non possono divergere.
    if (eUrlIndicePortale(p.url)) {
      indiciScartati += 1;
      continue;
    }

    let contenuto: ContenutoArticolo = {
      titolo: p.titolo,
      corpo: p.contesto,
      dataPubblicazione: p.dataPubblicazione,
      allegati: [],
    };
    try {
      contenuto = estraiContenutoArticolo(await opts.scarica(p.url), p.url);
      postLetti += 1;
    } catch {
      // Post non raggiungibile: si tiene l'anteprima dell'elenco (mai perdere l'avviso).
    }

    const corpo = [contenuto.corpo, p.contesto]
      .map((c) => (c ?? '').trim())
      .filter(Boolean)
      .join(' · ')
      .slice(0, 1800);

    const avviso = parseInterpello({
      title: (contenuto.titolo || p.titolo).slice(0, 300),
      link: p.url,
      // Prima la pagina del post, poi i suoi allegati (bando, tabella, domanda):
      // sono la fonte preferita per classi di concorso, scadenze e contatti.
      linkCandidati: [p.url, ...contenuto.allegati],
      provincia: ctx.provincia,
      source: ctx.source,
      corpo,
      dataPubblicazione: contenuto.dataPubblicazione ?? p.dataPubblicazione ?? ctx.dataPubblicazione ?? null,
    });
    if (hashVisti.has(avviso.hashId)) continue;
    hashVisti.add(avviso.hashId);
    avvisi.push(avviso);
  }

  return {
    tipo: daFeed ? 'feed' : 'elenco',
    avvisi,
    postTrovati: post.length,
    postLetti,
    indiciScartati,
  };
}
