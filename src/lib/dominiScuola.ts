/**
 * ScuoleRadar.it — DOMINI ISTITUZIONALI delle scuole (`codice → *.edu.it`).
 *
 * Perché esiste: il link di un avviso è la parte più fragile della riga. Le fonti
 * pubblicano indirizzi di PIATTAFORMA o «trampolino» — Argo/Nuvola (login), moduli
 * Google Drive/Forms, redirect di terze parti — che dopo pochi giorni chiedono le
 * credenziali o muoiono. Il dominio ufficiale dell'istituto (`*.edu.it`, quello
 * dell'anagrafica MIM) invece resta: è l'unico indirizzo che possiamo pubblicare
 * senza smentirci.
 *
 * Qui vive UNA SOLA regola di riconoscimento/normalizzazione di quel dominio e la
 * mappa `codice meccanografico → host`, così i tre strati che ne hanno bisogno
 * parlano la stessa lingua:
 *   · estrazione (`scraper/anagraficaInterpelli.ts`), che scrive `school_site`;
 *   · pulizia/validazione pre-pubblicazione (`scripts/pulisci-dati-non-verificati.ts`),
 *     che riempie il sito mancante delle righe storiche;
 *   · tabellone (`departments/radar/flightBoard/linkFonte.ts`), che sostituisce il
 *     click con la home `https://<dominio>`.
 *
 * Modulo PURO: nessun `node:*`, nessuna rete, importabile anche dal browser. La
 * costruzione della mappa dai file SCUANAGRAFE (che legge il disco) sta in
 * `lib/dominiAnagrafica.ts`.
 */
import { normalizzaCodiceMeccanografico } from './emailScuola';

/** Dominio `*.edu.it`, senza `www.`, senza schema e senza percorso. */
const RE_HOST_EDU_IT = /^(?:[a-z0-9-]+\.)+edu\.it$/;

/**
 * HOST `*.edu.it` contenuto in un URL, in un host nudo o in un recapito.
 *
 * Resta solo il dominio nudo (minuscolo, senza `www.`, senza porta e senza punto
 * finale): la home si compone in un punto solo e un percorso pubblicato
 * dall'anagrafica può essere vecchio. Tutto il resto vale `null` — `istruzione.it`
 * è una casella di servizio del Ministero, `gmail.com` un indirizzo personale,
 * `icmanzoniadr.it` un dominio storico che il tabellone non può usare.
 */
export function hostEduIt(valore?: string | null): string | null {
  const testo = (valore ?? '').trim().toLowerCase();
  if (!testo) return null;
  // Un recapito (`segreteria@iccarducci.edu.it`) → conta il dominio dopo la chiocciola.
  const dopoChiocciola = testo.includes('@') ? testo.slice(testo.lastIndexOf('@') + 1) : testo;
  const host = dopoChiocciola
    // Schema anche malformato: il file ministeriale scrive `https//host/`.
    .replace(/^[a-z][a-z0-9+.-]*:?\/\//, '')
    .split(/[/?#]/)[0]
    .replace(/:\d+$/, '')
    // Punteggiatura incollata («<segreteria@ic.edu.it>», «;»): non fa parte dell'host.
    .replace(/^[^a-z0-9]+/, '')
    .replace(/[^a-z0-9.-]+$/, '')
    .replace(/\.+$/, '')
    .replace(/^www\./, '');
  return RE_HOST_EDU_IT.test(host) ? host : null;
}

/** Home ufficiale (`https://<dominio>`) da un dominio o da un valore che lo contiene. */
export function homeEduIt(valore?: string | null): string | null {
  const host = hostEduIt(valore);
  return host ? `https://${host}` : null;
}

/** Mappa `codice meccanografico → host *.edu.it` ufficiale dell'istituto. */
export type MappaDomini = ReadonlyMap<string, string>;

/** Riga di anagrafica da cui si ricava il dominio (sede, plesso o istituto). */
export interface VoceDominio {
  codice?: string | null;
  /** `CODICEISTITUTORIFERIMENTO`: il dominio vale per TUTTE le sue sedi. */
  istitutoCodice?: string | null;
  /** `SITOWEBSCUOLA` (host o URL): si tiene solo se è `*.edu.it`. */
  sito?: string | null;
}

/**
 * Costruisce la mappa dai domini dichiarati. «Primo vince»: l'ordine delle voci è
 * la priorità (il chiamante mette prima la sede e poi l'istituto), così un dominio
 * già registrato non viene sovrascritto da una riga meno pertinente.
 * Le voci senza `*.edu.it` non entrano: meglio nessuna home che un dominio altrui.
 */
export function costruisciMappaDomini(voci: Iterable<VoceDominio>): MappaDomini {
  const mappa = new Map<string, string>();
  const registra = (codice: string | null, host: string | null): void => {
    if (!codice || !host || mappa.has(codice)) return;
    mappa.set(codice, host);
  };
  for (const voce of voci) {
    const host = hostEduIt(voce.sito);
    if (!host) continue;
    registra(normalizzaCodiceMeccanografico(voce.codice), host);
    // Il dominio dell'istituto vale anche per i plessi che non dichiarano nulla.
    registra(normalizzaCodiceMeccanografico(voce.istitutoCodice), host);
  }
  return mappa;
}

/** Dominio ufficiale del codice meccanografico (sede o istituto), altrimenti `null`. */
export function dominioDaCodice(
  mappa: MappaDomini | null | undefined,
  codice?: string | null,
): string | null {
  const chiave = normalizzaCodiceMeccanografico(codice);
  if (!mappa || !chiave) return null;
  return mappa.get(chiave) ?? null;
}

/** Home ufficiale del codice meccanografico (`https://<dominio>`), altrimenti `null`. */
export function homeDaCodice(
  mappa: MappaDomini | null | undefined,
  codice?: string | null,
): string | null {
  const dominio = dominioDaCodice(mappa, codice);
  return dominio ? `https://${dominio}` : null;
}

/**
 * Diagnostica della mappa: quanti codici hanno un dominio ufficiale e quanti
 * domini distinti sono coinvolti (gli istituti ne condividono uno con le sedi).
 */
export function statisticheMappa(mappa: MappaDomini | null | undefined): {
  codici: number;
  domini: number;
} {
  if (!mappa) return { codici: 0, domini: 0 };
  return { codici: mappa.size, domini: new Set(mappa.values()).size };
}
