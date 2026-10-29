/**
 * ScuoleRadar.it — CONTROLLO HTTP di un link prima della pubblicazione.
 *
 * Perché esiste: la pulizia dei dati (`scripts/pulisci-dati-non-verificati.ts`) e
 * l'ingestione devono sapere, PRIMA di mandare una riga in bacheca, se il suo link
 * risponde. Il controllo è `HEAD` (leggero) con fallback `GET` sui server che non
 * servono `HEAD`, con timeout corto e UA da browser: mai un download completo.
 *
 * L'esito NON è un verdetto (molti server scolastici rispondono 403/timeout ai
 * client automatici): qui si restituisce il DATO (`status` o motivo del
 * fallimento) e la decisione resta a `lib/validitaLink.ts`, che è puro e quindi
 * verificabile offline. Una sola regola per cron, script di pulizia e ingestione.
 */
import axios from 'axios';
import type { ErroreReteLink, EsitoPingLink } from '../lib/validitaLink';

/** Timeout «leggero» di default: oltre, il link non serve una bacheca. */
export const TIMEOUT_PING_MS = 6_000;

/** UA da browser: alcuni WAF rispondono 403 ai client che si dichiarano script. */
const UA_BROWSER =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';

const ACCETTA = 'text/html,application/xhtml+xml,application/pdf;q=0.9,*/*;q=0.8';

const CODICI_TIMEOUT = ['ECONNABORTED', 'ETIMEDOUT', 'ESOCKETTIMEDOUT', 'ERR_CANCELED'];
const CODICI_DNS = ['ENOTFOUND', 'EAI_AGAIN', 'EAI_NONAME', 'EAI_FAIL'];
const CODICI_TLS = [
  'CERT_HAS_EXPIRED',
  'DEPTH_ZERO_SELF_SIGNED_CERT',
  'SELF_SIGNED_CERT_IN_CHAIN',
  'UNABLE_TO_VERIFY_LEAF_SIGNATURE',
  'ERR_TLS_CERT_ALTNAME_INVALID',
];

/** Opzioni del controllo (le stesse per HEAD e GET). */
export interface OpzioniPingLink {
  timeoutMs?: number;
  maxRedirects?: number;
  userAgent?: string;
  /** Quanti link controllare in parallelo (default 8). */
  concorrenza?: number;
}

/** `status` HTTP oppure motivo del fallimento: la forma attesa da `validitaLink`. */

/** Codice di errore Node/axios → motivo sintetico (mai un'eccezione al chiamante). */
function motivoErrore(errore: unknown): ErroreReteLink {
  const codice = String((errore as { code?: unknown })?.code ?? '');
  if (CODICI_TIMEOUT.includes(codice)) return 'timeout';
  if (CODICI_DNS.includes(codice)) return 'dns';
  if (CODICI_TLS.includes(codice) || codice.startsWith('ERR_TLS')) return 'tls';
  return 'rete';
}

/** Configurazione axios comune: nessuna eccezione sugli status, niente download. */
function configurazione(opts: OpzioniPingLink) {
  return {
    timeout: opts.timeoutMs ?? TIMEOUT_PING_MS,
    maxRedirects: opts.maxRedirects ?? 5,
    // Lo status è un DATO: lo interpreta `statoLink`, non axios.
    validateStatus: () => true,
    headers: {
      'User-Agent': opts.userAgent ?? UA_BROWSER,
      Accept: ACCETTA,
      'Accept-Language': 'it-IT,it;q=0.9,en;q=0.6',
    },
  };
}

/** Una singola richiesta: `status` se il server ha risposto, altrimenti il motivo. */
async function richiesta(
  url: string,
  metodo: 'head' | 'get',
  opts: OpzioniPingLink,
): Promise<EsitoPingLink> {
  const config = configurazione(opts);
  try {
    const risposta =
      metodo === 'head'
        ? await axios.head(url, config)
        : // `arraybuffer` senza consumarlo: si vuole la risposta, non il contenuto.
          await axios.get(url, { ...config, responseType: 'arraybuffer' });
    return { status: risposta.status, errore: null };
  } catch (errore) {
    const status = (errore as { response?: { status?: number } })?.response?.status ?? null;
    if (status) return { status, errore: null };
    return { status: null, errore: motivoErrore(errore) };
  }
}

/**
 * Controlla UN link: `HEAD` e, se il metodo non è servito (405/501), se il server
 * blocca i client automatici (403) o se non c'è stata risposta, riprova con `GET`.
 * Un 404/410/5xx del `HEAD` è già la risposta del server: nessun secondo giro.
 */
export async function pingoLink(url: string, opts: OpzioniPingLink = {}): Promise<EsitoPingLink> {
  const testa = await richiesta(url, 'head', opts);
  const riprova =
    testa.status === null || testa.status === 403 || testa.status === 405 || testa.status === 501;
  if (!riprova) return testa;
  return richiesta(url, 'get', opts);
}

/**
 * Controlla più link a lotti: N richieste non sono N attese. Ritorna una mappa
 * URL → esito (le URL ripetute sono controllate una volta sola).
 */
export async function verificaLinkInLotti(
  urls: ReadonlyArray<string | null | undefined>,
  opts: OpzioniPingLink = {},
): Promise<Map<string, EsitoPingLink>> {
  const unici = [...new Set(urls.map((u) => (u ?? '').trim()).filter((u) => u.length > 0))];
  const concorrenza = Math.max(1, opts.concorrenza ?? 8);
  const esiti = new Map<string, EsitoPingLink>();
  for (let i = 0; i < unici.length; i += concorrenza) {
    const lotto = unici.slice(i, i + concorrenza);
    const risultati = await Promise.all(lotto.map((url) => pingoLink(url, opts)));
    lotto.forEach((url, indice) => esiti.set(url, risultati[indice] ?? { status: null, errore: 'rete' }));
  }
  return esiti;
}
