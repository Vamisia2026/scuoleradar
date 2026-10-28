/**
 * PULIZIA — Rimuove da `interpelli` (e `notices`) gli avvisi NON VIVI, così le
 * liste pubbliche restano automaticamente pulite:
 *   1. gli interpelli SCADUTI (scadenza precedente a oggi);
 *   2. gli avvisi SENZA scadenza esplicita pubblicati oltre la finestra di
 *      `GIORNI_FINESTRA_SENZA_SCADENZA` (60 giorni) — la fonte non li data, quindi
 *      non possono restare pubblici per sempre (stessa regola di `eAvvisoVivo`).
 *
 * DRY-RUN di default. `--apply` per cancellare. `--giorni=N` per una tolleranza
 * sulle SOLE scadenze (default 0 = si cancellano le scadenze precedenti a oggi).
 * Uso: npx tsx scripts/pulisci-scaduti.ts [--apply] [--giorni=0]
 *
 * DATE LOCALI, MAI UTC. Le due soglie nascono da `dataIsoLocale` /
 * `dataLimiteFinestraSenzaScadenza` (`src/lib/scadenza.ts`): è la STESSA data che
 * usano `filtroAttivi` (tabellone «Radar Live»), il feed della dashboard e
 * `eAvvisoVivo`. Con `toISOString()` alle 00:30 ora di Roma (UTC+2) la data UTC è
 * ancora IERI: la pulizia e la vetrina parlavano di due giorni diversi.
 *
 * CANCELLAZIONE A LOTTI. Gli id viaggiano a gruppi di `ID_PER_LOTTO` (500): un
 * `.in('id', …)` con migliaia di UUID costruisce un URL da centinaia di KB e il
 * gateway lo rifiuta, lasciando righe non vive in tabella pur con lo script in
 * errore. Ogni lotto è indipendente: un lotto fallito non blocca gli altri.
 */
import { createClient } from '@supabase/supabase-js';
import process from 'node:process';
import {
  GIORNI_FINESTRA_SENZA_SCADENZA,
  dataIsoLocale,
  dataLimiteFinestraSenzaScadenza,
} from '../src/lib/scadenza.ts';

try {
  process.loadEnvFile();
} catch {
  /* nessun .env */
}

const APPLY = process.argv.includes('--apply');
const argGiorni = process.argv.find((a) => a.startsWith('--giorni='));
const tolleranza = argGiorni ? Math.max(0, Number(argGiorni.split('=')[1]) || 0) : 0;

const URL_ = process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL ?? '';
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';

/**
 * Scadenza STRETTAMENTE precedente a questo giorno = da cancellare.
 * `setDate` (calendario locale) e non `Date.now() - n·86_400_000`: la sottrazione
 * in millisecondi scavalca l'ora legale e sposta la data di un giorno.
 */
const giornoCutoff = new Date();
giornoCutoff.setDate(giornoCutoff.getDate() - tolleranza);
const cutoff = dataIsoLocale(giornoCutoff);
// Soglia della finestra per gli avvisi che la fonte NON data (regola di prodotto):
// pubblicati PRIMA di questo giorno sono fuori dalla finestra dei 60 giorni.
// Stessa funzione di `eAvvisoVivo`: una sola definizione della finestra.
const limiteSenzaScadenza = dataLimiteFinestraSenzaScadenza();

/** Id per singolo DELETE: 500 UUID ≈ 19 KB di URL, ben sotto i limiti del gateway. */
const ID_PER_LOTTO = 500;

/** Conteggio massimo per lettura (`limit`): oltre, il numero è un MINIMO. */
const TETTO_LETTURA = 5000;

/** Divide in lotti contigui di al più `dimensione` elementi. */
function aLotti<T>(elementi: T[], dimensione: number): T[][] {
  const lotti: T[][] = [];
  for (let i = 0; i < elementi.length; i += dimensione) {
    lotti.push(elementi.slice(i, i + dimensione));
  }
  return lotti;
}

interface RigaPulizia {
  id: string;
  title: string | null;
  province: string | null;
  expiration_date?: string | null;
  created_at?: string | null;
}

async function pulisci(tabella: string): Promise<void> {
  const sb = createClient(URL_, SERVICE);

  // 1) Avvisi con scadenza GIÀ PASSATA.
  const { data, error } = await sb
    .from(tabella)
    .select('id, title, province, expiration_date')
    .lt('expiration_date', cutoff)
    .limit(TETTO_LETTURA);
  if (error) {
    console.log(`\n=== ${tabella}: errore ${error.message}`);
    return;
  }
  const righe = (data ?? []) as RigaPulizia[];
  console.log(`\n=== ${tabella}: ${righe.length} interpelli SCADUTI (scadenza < ${cutoff}) ===`);
  for (const r of righe.slice(0, 20)) {
    console.log(`   · [${r.province}] ${(r.title ?? '').slice(0, 55)} — scad: ${r.expiration_date}`);
  }
  if (righe.length > 20) console.log(`   … e altri ${righe.length - 20}`);
  if (righe.length >= TETTO_LETTURA) {
    console.log(
      `   ⚠ tetto di lettura raggiunto (${TETTO_LETTURA}): il numero è un MINIMO — ` +
        'rilancia dopo la pulizia per il resto',
    );
  }

  // 2) Avvisi SENZA scadenza pubblicati OLTRE la finestra dei 60 giorni.
  //    `created_at` è la data di pubblicazione della riga: una fonte che non data
  //    la scadenza non può tenere l'opportunità in vetrina per sempre.
  const { data: senzaData, error: errSenza } = await sb
    .from(tabella)
    .select('id, title, province, created_at')
    .is('expiration_date', null)
    .lt('created_at', limiteSenzaScadenza)
    .limit(TETTO_LETTURA);
  if (errSenza) console.log(`\n=== ${tabella}: errore (senza scadenza) ${errSenza.message}`);
  const senzaScadenza = (senzaData ?? []) as RigaPulizia[];
  console.log(
    `\n=== ${tabella}: ${senzaScadenza.length} avvisi SENZA scadenza fuori dalla finestra di ` +
      `${GIORNI_FINESTRA_SENZA_SCADENZA} giorni (pubblicati prima del ${limiteSenzaScadenza}) ===`,
  );
  for (const r of senzaScadenza.slice(0, 20)) {
    console.log(
      `   · [${r.province}] ${(r.title ?? '').slice(0, 55)} — pub: ${(r.created_at ?? '').slice(0, 10)}`,
    );
  }
  if (senzaScadenza.length > 20) console.log(`   … e altri ${senzaScadenza.length - 20}`);
  if (senzaScadenza.length >= TETTO_LETTURA) {
    console.log(
      `   ⚠ tetto di lettura raggiunto (${TETTO_LETTURA}): il numero è un MINIMO — ` +
        'rilancia dopo la pulizia per il resto',
    );
  }

  if (!APPLY) {
    console.log(
      `  (DRY-RUN: nessuna cancellazione. Da eliminare in totale: ` +
        `${righe.length + senzaScadenza.length}. Rilancia con --apply.)`,
    );
    return;
  }
  // `Set`: le due popolazioni sono disgiunte per costruzione (una richiede
  // `expiration_date` nullo, l'altra valorizzato), ma un id ripetuto in un
  // `.in()` è solo peso nell'URL.
  const ids = [...new Set([...righe.map((r) => r.id), ...senzaScadenza.map((r) => r.id)])];
  if (ids.length === 0) return;

  const lotti = aLotti(ids, ID_PER_LOTTO);
  let rimossi = 0;
  const errori: string[] = [];
  for (let i = 0; i < lotti.length; i += 1) {
    const lotto = lotti[i];
    const { error: errDel } = await sb.from(tabella).delete().in('id', lotto);
    if (errDel) {
      errori.push(`lotto ${i + 1}/${lotti.length}: ${errDel.message}`);
      continue;
    }
    rimossi += lotto.length;
    if (lotti.length > 1) {
      console.log(`  · lotto ${i + 1}/${lotti.length}: rimossi ${lotto.length} (totale ${rimossi}/${ids.length})`);
    }
  }

  if (errori.length > 0) {
    console.log(
      `  ✗ delete fallita su ${errori.length}/${lotti.length} lotti ` +
        `(rimossi ${rimossi}/${ids.length}):\n     ${errori.join('\n     ')}`,
    );
    return;
  }
  console.log(`  ✓ rimossi ${rimossi} avvisi non vivi (scaduti + fuori finestra)`);
}

async function main(): Promise<void> {
  console.log(
    `Pulizia interpelli non vivi — modalità ${APPLY ? 'APPLY' : 'DRY-RUN'} · ` +
      `cutoff scadenze=${cutoff} · finestra senza scadenza=${GIORNI_FINESTRA_SENZA_SCADENZA}gg (prima del ${limiteSenzaScadenza})`,
  );
  await pulisci('interpelli');
  await pulisci('notices');
}

void main();
