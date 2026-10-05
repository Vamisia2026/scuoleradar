/**
 * ScuoleRadar.it — PROSSIMITÀ GEOGRAFICA (modulo PURO, una sola regola).
 *
 * La PROVINCIA non è un vincolo a due stati («dentro» / «fuori»): ha TRE livelli,
 * misurati sulla DISTANZA in linea d'aria fra i capoluoghi.
 *
 *   1. provincia SELEZIONATA      → `PUNTEGGIO_PROVINCIA_PROPRIA` (100);
 *   2. provincia entro il RAGGIO  → `RAGGIO_PROVINCIA_KM` (60 km): la bacheca la
 *      mostra dichiarando lo scostamento, con una **grossa penalità** che cresce
 *      con la distanza (25 · 40 · 55 punti → 75 · 60 · 45);
 *   3. provincia OLTRE il raggio  → **esclusione d'ufficio**: Milano resta fuori
 *      per chi cerca Asti e non l'ha selezionata.
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
 * Province ENTRO il raggio (km, capoluogo↔capoluogo), escluse le selezionate.
 * Ordinata per distanza crescente (a pari distanza, per codice): l'ordine è
 * deterministico e leggibile nelle guardie.
 */
export function provinceEntroRaggio(
  selezionate: readonly string[] | null | undefined,
  raggioKm: number = RAGGIO_PROVINCIA_KM,
): string[] {
  const scelte = (selezionate ?? []).map(normalizzaProvincia).filter(Boolean);
  if (scelte.length === 0) return [];
  const vicine: { codice: string; km: number }[] = [];
  for (const codice of Object.keys(coordinateProvince)) {
    if (scelte.includes(codice)) continue;
    const km = Math.min(...scelte.map((s) => distanzaKm(s, codice) ?? Number.POSITIVE_INFINITY));
    if (km <= raggioKm) vicine.push({ codice, km });
  }
  return vicine
    .sort((a, b) => a.km - b.km || a.codice.localeCompare(b.codice))
    .map((v) => v.codice);
}

/**
 * Province da CERCARE nella bacheca: le proprie + quelle entro il raggio dei 60 km.
 * Lista VUOTA se il profilo non ha province: senza selezione la ricerca non ha
 * vincolo geografico e non c'è nulla da allargare.
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
 */
export function punteggioProvincia(
  selezionate: readonly string[] | null | undefined,
  provinciaAvviso?: string | null,
  opts: { limitrofe?: boolean; raggioKm?: number } = {},
): EsitoProvincia {
  const scelte = (selezionate ?? []).map(normalizzaProvincia).filter(Boolean);
  if (scelte.length === 0) return { stato: 'non-applicabile' };
  const avviso = normalizzaProvincia(provinciaAvviso);
  if (!avviso) return { stato: 'fuori', km: null, motivo: 'provincia dell’avviso non indicata' };
  if (scelte.includes(avviso)) {
    return { stato: 'propria', punteggio: PUNTEGGIO_PROVINCIA_PROPRIA, km: 0 };
  }
  if (opts.limitrofe !== true) {
    return { stato: 'fuori', km: distanzaKm(scelte[0], avviso), motivo: 'fuori dalle tue province' };
  }
  const raggio = opts.raggioKm ?? RAGGIO_PROVINCIA_KM;
  const piuVicina = scelte
    .map((s) => ({ codice: s, km: distanzaKm(s, avviso) }))
    .filter((v): v is { codice: string; km: number } => v.km !== null)
    .sort((a, b) => a.km - b.km || a.codice.localeCompare(b.codice))[0];
  if (!piuVicina) {
    return { stato: 'fuori', km: null, motivo: 'provincia dell’avviso non riconosciuta' };
  }
  if (piuVicina.km > raggio) {
    return {
      stato: 'fuori',
      km: piuVicina.km,
      motivo: `oltre il raggio di ${raggio} km (${piuVicina.km} km da ${piuVicina.codice})`,
    };
  }
  const km = piuVicina.km;
  return {
    stato: 'vicina',
    km,
    punteggio: PUNTEGGIO_PROVINCIA_PROPRIA - penalitaDistanza(km),
    motivo: `provincia vicina: ${piuVicina.codice} → ${avviso} (${km} km)`,
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
