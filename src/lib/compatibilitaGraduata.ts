/**
 * ScuoleRadar.it — COMPATIBILITÀ GRADUATA: OVERRIDE DELLA MODALE 3 E MEDIA
 * PONDERATA DELLE ALTRE (PURO).
 *
 * Un solo punto in cui i criteri del Radar diventano il punteggio MOSTRATO, in due tier:
 *
 *   1. **OVERRIDE** — Modalità 3 «In cosa puoi lavorare oltre la classe»: una parola
 *      chiave trovata nel testo dell'avviso **assegna d'ufficio** il voto e blocca ogni
 *      altro calcolo (90 parola chiave piena · 85 match vicino). La PROVINCIA resta la
 *      sola condizione: fuori dal raggio l'avviso è escluso;
 *   2. **MEDIA PONDERATA** — Modalità 1 · 2 · 4 quando la Modale 3 non aggancia nulla:
 *
 *        punteggio = media PONDERATA(ordine · classe · provincia) + jolly
 *                    └─ pesi e formula in `mediaModali.ts` ─┘
 *
 * Le MODALI sono le cinque finestre delle preferenze dell'utente:
 *   · «Dove vuoi lavorare» (ordine)            → 100 / 90 (adiacente) / 70 (salto)
 *   · «Classi di concorso»                     → 100 / 95 (affine) / 85 / 75 / 65 / 55
 *   · «Oltre la classe» (parole chiave)        → **OVERRIDE** 90 / 85, jolly +3%
 *   · «Provincia»                              → 100 / penalità entro 60 km / ESCLUSIONE
 *   · «Filtri Avanzati Scuole»                 → blacklist fuori, whitelist dentro
 *
 * Una modale NON applicabile (nessun ordine scelto, nessuna classe, nessuna parola
 * chiave trovata, nessuna provincia) **esce dalla media**: non azzera l'offerta per un
 * dato che l'utente non ha dichiarato. Due invarianti:
 *
 *   1. **Il pavimento del sostegno non si sconta**: l'area SOSTEGNO fuori dalle proprie
 *      classi resta a `PUNTEGGIO_EXTRA_SOSTEGNO` (60) — è un suggerimento EXTRA a
 *      inclusione permanente (§26.45), non un match: l'override delle parole chiave non
 *      lo promuove;
 *   2. **La consegna non passa di qui**: email/Telegram e digest usano il motore STRICT
 *      (`provinceLimitrofe` è un'opzione della sola bacheca): non cambia cosa arriva
 *      all'utente, cambia come si presenta.
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
import { mediaPonderata, PESI_MODALI, type ContributoModale } from './mediaModali';
import { INCREMENTO_JOLLY, punteggioCompetenze, type OverrideModale3 } from './punteggioCompetenze';
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
  /** Modalità 3: voto dell'override (90/85) o `null` se la parola chiave non aggancia. */
  competenze: number | null;
  provincia: number | null;
  /** Quante volte il jolly del 3% ha sfumato il punteggio finale. */
  incrementiJolly: number;
  /** Somma dei PESI delle modali applicabili: denominatore della media (0 = voto d'ufficio). */
  pesoTotale: number;
}

/** Esito completo della valutazione: numero mostrato, base del motore, motivi. */
export interface ValutazioneCompatibilita {
  /** Punteggio MOSTRATO (0-100): voto d'ufficio dell'override, oppure media delle modali + jolly. */
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
  /**
   * OVERRIDE della Modalità 3: presente SOLO quando il voto non è una media ma un VOTO
   * ASSEGNATO d'ufficio da una parola chiave (90 parola chiave piena · 85 match vicino).
   */
  override?: OverrideModale3;
}

const MODALI_VUOTE: PunteggiModali = {
  ordine: null,
  classe: null,
  competenze: null,
  provincia: null,
  incrementiJolly: 0,
  pesoTotale: 0,
};


/** Contributo di una modale (`null` = non applicabile: resta fuori dalla media). */
function contributo(punteggio: number | null | undefined, peso: number): ContributoModale | null {
  return typeof punteggio === 'number' ? { punteggio, peso } : null;
}

/** Riga del tooltip che dichiara la media ponderata (e la sfumatura jolly, se c'è). */
function composizioneMotivo(modali: number, incrementiJolly: number): string {
  const jolly = incrementiJolly > 0 ? ` + jolly ${incrementiJolly * INCREMENTO_JOLLY}%` : '';
  return `media ponderata di ${modali} modali${jolly}`;
}

/** Riga del tooltip che dichiara il VOTO ASSEGNATO dalla Modalità 3 (override). */
function motivoOverride(override: OverrideModale3): string {
  const tipo = override.grado === 'esatta' ? 'parola chiave piena' : 'match vicino';
  return `voto assegnato d'ufficio ${override.punteggio}% (Modale 3: ${tipo})`;
}

/**
 * Valuta la compatibilità di un'opportunità col profilo dell'utente (bacheca):
 * **OVERRIDE** della Modalità 3 (parole chiave: voto assegnato d'ufficio 90/85) oppure
 * **MEDIA PONDERATA** delle modali applicabili (`mediaModali.ts`) + incrementi jolly.
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

  // ── MODALITÀ 3 — OVERRIDE AD ALTA PRIORITÀ (parole chiave) ────────────────
  // Una parola chiave trovata NON entra nella media: **assegna d'ufficio** il voto
  // (90 piena · 85 vicina) e blocca gli altri calcoli — voto fisso, nessun jolly. La
  // provincia è già stata verificata sopra: entro il raggio passa anche penalizzata,
  // oltre il raggio ha vinto l'esclusione d'ufficio.
  if (competenze.override) {
    const { override } = competenze;
    return {
      punteggio: override.punteggio,
      punteggioMotore,
      penalita: Math.max(0, punteggioMotore - override.punteggio),
      motivi: [...competenze.motivi, motivoOverride(override)],
      escluso: false,
      forzata,
      override,
      modali: {
        ordine: ordine?.punteggio ?? null,
        classe: classe?.punteggio ?? null,
        competenze: override.punteggio,
        provincia,
        incrementiJolly: 0,
        pesoTotale: 0,
      },
    };
  }

  // ── MEDIA PONDERATA (Modalità 1 · 2 · 4) + JOLLY ──────────────────────────
  // Solo le modali APPLICABILI entrano nella media, coi loro PESI: una modale senza dati
  // dell'utente non abbassa il voto (pesi rinormalizzati), ma non lo alza nemmeno.
  const contributi = [
    contributo(ordine?.punteggio, PESI_MODALI.ordine),
    contributo(classe?.punteggio, PESI_MODALI.classe),
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
      competenze: null,
      provincia,
      incrementiJolly: competenze.incrementi,
      pesoTotale,
    },
  };
}
