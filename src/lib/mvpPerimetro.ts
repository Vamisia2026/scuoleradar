/**
 * ScuoleRadar.it — PERIMETRO DELL'MVP: capoluoghi di regione + Asti, più la
 * domanda reale degli utenti (§26.126).
 *
 * PERCHÉ ESISTE. L'ingestione massiva «tutte le province, tutte le scuole» costa
 * rete e produce poche righe utili: una provincia senza utenti non ripaga una
 * visita. L'MVP parte dal perimetro MINIMO che dimostra la copertura nazionale e
 * lascia che sia l'uso reale ad accendere il resto:
 *
 *   · **BASELINE NAZIONALE** — i 20 capoluoghi di regione (uno per regione, la
 *     città che l'USR usa come hub) più **Asti**, provincia pilota. Vale per
 *     ogni giro: è il fondo che tiene viva la copertura del Paese.
 *   · **DOMANDA** — una provincia chiesta da «Prova il Radar» o salvata nel
 *     profilo accende un giro APPROFONDITO sulle sue scuole per
 *     `GIORNI_DOMANDA` giorni (la stessa finestra del monitoraggio della prova).
 *   · **RESTO** — le province senza richieste attive NON si spengono: restano
 *     coperte dagli hub USR regionali già in coda (il giro di fondo). Nessun
 *     taglio silenzioso, solo un'intensità diversa.
 *
 * Le due densità si traducono in un TETTO di scuole per provincia
 * (`tettoScuole`): poche home per il fondo, **tutte** quelle dichiarate
 * dall'anagrafica MIM per la domanda (§26.127: il vecchio tetto di 60 è
 * caduto — chi aspetta non si serve a metà). Il numero del fondo non è scritto
 * qui: lo passano i chiamanti (script/workflow/termostato).
 *
 * PURA e senza I/O: la provincia → regione e il capoluogo sono la mappa unica di
 * `src/data/province.ts` e `lib/scanTargets.ts`. La usano `scripts/crawl-mvp.ts`
 * (che legge la domanda da Supabase) e le guardie.
 * Guardia: `npm run test:mvp-perimetro` (inclusa in `npm test`).
 */
import { province } from '../data/province';
import {
  CAPOLUOGHI_REGIONE,
  TARGET_AGGIUNTIVI,
  provinciaDaCitta,
} from './scanTargets';

/**
 * Finestra di validità di una richiesta, in giorni: la stessa del monitoraggio
 * acceso da «Prova il Radar» (`GIORNI_MONITORAGGIO_PROVA`, 7 giorni). Una
 * provincia chiesta e poi abbandonata non resta «richiesta» per sempre.
 */
export const GIORNI_DOMANDA = 7;

/** Un giorno in millisecondi: la finestra si misura in tempo, non in date locali. */
const GIORNO_MS = 86_400_000;

/** Codice provincia normalizzato (`' at '` → `'AT'`); `''` se assente. */
function codice(valore?: string | null): string {
  return (valore ?? '').trim().toUpperCase();
}

/**
 * Province della BASELINE NAZIONALE: i capoluoghi di regione (mappati sul
 * catalogo da `lib/scanTargets`, es. `'Torino'` → `'TO'`) più i target
 * aggiuntivi del seed (`Asti` → `'AT'`). Ordinate e senza duplicati: se un
 * giorno un target aggiuntivo coincidesse con un capoluogo, resta una voce.
 *
 * Un capoluogo che il catalogo non conosce viene IGNORATO invece di entrare
 * come codice inventato: meglio una provincia in meno che una riga senza
 * provincia.
 */
export const PROVINCE_BASELINE: readonly string[] = (() => {
  const codici = new Set<string>();
  for (const citta of Object.values(CAPOLUOGHI_REGIONE)) {
    const codiceProvincia = provinciaDaCitta(citta);
    if (codiceProvincia) codici.add(codiceProvincia);
  }
  for (const citta of TARGET_AGGIUNTIVI) {
    const codiceProvincia = provinciaDaCitta(citta);
    if (codiceProvincia) codici.add(codiceProvincia);
  }
  return [...codici].sort((a, b) => a.localeCompare(b));
})();

/** True se la provincia fa parte della baseline nazionale (capoluoghi + Asti). */
export function eProvinciaBaseline(codiceProvincia?: string | null): boolean {
  return PROVINCE_BASELINE.includes(codice(codiceProvincia));
}

/**
 * Una richiesta di scansione arrivata dall'esterno: la provincia cercata e
 * QUANDO è stata chiesta (`province_domanda.ultima_richiesta`, ISO). Una data
 * assente o illeggibile NON tiene accesa la provincia: senza prova di quando è
 * stata chiesta, la richiesta è scaduta.
 */
export interface RichiestaProvincia {
  province?: string | null;
  ultima_richiesta?: string | null;
}

/** Esito del piano: cosa si legge in questo giro e con quale intensità. */
export interface PianoScansione {
  /** Province della baseline nazionale (sempre nel giro, densità `fondo`). */
  baseline: string[];
  /** Province con una richiesta nella finestra (densità `domanda`). */
  domanda: string[];
  /** Province chieste che NON sono capoluoghi: la domanda che allarga il perimetro. */
  fuoriBaseline: string[];
  /** Tutte le province del giro: `domanda` in testa (sono le più dense), poi `baseline`. */
  tutte: string[];
  /** Richieste ricevute ma fuori finestra (o senza data): non accendono nulla. */
  scadute: string[];
  /** Richieste con codice che non esiste nel catalogo: scartate, mai inventate. */
  sconosciute: string[];
}

/** Codice di una richiesta nella forma del catalogo, oppure `null`. */
function provinciaDelCatalogo(valore?: string | null): string | null {
  const c = codice(valore);
  if (!c) return null;
  return province.some((p) => p.codice === c) ? c : null;
}

/**
 * True se una richiesta è ancora nella finestra (`adesso - giorni`).
 * Accetta ISO con o senza millisecondi; una data nel futuro è valida (orologi
 * diversi fra worker e database non devono spegnere una richiesta).
 */
export function richiestaInFinestra(
  richiesta: RichiestaProvincia,
  adesso: Date = new Date(),
  giorni: number = GIORNI_DOMANDA,
): boolean {
  const quando = new Date(String(richiesta?.ultima_richiesta ?? '')).getTime();
  if (Number.isNaN(quando)) return false;
  const finestra = Math.max(0, Math.trunc(giorni)) * GIORNO_MS;
  return adesso.getTime() - quando <= finestra;
}

/**
 * PIANO DEL GIRO. La baseline c'è sempre; le richieste dentro la finestra
 * diventano `domanda`; tutto il resto è dichiarato (`scadute`, `sconosciute`).
 * `domanda` è in testa a `tutte` perché è l'ordine in cui conviene leggere le
 * province: prima quelle che qualcuno sta aspettando.
 */
export function pianoScansione(
  richieste: readonly RichiestaProvincia[] | null | undefined,
  opts: { adesso?: Date; giorni?: number } = {},
): PianoScansione {
  const adesso = opts.adesso ?? new Date();
  const giorni = opts.giorni ?? GIORNI_DOMANDA;
  const domanda = new Set<string>();
  const scadute = new Set<string>();
  const sconosciute = new Set<string>();

  for (const richiesta of richieste ?? []) {
    const codiceProvincia = provinciaDelCatalogo(richiesta?.province);
    if (!codiceProvincia) {
      const grezzo = codice(richiesta?.province);
      if (grezzo) sconosciute.add(grezzo);
      continue;
    }
    if (richiestaInFinestra(richiesta, adesso, giorni)) domanda.add(codiceProvincia);
    else scadute.add(codiceProvincia);
  }

  const baseline = [...PROVINCE_BASELINE];
  const domandaOrdine = [...domanda].sort((a, b) => a.localeCompare(b));
  const fuoriBaseline = domandaOrdine.filter((c) => !baseline.includes(c));
  const tutte = [...domandaOrdine, ...baseline.filter((c) => !domanda.has(c))];

  return {
    baseline,
    domanda: domandaOrdine,
    fuoriBaseline,
    tutte,
    scadute: [...scadute].sort((a, b) => a.localeCompare(b)),
    sconosciute: [...sconosciute].sort((a, b) => a.localeCompare(b)),
  };
}

/** Tetti di scuole per provincia (home visitate nel giro). */
export interface TettiScuole {
  /** Province con domanda attiva: `'tutte'` = l'anagrafica MIM intera. */
  domanda: TettoScuoleProvincia;
  /** Province di fondo: un campione, non l'elenco intero. */
  fondo: TettoScuoleProvincia;
}

/**
 * Tetto di HOME per provincia: un numero, oppure `'tutte'`.
 *
 * `'tutte'` esiste perché il 100% dell'anagrafica non è un numero: nessuno sa
 * quanti istituti abbia una provincia finché non la si legge, e un tetto alto
 * «abbastanza» sarebbe un campione travestito (§26.127).
 */
export const TUTTE_LE_SCUOLE = 'tutte' as const;

/** Un tetto di scuole per provincia: numero di home oppure `'tutte'`. */
export type TettoScuoleProvincia = number | typeof TUTTE_LE_SCUOLE;

/**
 * Quante scuole visitare per una provincia: il tetto della DOMANDA se qualcuno
 * l'ha chiesta, quello del FONDO altrimenti. Una provincia di cui non si sa
 * nulla non è una provincia con domanda zero: il fondo vale per tutte.
 *
 * Un tetto non positivo resta `0` (nessuna scuola): è il modo dichiarato di
 * spegnere il deep crawl, non un «tutte» implicito.
 */
export function tettoScuole(
  codiceProvincia: string,
  piano: PianoScansione,
  tetti: TettiScuole,
): TettoScuoleProvincia {
  const c = codice(codiceProvincia);
  const tetto = piano.domanda.includes(c) ? tetti.domanda : tetti.fondo;
  if (tetto === TUTTE_LE_SCUOLE) return TUTTE_LE_SCUOLE;
  return Number.isFinite(tetto) && tetto > 0 ? Math.floor(tetto) : 0;
}

/**
 * Etichetta leggibile di una provincia del catalogo (`'AT'` → `'Asti'`), per i
 * log del giro: `'ZZ'` resta `'ZZ'` — nessun nome inventato.
 */
export function nomeProvincia(codiceProvincia?: string | null): string {
  const c = codice(codiceProvincia);
  return province.find((p) => p.codice === c)?.nome ?? c;
}
