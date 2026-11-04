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
 *   · home/indice (§26.140) → l'URL NON è un avviso: home dell'istituto, sezione
 *                          di albo/interpelli, archivio, ricerca, contenitore per
 *                          ambito (`eUrlIndicePortale`, `lib/urlAvviso.ts`). La
 *                          riga non si pubblica: in bacheca entra solo l'avviso
 *                          specifico (pagina o PDF), e un contenitore va ESPANSO
 *                          nei suoi atti dall'ingestione, mai salvato com'è;
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
import { homeEduIt } from './dominiScuola';
import { eUrlIndicePortale } from './urlAvviso';

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
 * True se `link` È un avviso SPECIFICO: `http(s)` pubblicabile e non una home,
 * un indice, un archivio, una ricerca o un contenitore per ambito
 * (`eUrlIndicePortale`, l'unica regola condivisa con il tabellone).
 *
 * §26.140 — il filtro anti-homepage: una riga la cui fonte è la home
 * dell'istituto (`polovolta.edu.it`, `istitutocomprensivoperugia3.edu.it`) o la
 * pagina che elenca gli atti (`…/servizio/interpello-nazionale/`) non si
 * pubblica. Non c'è nulla da aprire: la home non è un bando e il contenitore va
 * espanso nei singoli PDF (`scraper/index.ts` → `espandiElenchi`).
 */
export function eUrlAvvisoSpecifico(url?: string | null): boolean {
  return urlPubblicabile(url) && !eUrlIndicePortale(url);
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
  // §26.140 — FILTRO RIGIDO ANTI-HOMEPAGE: prima dell'esito HTTP, perché la
  // destinazione è una proprietà dell'URL e non del server. Una home che risponde
  // `200` resta una home; un contenitore che risponde `200` resta un elenco. Se
  // l'avviso esiste davvero, la sua pagina specifica è un'altra e la sceglie il
  // parser (`scegliUrlFonte`) o l'espansione dell'elenco.
  if (!eUrlAvvisoSpecifico(link)) {
    return {
      azione: 'scarta',
      stato,
      url: null,
      motivo: 'home o pagina indice/contenitore: in bacheca entra solo l’avviso specifico',
    };
  }
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
