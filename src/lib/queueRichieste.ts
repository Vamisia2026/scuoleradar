/**
 * ScuoleRadar.it — RICHIESTA di scansione regionale, lato PUBBLICO.
 *
 * Quando l'utente prova il Radar o salva le sue province, la coda di scansione
 * deve anticipare il giro periodico su quella regione. L'unica RPC aperta ad
 * `anon` è `request_scan_target`
 * (`supabase/migrations/20261006120000_scan_targets_richieste.sql`): anticipa il
 * target ESISTENTE (`next_run_at = now()`) e ne alza la priorità, senza MAI
 * inserire righe nuove e con un throttle server-side. Le RPC dei worker restano
 * in `./queue.ts` e sono di servizio (solo `SUPABASE_SERVICE_ROLE_KEY`).
 *
 * §26.126 — DUE domande, non una. La coda ragiona per CITTÀ (capoluogo di
 * regione): è giusto per accendere l'hub USR, ma non dice QUALE provincia è stata
 * chiesta (`Cuneo` finisce su `Torino`). L'MVP demand-driven ha bisogno anche del
 * codice di provincia, e lo registra in `province_domanda` con la seconda RPC
 * pubblica `request_province_scan`: quel registro è ciò che `scripts/crawl-mvp`
 * legge per approfondire le scuole della provincia chiesta.
 *
 * REGOLA DI ROBUSTEZZA — ECCEZIONE DICHIARATA rispetto a `./queue.ts`: qui un
 * errore della RPC NON viene lanciato (ritorna `false` con un `console.warn`).
 * Le tre RPC dei worker guidano un ciclo di lavoro e un errore deve fermarlo;
 * questa invece è una richiesta del BROWSER: la prova del Radar e il salvataggio
 * del profilo devono riuscire anche se la coda è irraggiungibile, perché la coda
 * è un'ANTICIPAZIONE del giro periodico, non una loro dipendenza.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { cittaTargetDaProvince } from './scanTargets';

/**
 * Fonte registrata in coda per una richiesta di scansione. Finisce in
 * `scan_targets.last_request_source` e serve alla diagnosi («chi ha chiesto questo
 * giro?»): le due sorgenti pubbliche non si mescolano.
 */
export const FONTE_RICHIESTA_PROVA = 'prova-radar';
export const FONTE_RICHIESTA_PREFERENZE = 'preferenze';

/** Finestra di throttle server-side, in minuti: entro questa una richiesta è assorbita. */
export const SOGLIA_RICHIESTA_MIN = 5;

/** Priorità imposta da una richiesta esplicita (il claim ordina per priorità crescente). */
export const PRIORITA_RICHIESTA = 10;

/** Parametri di `richiediScansioneCitta`. */
export interface OpzioniRichiestaScan {
  /** Città della coda (es. `'Torino'`): deve ESISTERE già in `scan_targets`. */
  city: string;
  /** Chi ha chiesto la scansione (`FONTE_RICHIESTA_PROVA`, `FONTE_RICHIESTA_PREFERENZE`, …). */
  source: string;
  /** Priorità da imporre al target (default `PRIORITA_RICHIESTA`). */
  priority?: number;
  /** Finestra di throttle in minuti, 0 = nessun throttle (default `SOGLIA_RICHIESTA_MIN`). */
  throttleMinutes?: number;
}

/**
 * CHIEDE la scansione di UNA città già presente in coda (`request_scan_target`):
 * stato `queued`, `next_run_at = now()` e priorità alzata, così il prossimo worker
 * la prende in carico prima del giro periodico. Ritorna `true` se la richiesta è
 * stata registrata, `false` se assorbita dal throttle, se la città non è un target
 * della coda o se la coda non è configurata (`client === null`).
 */
export async function richiediScansioneCitta(
  client: SupabaseClient | null,
  opzioni: OpzioniRichiestaScan,
): Promise<boolean> {
  if (!client) return false;
  const city = (opzioni?.city ?? '').trim();
  if (!city) return false;
  const source = (opzioni.source ?? '').trim() || 'sconosciuta';
  const { data, error } = await client.rpc('request_scan_target', {
    p_city: city,
    p_source: source,
    p_priority: opzioni.priority ?? PRIORITA_RICHIESTA,
    p_throttle_minutes: opzioni.throttleMinutes ?? SOGLIA_RICHIESTA_MIN,
  });
  if (error) {
    console.warn(`Coda scansione: richiesta per «${city}» non registrata (${error.message}).`);
    return false;
  }
  return data === true;
}

/**
 * Chiede la scansione delle città che coprono le province indicate: il capoluogo
 * della regione di ognuna, più i target aggiuntivi della provincia pilota
 * (`./scanTargets`). Le province ignote sono ignorate e i duplicati collassano,
 * quindi al più 21 richieste (una per città del seed).
 *
 * Ritorna le città ACCETTATE dalla coda (throttle e città senza target escluse):
 * serve al log del chiamante e ai test. In sequenza, non in parallelo: sono due o
 * tre chiamate e l'ordine rende leggibile la diagnosi.
 */
export async function richiediScansioniProvince(
  client: SupabaseClient | null,
  province: readonly string[] | null | undefined,
  source: string,
): Promise<string[]> {
  if (!client) return [];
  const accettate: string[] = [];
  for (const city of cittaTargetDaProvince(province)) {
    if (await richiediScansioneCitta(client, { city, source })) accettate.push(city);
  }
  return accettate;
}

/* ---------------------- DOMANDA PER PROVINCIA (§26.126) ---------------------- */

/** RPC che registra la domanda su UNA provincia (`province_domanda`). */
export const RPC_RICHIESTA_PROVINCIA = 'request_province_scan';

/**
 * Throttle server-side della domanda per provincia, in minuti. Più largo di
 * quello della città (5 minuti): la domanda è un segnale di INTENSITÀ, non
 * un'allerta — salvando due volte il profilo non si deve riscrivere il registro.
 */
export const SOGLIA_RICHIESTA_PROVINCIA_MIN = 60;

/**
 * Codice provincia valido per la RPC: due lettere, maiuscole. `null` per tutto
 * il resto (la validazione server-side è la stessa: `^[A-Z]{2}$`).
 */
export function normalizzaProvinciaRichiesta(codice?: string | null): string | null {
  const c = (codice ?? '').trim().toUpperCase();
  return /^[A-Z]{2}$/.test(c) ? c : null;
}

/** Parametri di `richiediDomandaProvincia`. */
export interface OpzioniDomandaProvincia {
  /** Codice provincia (`'AT'`): la provincia che l'utente ha cercato o salvato. */
  province: string;
  /** Chi l'ha chiesta (`FONTE_RICHIESTA_PROVA`, `FONTE_RICHIESTA_PREFERENZE`, …). */
  source: string;
  /** Finestra di throttle in minuti (default `SOGLIA_RICHIESTA_PROVINCIA_MIN`). */
  throttleMinutes?: number;
}

/**
 * REGISTRA la domanda per una provincia specifica (`request_province_scan`).
 * Ritorna `true` se la richiesta è stata registrata, `false` se assorbita dal
 * throttle, se il codice non è valido o se la coda non è configurata. Non lancia
 * MAI: è la stessa eccezione dichiarata di `richiediScansioneCitta`.
 *
 * Se la migrazione `20261101120000_province_domanda.sql` non è applicata la RPC
 * non esiste: il `console.warn` lo dice una volta per chiamata e la prova del
 * Radar continua (il segnale manca, il servizio no).
 */
export async function richiediDomandaProvincia(
  client: SupabaseClient | null,
  opzioni: OpzioniDomandaProvincia,
): Promise<boolean> {
  if (!client) return false;
  const province = normalizzaProvinciaRichiesta(opzioni?.province);
  if (!province) return false;
  const source = (opzioni.source ?? '').trim() || 'sconosciuta';
  const { data, error } = await client.rpc(RPC_RICHIESTA_PROVINCIA, {
    p_province: province,
    p_source: source,
    p_throttle_minutes: opzioni.throttleMinutes ?? SOGLIA_RICHIESTA_PROVINCIA_MIN,
  });
  if (error) {
    console.warn(
      `Province domanda: richiesta per «${province}» non registrata (${error.message}).`,
    );
    return false;
  }
  return data === true;
}

/**
 * Registra la domanda per un elenco di province (una RPC per codice, in
 * sequenza: sono al più 4). Ritorna i codici ACCETTATI dal registro — serve al
 * log del chiamante e alle guardie; un codice ignoto non entra.
 */
export async function richiediDomandaProvince(
  client: SupabaseClient | null,
  province: readonly string[] | null | undefined,
  source: string,
): Promise<string[]> {
  if (!client) return [];
  const codici = [
    ...new Set((province ?? []).map((c) => normalizzaProvinciaRichiesta(c)).filter(Boolean)),
  ] as string[];
  const accettate: string[] = [];
  for (const provinceCodice of codici) {
    if (await richiediDomandaProvincia(client, { province: provinceCodice, source })) {
      accettate.push(provinceCodice);
    }
  }
  return accettate;
}
