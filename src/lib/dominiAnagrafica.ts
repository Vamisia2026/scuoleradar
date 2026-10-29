/**
 * ScuoleRadar.it — MAPPA DEI DOMINI dalle SCUANAGRAFE (superficie solo-Node).
 *
 * Secondo pezzo del modulo dei domini: legge l'INDICE dell'anagrafica MIM
 * (`lib/anagraficaScuole.ts` → file SCUANAGRAFE) e ne ricava la mappa
 * `codice meccanografico → host *.edu.it` ufficiale. La regola di riconoscimento
 * del dominio sta in `lib/dominiScuola.ts` (modulo puro), qui c'è solo il ponte
 * con i file del Ministero.
 *
 * Due dettagli che il file ministeriale impone:
 *   · il sito dichiarato dalla SEDE vince su quello dell'istituto (è più preciso);
 *   · il sito dell'ISTITUTO vale anche per i plessi che non dichiarano nulla — il
 *     file non è coerente al suo interno (§26.77: «Non Disponibile» sulla riga
 *     dell'istituto, sito vero sulle sue sedi).
 *
 * La mappa si costruisce UNA volta per indice (i file pesano ~13 MB e gli avvisi
 * sono decine di migliaia: mai un ricalcolo per riga) e vive in una `WeakMap`,
 * così non trattiene in memoria un indice che il chiamante ha già scartato.
 */
import { chiaveCodiceScuola, type IndiceAnagrafica } from './anagraficaScuole';
import {
  costruisciMappaDomini,
  dominioDaCodice,
  homeDaCodice,
  type MappaDomini,
  type VoceDominio,
} from './dominiScuola';

/** Voci di dominio dell'indice, nell'ordine di priorità (sede → istituto → sede). */
function* vociDominio(indice: IndiceAnagrafica): Generator<VoceDominio> {
  for (const scuola of indice.perCodice.values()) {
    // 1) Il dominio che la riga dichiara per sé.
    yield { codice: scuola.codice, sito: scuola.sitoWeb };
    const chiaveIstituto =
      chiaveCodiceScuola(scuola.istitutoCodice) ?? chiaveCodiceScuola(scuola.codice);
    if (!chiaveIstituto) continue;
    const sitoIstituto = indice.sitoPerIstituto.get(chiaveIstituto) ?? null;
    if (!sitoIstituto) continue;
    // 2) Il dominio dell'ISTITUTO, registrato sul codice d'istituto.
    yield { codice: chiaveIstituto, sito: sitoIstituto };
    // 3) Ereditato dalla sede che non ne ha uno proprio (primo vince).
    yield { codice: scuola.codice, sito: sitoIstituto };
  }
}

const cache = new WeakMap<IndiceAnagrafica, MappaDomini>();

/** Mappa `codice → host *.edu.it` dell'anagrafica (calcolata una volta per indice). */
export function mappaDominiDaAnagrafica(indice: IndiceAnagrafica): MappaDomini {
  const gia = cache.get(indice);
  if (gia) return gia;
  const mappa = costruisciMappaDomini(vociDominio(indice));
  cache.set(indice, mappa);
  return mappa;
}

/** Dominio ufficiale del codice secondo l'anagrafica MIM, altrimenti `null`. */
export function dominioUfficialeDaCodice(
  indice: IndiceAnagrafica | null | undefined,
  codice?: string | null,
): string | null {
  if (!indice?.disponibile) return null;
  return dominioDaCodice(mappaDominiDaAnagrafica(indice), codice);
}

/** Home ufficiale (`https://<dominio>`) del codice, altrimenti `null`. */
export function homeUfficialeDaCodice(
  indice: IndiceAnagrafica | null | undefined,
  codice?: string | null,
): string | null {
  if (!indice?.disponibile) return null;
  return homeDaCodice(mappaDominiDaAnagrafica(indice), codice);
}
