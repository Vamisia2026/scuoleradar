/**
 * ScuoleRadar.it — ALLINEAMENTO delle scadenze di `interpelli` sulla colonna
 * CANONICA: da `deadline` (text, legacy) a `expiration_date` (timestamptz).
 *
 * PERCHE' UNO SCRIPT: la migrazione
 * `20261015120000_allinea_deadline_expiration_interpelli.sql` è un blocco
 * `do $$ ... $$` (SQL procedurale) e PostgREST esegue DML, non SQL arbitrario.
 * La stessa regola — le forme riconosciute vivono in `./lib/scadenzeLegacy.ts` —
 * è qui applicata col client Supabase service role, in modo IDEMPOTENTE:
 *   1. normalizza `deadline` in ISO dove la forma è certa;
 *   2. riempie `expiration_date` (mezzanotte UTC) SOLO dove è NULLA: una
 *      scadenza già presente non viene MAI sovrascritta (è il `coalesce` SQL);
 *   3. non tocca nessun'altra colonna e non indovina: ciò che non si sa leggere
 *      resta INTATTO e viene contato. Il file SQL resta la fonte della verità
 *      della regola: se cambia, si aggiornano ENTRAMBI.
 *
 * Uso: `npm run db:allinea-scadenze` (o `-- --dry-run` per misurare) e poi
 * `npm run db:verifica-interpelli`. Exit 0 allineato · 1 credenziali/rete ·
 * 2 restano righe non riconoscibili (lasciate intatte).
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import {
  aLotti,
  costruisciPiano,
  righeDelPiano,
  type Piano,
  type RigaScadenza,
} from './lib/scadenzeLegacy.ts';

try {
  process.loadEnvFile();
} catch {
  /* nessun .env: uso l'ambiente di sistema */
}

/** Migrazione replicata: la fonte della verità della regola di normalizzazione. */
const MIGRAZIONE =
  'supabase/migrations/20261015120000_allinea_deadline_expiration_interpelli.sql';
/** Solo misura: nessuna scrittura sul database. */
const DRY_RUN = process.argv.includes('--dry-run');
/** Righe per richiesta (tetto `max-rows` di PostgREST) e id per singola URL. */
const PAGINA = 1000;
const LOTTO_ID = 50;

const supabaseUrl = (
  process.env.SUPABASE_URL ||
  process.env.VITE_SUPABASE_URL ||
  ''
).replace(/\/+$/, '');
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!supabaseUrl || !supabaseKey) {
  console.error(
    '[allinea-scadenze] Servono SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY nel .env',
  );
  process.exit(1);
}

const supabase: SupabaseClient = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

/** Le righe da esaminare: `deadline` piena (lo specchio canonico può essere vuoto). */
async function leggiRighe(): Promise<{ righe: RigaScadenza[]; errore?: string }> {
  const righe: RigaScadenza[] = [];
  for (let da = 0; ; da += PAGINA) {
    const { data, error } = await supabase
      .from('interpelli')
      .select('id, deadline, expiration_date')
      .not('deadline', 'is', null)
      .order('id', { ascending: true })
      .range(da, da + PAGINA - 1);

    if (error) return { righe, errore: error.message };
    const pagina = (data ?? []) as RigaScadenza[];
    righe.push(...pagina);
    if (pagina.length < PAGINA) break;
  }
  return { righe };
}

interface EsitoApplicazione {
  riempite: number;
  normalizzate: number;
  errori: string[];
}

async function applica(piano: Piano): Promise<EsitoApplicazione> {
  const esito: EsitoApplicazione = { riempite: 0, normalizzate: 0, errori: [] };

  // 1) Canonica NULLA: si scrivono ENTRAMBE le colonne. La guardia
  //    `expiration_date is null` rende la scrittura idempotente anche se
  //    un'altra esecuzione gira nello stesso momento.
  for (const [iso, ids] of piano.daRiempire) {
    for (const lotto of aLotti(ids, LOTTO_ID)) {
      const { data, error } = await supabase
        .from('interpelli')
        // Mezzanotte UTC come nel SQL: data_norm::timestamp at time zone 'UTC'.
        .update({ deadline: iso, expiration_date: `${iso}T00:00:00+00:00` })
        .in('id', lotto)
        .is('expiration_date', null)
        .select('id');

      if (error) esito.errori.push(`${iso} (riempimento): ${error.message}`);
      else esito.riempite += (data ?? []).length;
    }
  }

  // 2) Canonica già piena: si normalizza SOLO il testo legacy (`coalesce` SQL).
  for (const [iso, ids] of piano.daNormalizzare) {
    for (const lotto of aLotti(ids, LOTTO_ID)) {
      const { data, error } = await supabase
        .from('interpelli')
        .update({ deadline: iso })
        .in('id', lotto)
        .neq('deadline', iso)
        .select('id');

      if (error) esito.errori.push(`${iso} (normalizzazione): ${error.message}`);
      else esito.normalizzate += (data ?? []).length;
    }
  }

  return esito;
}

/** Le righe che `db:verifica-interpelli` conta come «da riparare». */

async function main(): Promise<void> {
  console.log('━━ ScuoleRadar — allineamento scadenze interpelli (deadline => expiration_date) ━━');
  console.log(
    `• Regola: ${MIGRAZIONE} · ${DRY_RUN ? 'DRY-RUN (nessuna scrittura)' : 'APPLICAZIONE'}`,
  );
  const prima = await contaDaRiparare();
  const lettura = await leggiRighe();
  if (lettura.errore) {
    console.error(`✗ Lettura impossibile: ${lettura.errore}`);
    process.exitCode = 1;
    return;
  }

  const piano = costruisciPiano(lettura.righe);
  const conti = righeDelPiano(piano);
  console.log(
    `\n— Misura — scadenze legacy: ${lettura.righe.length} · da riempire: ${conti.daRiempire} · ` +
      `da normalizzare: ${conti.daNormalizzare} · non riconoscibili: ${piano.scartate.length} · ` +
      `da riparare PRIMA: ${prima ?? 'n/d'}`,
  );
  for (const riga of piano.scartate.slice(0, 10)) console.log(`   - ${riga}`);
  if (conti.daRiempire + conti.daNormalizzare === 0) {
    console.log('\n✅ Niente da fare: la colonna canonica è già allineata.');
    return;
  }
  if (DRY_RUN) {
    console.log('\n(dry-run) Nessuna scrittura eseguita.');
    return;
  }

  const esito = await applica(piano);
  const dopo = await contaDaRiparare();
  console.log(
    `\n— Applicazione — expiration_date riempite: ${esito.riempite} · ` +
      `scadenze legacy normalizzate: ${esito.normalizzate} · da riparare DOPO: ${dopo ?? 'n/d'}`,
  );
  for (const errore of esito.errori.slice(0, 10)) console.log(`   ! ${errore}`);
  if (esito.errori.length > 0) {
    console.error('\n✗ Errori di scrittura: allineamento NON completo.');
    process.exitCode = 1;
    return;
  }
  if (piano.scartate.length > 0) {
    console.log(
      `\n⚠ ${piano.scartate.length} righe non riconoscibili restano intatte: ` +
        'meglio un vuoto dichiarato che una data falsa.',
    );
    console.log('  `db:verifica-interpelli` le segnalerà ancora fra le righe da riparare.');
    process.exitCode = 2;
    return;
  }
  console.log('\n✅ Allineato: esegui `npm run db:verifica-interpelli` (atteso «RIGHE DA RIPARARE: 0»).');
}

async function contaDaRiparare(): Promise<number | null> {
  const { count, error } = await supabase
    .from('interpelli')
    .select('id', { count: 'exact', head: true })
    .not('deadline', 'is', null)
    .is('expiration_date', null);

  return error ? null : (count ?? null);
}

main().catch((err) => {
  const msg = err instanceof Error ? err.stack ?? err.message : String(err);
  console.error(`[allinea-scadenze] Errore fatale: ${msg}`);
  process.exit(1);
});

