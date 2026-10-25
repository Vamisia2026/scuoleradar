/**
 * ScuoleRadar.it — CODA DELLE NOTIFICHE (§26.86): REGOLE PURE.
 *
 * Perché esiste: finché la consegna di una notifica è una chiamata sincrona
 * dentro il run di scraping, un timeout di Telegram o di Resend può far fallire
 * (o allungare a dismisura) un'ingestione che aveva già scritto le righe giuste.
 * Qui la consegna è un MESSAGGIO: i runner (PRODUTTORI) scrivono su `interpelli`
 * e accodano la voce; `scripts/process-notifications.ts` (CONSUMATORE) la prende
 * in carico e prova a consegnarla, con retry e isolamento degli errori.
 *
 * Stati (una sola direzione, `NOTIFIED` è terminale):
 *
 *   READY ──► PROCESSING ──► NOTIFIED        consegna riuscita (o niente da inviare)
 *     ▲            │
 *     └────────────┘  fallimento 1-2 → READY con backoff (`nextRetryAt`)
 *                  └──► FAILED_NOTIF        terzo fallimento: si smette e si segnala
 *
 * Tre strati, un compito ciascuno (stessa struttura della telemetria fonti):
 *   · QUESTO file — tipi, soglie e transizioni pure (`registraTentativo`);
 *   · `notificationQueue.ts` — le operazioni (produttore + consumatore);
 *   · `notificationQueueDb.ts` — il ponte Supabase (`public.notification_queue`).
 *
 * L'EMAIL resta al digest giornaliero (`inviaDigestGiornaliero`, «una email al
 * giorno»: `comunicazione/01_email_riepilogo`). Il consumatore consegna il canale
 * TELEGRAM in tempo reale; il canale `email` è tracciato per i percorsi che lo
 * consegnano davvero, non per invii per singolo avviso.
 *
 * Guardia: `npm run test:notification-queue` (incluso in `npm test`).
 */
import type { SupabaseClient } from '@supabase/supabase-js';

export type StatoNotifica = 'READY' | 'PROCESSING' | 'NOTIFIED' | 'FAILED_NOTIF';
export type CanaleNotifica = 'telegram' | 'email';
export type EsitoTentativo = 'sent' | 'failed';

/** Una voce della coda (camelCase: i nomi del database vivono nel ponte). */
export interface VoceNotifica {
  interpelloId: string;
  interpelloHash: string | null;
  stato: StatoNotifica;
  tentativi: number;
  canaliInviati: CanaleNotifica[];
  ultimoCanale: CanaleNotifica | null;
  ultimoErrore: string | null;
  nextRetryAt: string | null;
  notificataIl: string | null;
  lockedAt: string | null;
  lockedBy: string | null;
  createdAt: string | null;
}

/**
 * Persistenza minima richiesta dalle operazioni. Il ponte esiste per due motivi:
 * il test gira senza database (`ponteInMemoria` nel test) e la tabella cambia in
 * un solo punto (`notificationQueueDb.ts`).
 */
export interface PonteNotifiche {
  leggiPronte(limite: number, adesso: Date): Promise<VoceNotifica[]>;
  leggiUno(interpelloId: string): Promise<VoceNotifica | null>;
  prendiInCarico(
    interpelloId: string,
    worker: string,
    adesso: Date,
  ): Promise<VoceNotifica | null>;
  accoda(interpelloIds: string[]): Promise<string | null>;
  salva(voce: VoceNotifica): Promise<string | null>;
  riapriBloccati(secondi: number, adesso: Date): Promise<number>;
}

/** Opzioni comuni: client Supabase, ponte esplicito (test) e orologio. */
export interface OpzioniCoda {
  client?: SupabaseClient | null;
  ponte?: PonteNotifiche;
  adesso?: Date;
}

/** Al terzo fallimento la voce si abbandona: `FAILED_NOTIF`. */
export const TENTATIVI_MASSIMI = 3;

/** Backoff sui fallimenti: 1 minuto, 5 minuti, 15 minuti. */
const BACKOFF_MS = [60_000, 300_000, 900_000];

const LUNGHEZZA_MASSIMA_ERRORE = 500;

const STATI: readonly StatoNotifica[] = ['READY', 'PROCESSING', 'NOTIFIED', 'FAILED_NOTIF'];

const CANALI: readonly CanaleNotifica[] = ['telegram', 'email'];

export function isStatoNotifica(valore: unknown): valore is StatoNotifica {
  return typeof valore === 'string' && (STATI as readonly string[]).includes(valore);
}

export function isCanaleNotifica(valore: unknown): valore is CanaleNotifica {
  return typeof valore === 'string' && (CANALI as readonly string[]).includes(valore);
}

/** Voce appena accodata: pronta, nessun tentativo, nessun lock. */
export function statoVuoto(interpelloId: string, hash: string | null = null): VoceNotifica {
  return {
    interpelloId,
    interpelloHash: hash,
    stato: 'READY',
    tentativi: 0,
    canaliInviati: [],
    ultimoCanale: null,
    ultimoErrore: null,
    nextRetryAt: null,
    notificataIl: null,
    lockedAt: null,
    lockedBy: null,
    createdAt: null,
  };
}

/** Attesa prima del prossimo tentativo (dopo `tentativi` fallimenti). */
export function backoffMs(tentativi: number): number {
  const indice = Math.min(Math.max(1, Math.trunc(tentativi)), BACKOFF_MS.length) - 1;
  return BACKOFF_MS[indice];
}

/** Messaggio d'errore presentabile: stringa, senza stack, di lunghezza finita. */
export function normalizzaErrore(errore: unknown): string | null {
  if (errore === null || errore === undefined) return null;
  const messaggio = errore instanceof Error ? errore.message : String(errore);
  const pulito = messaggio.replace(/\s+/g, ' ').trim();
  if (!pulito) return null;
  return pulito.length > LUNGHEZZA_MASSIMA_ERRORE
    ? `${pulito.slice(0, LUNGHEZZA_MASSIMA_ERRORE - 1)}…`
    : pulito;
}

/** La voce è dovuta ADESSO? (READY e fuori dalla finestra di backoff) */
export function voceRitentabile(voce: VoceNotifica, adesso: Date): boolean {
  if (voce.stato !== 'READY') return false;
  if (!voce.nextRetryAt) return true;
  const quando = Date.parse(voce.nextRetryAt);
  if (Number.isNaN(quando)) return true;
  return quando <= adesso.getTime();
}

/**
 * REGOLA UNICA di transizione: applica l'esito di un tentativo alla voce.
 *
 *   · `sent`   → `NOTIFIED` (terminale); il canale si aggiunge a `canaliInviati`
 *                e un tentativo riuscito azzera errore e backoff;
 *   · `failed` → `tentativi + 1`; sotto la soglia la voce torna `READY` con
 *                `nextRetryAt` (backoff), alla soglia diventa `FAILED_NOTIF`.
 *
 * `NOTIFIED` è terminale nel senso forte: un fallimento arrivato dopo un invio
 * riuscito NON la fa tornare indietro (mai rimandare lo stesso avviso). Un
 * `sent` su una voce già `NOTIFIED` arricchisce solo la traccia dei canali, e un
 * `sent` su una voce abbandonata la riporta a `NOTIFIED`: la verità vince.
 */
export function registraTentativo(
  voce: VoceNotifica,
  canale: CanaleNotifica,
  esito: EsitoTentativo,
  errore: string | null,
  adesso: Date,
): VoceNotifica {
  const conCanale: VoceNotifica = voce.canaliInviati.includes(canale)
    ? voce
    : { ...voce, canaliInviati: [...voce.canaliInviati, canale], ultimoCanale: canale };

  if (voce.stato === 'NOTIFIED') {
    return esito === 'sent' && conCanale !== voce ? conCanale : voce;
  }

  if (esito === 'sent') {
    return {
      ...conCanale,
      stato: 'NOTIFIED',
      ultimoErrore: null,
      nextRetryAt: null,
      notificataIl: adesso.toISOString(),
      lockedAt: null,
      lockedBy: null,
    };
  }

  // Già abbandonata: un altro fallimento non cambia nulla (niente retry infiniti).
  if (voce.stato === 'FAILED_NOTIF') return voce;

  const tentativi = voce.tentativi + 1;
  const definitivo = tentativi >= TENTATIVI_MASSIMI;
  return {
    ...conCanale,
    stato: definitivo ? 'FAILED_NOTIF' : 'READY',
    tentativi,
    ultimoErrore: normalizzaErrore(errore) ?? 'consegna fallita (nessun dettaglio)',
    nextRetryAt: definitivo
      ? null
      : new Date(adesso.getTime() + backoffMs(tentativi)).toISOString(),
    lockedAt: null,
    lockedBy: null,
  };
}

