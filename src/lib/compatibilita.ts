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
 *   🔵 blu      → ≥ 70  match parziale (materia coperta, stessa area disciplinare)
 *   ⚪ neutro   → ≥ 60  suggerimento EXTRA (area sostegno nell'ordine del profilo):
 *                       informazione, non allarme (§26.120 · §26.122)
 *   ⚪ niente badge → < 60  l'opportunità non si presenta come compatibile
 *
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
  /** true = il badge va mostrato: ogni punteggio NOTO, anche basso o di ripiego. */
  visibile: boolean;
  /** Etichetta breve del badge («80% Compatibile», «55% · affinità»). */
  etichetta: string;
  /** Descrizione estesa (tooltip): perché quel colore. */
  descrizione: string;
  /** Classi Tailwind del badge (azzurrino soft; vuote solo senza punteggio). */
  className: string;
}

/** PALETTE AZZURRINO SOFT (03/11/2026): sfondo `#EEF6FB` su tutte le fasce, testo blu `#2B6F9E`, verde `#1FA055` all'eccellenza. Il rosso non esiste: l'urgenza è del semaforo scadenza. */
const CLASSI: Record<LivelloCompatibilita, string> = {
  verde: 'bg-primary-50 text-accent-500 ring-1 ring-inset ring-accent-200',
  arancio: 'bg-primary-50 text-primary-500 ring-1 ring-inset ring-primary-200',
  rosso: 'bg-primary-50 text-primary-500 ring-1 ring-inset ring-primary-200',
  'sotto-soglia': 'bg-primary-50 text-primary-500 ring-1 ring-inset ring-primary-200',
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

/** Gradino di un punteggio (soglie 80/70/60): i nomi del tipo sono STORICI, non tinte — il badge è azzurrino soft. */
export function livelloCompatibilita(punteggio: number): LivelloCompatibilita {
  const p = normalizzaPunteggioCompatibilita(punteggio);
  if (p >= SOGLIA_COMPATIBILITA_VERDE) return 'verde';
  if (p >= SOGLIA_COMPATIBILITA_ARANCIO) return 'arancio';
  if (p >= SOGLIA_COMPATIBILITA_ROSSO) return 'rosso';
  return 'sotto-soglia';
}

/** Etichetta breve: da 60 in su «compatibile», sotto un'affinità parziale (mai un errore). */
export function etichettaCompatibilita(punteggio: number): string {
  const p = normalizzaPunteggioCompatibilita(punteggio);
  return p >= SOGLIA_COMPATIBILITA_ROSSO ? `${p}% Compatibile` : `${p}% · affinità`;
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
    visibile: p > 0,
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
 * SOGLIA DEL FONDO (§26.145) — sotto questo voto la riga non è un match: è un
 * «Fondo Convento / Ripiego», cioè una riga che le penalità di distanza
 * (ordine di scuola, posto di sostegno) hanno dichiarato fuori dal profilo. La
 * soglia vive qui, con le altre, perché card e tooltip la leggono insieme ai
 * gradini 80/70/60: nessun numero duplicato in giro.
 */
export const SOGLIA_FONDO_CONVENTO = 20;
/** Etichetta TRASPARENTE della riga finita nel fondo (§26.145). */
export const ETICHETTA_FONDO_CONVENTO = 'Fondo Convento / Ripiego';

/**
 * La BANDA del match della vetrina (`stileMatch`, `COLORI_MATCH`, `LivelloMatch`,
 * `ETICHETTA_RIPIEGO`) vive in `lib/bandaMatch` dallo 05/11/2026 — estratta perché questo
 * file era al tetto delle 250 righe. Le SOGLIE, compresa quella del FONDO CONVENTO,
 * restano qui: unica fonte, nessun numero duplicato in giro.
 */
