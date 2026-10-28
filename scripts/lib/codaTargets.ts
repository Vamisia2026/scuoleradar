/**
 * ScuoleRadar.it — LA CODA `discovered_links` VISTA DAL SEMINATORE (§26.94).
 *
 * Perché esiste: `scripts/sync-targets-whitelist.ts` era cresciuto oltre il
 * limite di 300 righe (E-DIM) perché conteneva tre mestieri diversi — seminare,
 * promuovere, spegnere i domini morti. Qui vivono i mestieri «di coda»:
 *
 *  · `daPromuovere` + `aggiornaStato`: portare una fonte VERIFICATA da
 *    `pending` (stato del discovery engine) ad `active_crawler` (lo stato che
 *    `table-reporter` legge davvero);
 *  · `rilevaDominiMorti`: risolvere in DNS l'host di ogni target attivo e
 *    restituire quelli che rispondono `ENOTFOUND` (un timeout NON è una prova).
 *
 * Node-only (usa `node:dns`), nessuna scrittura implicita: chi chiama decide se
 * applicare. Guardia: `scripts/test-whitelist-targets.ts` (in `npm test`).
 */

import { promises as dnsPromises } from 'node:dns';
import type { SupabaseClient } from '@supabase/supabase-js';
/** Riga di `discovered_links` che serve alla coda (campi usati dal seminatore). */
export interface RigaCoda {
  id: string;
  url: string;
  status: string;
  region: string | null;
  province: string | null;
  domain: string | null;
}

/** Stato che il discovery engine consuma (`fetchPendingTargets`). */
export const STATO_PENDING = 'pending';
/** Stato che legge l'ingestione (`scripts/table-reporter.ts`). */
export const STATO_ATTIVO = 'active_crawler';
/** Stato di un target spento. */
export const STATO_SPENTO = 'disabled';
/** True se la riga è in coda `pending` (da promuovere con `--attiva`). */
export function ePending(riga: RigaCoda | undefined): riga is RigaCoda {
  return Boolean(riga) && riga?.status === STATO_PENDING;
}

/** Righe `pending` fra i target dati (dedup per id, ordine di ingresso). */
export function daPromuovere(
  presenti: ReadonlyArray<{ url: string }>,
  esistenti: Map<string, RigaCoda>,
  chiave: (url: string) => string,
): RigaCoda[] {
  const out: RigaCoda[] = [];
  const visti = new Set<string>();
  for (const target of presenti) {
    const riga = esistenti.get(chiave(target.url));
    if (!riga || visti.has(riga.id) || !ePending(riga)) continue;
    visti.add(riga.id);
    out.push(riga);
  }
  return out;
}

/**
 * Righe già presenti per i domini della whitelist, indicizzate per URL
 * canonica (`chiave`). Si interroga per DOMINIO (poche decine) e si confronta
 * l'URL canonica: nessuna query per target.
 */
export async function righePresenti(
  client: SupabaseClient,
  targets: ReadonlyArray<{ url: string; domain: string }>,
  chiave: (url: string) => string,
): Promise<Map<string, RigaCoda>> {
  const chiavi = new Set(targets.map((target) => chiave(target.url)));
  const domini = [...new Set(targets.map((target) => target.domain))];
  const out = new Map<string, RigaCoda>();
  const PASSO = 100;
  for (let i = 0; i < domini.length; i += PASSO) {
    const { data, error } = await client
      .from('discovered_links')
      .select('id, url, status, region, province, domain')
      .in('domain', domini.slice(i, i + PASSO));
    if (error) throw new Error(`Lettura discovered_links: ${error.message}`);
    for (const riga of (data ?? []) as RigaCoda[]) {
      const url = chiave(riga.url);
      if (chiavi.has(url) && !out.has(url)) out.set(url, riga);
    }
  }
  return out;
}

/**
 * Inserisce i target mancanti in coda come `pending`, a lotti di 50.
 * Ritorna il numero di errori (un lotto fallito non ferma gli altri).
 */
export async function inserisciTargets(
  client: SupabaseClient,
  nuovi: ReadonlyArray<{
    url: string;
    domain: string;
    region: string | null;
    province: string | null;
  }>,
  log: (riga: string) => void = console.log,
): Promise<number> {
  let errori = 0;
  const PASSO = 50;
  for (let i = 0; i < nuovi.length; i += PASSO) {
    const lotto = nuovi.slice(i, i + PASSO).map((target) => ({
      url: target.url,
      domain: target.domain,
      region: target.region,
      province: target.province,
      status: STATO_PENDING,
    }));
    const { error } = await client.from('discovered_links').insert(lotto);
    if (error) {
      errori += 1;
      console.error(`[coda] Inserimento fallito (lotto ${i / PASSO + 1}): ${error.message}`);
    } else {
      log(`[coda] + ${lotto.length} target inseriti in coda (pending).`);
    }
  }
  return errori;
}

/** Ripara `region`/`province`/`domain` mancanti, senza toccare il resto. */
export async function riparaMetadati(
  client: SupabaseClient,
  daRiparare: ReadonlyArray<{
    url: string;
    region: string | null;
    province: string | null;
    domain: string;
  }>,
  esistenti: Map<string, RigaCoda>,
  chiave: (url: string) => string,
): Promise<number> {
  let errori = 0;
  for (const target of daRiparare) {
    const riga = esistenti.get(chiave(target.url));
    if (!riga) continue;
    const patch: Record<string, string> = {};
    if (!riga.region && target.region) patch.region = target.region;
    if (!riga.province && target.province) patch.province = target.province;
    if (!riga.domain && target.domain) patch.domain = target.domain;
    if (Object.keys(patch).length === 0) continue;
    const { error } = await client.from('discovered_links').update(patch).eq('id', riga.id);
    if (error) {
      errori += 1;
      console.error(`[coda] Riparazione fallita ${target.url}: ${error.message}`);
    }
  }
  return errori;
}
export async function aggiornaStato(
  client: SupabaseClient,
  ids: readonly string[],
  status: string,
  etichetta: string,
  log: (riga: string) => void = console.log,
): Promise<number> {
  let errori = 0;
  const PASSO = 100;
  for (let i = 0; i < ids.length; i += PASSO) {
    const lotto = ids.slice(i, i + PASSO);
    const { error } = await client.from('discovered_links').update({ status }).in('id', lotto);
    if (error) {
      errori += 1;
      console.error(`[coda] ${etichetta} fallita: ${error.message}`);
    } else {
      log(`[coda] ~ ${lotto.length} target → ${status} (${etichetta}).`);
    }
  }
  return errori;
}

/** Host di un URL, `null` se non è http(s). */
export function hostDi(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
    return parsed.hostname.toLowerCase();
  } catch {
    return null;
  }
}

/**
 * Un host che il DNS dichiara INESISTENTE (`ENOTFOUND`). Gli altri errori
 * (timeout, `EAI_AGAIN`, resolver giù) NON spengono nulla: un guasto di rete
 * non è una prova che il dominio non esista più.
 */
export async function dominioInesistente(host: string): Promise<boolean> {
  try {
    await Promise.race([
      dnsPromises.lookup(host),
      new Promise((_, reject) => setTimeout(() => reject(new Error('DNS_TIMEOUT')), 6_000)),
    ]);
    return false;
  } catch (err) {
    return String((err as { code?: string })?.code ?? '') === 'ENOTFOUND';
  }
}

/** Esito del controllo DNS sui target attivi. */
export interface EsitoDominiMorti {
  hostControllati: number;
  /** host inesistente → righe che lo usano. */
  perHost: Map<string, RigaCoda[]>;
  /** Tutte le righe da spegnere, in ordine. */
  righe: RigaCoda[];
}

/**
 * Controlla i target `active_crawler` e restituisce i domini che non esistono
 * più. Nessuna scrittura: la fa `aggiornaStato` quando si è in `--apply`.
 */
export async function rilevaDominiMorti(
  client: SupabaseClient,
  log: (riga: string) => void = console.log,
): Promise<EsitoDominiMorti> {
  const vuoto: EsitoDominiMorti = { hostControllati: 0, perHost: new Map(), righe: [] };
  const { data, error } = await client
    .from('discovered_links')
    .select('id, url, status, region, province, domain')
    .eq('status', STATO_ATTIVO);
  if (error) {
    console.error(`[coda] Lettura target attivi fallita: ${error.message}`);
    return vuoto;
  }

  const perHost = new Map<string, RigaCoda[]>();
  for (const riga of (data ?? []) as RigaCoda[]) {
    const host = hostDi(riga.url);
    if (!host) continue;
    perHost.set(host, [...(perHost.get(host) ?? []), riga]);
  }

  const morti = new Map<string, RigaCoda[]>();
  for (const [host, righe] of perHost) {
    if (await dominioInesistente(host)) morti.set(host, righe);
  }

  const righe = [...morti.values()].flat();
  log(
    `[coda] DNS: ${perHost.size} host attivi controllati · ` +
      `${morti.size} inesistenti · ${righe.length} target da spegnere.`,
  );
  for (const [host, righeHost] of morti) {
    log(`  ✗ ${host} (${righeHost.length} target) — ENOTFOUND`);
    for (const riga of righeHost) log(`      ${riga.url}`);
  }
  return { hostControllati: perHost.size, perHost: morti, righe };
}
