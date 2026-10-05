/**
 * ScuoleRadar.it — COMPATIBILITÀ GRADUATA: la MEDIA PONDERATA DELLE 5 MODALI (PURO).
 *
 * Un solo punto in cui i criteri del Radar diventano il punteggio MOSTRATO:
 *
 *   punteggio = media PONDERATA(ordine · classe · parole chiave · provincia) + jolly
 *               └─ rinormalizzata sui PESI delle sole modali ATTIVE ─┘
 *
 * I PESI (`PESI_MODALI`) dicono QUANTO pesa ogni modale: classi di concorso 2 (requisito
 * ABILITANTE, stessa gerarchia del motore §26.54: 100/80/70/60), ordine · parole chiave ·
 * provincia 1 (preferenze di contesto). Nessun peso raggiunge la metà dei pesi totali
 * (2 su 5): il voto non può derivare da una sola modale — una provincia giusta, da sola,
 * non «promuove» un avviso della classe sbagliata.
 *
 * Le MODALI sono le cinque finestre delle preferenze dell'utente:
 *   1. «Dove vuoi lavorare» (ordine)            → 100 / 90 (adiacente) / 70 (salto)
 *   2. «Classi di concorso»                     → 100 / 95 (affine) / 85 / 75 / 65 / 55
 *   3. «In cosa puoi lavorare oltre la classe»  → 90 / 85, **jolly** (+3% a colpo)
 *   4. «Provincia»                              → 100 / penalità entro 60 km / ESCLUSIONE
 *   5. «Filtri Avanzati Scuole»                 → blacklist fuori, whitelist dentro
 *
 * Una modale NON applicabile (nessun ordine scelto, nessuna classe, nessuna
 * parola chiave trovata, nessuna provincia) **esce dalla media**: non azzera
 * l'offerta per un dato che l'utente non ha dichiarato. Due invarianti:
 *
 *   1. **Il pavimento del sostegno non si sconta**: l'area SOSTEGNO fuori dalle
 *      proprie classi resta a `PUNTEGGIO_EXTRA_SOSTEGNO` (60) — è un suggerimento
 *      EXTRA a inclusione permanente (§26.45), non un match da graduare;
 *   2. **La consegna non passa di qui**: email/Telegram e digest usano il motore
 *      STRICT (`provinceLimitrofe` è un'opzione della sola bacheca), quindi non
 *      cambia cosa arriva all'utente — cambia come si presenta.
 */
import type { OrdineScuola } from '../data/ordiniMaterie';
import {
  PUNTEGGIO_EXTRA_SOSTEGNO,
  PUNTEGGIO_MATCH_NESSUNO,
  punteggioCompatibilita,
  type AvvisoCompatibilita,
  type OpzioniCompatibilita,
  type ProfiloCompatibilita,
} from './matchingEngine';
import { INCREMENTO_JOLLY, punteggioCompetenze } from './punteggioCompetenze';
import { punteggioClasse } from './punteggioClasse';
import { punteggioOrdine } from './punteggioOrdine';
import { punteggioProvincia } from './prossimitaGeografica';

/** Profilo per le modali: il profilo del motore + gli ordini di scuola scelti. */
export interface ProfiloModali extends ProfiloCompatibilita {
  ordini?: readonly OrdineScuola[] | null;
}

/** Avviso per le modali: l'avviso del motore + l'ordine di scuola pubblicato. */
export interface AvvisoModali extends AvvisoCompatibilita {
  ordine?: OrdineScuola | null;
}

/** Opzioni della valutazione di bacheca (include quelle del motore). */
export interface OpzioniModali extends OpzioniCompatibilita {
  /** true = la scuola è nella whitelist dell'utente: inclusione d'ufficio. */
  forzata?: boolean;
}

/** Punteggio di ciascuna modale (`null` = non applicabile, fuori dalla media). */
export interface PunteggiModali {
  ordine: number | null;
  classe: number | null;
  competenze: number | null;
  provincia: number | null;
  /** Quante volte il jolly del 3% ha sfumato il punteggio finale. */
  incrementiJolly: number;
  /** Somma dei PESI delle modali applicabili: denominatore della media ponderata. */
  pesoTotale: number;
}

/**
 * PESI delle modali nel voto finale (`mediaPonderata`): decisione di PRODOTTO, non numero
 * nascosto nel codice — vivono qui, in una riga modificabile.
 *
 *   · `classe` (2) → requisito ABILITANTE: il suo scostamento incide il doppio;
 *   · `ordine` (1) · `competenze` (1) · `provincia` (1) → preferenze di CONTESTO.
 *
 * Invariante verificata da `npm run test:modali`: nessun peso raggiunge la metà dei pesi
 * totali (2 su 5), quindi il voto finale non può derivare da una singola modale.
 */
export const PESI_MODALI = {
  ordine: 1,
  classe: 2,
  competenze: 1,
  provincia: 1,
} as const;

/** Contributo di UNA modale applicabile alla media ponderata. */
export interface ContributoModale {
  /** Punteggio della modale (0-100). */
  punteggio: number;
  /** Peso della modale nella media (`PESI_MODALI`). */
  peso: number;
}

/** Esito completo della valutazione: numero mostrato, base del motore, motivi. */
export interface ValutazioneCompatibilita {
  /** Punteggio MOSTRATO (0-100): media delle modali + jolly. */
  punteggio: number;
  /** Punteggio del motore, prima delle modali (consegna/diagnostica). */
  punteggioMotore: number;
  /** Punti % persi rispetto al motore (0 = nessuno scostamento). */
  penalita: number;
  /** Motivi leggibili delle modali (vuoto = match pieno o extra sostegno). */
  motivi: string[];
  /** true = fuori dal raggio delle province: la bacheca non lo mostra. */
  escluso: boolean;
  /** true = incluso d'ufficio dalla whitelist scuole (Modalità 5). */
  forzata: boolean;
  /** Dettaglio per modale: serve alle guardie e al tooltip. */
  modali: PunteggiModali;
}

const MODALI_VUOTE: PunteggiModali = {
  ordine: null,
  classe: null,
  competenze: null,
  provincia: null,
  incrementiJolly: 0,
  pesoTotale: 0,
};


/**
 * Media PONDERATA `Σ(punteggio × peso) / Σpesi` dei contributi delle modali APPLICABILI:
 * i pesi si rinormalizzano su ciò che il profilo ha davvero. Nessuna modale applicabile
 * (profilo senza criteri) → `PUNTEGGIO_MATCH_NESSUNO`: senza criteri non si inventa un voto.
 */
export function mediaPonderata(contributi: readonly ContributoModale[]): number {
  const attivi = contributi.filter((c) => c.peso > 0 && Number.isFinite(c.punteggio));
  const pesoTotale = attivi.reduce((totale, c) => totale + c.peso, 0);
  if (pesoTotale === 0) return PUNTEGGIO_MATCH_NESSUNO;
  const somma = attivi.reduce((totale, c) => totale + c.punteggio * c.peso, 0);
  return Math.round(somma / pesoTotale);
}

/** Contributo di una modale (`null` = non applicabile: resta fuori dalla media). */
function contributo(punteggio: number | null | undefined, peso: number): ContributoModale | null {
  return typeof punteggio === 'number' ? { punteggio, peso } : null;
}

/** Riga del tooltip che dichiara la media ponderata (e la sfumatura jolly, se c'è). */
function composizioneMotivo(modali: number, incrementiJolly: number): string {
  const jolly = incrementiJolly > 0 ? ` + jolly ${incrementiJolly * INCREMENTO_JOLLY}%` : '';
  return `media ponderata di ${modali} modali${jolly}`;
}

/**
 * Valuta la compatibilità di un'opportunità col profilo dell'utente (bacheca): **media
 * ponderata** dei pesi delle modali applicabili (`PESI_MODALI`) + incrementi jolly del 3%.
 *
 * `opts.provinceLimitrofe` abilita la ricerca delle province entro il raggio (60
 * km) con la relativa penalità; senza di essa la compatibilità resta STRICT sulle
 * province selezionate, come nella consegna. `opts.forzata` (whitelist scuole)
 * scavalca l'esclusione geografica: la scuola preferita entra comunque.
 */
export function valutaCompatibilita(
  profilo: ProfiloModali,
  avviso: AvvisoModali,
  opts: OpzioniModali = {},
): ValutazioneCompatibilita {
  const punteggioMotore = punteggioCompatibilita(profilo, avviso, opts);
  const geo = punteggioProvincia(profilo.province, avviso.province, {
    limitrofe: opts.provinceLimitrofe === true,
  });
  const forzata = opts.forzata === true;

  // FUORI DAL RAGGIO (Modalità 4): esclusione d'ufficio, salvo whitelist.
  if (geo.stato === 'fuori' && !forzata) {
    return {
      punteggio: PUNTEGGIO_MATCH_NESSUNO,
      punteggioMotore,
      penalita: 0,
      motivi: [geo.motivo],
      escluso: true,
      forzata: false,
      modali: { ...MODALI_VUOTE },
    };
  }

  // SUGGERIMENTO EXTRA (sostegno fuori dalle proprie classi): resta al pavimento.
  if (punteggioMotore === PUNTEGGIO_EXTRA_SOSTEGNO) {
    return {
      punteggio: PUNTEGGIO_EXTRA_SOSTEGNO,
      punteggioMotore,
      penalita: 0,
      motivi: [],
      escluso: false,
      forzata,
      modali: { ...MODALI_VUOTE },
    };
  }

  const ordine = punteggioOrdine(profilo.ordini, avviso.ordine);
  const classe = punteggioClasse(profilo, avviso);
  const competenze = punteggioCompetenze(profilo, avviso);
  const provincia = geo.stato === 'propria' || geo.stato === 'vicina' ? geo.punteggio : null;
  // Solo le modali APPLICABILI entrano nella media, coi loro PESI: una modale senza dati
  // dell'utente non abbassa il voto (pesi rinormalizzati), ma non lo alza nemmeno.
  const contributi = [
    contributo(ordine?.punteggio, PESI_MODALI.ordine),
    contributo(classe?.punteggio, PESI_MODALI.classe),
    contributo(competenze.punteggio, PESI_MODALI.competenze),
    contributo(provincia, PESI_MODALI.provincia),
  ].filter((c): c is ContributoModale => c !== null);
  const pesoTotale = contributi.reduce((totale, c) => totale + c.peso, 0);
  const base = mediaPonderata(contributi);
  const punteggio = base === 0 ? 0 : Math.min(100, base + competenze.incrementi * INCREMENTO_JOLLY);
  const motivi = [
    ordine?.motivo,
    classe?.motivo,
    ...competenze.motivi,
    geo.stato === 'vicina' ? geo.motivo : null,
    composizioneMotivo(contributi.length, competenze.incrementi),
  ].filter((m): m is string => Boolean(m));

  return {
    punteggio,
    punteggioMotore,
    penalita: Math.max(0, punteggioMotore - punteggio),
    motivi,
    escluso: false,
    forzata,
    modali: {
      ordine: ordine?.punteggio ?? null,
      classe: classe?.punteggio ?? null,
      competenze: competenze.punteggio,
      provincia,
      incrementiJolly: competenze.incrementi,
      pesoTotale,
    },
  };
}
