/**
 * ScuoleRadar.it — LA BANDA DEL MATCH della vetrina «Opportunità mappate»
 * (§26.106 · §26.145 — modulo PURO).
 *
 * Estratta da `lib/compatibilita` il 05/11/2026: quel file era al tetto delle 250 righe
 * (`npm run test:architettura`) e questa sezione è un'unità coerente — tre gradi, tre
 * colori, una pillola. Le SOGLIE restano di `lib/compatibilita` e qui non si riscrive
 * nessun numero: `livelloMatch` legge `livelloCompatibilita` (unica fonte), e il FONDO
 * CONVENTO legge `SOGLIA_FONDO_CONVENTO`.
 *
 * Il colore è un'informazione di SERVIZIO (`comunicazione/00_regole_generali`): dice
 * quanto l'avviso somiglia al profilo, mai una graduatoria di merito.
 */
import {
  ETICHETTA_FONDO_CONVENTO,
  SOGLIA_FONDO_CONVENTO,
  livelloCompatibilita,
  normalizzaPunteggioCompatibilita,
} from './compatibilita';

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
  /** Colore IDENTITARIO della fascia (`#1FA055` match alto · `#2B6F9E` per il resto). */
  hex: string;
  /** Token Tailwind corrispondente (`accent-500`, `primary-500`). */
  token: string;
  /** Classi della PILLOLA con la percentuale (azzurrino soft, testo/bordo della fascia). */
  className: string;
}

/**
 * I TRE GRADI del match, palette AZZURRINO SOFT: pillola `#EEF6FB` sempre, testo verde
 * `#1FA055` per l'ALTO (≥ 80), blu `#2B6F9E` per MEDIO (70-79) e BASSO (< 70: ripiego).
 * Il ROSSO non è un colore del match: resta alla scadenza entro le 24 ore (`scadenzaSemaforo`).
 * Le SOGLIE non si riscrivono qui: `livelloMatch` legge `livelloCompatibilita`, unica fonte.
 */
export const COLORI_MATCH: Record<LivelloMatch, ColoreMatch> = {
  alto: { livello: 'alto', hex: '#1FA055', token: 'accent-500', className: 'bg-primary-50 text-accent-500 ring-1 ring-inset ring-accent-200' },
  medio: { livello: 'medio', hex: '#2B6F9E', token: 'primary-500', className: 'bg-primary-50 text-primary-500 ring-1 ring-inset ring-primary-200' },
  basso: { livello: 'basso', hex: '#2B6F9E', token: 'primary-500', className: 'bg-primary-50 text-primary-500 ring-1 ring-inset ring-primary-200' },
};

/** Etichetta e descrizione delle tre fasce (la riga di ripiego e il fondo hanno le loro, sotto). */
const FASCE_MATCH: Record<LivelloMatch, { etichetta: string; descrizione: string }> = {
  alto: { etichetta: 'Match alto col profilo', descrizione: 'Match alto col profilo (≥ 80%): ordine, classe e provincia combaciano.' },
  medio: { etichetta: 'Match medio col profilo', descrizione: 'Match medio col profilo (70-79%): materia o area vicina, oppure provincia entro i 60 km.' },
  basso: { etichetta: 'Match basso col profilo', descrizione: 'Match basso col profilo (< 70%): suggerimento extra o riga di ripiego, fuori dalle priorità del tuo Radar.' },
};

const DESCRIZIONE_RIPIEGO =
  'Nessun match sufficiente: è una delle migliori opportunità del DB, mostrata per non lasciare ' +
  'vuota la vetrina. Ripiego dichiarato, non un match col profilo.';

/**
 * §26.145 — la riga del FONDO CONVENTO: le penalità di distanza (`lib/distanzaProfilo`)
 * l'hanno portata sotto la soglia. Non è un match parziale: è una riga che il profilo
 * non copre (ordine di scuola lontano, posto di sostegno fuori dalle proprie classi) e
 * che si mostra solo perché è dentro il perimetro geografico. Il tooltip dice il PERCHÉ.
 */
const DESCRIZIONE_FONDO =
  'Fuori dal tuo profilo: ordine di scuola o posto di sostegno troppo lontani. Resta in ' +
  'bacheca solo perché è nella tua zona, in coda e dichiarata: non è un match.';

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

/**
 * Banda del MATCH nella vetrina «Opportunità mappate».
 *
 * `ripiego: true` (riga del paracadute) è dichiarato SOLO con match basso: un'opportunità
 * forte non ha bisogno di scuse. Sotto `SOGLIA_FONDO_CONVENTO` l'etichetta è sempre
 * «Fondo Convento / Ripiego» (§26.145): quel voto non può venire da un match, quindi non
 * si deduce da un flag — lo dice il numero.
 */
export function stileMatch(punteggio: number, opts: { ripiego?: boolean } = {}): BandaMatch {
  const p = normalizzaPunteggioCompatibilita(punteggio);
  const livello = livelloMatch(p);
  const fondo = p < SOGLIA_FONDO_CONVENTO;
  const ripiego = opts.ripiego === true && livello === 'basso' && !fondo;
  const fascia = fondo
    ? { etichetta: ETICHETTA_FONDO_CONVENTO, descrizione: DESCRIZIONE_FONDO }
    : ripiego
      ? { etichetta: ETICHETTA_RIPIEGO, descrizione: DESCRIZIONE_RIPIEGO }
      : FASCE_MATCH[livello];
  return { ...COLORI_MATCH[livello], punteggio: p, ...fascia };
}
