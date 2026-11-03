/**
 * ScuoleRadar.it — PROSSIMITÀ GEOGRAFICA (modulo PURO, una sola regola).
 *
 * La PROVINCIA non è un vincolo a due stati («dentro» / «fuori»): ha TRE livelli,
 * misurati sulla DISTANZA in linea d'aria fra i capoluoghi.
 *
 *   1. provincia SELEZIONATA      → `PUNTEGGIO_PROVINCIA_PROPRIA` (100);
 *   2. provincia entro il RAGGIO  → `RAGGIO_PROVINCIA_KM` (60 km) **dalla sola
 *      provincia PRINCIPALE**: la bacheca la mostra dichiarando lo scostamento,
 *      con una **grossa penalità** che cresce con la distanza (25 · 40 · 55 punti
 *      → 75 · 60 · 45);
 *   3. provincia OLTRE il raggio  → **esclusione d'ufficio**: Milano resta fuori
 *      per chi cerca Asti e non l'ha selezionata.
 *
 * IL RAGGIO PARTE DALLA PRINCIPALE, LE SECONDARIE RESTANO STRETTE (§26.139,
 * direttiva 03/11/2026). Fino a oggi la distanza si misurava dal **più vicino**
 * dei codici selezionati, quindi anche una provincia SECONDARIA allargava la
 * ricerca: un profilo «AL + AT» vedeva gli avvisi entro 60 km da AT — Torino
 * (46 km da AT, 76 da AL), Verbania, e in generale province TERZE che l'utente
 * non aveva mai scelto. La regola ora è asimmetrica, ed è quella chiesta:
 *   · la **principale** (la prima selezionata, `lib/provinceRadar`) porta il
 *     raggio — Alessandria a 32 km da Asti entra anche senza AL in selezione,
 *     perché è la zona di lavoro quotidiana;
 *   · le **secondarie** sono una scelta di contenuto («voglio vedere anche gli
 *     avvisi di AL»), non un secondo centro di gravità: si vedono gli avvisi
 *     della provincia selezionata e basta, nessuna espansione cieca.
 *
 * CHI APPLICA COSA. La **bacheca** (`bachecaInterpelli` via `valutaCompatibilita`)
 * cerca anche le province entro il raggio e le penalizza; la **consegna**
 * (email/Telegram, digest) resta STRICT sulle province scelte: `limitrofe` è
 * un'opzione esplicita della bacheca, mai il default del motore.
 *
 * La distanza vive QUI — unica fonte di verità del confronto — e usa i dati di
 * `src/data/provinceCoordinate.ts` (capoluoghi, 2 decimali). `normalizzaProvincia`
 * è riesportata dal motore: nessuna copia del confronto.
 */
import { coordinateProvince, type CoordinataProvincia } from '../data/provinceCoordinate';
import { provinciaPrincipale } from './provinceRadar';

/** Raggio (km) entro cui una provincia non selezionata resta «vicina». */
export const RAGGIO_PROVINCIA_KM = 60;
/** Punteggio di un avviso nella provincia SELEZIONATA (match pieno). */
export const PUNTEGGIO_PROVINCIA_PROPRIA = 100;
/** Penalità (punti %) entro 20 km: la zona di lavoro quotidiana. */
export const PENALITA_PROVINCIA_20KM = 25;
/** Penalità (punti %) entro 40 km: raggiungibile, ma non è la propria provincia. */
export const PENALITA_PROVINCIA_40KM = 40;
/** Penalità (punti %) entro il raggio dei 60 km: il limite estremo ammesso. */
export const PENALITA_PROVINCIA_60KM = 55;

/** Raggio terrestre medio (km) per la formula di Haversine. */
const RAGGIO_TERRA_KM = 6371;
/** Gradi → radianti. */
const radianti = (gradi: number): number => (gradi * Math.PI) / 180;

/** Normalizza un codice provincia per il confronto (maiuscolo, senza spazi). */
export function normalizzaProvincia(codice?: string | null): string {
  return (codice ?? '').trim().toUpperCase();
}

/** Coordinate del capoluogo di una provincia (`src/data/provinceCoordinate.ts`). */
export function coordinateProvincia(codice?: string | null): CoordinataProvincia | null {
  const c = normalizzaProvincia(codice);
  if (!c) return null;
  return coordinateProvince[c] ?? null;
}

/**
 * Distanza in linea d'aria (km, arrotondata) fra due province. `null` quando una
 * delle due non ha coordinate note: meglio nessun giudizio che un giudizio a caso.
 */
export function distanzaKm(a?: string | null, b?: string | null): number | null {
  const ca = normalizzaProvincia(a);
  const cb = normalizzaProvincia(b);
  if (!ca || !cb) return null;
  if (ca === cb) return 0;
  const pa = coordinateProvincia(ca);
  const pb = coordinateProvincia(cb);
  if (!pa || !pb) return null;
  const dLat = radianti(pb.lat - pa.lat);
  const dLng = radianti(pb.lng - pa.lng);
  const lat1 = radianti(pa.lat);
  const lat2 = radianti(pb.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * RAGGIO_TERRA_KM * Math.asin(Math.min(1, Math.sqrt(h))));
}

/**
 * Province ENTRO il raggio (km, capoluogo↔capoluogo) misurato sulla **sola
 * provincia PRINCIPALE**, escluse quelle già selezionate. Ordinata per distanza
 * crescente (a pari distanza, per codice): l'ordine è deterministico e leggibile
 * nelle guardie.
 *
 * Perché solo dalla principale (§26.139): una secondaria non è un secondo centro
 * di gravità. Misurando il raggio da ognuna, un profilo «AL + AT» si portava in
 * casa Torino (46 km da AT ma 76 da AL) — una provincia terza mai scelta.
 */
export function provinceEntroRaggio(
  selezionate: readonly string[] | null | undefined,
  raggioKm: number = RAGGIO_PROVINCIA_KM,
): string[] {
  const scelte = [...new Set((selezionate ?? []).map(normalizzaProvincia).filter(Boolean))];
  const principale = provinciaPrincipale(scelte);
  if (!principale) return [];
  const vicine: { codice: string; km: number }[] = [];
  for (const codice of Object.keys(coordinateProvince)) {
    if (scelte.includes(codice)) continue;
    const km = distanzaKm(principale, codice);
    if (km !== null && km <= raggioKm) vicine.push({ codice, km });
  }
  return vicine
    .sort((a, b) => a.km - b.km || a.codice.localeCompare(b.codice))
    .map((v) => v.codice);
}

/**
 * Province da CERCARE nella bacheca: le proprie + quelle entro il raggio dei 60
 * km dalla PRINCIPALE (§26.139). Lista VUOTA se il profilo non ha province:
 * senza selezione la ricerca non ha vincolo geografico e non c'è nulla da
 * allargare.
 */
export function provinceDiRicerca(
  selezionate: readonly string[] | null | undefined,
  raggioKm: number = RAGGIO_PROVINCIA_KM,
): string[] {
  const scelte = [...new Set((selezionate ?? []).map(normalizzaProvincia).filter(Boolean))];
  if (scelte.length === 0) return [];
  return [...scelte, ...provinceEntroRaggio(scelte, raggioKm)];
}


/** Esito del giudizio geografico: proprio · vicino (penalizzato) · fuori (escluso). */
export type EsitoProvincia =
  /** Il profilo non ha province selezionate: la modale non entra nella media. */
  | { stato: 'non-applicabile' }
  /** Avviso nella provincia dell'utente: nessuno scostamento. */
  | { stato: 'propria'; punteggio: number; km: number }
  /** Avviso entro il raggio: punteggio penalizzato + distanza e motivo leggibili. */
  | { stato: 'vicina'; punteggio: number; km: number; motivo: string }
  /** Avviso oltre il raggio (o provincia ignota): esclusione d'ufficio. */
  | { stato: 'fuori'; km: number | null; motivo: string };

/** Penalità (punti %) di una distanza entro il raggio dei 60 km. */
export function penalitaDistanza(km: number): number {
  if (km <= 20) return PENALITA_PROVINCIA_20KM;
  if (km <= 40) return PENALITA_PROVINCIA_40KM;
  return PENALITA_PROVINCIA_60KM;
}

/**
 * Giudizio geografico di un'opportunità (Modalità 4 — Provincia).
 * `opts.limitrofe` (bacheca) ammette le province entro il raggio con la relativa
 * penalità; senza di essa vale SOLO la provincia selezionata (consegna strict).
 *
 * Il raggio si misura dalla **provincia principale** (§26.139): una secondaria
 * non porta in casa le province terze che le stanno intorno, mentre la
 * principale continua a farlo.
 */
export function punteggioProvincia(
  selezionate: readonly string[] | null | undefined,
  provinciaAvviso?: string | null,
  opts: { limitrofe?: boolean; raggioKm?: number } = {},
): EsitoProvincia {
  const scelte = (selezionate ?? []).map(normalizzaProvincia).filter(Boolean);
  const principale = provinciaPrincipale(scelte);
  if (!principale) return { stato: 'non-applicabile' };
  const avviso = normalizzaProvincia(provinciaAvviso);
  if (!avviso) return { stato: 'fuori', km: null, motivo: 'provincia dell’avviso non indicata' };
  if (scelte.includes(avviso)) {
    return { stato: 'propria', punteggio: PUNTEGGIO_PROVINCIA_PROPRIA, km: 0 };
  }
  if (opts.limitrofe !== true) {
    return { stato: 'fuori', km: distanzaKm(principale, avviso), motivo: 'fuori dalle tue province' };
  }
  const raggio = opts.raggioKm ?? RAGGIO_PROVINCIA_KM;
  const km = distanzaKm(principale, avviso);
  if (km === null) {
    return { stato: 'fuori', km: null, motivo: 'provincia dell’avviso non riconosciuta' };
  }
  if (km > raggio) {
    return {
      stato: 'fuori',
      km,
      motivo: `oltre il raggio di ${raggio} km (${km} km da ${principale})`,
    };
  }
  return {
    stato: 'vicina',
    km,
    punteggio: PUNTEGGIO_PROVINCIA_PROPRIA - penalitaDistanza(km),
    motivo: `provincia vicina: ${principale} → ${avviso} (${km} km)`,
  };
}

/**
 * True se un avviso appartiene a una provincia AMMESSA dal profilo: nessuna
 * provincia selezionata = nessun vincolo; stessa provincia = sempre ammessa;
 * entro il raggio = ammessa SOLO con `limitrofe` (la bacheca); fuori = mai.
 */
export function provinciaCompatibile(
  selezionate: readonly string[] | null | undefined,
  provinciaAvviso?: string | null,
  opts: { limitrofe?: boolean; raggioKm?: number } = {},
): boolean {
  const esito = punteggioProvincia(selezionate, provinciaAvviso, opts);
  if (esito.stato === 'non-applicabile') return true;
  return esito.stato === 'propria' || esito.stato === 'vicina';
}
