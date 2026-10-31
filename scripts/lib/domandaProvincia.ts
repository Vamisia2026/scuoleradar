/**
 * ScuoleRadar.it — LA DOMANDA DI SCANSIONE vista dal worker (§26.126).
 *
 * Estratto da `scripts/crawl-mvp.ts` (che era oltre il tetto dei 300 righe): qui
 * vivono i tre mestieri che parlano con il database, non la politica del giro.
 *
 *  · `leggiDomanda` — le richieste registrate dal pubblico in `province_domanda`
 *    (tabella con RLS: la legge solo il `service_role`). Una tabella assente
 *    (migrazione non applicata) NON ferma il giro: si prosegue con la sola
 *    baseline e il warning lo dichiara.
 *  · `contaAvvisiAttivi` — quante righe di `interpelli` non sono scadute: è il
 *    numero che regola il termostato (`lib/termostatoCrawl`, §26.127).
 *  · `promuoviRichieste` — le scuole seminate da `import-schools-local` nascono
 *    `pending`, mentre `table-reporter` legge `active_crawler`: senza questa
 *    promozione resterebbero in attesa per sempre. Si promuovono SOLO le
 *    province con domanda attiva — una provincia non richiesta non si risveglia
 *    di massa.
 *
 * Node-only (usa Supabase con `SUPABASE_SERVICE_ROLE_KEY`). La finestra di
 * validità della domanda NON è qui: è `lib/mvpPerimetro.pianoScansione`.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { STATO_ATTIVO, STATO_PENDING, aggiornaStato, type RigaCoda } from './codaTargets.ts';
import type { RichiestaProvincia } from '../../src/lib/mvpPerimetro.ts';
import { dataIsoLocale } from '../../src/lib/scadenza.ts';

/**
 * AVVISI ATTIVI IN ARCHIVIO: quante righe di `interpelli` non sono scadute.
 *
 * È la STESSA popolazione che il Radar Live conta e mostra (`filtroAttivi` del
 * dipartimento Radar: `expiration_date >= oggi`, §26.100), quindi il termostato
 * e la vetrina parlano della stessa cosa — nessun conteggio «di comodo».
 * Si chiede il conteggio esatto con `head: true`: nessuna riga trasferita,
 * nemmeno quando l'archivio è grande.
 *
 * Ritorna `null` quando il numero non è disponibile (credenziali assenti,
 * tabella non raggiungibile, conteggio non dichiarato): chi legge usa le
 * tarature di equilibrio, e il log lo dice. Mai un numero inventato.
 */
export async function contaAvvisiAttivi(
  supabase: SupabaseClient | null,
  oggi: Date = new Date(),
): Promise<number | null> {
  if (!supabase) {
    console.warn(
      '[crawl-mvp] Credenziali Supabase assenti: nessun conteggio degli avvisi attivi.',
    );
    return null;
  }
  const { count, error } = await supabase
    .from('interpelli')
    .select('id', { count: 'exact', head: true })
    .gte('expiration_date', dataIsoLocale(oggi));
  if (error) {
    console.warn(`[crawl-mvp] Conteggio degli avvisi attivi non leggibile: ${error.message}`);
    return null;
  }
  return typeof count === 'number' ? count : null;
}

/**
 * DOMANDA REGISTRATA. Il tetto di 500 righe è sopra il numero di province (107):
 * è una guardia contro una tabella cresciuta per errore, non un taglio.
 */
export async function leggiDomanda(
  supabase: SupabaseClient | null,
): Promise<RichiestaProvincia[]> {
  if (!supabase) {
    console.warn(
      '[crawl-mvp] Credenziali Supabase assenti: nessuna domanda da leggere, ' +
        'giro limitato alla baseline nazionale.',
    );
    return [];
  }
  const { data, error } = await supabase
    .from('province_domanda')
    .select('province, ultima_richiesta')
    .order('ultima_richiesta', { ascending: false })
    .limit(500);
  if (error) {
    console.warn(
      `[crawl-mvp] Registro della domanda non leggibile (${error.message}): ` +
        'giro limitato alla baseline. Applicare `20261101120000_province_domanda.sql`.',
    );
    return [];
  }
  return (data ?? []) as RichiestaProvincia[];
}

/** Target `pending` di UNA provincia (per la promozione delle richieste). */
async function targetPending(
  supabase: SupabaseClient,
  provincia: string,
): Promise<RigaCoda[]> {
  const { data, error } = await supabase
    .from('discovered_links')
    .select('id, url, status, region, province, domain')
    .eq('province', provincia)
    .eq('status', STATO_PENDING)
    .order('url', { ascending: true });
  if (error) {
    console.warn(`[crawl-mvp] Coda ${provincia} non leggibile: ${error.message}`);
    return [];
  }
  return (data ?? []) as RigaCoda[];
}

/**
 * PROMOZIONE (§26.125 · §26.126): `pending` → `active_crawler` per le province
 * richieste. Ritorna il numero di lotti falliti (0 = coda allineata).
 */
export async function promuoviRichieste(
  supabase: SupabaseClient,
  province: readonly string[],
  dryRun: boolean,
): Promise<number> {
  if (province.length === 0) return 0;
  let errori = 0;
  for (const provincia of province) {
    const pending = await targetPending(supabase, provincia);
    if (pending.length === 0) {
      console.log(`[crawl-mvp] ${provincia}: nessun target «${STATO_PENDING}» da promuovere.`);
      continue;
    }
    if (dryRun) {
      console.log(
        `[crawl-mvp] ${provincia}: ${pending.length} target «${STATO_PENDING}» ` +
          `pronti per «${STATO_ATTIVO}» (dry-run: nessuna scrittura).`,
      );
      continue;
    }
    errori += await aggiornaStato(
      supabase,
      pending.map((riga) => riga.id),
      STATO_ATTIVO,
      `domanda ${provincia}`,
    );
  }
  return errori;
}
