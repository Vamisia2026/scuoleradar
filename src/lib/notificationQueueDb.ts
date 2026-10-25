/**
 * ScuoleRadar.it — PONTE SUPABASE DELLA CODA NOTIFICHE (§26.86).
 *
 * L'unico punto che conosce la tabella `public.notification_queue` e i suoi nomi
 * snake_case: regole (`notificationQueueRules.ts`) e operazioni
 * (`notificationQueue.ts`) lavorano in camelCase e non sanno dove finisce lo
 * stato. Stesso schema di `sourceTelemetryDb.ts` e `automazioniEmailDb.ts`.
 *
 * La tabella e' di SERVIZIO (RLS con la sola policy `service_role`, come
 * `scan_targets` e `source_health`): i worker passano un client con
 * `SUPABASE_SERVICE_ROLE_KEY`.
 *
 * Le operazioni sono deliberatamente crude — leggono lanciano se il database non
 * risponde, scrivono restituiscono il messaggio d'errore — perche' e'
 * `notificationQueue.ts` a decidere come degradare (avviso, nessuna eccezione).
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  isCanaleNotifica,
  isStatoNotifica,
  statoVuoto,
  type PonteNotifiche,
  type VoceNotifica,
} from './notificationQueueRules';

/** Colonne lette: esplicite, cosi' una colonna nuova non rompe il mapping. */
const COLONNE = [
  'interpello_id',
  'interpello_hash',
  'stato',
  'tentativi',
  'canali_inviati',
  'ultimo_canale',
  'ultimo_errore',
  'next_retry_at',
  'notificata_il',
  'locked_at',
  'locked_by',
  'created_at',
].join(', ');

const testo = (valore: unknown): string | null =>
  typeof valore === 'string' && valore.length > 0 ? valore : null;

/** Riga PostgREST -> voce (camelCase); valori fuori dominio riportati al neutro. */
function daRiga(riga: Record<string, unknown>): VoceNotifica {
  const base = statoVuoto(String(riga.interpello_id ?? ''), testo(riga.interpello_hash));
  return {
    ...base,
    stato: isStatoNotifica(riga.stato) ? riga.stato : 'READY',
    tentativi: Math.max(0, Number(riga.tentativi) || 0),
    canaliInviati: Array.isArray(riga.canali_inviati)
      ? riga.canali_inviati.filter(isCanaleNotifica)
      : [],
    ultimoCanale: isCanaleNotifica(riga.ultimo_canale) ? riga.ultimo_canale : null,
    ultimoErrore: testo(riga.ultimo_errore),
    nextRetryAt: testo(riga.next_retry_at),
    notificataIl: testo(riga.notificata_il),
    lockedAt: testo(riga.locked_at),
    lockedBy: testo(riga.locked_by),
    createdAt: testo(riga.created_at),
  };
}

/** Voce -> riga `notification_queue` (snake_case; `updated_at` lo scrive il trigger). */
function aRiga(voce: VoceNotifica): Record<string, unknown> {
  return {
    interpello_id: voce.interpelloId,
    stato: voce.stato,
    tentativi: voce.tentativi,
    canali_inviati: voce.canaliInviati,
    ultimo_canale: voce.ultimoCanale,
    ultimo_errore: voce.ultimoErrore,
    next_retry_at: voce.nextRetryAt,
    notificata_il: voce.notificataIl,
    locked_at: voce.lockedAt,
    locked_by: voce.lockedBy,
  };
}


/** Ponte Supabase su `public.notification_queue` (chiave naturale: interpello). */
export function ponteSupabase(client: SupabaseClient): PonteNotifiche {
  return {
    async leggiPronte(limite, adesso) {
      // `next_retry_at` NULLS FIRST: le voci mai fallite (null) vengono prima di
      // quelle in backoff, quindi il LIMIT non viene mai speso da voci non dovute.
      const { data, error } = await client
        .from('notification_queue')
        .select(COLONNE)
        .eq('stato', 'READY')
        .order('next_retry_at', { ascending: true, nullsFirst: true })
        .order('created_at', { ascending: true })
        .limit(limite);
      if (error) throw new Error(error.message);
      const voci = ((data ?? []) as unknown as Record<string, unknown>[]).map(daRiga);
      // Seconda guardia sul backoff: la stessa regola delle regole pure.
      return voci.filter(
        (voce) => !voce.nextRetryAt || Date.parse(voce.nextRetryAt) <= adesso.getTime(),
      );
    },

    async leggiUno(interpelloId) {
      const { data, error } = await client
        .from('notification_queue')
        .select(COLONNE)
        .eq('interpello_id', interpelloId)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return data ? daRiga(data as unknown as Record<string, unknown>) : null;
    },

    async prendiInCarico(interpelloId, worker, adesso) {
      // Claim ATOMICO: la `where` include lo stato, quindi due consumer in
      // parallelo non possono prendere la stessa voce (una sola UPDATE vince).
      const { data, error } = await client
        .from('notification_queue')
        .update({
          stato: 'PROCESSING',
          locked_at: adesso.toISOString(),
          locked_by: worker,
        })
        .eq('interpello_id', interpelloId)
        .eq('stato', 'READY')
        .select(COLONNE)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return data ? daRiga(data as unknown as Record<string, unknown>) : null;
    },

    async accoda(interpelloIds) {
      // `ignoreDuplicates`: una voce gia' presente NON torna READY.
      const righe = interpelloIds.map((id) => ({ interpello_id: id, stato: 'READY' }));
      const { error } = await client
        .from('notification_queue')
        .upsert(righe, { onConflict: 'interpello_id', ignoreDuplicates: true });
      return error ? error.message : null;
    },

    async salva(voce) {
      const { error } = await client
        .from('notification_queue')
        .update(aRiga(voce))
        .eq('interpello_id', voce.interpelloId);
      return error ? error.message : null;
    },

    async riapriBloccati(secondi, adesso) {
      const soglia = new Date(adesso.getTime() - secondi * 1000).toISOString();
      const { data, error } = await client
        .from('notification_queue')
        .update({ stato: 'READY', locked_at: null, locked_by: null })
        .eq('stato', 'PROCESSING')
        .lt('locked_at', soglia)
        .select('interpello_id');
      if (error) throw new Error(error.message);
      return ((data ?? []) as unknown[]).length;
    },
  };
}
