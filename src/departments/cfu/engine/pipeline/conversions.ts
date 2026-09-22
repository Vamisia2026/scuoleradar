/**
 * ScuoleRadar.it — Dipartimento CFU · engine/pipeline/conversions.
 *
 * CONVERSIONI REQUISITO ↔ VINCOLO COMPUTABILE.
 * Il requisito è la rappresentazione STRUTTURATA della fonte; il vincolo
 * (`VincoloCfu`) è la forma computabile riusata dal solver. La conversione è
 * reversibile (`vincoloDaRequisito`) così la valutazione non duplica la
 * semantica di conteggio.
 */
import type { VincoloCfu } from '../types';
import type { NaturaRequisitoAggregato } from './resultTypes';
import type { DefinizioneRequisito, ParametriRequisito, TipoRequisito } from './requirementTypes';

/** Strategia di valutazione associata a ciascun tipo di requisito. */
export const STRATEGIA_PER_TIPO: Readonly<Record<TipoRequisito, string>> = {
  'cfu.ssd.singolo': 'cfu.ssd.v1',
  'cfu.ssd.gruppo': 'cfu.ssd.v1',
  'cfu.ssd.disgiunzione': 'cfu.ssd.v1',
  'titolo.abilitante': 'titolo.abilitante.v1',
  'titolo.accesso.classe': 'titolo.accesso.classe.v1',
};

/** Finestra di vigenza dichiarata dalla fonte (null = non dichiarata). */
export type FinestraVigenza =
  | { readonly validFrom: string; readonly validUntil?: string | null }
  | null;

/** Tipo di requisito corrispondente al vincolo dichiarato dalla fonte. */
export function tipoRequisitoDaVincolo(vincolo: VincoloCfu): TipoRequisito {
  switch (vincolo.tipo) {
    case 'singoloSsd':
      return 'cfu.ssd.singolo';
    case 'gruppoSsd':
      return 'cfu.ssd.gruppo';
    case 'disgiunzioneSsd':
      return 'cfu.ssd.disgiunzione';
    case 'titoloAbilitante':
      return 'titolo.abilitante';
  }
}

/** Parametri strutturati del requisito, fedeli al vincolo dichiarato. */
export function parametriDaVincolo(vincolo: VincoloCfu): ParametriRequisito {
  switch (vincolo.tipo) {
    case 'singoloSsd':
      return {
        tipo: 'cfu.ssd.singolo',
        ssd: vincolo.ssd,
        min: vincolo.min,
        max: vincolo.max ?? null,
        nota: vincolo.nota ?? null,
      };
    case 'gruppoSsd':
      return {
        tipo: 'cfu.ssd.gruppo',
        ssd: [...vincolo.ssd],
        min: vincolo.min,
        minPerSsd: vincolo.minPerSsd ?? null,
        minUnoDeiSsd: vincolo.minUnoDeiSsd ?? null,
        max: vincolo.max ?? null,
        distribuzione: vincolo.distribuzione ?? null,
      };
    case 'disgiunzioneSsd':
      return {
        tipo: 'cfu.ssd.disgiunzione',
        opzioni: vincolo.opzioni.map((opzione) => ({
          id: opzione.id,
          ssd: [...opzione.ssd],
          min: opzione.min,
          ...(opzione.nota !== undefined ? { nota: opzione.nota } : {}),
        })),
        disgiunzioneEsplicita: vincolo.disgiunzioneEsplicita,
      };
    case 'titoloAbilitante':
      return {
        tipo: 'titolo.abilitante',
        denominazione: vincolo.denominazione,
        necessario: vincolo.necessario,
        alternativoA: [...(vincolo.alternativoA ?? [])],
      };
  }
}

/**
 * Ricostruisce il vincolo computabile dal requisito (round-trip esatto).
 * Restituisce null per i tipi senza vincolo CFU (es. classe di accesso).
 */
export function vincoloDaRequisito(requisito: DefinizioneRequisito): VincoloCfu | null {
  const evidenza = requisito.evidenze[0];
  if (!evidenza) return null;
  const base = {
    id: requisito.id,
    sourceExcerpt: evidenza.estrattoVerbatim,
    sourceLocation: evidenza.posizioneFonte,
  };
  const p = requisito.parametri;
  switch (p.tipo) {
    case 'cfu.ssd.singolo':
      return {
        ...base,
        tipo: 'singoloSsd',
        ssd: p.ssd,
        min: p.min,
        ...(p.max !== null ? { max: p.max } : {}),
        ...(p.nota !== null ? { nota: p.nota } : {}),
      };
    case 'cfu.ssd.gruppo':
      return {
        ...base,
        tipo: 'gruppoSsd',
        ssd: [...p.ssd],
        min: p.min,
        ...(p.minPerSsd !== null ? { minPerSsd: p.minPerSsd } : {}),
        ...(p.minUnoDeiSsd !== null ? { minUnoDeiSsd: p.minUnoDeiSsd } : {}),
        ...(p.max !== null ? { max: p.max } : {}),
        ...(p.distribuzione !== null ? { distribuzione: p.distribuzione } : {}),
      };
    case 'cfu.ssd.disgiunzione':
      return {
        ...base,
        tipo: 'disgiunzioneSsd',
        opzioni: p.opzioni.map((opzione) => ({
          id: opzione.id,
          ssd: [...opzione.ssd],
          min: opzione.min,
          ...(opzione.nota !== undefined ? { nota: opzione.nota } : {}),
        })),
        disgiunzioneEsplicita: p.disgiunzioneEsplicita,
      };
    case 'titolo.abilitante':
      return {
        ...base,
        tipo: 'titoloAbilitante',
        denominazione: p.denominazione,
        necessario: p.necessario,
        ...(p.alternativoA.length > 0 ? { alternativoA: [...p.alternativoA] } : {}),
      };
    default:
      return null;
  }
}

/**
 * NATURA di aggregazione dichiarata dal tipo di requisito (fase 5 — A5).
 * Dichiarata QUI, alla risoluzione: l'aggregazione di stato legge il fatto di
 * requisito (`natura`), non il tipo testuale. `null` = tipo non mappato: il
 * requisito non può contribuire a un verdetto positivo (R2).
 */
export function naturaDaTipo(tipo: string): NaturaRequisitoAggregato | null {
  if (tipo.startsWith('cfu.ssd.')) return 'cfu';
  if (tipo === 'titolo.abilitante') return 'titolo';
  if (tipo === 'titolo.accesso.classe') return 'accesso';
  return null;
}

