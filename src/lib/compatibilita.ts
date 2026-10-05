/**
 * ScuoleRadar.it — COMPATIBILITÀ profilo ↔ opportunità: SOGLIE e BANDA CROMATICA
 * (modulo PURO, una sola fonte di verità).
 *
 * Il PUNTEGGIO (0-100) lo produce il motore di matching
 * (`punteggioCompatibilita`, `src/lib/matchingEngine.ts`); qui vivono SOLO le
 * soglie con cui card, modale e qualunque altra superficie traducono quel numero
 * in colore e in etichetta: nessuna copia delle soglie nei componenti.
 *
 *   🟢 verde    → ≥ 80  match forte col profilo
 *   🟠 arancio  → ≥ 70  match parziale (competenza/parola chiave o materia coperta)
 *   🔴 rosso    → ≥ 60  suggerimento EXTRA (es. area sostegno fuori dalle proprie classi)
 *   ⚪ niente badge → < 60  l'opportunità non si presenta come compatibile
 *
 * Il colore è un'informazione di SERVIZIO (`comunicazione/00_regole_generali`):
 * dice quanto l'avviso somiglia al profilo, mai una graduatoria di merito né una
 * fretta artificiale.
 */

/** Soglia (in %) da cui il badge è ROSSO: suggerimento extra, mai priorità. */
export const SOGLIA_COMPATIBILITA_ROSSO = 60;
/** Soglia (in %) da cui il badge è ARANCIO: match parziale. */
export const SOGLIA_COMPATIBILITA_ARANCIO = 70;
/** Soglia (in %) da cui il badge è VERDE: match forte. */
export const SOGLIA_COMPATIBILITA_VERDE = 80;

export type LivelloCompatibilita = 'verde' | 'arancio' | 'rosso' | 'sotto-soglia';

/** Banda cromatica di un punteggio di compatibilità. */
export interface BandaCompatibilita {
  livello: LivelloCompatibilita;
  /** Punteggio ripulito (intero 0-100). */
  punteggio: number;
  /** true = il badge va mostrato (punteggio ≥ soglia rossa). */
  visibile: boolean;
  /** Etichetta breve del badge («80% Compatibile», «60% · extra»). */
  etichetta: string;
  /** Descrizione estesa (tooltip): perché quel colore. */
  descrizione: string;
  /** Classi Tailwind del badge (vuote sotto soglia). */
  className: string;
}

const CLASSI: Record<LivelloCompatibilita, string> = {
  verde: 'bg-accent-50 text-accent-700 ring-1 ring-inset ring-accent-200',
  arancio: 'bg-warning-50 text-warning-700 ring-1 ring-inset ring-warning-300',
  rosso: 'bg-error-50 text-error-700 ring-1 ring-inset ring-error-200',
  'sotto-soglia': '',
};

const DESCRIZIONI: Record<LivelloCompatibilita, string> = {
  verde: 'Compatibilità forte con il profilo del tuo Radar',
  arancio: 'Compatibilità parziale con il profilo del tuo Radar',
  rosso: 'Suggerimento extra: fuori dai criteri principali del tuo profilo',
  'sotto-soglia': 'Fuori dai criteri del tuo profilo',
};

/**
 * Punteggio ripulito: intero tra 0 e 100. Un valore assente, non numerico o
 * corrotto vale 0 (nessun badge) — mai un `NaN` in pagina.
 */
export function normalizzaPunteggioCompatibilita(punteggio: number): number {
  if (!Number.isFinite(punteggio)) return 0;
  return Math.min(100, Math.max(0, Math.round(punteggio)));
}

/** Livello cromatico di un punteggio (soglie: 80 verde · 70 arancio · 60 rosso). */
export function livelloCompatibilita(punteggio: number): LivelloCompatibilita {
  const p = normalizzaPunteggioCompatibilita(punteggio);
  if (p >= SOGLIA_COMPATIBILITA_VERDE) return 'verde';
  if (p >= SOGLIA_COMPATIBILITA_ARANCIO) return 'arancio';
  if (p >= SOGLIA_COMPATIBILITA_ROSSO) return 'rosso';
  return 'sotto-soglia';
}

/** Etichetta breve del badge di un punteggio. */
export function etichettaCompatibilita(punteggio: number): string {
  const p = normalizzaPunteggioCompatibilita(punteggio);
  return livelloCompatibilita(p) === 'rosso' ? `${p}% · extra` : `${p}% Compatibile`;
}

/** Banda completa (livello + etichetta + stile) di un punteggio. */
export function bandaCompatibilita(punteggio: number): BandaCompatibilita {
  const p = normalizzaPunteggioCompatibilita(punteggio);
  const livello = livelloCompatibilita(p);
  return {
    livello,
    punteggio: p,
    visibile: livello !== 'sotto-soglia',
    etichetta: etichettaCompatibilita(p),
    descrizione: DESCRIZIONI[livello],
    className: CLASSI[livello],
  };
}
