/**
 * ScuoleRadar.it — CAP DINAMICO DEI RIEMPITIVI (modulo PURO, una sola regola).
 *
 * Le opportunità con compatibilità sotto la soglia arancio (< 70%) non sono
 * errori: sono «riempitivi» — avvisi che il profilo tocca di striscio. Servono a
 * non lasciare la bacheca vuota, ma in quantità diventano rumore: avvisi di basso
 * valore in cima agli occhi dell'utente.
 *
 * Regola di prodotto:
 *   · al massimo `MAX_RIEMPITIVI_BACHECA` (5) riempitivi visibili;
 *   · se l'utente ha già `MINIMO_MATCH_QUALITA` (10) opportunità di qualità
 *     (≥ 70%), i riempitivi vengono **nascosti del tutto**: la bacheca ha già
 *     abbastanza da mostrare, il resto è rumore.
 *
 * Un riempitivo è tale solo se il punteggio è NOTO e sotto soglia: un punteggio
 * assente resta neutro (la bacheca lo tratta come 100, `DashboardPage`), così
 * questo modulo non inventa una classificazione che il resto della dashboard non
 * condivide.
 *
 * §26.60 — ESCLUSIONE SECCA DEI RIEMPITIVI NON PERTINENTI. Il cap da solo non
 * bastava: un avviso sotto il 70% che il Radar NON conferma per CLASSE — la pertinenza
 * è delle preferenze PRIMARIE, §26.63: le competenze sfumano soltanto — non è un
 * «riempitivo da dosare»: è un falso positivo. `riempitivoNonPertinente` lo dichiara e
 * la bacheca lo scarta a monte, senza quote. Il cap dinamico resta per i riempitivi
 * PERTINENTI.
 *
 * §26.106 — PARACADUTE «5 OSSO-DA-MORDERE». Il cap dice cosa NON mostrare; il paracadute
 * (`paracaduteCinque`) dice cosa mostrare SEMPRE: almeno `MINIMO_BACHECA` (5)
 * opportunità, completando la vetrina con le migliori righe della scorta e dichiarandole
 * come ripiego (`ETICHETTA_RIPIEGO`). Le due regole convivono: il cap protegge dalla
 * coda di rumore, il paracadute protegge dalla pagina vuota — e nessuna delle due
 * scavalca le porte d'ingresso della bacheca.
 */
import { SOGLIA_COMPATIBILITA_ARANCIO } from './compatibilita';

/** Massimo numero di opportunità sotto soglia visibili in bacheca. */
export const MAX_RIEMPITIVI_BACHECA = 5;
/** Con almeno questo numero di match di qualità (≥ soglia) i riempitivi spariscono. */
export const MINIMO_MATCH_QUALITA = 10;

/** Motivo della limitazione (per log, guardie e futura UI). */
export type MotivoRiempitivi = 'nessuno' | 'sotto-tetto' | 'tetto-raggiunto';

/** Esito del cap: la lista pronta per la bacheca + il conto del nascosto. */
export interface EsitoRiempitivi<T> {
  /** Opportunità che la bacheca può mostrare (ordine originale conservato). */
  lista: T[];
  /** Riempitivi visibili dopo il cap. */
  riempitiviVisibili: number;
  /** Riempitivi tolti dalla bacheca. */
  riempitiviNascosti: number;
  motivo: MotivoRiempitivi;
}

/** Cap dinamico dei riempitivi (default = le costanti di prodotto sopra). */
export interface OpzioniRiempitivi<T> {
  soglia?: number;
  max?: number;
  minimoQualita?: number;
  /**
   * Predicato di PROTEZIONE: le voci protette non sono riempitivi e non vengono
   * mai nascoste dal cap (es. le scuole preferite, incluse d'ufficio dalla
   * Modalità 5: nasconderle tradirebbe una scelta esplicita dell'utente).
   */
  proteggi?: (voce: T) => boolean;
}

/** Punteggio confrontabile: valori assenti/corrotti valgono `null` (neutro). */
function punteggioNoto(voce: { compatibilita?: number | null }): number | null {
  const p = voce.compatibilita;
  return typeof p === 'number' && Number.isFinite(p) ? p : null;
}

/**
 * Applica il cap dinamico: restituisce la lista della bacheca e il conto dei
 * riempitivi nascosti. Nessuna mutazione dell'input, ordine originale conservato.
 */
export function limitaRiempitivi<T extends { compatibilita?: number | null }>(
  lista: readonly T[],
  opts: OpzioniRiempitivi<T> = {},
): EsitoRiempitivi<T> {
  const soglia = opts.soglia ?? SOGLIA_COMPATIBILITA_ARANCIO;
  const max = opts.max ?? MAX_RIEMPITIVI_BACHECA;
  const minimoQualita = opts.minimoQualita ?? MINIMO_MATCH_QUALITA;
  const protetta = (voce: T): boolean => opts.proteggi?.(voce) === true;

  const qualita = lista.filter((v) => {
    const p = punteggioNoto(v);
    return p === null || p >= soglia;
  }).length;
  const riempitivi = lista
    .map((voce, indice) => ({ voce, indice, punteggio: punteggioNoto(voce) }))
    .filter((r): r is { voce: T; indice: number; punteggio: number } => {
      const p = r.punteggio;
      return p !== null && p < soglia && !protetta(r.voce);
    });

  const nascosti = new Set<number>();
  let motivo: MotivoRiempitivi = 'nessuno';
  if (riempitivi.length > 0 && qualita >= minimoQualita) {
    for (const r of riempitivi) nascosti.add(r.indice);
    motivo = 'tetto-raggiunto';
  } else if (riempitivi.length > max) {
    // Si tengono i riempitivi MIGLIORI (punteggio più alto, a pari punteggio il
    // primo arrivato): il taglio è deterministico e non dipende dall'ordine del DB.
    const ordinati = [...riempitivi].sort(
      (a, b) => b.punteggio - a.punteggio || a.indice - b.indice,
    );
    for (const r of ordinati.slice(max)) nascosti.add(r.indice);
    motivo = 'sotto-tetto';
  }

  return {
    lista: lista.filter((_, indice) => !nascosti.has(indice)),
    riempitiviVisibili: riempitivi.length - nascosti.size,
    riempitiviNascosti: nascosti.size,
    motivo,
  };
}

/**
 * RIEMPITIVO NON PERTINENTE — la voce NON entra in bacheca (§26.60).
 *
 * Regola di prodotto: sotto la soglia arancio (< 70%) la voce è un riempitivo;
 * se le preferenze PRIMARIE non la confermano — non è la classe dell'utente
 * (ordine/provincia) — è un falso positivo e viene **esclusa a monte**, senza quote e
 * senza cap. Il LIVELLO SECONDARIO (§26.63) non entra qui: le competenze **sfumano** un
 * voto già agganciato, non stabiliscono la pertinenza. Restano in bacheca, per
 * costruzione:
 *
 *   · le opportunità di QUALITÀ (≥ soglia), a prescindere dalla pertinenza;
 *   · i riempitivi PERTINENTI (confermati dal motore per CLASSE), che restano soggetti
 *     al cap dinamico di `limitaRiempitivi`;
 *   · le scuole PREFERITE (`forzata`: scelta esplicita dell'utente, Modalità 5),
 *     che nessun automatismo può togliere.
 *
 * Un punteggio ASSENTE resta neutro (mai classificato a caso): non esclude nulla.
 */
export function riempitivoNonPertinente(
  voce: { compatibilita?: number | null },
  contesto: { pertinente: boolean; forzata?: boolean; soglia?: number },
): boolean {
  if (contesto.forzata === true) return false;
  if (contesto.pertinente) return false;
  const soglia = contesto.soglia ?? SOGLIA_COMPATIBILITA_ARANCIO;
  const punteggio = punteggioNoto(voce);
  return punteggio !== null && punteggio < soglia;
}

/* ------------------- PARACADUTE «5 OSSO-DA-MORDERE» (§26.106) ------------------- */

/**
 * Minimo di opportunità che la vetrina mostra quando il database ne ha abbastanza: una
 * bacheca con una sola card non è un Radar, è una pagina vuota con un bordo.
 */
export const MINIMO_BACHECA = 5;

/** Esito del paracadute: `sufficiente` (non è servito) · `integrato` · `scorta-esaurita`. */
export type MotivoParacadute = 'sufficiente' | 'integrato' | 'scorta-esaurita';

/** Esito del paracadute: lista finale + quante righe sono entrate di ripiego. */
export interface EsitoParacadute<T> {
  lista: T[];
  /** Righe aggiunte dalla scorta (0 = la bacheca bastava). */
  aggiunti: number;
  motivo: MotivoParacadute;
}

/**
 * PARACADUTE «5 OSSO-DA-MORDERE»: la vetrina non resta mai sotto `MINIMO_BACHECA` (5)
 * opportunità finché il database ne ha.
 *
 * Quando i match forti non bastano, la coda si completa con le MIGLIORI righe della
 * `scorta` — le opportunità vere che il Radar non ha agganciato, ordinate per punteggio
 * decrescente (a pari punteggio vale l'ordine del database, quindi il taglio è
 * deterministico). Le righe aggiunte arrivano già marcate `ripiego` dal chiamante e la
 * vetrina le dichiara con `ETICHETTA_RIPIEGO` (`src/lib/compatibilita.ts`): nessun
 * riempimento silenzioso.
 *
 * Cosa la scorta NON contiene, per costruzione (`bachecaInterpelli`): le righe senza
 * scadenza (§26.71), il contorno che non è un avviso (§26.65), le scuole in blacklist
 * (§26.45) e gli avvisi OLTRE il raggio dei 60 km senza la parola del bando (§26.106).
 * Il paracadute completa la vetrina, non scavalca una regola: se il database ha meno di
 * cinque opportunità ammissibili, la lista resta corta e il motivo lo dice
 * (`scorta-esaurita`).
 */
export function paracaduteCinque<T extends { compatibilita?: number | null }>(
  lista: readonly T[],
  scorta: readonly T[],
  opts: { minimo?: number } = {},
): EsitoParacadute<T> {
  const minimo = opts.minimo ?? MINIMO_BACHECA;
  if (lista.length >= minimo) return { lista: [...lista], aggiunti: 0, motivo: 'sufficiente' };
  const mancanti = minimo - lista.length;
  const aggiunte = scorta
    .map((voce, indice) => ({ voce, indice, punteggio: punteggioNoto(voce) ?? 0 }))
    .sort((a, b) => b.punteggio - a.punteggio || a.indice - b.indice)
    .slice(0, mancanti)
    .map((r) => r.voce);
  return {
    lista: [...lista, ...aggiunte],
    aggiunti: aggiunte.length,
    motivo: aggiunte.length < mancanti ? 'scorta-esaurita' : 'integrato',
  };
}
