/**
 * ScuoleRadar.it — CONSUMATORE DELLA CODA NOTIFICHE (§26.86).
 *
 * Il ciclo e' qui (e non nello script) perche' e' la parte che va provata: prende
 * la voce, la mette `PROCESSING`, chiama il dispatch dentro un confine d'errore e
 * registra l'esito. Un guasto di rete su una voce non ferma le altre e non lancia
 * mai: `npm run notifiche:processa` deve poter girare in cron senza abbattere il
 * job per un timeout di Telegram.
 *
 * L'EMAIL non si invia qui per opportunita': la regola immutabile resta «una sola
 * email di riepilogo al giorno» (`inviaDigestGiornaliero`,
 * `comunicazione/01_email_riepilogo`). Il canale predefinito e' `telegram`.
 *
 * Guardia: `npm run test:notification-queue` (incluso in `npm test`).
 */
import {
  chiudiVoceSenzaInvio,
  getPendingNotifications,
  prendiInCarico,
  recordNotificationAttempt,
} from './notificationQueue';
import type { CanaleNotifica, PonteNotifiche, VoceNotifica } from './notificationQueueRules';

/** Esito di un tentativo di consegna per una voce. */
export interface EsitoDispatch {
  /** Invii riusciti sul canale. */
  inviati: number;
  /** Invii falliti sul canale. */
  falliti: number;
  /** Motivo per cui la voce NON va consegnata (scaduta, senza destinatari). */
  saltata?: string | null;
  /** Dettaglio leggibile del guasto (default: conteggio dei fallimenti). */
  errore?: string | null;
}

export interface OpzioniConsumo {
  ponte: PonteNotifiche;
  dispatch: (voce: VoceNotifica) => Promise<EsitoDispatch>;
  limite?: number;
  worker?: string;
  canale?: CanaleNotifica;
  adesso?: Date;
  log?: (messaggio: string) => void;
}

/** Contatori del giro: `abbandonate` sono le voci arrivate a `FAILED_NOTIF`. */
export interface RiepilogoConsumo {
  esaminate: number;
  consegnate: number;
  inRiprova: number;
  abbandonate: number;
  chiuse: number;
  errori: number;
}

const messaggio = (err: unknown): string => (err instanceof Error ? err.message : String(err));

/**
 * Consuma fino a `limite` voci pronte. Non lancia mai: ogni errore resta dentro
 * il confine della voce che l'ha prodotto (`errori` nel riepilogo).
 */
export async function consumaCoda(opzioni: OpzioniConsumo): Promise<RiepilogoConsumo> {
  const adesso = opzioni.adesso ?? new Date();
  const canale: CanaleNotifica = opzioni.canale ?? 'telegram';
  const worker = opzioni.worker ?? 'consumer';
  const log = opzioni.log ?? ((testo: string) => console.log(testo));
  const riepilogo: RiepilogoConsumo = {
    esaminate: 0,
    consegnate: 0,
    inRiprova: 0,
    abbandonate: 0,
    chiuse: 0,
    errori: 0,
  };

  const voci = await getPendingNotifications(opzioni.limite ?? 25, {
    ponte: opzioni.ponte,
    adesso,
  });

  for (const voce of voci) {
    riepilogo.esaminate += 1;
    // Claim: se un altro consumer l'ha presa, questa voce si salta senza rumore.
    const presa = await prendiInCarico(voce.interpelloId, worker, { ponte: opzioni.ponte, adesso });
    if (!presa) continue;

    try {
      const esito = await opzioni.dispatch(presa);

      if (esito.saltata) {
        await chiudiVoceSenzaInvio(presa.interpelloId, esito.saltata, {
          ponte: opzioni.ponte,
          adesso,
        });
        riepilogo.chiuse += 1;
        log(`  ~ ${presa.interpelloId.slice(0, 8)} chiusa senza invio: ${esito.saltata}`);
        continue;
      }

      // Un invio riuscito basta: la voce e' consegnata. Fallimenti parziali su
      // un canale non annullano l'altro.
      const fallita = esito.falliti > 0 && esito.inviati === 0;
      const aggiornata = await recordNotificationAttempt(
        presa.interpelloId,
        canale,
        fallita ? 'failed' : 'sent',
        fallita ? (esito.errore ?? `${esito.falliti} invii falliti`) : null,
        { ponte: opzioni.ponte, adesso },
      );
      if (aggiornata?.stato === 'NOTIFIED') {
        riepilogo.consegnate += 1;
        log(`  + ${presa.interpelloId.slice(0, 8)} consegnata (${canale})`);
      } else if (aggiornata?.stato === 'FAILED_NOTIF') {
        riepilogo.abbandonate += 1;
        log(`  ! ${presa.interpelloId.slice(0, 8)} abbandonata dopo i tentativi`);
      } else {
        riepilogo.inRiprova += 1;
        log(`  ↻ ${presa.interpelloId.slice(0, 8)} in riprova (${aggiornata?.tentativi ?? '?'})`);
      }
    } catch (err) {
      // ISOLAMENTO: il guasto resta confinato alla voce e diventa un tentativo
      // fallito (con backoff), non un crash del job.
      riepilogo.errori += 1;
      const aggiornata = await recordNotificationAttempt(
        presa.interpelloId,
        canale,
        'failed',
        messaggio(err),
        { ponte: opzioni.ponte, adesso },
      );
      if (aggiornata?.stato === 'FAILED_NOTIF') riepilogo.abbandonate += 1;
      else riepilogo.inRiprova += 1;
      log(`  x ${presa.interpelloId.slice(0, 8)} errore isolato: ${messaggio(err)}`);
    }
  }

  return riepilogo;
}
