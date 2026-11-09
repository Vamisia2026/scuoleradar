/**
 * ScuoleRadar.it — IL BANNER DELLA SCANSIONE, DECISO FUORI DALLA UI (§26.146 → §26.151).
 *
 * Perché un modulo puro: la bacheca deve poter dire «ultimo controllo oggi alle 14:06» oppure
 * «502 bacheche scolastiche controllate nelle ultime 24 ore» SENZA inventare numeri quando la
 * telemetria manca. Le regole — quando il ciclo è in diretta, quando è vecchio, quando il
 * silenzio è un guasto e quando è soltanto orario di chiusura — sono qui, in funzioni senza rete
 * e senza orologio interno (l'istante arriva come argomento), così la guardia
 * `npm run test:telemetria-scansione` le verifica numero per numero.
 *
 * §26.151 — IL RADAR HA UN ORARIO DI LAVORO. Il ciclo della coda gira dal lunedì al venerdì fra
 * le 08:00 e le 17:00 (ora italiana, `finestraScansione`). Prima di questa sessione il banner
 * non sapeva distinguere «è domenica» da «il worker è morto», e l'unica cosa che poteva dire
 * era «nessun controllo da 30 ore» — vero e inutilmente allarmante. Adesso la finestra chiusa è
 * un tono a sé (`standby`), con la sua frase: «Radar in standby festivo/notturno · prossima
 * scansione automatica domattina alle 08:00». Un guasto resta un guasto solo quando la finestra
 * è APERTA e il silenzio continua.
 *
 * L'asse della freschezza resta uno solo — `live` → `attivo` → `in-ritardo` → `guasta` — con
 * `standby` davanti a tutti: se il radar ha l'orario di chiusura, l'età dell'ultimo giro non è
 * una notizia. Il testo non nomina le fonti temporaneamente sorde: la quarantena è materia del
 * pannello Admin (Linea Rossa, §26.110), non di una vetrina che deve dire «sto lavorando».
 *
 * CIÒ CHE NON CAMBIA È IL DIVIETO CHE REGGE TUTTO IL MODULO: NIENTE numeri inventati. Un campo
 * non letto è `null`, mai `0`, e uno `0` non diventa una rassicurazione. Anche «700+» è una
 * misura: è il numero vero arrotondato per difetto (`almenoCentinaia`), non una stima.
 *
 *   · `standby`    — finestra chiusa (notte, sabato, domenica): il radar riposa, e si sa quando riparte;
 *   · `live`       — ultimo ciclo sotto `ORE_LIVE`: il radar ha appena parlato;
 *   · `attivo`     — ultimo ciclo dentro le 24 ore;
 *   · `in-ritardo` — oltre `ORE_PRIMA_DEL_RITARDO` ore CON finestra aperta: il ciclo è fermo;
 *   · `guasta`     — nessun ciclo leggibile e finestra aperta: la freschezza non è dichiarabile;
 *   · `null`       — la telemetria non è arrivata: nessun banner, nessun numero finto.
 */
import { finestraAperta, quandoEsatto } from './finestraScansione';
import {
  compilaMisure,
  testiAvvio,
  testiInAttesa,
  testiInDiretta,
  testiOperativo,
  testiStandby,
  type DatiBanner,
  type MisuraScansione,
  type TestiBanner,
} from './telemetriaScansioneCopy';

// Il tipo dei numeri in evidenza vive nel gemello (che si occupa del COME): qui si
// ridichiara soltanto, perché chi legge il banner importa un modulo solo.
export type { MisuraScansione };


/**
 * I cinque stati che il banner sa raccontare (l'assenza è `null`, non un sesto stato).
 * `standby` è l'orario di lavoro (finestra chiusa), non un guasto: è il primo che si valuta,
 * perché di domenica l'età dell'ultimo ciclo non è una notizia.
 */
export type TonoScansione = 'standby' | 'live' | 'attivo' | 'in-ritardo' | 'guasta';

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
  /**
   * Avvisi scartati in archivio (`discovered_links` in stato di scarto): pagine vuote, domini
   * spenti, circolari fuori tema. È il rumore che il radar ha filtrato — §26.151 lo mostra,
   * perché è la parte di lavoro che l'insegnante non vede mai.
   */
  scarti?: number | null;
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
  /** Etichetta del badge: `STANDBY`, `IN DIRETTA`, `OPERATIVO`, `IN ATTESA`, `AL PRIMO GIRO`. */
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
 *
 * §26.151 — MA SOLO A FINESTRA APERTA. Con l'orario lun–ven 08:00–17:00 un silenzio notturno
 * non è un guasto: la soglia vale quindi all'interno della finestra (`finestraScansione`),
 * altrimenti ogni lunedì mattina il radar si sarebbe dichiarato rotto per il week-end.
 */
export const ORE_PRIMA_DEL_RITARDO = 24;

/**
 * Cadenza di riferimento del worker (ore): il copy non promette più di ciò che gira.
 * Dall'§26.151 la cadenza oraria vale DENTRO la finestra (lun–ven, 08:00–17:00): fuori il
 * radar non gira affatto, e il banner lo dice (`standby`) invece di fingere continuità.
 */
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
 * DECIDE IL BANNER. Prima la finestra (il radar ha un orario), poi la freschezza (il radar è
 * vivo?), e solo alla fine i numeri. Il testo non si scrive qui: `telemetriaScansioneCopy` ha
 * una funzione per tono, così «come si dice» resta verificabile da solo.
 *
 * LA REGOLA DEL `null` NON SI TOCCA: un campo non letto è `null` e produce una frase più
 * corta, mai uno zero rassicurante. La frase più onesta che questo banner sa dire è quella che
 * non dice.
 */
export function bannerScansione(
  telemetria: TelemetriaScansione | null | undefined,
  adesso: Date = new Date(),
): BannerScansione | null {
  if (!telemetria) return null;

  const iso = telemetria.ultimo_ciclo ?? telemetria.ultima_scansione ?? null;
  const ore = oreDa(iso, adesso);
  const relativo = durataLeggibile(ore);
  // Sotto l'ora la durata basta («14 minuti fa»); oltre, l'orologio è più chiaro («oggi alle
  // 14:06») e si torna sulle ore solo quando la data non è né di oggi né di ieri.
  const controllo =
    ore === null ? null : ore * 60 < 60 ? relativo : (quandoEsatto(iso, adesso) ?? relativo);

  const dati: DatiBanner = {
    controllo,
    trascorso: ore === null ? null : durataTrascorsa(ore),
    bacheche: numero(telemetria.scansionate_24h),
    scartati: numero(telemetria.scarti),
    posizioni: numero(telemetria.interpelli_attivi),
    province: numero(telemetria.province_coperte),
    adesso,
  };
  const misure = compilaMisure(dati);
  const componi = (tono: TonoScansione, testi: TestiBanner): BannerScansione => ({
    tono,
    ...testi,
    misure,
  });

  // 1. La finestra viene prima di tutto: di domenica alle 22:00 non c'è niente da diagnosticare.
  if (!finestraAperta(adesso)) return componi('standby', testiStandby(dati));
  // 2. Finestra aperta e nessun ciclo registrato: primo avvio, non guasto.
  if (ore === null) return componi('guasta', testiAvvio());
  // 3. Silenzio oltre il giorno CON la finestra aperta: questo è un guasto, e si dice piano.
  if (ore >= ORE_PRIMA_DEL_RITARDO) return componi('in-ritardo', testiInAttesa(dati));
  // 4. Ciclo appena chiuso: la notizia è che il radar è vivo e cosa ha portato a casa.
  if (ore < ORE_LIVE) return componi('live', testiInDiretta(dati));
  return componi('attivo', testiOperativo(dati));
}


