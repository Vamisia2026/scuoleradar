/**
 * ScuoleRadar.it — IL BANNER DELLA SCANSIONE, DECISO FUORI DALLA UI (§26.146 → §26.150).
 *
 * Perché un modulo puro: la bacheca deve poter dire «ultimo giro 14 minuti fa» oppure «712
 * opportunità attive rilevate» SENZA inventare numeri quando la telemetria manca. Le regole —
 * quando il ciclo è in diretta, quando è vecchio, quando il silenzio è un guasto — sono qui, in
 * funzioni senza rete e senza orologio interno (l'istante arriva come argomento), così la
 * guardia `npm run test:telemetria-scansione` le verifica numero per numero.
 *
 * §26.150 — IL REGISTRO È «PROVA DI LAVORO». Il banner non è una diagnosi e non è una
 * querela: dice quanto il radar ha lavorato (pagine lette nelle 24 ore), quante fonti ha
 * chiuso senza errori, quante opportunità ne sono uscite, e da quanto è fermo l'ultimo giro.
 * L'asse resta uno solo — la FRESCHEZZA (`live` → `attivo` → `in-ritardo` → `guasta`) — ma il
 * testo non nomina più le fonti temporaneamente sorde: la quarantena è materia del pannello
 * Admin (Linea Rossa, §26.110), non di una vetrina commerciale che deve dire «sto lavorando».
 *
 * CIÒ CHE NON CAMBIA È IL DIVIETO CHE REGGE TUTTO IL MODULO: NIENTE numeri inventati. Un campo
 * non letto è `null`, mai `0`, e uno `0` non diventa una rassicurazione. Anche «700+» è una
 * misura: è il numero vero arrotondato per difetto (`almenoCentinaia`), non una stima.
 *
 *   · `live`       — ultimo ciclo sotto `ORE_LIVE`: il radar ha appena parlato;
 *   · `attivo`     — ultimo ciclo dentro le 24 ore;
 *   · `in-ritardo` — oltre `ORE_PRIMA_DEL_RITARDO` ore: il ciclo automatico è fermo;
 *   · `guasta`     — nessun ciclo leggibile: la freschezza non è dichiarabile;
 *   · `null`       — la telemetria non è arrivata: nessun banner, nessun numero finto.
 */
import {
  almenoCentinaia,
  compilaMisure,
  fontiElaborate,
  fraseFonti,
  fraseGiro,
  fraseScansioni,
  maiuscola,
  type MisuraScansione,
} from './telemetriaScansioneCopy';

// Il tipo dei numeri in evidenza vive nel gemello (che si occupa del COME): qui si
// ridichiara soltanto, perché chi legge il banner importa un modulo solo.
export type { MisuraScansione };

/** I quattro stati che il banner sa raccontare (l'assenza è `null`, non un quinto stato). */
export type TonoScansione = 'live' | 'attivo' | 'in-ritardo' | 'guasta';

/**
 * Ciò che serve al banner. Tutto opzionale: un campo assente significa «la Edge non
 * l'ha letto», e un numero non letto NON è uno zero.
 */
export interface TelemetriaScansione {
  /** Segnale di vita più recente della pipeline (ISO): preferito a `ultima_scansione`. */
  ultimo_ciclo?: string | null;
  /** Fine dell'ultimo giro di ingestione (ISO) — ripiego quando `ultimo_ciclo` manca. */
  ultima_scansione?: string | null;
  /** Giri registrati nelle ultime 24 ore (`null` = non letto). */
  cicli_24h?: number | null;
  /** Pagine/sorgenti lette nelle ultime 24 ore: la misura del lavoro del radar. */
  scansionate_24h?: number | null;
  /** Pagine ancora da leggere in coda. */
  pagine_in_coda?: number | null;
  /** Sorgenti in ascolto (whitelist attiva). */
  fonti_whitelist?: number | null;
  /** Province coperte da almeno una sorgente attiva. */
  province_coperte?: number | null;
  /** Avvisi vivi in archivio: le opportunità che il radar ha «trovato». */
  interpelli_attivi?: number | null;
  /** Fonti in errore nell'ultimo giro: servono a contare le fonti riuscite. */
  in_errore?: number | null;
  /**
   * Fonti in quarantena. NON entrano più nel testo (§26.150: i dettagli sulle fonti
   * temporaneamente sorde si leggono nel pannello Admin), ma restano nel contratto perché
   * le legge `sourceQuarantine` e la telemetria del crawler non si spezza.
   */
  fonti_isolate?: readonly unknown[] | null;
  /** Fonti che sbagliano senza essere ancora isolate (`null` = non letto). */
  fonti_in_guasto?: number | null;
  /** Esito dell'ultima run: gli errori sono la seconda fonte del conteggio. */
  ultima_run?: { errori?: number | null } | null;
}

/** Righe pronte per la UI: testo già scritto, badge deciso, nessun numero da formattare. */
export interface BannerScansione {
  tono: TonoScansione;
  /** Etichetta del badge: `LIVE`, `OPERATIVO`, `IN ATTESA`, `IN AVVIO`. */
  badge: string;
  titolo: string;
  dettaglio: string;
  /** Numeri MISURATI, nell'ordine in cui si leggono (mai un campo non letto). */
  misure: readonly MisuraScansione[];
}

/** Sotto questa distanza l'ultimo ciclo è «in diretta»: il radar ha appena parlato. */
export const ORE_LIVE = 1.5;

/**
 * Oltre un giorno senza NESSUN ciclo il motore è fermo. Fino a §26.146 erano 48 h perché
 * la finestra delle fonti è di due giorni e la cadenza era quotidiana; dal ciclo orario
 * (§26.149) un giorno intero di silenzio è già un guasto, non una finestra fisiologica.
 */
export const ORE_PRIMA_DEL_RITARDO = 24;

/** Cadenza di riferimento del worker (ore): il copy non promette più di ciò che gira. */
export const ORE_CADENZA = 1;

/** Numero finito oppure `null`: i valori sporchi della rete non diventano zeri. */
function numero(valore: unknown): number | null {
  return typeof valore === 'number' && Number.isFinite(valore) ? valore : null;
}

/**
 * Ore passate da un istante ISO: `null` se la data manca o non è leggibile (mai
 * «zero ore fa», che sarebbe una freschezza inventata). Un istante nel futuro vale 0.
 */
export function oreDa(iso: string | null | undefined, adesso: Date = new Date()): number | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  return Math.max(0, (adesso.getTime() - t) / 3_600_000);
}

/**
 * Durata in parole, dalla più fine: «adesso», «14 minuti fa», «2 ore fa», «30 ore fa».
 *
 * §26.150 — MAI IN GIORNI. Il banner dichiara la freschezza di un impianto che gira ogni
 * ora: «ieri» e «2 giorni fa» sono unità di misura sbagliate per un ciclo orario e, in un
 * riquadro che deve dire «sto lavorando», suonano come un referto. Le ore restano ore anche
 * oltre le 48: un silenzio di trenta ore si legge «30 ore fa», non «ieri».
 */
export function durataLeggibile(ore: number | null): string {
  if (ore === null) return 'non registrata';
  const minuti = ore * 60;
  if (minuti < 1) return 'adesso';
  if (minuti < 60) {
    const n = Math.round(minuti);
    return n === 1 ? 'un minuto fa' : `${n} minuti fa`;
  }
  const oreTonde = Math.max(1, Math.round(ore));
  return oreTonde === 1 ? "un'ora fa" : `${oreTonde} ore fa`;
}

/** La stessa durata senza «fa»: serve al titolo dell'attesa («Ultimo giro 30 ore fa»). */
export function durataTrascorsa(ore: number | null): string {
  const testo = durataLeggibile(ore);
  return testo.endsWith(' fa') ? testo.slice(0, -3) : testo;
}

/**
 * DECIDE IL BANNER. La freschezza sceglie il tono; i numeri MISURATI riempiono titolo,
 * dettaglio e chip. Niente quarantena, niente conteggio degli errori nel testo (§26.150): il
 * banner dice quanto il radar ha lavorato, e i dettagli sulle fonti sorde restano nel
 * pannello Admin. Ciò che non sparisce è la regola del `null`: un campo non letto non produce
 * né una cifra né una frase.
 */
export function bannerScansione(
  telemetria: TelemetriaScansione | null | undefined,
  adesso: Date = new Date(),
): BannerScansione | null {
  if (!telemetria) return null;

  const ore = oreDa(telemetria.ultimo_ciclo ?? telemetria.ultima_scansione, adesso);
  const quando = durataLeggibile(ore);
  const scansioni = numero(telemetria.scansionate_24h);
  const sorgenti = numero(telemetria.fonti_whitelist);
  const province = numero(telemetria.province_coperte);
  const avvisi = numero(telemetria.interpelli_attivi);
  // Gli errori arrivano da tre campi: vince il primo letto. Se NESSUNO è letto, il numero
  // delle fonti riuscite non è dichiarabile (`null`) e non si dice «tutte ok».
  const errori =
    numero(telemetria.in_errore) ??
    numero(telemetria.fonti_in_guasto) ??
    numero(telemetria.ultima_run?.errori);
  const elaborate = fontiElaborate(sorgenti, errori);
  const misure = compilaMisure({ scansioni, fonti: elaborate, avvisi, province });
  /** «ultimo giro 14 minuti fa · 1.284 pagine lette… · 128 fonti elaborate…» */
  const lavoro = [fraseGiro(quando), fraseScansioni(scansioni), fraseFonti(elaborate)].filter(
    (parte): parte is string => Boolean(parte),
  );
  const dettaglio = `${maiuscola(lavoro.join(' · '))}.`;

  if (ore === null) {
    return {
      tono: 'guasta',
      badge: 'IN AVVIO',
      titolo: 'Radar in avvio · primo giro in corso',
      dettaglio:
        'Il primo ciclo non è ancora registrato: le opportunità in bacheca vengono dagli albi ' +
        'già letti, non da un archivio vuoto.',
      misure,
    };
  }

  if (ore >= ORE_PRIMA_DEL_RITARDO) {
    // Nessun allarme nel tono: si dichiara l'età dell'ultimo giro e cosa succede adesso.
    return {
      tono: 'in-ritardo',
      badge: 'IN ATTESA',
      titolo: `Ultimo giro ${durataTrascorsa(ore)} fa`,
      dettaglio:
        `${dettaglio} Il ciclo automatico è orario: la bacheca si riallinea al prossimo giro, ` +
        'e la scadenza di ogni avviso resta quella pubblicata.',
      misure,
    };
  }

  if (ore < ORE_LIVE) {
    return {
      tono: 'live',
      badge: 'LIVE',
      titolo:
        avvisi !== null
          ? `Radar in tempo reale · ${almenoCentinaia(avvisi)} opportunità attive rilevate`
          : 'Radar in tempo reale · ciclo appena completato',
      dettaglio,
      misure,
    };
  }

  return {
    tono: 'attivo',
    badge: 'OPERATIVO',
    titolo:
      province !== null
        ? `Radar operativo · copertura su ${province} province`
        : 'Radar operativo · copertura continua',
    dettaglio,
    misure,
  };
}


