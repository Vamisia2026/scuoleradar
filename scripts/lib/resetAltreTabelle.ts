/**
 * ScuoleRadar.it — RESET DELLE ALTRE TABELLE NEL PERIMETRO (§26.131).
 *
 * I due passaggi di `scripts/reset-coda-perimetro.ts` che non riguardano
 * `discovered_links`: la coda di scansione (`scan_targets`) e la quarantena
 * delle fonti (`source_health`). Stanno qui perché ognuno è una diagnosi a sé —
 * «la coda di scansione è ferma» e «la fonte è muta» sono due guasti diversi — e
 * perché la regola d'architettura chiede massimo 250 righe per file.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import {
  PROVINCE_PERIMETRO,
  nomeProvinciaPerimetro,
} from '../../src/lib/perimetroIngestione.ts';
import { chiaveElenco } from '../../src/scraper/whitelistTargets.ts';
import { regioneDiProvincia } from '../../src/lib/ambitoProvincia.ts';
import { CITTA_PERIMETRO } from './resetPerimetro.ts';


/**
 * Passaggio 2 — `scan_targets`: la coda di SCANSIONE (una riga per città).
 * Le città del perimetro si tengono e si rimettono in `idle` (lock libero,
 * `next_run_at = now()`, contatori azzerati); le altre si cancellano. Una città
 * del perimetro senza riga viene INSERITA: il perimetro è una promessa, non
 * quello che il database ricorda.
 */
export async function ripristinaScanTargets(client: SupabaseClient, apply: boolean): Promise<void> {
  let righe: Array<{ id: string; city: string }>;
  try {
    const { data, error } = await client.from('scan_targets').select('id, city');
    if (error) throw new Error(error.message);
    righe = (data ?? []) as Array<{ id: string; city: string }>;
  } catch (err) {
    console.warn(
      `[reset] scan_targets non disponibile (${err instanceof Error ? err.message : String(err)}): ` +
        'passaggio saltato (la coda di scansione non è mai stata creata in questo ambiente).',
    );
    return;
  }

  const chiave = (citta: string): string => String(citta ?? '').trim().toLowerCase();
  const ammesse = new Set(CITTA_PERIMETRO.map(chiave));
  const tenute = righe.filter((riga) => ammesse.has(chiave(riga.city)));
  const fuori = righe.filter((riga) => !ammesse.has(chiave(riga.city)));
  console.log(
    `\n[reset] scan_targets: ${righe.length} città in coda · ` +
      `${tenute.length} del perimetro (${CITTA_PERIMETRO.join(', ')}) · ${fuori.length} fuori.`,
  );
  if (!apply) {
    if (fuori.length > 0) {
      console.log(`  · sarebbero cancellate: ${fuori.map((riga) => riga.city).join(', ')}`);
    }
    return;
  }

  for (const riga of fuori) {
    const { error } = await client.from('scan_targets').delete().eq('id', riga.id);
    if (error) throw new Error(`Cancellazione scan_targets (${riga.city}): ${error.message}`);
  }
  if (fuori.length > 0) console.log(`  · ~ ${fuori.length} città cancellate.`);

  for (const riga of tenute) {
    const { error } = await client
      .from('scan_targets')
      .update({
        status: 'idle',
        next_run_at: new Date().toISOString(),
        locked_at: null,
        locked_by: null,
        consecutive_failures: 0,
        last_error: null,
      })
      .eq('id', riga.id);
    if (error) throw new Error(`Reset scan_targets (${riga.city}): ${error.message}`);
  }
  if (tenute.length > 0) {
    console.log(`  · ~ ${tenute.length} città riportate a «idle» con lock libero.`);
  }

  for (const codice of PROVINCE_PERIMETRO) {
    const citta = nomeProvinciaPerimetro(codice);
    if (tenute.some((riga) => chiave(riga.city) === chiave(citta))) continue;
    const { error } = await client
      .from('scan_targets')
      .insert({ city: citta, region: regioneDiProvincia(codice) ?? 'n.d.' });
    if (error) throw new Error(`Inserimento scan_targets (${citta}): ${error.message}`);
    console.log(`  · + ${citta} inserita nella coda di scansione.`);
  }
}


/**
 * Passaggio 3 — `source_health`: la quarantena delle fonti del perimetro.
 * La finestra è di 60 giorni: aspettarla significherebbe tenere muta per due mesi
 * una fonte che magari ha solo cambiato impaginazione. Si riabilita
 * DICHIARANDOLO; se è ancora rotta, le regole la isolano di nuovo.
 */
export async function riabilitaFonti(
  client: SupabaseClient,
  chiaviPerimetro: ReadonlySet<string>,
  apply: boolean,
): Promise<void> {
  let righe: Array<{ source_url: string; is_quarantined: boolean; consecutive_failures: number }>;
  try {
    const { data, error } = await client
      .from('source_health')
      .select('source_url, is_quarantined, consecutive_failures');
    if (error) throw new Error(error.message);
    righe = (data ?? []) as Array<{
      source_url: string;
      is_quarantined: boolean;
      consecutive_failures: number;
    }>;
  } catch (err) {
    console.warn(
      `[reset] source_health non disponibile (${err instanceof Error ? err.message : String(err)}): ` +
        'passaggio saltato (nessuna telemetria delle fonti in questo ambiente).',
    );
    return;
  }

  const daRiabilitare = righe.filter(
    (riga) =>
      (riga.is_quarantined || riga.consecutive_failures > 0) &&
      chiaviPerimetro.has(chiaveElenco(riga.source_url)),
  );
  console.log(
    `\n[reset] source_health: ${righe.length} fonti in telemetria · ` +
      `${daRiabilitare.length} del perimetro in quarantena o con fallimenti.`,
  );
  if (!apply) {
    for (const riga of daRiabilitare.slice(0, 10)) {
      console.log(`  · sarebbe riabilitata: ${riga.source_url}`);
    }
    if (daRiabilitare.length > 10) console.log(`  · … e altre ${daRiabilitare.length - 10}.`);
    return;
  }

  for (const riga of daRiabilitare) {
    const { error } = await client
      .from('source_health')
      .update({
        is_quarantined: false,
        consecutive_failures: 0,
        quarantine_reason: null,
        quarantined_at: null,
        status: 'unknown',
      })
      .eq('source_url', riga.source_url);
    if (error) throw new Error(`Riabilitazione fonte (${riga.source_url}): ${error.message}`);
  }
  console.log(
    `  · ~ ${daRiabilitare.length} fonti riabilitate (quarantena tolta, contatori azzerati).`,
  );
}
