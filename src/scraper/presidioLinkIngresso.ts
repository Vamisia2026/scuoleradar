/**
 * ScuoleRadar.it — Scraper · PRESIDIO DEL LINK IN INGRESSO (PURO, nessuna rete).
 *
 * Perché esiste: fino alla §26.104 il link di un avviso veniva «pingato» con una
 * logica locale allo scraper (`linkRaggiungibile` in `index.ts`) e un `403` del
 * server anti-bot bastava a scartare un bando vero. Ora la regola è UNA SOLA —
 * `lib/validitaLink.ts` (`decidiPubblicazione`) — la stessa della pulizia dati:
 * la decisione su `ok` / `bloccato` / `assente` non può divergere fra chi inserisce
 * e chi ripulisce.
 *
 * Questo modulo è il punto in cui la regola incontra il flusso di INGESTIONE e
 * aggiunge due cose che la pulizia non ha:
 *   1. `daControllareInIngresso`: i record STRUTTURATI (classe/materia + email di
 *      candidatura) non si pingano — un server scolastico risponde `403` a un bot
 *      qualunque sia lo stato del bando, quindi la richiesta è solo rumore;
 *   2. `instabile` ≠ `assente`: in ingresso un timeout/5xx NON prova che l'avviso
 *      sia morto e l'upsert è `ignoreDuplicates`, cioè irreversibile — il link
 *      specifico resta e la decisione (con nuovo tentativo) spetta alla pulizia.
 *      Un `404`/`410` invece è una prova: home ufficiale se nota, altrimenti fuori.
 */

import {
  decidiPubblicazione,
  statoLink,
  urlPubblicabile,
  type EsitoPingLink,
  type StatoLink,
} from '../lib/validitaLink.ts';
import { eRecordStrutturato, type CandidatoLink } from './qualitaOpportunita.ts';

/**
 * True se l'avviso va controllato dal vivo: serve un link `http(s)` pubblicabile
 * e il record NON deve essere strutturato (per quelli il ping non è attendibile e
 * la riga entra comunque, com'era prima della §26.104: nessuna regressione).
 */
export function daControllareInIngresso(a: CandidatoLink): boolean {
  return urlPubblicabile(a.link) && !eRecordStrutturato(a);
}

/** Verdetto del presidio per UN avviso. */
export interface EsitoIngressoLink {
  /** false = la riga NON si scrive in `interpelli` (nessun URL vivo da mostrare). */
  accetta: boolean;
  /** URL da pubblicare: quello dell'avviso, la home ufficiale, oppure `null`. */
  link: string | null;
  stato: StatoLink;
  motivo: string;
  /** True quando al posto dell'avviso si pubblica la home `.edu.it` dell'istituto. */
  sostituito: boolean;
  /** True solo se il server ha risposto 2xx/3xx in questo giro. */
  verificato: boolean;
}

/**
 * Decide se l'avviso appena estratto può entrare in bacheca e con QUALE link.
 *
 * `esito` = ciò che il controllo HTTP ha osservato (`verificaLinkHttp.ts`),
 * `null`/assente = link non controllato in questo giro (record strutturato,
 * tetto di richieste raggiunto): un controllo non eseguito non è una prova di
 * morte, quindi la riga resta.
 */
export function valutaIngressoPerLink(
  a: CandidatoLink,
  esito?: EsitoPingLink | null,
  home?: string | null,
): EsitoIngressoLink {
  const link = (a.link ?? '').trim() || null;
  const stato = statoLink(esito);

  // Timeout/DNS/TLS/5xx: nessuna prova di morte, e in ingresso la scelta è
  // irreversibile (upsert con `ignoreDuplicates`). Il link specifico resta; se è
  // davvero morto lo dirà la pulizia dati, che può riprovare e sostituire la home.
  if (stato === 'instabile' && urlPubblicabile(link)) {
    return {
      accetta: true,
      link,
      stato,
      motivo: 'nessuna risposta al controllo: link mantenuto (nessuna prova di morte)',
      sostituito: false,
      verificato: false,
    };
  }

  const decisione = decidiPubblicazione({ link, esito, home });
  return {
    accetta: decisione.azione !== 'scarta',
    link: decisione.url,
    stato: decisione.stato,
    motivo: decisione.motivo,
    sostituito: decisione.azione === 'home-istituzionale',
    verificato: decisione.stato === 'ok',
  };
}
