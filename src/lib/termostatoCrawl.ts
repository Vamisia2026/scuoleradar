/**
 * ScuoleRadar.it — IL TERMOSTATO DEL CRAWLER: la soglia degli avvisi attivi
 * (§26.127).
 *
 * PERCHÉ ESISTE. Fino al §26.126 l'aggressività del giro era una costante: 60
 * scuole per la provincia in domanda, 8 per quelle di fondo, sempre. Due
 * conseguenze opposte e tutte e due sbagliate:
 *   · con la bacheca quasi vuota (poche centinaia di avvisi) il crawler
 *     scandiva lo stesso campione di quando ne aveva migliaia: il Radar restava
 *     povero mentre la rete era libera;
 *   · con la bacheca piena, ogni giro ripeteva la stessa spesa per riconfermare
 *     ciò che era già in archivio.
 *
 * Qui vive la REGOLA che lega l'intensità del giro al FABBISOGNO REALE: quanti
 * avvisi attivi ci sono adesso in `interpelli` (la stessa popolazione che il
 * Radar Live conta e mostra: `expiration_date >= oggi`).
 *
 * TRE REGIMI, UNA SOLA SOGLIA DI RIFERIMENTO
 *
 *   carenza     attivi <  SOGLIA (1.000)          → giro esteso
 *   equilibrio  SOGLIA ≤ attivi < SOGLIA+ISTERESI → giro standard
 *   saturo      attivi ≥ SOGLIA+ISTERESI (1.150)  → giro ridotto
 *
 * La soglia è un RIFERIMENTO DI LAVORO, non un numero da raggiungere: il
 * conteggio che si vede in vetrina è quello vero del database, e nessuna riga
 * viene creata per «arrivare a 1.000». Il numero fluttua perché il crawler
 * aggiunge ciò che le fonti hanno pubblicato e il tempo toglie ciò che scade.
 * Per questo `margine` è `soglia - attivi` SENZA alcun taglio: chi legge il log
 * vede la distanza reale, anche quando è `-2.421`.
 *
 * La FASCIA MORTA (1.000 → 1.150) è l'isteresi: senza di essa ogni avviso in più
 * o in meno farebbe passare da «esteso» a «ridotto», e il crawler passerebbe la
 * giornata a cambiare regime invece di leggere. Superata la soglia si rallenta
 * solo quando il margine è davvero acquisito; si torna al giro esteso solo
 * quando la scadenza naturale riporta l'archivio sotto il riferimento.
 *
 * COSA NON REGOLA MAI: la provincia che un utente ha chiesto. Il regime cambia
 * il CAMPIONE NAZIONALE (quante scuole di fondo per provincia) e la PROFONDITÀ
 * DEGLI HUB regionali/provinciali, mai la copertura di chi sta aspettando: una
 * domanda si serve al 100% anche a bacheca piena (§26.126, «priorità ≠ filtro»).
 *
 * PURA e senza I/O: la lettura del conteggio sta nel worker
 * (`scripts/lib/domandaProvincia.ts`), l'applicazione dei tetti in
 * `scripts/crawl-mvp.ts`. Guardia: `npm run test:termostato-crawl`.
 */
import { TUTTE_LE_SCUOLE, type TettoScuoleProvincia } from './mvpPerimetro';

/**
 * Riferimento di lavoro: sotto questo numero di avvisi attivi il crawler passa
 * al regime esteso. Non è un obiettivo da raggiungere e non è mai un numero
 * scritto in bacheca.
 */
export const SOGLIA_AVVISI_ATTIVI = 1000;

/**
 * FASCIA MORTA sopra la soglia (1.000 → 1.150): si rallenta solo quando il
 * margine è acquisito, così un avviso in più non cambia il regime del giro.
 */
export const ISTERESI_AVVISI = 150;

/** I tre regimi dichiarati, dal più affamato al più prudente. */
export type RegimeTermostato = 'carenza' | 'equilibrio' | 'saturo';

/**
 * Profondità di lettura degli hub regionali/provinciali: sono le stesse chiavi
 * della politica di sgranatura (`src/scraper/sgranatura.ts`), che il worker
 * traduce in variabili d'ambiente.
 */
export interface TaratureHub {
  /** Documenti aperti per una singola pagina-elenco (portale regionale). */
  perElenco: number;
  /** Pagine di un elenco lette per target. */
  pagineElenco: number;
  /** Documenti aperti in un intero giro. */
  perGiro: number;
}

/** Cosa cambia fra un regime e l'altro: due numeri per provincia, tre per gli hub. */
export interface TaratureTermostato {
  /** Scuole per provincia RICHIESTA: `'tutte'` = l'anagrafica MIM intera. */
  scuoleDomanda: TettoScuoleProvincia;
  /** Scuole per provincia di FONDO (il campione nazionale del giro). */
  scuoleFondo: number;
  /** Profondità degli hub regionali/provinciali. */
  hub: TaratureHub;
}

/**
 * Le tarature dei tre regimi.
 *
 * `scuoleDomanda` è `'tutte'` in TUTTI i regimi: la provincia che qualcuno sta
 * aspettando si legge al 100% (§26.127, direttiva 2). Ciò che il termostato
 * spegne è il CAMPIONE NAZIONALE e la profondità degli hub.
 *
 * I numeri di `equilibrio` sono i default storici (§26.101): 8 scuole di fondo,
 * 40 documenti per elenco, 3 pagine di elenco, 2.500 aperture per giro. Gli
 * altri due regimi li moltiplicano o li riducono, senza toccare nessuna regola
 * di qualità: la scadenza deve restare dichiarata, la scuola certificata e il
 * link quello del singolo avviso.
 */
export const TARATURE_TERMOSTATO: Readonly<Record<RegimeTermostato, TaratureTermostato>> = {
  carenza: {
    scuoleDomanda: TUTTE_LE_SCUOLE,
    scuoleFondo: 20,
    hub: { perElenco: 80, pagineElenco: 6, perGiro: 4_000 },
  },
  equilibrio: {
    scuoleDomanda: TUTTE_LE_SCUOLE,
    scuoleFondo: 8,
    hub: { perElenco: 40, pagineElenco: 3, perGiro: 2_500 },
  },
  saturo: {
    scuoleDomanda: TUTTE_LE_SCUOLE,
    scuoleFondo: 3,
    hub: { perElenco: 25, pagineElenco: 2, perGiro: 1_500 },
  },
};

/** Opzioni della lettura (i test fissano soglia e isteresi senza ambiente). */
export interface OpzioniTermostato {
  soglia?: number;
  isteresi?: number;
}

/** La lettura completa: il regime, le tarature e la frase da mettere nel log. */
export interface LetturaTermostato {
  /** Avvisi attivi contati nel database (`null` = conteggio non disponibile). */
  attivi: number | null;
  soglia: number;
  isteresi: number;
  regime: RegimeTermostato;
  /** True quando il conteggio non è arrivato: si resta sulle tarature standard. */
  ignoto: boolean;
  /** `soglia - attivi`, mai tagliato: negativo quando l'archivio è sopra. */
  margine: number | null;
  /** Quanti avvisi mancano al riferimento (0 quando è già raggiunto). */
  mancanti: number;
  tarature: TaratureTermostato;
  /** Riga dichiarativa per il log del giro. */
  frase: string;
}

/** Migliaia con il punto, deterministiche anche dove l'ICU è ridotto. */
function conPunti(n: number): string {
  return String(Math.trunc(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

/**
 * Regime di un conteggio. `attivi` non finito o negativo è carenza: se il numero
 * non è credibile, meglio leggere troppo che restare fermi.
 */
export function regimePer(
  attivi: number,
  soglia: number = SOGLIA_AVVISI_ATTIVI,
  isteresi: number = ISTERESI_AVVISI,
): RegimeTermostato {
  if (!Number.isFinite(attivi) || attivi < soglia) return 'carenza';
  if (attivi < soglia + Math.max(0, isteresi)) return 'equilibrio';
  return 'saturo';
}

/**
 * LEGGE IL TERMOSTATO. Il conteggio passa così com'è: nessun taglio alla soglia,
 * nessun arrotondamento (è la garanzia che il numero in vetrina resti vero).
 * Con il conteggio assente si usano le tarature di `equilibrio` e la frase lo
 * dichiara — un guasto di rete non deve né fermare il giro né farlo esplodere.
 */
export function leggiTermostato(
  attivi: number | null | undefined,
  opts: OpzioniTermostato = {},
): LetturaTermostato {
  const soglia = Number.isFinite(opts.soglia) ? Number(opts.soglia) : SOGLIA_AVVISI_ATTIVI;
  const isteresi = Number.isFinite(opts.isteresi) ? Number(opts.isteresi) : ISTERESI_AVVISI;
  const ignoto = typeof attivi !== 'number' || !Number.isFinite(attivi);
  const regime: RegimeTermostato = ignoto ? 'equilibrio' : regimePer(attivi, soglia, isteresi);
  const tarature = TARATURE_TERMOSTATO[regime];
  const margine = ignoto ? null : soglia - (attivi as number);
  const mancanti = margine === null ? 0 : Math.max(0, margine);

  const frase = ignoto
    ? 'conteggio degli avvisi attivi non disponibile — tarature di equilibrio ' +
      `(${tarature.scuoleFondo} scuole di fondo, ${tarature.hub.perElenco} documenti per elenco)`
    : regime === 'carenza'
      ? `carenza: ${conPunti(attivi as number)} avvisi attivi su ${conPunti(soglia)} di ` +
        `riferimento (${conPunti(mancanti)} mancanti) — giro esteso: ` +
        `${tarature.scuoleFondo} scuole di fondo, hub a ${tarature.hub.perElenco} documenti per elenco`
      : regime === 'equilibrio'
        ? `equilibrio: ${conPunti(attivi as number)} avvisi attivi (riferimento ` +
          `${conPunti(soglia)}, fascia morta fino a ${conPunti(soglia + isteresi)}) — ` +
          `${tarature.scuoleFondo} scuole di fondo, hub a ${tarature.hub.perElenco} documenti per elenco`
        : `saturo: ${conPunti(attivi as number)} avvisi attivi sopra ` +
          `${conPunti(soglia + isteresi)} — rallento: ${tarature.scuoleFondo} scuole di fondo, ` +
          `hub a ${tarature.hub.perElenco} documenti per elenco`;

  return {
    attivi: ignoto ? null : (attivi as number),
    soglia,
    isteresi,
    regime,
    ignoto,
    margine,
    mancanti,
    tarature,
    frase,
  };
}
