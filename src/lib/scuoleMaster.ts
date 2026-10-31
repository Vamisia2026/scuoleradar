/**
 * ScuoleRadar.it — `schools_master`: dal CODICE alla scuola CERTIFICATA (solo-Node).
 *
 * Perché esiste: le tabelle degli UST (Arezzo, Grosseto, …) e gli elenchi delle
 * scuole pubblicano righe che contengono solo un codice meccanografico, un nome
 * abbreviato e — spesso — un link che porta a una piattaforma privata (Argo,
 * Spaggiari, Nuvola) o a un vecchio portale. Perché la riga diventi un avviso
 * apribile servono tre cose che la fonte non dà: il NOME dell'istituto, il suo
 * recapito ufficiale e il DOMINIO ISTITUZIONALE (`*.edu.it`).
 *
 * La verità sta già nell'anagrafica MIM (file SCUANAGRAFE, letta da
 * `lib/anagraficaScuole.ts`: codice → denominazione, PEO/PEC, `SITOWEBSCUOLA`).
 * Questo modulo è la FACCIATA dell'ingestione su quella verità:
 *
 *   `scuolaCertificata(indice, { codice, nome, provincia })`
 *     → nome presentabile, recapiti, host dichiarato e HOME ISTITUZIONALE;
 *   `scuoleDaTesto(indice, testo, provincia)`
 *     → tutte le scuole citate in una pagina/tabella (per il deep crawl);
 *   `homeUfficiale` / `urlVerificabile` / `urlUfficiale`
 *     → dove può portare il click: l'avviso vero, altrimenti la home.
 *
 * REGOLE DICHIARATE
 *  · Si certifica un dominio ISTITUZIONALE dichiarato dall'anagrafica MIM
 *    (`*.edu.it` per primo, poi `.gov.it` e gli altri domini dell'istituto):
 *    `istruzione.it` (caselle di servizio del Ministero), `mim.gov.it`,
 *    `gmail.com` e i provider di posta personale NON sono il sito di un
 *    istituto e valgono `null`. Stessa assunzione di `flightBoard/linkFonte.ts`.
 *  · Un nome ambiguo non produce nulla (`scuolaDaNome` accetta solo l'univoco o
 *    l'unico della provincia indicata): meglio nessuna certificazione che una
 *    sbagliata.
 *  · L'elenco delle piattaforme private è UNO (`lib/piattaformeLink.ts`), condiviso
 *    col tabellone: qui serve a NON scegliere un link di login come `source_url`.
 *
 * **Non è importabile dal browser** (l'anagrafica legge i CSV con `node:fs`).
 * Verificato da `npm run test:scuole-master` (incluso in `npm test`).
 */
import {
  arricchisciDaAnagrafica,
  chiaveCodiceScuola,
  nomeDaAnagrafica,
  sitoIstituzionale,
  type IndiceAnagrafica,
  type ScuolaAnagrafica,
} from './anagraficaScuole';
import { normalizzaCodiceMeccanografico } from './emailScuola';
import { dominioIstituzionale, homeDaSito } from './hostIstituzionale';
import { ePiattaformaPrivata, hostDaUrl } from './piattaformeLink';

/** Scuola risolta sull'anagrafica: la riga d'interpello può nascere completa. */
export interface ScuolaCertificata {
  /** Codice meccanografico (quello della riga se valido, altrimenti quello della sede). */
  codice: string | null;
  /** Nome da MOSTRARE (istituto di riferimento ripulito, altrimenti la sede). */
  nome: string | null;
  istitutoNome: string | null;
  email: string | null;
  pec: string | null;
  /** Host dichiarato dall'anagrafica (`SITOWEBSCUOLA`, senza schema). */
  sito: string | null;
  /** Home ufficiale `https://<host .edu.it>`, altrimenti `null`. */
  home: string | null;
  provincia: string | null;
  comune: string | null;
}

/** Dati con cui si cerca una scuola: basta UNO fra codice e nome. */
export interface RicercaScuola {
  codice?: string | null;
  nome?: string | null;
  provincia?: string | null;
}

/** Dominio `*.edu.it` contenuto in un recapito (PEO/PEC), altrimenti `null`. */
export function dominioEduIt(recapito?: string | null): string | null {
  const trovato = (recapito ?? '')
    .toLowerCase()
    .match(/(?:^|[^a-z0-9._%+-])[a-z0-9._%+-]+@((?:[a-z0-9-]+\.)+edu\.it)\b/);
  return trovato?.[1] ?? null;
}

/**
 * REGOLA DELL'HOST (§26.77 · §26.125) — vive in `lib/hostIstituzionale.ts`: la usano
 * questa facciata e la visura delle scuole di una provincia. Riesportata qui, così gli
 * import esistenti (`scraper/`, guardie) non cambiano.
 */
export { dominioIstituzionale, homeDaSito } from './hostIstituzionale';


/** Home ufficiale dell'istituto, altrimenti `null`. */
export function homeUfficiale(scuola: ScuolaCertificata | null | undefined): string | null {
  return scuola?.home ?? null;
}

/** True se l'URL è `http(s)` e non punta a una piattaforma privata. */
export function urlVerificabile(url?: string | null): boolean {
  return hostDaUrl(url) !== null && !ePiattaformaPrivata(url);
}

/** Riga dell'anagrafica → vista certificata (una sola traduzione dei campi). */
export function certificaScuola(
  indice: IndiceAnagrafica,
  scuola: ScuolaAnagrafica,
  codiceRichiesto: string | null
): ScuolaCertificata {
  const sito = sitoIstituzionale(indice, scuola);
  return {
    codice: chiaveCodiceScuola(codiceRichiesto) ?? chiaveCodiceScuola(scuola.codice) ?? scuola.codice,
    nome: nomeDaAnagrafica(scuola) ?? scuola.nome,
    istitutoNome: scuola.istitutoNome,
    email: scuola.email,
    pec: scuola.pec,
    sito,
    home:
      homeDaSito(sito) ??
      homeDaSito(dominioIstituzionale(scuola.email)) ??
      homeDaSito(dominioIstituzionale(scuola.pec)),
    provincia: scuola.provinciaCodice,
    comune: scuola.comune,
  };
}

/**
 * Scuola CERTIFICATA da codice (preferito) o da nome (`null` se non univoca).
 * Con l'anagrafica non disponibile (CSV assenti) restituisce `null`: l'ingestione
 * continua con i dati grezzi della fonte, senza inventare recapiti.
 */
export function scuolaCertificata(
  indice: IndiceAnagrafica | null | undefined,
  ricerca: RicercaScuola
): ScuolaCertificata | null {
  if (!indice || indice.disponibile === false) return null;
  const esito = arricchisciDaAnagrafica(indice, {
    school_code: ricerca.codice ?? null,
    school_name: ricerca.nome ?? null,
    province: ricerca.provincia ?? null,
  });
  if (!esito.scuola) return null;
  return certificaScuola(indice, esito.scuola, esito.patch.school_code ?? null);
}

/**
 * Tutte le scuole CITATE in un testo (pagina d'albo, tabella UST, elenco),
 * senza duplicati e nell'ordine di comparsa. Serve al deep crawl opportunistico:
 * ogni istituto riconosciuto diventa una fonte candidata (il suo albo pretorio).
 */
export function scuoleDaTesto(
  indice: IndiceAnagrafica | null | undefined,
  testo: string | null | undefined,
  provincia?: string | null
): ScuolaCertificata[] {
  if (!indice || indice.disponibile === false) return [];
  const trovate = new Map<string, ScuolaCertificata>();
  const codici = (testo ?? '').match(/\b[A-Za-z0-9]{10}\b/g) ?? [];
  for (const token of codici) {
    const codice = normalizzaCodiceMeccanografico(token);
    if (!codice || trovate.has(codice)) continue;
    const scuola = scuolaCertificata(indice, { codice, provincia });
    if (scuola) trovate.set(codice, scuola);
  }
  return [...trovate.values()];
}


/**
 * URL con cui identificare un avviso: quello della fonte se è apribile, altrimenti
 * la home ufficiale della scuola. `null` quando non c'è né l'uno né l'altra.
 *
 * NOTA: il chiamante NON deve sostituire un link di piattaforma già presente
 * nella riga (Argo/Nuvola) con la home, perché `source_url` è parte dell'identità
 * dell'avviso (`hash_id`): la sostituzione del click la fa il tabellone con
 * `school_site` + `fonteApribile`. Qui si sceglie l'URL solo quando manca.
 */
export function urlUfficiale(
  url: string | null | undefined,
  scuola: ScuolaCertificata | null | undefined
): string | null {
  const grezzo = (url ?? '').trim();
  if (urlVerificabile(grezzo)) return grezzo;
  return homeUfficiale(scuola);
}
