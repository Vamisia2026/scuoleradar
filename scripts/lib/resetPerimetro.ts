/**
 * ScuoleRadar.it — RESET DELLA CODA NEL PERIMETRO STRETTO (§26.131).
 *
 * Funzioni pure di I/O per `scripts/reset-coda-perimetro.ts`: lette una volta,
 * provate dal comando. Il file è separato perché la regola d'architettura chiede
 * massimo 300 righe per file e perché un comando che CANCELLA merita di essere
 * leggibile in una schermata.
 *
 * Tre passaggi, ognuno con il suo perché:
 *  1. `discovered_links` — cancellare i target fuori perimetro, rimettere in
 *     `pending` i target del perimetro parcheggiati da un motore che aveva
 *     rinunciato (incidenti, non giudizi);
 *  2. `scan_targets` — tenere solo le città del perimetro e rimetterle in coda;
 *  3. `source_health` — togliere la quarantena alle fonti del perimetro.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import {
  PROVINCE_PERIMETRO,
  eProvinciaPerimetro,
  nomeProvinciaPerimetro,
} from '../../src/lib/perimetroIngestione.ts';
import { chiaveElenco, targetWhitelist } from '../../src/scraper/whitelistTargets.ts';
import { aggiornaStato, STATO_PENDING } from './codaTargets.ts';

/**
 * Stati che un motore ha scritto quando ha RINUNCIATO a leggere un target senza
 * condannarlo: sono incidenti, non giudizi. Tornano `pending` per il perimetro.
 */
export const STATI_PARCHEGGIATI: readonly string[] = [
  'error_timeout',
  'error_http',
  'error_internal',
  'not_found',
  'empty_view',
  'disqualified_noise',
  'parked_low_score',
  'parked_for_pdf',
];

/** Stati che NON si toccano: un giudizio (spam, esclusione) non è un incidente. */
export const STATI_INTANGIBILI: readonly string[] = ['blacklisted', 'disabled'];

/** URL canonici delle fonti ufficiali: sono nel perimetro anche se sono altrove. */
export const CHIAVI_WHITELIST: ReadonlySet<string> = new Set(
  targetWhitelist().map((target) => chiaveElenco(target.url)),
);

/** Le città della coda per il perimetro: il nome della provincia (`AT` → `Asti`). */
export const CITTA_PERIMETRO: readonly string[] = PROVINCE_PERIMETRO.map((codice) =>
  nomeProvinciaPerimetro(codice),
);

export interface RigaCoda {
  id: string;
  url: string;
  province: string | null;
  status: string;
}

/** True se il target è dentro il perimetro: provincia ammessa O fonte in whitelist. */
export function inPerimetro(riga: RigaCoda): boolean {
  if (eProvinciaPerimetro(riga.province)) return true;
  return CHIAVI_WHITELIST.has(chiaveElenco(riga.url));
}

/**
 * Tutte le righe della coda, paginate: PostgREST tronca a 1.000 e un conteggio
 * troncato sembra un dato.
 */
export async function leggiCoda(client: SupabaseClient): Promise<RigaCoda[]> {
  const out: RigaCoda[] = [];
  for (let da = 0; ; da += 1000) {
    const { data, error } = await client
      .from('discovered_links')
      .select('id, url, province, status')
      .order('id', { ascending: true })
      .range(da, da + 999);
    if (error) throw new Error(`Lettura discovered_links: ${error.message}`);
    const pagina = (data ?? []) as RigaCoda[];
    out.push(...pagina);
    if (pagina.length < 1000) break;
  }
  return out;
}

/** Cancella per id in lotti di 100; restituisce il numero di righe eliminate. */
export async function elimina(client: SupabaseClient, ids: readonly string[]): Promise<number> {
  let eliminati = 0;
  for (let i = 0; i < ids.length; i += 100) {
    const lotto = ids.slice(i, i + 100);
    const { error } = await client.from('discovered_links').delete().in('id', lotto);
    if (error) throw new Error(`Cancellazione discovered_links: ${error.message}`);
    eliminati += lotto.length;
  }
  return eliminati;
}

/** Riepilogo per stato, in ordine decrescente: è il «prima» e il «dopo» del reset. */
export function perStato(righe: readonly RigaCoda[]): Array<[string, number]> {
  const conteggio = new Map<string, number>();
  for (const riga of righe) conteggio.set(riga.status, (conteggio.get(riga.status) ?? 0) + 1);
  return [...conteggio.entries()].sort((a, b) => b[1] - a[1]);
}

export function stampaStati(titolo: string, righe: readonly RigaCoda[]): void {
  console.log(`${titolo} (${righe.length} totali)`);
  for (const [stato, n] of perStato(righe)) console.log(`  · ${stato}: ${n}`);
}

/** Rimette in `pending` i target del perimetro parcheggiati; restituisce quanti. */
export async function sbloccaParcheggiati(
  client: SupabaseClient,
  righe: readonly RigaCoda[],
  apply: boolean,
): Promise<number> {
  const daSbloccare = righe.filter(
    (riga) => inPerimetro(riga) && STATI_PARCHEGGIATI.includes(riga.status),
  );
  const intangibili = righe.filter((riga) => STATI_INTANGIBILI.includes(riga.status));
  console.log(
    `\n[reset] discovered_links — perimetro: ${righe.filter(inPerimetro).length} · ` +
      `da sbloccare: ${daSbloccare.length} · intangibili (${STATI_INTANGIBILI.join(', ')}): ${intangibili.length}`,
  );
  if (!apply || daSbloccare.length === 0) return daSbloccare.length;
  const errori = await aggiornaStato(
    client,
    daSbloccare.map((riga) => riga.id),
    STATO_PENDING,
    'sblocco perimetro',
  );
  if (errori > 0) throw new Error(`Sblocco discovered_links: ${errori} lotti falliti`);
  return daSbloccare.length;
}
