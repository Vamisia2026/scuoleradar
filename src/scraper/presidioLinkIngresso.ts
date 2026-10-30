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
 * aggiunge tre cose che la pulizia non ha:
 *   0. `valutaDominio` (§26.109): il link di un avviso deve stare su un dominio
 *      ISTITUZIONALE (`.edu.it`, `.gov.it`, MIM/USR/ATP). Un aggregatore
 *      concorrente non viene mai pubblicato: se l'istituto ha una home ufficiale
 *      si pubblica quella, altrimenti la riga resta fuori;
 *   1. `daControllareInIngresso`: i record STRUTTURATI (classe/materia + email di
 *      candidatura) non si pingano — un server scolastico risponde `403` a un bot
 *      qualunque sia lo stato del bando, quindi la richiesta è solo rumore;
 *   2. `instabile` ≠ `assente`: in ingresso un timeout/5xx NON prova che l'avviso
 *      sia morto e l'upsert è `ignoreDuplicates`, cioè irreversibile — il link
 *      specifico resta e la decisione (con nuovo tentativo) la prende la pulizia.
 *      Un `404`/`410` invece è una prova: home ufficiale se nota, altrimenti fuori.
 */

import {
  decidiPubblicazione,
  statoLink,
  urlPubblicabile,
  type EsitoPingLink,
  type StatoLink,
} from '../lib/validitaLink.ts';
import { homeEduIt } from '../lib/dominiScuola.ts';
import { eDominioIstituzionale, type OpzioniDominio } from '../lib/dominiIstituzionali.ts';
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
 * `dominio` = portali ufficiali MIM/USR/ATP del registro fonti
 * (`scraper/portaliUfficiali.ts`): senza, valgono solo i suffissi pubblici.
 */
export function valutaIngressoPerLink(
  a: CandidatoLink,
  esito?: EsitoPingLink | null,
  home?: string | null,
  dominio: OpzioniDominio = {},
): EsitoIngressoLink {
  const link = (a.link ?? '').trim() || null;
  const stato = statoLink(esito);

  // GATE 0 — SOLO DOMINI ISTITUZIONALI (§26.109). Un link che punta a un
  // aggregatore concorrente (o a un social, a un hosting, a un modulo) non entra
  // in bacheca: si pubblica la home `.edu.it` dell'istituto se la conosciamo,
  // altrimenti la riga resta fuori. Il controllo vale sui link `http(s)`
  // pubblicabili: un `mailto:` o un link assente seguono la via di sempre.
  if (link && urlPubblicabile(link) && !eDominioIstituzionale(link, dominio)) {
    const ufficiale = homeEduIt(home);
    return {
      accetta: Boolean(ufficiale),
      link: ufficiale,
      stato: 'non-verificabile',
      motivo: ufficiale
        ? 'link su dominio non istituzionale: si pubblica la home ufficiale'
        : 'link su dominio non istituzionale e nessuna home ufficiale',
      sostituito: Boolean(ufficiale),
      verificato: false,
    };
  }

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
