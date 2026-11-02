/**
 * scripts/reset-coda-perimetro.ts
 *
 * RIPULISCE LA CODA DI STAGING E LA RIPORTA NEL PERIMETRO STRETTO (§26.131).
 *
 * PERCHÉ ESISTE. Il 02/11/2026 il crawler è stato riportato a **AT + CT** più le
 * fonti ufficiali in whitelist. Ma la coda era il risultato di mesi di giri
 * nazionali: migliaia di target di province che nessuno legge più, un certo
 * numero di target del perimetro «parcheggiati» da un motore che aveva
 * rinunciato (errori, pagine vuote, punteggi bassi), e fonti isolate in
 * quarantena che senza una riabilitazione esplicita resterebbero fuori dai giri
 * per 60 giorni. Senza questo reset il perimetro nuovo non si vedrebbe: il
 * runner leggerebbe una coda vecchia e le fonti buone resterebbero mute.
 *
 * COSA FA, in tre passaggi contati (logica in `scripts/lib/resetPerimetro.ts`):
 *   1. **`discovered_links`** — CANCELLA i target fuori perimetro (provincia non
 *      in AT/CT e URL non in whitelist) e RIPORTA a `pending` quelli del
 *      perimetro che un motore aveva parcheggiato (`error_*`, `not_found`,
 *      `empty_view`, `parked_*`, `disqualified_noise`). `blacklisted` e
 *      `disabled` non si toccano: sono giudizi, non incidenti;
 *   2. **`scan_targets`** — tiene solo le città del perimetro (Asti, Catania),
 *      cancella le altre, riporta le righe tenute a `idle` con lock libero e
 *      `next_run_at = now()`;
 *   3. **`source_health`** — toglie la quarantena alle fonti del perimetro
 *      (`is_quarantined = false`, fallimenti azzerati): la riabilitazione è
 *      dichiarata, non aspettata.
 *
 * Sicurezza: la cancellazione è irreversibile, quindi il default è la MISURA.
 * `--apply` è la firma. Un `--dry-run` esplicito vale come il default.
 *
 * Uso:
 *   npx tsx scripts/reset-coda-perimetro.ts             (misura, nessuna scrittura)
 *   npx tsx scripts/reset-coda-perimetro.ts --apply     (esegue i tre passaggi)
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { descrizionePerimetro } from '../src/lib/perimetroIngestione.ts';
import { chiaveElenco } from '../src/scraper/whitelistTargets.ts';
import {
  CHIAVI_WHITELIST,
  CITTA_PERIMETRO,
  elimina,
  inPerimetro,
  leggiCoda,
  sbloccaParcheggiati,
  stampaStati,
} from './lib/resetPerimetro.ts';
import { riabilitaFonti, ripristinaScanTargets } from './lib/resetAltreTabelle.ts';

dotenv.config();

const APPLY = process.argv.includes('--apply');
const DRY_RUN = !APPLY || process.argv.includes('--dry-run');

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

async function main(): Promise<void> {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error(
      '[reset] Servono SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY nel .env: ' +
        'senza service role non si legge né si scrive la coda.',
    );
    process.exit(1);
  }

  const client = createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  console.log(`[reset] Perimetro: ${descrizionePerimetro()}`);
  console.log(`[reset] Città della coda: ${CITTA_PERIMETRO.join(', ')}`);
  console.log(`[reset] Fonti ufficiali in whitelist: ${CHIAVI_WHITELIST.size}`);
  console.log(
    DRY_RUN
      ? '[reset] MODALITÀ MISURA: nessuna scrittura. `--apply` per eseguire.'
      : '[reset] MODALITÀ APPLICAZIONE: le cancellazioni sono definitive.',
  );

  const righe = await leggiCoda(client);
  const dentro = righe.filter(inPerimetro);
  const fuori = righe.filter((riga) => !inPerimetro(riga));
  stampaStati('[reset] discovered_links — PRIMA:', righe);
  console.log(
    `[reset] discovered_links — perimetro: ${dentro.length} righe da tenere · ` +
      `${fuori.length} righe da cancellare (provincia fuori perimetro, URL non in whitelist).`,
  );

  if (APPLY && fuori.length > 0) {
    const eliminati = await elimina(
      client,
      fuori.map((riga) => riga.id),
    );
    console.log(`[reset] ~ ${eliminati} righe fuori perimetro cancellate da discovered_links.`);
  }

  const sbloccati = await sbloccaParcheggiati(client, dentro, APPLY);
  if (sbloccati === 0) console.log('  · nessun target del perimetro da sbloccare.');

  await ripristinaScanTargets(client, APPLY);

  // Una fonte è del perimetro se il suo URL canonico è una fonte in whitelist o
  // un target dentro il perimetro: è la stessa regola della coda, non una nuova.
  const chiaviPerimetro = new Set([
    ...CHIAVI_WHITELIST,
    ...dentro.map((riga) => chiaveElenco(riga.url)),
  ]);
  await riabilitaFonti(client, chiaviPerimetro, APPLY);

  const dopo = APPLY ? await leggiCoda(client) : dentro;
  stampaStati(APPLY ? '\n[reset] discovered_links — DOPO:' : '\n[reset] discovered_links — DOPO (atteso):', dopo);
  console.log(
    !APPLY && fuori.length > 0
      ? `\n[reset] Misura conclusa. ${fuori.length} righe da cancellare: rilanciare con --apply.`
      : '\n[reset] Fatto. Prossimo passo: `npm run crawl:provincia -- --province=CT --apply`.',
  );
}

main().catch((err: unknown) => {
  console.error(`[reset] ERRORE: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
