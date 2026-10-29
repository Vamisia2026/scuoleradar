/**
 * ScuoleRadar.it — VALIDITÀ DI UN LINK prima della pubblicazione (modulo PURO).
 *
 * Perché esiste: il tabellone mostra solo link apribili, ma nessuno può accorgersi
 * in pagina che un avviso è diventato un 404. Il controllo va fatto PRIMA di
 * marcare la riga come pronta per la bacheca pubblica — nella pipeline di pulizia
 * (`scripts/pulisci-dati-non-verificati.ts`) — con un `HEAD`/`GET` leggero.
 *
 * Questo modulo non tocca la rete: riceve l'ESITO grezzo del controllo
 * (`status` HTTP oppure il motivo del fallimento) e decide. Così la regola è
 * verificabile offline e identica per pulizia, cron e test.
 *
 * Politica (direttiva «niente link morti sulla board»):
 *   · `ok`               → la riga resta, il click porta all'avviso;
 *   · `bloccato`         → il server rifiuta i client automatici (401/403/405/429):
 *                          NON è un link morto, la riga resta;
 *   · `assente` (404/410)→ l'avviso non esiste più: si pubblica la home ufficiale
 *                          `.edu.it` dell'istituto (`sito-scuola`), se nota;
 *   · `instabile`        → timeout, DNS, TLS, 5xx: nessuna prova che la pagina sia
 *                          leggibile → stessa regola del caso precedente;
 *   · nessuna home ufficiale → la riga NON si pubblica (meglio una riga in meno
 *                          che una riga che promette un avviso e apre un errore);
 *   · link mai controllato (nessun esito) → la riga resta: un controllo non
 *                          eseguito non è una prova di morte.
 */
import { hostEduIt, homeEduIt } from './dominiScuola';

/** Esito sintetico del controllo di un link. */
export type StatoLink = 'ok' | 'assente' | 'instabile' | 'bloccato' | 'non-verificabile';

/** Motivo per cui la richiesta non ha prodotto una risposta HTTP. */
export type ErroreReteLink = 'timeout' | 'dns' | 'tls' | 'rete';

/** Ciò che il controllo (`HEAD` con fallback `GET`) ha osservato. */
export interface EsitoPingLink {
  /** Codice HTTP, quando il server ha risposto. */
  status?: number | null;
  /** Motivo del fallimento, quando NON c'è stata risposta. */
  errore?: ErroreReteLink | null;
}

/** Codici 4xx che significano «il server non serve i client automatici», non «pagina sparita». */
const STATUS_BLOCCATI: readonly number[] = [401, 403, 405, 406, 429, 451];

/** Classificazione dell'esito di un controllo: la regola sta in un punto solo. */
export function statoLink(esito?: EsitoPingLink | null): StatoLink {
  if (!esito) return 'non-verificabile';
  if (esito.errore) return 'instabile';
  const status = esito.status ?? null;
  if (status === null || !Number.isFinite(status)) return 'non-verificabile';
  if (status < 400) return 'ok';
  if (status === 404 || status === 410) return 'assente';
  if (STATUS_BLOCCATI.includes(status)) return 'bloccato';
  // 5xx e i 4xx non riconosciuti: nessuna prova che la pagina sia servita.
  return 'instabile';
}

/** Cosa fare della riga: tenere l'avviso, sostituirlo con la home, scartarlo. */
export type AzioneLink = 'tieni' | 'home-istituzionale' | 'scarta';

/** Decisione di pubblicazione per UNA riga. */
export interface DecisioneLink {
  azione: AzioneLink;
  stato: StatoLink;
  /** URL da pubblicare: l'avviso, la home `.edu.it`, oppure `null` (riga fuori). */
  url: string | null;
  /** Perché: il motivo finisce nel report della pulizia, mai in pagina. */
  motivo: string;
}

/** True se l'URL è `http(s)` (unica forma pubblicabile dal tabellone). */
export function urlPubblicabile(url?: string | null): boolean {
  const testo = (url ?? '').trim();
  if (!/^https?:\/\//i.test(testo)) return false;
  try {
    const parsed = new URL(testo);
    return parsed.hostname.length > 0;
  } catch {
    return false;
  }
}

/**
 * True se `link` È già la home ufficiale `home`: stesso host `.edu.it` e nessun
 * percorso (né query/ancora). La sola uguaglianza di host NON basta — un avviso
 * pubblicato su `www.iccarducci.edu.it/albo/…` non è la homepage dell'istituto.
 */
function eLaHomeUfficiale(link: string, home: string): boolean {
  if (!hostEduIt(link) || hostEduIt(link) !== hostEduIt(home)) return false;
  try {
    const { pathname, search, hash } = new URL(link);
    return (pathname === '' || pathname === '/') && !search && !hash;
  } catch {
    return false;
  }
}

/**
 * Decide se una riga può essere pubblicata e, se serve, con QUALE link.
 * `esito` assente = link non controllato in questo giro (la riga resta).
 */
export function decidiPubblicazione(opts: {
  link?: string | null;
  esito?: EsitoPingLink | null;
  /** Home ufficiale `.edu.it` dell'istituto, se nota. */
  home?: string | null;
}): DecisioneLink {
  const link = (opts.link ?? '').trim() || null;
  const home = homeEduIt(opts.home);
  if (!link || !urlPubblicabile(link)) {
    return {
      azione: 'scarta',
      stato: 'non-verificabile',
      url: null,
      motivo: 'nessun link http(s) da pubblicare',
    };
  }
  const stato = statoLink(opts.esito);
  if (stato === 'ok' || stato === 'non-verificabile') {
    return {
      azione: 'tieni',
      stato,
      url: link,
      motivo: stato === 'ok' ? 'link raggiungibile' : 'link non controllato',
    };
  }
  if (stato === 'bloccato') {
    return {
      azione: 'tieni',
      stato,
      url: link,
      motivo: 'il server rifiuta i client automatici: il link può essere vivo',
    };
  }
  if (home) {
    if (eLaHomeUfficiale(link, home)) {
      // Il link È già la home ufficiale: non c'è niente di meglio da pubblicare.
      return { azione: 'tieni', stato, url: link, motivo: 'è la home ufficiale dell’istituto' };
    }
    return {
      azione: 'home-istituzionale',
      stato,
      url: home,
      motivo:
        stato === 'assente'
          ? 'avviso non più raggiungibile (404/410): si pubblica la home ufficiale'
          : 'nessuna risposta utile (timeout/errore): si pubblica la home ufficiale',
    };
  }
  return {
    azione: 'scarta',
    stato,
    url: null,
    motivo:
      stato === 'assente'
        ? 'avviso non più raggiungibile (404/410) e nessuna home ufficiale'
        : 'link non raggiungibile e nessuna home ufficiale',
  };
}
