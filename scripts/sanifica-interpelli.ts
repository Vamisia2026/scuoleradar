/**
 * ScuoleRadar.it — APPLICAZIONE della sanificazione di `interpelli` (§26.83).
 *
 * Due residui storici vanno cancellati dai DATI pubblici, non solo dalla UI:
 *
 *   1. FINESTRA DI CANDIDATURA — una riga con `expiration_date` oltre i 15 giorni,
 *      già passata, assente o illeggibile non è un'opportunità (§26.71/§26.82):
 *      quella data è la fine di un incarico o l'avvio di un progetto. Va marcata
 *      `fuori_finestra = true` e non entra nel feed.
 *   2. SEGNAPOSTO DEL NOME — `school_name` che *contiene* «SCUOLA NON SPECIFICATA»
 *      o «PIÙ PLESSI» è il residuo del vecchio fallback del decoder meccanografico,
 *      non una denominazione (§26.77) → si riporta a `NULL`.
 *
 * La REGOLA vive in `./lib/sanificaInterpelli.ts` (pura, con test); la STRUTTURA
 * (colonne, funzione `in_finestra_opportunita`, trigger, refresh schedulato e gate
 * della RPC `match_interpelli`) vive nella migrazione `MIGRAZIONE`. Questo comando
 * applica la regola ai dati esistenti con il client service role, in modo
 * IDEMPOTENTE: rilanciarlo non cambia ciò che è già allineato. Se la regola
 * cambia, si aggiornano ENTRAMBI (stessa disciplina di `db:allinea-scadenze`).
 * È il complementare di `backfill-nomi-istituto.ts`: quello AGGIUNGE i nomi che si
 * possono ricavare con certezza, questo RIPULISCE quelli che nome non sono.
 *
 * Uso: `npm run db:sanifica` (DRY-RUN) · `npm run db:sanifica -- --apply`.
 * Exit 0 = allineato · 1 = credenziali/rete/errori di scrittura · 2 = colonna
 * `fuori_finestra` assente (migrazione non applicata: finestra NON marcata).
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import process from 'node:process';
import {
  COLONNA_FINESTRA,
  COLONNA_VERIFICA,
  MIGRAZIONE,
  costruisciPiano,
  descriviPiano,
  type RigaSanificazione,
} from './lib/sanificaInterpelli.ts';

try {
  process.loadEnvFile();
} catch {
  /* nessun .env: uso l'ambiente di sistema */
}

/** Righe per richiesta (tetto `max-rows` di PostgREST) e id per singolo PATCH. */
const PAGINA = 1000;
const LOTTO = 50;
/** Solo misura: nessuna scrittura sul database. */
const APPLY = process.argv.includes('--apply');

const supabaseUrl = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').replace(
  /\/+$/,
  '',
);
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

/** Legge TUTTE le righe a pagine: PostgREST non consegna più di 1.000 righe per risposta. */
async function leggiRighe(
  client: SupabaseClient,
): Promise<{ righe: RigaSanificazione[]; errore?: string }> {
  const righe: RigaSanificazione[] = [];
  for (let da = 0; ; da += PAGINA) {
    const { data, error } = await client
      .from('interpelli')
      .select('id, school_name, expiration_date')
      .order('id', { ascending: true })
      .range(da, da + PAGINA - 1);

    if (error) return { righe, errore: error.message };
    const pagina = (data ?? []) as RigaSanificazione[];
    righe.push(...pagina);
    if (pagina.length < PAGINA) break;
  }
  return { righe };
}

/** True se il database conosce la colonna del marcatore (migrazione applicata). */
async function colonnaFinestraPresente(client: SupabaseClient): Promise<boolean> {
  const { error } = await client.from('interpelli').select(COLONNA_FINESTRA).limit(1);
  return !error;
}

/** Riporta a NULL il nome delle righe con un segnaposto residuo. */
async function azzeraNomi(
  client: SupabaseClient,
  righe: RigaSanificazione[],
): Promise<{ azzerati: number; errori: string[] }> {
  const esito = { azzerati: 0, errori: [] as string[] };

  for (let i = 0; i < righe.length; i += LOTTO) {
    const ids = righe.slice(i, i + LOTTO).map((r) => r.id);
    const { data, error } = await client
      .from('interpelli')
      .update({ school_name: null })
      .in('id', ids)
      .not('school_name', 'is', null)
      .select('id');

    if (error) esito.errori.push(`nomi (${ids.length} id): ${error.message}`);
    else esito.azzerati += (data ?? []).length;
  }

  return esito;
}

/**
 * Scrive il marcatore della finestra. `finestra_verificata_at` è la data della
 * VERIFICA, non della scadenza: distingue «marcato oggi» da «mai marcato».
 * La guardia `neq` rende la scrittura idempotente: si contano le righe CAMBIATE.
 */
async function marcaFinestra(
  client: SupabaseClient,
  righe: RigaSanificazione[],
  fuoriFinestra: boolean,
): Promise<{ marcate: number; errori: string[] }> {
  const esito = { marcate: 0, errori: [] as string[] };
  const patch: Record<string, string | boolean> = {
    [COLONNA_FINESTRA]: fuoriFinestra,
    [COLONNA_VERIFICA]: new Date().toISOString(),
  };

  for (let i = 0; i < righe.length; i += LOTTO) {
    const ids = righe.slice(i, i + LOTTO).map((r) => r.id);
    const { data, error } = await client
      .from('interpelli')
      .update(patch)
      .in('id', ids)
      .neq(COLONNA_FINESTRA, fuoriFinestra)
      .select('id');

    if (error) esito.errori.push(`finestra=${fuoriFinestra} (${ids.length} id): ${error.message}`);
    else esito.marcate += (data ?? []).length;
  }

  return esito;
}

/** Conteggi finali lato database (sola lettura, verifica dopo l'applicazione). */
async function verifica(client: SupabaseClient, haColonna: boolean): Promise<string> {
  const fuori = haColonna
    ? await client
        .from('interpelli')
        .select('id', { count: 'exact', head: true })
        .eq(COLONNA_FINESTRA, true)
    : { count: null };
  const nomi = await client
    .from('interpelli')
    .select('id', { count: 'exact', head: true })
    .is('school_name', null);

  return (
    `fuori finestra nel database: ${fuori.count ?? 'n/d'} · ` +
    `righe senza nome: ${nomi.count ?? 'n/d'}`
  );
}

async function main(): Promise<void> {
  console.log('━━ ScuoleRadar — sanificazione `interpelli` (finestra 15 giorni + segnaposto nome) ━━');
  if (!supabaseUrl || !supabaseKey) {
    console.error('✗ Servono SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY nel .env');
    process.exitCode = 1;
    return;
  }

  const client = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  console.log(`• Regola: ${MIGRAZIONE}`);
  console.log(`• Modalità: ${APPLY ? 'APPLICAZIONE' : 'DRY-RUN (nessuna scrittura)'}`);

  const lettura = await leggiRighe(client);
  if (lettura.errore) {
    console.error(`✗ Lettura impossibile: ${lettura.errore}`);
    process.exitCode = 1;
    return;
  }

  const piano = costruisciPiano(lettura.righe, new Date());
  console.log(`\n— Misura — ${descriviPiano(piano, lettura.righe.length)}`);
  for (const riga of piano.nomiDaAzzerare.slice(0, 10)) {
    console.log(`   · nome da azzerare: ${(riga.school_name ?? '').slice(0, 70)}`);
  }

  const haColonna = await colonnaFinestraPresente(client);
  if (!haColonna) {
    console.log(
      `\n⚠ Colonna \`${COLONNA_FINESTRA}\` ASSENTE: la migrazione non è applicata.\n` +
        `  Applica: npx supabase db push --linked   (${MIGRAZIONE})`,
    );
  }

  if (!APPLY) {
    console.log('\n(dry-run) Nessuna scrittura eseguita. Per applicare: --apply');
    if (!haColonna) process.exitCode = 2;
    return;
  }

  const nomi = await azzeraNomi(client, piano.nomiDaAzzerare);
  const finestra = haColonna
    ? {
        fuori: await marcaFinestra(client, piano.fuoriFinestra, true),
        dentro: await marcaFinestra(client, piano.inFinestra, false),
      }
    : null;

  const errori = [
    ...nomi.errori,
    ...(finestra ? [...finestra.fuori.errori, ...finestra.dentro.errori] : []),
  ];

  console.log('\n— Applicazione —');
  console.log(`   nomi riportati a NULL: ${nomi.azzerati}/${piano.nomiDaAzzerare.length}`);
  if (finestra) {
    console.log(
      `   marcate fuori finestra: ${finestra.fuori.marcate}/${piano.fuoriFinestra.length} · ` +
        `rimesse in finestra: ${finestra.dentro.marcate}/${piano.inFinestra.length}`,
    );
  } else {
    console.log('   finestra: NON marcata (migrazione da applicare)');
  }
  for (const errore of errori.slice(0, 10)) console.log(`   ! ${errore}`);

  console.log(`\n— Verifica — ${await verifica(client, haColonna)}`);

  if (errori.length > 0) {
    console.error('\n✗ Errori di scrittura: sanificazione NON completa.');
    process.exitCode = 1;
    return;
  }
  if (!haColonna) {
    console.log(`\n⚠ Nomi ripuliti, ma la finestra resta da marcare: applica ${MIGRAZIONE}.`);
    process.exitCode = 2;
    return;
  }
  console.log('\n✅ Sanificazione completa: feed, nomi e marcatura della finestra allineati.');
}

main().catch((err) => {
  const msg = err instanceof Error ? err.stack ?? err.message : String(err);
  console.error(`[sanifica-interpelli] Errore fatale: ${msg}`);
  process.exit(1);
});
