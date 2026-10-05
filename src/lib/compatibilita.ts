/**
 * ScuoleRadar.it — COMPATIBILITÀ profilo ↔ opportunità: SOGLIE, BANDA CROMATICA e
 * etichette di servizio (modulo PURO, una sola fonte di verità).
 *
 * Il PUNTEGGIO (0-100) nasce dalla media PONDERATA delle 5 MODALI del Radar — dove vuoi
 * lavorare (ordine), classi di concorso, parole chiave, provincia, filtri scuole
 * (`valutaCompatibilita`, `src/lib/compatibilitaGraduata.ts`) — e qui vivono SOLO
 * le soglie e il modo in cui card, modale e qualunque altra superficie traducono
 * quel numero in colore, etichetta e motivo: nessuna copia delle soglie nei
 * componenti.
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

/**
 * Etichetta dedicata delle SCUOLE PREFERITE (Modalità 5, whitelist): quando il
 * punteggio è insufficiente la card NON mostra un voto basso, dichiara
 * l'inclusione d'ufficio; quando il punteggio è buono, resta accanto al badge per
 * dire che quell'opportunità viene dalla scuola preferita dell'utente.
 */
export const ETICHETTA_SCUOLA_PREFERITA = 'Scuola preferita nel radar';

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

/**
 * Banda completa (livello + etichetta + stile + descrizione) di un punteggio.
 *
 * `motivo` (facoltativo) è la sintesi delle MODALI che hanno prodotto quel
 * punteggio — ordine, classe, parole chiave, provincia — misurata da
 * `valutaCompatibilita` (`src/lib/compatibilitaGraduata.ts`) e mostrata nel
 * tooltip della card. Serve a «evidenziare lo scostamento», non a nasconderlo: il
 * numero da solo non direbbe PERCHÉ il match è parziale.
 */
export function bandaCompatibilita(punteggio: number, motivo?: string | null): BandaCompatibilita {
  const p = normalizzaPunteggioCompatibilita(punteggio);
  const livello = livelloCompatibilita(p);
  const scostamento = (motivo ?? '').trim();
  return {
    livello,
    punteggio: p,
    visibile: livello !== 'sotto-soglia',
    etichetta: etichettaCompatibilita(p),
    descrizione: scostamento ? `${DESCRIZIONI[livello]} — ${scostamento}` : DESCRIZIONI[livello],
    className: CLASSI[livello],
  };
}

/**
 * Tooltip dell'etichetta «Scuola preferita nel radar»: dichiara che l'inclusione
 * è d'ufficio (whitelist) e, se il punteggio è sufficiente, che il match c'è.
 */
export function descrizioneScuolaPreferita(punteggio: number): string {
  const p = normalizzaPunteggioCompatibilita(punteggio);
  if (p >= SOGLIA_COMPATIBILITA_ROSSO) {
    return `Scuola che tieni d'occhio: match col profilo ${p}% (${DESCRIZIONI[livelloCompatibilita(p)].toLowerCase()})`;
  }
  return `Scuola che tieni d'occhio: inclusa d'ufficio anche se il match col profilo è ${p}%`;
}
