/**
 * TEST — CODA DELLE NOTIFICHE: consumatore, retry e isolamento (§26.86).
 *
 * Il secondo lato della coda: il ciclo VERO (`consumaCoda`) contro guasti
 * simulati — un dispatch che lancia, uno che fallisce sempre, una voce scaduta,
 * un backoff da rispettare, un database irraggiungibile — e le guardie statiche
 * che impediscono di ricollegare l'invio allo scraping.
 *
 * Uso: npm run test:notification-queue  (incluso in `npm test`)
 */
import { existsSync, readFileSync } from 'node:fs';
import { consumaCoda } from '../notificationConsumer.ts';
import { accodaInterpelli, getPendingNotifications } from '../notificationQueue.ts';
import { A, B, C, T0, creaVerificatore, dbFinto, dbRotto } from './notificationQueueFixtures.ts';

/** Interfaccia minima per l'ambiente (come gli altri test di prodotto). */
declare const process: { exitCode?: number };

const { check, esito } = creaVerificatore();
const leggi = (p: string): string => readFileSync(p, 'utf8');

/* ------------- 1) CONSUMATORE: RETRY, ISOLAMENTO E VOCI SALTATE ------------- */

// a) dispatch che lancia su A e funziona su B: il giro non si ferma.
const { ponte: ponteC, righe: righeC } = dbFinto();
await accodaInterpelli([A, B], { ponte: ponteC });
const chiamate: string[] = [];
const primoGiro = await consumaCoda({
  ponte: ponteC,
  adesso: T0,
  limite: 10,
  log: () => {},
  dispatch: async (voce) => {
    chiamate.push(voce.interpelloId);
    if (voce.interpelloId === A) throw new Error('Telegram 502 (simulato)');
    return { inviati: 1, falliti: 0 };
  },
});
check('consumatore: guasto su una voce, successo sull altra', [2, 1, 1, 1], [
  primoGiro.esaminate,
  primoGiro.consegnate,
  primoGiro.inRiprova,
  primoGiro.errori,
]);
check('consumatore: nessuna voce saltata dopo il guasto', [A, B], chiamate);
check('consumatore: la voce fallita resta READY con il motivo', [
  'READY',
  1,
  'Telegram 502 (simulato)',
], [righeC.get(A)?.stato, righeC.get(A)?.tentativi, righeC.get(A)?.ultimoErrore]);
check('consumatore: la voce riuscita e NOTIFIED', ['NOTIFIED', ['telegram']], [
  righeC.get(B)?.stato,
  righeC.get(B)?.canaliInviati,
]);

// b) tre giri falliti → FAILED_NOTIF (il retry non e infinito).
const { ponte: ponteD, righe: righeD } = dbFinto();
await accodaInterpelli([C], { ponte: ponteD });
let tentativiDispatch = 0;
const giri: Array<{ abbandonate: number }> = [];
for (let giro = 0; giro < 3; giro += 1) {
  giri.push(
    await consumaCoda({
      ponte: ponteD,
      adesso: new Date(T0.getTime() + giro * 3_600_000),
      log: () => {},
      dispatch: async () => {
        tentativiDispatch += 1;
        return { inviati: 0, falliti: 2 };
      },
    }),
  );
}
check('tre giri falliti: tre dispatch e un abbandono', [3, 1], [
  tentativiDispatch,
  giri[2].abbandonate,
]);
check('lo stato finale e FAILED_NOTIF con tre tentativi', ['FAILED_NOTIF', 3], [
  righeD.get(C)?.stato,
  righeD.get(C)?.tentativi,
]);

// c) voce che non va consegnata (scaduta): chiusa, non ritentata.
const { ponte: ponteE, righe: righeE } = dbFinto();
await accodaInterpelli([A], { ponte: ponteE });
const giroSaltata = await consumaCoda({
  ponte: ponteE,
  adesso: T0,
  log: () => {},
  dispatch: async () => ({ inviati: 0, falliti: 0, saltata: 'scaduta da 4 giorni' }),
});
check('voce saltata: chiusa senza invio e non in riprova', ['FAILED_NOTIF', 1, 0], [
  righeE.get(A)?.stato,
  giroSaltata.chiuse,
  giroSaltata.inRiprova,
]);
check(
  'la voce saltata non torna tra le pronte',
  0,
  (
    await getPendingNotifications(10, {
      ponte: ponteE,
      adesso: new Date(T0.getTime() + 86_400_000),
    })
  ).length,
);

// d) il backoff vale anche per il consumatore vero.
const { ponte: ponteF } = dbFinto();
await accodaInterpelli([A], { ponte: ponteF });
let dispatchDelBackoff = 0;
const dispatcher = async () => {
  dispatchDelBackoff += 1;
  return { inviati: 0, falliti: 1 };
};
await consumaCoda({ ponte: ponteF, adesso: T0, dispatch: dispatcher, log: () => {} });
const dopoUnSecondo = await consumaCoda({
  ponte: ponteF,
  adesso: new Date(T0.getTime() + 1000),
  dispatch: dispatcher,
  log: () => {},
});
check('backoff rispettato dal consumatore', [1, 0], [
  dispatchDelBackoff,
  dopoUnSecondo.esaminate,
]);

// e) zero destinatari: la voce si chiude, la coda non si blocca.
const { ponte: ponteG, righe: righeG } = dbFinto();
await accodaInterpelli([B], { ponte: ponteG });
await consumaCoda({
  ponte: ponteG,
  adesso: T0,
  log: () => {},
  dispatch: async () => ({ inviati: 0, falliti: 0 }),
});
check('nessun destinatario: la voce si chiude', 'NOTIFIED', righeG.get(B)?.stato);

// f) database irraggiungibile: il giro finisce vuoto, senza eccezioni.
const giroRotto = await consumaCoda({
  ponte: dbRotto(),
  log: () => {},
  dispatch: async () => ({ inviati: 1, falliti: 0 }),
});
check('consumatore su DB rotto: nessuna voce, nessun crash', [0, 0, 0], [
  giroRotto.esaminate,
  giroRotto.consegnate,
  giroRotto.errori,
]);

/* --------------------------- 2) GUARDIE STATICHE --------------------------- */

const reporter = leggi('scripts/table-reporter.ts');
check('produttore: accoda le righe appena inserite', true, /accodaInterpelli/.test(reporter));
check(
  'produttore: NON importa il notifier (nessun invio nel run di scraping)',
  false,
  /from '\.\.\/src\/lib\/notifier\.ts'/.test(reporter),
);

const discovery = leggi('scripts/discovery-engine.ts');
check(
  'discovery: nessun invio ne import del notifier',
  false,
  /lib\/notifier\.ts|inviaAlertTelegramTempoReale\(|notificaNuoviInterpelli\(/.test(discovery),
);

const consumatore = leggi('scripts/process-notifications.ts');
check('consumatore: usa i moduli esistenti (Telegram)', [true, true], [
  /inviaAlertTelegramTempoReale/.test(consumatore),
  /consumaCoda/.test(consumatore),
]);
check(
  'consumatore: nessuna email per opportunita (regola digest)',
  false,
  /resend|inviaEmail|inviaDigestGiornaliero/.test(consumatore),
);
check('consumatore: recupera i lock dei worker morti', true, /riapriBloccati/.test(consumatore));

const pacchetto = leggi('package.json');
check('script notifiche:processa presente', true, /"notifiche:processa"/.test(pacchetto));
check(
  'guardie in catena a npm test',
  [true, true],
  [
    /notificationQueue\.test\.ts/.test(pacchetto),
    /notificationQueueConsumer\.test\.ts/.test(pacchetto),
  ],
);

const migrazione = 'supabase/migrations/20261023130000_create_notification_queue.sql';
check('migrazione della coda presente', true, existsSync(migrazione));
check(
  'la tabella vincola i quattro stati',
  true,
  /'READY', 'PROCESSING', 'NOTIFIED', 'FAILED_NOTIF'/.test(leggi(migrazione)),
);
check(
  'la coda e riservata al service_role',
  true,
  /revoke all[\s\S]*anon, authenticated/.test(leggi(migrazione)),
);

console.log(
  esito.errori === 0
    ? '\n✅ CODA NOTIFICHE (consumatore e cablaggio): tutte le verifiche superate'
    : `\n❌ CODA NOTIFICHE (consumatore e cablaggio): ${esito.errori} verifiche fallite`,
);
process.exitCode = esito.errori > 0 ? 1 : 0;
