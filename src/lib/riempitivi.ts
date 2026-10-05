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
