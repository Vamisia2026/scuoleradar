/**
 * ScuoleRadar.it — LE SCUOLE DI UNA PROVINCIA (modulo PURO, §26.125).
 *
 * Estratto da `lib/scuoleMaster` il 31/10/2026 (il file era oltre il tetto di 300
 * righe del gate strutturale). È la risposta a una domanda diversa da «certifica
 * QUESTA scuola»: **quali scuole esistono in una provincia ed entrano in un giro
 * di lettura**. La certificazione della singola riga resta in `scuoleMaster`
 * (`certificaScuola`), la regola dell'host in `hostIstituzionale`.
 *
 * PERCHÉ ESISTE. Fino al 31/10/2026 il deep crawl visitava solo gli istituti
 * **citati** dalle tabelle USR del giro (`table-reporter` → `result.scuole`): una
 * provincia con 52 istituti ne vedeva visitare due o tre, e tutto ciò che le altre
 * scuole pubblicavano nel proprio albo non entrava mai. Il Radar sembrava fermo su
 * cinque fonti centrali.
 *
 * REGOLE DICHIARATE
 *  · si certificano TUTTE le righe della provincia (sedi e plessi), poi si tiene
 *    UNA voce per ISTITUTO — e, se due istituti condividono lo stesso sito
 *    (omnicomprensivi), UNA voce per HOME: visitare otto volte lo stesso sito è
 *    rete sprecata senza una riga in più;
 *  · conta solo il SITO DICHIARATO dall'anagrafica (`SITOWEBSCUOLA`): il ripiego sul
 *    dominio della PEO/PEC — utile al link del tabellone — non è una casa da
 *    visitare (un provider di PEC non è una scuola);
 *  · a parità di istituto vince il dominio `*.edu.it`, quello riconosciuto dal MIM;
 *  · l'ordine è per codice meccanografico, quindi deterministico fra due giri;
 *  · una scuola senza sito dichiarato non è raggiungibile e finisce in `senzaSito` —
 *    nessuna URL costruita a mano;
 *  · le scuole PARITARIE restano fuori di serie (`paritarie: true` le include): un
 *    asilo privato non pubblica interpelli per classe di concorso, e su una
 *    provincia sono metà delle righe e nessuna fonte;
 *  · `max` limita il numero di HOME visitate (0/assente = nessun tetto).
 * Con l'anagrafica non disponibile torna un esito vuoto: chi chiama prosegue.
 */
import type { IndiceAnagrafica } from './anagraficaIndice';
import { sitoIstituzionale } from './anagraficaScuole';
import { homeDaSito } from './hostIstituzionale';
import { certificaScuola, type ScuolaCertificata } from './scuoleMaster';

/** Le scuole raggiungibili di una provincia: la materia del deep crawl mirato. */
export interface ScuoleProvincia {
  /** Codice della provincia richiesta (`'AT'`). */
  provincia: string;
  /** Una voce per HOME distinta, in ordine di codice meccanografico. */
  scuole: ScuolaCertificata[];
  /** Righe d'anagrafica della provincia SENZA sito dichiarato (non raggiungibili). */
  senzaSito: number;
  /** Righe d'anagrafica della provincia lette (sedi e plessi). */
  righe: number;
  /** Righe di scuole PARITARIE saltate (di serie: non pubblicano interpelli). */
  paritarie: number;
}

/**
 * Scuole certificate di UNA provincia, con la loro HOME istituzionale.
 * Le regole sono quelle dell'intestazione: qui c'è solo l'applicazione.
 */
export function scuoleDellaProvincia(
  indice: IndiceAnagrafica | null | undefined,
  provincia: string,
  opts: { max?: number; paritarie?: boolean } = {}
): ScuoleProvincia {
  const codice = (provincia ?? '').trim().toUpperCase();
  const esito: ScuoleProvincia = {
    provincia: codice,
    scuole: [],
    senzaSito: 0,
    righe: 0,
    paritarie: 0,
  };
  if (!indice || indice.disponibile === false || !codice) return esito;

  const righe = [...indice.perCodice.values()]
    .filter((scuola) => (scuola.provinciaCodice ?? '').trim().toUpperCase() === codice)
    .sort((a, b) => a.codice.localeCompare(b.codice));
  esito.righe = righe.length;
  // LE PARITARIE, DI SERIE, RESTANO FUORI: un asilo nido/materna privato non pubblica
  // interpelli per classe di concorso — su una provincia sono metà delle righe e
  // nessuna fonte. `paritarie: true` le include (serve solo a una visura manuale).
  const conParitarie = opts.paritarie === true;

  // UNA SCUOLA = UN SITO DICHIARATO (§26.125). Si usa SOLO il sito dell'anagrafica
  // (`SITOWEBSCUOLA`, anche quello comune ai plessi dello stesso istituto): il ripiego
  // sul dominio della PEO/PEC servirà al link del tabellone, non a una visura — un
  // provider di PEC non è la casa di una scuola e visitarlo è rete buttata.
  const perIstituto = new Map<string, ScuolaCertificata>();
  const eEdu = (home: string): boolean => /\.edu\.it$/i.test(home);
  for (const riga of righe) {
    if (riga.paritaria && !conParitarie) {
      esito.paritarie += 1;
      continue;
    }
    const home = homeDaSito(sitoIstituzionale(indice, riga));
    if (!home) {
      esito.senzaSito += 1;
      continue;
    }
    const scuola: ScuolaCertificata = { ...certificaScuola(indice, riga, riga.codice), home };
    const chiaveIstituto = (riga.istitutoCodice ?? riga.codice).trim().toUpperCase();
    const esistente = perIstituto.get(chiaveIstituto);
    // A parità di istituto vale il dominio `*.edu.it`: è quello che il MIM riconosce.
    if (!esistente || (eEdu(home) && !eEdu(esistente.home ?? ''))) {
      perIstituto.set(chiaveIstituto, scuola);
    }
  }

  // Istituti diversi possono condividere lo stesso sito (omnicomprensivi): si visita
  // una volta sola, e l'elenco resta in ordine di codice meccanografico.
  const perHome = new Map<string, ScuolaCertificata>();
  for (const scuola of perIstituto.values()) {
    if (scuola.home && !perHome.has(scuola.home)) perHome.set(scuola.home, scuola);
  }

  const tutte = [...perHome.values()].sort((a, b) =>
    (a.codice ?? '').localeCompare(b.codice ?? ''),
  );
  const max = typeof opts.max === 'number' && opts.max > 0 ? Math.floor(opts.max) : tutte.length;
  esito.scuole = tutte.slice(0, max);
  return esito;
}
