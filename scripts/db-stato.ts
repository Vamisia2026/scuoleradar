/**
 * ScuoleRadar.it — STATO DEL DATABASE IN UN COLPO D'OCCHIO (§26.94).
 *
 * Perché esiste: dopo un giro di ingestione la domanda è sempre la stessa —
 * «quanti interpelli VIVI ci sono adesso, e dove?». Contarli a mano con quattro
 * query in psql è il modo più rapido per sbagliare: `expiration_date` NULL non è
 * «scaduto», `deadline` è legacy, e la REST API tronca le risposte a 1.000 righe
 * (una `select` senza paginazione dà numeri falsi: misurato il 26/10/2026 su
 * `discovered_links`, 1.513 righe invece di 16.808).
 *
 * Cosa stampa: totale/vivi/senza scadenza di `interpelli`, distribuzione per
 * regione, stati di `discovered_links` (paginati) e di `notification_queue`,
 * numero di `scrape_reports`. Nessuna scrittura, nessuna rete oltre al DB.
 *
 * Uso: `npm run db:stato` (oppure `npx tsx scripts/db-stato.ts`).
 */
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  { auth: { persistSession: false, autoRefreshToken: false } },
);

const oggi = new Date().toISOString().slice(0, 10);

async function conta(tabella: string, filtri: Record<string, string> = {}): Promise<number> {
  let query = supabase.from(tabella).select('*', { count: 'exact', head: true });
  for (const [chiave, valore] of Object.entries(filtri)) query = query.eq(chiave, valore);
  const { count } = await query;
  return count ?? 0;
}

/**
 * Conteggio per valore di una colonna, con PAGINAZIONE esplicita: PostgREST
 * tronca a 1.000 righe per risposta, e un conteggio troncato è peggio di nessun
 * conteggio (sembra un dato).
 */
async function conteggioPer(tabella: string, colonna: string): Promise<Record<string, number>> {
  const out: Record<string, number> = {};
  let da = 0;
  for (;;) {
    const { data } = await supabase
      .from(tabella)
      .select(colonna)
      .range(da, da + 999);
    const righe = (data ?? []) as Array<Record<string, unknown>>;
    for (const riga of righe) {
      const valore = String(riga[colonna] ?? 'N/D');
      out[valore] = (out[valore] ?? 0) + 1;
    }
    da += righe.length;
    if (righe.length < 1000) break;
  }
  return out;
}

const totale = await conta('interpelli');
const { count: vivi } = await supabase
  .from('interpelli')
  .select('*', { count: 'exact', head: true })
  .gte('expiration_date', `${oggi}T00:00:00+00:00`);
const { count: senzaScadenza } = await supabase
  .from('interpelli')
  .select('*', { count: 'exact', head: true })
  .is('expiration_date', null);
const perRegione = await conteggioPer('interpelli', 'region');
const { count: linksTotale } = await supabase
  .from('discovered_links')
  .select('*', { count: 'exact', head: true });

console.log(
  JSON.stringify(
    {
      oggi,
      interpelli: {
        totale,
        vivi: vivi ?? 0,
        senzaScadenza: senzaScadenza ?? 0,
        // `expiration_date` NULL è storico, non è «scaduto»: si dichiara a parte.
        note: 'vivi = expiration_date >= oggi',
      },
      perRegione: Object.fromEntries(
        Object.entries(perRegione).sort((a, b) => b[1] - a[1]),
      ),
      discoveredLinks: { totale: linksTotale ?? 0, perStato: await conteggioPer('discovered_links', 'status') },
      notificationQueue: await conteggioPer('notification_queue', 'status'),
      scrapeReports: await conta('scrape_reports'),
    },
    null,
    2,
  ),
); // fine del report
