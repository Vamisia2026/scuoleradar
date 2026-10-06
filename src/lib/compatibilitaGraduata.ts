/**
 * ScuoleRadar.it — COMPATIBILITÀ GRADUATA (modulo PURO): il punteggio MOSTRATO in bacheca.
 *
 * UN PUNTO SOLO, DUE LIVELLI (§26.63 · §26.64):
 *
 *   1. **LIVELLO PRIMARIO** — le preferenze dichiarate (ordine, classi, provincia) fanno il
 *      match e il voto: `mediaPonderata` delle modali APPLICABILI (`mediaModali.ts`), e una
 *      modale senza dati dell'utente ESCE dalla media (non azzera l'offerta per un dato assente).
 *   2. **LIVELLO SECONDARIO** — le competenze del profilo (`materie_id`, `materie_custom`)
 *      NON assegnano il voto e NON entrano nella media: le interpreta il **JOLLY SEMANTICO**
 *      (`jollySemantico.ts`, §26.64), ASIMMETRICO. Match PIENO → `PUNTEGGIO_JOLLY_PIENO` (90)
 *      come PAVIMENTO del voto; fuori dalle proprie province, inclusione D'UFFICIO a 60 invece
 *      dell'esclusione. Match PARZIALE → bonus dentro `BONUS_JOLLY_PARZIALE` (15). Nessun
 *      match → zero punti e ZERO PENALIZZAZIONI. Il jolly è SOSPESO con la whitelist (§26.45),
 *      col tetto del motore (profilo senza classi) e col pavimento del sostegno: lì vale la
 *      §26.63, la sfumatura di al più `CAP_COMPETENZE`.
 *
 * Due invarianti: il pavimento del sostegno non si sconta (suggerimento EXTRA a inclusione
 * permanente: né le competenze né il jolly lo promuovono); la CONSEGNA (email/Telegram,
 * digest) non passa di qui — usa il motore STRICT, perché `provinceLimitrofe` è della bacheca.
 */
import type { OrdineScuola } from '../data/ordiniMaterie';
import {
  esitoJollySemantico,
  motivoJolly,
  punteggioConJolly,
  secondarioDaDichiarare,
} from './jollySemantico';
import {
  PUNTEGGIO_EXTRA_SOSTEGNO,
  PUNTEGGIO_MATCH_NESSUNO,
  PUNTEGGIO_MATCH_SECONDARIO,
  punteggioCompatibilita,
  type AvvisoCompatibilita,
  type OpzioniCompatibilita,
  type ProfiloCompatibilita,
} from './matchingEngine';
import { mediaPonderata, PESI_MODALI, type ContributoModale } from './mediaModali';
import { punteggioCompetenze } from './punteggioCompetenze';
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
  /** LIVELLO SECONDARIO (§26.63): punti sfumati dalle competenze (0-25), `null` se nessuna. */
  competenze: number | null;
  provincia: number | null;
  /** Somma dei PESI delle modali primarie applicabili: denominatore della media ponderata. */
  pesoTotale: number;
}

/** Esito completo della valutazione: numero mostrato, base del motore, motivi. */
export interface ValutazioneCompatibilita {
  /** Punteggio MOSTRATO (0-100): media ponderata primaria + sfumatura delle competenze (§26.63). */
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
  /**
   * LIVELLO SECONDARIO (§26.63): la competenza del profilo riconosciuta nel testo, coi punti
   * che ha sfumato (`null` = nessuna competenza trovata: il voto è tutto delle preferenze
   * primarie). La bacheca la porta sulla card (`Interpello.competenzaSecondaria`).
   */
  competenzaSecondaria: CompetenzaSecondaria | null;
  /**
   * JOLLY SEMANTICO (§26.64): la competenza della Modalità 3 riconosciuta PER INTERO, che ha
   * garantito il pavimento d'eccellenza — o l'ingresso d'ufficio fuori dalle proprie province
   * (`null` = nessun match pieno: parziale o assente, e in quei casi il jolly non toglie nulla).
   * La bacheca la porta sulla card (`Interpello.jollySemantico`).
   */
  jollySemantico: string | null;
  /** Dettaglio delle modali PRIMARIE e del livello secondario: guardie e tooltip. */
  modali: PunteggiModali;
}

/**
 * Competenza del profilo riconosciuta nell'avviso: la sfumatura del livello SECONDARIO
 * (§26.63). NON è un voto — il voto resta della media ponderata delle primarie — ma va
 * DICHIARATA: altrimenti il punteggio più alto sembrerebbe casuale.
 */
export interface CompetenzaSecondaria {
  /** Testo della competenza del profilo (o parola chiave personale) riconosciuta nell'avviso. */
  etichetta: string;
  /** Punti che ha aggiunto al punteggio primario (1 … `CAP_COMPETENZE`). */
  punteggio: number;
}

const MODALI_VUOTE: PunteggiModali = {
  ordine: null,
  classe: null,
  competenze: null,
  provincia: null,
  pesoTotale: 0,
};

/** Contributo di una modale (`null` = non applicabile: resta fuori dalla media). */
function contributo(punteggio: number | null | undefined, peso: number): ContributoModale | null {
  return typeof punteggio === 'number' ? { punteggio, peso } : null;
}

/** Riga del tooltip che dichiara la media ponderata delle preferenze PRIMARIE. */
function composizioneMotivo(modali: number): string {
  return `media ponderata di ${modali} modali`;
}

/**
 * Valuta la compatibilità di un'opportunità col profilo dell'utente (bacheca), in DUE
 * LIVELLI (§26.63): **MEDIA PONDERATA** delle preferenze primarie applicabili
 * (`mediaModali.ts`: ordine · classe · provincia) **+ la sfumatura delle competenze**, che
 * aggiunge al massimo `CAP_COMPETENZE` punti e non assegna mai il voto.
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

  // ── JOLLY SEMANTICO (Modalità 3, §26.64) — PRIMA del vaglio geografico ─────
  // Il match PIENO non alza solo il voto: fa entrare l'avviso d'ufficio fuori dalle proprie
  // province (i vincoli geografici SECONDARI non escludono più). Whitelist, tetto del motore e
  // pavimento del sostegno lo sospendono, e lì vale la §26.63: una sola misura, due decisioni.
  const jolly = esitoJollySemantico(profilo, avviso, {
    statoGeo: geo.stato,
    forzata,
    tettoMotore: punteggioMotore === PUNTEGGIO_MATCH_SECONDARIO,
    sostegno: punteggioMotore === PUNTEGGIO_EXTRA_SOSTEGNO,
  });

  // FUORI DAL RAGGIO (Modalità 4): esclusione d'ufficio, salvo whitelist o match PIENO.
  if (geo.stato === 'fuori' && !forzata && !jolly.bypassRaggio) {
    return {
      punteggio: PUNTEGGIO_MATCH_NESSUNO,
      punteggioMotore,
      penalita: 0,
      motivi: [geo.motivo],
      escluso: true,
      forzata: false,
      competenzaSecondaria: null,
      jollySemantico: null,
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
      competenzaSecondaria: null,
      jollySemantico: null,
      modali: { ...MODALI_VUOTE },
    };
  }

  const ordine = punteggioOrdine(profilo.ordini, avviso.ordine);
  const classe = punteggioClasse(profilo, avviso);
  const competenze = punteggioCompetenze(profilo, avviso);
  const provincia = geo.stato === 'propria' || geo.stato === 'vicina' ? geo.punteggio : null;

  // ── LIVELLO PRIMARIO — MEDIA PONDERATA (Modalità 1 · 2 · 4) ───────────────
  // Solo le preferenze APPLICABILI entrano nella media, coi loro PESI: una modale senza
  // dati dell'utente non abbassa il voto (pesi rinormalizzati), ma non lo alza nemmeno.
  const contributi = [
    contributo(ordine?.punteggio, PESI_MODALI.ordine),
    contributo(classe?.punteggio, PESI_MODALI.classe),
    contributo(provincia, PESI_MODALI.provincia),
  ].filter((c): c is ContributoModale => c !== null);
  const pesoTotale = contributi.reduce((totale, c) => totale + c.peso, 0);
  const base = mediaPonderata(contributi);

  // ── LIVELLO SECONDARIO — SFUMATURA DELLE COMPETENZE (§26.63) ──────────────
  // Non entrano nella media e non assegnano il voto: misurano al più `CAP_COMPETENZE` punti.
  // Col profilo senza classi il verdetto del motore è il tetto dell'intero punteggio.
  const tetto = punteggioMotore === PUNTEGGIO_MATCH_SECONDARIO ? PUNTEGGIO_MATCH_SECONDARIO : 100;
  const secondario = Math.min(tetto, base + competenze.punteggio);
  // Il jolly rilegge la somma dei due livelli: il PIENO mette il pavimento, il PARZIALE lo stringe.
  const punteggio = punteggioConJolly(jolly, base, secondario);
  const motivi = [
    ordine?.motivo,
    classe?.motivo,
    // §26.63: la misura si dichiara se i suoi punti sono stati applicati (il PIENO aggiunge).
    ...(jolly.fascia === 'parziale' && jolly.bonus < jolly.punti ? motivoJolly(jolly) : competenze.motivi),
    geo.stato === 'vicina' ? geo.motivo : null,
    ...(jolly.fascia === 'pieno' ? motivoJolly(jolly) : []),
    composizioneMotivo(contributi.length),
  ].filter((m): m is string => Boolean(m));

  return {
    punteggio,
    punteggioMotore,
    penalita: Math.max(0, punteggioMotore - punteggio),
    motivi,
    escluso: false,
    forzata,
    // LIVELLO SECONDARIO (§26.63) e JOLLY SEMANTICO (§26.64): cosa dichiarare del secondo livello.
    competenzaSecondaria: secondarioDaDichiarare(jolly, competenze),
    jollySemantico: jolly.fascia === 'pieno' ? jolly.etichetta : null,
    modali: {
      ordine: ordine?.punteggio ?? null,
      classe: classe?.punteggio ?? null,
      competenze: competenze.punteggio > 0 ? competenze.punteggio : null,
      provincia,
      pesoTotale,
    },
  };
}
