/**
 * FIXTURE CONDIVISA — coda delle notifiche (§26.86).
 *
 * I due test della coda (`notificationQueue.test.ts` per la macchina a stati e le
 * operazioni, `notificationQueueConsumer.test.ts` per il ciclo del consumatore e
 * le guardie statiche) lavorano sullo stesso database finto: qui c'e' una sola
 * definizione, cosi' la forma delle voci non puo' divergere fra i due file.
 */
import { statoVuoto, type PonteNotifiche, type VoceNotifica } from '../notificationQueue.ts';

export const T0 = new Date('2026-10-23T09:00:00.000Z');
export const A = '11111111-1111-4111-8111-111111111111';
export const B = '22222222-2222-4222-8222-222222222222';
export const C = '33333333-3333-4333-8333-333333333333';

/** Database finto con la forma di `public.notification_queue`. */
export function dbFinto(iniziali: readonly VoceNotifica[] = []) {
  const righe = new Map(iniziali.map((voce) => [voce.interpelloId, { ...voce }]));
  const ponte: PonteNotifiche = {
    async leggiPronte(limite) {
      return [...righe.values()]
        .filter((voce) => voce.stato === 'READY')
        .slice(0, limite)
        .map((voce) => ({ ...voce }));
    },
    async leggiUno(id) {
      const voce = righe.get(id);
      return voce ? { ...voce } : null;
    },
    async prendiInCarico(id, worker, adesso) {
      const voce = righe.get(id);
      if (!voce || voce.stato !== 'READY') return null;
      const presa: VoceNotifica = {
        ...voce,
        stato: 'PROCESSING',
        lockedAt: adesso.toISOString(),
        lockedBy: worker,
      };
      righe.set(id, presa);
      return { ...presa };
    },
    async accoda(ids) {
      for (const id of ids) if (!righe.has(id)) righe.set(id, statoVuoto(id));
      return null;
    },
    async salva(voce) {
      if (!righe.has(voce.interpelloId)) return 'voce inesistente';
      righe.set(voce.interpelloId, { ...voce });
      return null;
    },
    async riapriBloccati(secondi, adesso) {
      let riaperte = 0;
      for (const [id, voce] of righe) {
        if (voce.stato !== 'PROCESSING' || !voce.lockedAt) continue;
        if (Date.parse(voce.lockedAt) > adesso.getTime() - secondi * 1000) continue;
        righe.set(id, { ...voce, stato: 'READY', lockedAt: null, lockedBy: null });
        riaperte += 1;
      }
      return riaperte;
    },
  };
  return { righe, ponte };
}

/** Ponte che si comporta come un database irraggiungibile. */
export function dbRotto(): PonteNotifiche {
  const guasto = async () => {
    throw new Error('database irraggiungibile (simulato)');
  };
  return {
    leggiPronte: guasto,
    leggiUno: guasto,
    prendiInCarico: guasto,
    accoda: guasto,
    salva: guasto,
    riapriBloccati: guasto,
  };
}

/** Verificatore dei due file (stessa forma di `sourceTelemetry.test.ts`). */
export function creaVerificatore() {
  const esito = { errori: 0 };
  const check = (nome: string, atteso: unknown, ottenuto: unknown): void => {
    const ok = JSON.stringify(atteso) === JSON.stringify(ottenuto);
    if (!ok) esito.errori += 1;
    console.log(
      `${ok ? '✓' : '✗'} ${nome}: atteso=${JSON.stringify(atteso)} ottenuto=${JSON.stringify(ottenuto)}`,
    );
  };
  return { check, esito };
}
