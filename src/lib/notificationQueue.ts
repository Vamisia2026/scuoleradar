/**
 * ScuoleRadar.it — CODA DELLE NOTIFICHE (§26.86): OPERAZIONI.
 *
 * Produttore e consumatore passano da qui; le transizioni di stato vivono nelle
 * regole pure (`notificationQueueRules.ts`) e la tabella nel ponte
 * (`notificationQueueDb.ts`).
 *
 * CONTRATTO
 *   · `markAsReadyForNotification(id)` — PRODUTTORE: il runner dichiara «questa
 *     riga e' scritta, va notificata». Nessun invio, nessuna attesa.
 *   · `getPendingNotifications(limit)` — CONSUMATORE: le voci dovute adesso.
 *   · `recordNotificationAttempt(id, canale, esito, errore?)` — CONSUMATORE:
 *     registra l'esito e applica le transizioni (retry con backoff, poi
 *     `FAILED_NOTIF`).
 *
 * INVARIANTE: nessuna funzione lancia. Un database assente o lento non deve
 * fermare l'ingestione: `accodaInterpelli` degrada con un avviso, il resto
 * restituisce `null`/`[]`.
 *
 * Guardia: `npm run test:notification-queue` (incluso in `npm test`).
 */
import { ponteSupabase } from './notificationQueueDb';
import {
  registraTentativo,
  TENTATIVI_MASSIMI,
  normalizzaErrore,
  voceRitentabile,
  type CanaleNotifica,
  type EsitoTentativo,
  type OpzioniCoda,
  type PonteNotifiche,
  type VoceNotifica,
} from './notificationQueueRules';

// Un solo punto d'import per chi accoda, consuma o legge la coda.
export * from './notificationQueueRules';

const avvisati = new Set<string>();

const messaggio = (err: unknown): string => (err instanceof Error ? err.message : String(err));

/** Un avviso per tipo di guasto: un database giu' non deve inondare il log. */
function avvisa(chiave: string, motivo: string): void {
  if (avvisati.has(chiave)) return;
  avvisati.add(chiave);
  console.warn(`[coda notifiche] ${motivo} (${chiave}).`);
}

/** Azzera gli avvisi gia' emessi (test e run lunghi). */
export function resetAvvisiCoda(): void {
  avvisati.clear();
}

function ponteDi(opzioni: OpzioniCoda): PonteNotifiche | null {
  if (opzioni.ponte) return opzioni.ponte;
  return opzioni.client ? ponteSupabase(opzioni.client) : null;
}

/**
 * PRODUTTORE — accoda gli interpelli appena inseriti dal runner.
 *
 * Idempotente (`ON CONFLICT DO NOTHING` lato database): un interpello gia' in
 * coda non torna `READY`, quindi una riga riletta domani non rispedisce l'avviso
 * e una voce `NOTIFIED`/`FAILED_NOTIF` non viene resuscitata.
 * Ritorna il numero di id proposti; 0 se il database non risponde.
 */
export async function accodaInterpelli(
  interpelloIds: string[],
  opzioni: OpzioniCoda = {},
): Promise<number> {
  const ids = [
    ...new Set((interpelloIds ?? []).filter((id) => typeof id === 'string' && id.length > 0)),
  ];
  if (ids.length === 0) return 0;
  const ponte = ponteDi(opzioni);
  if (!ponte) return 0;
  try {
    const errore = await ponte.accoda(ids);
    if (errore) {
      avvisa('accoda', `coda non scrivibile (${errore})`);
      return 0;
    }
    return ids.length;
  } catch (err) {
    avvisa('accoda', `coda non scrivibile (${messaggio(err)})`);
    return 0;
  }
}

/**
 * PRODUTTORE (voce singola) — firma del contratto producer/consumer.
 * Non lancia mai: l'ingestione non dipende dall'esito dell'accodamento.
 */
export async function markAsReadyForNotification(
  interpelloId: string,
  opzioni: OpzioniCoda = {},
): Promise<void> {
  await accodaInterpelli([interpelloId], opzioni);
}

/** CONSUMATORE — voci pronte e ritentabili, dalla piu' vecchia. Non lancia mai. */
export async function getPendingNotifications(
  limit = 25,
  opzioni: OpzioniCoda = {},
): Promise<VoceNotifica[]> {
  const ponte = ponteDi(opzioni);
  if (!ponte) return [];
  const adesso = opzioni.adesso ?? new Date();
  const tetto = Math.max(1, Math.trunc(limit) || 25);
  try {
    const voci = await ponte.leggiPronte(tetto, adesso);
    return voci.filter((voce) => voceRitentabile(voce, adesso));
  } catch (err) {
    avvisa('leggi', `coda non leggibile (${messaggio(err)})`);
    return [];
  }
}

/** CONSUMATORE — presa in carico atomica (READY -> PROCESSING). */
export async function prendiInCarico(
  interpelloId: string,
  worker = 'consumer',
  opzioni: OpzioniCoda = {},
): Promise<VoceNotifica | null> {
  const ponte = ponteDi(opzioni);
  if (!ponte) return null;
  try {
    return await ponte.prendiInCarico(interpelloId, worker, opzioni.adesso ?? new Date());
  } catch (err) {
    avvisa('carico', `presa in carico fallita (${messaggio(err)})`);
    return null;
  }
}

/**
 * CONSUMATORE — registra l'esito di un tentativo su un canale e applica le
 * transizioni di `registraTentativo`. Ritorna la voce aggiornata (o `null` se
 * non esiste / il database non risponde). Non lancia mai.
 */
export async function recordNotificationAttempt(
  interpelloId: string,
  canale: CanaleNotifica,
  esito: EsitoTentativo,
  errore?: string | null,
  opzioni: OpzioniCoda = {},
): Promise<VoceNotifica | null> {
  const ponte = ponteDi(opzioni);
  if (!ponte) return null;
  try {
    const voce = await ponte.leggiUno(interpelloId);
    if (!voce) return null;
    const aggiornata = registraTentativo(
      voce,
      canale,
      esito,
      errore ?? null,
      opzioni.adesso ?? new Date(),
    );
    if (aggiornata === voce) return voce;
    const erroreSalvataggio = await ponte.salva(aggiornata);
    if (erroreSalvataggio) {
      avvisa(`salva:${interpelloId}`, `stato non salvato (${erroreSalvataggio})`);
    }
    return aggiornata;
  } catch (err) {
    avvisa(`salva:${interpelloId}`, `stato non salvato (${messaggio(err)})`);
    return null;
  }
}

/**
 * CONSUMATORE — chiude senza invio una voce che non va consegnata (interpello
 * scaduto o cancellato). Finisce in `FAILED_NOTIF` con il motivo leggibile: non
 * si ritenta, ma resta visibile nella diagnosi.
 */
export async function chiudiVoceSenzaInvio(
  interpelloId: string,
  motivo: string,
  opzioni: OpzioniCoda = {},
): Promise<VoceNotifica | null> {
  const ponte = ponteDi(opzioni);
  if (!ponte) return null;
  try {
    const voce = await ponte.leggiUno(interpelloId);
    if (!voce || voce.stato === 'NOTIFIED') return voce;
    const aggiornata: VoceNotifica = {
      ...voce,
      stato: 'FAILED_NOTIF',
      tentativi: Math.max(voce.tentativi, TENTATIVI_MASSIMI),
      ultimoErrore: normalizzaErrore(motivo) ?? 'voce chiusa senza invio',
      nextRetryAt: null,
      lockedAt: null,
      lockedBy: null,
    };
    const erroreSalvataggio = await ponte.salva(aggiornata);
    if (erroreSalvataggio) {
      avvisa(`salva:${interpelloId}`, `stato non salvato (${erroreSalvataggio})`);
    }
    return aggiornata;
  } catch (err) {
    avvisa(`salva:${interpelloId}`, `stato non salvato (${messaggio(err)})`);
    return null;
  }
}

/** CONSUMATORE — riapre le voci rimaste `PROCESSING` (worker morto). */
export async function riapriBloccati(
  secondi = 900,
  opzioni: OpzioniCoda = {},
): Promise<number> {
  const ponte = ponteDi(opzioni);
  if (!ponte) return 0;
  try {
    return await ponte.riapriBloccati(
      Math.max(60, Math.trunc(secondi) || 900),
      opzioni.adesso ?? new Date(),
    );
  } catch (err) {
    avvisa('riapri', `lock non recuperabili (${messaggio(err)})`);
    return 0;
  }
}

