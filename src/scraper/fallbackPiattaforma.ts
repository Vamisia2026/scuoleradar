/**
 * ScuoleRadar.it — VICOLO CIECO SU UNA PIATTAFORMA: da dove ripartire (§26.96).
 *
 * Perché esiste: alcune fonti non linkano l'albo della scuola ma la sua BACHECA
 * su piattaforma — `…portaleargo.it/…`, `web.spaggiari.eu/home/app.wp`,
 * `…gecodoc.it/…`. Quando quella bacheca è vuota, scaduta o chiusa dal login, il
 * giro non ha nulla da leggere e il target verrebbe disattivato: eppure la
 * scuola è viva e pubblica gli interpelli sul PROPRIO sito.
 *
 * LA REGOLA (una sola, dichiarata)
 *  1. la pagina deve stare su una piattaforma scolastica
 *     (`lib/piattaformeLink.PIATTAFORME_SCOLASTICHE`);
 *  2. deve essere un VICOLO CIECO: nessun avviso letto, oppure i marcatori di
 *     bacheca vuota / muro di credenziali («effettua il login», «nessun
 *     avviso», «non ci sono comunicazioni»…);
 *  3. deve dichiarare il CODICE MECCANOGRAFICO della scuola — nell'host
 *     (`rmic81200p.gecodoc.it`), nel percorso o in un parametro (`?scuola=…`).
 *     Senza codice NON si indovina nulla: la provincia non basta a scegliere una
 *     scuola, e un fallback sbagliato è peggio di un vicolo cieco dichiarato.
 *
 * Chi usa questa regola (`scripts/table-reporter.ts`) risolve il codice su
 * `schools_master` (`lib/scuoleMaster.ts`) e punta l'ALBO della home
 * istituzionale: stessa certificazione, stessa scadenza dichiarata, nessun URL
 * costruito a mano. Qui non c'è rete e non c'è database: solo decisioni.
 *
 * Guardia: `npm run test:piattaforme-documentali` (incluso in `npm test`).
 */

import { piattaformaScolastica, type PiattaformaScolastica } from '../lib/piattaformeLink.ts';
import { provinciaDaCodice } from '../lib/scanTargets.ts';

/** Codice meccanografico: due lettere di provincia, due di tipo, 5 cifre, una lettera. */
const RE_MECCANOGRAFICO = /\b([A-Z]{2})([A-Z]{2})(\d{5})([A-Z])\b/g;

/**
 * Marcatori di una pagina che NON contiene avvisi: portale chiuso dalle
 * credenziali o archivio vuoto. Sono stringhe che una bacheca piena non scrive.
 */
const RE_BACHECA_VUOTA =
  /effettua\s+(?:il\s+)?login|accedi\s+(?:al|con)|inserisci\s+le\s+(?:tue\s+)?credenziali|area\s+riservata|password|non\s+ci\s+sono\s+(?:avvisi|comunicazioni|elementi|documenti)|nessun\s+(?:avviso|documento|risultat|element)|al\s+momento\s+non\s+(?:sono\s+presenti|ci\s+sono)|archivio\s+vuoto|pagina\s+non\s+trovata|404\s+not\s+found/i;

/** True se l'URL sta su una piattaforma scolastica riconosciuta. */
export function ePiattaformaScolastica(url?: string | null): boolean {
  return piattaformaScolastica(url) !== null;
}

/**
 * Codice meccanografico DICHIARATO dall'URL (host, percorso o parametri), con la
 * provincia validata sul catalogo condiviso: `null` se l'URL non lo contiene.
 */
export function codiceDaUrlPiattaforma(url?: string | null): string | null {
  const testo = (url ?? '').trim();
  if (!testo) return null;
  let parsed: URL;
  try {
    parsed = new URL(testo);
  } catch {
    return null;
  }
  let href: string;
  try {
    href = decodeURIComponent(`${parsed.hostname} ${parsed.pathname} ${parsed.search}`);
  } catch {
    href = `${parsed.hostname} ${parsed.pathname} ${parsed.search}`;
  }
  for (const m of href.toUpperCase().matchAll(RE_MECCANOGRAFICO)) {
    if (provinciaDaCodice(m[1])) return `${m[1]}${m[2]}${m[3]}${m[4]}`;
  }
  return null;
}

/**
 * True se la pagina è un vicolo cieco: HTML vuoto, muro di credenziali o bacheca
 * dichiarata vuota. Non guarda gli host (lo fa `meritaFallback`).
 */
export function bachecaSenzaAvvisi(html: string): boolean {
  const testo = (html ?? '').trim();
  if (testo === '') return true;
  return RE_BACHECA_VUOTA.test(testo);
}

/** Esito della decisione: se `attivo`, il `codice` è la scuola da rileggere. */
export interface DecisioneFallback {
  attivo: boolean;
  piattaforma: PiattaformaScolastica | null;
  codice: string | null;
  /** Perché si è deciso così (log del runner: nessun motivo inventato). */
  motivo: string;
}

/**
 * Il caso che merita il fallback: piattaforma scolastica **e** vicolo cieco
 * (`avvisiLetti` = voci d'interpello già estratte da quella pagina).
 */
export function meritaFallback(
  url: string,
  html: string,
  avvisiLetti = 0,
): DecisioneFallback {
  const piattaforma = piattaformaScolastica(url);
  if (!piattaforma) {
    return { attivo: false, piattaforma: null, codice: null, motivo: 'non è una piattaforma' };
  }
  const codice = codiceDaUrlPiattaforma(url);
  if (avvisiLetti > 0) {
    return { attivo: false, piattaforma, codice, motivo: 'la bacheca pubblica avvisi' };
  }
  const motivo = bachecaSenzaAvvisi(html) ? 'bacheca vuota o muro di login' : 'nessun avviso leggibile';
  if (!codice) {
    return { attivo: false, piattaforma, codice: null, motivo: `${motivo}: nessun codice meccanografico` };
  }
  return { attivo: true, piattaforma, codice, motivo };
}
