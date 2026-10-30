/**
 * ScuoleRadar.it — WHITELIST DEI DOMINI ISTITUZIONALI in ingresso (§26.109).
 *
 * Perché esiste: un link raccolto dal crawler o da un post può puntare ovunque —
 * all'articolo di un aggregatore concorrente (`scuolainterpelli.it`,
 * `interpelloweb.it`, `orizzontescuola.it`…), a un post social, a un hosting
 * gratuito o a un modulo Google. Nessuno di questi può diventare «la fonte
 * ufficiale» di un avviso: il tabellone promette il sito della scuola o il portale
 * dell'ufficio scolastico, non la pagina di un terzo che li commenta.
 *
 * Qui vive UNA SOLA regola di ammissione, in ordine di precedenza:
 *   1. il dominio è un AGGREGATORE PRIVATO noto → fuori, sempre
 *      (`AGGREGATORI_PRIVATI`, elenco diagnostico: il divieto vero è il punto 2);
 *   2. il dominio è pubblico italiano per costruzione → ammesso
 *      (`*.edu.it` delle scuole, `*.gov.it` della PA);
 *   3. il dominio è del Ministero o di un suo portale → ammesso
 *      (`istruzione.it`, `*.istruzione.it`: MIM, PNRR, USR su sottodominio);
 *   4. il dominio è uno dei PORTALI UFFICIALI USR/USP/UAT/UST dichiarati nel
 *      registro fonti (`scraper/portaliUfficiali.ts`): molti uffici hanno ancora
 *      un dominio `.it` storico (`istruzionepiemonte.it`, `ustlucca.it`) e sono
 *      istituzionali a tutti gli effetti. L'elenco NON è copiato qui: arriva
 *      dalle fonti verificate HTTP, così non può divergere dal registro.
 * Tutto il resto è fuori — anche quando è un sito di scuola non `.edu.it`
 * (paritaria su dominio proprio): meglio una riga in meno che un link altrui.
 *
 * Modulo PURO: nessuna rete, nessun `node:*` — importabile dal browser e dai test.
 */

import { hostDa } from './dominiScuola';

/** Suffissi pubblici italiani: sono istituzionali per costruzione. */
export const SUFFISSI_ISTITUZIONALI: readonly string[] = ['.edu.it', '.gov.it'];

/** Dominio del Ministero (e dei portali USR/ATP pubblicati su sottodominio). */
export const DOMINIO_MINISTERO = 'istruzione.it';

/**
 * Aggregatori privati concorrenti (e i loro archivi regionali). Elenco
 * DIAGNOSTICO: serve a dire «perché» nel log e nel report. Il blocco effettivo
 * è la whitelist — qualsiasi host non istituzionale è fuori comunque.
 */
export const AGGREGATORI_PRIVATI: readonly string[] = [
  'scuolainterpelli.it',
  'interpelloweb.it',
  'orizzontescuola.it',
  'tecnicadellascuola.it',
  'docenti.it',
  'studenti.it',
  'skuola.net',
  'ilsussidiario.net',
  'tuttoscuola.com',
  'notiziescuola.it',
];

/** Portali ufficiali in più dichiarati dal chiamante (USR/USP/UAT/UST). */
export interface OpzioniDominio {
  readonly portaliUfficiali?: Iterable<string | null | undefined>;
}

/** Verdetto sulla provenienza di un URL: ospite normalizzato e motivo. */
export interface VerdettoDominio {
  /** true = il dominio può entrare nel flusso (fonte, target, link pubblicato). */
  ammesso: boolean;
  /** Host normalizzato (`iccarducci.edu.it`, `www.istruzionepiemonte.it`). */
  host: string | null;
  /** Perché è ammesso o perché è fuori: finisce nei log, mai in pagina. */
  motivo: string;
}

/** `true` se il dominio è un aggregatore privato noto (o un suo sottodominio). */
export function eAggregatorePrivato(valore?: string | null): boolean {
  const host = hostDa(valore);
  if (!host) return false;
  return AGGREGATORI_PRIVATI.some((d) => host === d || host.endsWith(`.${d}`));
}

/** Portale ufficiale fra quelli dichiarati (host pieno o suo sottodominio). */
function portaleUfficiale(
  host: string,
  portali: OpzioniDominio['portaliUfficiali'],
): string | null {
  for (const voce of portali ?? []) {
    const ufficiale = hostDa(voce);
    if (ufficiale && (host === ufficiale || host.endsWith(`.${ufficiale}`))) return ufficiale;
  }
  return null;
}

/**
 * Decide se un URL (o un host nudo) appartiene a un dominio AMMESSO in ingresso.
 * PURA e totale: nessuna eccezione, nessun accesso alla rete, stessa risposta su
 * server e browser.
 */
export function valutaDominio(
  valore?: string | null,
  opzioni: OpzioniDominio = {},
): VerdettoDominio {
  const host = hostDa(valore);
  if (!host) return { ammesso: false, host: null, motivo: 'host assente o illeggibile' };
  if (eAggregatorePrivato(host)) {
    return { ammesso: false, host, motivo: `aggregatore privato concorrente (${host})` };
  }
  for (const suffisso of SUFFISSI_ISTITUZIONALI) {
    if (host.endsWith(suffisso)) {
      return { ammesso: true, host, motivo: `dominio pubblico ${suffisso}` };
    }
  }
  if (host === DOMINIO_MINISTERO || host.endsWith(`.${DOMINIO_MINISTERO}`)) {
    return { ammesso: true, host, motivo: `portale del Ministero (${DOMINIO_MINISTERO})` };
  }
  const portale = portaleUfficiale(host, opzioni.portaliUfficiali);
  if (portale) {
    return { ammesso: true, host, motivo: `portale ufficiale USR/ATP (${portale})` };
  }
  return { ammesso: false, host, motivo: `dominio non istituzionale (${host})` };
}

/** Scorciatoia booleana della regola (stessa implementazione, un solo punto). */
export function eDominioIstituzionale(
  valore?: string | null,
  opzioni: OpzioniDominio = {},
): boolean {
  return valutaDominio(valore, opzioni).ammesso;
}
