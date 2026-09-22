/**
 * ScuoleRadar.it — PROMEMORIA 24h (modulo PURO, nessun I/O).
 *
 * Regola di servizio (anti-spam, elegante):
 *   · il digest consegna TUTTE le opportunità del giorno in UN solo messaggio;
 *   · se dopo **24 ore** un'opportunità ad **alta priorità** (scadenza entro
 *     3 giorni) non è ancora scaduta, parte UN SOLO promemoria;
 *   · **strict anti-duplicato**: il promemoria è per coppia (utente, interpello) —
 *     una volta sola, tracciata con il canale `promemoria` del ledger (DB +
 *     file). Nessun utente riceve due promemoria per lo stesso interpello.
 *
 * L'apertura della mail non è tracciabile in modo lecito: l'urgenza della
 * scadenza è il criterio oggettivo usato al posto della lettura.
 *
 * Questo modulo NON importa nulla di Node-only (solo `scadenza.ts`, puro): è
 * testabile in isolamento e riusabile da script, notifier e UI.
 */
import { giorniRimanenti } from './scadenza';

/** Ore minime fra la consegna e il promemoria (finestra "24h"). */
export const ORE_PROMEMORIA = 24;

/** Giorni di ALTA PRIORITÀ: entro questa soglia il promemoria è utile. */
export const GIORNI_URGENZA_PROMEMORIA = 3;

/**
 * Canale del ledger dedicato al promemoria (`notifications_log.canale`).
 * NB: il valore fa parte della chiave di deduplica: non cambiarlo senza migrare
 * le chiavi esistenti.
 */
export const CANALE_PROMEMORIA = 'promemoria';

/** Vista minima di un'opportunità per il calcolo del promemoria. */
export interface VocePromemoria {
  /** Hash dell'interpello: chiave della guardia anti-duplicato. */
  id?: string | null;
  title?: string | null;
  province?: string | null;
  /** Scadenza ISO (data o timestamp). */
  scadenza?: string | null;
}

/** Motivo dell'esito (log, test e diagnostica: mai un esito muto). */
export type MotivoPromemoria =
  | 'ok'
  | 'senza-id'
  | 'mai-inviata'
  | 'inviata-da-meno-di-24h'
  | 'gia-promemoria'
  | 'scaduta'
  | 'scadenza-non-urgente';

export interface OpzioniPromemoria {
  /** Istantaneo di riferimento (default: adesso). */
  adesso?: Date;
  /** Ore minime dalla consegna (default `ORE_PROMEMORIA` = 24). */
  oreMinime?: number;
  /** Soglia di alta priorità in giorni (default `GIORNI_URGENZA_PROMEMORIA` = 3). */
  giorniUrgenza?: number;
  /** True se un promemoria per QUESTA coppia (utente, interpello) è già partito. */
  giaPromemoria?: boolean;
}

/** Ore trascorse fra `inviataIl` e `adesso`; `null` se la data non è valida. */
export function oreTrascorse(inviataIl?: string | null, adesso: Date = new Date()): number | null {
  const s = (inviataIl ?? '').trim();
  if (!s) return null;
  const t = new Date(s).getTime();
  if (Number.isNaN(t)) return null;
  return (adesso.getTime() - t) / 3_600_000;
}

/**
 * True se la voce è ad ALTA PRIORITÀ: ha una scadenza reale, non è ancora
 * scaduta e manca poco (default: entro 3 giorni).
 */
export function eVoceUrgente(
  voce: VocePromemoria,
  opts: OpzioniPromemoria = {},
): boolean {
  const giorni = giorniRimanenti(voce.scadenza ?? null, opts.adesso ?? new Date());
  if (giorni === null || giorni < 0) return false;
  return giorni <= (opts.giorniUrgenza ?? GIORNI_URGENZA_PROMEMORIA);
}

/**
 * Motivo per cui un promemoria è (o non è) dovuto. Ordine dei controlli:
 * identità → storico di invio → finestra 24h → anti-duplicato → urgenza.
 */
export function motivoPromemoria(
  voce: VocePromemoria,
  inviataIl: string | null | undefined,
  opts: OpzioniPromemoria = {},
): MotivoPromemoria {
  if (!(voce.id ?? '').trim()) return 'senza-id';
  const ore = oreTrascorse(inviataIl, opts.adesso ?? new Date());
  if (ore === null) return 'mai-inviata';
  if (ore < (opts.oreMinime ?? ORE_PROMEMORIA)) return 'inviata-da-meno-di-24h';
  if (opts.giaPromemoria === true) return 'gia-promemoria';
  const giorni = giorniRimanenti(voce.scadenza ?? null, opts.adesso ?? new Date());
  if (giorni !== null && giorni < 0) return 'scaduta';
  return eVoceUrgente(voce, opts) ? 'ok' : 'scadenza-non-urgente';
}

/** True se il promemoria è dovuto (motivo `ok`). */
export function ePromemoriaDovuto(
  voce: VocePromemoria,
  inviataIl: string | null | undefined,
  opts: OpzioniPromemoria = {},
): boolean {
  return motivoPromemoria(voce, inviataIl, opts) === 'ok';
}

/**
 * Chiave del ledger per il promemoria di (utente, interpello).
 * Formato IDENTICO a `chiaveLedger('utente', `${userId}:${hash}`, 'promemoria')`
 * (verificato da `npm run test:promemoria`): qui è ricostruito senza importare
 * il modulo Node-only del ledger, così questo modulo resta puro.
 */
export function chiavePromemoria(userId: string, hash: string): string {
  return `utente|${userId}:${hash}|${CANALE_PROMEMORIA}`;
}
