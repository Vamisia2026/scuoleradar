/**
 * ScuoleRadar.it — Dipartimento Radar · DATI DIMOSTRATIVI del tabellone «Radar Live» (sviluppo).
 *
 * Perché serve: i quattro comportamenti fissati dalla direttiva del 22/10/2026 si
 * vedono sui dati reali solo a tratti (poche righe hanno un link di piattaforma,
 * poche il sito istituzionale, quasi nessuna una scadenza entro i 30 giorni).
 * Questo comando scrive in `interpelli` le DIECI righe di `demoInterpelli.ts`,
 * ognuna con l'esito dichiarato (in bacheca con quale fonte/badge, oppure fuori):
 * così si verifica a occhio, e con la guardia `npm run test:board:demo`, che la
 * bacheca mostri esattamente ciò che deve.
 *
 * Cosa scrive (prefisso `hash_id = demo-`):
 *   7 righe che ENTRANO — Argo/Forms/Nuvola→home `.edu.it`, avvisi veri, badge
 *     pieni nei quattro stati di scadenza, nome istituto dal titolo;
 *   3 righe che RESTANO FUORI — nessuna fonte apribile, segnaposto «Scuola non
 *     specificata / Più plessi», titolo di sola pubblicazione. Restano nel
 *     database di proposito: sono la prova che il gate funziona.
 *
 * Le scadenze sono RELATIVE al giorno del run (`giorniAllaScadenza`), quindi la
 * demo non «invecchia»: rilanciata domani mostra gli stessi stati. Gli host
 * `.edu.it` sono INVENTATI: nessun traffico verso siti reali.
 *
 * Uso:
 *   npm run dati:demo                        # DRY-RUN: cosa scriverebbe
 *   npm run dati:demo -- --apply             # scrive/aggiorna le righe demo
 *   npm run dati:demo -- --pulisci           # DRY-RUN: quante righe demo esistono
 *   npm run dati:demo -- --pulisci --apply   # elimina TUTTE le righe demo
 *
 * Rifiuta di girare in PRODUZIONE (demo = dati finti): per farlo comunque serve
 * `--consenti-produzione`. Richiede la service role key (scrittura su `interpelli`).
 */
import process from 'node:process';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { PREFISSO_DEMO, payloadDemo, righeDemo } from './demoInterpelli.ts';
import { descriviEsito, preparaDemo } from './demoInterpelliVerifica.ts';
import { colonnaSitoAssente } from '../letturaInterpelli.ts';

try {
  process.loadEnvFile();
} catch {
  /* nessun .env: si usano le variabili già presenti nell'ambiente */
}

const APPLY = process.argv.includes('--apply');
const PULISCI = process.argv.includes('--pulisci');
const CONSENTI_PRODUZIONE = process.argv.includes('--consenti-produzione');

/** True quando il run tocca un ambiente servito al pubblico. */
const IN_PRODUZIONE =
  process.env.VERCEL_ENV === 'production' || process.env.NODE_ENV === 'production';

/** Riepilogo: cosa entrerà in bacheca e cosa resterà fuori (stesse regole del test). */
function riepilogo(): { inVetrina: number; fuori: number } {
  const oggi = new Date();
  const righe = righeDemo(oggi);
  const esiti = preparaDemo(righe, oggi);
  const inVetrina = esiti.filter((e) => e.esito === 'mostrata').length;

  console.log(
    `• Righe demo «${PREFISSO_DEMO}*»: ${righe.length} · scadenze calcolate da oggi (${oggi.toISOString().slice(0, 10)})`,
  );
  for (const e of esiti) console.log(`  ${descriviEsito(e)}`);
  console.log(
    `  → ${inVetrina} in bacheca, ${righe.length - inVetrina} fuori (le righe fuori restano nel database: provano il gate).`,
  );
  return { inVetrina, fuori: righe.length - inVetrina };
}

/** Quante righe demo esistono già (null = errore di lettura, già stampato). */
async function contaDemo(client: SupabaseClient): Promise<number | null> {
  const { count, error } = await client
    .from('interpelli')
    .select('hash_id', { count: 'exact', head: true })
    .like('hash_id', `${PREFISSO_DEMO}%`);
  if (error) {
    console.error(`✗ Lettura di interpelli fallita: ${error.message}`);
    return null;
  }
  return count ?? 0;
}

/**
 * Scrittura delle righe demo, tollerante alla migrazione `school_site` (§26.77):
 * se la colonna non esiste le righe entrano lo stesso e la home `.edu.it` ricade
 * sui recapiti (`../linkFonte.ts`), esattamente come fa la lettura della bacheca
 * (`../letturaInterpelli.ts`). Nessun'altra colonna del payload è recente, quindi
 * un errore diverso resta un errore.
 */
async function salvaDemo(
  client: SupabaseClient,
  righe: ReadonlyArray<Record<string, unknown>>,
): Promise<{ errore: string | null; senzaSito: boolean }> {
  // `as never`: il client non ha i tipi generati del database (come in
  // `src/scraper/index.ts`), quindi la firma di `upsert` chiederebbe `never`.
  const scrivi = (payload: ReadonlyArray<Record<string, unknown>>) =>
    client.from('interpelli').upsert(payload as never, { onConflict: 'hash_id' });

  let esito = await scrivi(righe);
  if (!esito.error || !colonnaSitoAssente(esito.error.message)) {
    return { errore: esito.error ? esito.error.message : null, senzaSito: false };
  }

  console.warn(
    '[dati:demo] colonna school_site assente (migrazione non applicata): scrittura senza home .edu.it',
  );
  const senzaSito = righe.map((riga) => {
    const copia = { ...riga };
    delete copia.school_site;
    return copia;
  });
  esito = await scrivi(senzaSito);
  return { errore: esito.error ? esito.error.message : null, senzaSito: true };
}

async function main(): Promise<void> {
  const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error('✗ Mancano SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY nel file .env');
    process.exitCode = 1;
    return;
  }
  if (IN_PRODUZIONE && !CONSENTI_PRODUZIONE) {
    console.error(
      '✗ Ambiente di PRODUZIONE: la demo sono dati FINTI e non va pubblicata.\n' +
        '  Se sai cosa stai facendo: --consenti-produzione.',
    );
    process.exitCode = 2;
    return;
  }

  riepilogo();
  const client = createClient(url, key, { auth: { persistSession: false } });
  const esistenti = await contaDemo(client);
  if (esistenti === null) {
    process.exitCode = 3;
    return;
  }

  if (PULISCI) {
    if (!APPLY) {
      console.log(
        `\n• DRY-RUN: ${esistenti} righe demo da eliminare. Per farlo: --pulisci --apply`,
      );
      return;
    }
    const { error } = await client.from('interpelli').delete().like('hash_id', `${PREFISSO_DEMO}%`);
    if (error) {
      console.error(`✗ Pulizia fallita: ${error.message}`);
      process.exitCode = 3;
      return;
    }
    console.log(`\n✓ Eliminate ${esistenti} righe demo.`);
    return;
  }

  if (!APPLY) {
    console.log(
      `\n• DRY-RUN: nessuna scrittura (${esistenti} righe demo già presenti).` +
        '\n  Per scriverle: --apply   ·   per eliminarle: --pulisci --apply',
    );
    return;
  }

  const righe = righeDemo(new Date());
  const { errore, senzaSito } = await salvaDemo(client, payloadDemo(righe));
  if (errore) {
    console.error(`✗ Scrittura fallita: ${errore}`);
    process.exitCode = 3;
    return;
  }

  const nuove = Math.max(0, righe.length - esistenti);
  console.log(
    `\n✓ ${righe.length} righe demo scritte (${nuove} nuove, ${righe.length - nuove} aggiornate)` +
      `${senzaSito ? ' · senza school_site (migrazione non applicata)' : ''}.` +
      '\n  Apri il tabellone: le righe «demo-*» che entrano hanno la fonte in colonna «Scuola».',
  );
}

void main();
