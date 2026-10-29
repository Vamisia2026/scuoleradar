/**
 * ScuoleRadar.it — §26.103: LE PAGINE 2…N DELLO STESSO ELENCO.
 *
 * Perché esiste: un hub USR/USP pubblica «Interpelli» su WordPress con 10 voci
 * per pagina e 200 in archivio. Il worker di ingestione leggeva UNA pagina per
 * indice, quindi le voci delle pagine 2…N non esistevano per il radar: misurato
 * il 29/10/2026, `uat-napoli.it/tag/interpelli-personale-docente/page/2/` dà
 * altre 12 voci apribili (e la pagina 3 una con scadenza) che il giro nazionale
 * non aveva mai visto. In quel giro le pagine oltre la prima sono state 70, per
 * 408 voci d'elenco in più.
 *
 * Regola di lettura (non negoziabile, la stessa della sgranatura tabellare):
 *   1. si segue SOLO la pagina successiva **dichiarata dalla pagina stessa**
 *      (`urlPaginaSuccessiva` in `paginaSuccessiva.ts`: `rel="next"`, un'ancora
 *      «successiva/next/›» dentro un contenitore di paginazione, oppure
 *      l'etichetta numerica `corrente + 1` del tema);
 *   2. MAI una URL costruita a mano (niente `/page/2/` indovinato, niente
 *      `?paged=` incrementato) e mai sé stessi o `rel="prev"`;
 *   3. la catena si ferma al tetto di pagine, alla riserva di rete del giro o
 *      alla prima pagina che non si scarica — un errore non è un guasto.
 *
 * Questo modulo NON conosce la rete: il download è iniettato (`scarica`), così
 * il worker di coda e gli script di ingestione usano lo stesso codice e il test
 * gira senza toccare un solo portale.
 */

import { urlPaginaSuccessiva } from './paginaSuccessiva.ts';

/** Pagine per elenco quando nessuno lo dice: 1 = solo la prima (comportamento storico). */
export const PAGINE_ELENCO_DEFAULT = 3;

/** Una pagina d'elenco già letta: l'URL da cui è arrivata e il suo HTML. */
export interface PaginaElencoLetta {
  url: string;
  html: string;
}

/** Perché la catena si è fermata (diagnostica: mai un'eccezione). */
export type FinePagineElenco =
  /** Raggiunto il tetto di pagine per elenco. */
  | 'tetto'
  /** La pagina non dichiara una successiva: l'elenco è finito. */
  | 'fine'
  /** La successiva era già stata letta (archivio che si ripete). */
  | 'ciclo'
  /** Riserva di rete del giro esaurita: le pagine restano al prossimo giro. */
  | 'budget'
  /** La pagina successiva non si è scaricata (rete, 4xx, documento binario). */
  | 'errore';

export interface EsitoPagineElenco {
  /** Pagine lette, in ordine: la prima è sempre quella passata dal chiamante. */
  pagine: PaginaElencoLetta[];
  /** Pagine OLTRE la prima lette davvero: è il consumo di rete da contabilizzare. */
  extra: number;
  fermato: FinePagineElenco;
}

/**
 * Chiave di confronto fra URL: schema e slash finale non fanno una pagina nuova.
 * Esportata perché anche il worker di coda tiene un insieme di pagine già lette
 * per hub (una pagina d'elenco scoperta come «sezione» e poi come «successiva»
 * si scarica una volta sola).
 */
export function chiaveElenco(url: string): string {
  try {
    const u = new URL(url);
    return `${u.host.toLowerCase()}${u.pathname.replace(/\/+$/, '')}${u.search}`;
  } catch {
    return url.trim();
  }
}

/** Vero se il download sembra HTML: un PDF/immagine non è una pagina d'elenco. */
function sembraHtml(html: string): boolean {
  return typeof html === 'string' && /<\s*[a-z!]/i.test(html);
}

/**
 * Segue le pagine 2…N di un elenco a partire dalla PRIMA già letta.
 *
 * `max` è il tetto di pagine (default `PAGINE_ELENCO_DEFAULT`), `riserva` è
 * quante pagine extra il giro può ancora spendere (default: illimitata entro il
 * tetto). `log` riceve una riga per pagina letta: chi chiama la formatta come
 * vuole, così il log dice sempre quale elenco sta crescendo.
 */
export async function pagineSuccessiveElenco(
  prima: PaginaElencoLetta,
  opts: {
    max?: number;
    scarica: (url: string) => Promise<string>;
    riserva?: number;
    log?: (riga: string) => void;
  },
): Promise<EsitoPagineElenco> {
  const tetto = Number.isFinite(opts.max) ? Math.max(1, Math.floor(opts.max as number)) : PAGINE_ELENCO_DEFAULT;
  const riserva = Number.isFinite(opts.riserva)
    ? Math.max(0, Math.floor(opts.riserva as number))
    : Number.POSITIVE_INFINITY;
  const pagine: PaginaElencoLetta[] = [prima];
  const viste = new Set<string>([chiaveElenco(prima.url)]);
  let html = prima.html;
  let url = prima.url;
  let motivo: FinePagineElenco | undefined;

  while (pagine.length < tetto) {
    if (pagine.length - 1 >= riserva) {
      motivo = 'budget';
      break;
    }
    const successiva = urlPaginaSuccessiva(html, url);
    if (!successiva) {
      motivo = 'fine';
      break;
    }
    const chiave = chiaveElenco(successiva);
    if (viste.has(chiave)) {
      motivo = 'ciclo';
      break;
    }
    let scaricato: string;
    try {
      scaricato = await opts.scarica(successiva);
    } catch {
      motivo = 'errore';
      break;
    }
    if (!sembraHtml(scaricato)) {
      motivo = 'errore';
      break;
    }
    viste.add(chiave);
    pagine.push({ url: successiva, html: scaricato });
    opts.log?.(`${pagine.length}ª pagina (${successiva})`);
    html = scaricato;
    url = successiva;
  }

  return {
    pagine,
    extra: pagine.length - 1,
    fermato: motivo ?? (pagine.length >= tetto ? 'tetto' : 'fine'),
  };
}
