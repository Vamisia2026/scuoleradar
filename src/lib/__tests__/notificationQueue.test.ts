/**
 * TEST — CODA DELLE NOTIFICHE: macchina a stati e operazioni (§26.86).
 *
 * Le notifiche non devono MAI decidere il destino di un'ingestione. Qui il primo
 * lato: la macchina a stati (READY → PROCESSING → NOTIFIED / FAILED_NOTIF, con
 * retry, backoff e terminalita' di NOTIFIED), il produttore idempotente, il claim
 * atomico e la degradazione quando il database non risponde.
 * Il ciclo del consumatore e le guardie statiche stanno in
 * `notificationQueueConsumer.test.ts` (stessa fixture).
 *
 * Uso: npm run test:notification-queue  (incluso in `npm test`)
 */
import {
  TENTATIVI_MASSIMI,
  accodaInterpelli,
  chiudiVoceSenzaInvio,
  getPendingNotifications,
  markAsReadyForNotification,
  normalizzaErrore,
  prendiInCarico,
  recordNotificationAttempt,
  registraTentativo,
  riapriBloccati,
  statoVuoto,
  voceRitentabile,
} from '../notificationQueue.ts';
import { A, B, C, T0, creaVerificatore, dbFinto, dbRotto } from './notificationQueueFixtures.ts';

/** Interfaccia minima per l'ambiente (come gli altri test di prodotto). */
declare const process: { exitCode?: number };

const { check, esito } = creaVerificatore();

/* ------------------------- 1) MACCHINA A STATI (pura) ------------------------ */

const vuota = statoVuoto(A, 'hash-a');
check('voce nuova: READY, zero tentativi, nessun canale', ['READY', 0, []], [
  vuota.stato,
  vuota.tentativi,
  vuota.canaliInviati,
]);
check('soglia dichiarata: tre tentativi', 3, TENTATIVI_MASSIMI);

const inviata = registraTentativo(vuota, 'telegram', 'sent', null, T0);
check('sent: NOTIFIED con canale, data e lock libero', [
  'NOTIFIED',
  ['telegram'],
  T0.toISOString(),
  null,
], [inviata.stato, inviata.canaliInviati, inviata.notificataIl, inviata.lockedAt]);

const f1 = registraTentativo(vuota, 'telegram', 'failed', 'network timeout', T0);
check('primo guasto: torna READY con backoff di 1 minuto', [
  'READY',
  1,
  'network timeout',
  new Date(T0.getTime() + 60_000).toISOString(),
], [f1.stato, f1.tentativi, f1.ultimoErrore, f1.nextRetryAt]);

const f2 = registraTentativo(f1, 'telegram', 'failed', 'network timeout', T0);
check('secondo guasto: backoff di 5 minuti', [2, new Date(T0.getTime() + 300_000).toISOString()], [
  f2.tentativi,
  f2.nextRetryAt,
]);

const f3 = registraTentativo(f2, 'telegram', 'failed', 'chat_id revocata', T0);
check('terzo guasto: FAILED_NOTIF e stop', ['FAILED_NOTIF', 3, null], [
  f3.stato,
  f3.tentativi,
  f3.nextRetryAt,
]);
check('una voce abbandonata non cambia con altri guasti', ['FAILED_NOTIF', 3], [
  registraTentativo(f3, 'telegram', 'failed', 'x', T0).stato,
  f3.tentativi,
]);

check(
  'NOTIFIED e terminale: un guasto successivo non la riapre',
  'NOTIFIED',
  registraTentativo(inviata, 'email', 'failed', 'errore tardivo', T0).stato,
);
const conEmail = registraTentativo(inviata, 'email', 'sent', null, T0);
check('secondo canale su una voce consegnata: traccia, non riscrittura', [
  'NOTIFIED',
  ['telegram', 'email'],
], [conEmail.stato, conEmail.canaliInviati]);

check(
  'un sent su una voce abbandonata la riporta a NOTIFIED (la verita vince)',
  'NOTIFIED',
  registraTentativo(f3, 'telegram', 'sent', null, T0).stato,
);

const inCorso = {
  ...vuota,
  stato: 'PROCESSING' as const,
  lockedAt: T0.toISOString(),
  lockedBy: 'w1',
};
const bloccata = registraTentativo(inCorso, 'telegram', 'failed', 'timeout', T0);
check('guasto durante il PROCESSING: lock rilasciato', [null, null, 'READY'], [
  bloccata.lockedAt,
  bloccata.lockedBy,
  bloccata.stato,
]);

check('voce in backoff non e ritentabile adesso', false, voceRitentabile(f1, T0));
check(
  'voce in backoff ritentabile dopo l attesa',
  true,
  voceRitentabile(f1, new Date(T0.getTime() + 60_000)),
);
check('voce pronta sempre ritentabile', true, voceRitentabile(vuota, T0));
check('voce NOTIFIED mai ritentabile', false, voceRitentabile(inviata, T0));

check('errore normalizzato: vuoto diventa null', null, normalizzaErrore('   '));
check(
  'errore normalizzato: stringa lunga troncata',
  500,
  (normalizzaErrore('x'.repeat(1200)) ?? '').length,
);

/* ------------------- 2) OPERAZIONI SUL PONTE (database finto) ---------------- */

const { ponte, righe } = dbFinto();
await markAsReadyForNotification(A, { ponte });
check('produttore: la voce nasce READY', 'READY', righe.get(A)?.stato);
await markAsReadyForNotification(A, { ponte });
check('produttore idempotente: una sola voce, sempre READY', [1, 'READY'], [
  righe.size,
  righe.get(A)?.stato,
]);

// Una voce gia' consegnata NON torna in coda quando la riga viene riletta: e' la
// protezione contro gli avvisi ripetuti a ogni passaggio dello scraper.
await recordNotificationAttempt(A, 'telegram', 'sent', undefined, { ponte, adesso: T0 });
await markAsReadyForNotification(A, { ponte });
check('una voce NOTIFIED non viene resuscitata dal produttore', 'NOTIFIED', righe.get(A)?.stato);
check(
  'voci pronte: nessuna, la coda e vuota',
  0,
  (await getPendingNotifications(10, { ponte, adesso: T0 })).length,
);

const { ponte: ponte2, righe: righe2 } = dbFinto();
await accodaInterpelli([A, B, C, A], { ponte: ponte2 });
check('accoda: duplicati ignorati', 3, righe2.size);
check(
  'voci pronte: limite rispettato e ordine di inserimento',
  [A, B],
  (await getPendingNotifications(2, { ponte: ponte2, adesso: T0 })).map((v) => v.interpelloId),
);

const presa = await prendiInCarico(A, 'worker-1', { ponte: ponte2, adesso: T0 });
check('presa in carico: PROCESSING con lock del worker', ['PROCESSING', 'worker-1'], [
  presa?.stato,
  presa?.lockedBy,
]);
check(
  'seconda presa in carico: rifiutata (atomicita del claim)',
  null,
  await prendiInCarico(A, 'worker-2', { ponte: ponte2, adesso: T0 }),
);
check(
  'la voce in carico non e piu tra le pronte',
  [B, C],
  (await getPendingNotifications(10, { ponte: ponte2, adesso: T0 })).map((v) => v.interpelloId),
);

const consegnata = await recordNotificationAttempt(A, 'telegram', 'sent', undefined, {
  ponte: ponte2,
  adesso: T0,
});
check('esito sent persistito: NOTIFIED con canale', ['NOTIFIED', ['telegram']], [
  consegnata?.stato,
  righe2.get(A)?.canaliInviati,
]);

const g1 = await recordNotificationAttempt(B, 'telegram', 'failed', 'boom', {
  ponte: ponte2,
  adesso: T0,
});
check('esito failed persistito: READY con backoff e motivo', ['READY', 1, 'boom'], [
  g1?.stato,
  g1?.tentativi,
  g1?.ultimoErrore,
]);
check(
  'una voce in backoff non viene servita subito',
  0,
  (await getPendingNotifications(10, { ponte: ponte2, adesso: T0 })).filter(
    (v) => v.interpelloId === B,
  ).length,
);
check(
  '...ma torna dopo l attesa',
  [B, C],
  (
    await getPendingNotifications(10, {
      ponte: ponte2,
      adesso: new Date(T0.getTime() + 61_000),
    })
  ).map((v) => v.interpelloId),
);

await recordNotificationAttempt(B, 'telegram', 'failed', 'boom', { ponte: ponte2, adesso: T0 });
await recordNotificationAttempt(B, 'telegram', 'failed', 'boom', { ponte: ponte2, adesso: T0 });
check('tre fallimenti: FAILED_NOTIF', ['FAILED_NOTIF', 3], [
  righe2.get(B)?.stato,
  righe2.get(B)?.tentativi,
]);

const chiusa = await chiudiVoceSenzaInvio(C, 'scaduta da 4 giorni', { ponte: ponte2 });
check(
  'voce chiusa senza invio: FAILED_NOTIF con motivo',
  ['FAILED_NOTIF', 'scaduta da 4 giorni'],
  [chiusa?.stato, chiusa?.ultimoErrore],
);

/* ---------------- 3) ISOLAMENTO: IL DATABASE NON RISPONDE ------------------ */

const rotto = dbRotto();
check('accoda su DB rotto: 0, nessuna eccezione', 0, await accodaInterpelli([A], { ponte: rotto }));
check('lettura su DB rotto: lista vuota', [], await getPendingNotifications(5, { ponte: rotto }));
check(
  'presa in carico su DB rotto: null',
  null,
  await prendiInCarico(A, 'w', { ponte: rotto }),
);
check(
  'tentativo su DB rotto: null',
  null,
  await recordNotificationAttempt(A, 'telegram', 'sent', undefined, { ponte: rotto }),
);
check('riapertura su DB rotto: 0', 0, await riapriBloccati(900, { ponte: rotto }));

console.log(
  esito.errori === 0
    ? '\n✅ CODA NOTIFICHE (stati e operazioni): tutte le verifiche superate'
    : `\n❌ CODA NOTIFICHE (stati e operazioni): ${esito.errori} verifiche fallite`,
);
process.exitCode = esito.errori > 0 ? 1 : 0;
