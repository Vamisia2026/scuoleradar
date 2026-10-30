/**
 * ScuoleRadar.it — LA CODA DEL DISCOVERY METTE LE SCUOLE DAVANTI (§26.112).
 *
 * Perché esiste: la coda `discovered_links` era ordinata per `depth` e
 * `path_score` soltanto. Le 828 home seminate il 09/10/2026 (scuole private e
 * dell'infanzia, host non istituzionali) stanno tutte a `depth 0` e
 * `path_score 0`: a pari punteggio l'ordine è quello fisico del database, così
 * con un tetto di 120 target al giorno le home `*.edu.it` di Asti — anch'esse a
 * `depth 0` — non venivano MAI raggiunte. Risultato: provincia senza una sola
 * opportunità, e nessun modo di accorgersene dal log.
 *
 * LA REGOLA (una sola)
 *   prima i target ISTITUZIONALI (`eDominioIstituzionale`, §26.109: `*.edu.it`,
 *   `*.gov.it`, portali del Ministero, portali USR/UST dichiarati), poi tutto il
 *   resto. Dentro ciascun gruppo vale l'ordine storico: `depth` crescente, poi
 *   `path_score` decrescente, poi URL — deterministico e verificabile.
 *
 * COSA NON FA: non scarta nulla (i target non istituzionali restano in coda e
 * vengono letti quando gli istituzionali sono finiti), non riscrive stati, non
 * parla con il database. Modulo PURO, zero dipendenze dalla rete.
 * Guardia: `npm run test:priorita-coda` (incluso in `npm test`).
 */
import { eDominioIstituzionale } from './dominiIstituzionali';

/** Forma minima di una riga di `discovered_links` che entra in coda. */
export interface VoceCoda {
  /** Identificativo della riga (se manca si usa l'URL come chiave di dedup). */
  id?: string;
  url: string;
  depth: number;
  path_score: number;
}

/** Portali ufficiali USR/USP/UAT/UST da considerare istituzionali (dal registro fonti). */
export interface OpzioniCoda {
  readonly portaliUfficiali?: Iterable<string | null | undefined>;
}

/** Esito dell'ordinamento, con il conto dei due gruppi già dichiarato. */
export interface CodaOrdinata<T extends VoceCoda> {
  /** Target da processare in questo giro (al massimo `limite`). */
  scelte: T[];
  /** Quanti dei target scelti sono istituzionali. */
  istituzionali: number;
  /** Quanti dei target scelti non lo sono. */
  altre: number;
  /** Righe idonee rimaste fuori dal tetto del giro. */
  scartate: number;
}

/** Ordine storico della coda: profondità, poi punteggio di percorso, poi URL. */
function confronta(a: VoceCoda, b: VoceCoda): number {
  if (a.depth !== b.depth) return a.depth - b.depth;
  if (a.path_score !== b.path_score) return b.path_score - a.path_score;
  return a.url.localeCompare(b.url);
}

/**
 * Ordina e taglia la finestra di lavoro: **istituzionali primi**, resto dopo.
 * Deduplica per `id` (o per URL), così una riga ripetuta dal database non
 * consuma due volte il tetto del giro.
 */
export function ordinaCoda<T extends VoceCoda>(
  righe: readonly T[],
  limite: number,
  opzioni: OpzioniCoda = {},
): CodaOrdinata<T> {
  const viste = new Set<string>();
  const istituzionali: T[] = [];
  const altre: T[] = [];
  for (const riga of righe) {
    const chiave = (riga.id ?? '').trim() || riga.url.trim();
    if (!chiave || viste.has(chiave)) continue;
    viste.add(chiave);
    const gruppo = eDominioIstituzionale(riga.url, {
      portaliUfficiali: opzioni.portaliUfficiali,
    })
      ? istituzionali
      : altre;
    gruppo.push(riga);
  }
  istituzionali.sort(confronta);
  altre.sort(confronta);

  const tetto = Math.max(0, Math.floor(limite));
  const scelte = [...istituzionali, ...altre].slice(0, tetto);
  const istituzionaliScelti = Math.min(istituzionali.length, tetto);
  return {
    scelte,
    istituzionali: istituzionaliScelti,
    altre: scelte.length - istituzionaliScelti,
    scartate: istituzionali.length + altre.length - scelte.length,
  };
}
