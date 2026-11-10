/**
 * ScuoleRadar.it — IL BANNER DELLA SCANSIONE, DECISO FUORI DALLA UI (§26.146 → §26.151).
 *
 * Semplificato per parlare la lingua di chi cerca lavoro: zero allarmismi, zero gergo tecnico
 * e nessun numero inventato o fuorviante.
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

export type { MisuraScansione };

export type TonoScansione = 'standby' | 'live' | 'attivo' | 'in-ritardo' | 'guasta';

export interface TelemetriaScansione {
  ultimo_ciclo?: string | null;
  ultima_scansione?: string | null;
  cicli_24h?: number | null;
  scansionate_24h?: number | null;
  scarti?: number | null;
  pagine_in_coda?: number | null;
  fonti_whitelist?: number | null;
  province_coperte?: number | null;
  interpelli_attivi?: number | null;
  in_errore?: number | null;
  fonti_isolate?: readonly unknown[] | null;
  fonti_in_guasto?: number | null;
  ultima_run?: { errori?: number | null } | null;
}

export interface BannerScansione {
  tono: TonoScansione;
  badge: string;
  titolo: string;
  dettaglio: string;
  misure: readonly MisuraScansione[];
}

export const ORE_LIVE = 1.5;
export const ORE_PRIMA_DEL_RITARDO = 24;
export const ORE_CADENZA = 1;

function numero(valore: unknown): number | null {
  return typeof valore === 'number' && Number.isFinite(valore) ? valore : null;
}

export function oreDa(iso: string | null | undefined, adesso: Date = new Date()): number | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  return Math.max(0, (adesso.getTime() - t) / 3_600_000);
}

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

export function durataTrascorsa(ore: number | null): string {
  const testo = durataLeggibile(ore);
  return testo.endsWith(' fa') ? testo.slice(0, -3) : testo;
}

export function bannerScansione(
  telemetria: TelemetriaScansione | null | undefined,
  adesso: Date = new Date(),
): BannerScansione | null {
  if (!telemetria) return null;

  const iso = telemetria.ultimo_ciclo ?? telemetria.ultima_scansione ?? null;
  const ore = oreDa(iso, adesso);
  const relativo = durataLeggibile(ore);
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

  if (!finestraAperta(adesso)) return componi('standby', testiStandby(dati));
  if (ore === null) return componi('guasta', testiAvvio());
  if (ore >= ORE_PRIMA_DEL_RITARDO) return componi('in-ritardo', testiInAttesa(dati));
  if (ore < ORE_LIVE) return componi('live', testiInDiretta(dati));
  return componi('attivo', testiOperativo(dati));
}