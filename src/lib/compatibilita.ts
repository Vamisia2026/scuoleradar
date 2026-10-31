/**
 * ScuoleRadar.it — COMPATIBILITÀ profilo ↔ opportunità: SOGLIE, BANDA CROMATICA e
 * etichette di servizio (modulo PURO, una sola fonte di verità).
 *
 * Il PUNTEGGIO (0-100) nasce dalle PREFERENZE PRIMARIE del Radar — ordine, classi di concorso,
 * provincia — in media PONDERATA (`valutaCompatibilita`, `src/lib/compatibilitaGraduata.ts`)
 * SFUMATA dalle competenze (§26.63: al massimo `CAP_COMPETENZE` punti); qui vivono SOLO le
 * soglie e il modo in cui card e modale traducono il numero in colore, etichetta e motivo.
 *
 *   🟢 verde    → ≥ 80  match forte col profilo
 *   🟠 arancio  → ≥ 70  match parziale (materia coperta, stessa area disciplinare)
 *   ⚪ neutro   → ≥ 60  suggerimento EXTRA (area sostegno nell'ordine del profilo):
 *                       informazione, non allarme (§26.120: il rosso è la scadenza ≤24h)
 *   ⚪ niente badge → < 60  l'opportunità non si presenta come compatibile
 *
 * Il colore è un'informazione di SERVIZIO (`comunicazione/00_regole_generali`): dice
 * quanto l'avviso somiglia al profilo, mai una graduatoria di merito.
 */
import { CAP_COMPETENZE } from './punteggioCompetenze';
import { PUNTEGGIO_JOLLY_OLTRE_RAGGIO, PUNTEGGIO_JOLLY_PIENO } from './jollySemantico';

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

/**
 * Etichetta del LIVELLO SECONDARIO (§26.63): una competenza del profilo compare nel testo
 * dell'avviso e il punteggio ne è SFUMATO di qualche punto (max `CAP_COMPETENZE`). NON è un
 * voto d'ufficio — il voto resta della media ponderata delle preferenze primarie (ordine ·
 * classe · provincia) — e card e dettaglio la dichiarano accanto al badge, con
 * `descrizioneCompetenzaSecondaria`.
 */
export const ETICHETTA_COMPETENZA_SECONDARIA = 'Competenza trovata';

/**
 * Etichetta del JOLLY SEMANTICO (§26.64): la competenza della Modalità 3 è stata riconosciuta
 * PER INTERO (`grado = 'esatta'`) e il punteggio ha un PAVIMENTO d'eccellenza — oppure, oltre
 * il raggio dei 60 km, l'avviso entra D'UFFICIO al pavimento d'inclusione. Sostituisce, quando
 * presente, l'etichetta della sfumatura: una sola storia da raccontare.
 */
export const ETICHETTA_JOLLY_SEMANTICO = 'Interesse pieno';


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
  // §26.120 — il suggerimento EXTRA è un'informazione, non un allarme: tinta neutra.
  rosso: 'bg-slate-100 text-slate-600 ring-1 ring-inset ring-slate-200',
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
 * `motivo` (facoltativo) è la sintesi delle PREFERENZE PRIMARIE che hanno prodotto quel
 * punteggio — ordine, classe, provincia — misurata da `valutaCompatibilita`
 * (`src/lib/compatibilitaGraduata.ts`) e mostrata nel tooltip della card. Serve a
 * «evidenziare lo scostamento», non a nasconderlo: il numero da solo non direbbe PERCHÉ il
 * match è parziale. La sfumatura delle competenze viaggia a parte
 * (`ETICHETTA_COMPETENZA_SECONDARIA`, §26.63).
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

/**
 * Tooltip dell'etichetta del livello SECONDARIO (§26.63): dice QUALE competenza del profilo
 * è stata riconosciuta e quanto può valere — le competenze sfumano il punteggio, al massimo
 * di `CAP_COMPETENZE` punti, e non assegnano mai il voto.
 */
export function descrizioneCompetenzaSecondaria(competenza: string, punteggio: number): string {
  const p = normalizzaPunteggioCompatibilita(punteggio);
  return `Competenza del tuo profilo trovata nell'avviso: «${competenza}». Ha sfumato il punteggio (${p}%) di qualche punto, al massimo ${CAP_COMPETENZE}: il voto resta di ordine di scuola, classi di concorso e distanza.`;
}

/**
 * Tooltip dell'etichetta «Interesse pieno» del JOLLY SEMANTICO (§26.64): dice QUALE competenza
 * della Modalità 3 è stata riconosciuta PER INTERO nell'avviso e cosa comporta — il pavimento
 * d'eccellenza delle proprie province, oppure l'ingresso D'UFFICIO oltre il raggio dei 60 km.
 * La geografia resta sovrana sul GRADO del match, non sull'inclusione: l'interesse dichiarato
 * per intero non si perde per un confine.
 */
export function descrizioneJollySemantico(competenza: string, punteggio: number): string {
  const p = normalizzaPunteggioCompatibilita(punteggio);
  return (
    `Hai dichiarato di poter lavorare su «${competenza}» e l'avviso la nomina per intero: ` +
    `il punteggio mostrato (${p}%) ha il pavimento d'eccellenza di ${PUNTEGGIO_JOLLY_PIENO}% ` +
    `della Modalità 3. Oltre il raggio dei 60 km lo stesso interesse pieno fa entrare ` +
    `l'avviso d'ufficio al ${PUNTEGGIO_JOLLY_OLTRE_RAGGIO}%.`
  );
}

/* ------------- Colore del MATCH della vetrina «Opportunità mappate» (§26.106) ------------- */

/**
 * Etichetta TRASPARENTE della riga di RIPIEGO: quando il paracadute «5 osso-da-mordere»
 * completa la vetrina con le migliori opportunità del DB, la card **lo dichiara**.
 */
export const ETICHETTA_RIPIEGO = 'Opportunità di ripiego nel DB';

/** Fascia del match nella vetrina: tre colori, tre letture. */
export type LivelloMatch = 'alto' | 'medio' | 'basso';

/**
 * Colore di una fascia: hex della palette ufficiale e token Tailwind equivalente
 * (`className` deve restare una stringa STATICA: Tailwind legge il sorgente).
 */
export interface ColoreMatch {
  livello: LivelloMatch;
  /** Gradino 500 di `tailwind.config.js`: un solo colore per fascia. */
  hex: string;
  /** Token Tailwind corrispondente (`accent-500`, `warning-500`, `error-500`). */
  token: string;
  /** Classi del pallino/barra (`bg-accent-500`, …). */
  className: string;
}

/**
 * I TRE COLORI del match (§26.106 · §26.120) — gradini della palette, non tinte nuove:
 *   🟢 `#1FA055` (accent-500) → ALTO (≥ 80) · 🟡 `#E2B33C` (warning-500) → MEDIO (70-79)
 *   ⚪ `#94A3B8` (slate-400) → BASSO (< 70: riga di ripiego, dichiarata).
 * Il ROSSO non è un colore del match: nella pagina resta UNO solo, la scadenza entro
 * le 24 ore (`lib/scadenzaSemaforo.ts`). Le SOGLIE non si riscrivono qui:
 * `livelloMatch` legge `livelloCompatibilita`, l'unica fonte.
 */
export const COLORI_MATCH: Record<LivelloMatch, ColoreMatch> = {
  alto: { livello: 'alto', hex: '#1FA055', token: 'accent-500', className: 'bg-accent-500' },
  medio: { livello: 'medio', hex: '#E2B33C', token: 'warning-500', className: 'bg-warning-500' },
  basso: { livello: 'basso', hex: '#94A3B8', token: 'slate-400', className: 'bg-slate-400' },
};

/** Etichetta e descrizione delle tre fasce (la riga di ripiego ha la sua, sopra). */
const FASCE_MATCH: Record<LivelloMatch, { etichetta: string; descrizione: string }> = {
  alto: { etichetta: 'Match alto col profilo', descrizione: 'Match alto col profilo (≥ 80%): ordine, classe e provincia combaciano.' },
  medio: { etichetta: 'Match medio col profilo', descrizione: 'Match medio col profilo (70-79%): materia o area vicina, oppure provincia entro i 60 km.' },
  basso: { etichetta: 'Match basso col profilo', descrizione: 'Match basso col profilo (< 70%): suggerimento extra o riga di ripiego, fuori dalle priorità del tuo Radar.' },
};

const DESCRIZIONE_RIPIEGO =
  'Nessun match sufficiente: è una delle migliori opportunità del DB, mostrata per non lasciare ' +
  'vuota la vetrina. Ripiego dichiarato, non un match col profilo.';

/** Fascia del match di un punteggio: proiezione della banda cromatica condivisa. */
export function livelloMatch(punteggio: number): LivelloMatch {
  const livello = livelloCompatibilita(punteggio);
  if (livello === 'verde') return 'alto';
  if (livello === 'arancio') return 'medio';
  // «rosso» (60-69) e «sotto-soglia» sono la STESSA fascia bassa: suggerimento o
  // ripiego dichiarato, mai una tinta d'allarme (§26.120).
  return 'basso';
}

/** Banda del match pronta per la vetrina: punteggio, colore (hex + token), etichetta, descrizione. */
export interface BandaMatch extends ColoreMatch {
  punteggio: number;
  etichetta: string;
  descrizione: string;
}

/** Banda del MATCH nella vetrina «Opportunità mappate». `ripiego: true` (riga del paracadute)
 * è dichiarato SOLO con match basso: un'opportunità forte non ha bisogno di scuse. */
export function stileMatch(punteggio: number, opts: { ripiego?: boolean } = {}): BandaMatch {
  const p = normalizzaPunteggioCompatibilita(punteggio);
  const livello = livelloMatch(p);
  const ripiego = opts.ripiego === true && livello === 'basso';
  const fascia = ripiego ? { etichetta: ETICHETTA_RIPIEGO, descrizione: DESCRIZIONE_RIPIEGO } : FASCE_MATCH[livello];
  return { ...COLORI_MATCH[livello], punteggio: p, ...fascia };
}
