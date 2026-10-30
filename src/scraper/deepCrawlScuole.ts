/**
 * ScuoleRadar.it — DEEP CRAWL DEGLI ISTITUTI (§26.94).
 *
 * Perché esiste: gli hub USR/USP pubblicano l'elenco degli interpelli, ma il
 * DOCUMENTO vive sul sito dell'istituto che assume (albo pretorio / sezione
 * «Interpelli»). Fino a qui il runner certificava la scuola sull'anagrafica MIM
 * ma non visitava la sua casa: si perdeva tutto ciò che la scuola pubblica in
 * proprio e che l'USP non riporta.
 *
 * COSA FA (una scuola alla volta, con tetto di pagine)
 *  1. parte dalla HOME ISTITUZIONALE risolta da `schools_master`
 *     (`ScuolaCertificata.home`: solo `*.edu.it` / dominio dichiarato dal MIM);
 *  2. legge i link della home che portano a interpelli/supplenze/albo — stesso
 *     host, mai una piattaforma privata (Argo/Nuvola/…), mai un file, mai una
 *     ricerca o una pagina di paginazione (regole in `linkScuola.ts`);
 *  3. scarica al massimo `maxPagine` pagine e le restituisce GREZZE: chi le
 *     interpreta è `parseUniversalHtml` + il runner, che certificano scuola e
 *     scadenza con le regole di sempre.
 *
 * REGOLE DICHIARATE
 *  · Nessuna URL inventata: si visitano solo link presenti nella home (niente
 *    `home + '/interpelli'` costruito a mano);
 *  · nessun accesso se l'anagrafica non dichiara un sito (`home === null`);
 *  · gli errori di rete non lanciano mai: finiscono in `errori` e la scuola si
 *    salta, il giro continua.
 *
 * Node-only (usa `fetch` iniettato dal chiamante). Guardia:
 * `npm run test:deep-crawl` (incluso in `npm test`).
 */

import { allegatiDaGuscio } from './allegatiBando.ts';
import { urlGuscio } from './guscioPagina.ts';
import { linkInterpelliScuola } from './linkScuola.ts';

/** Esito del download di una pagina (forma minima di `fetch`). */
export interface PaginaScaricata {
  status: number;
  contentType: string;
  html: string;
}

/** Scaricatore iniettato: nel runner è `fetch` con timeout e UA del bot. */
export type ScaricaPagina = (url: string) => Promise<PaginaScaricata>;

/** Pagina HTML scaricata dal sito di un istituto. */
export interface PaginaScuola {
  url: string;
  html: string;
  /**
   * §26.115 — PAGINA-GUSCIO: non ha contenuto suo e vale solo per gli allegati.
   * Il runner ne legge i PDF (`linkAllegatiInterpello`) e NON le voci: in un
   * guscio le «voci» sarebbero le voci di menu, e un menu non è un interpello.
   */
  soloAllegati?: boolean;
}

/** Esito della visita a un istituto (nessuna eccezione: solo dati e motivi). */
export interface EsitoLetturaScuola {
  home: string | null;
  pagine: PaginaScuola[];
  /** Link candidati riconosciuti nella home (anche se il download fallisce). */
  linkTrovati: number;
  /** §26.115 — allegati di bando trovati nel guscio della home (0 se nessuno). */
  allegatiTrovati: number;
  errori: string[];
}

function messaggio(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/**
 * Visita la casa di un istituto e restituisce le pagine-elenco scaricate.
 * `scuola.home === null` → nessuna richiesta: l'anagrafica non dichiara un sito.
 */
export async function leggiPagineInterpelli(
  scuola: { codice: string | null; nome: string | null; home: string | null },
  scarica: ScaricaPagina,
  opzioni: { maxPagine?: number } = {},
): Promise<EsitoLetturaScuola> {
  const esito: EsitoLetturaScuola = {
    home: scuola.home ?? null,
    pagine: [],
    linkTrovati: 0,
    allegatiTrovati: 0,
    errori: [],
  };
  if (!scuola.home) {
    esito.errori.push('sito non dichiarato dall’anagrafica');
    return esito;
  }
  const maxPagine = Math.max(0, opzioni.maxPagine ?? 2);
  if (maxPagine === 0) return esito;

  let home: PaginaScaricata;
  try {
    home = await scarica(scuola.home);
  } catch (err) {
    esito.errori.push(`home non raggiungibile: ${messaggio(err)}`);
    return esito;
  }
  if (home.status >= 400) {
    esito.errori.push(`home HTTP ${home.status}`);
    return esito;
  }
  if (!home.contentType.includes('html')) {
    esito.errori.push(`home non HTML: ${home.contentType || 'senza content-type'}`);
    return esito;
  }

  let candidati = linkInterpelliScuola(home.html, scuola.home, maxPagine);

  // §26.113 — PAGINA GUSCIO: la home è un frameset/iframe o un meta refresh e non
  // contiene un solo link pertinente. Si entra UNA volta nel contenuto vero
  // (`urlGuscio`) e si cercano i link lì: una scuola il cui albo vive dentro il
  // frame non è una scuola senza albo. La pagina interna entra in `pagine` (spesso
  // È il portale vero) e consuma uno slot del tetto.
  if (candidati.length === 0) {
    const dentro = urlGuscio(home.html, scuola.home);
    if (dentro) {
      try {
        const interna = await scarica(dentro);
        if (interna.status >= 400) {
          esito.errori.push(`guscio ${dentro}: HTTP ${interna.status}`);
        } else if (!interna.contentType.includes('html')) {
          esito.errori.push(
            `guscio ${dentro}: non HTML (${interna.contentType || 'content-type assente'})`
          );
        } else {
          esito.pagine.push({ url: dentro, html: interna.html });
          candidati = linkInterpelliScuola(
            interna.html,
            dentro,
            Math.max(0, maxPagine - 1)
          );
        }
      } catch (err) {
        esito.errori.push(`guscio ${dentro}: ${messaggio(err)}`);
      }
    }
  }

  // §26.115 — GUSCIO CON ALLEGATO (Piacenza): la home non ha contenuto suo e non
  // produce un solo link pertinente, ma il bando c'è — dentro un PDF. Si
  // restituisce la HOME come pagina-guscio (`soloAllegati`): il runner ne legge
  // gli allegati e il link di atterraggio sarà il documento ufficiale. Nessuna
  // richiesta in più (la pagina è già in memoria) e nessuna URL costruita a mano.
  if (candidati.length === 0 && esito.pagine.length === 0) {
    const allegati = allegatiDaGuscio(home.html, scuola.home, 2);
    if (allegati.length > 0) {
      esito.pagine.push({ url: scuola.home, html: home.html, soloAllegati: true });
      esito.allegatiTrovati = allegati.length;
    }
  }

  esito.linkTrovati = candidati.length;
  for (const candidato of candidati) {
    try {
      const pagina = await scarica(candidato.url);
      if (pagina.status >= 400) {
        esito.errori.push(`${candidato.url} HTTP ${pagina.status}`);
        continue;
      }
      if (!pagina.contentType.includes('html')) continue;
      esito.pagine.push({ url: candidato.url, html: pagina.html });
    } catch (err) {
      esito.errori.push(`${candidato.url}: ${messaggio(err)}`);
    }
  }
  return esito;
}

