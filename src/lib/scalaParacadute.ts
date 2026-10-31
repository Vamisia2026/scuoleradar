/**
 * ScuoleRadar.it — LA SCALA DEL PARACADUTE (modulo PURO, §26.125).
 *
 * La regola delle «5 opportunità minime» non si tocca: sotto `MINIMO_BACHECA` la
 * vetrina si completa con le migliori righe ammesse (`riempitivi.paracaduteCinque`).
 * Quello che mancava era l'ORDINE, e un divieto.
 *
 * LA SCALA (dalla più forte alla più debole)
 *   1. `ottime`            — stessa provincia  + stessa classe;
 *   2. `affini`            — stessa provincia  + classe affine (stessa area / materia
 *                            coperta) OPPURE provincia vicina (entro il raggio dei
 *                            60 km) + stessa classe;
 *   3. `ultima-spiaggia`   — stessa provincia  + SOSTEGNO o alternativa alla Religione:
 *                            il paracadute vero, che resta nella provincia scelta;
 *   4. `non-classificata`  — la riga è ammessa dalle altre regole (per esempio un match
 *                            PIENO del jolly semantico, §26.64, che apre d'ufficio oltre
 *                            il raggio) ma non entra in nessuno dei tre gradini: resta
 *                            in vetrina se serve, e va in coda.
 *
 * IL DIVIETO (secco, non negoziabile)
 * Un avviso di **sostegno** o di **alternativa alla Religione** in una provincia che
 * l'utente NON ha scelto non si mostra MAI — nemmeno come ripiego: «sostegno a
 * Vercelli» per chi ha scelto Asti è il falso positivo che la direttiva vieta. Il
 * campo `ammessa` è l'unico verdetto di esclusione di questo modulo; tutto il resto
 * è PRIORITÀ, non filtro, così la consegna e il jolly semantico non cambiano.
 *
 * «Provincia vicina» è la definizione che il Radar usa da sempre
 * (`prossimitaGeografica.ts`): capoluoghi entro `RAGGIO_PROVINCIA_KM` (60 km), mai
 * una confinanenza inventata.
 *
 * Guardia: `npm run test:scala-paracadute` (inclusa in `npm test`).
 */
import type { LivelloRipiego } from '../data/interpelli';
import {
  avvisoDiSostegno,
  normalizzaClassi,
  type AvvisoCompatibilita,
  type ProfiloCompatibilita,
} from './matchingEngine';
import { classeVicina } from './punteggioClasse';
import { punteggioProvincia, type EsitoProvincia } from './prossimitaGeografica';

/** Stato geografico nella scala: quello di `punteggioProvincia`, senza il punteggio. */
export type StatoProvinciaScala = 'propria' | 'vicina' | 'fuori' | 'non-applicabile';

/** Rapporto fra la classe dell'avviso e quelle del profilo. */
export type TipoClasseScala = 'stessa' | 'affine' | 'sostegno' | 'nessuna';

/** Esito della scala: gradino, verdetto del divieto e motivi leggibili. */
export interface EsitoScalaParacadute {
  /** Gradino della scala (l'ordine di priorità, mai un'esclusione). */
  livello: LivelloRipiego;
  /** false SOLO per sostegno/alternativa Religione fuori dalle province scelte. */
  ammessa: boolean;
  /** Dove cade l'avviso rispetto alle province del profilo. */
  provincia: StatoProvinciaScala;
  /** Che rapporto ha la classe con quelle del profilo. */
  classe: TipoClasseScala;
  /** Perché è in quel gradino (per log, guardie e tooltip). */
  motivo: string;
}

/** Ordine numerico dei gradini: più basso = più forte (usato per ordinare la scorta). */
export const ORDINE_LIVELLO: Record<LivelloRipiego, number> = {
  ottime: 0,
  affini: 1,
  'ultima-spiaggia': 2,
  'non-classificata': 3,
};

/** Etichette dei gradini (una sola verità per log, guardie e futura UI). */
export const ETICHETTA_LIVELLO: Record<LivelloRipiego, string> = {
  ottime: 'Ottime — stessa provincia e stessa classe',
  affini: 'Affini — stessa provincia (classe affine) o provincia vicina (stessa classe)',
  'ultima-spiaggia': 'Ultima spiaggia — sostegno o alternativa alla Religione nella tua provincia',
  'non-classificata': 'Fuori scala — ammessa dalle altre regole, in coda',
};

/**
 * ALTERNATIVA ALLA RELIGIONE CATTOLICA (e supplenze di Religione): la materia si
 * riconosce dal titolo o dalla materia inferita, perché quasi nessuna fonte le
 * assegna un codice di classe. Per la scala è l'altra faccia del sostegno: sono le
 * cattedre che l'utente generico non cerca, e il paracadute può proporle — sempre
 * e solo nella propria provincia.
 */
const RE_RELIGIONE =
  /\bIRC\b|educazione\s+religiosa|insegnamento\s+(?:della\s+)?religione|alternativa\s+(?:all['’]?\s*)?(?:insegnamento\s+)?(?:della\s+)?religione|religione\s+cattolica/i;

/** True se l'avviso riguarda Religione cattolica / alternativa (titolo o materia). */
export function alternativaReligione(avviso: {
  titolo?: string | null;
  materia?: string | null;
}): boolean {
  return RE_RELIGIONE.test(`${avviso.titolo ?? ''} ${avviso.materia ?? ''}`);
}

/** Sostegno o Religione: le due aree che il divieto geografico protegge. */
function areaParacadute(avviso: AvvisoCompatibilita): boolean {
  return avvisoDiSostegno(avviso) || alternativaReligione(avviso);
}

/** Stato geografico ridotto all'essenziale (il punteggio non serve alla scala). */
function statoProvincia(
  profilo: ProfiloCompatibilita,
  avviso: AvvisoCompatibilita,
  opts: { raggioKm?: number },
): EsitoProvincia {
  return punteggioProvincia(profilo.province, avviso.province, {
    limitrofe: true,
    raggioKm: opts.raggioKm,
  });
}

/** Rapporto di classe: esatta → sostegno/Religione → affine → nessuno. */
function tipoClasse(
  profilo: ProfiloCompatibilita,
  avviso: AvvisoCompatibilita,
): TipoClasseScala {
  const classiProfilo = normalizzaClassi(profilo.classi);
  const classiAvviso = normalizzaClassi(avviso.classi);
  if (classiAvviso.some((c) => classiProfilo.includes(c))) return 'stessa';
  if (areaParacadute(avviso)) return 'sostegno';
  if (classeVicina(profilo, avviso)) return 'affine';
  return 'nessuna';
}

/**
 * Applica la scala a un avviso rispetto a un profilo.
 *
 * Ordine dei giudizi (un solo passaggio, nessuna eccezione nascosta):
 *   · la classe ESATTA viene prima del sostegno: chi ha una classe `AD…` propria
 *     riceve il sostegno come match, non come ultima spiaggia;
 *   · il DIVIETO guarda solo sostegno/Religione e solo la geografia: fuori dalle
 *     province scelte la riga non è ammessa, e `motivo` lo dichiara;
 *   · un profilo senza province non ha vincoli geografici (`non-applicabile`): la
 *     riga resta ammessa, come nel motore.
 */
export function scalaParacadute(
  profilo: ProfiloCompatibilita,
  avviso: AvvisoCompatibilita,
  opts: { raggioKm?: number } = {},
): EsitoScalaParacadute {
  const geo = statoProvincia(profilo, avviso, opts);
  const provincia: StatoProvinciaScala =
    geo.stato === 'propria' || geo.stato === 'vicina' || geo.stato === 'fuori'
      ? geo.stato
      : 'non-applicabile';
  const inPropria = provincia === 'propria' || provincia === 'non-applicabile';
  const classe = tipoClasse(profilo, avviso);

  // DIVIETO: sostegno/Religione fuori dalle province scelte, mai — nemmeno di ripiego.
  if (classe === 'sostegno' && !inPropria) {
    return {
      livello: 'non-classificata',
      ammessa: false,
      provincia,
      classe,
      motivo:
        provincia === 'vicina'
          ? 'sostegno fuori dalle province scelte (provincia solo vicina)'
          : 'sostegno fuori dalle province scelte',
    };
  }

  if (classe === 'stessa') {
    if (inPropria) {
      return {
        livello: 'ottime',
        ammessa: true,
        provincia,
        classe,
        motivo: 'stessa provincia e stessa classe',
      };
    }
    return {
      livello: 'affini',
      ammessa: true,
      provincia,
      classe,
      motivo: 'provincia vicina con la stessa classe',
    };
  }

  if (classe === 'sostegno') {
    return {
      livello: 'ultima-spiaggia',
      ammessa: true,
      provincia,
      classe,
      motivo: 'sostegno o alternativa Religione nella tua provincia',
    };
  }

  if (classe === 'affine' && inPropria) {
    return {
      livello: 'affini',
      ammessa: true,
      provincia,
      classe,
      motivo: 'stessa provincia, classe affine',
    };
  }

  return {
    livello: 'non-classificata',
    ammessa: true,
    provincia,
    classe,
    motivo:
      classe === 'nessuna'
        ? 'classe senza rapporto con le tue'
        : 'classe affine fuori dalle province scelte',
  };
}

/** True se la riga può stare in vetrina (solo il divieto del sostegno la esclude). */
export function ammessaDallaScala(
  profilo: ProfiloCompatibilita,
  avviso: AvvisoCompatibilita,
  opts: { raggioKm?: number } = {},
): boolean {
  return scalaParacadute(profilo, avviso, opts).ammessa;
}
