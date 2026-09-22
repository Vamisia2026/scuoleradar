/**
 * ScuoleRadar.it — FREQUENCY CAP delle notifiche personali (modulo PURO).
 *
 * Regola di servizio (dal Dipartimento Comunicazione, checklist immutabili):
 *   · una STESSA opportunità — riconosciuta da **scuola + classi + impronta del
 *     contenuto** — può essere inviata a un utente **al massimo 2 volte, in 2
 *     giorni diversi**;
 *   · **mai due volte nello stesso giorno**, qualunque sia il canale/flusso
 *     (alert PRO in tempo reale, digest alle 17:00, promemoria);
 *   · se la scuola **ripubblica/aggiorna** l'avviso con un **contenuto nuovo**
 *     (impronta diversa) è una NUOVA opportunità: il contatore riparte.
 *
 * Perché il modulo è separato e puro: la logica di conteggio è la parte delicata
 * (anti-spam) e deve essere testabile in isolamento, senza rete né DB
 * (`npm run test:frequenza`). L'I/O del ledger resta in `ledgerLocale.ts` /
 * `notifier.ts`.
 *
 * NOTA sull'impronta del contenuto: si riusa `normalizzaPerImpronta` di
 * `dedupAvvisi.ts`, che elimina date, protocolli e numeri d'ordine. Così la
 * stessa notizia ri-scrapata con rumore ("prot. n. 1234 del 16/09/2026") mantiene
 * la STESSA identità e NON consuma un invio in più, mentre un aggiornamento
 * reale del testo produce un'impronta diversa.
 */
import { normalizzaPerImpronta } from './dedupAvvisi';
import { normalizzaClasse } from './matchingEngine';
import { dataLocaleItalia } from './digest';

/** Numero MASSIMO di invii della stessa opportunità allo stesso utente. */
export const MAX_INVII_OPPORTUNITA = 2;

/** Giorni distinti entro cui distribuire gli invii (2 invii in 2 giorni). */
export const GIORNI_MASSIMI_OPPORTUNITA = MAX_INVII_OPPORTUNITA;

/** Lunghezza minima del contenuto normalizzato per considerare valida l'identità. */
const MIN_CONTENUTO_IDENTITA = 12;

/** Vista minima di un'opportunità per il calcolo dell'identità di frequenza. */
export interface AvvisoFrequenza {
  title?: string | null;
  schoolName?: string | null;
  classi?: readonly string[] | null;
}

/**
 * Hash FNV-1a (32 bit, esadecimale) del contenuto normalizzato.
 * Deterministico e senza dipendenze: lo stesso testo produce sempre lo stesso
 * hash, su qualsiasi runtime (Node, Deno, browser).
 */
export function hashContenuto(testo: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < testo.length; i += 1) {
    h ^= testo.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

/**
 * Identità di FREQUENZA dell'opportunità: `scuola|classi|hashContenuto`.
 *
 * - `scuola`: nome normalizzato (può essere vuoto per gli avvisi degli uffici
 *   scolastici: in quel caso l'identità resta valida grazie a classi+contenuto);
 * - `classi`: codici normalizzati e ordinati (`A-022` ≡ `A-22`);
 * - `hashContenuto`: hash del titolo normalizzato (senza date/protocolli).
 *
 * Ritorna `null` quando il contenuto non è abbastanza informativo: in quel caso
 * il chiamante deve restare sul comportamento storico (nessun cap "inventato").
 */
export function identitaFrequenza(avviso: AvvisoFrequenza): string | null {
  const contenuto = normalizzaPerImpronta(avviso.title);
  if (contenuto.length < MIN_CONTENUTO_IDENTITA) return null;
  const scuola = normalizzaPerImpronta(avviso.schoolName);
  const classi = [
    ...new Set(
      (avviso.classi ?? [])
        .map((c) => normalizzaClasse(c))
        .filter(Boolean),
    ),
  ]
    .sort()
    .join(',');
  return `${scuola}|${classi}|${hashContenuto(contenuto)}`;
}

/** Giorno italiano (`YYYY-MM-DD`, fuso `Europe/Rome`) di un istante. */
export function giornoFrequenza(istante: Date = new Date()): string {
  return dataLocaleItalia(istante);
}

/** Esito del calcolo di frequenza. */
export type MotivoFrequenza = 'ok' | 'stesso-giorno' | 'limite-raggiunto';

export interface DecisioneFrequenza {
  /** True → l'invio va SOPPRESSO. */
  inviato: boolean;
  motivo: MotivoFrequenza;
  /** Invii già registrati (giorni distinti + eventuale adozione storica). */
  inviiRegistrati: number;
}

export interface OpzioniFrequenza {
  /** Giorni (distinti, `YYYY-MM-DD`) in cui l'opportunità è già stata inviata. */
  giorniInviati: readonly string[];
  /** Giorno corrente (`YYYY-MM-DD`, fuso italiano). */
  oggi: string;
  /**
   * True se per l'identità è stata adottata una consegna STORICA (marcatori
   * scritti prima dell'introduzione del frequency cap): vale come 1 invio.
   */
  legacyAdottato?: boolean;
  /** Cap massimo di invii (default `MAX_INVII_OPPORTUNITA`). */
  max?: number;
}

/**
 * Decide se un invio è ammesso:
 *   · se l'opportunità è già stata inviata OGGI → `stesso-giorno` (mai due volte
 *     al giorno);
 *   · se gli invii registrati hanno già raggiunto il cap → `limite-raggiunto`;
 *   · altrimenti → `ok`.
 */
export function valutaFrequenza(opts: OpzioniFrequenza): DecisioneFrequenza {
  const max = Math.max(1, opts.max ?? MAX_INVII_OPPORTUNITA);
  const giorni = [...new Set((opts.giorniInviati ?? []).filter(Boolean))];
  const inviiRegistrati = giorni.length + (opts.legacyAdottato ? 1 : 0);
  if (giorni.includes(opts.oggi)) {
    return { inviato: true, motivo: 'stesso-giorno', inviiRegistrati };
  }
  if (giorni.length >= max || inviiRegistrati >= max) {
    return { inviato: true, motivo: 'limite-raggiunto', inviiRegistrati };
  }
  return { inviato: false, motivo: 'ok', inviiRegistrati };
}
