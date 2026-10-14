// scripts/clean-and-sync-targets.ts
//
// Utility one-shot: pulisce il DB Supabase dai dati spazzatura e
// riallinea la coda `discovered_links` con i portali tabellari verificati.
//
// Cosa fa:
//   1) Elimina da `interpelli` i record spazzatura (assemblee sindacali,
//      scioperi, CIG, delibere, determine) su title / school_name / subject.
//   2) Elimina da `interpelli` i record la cui `deadline` è < oggi.
//   3) Elimina da `interpelli` i record con `province = 'EE'` non associati
//      ad alcuna scuola valida (school_code = 'ND' o nullo).
//   4) Disattiva (status = 'disabled') i link generici di Amministrazione
//      Trasparente / Albo Online dell'Umbria.
//   5) Inserisce/attiva (status = 'active_crawler') i portali tabellari
//      Piemonte (ambiti AT/BI/CN/NO/TO/VB/VC) + USR/ATP di Veneto, Liguria
//      ed Emilia-Romagna.
//
// Dipendenze: @supabase/supabase-js, dotenv
// Uso:        npx tsx scripts/clean-and-sync-targets.ts
//
// Nota: richiede la SERVICE ROLE KEY perché esegue DELETE/UPDATE/INSERT
//       su tabelle di produzione.

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

// ---------------------------------------------------------------------------
// Configurazione
// ---------------------------------------------------------------------------

const supabaseUrl =
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY ||
  '';

if (!supabaseUrl || !supabaseKey) {
  console.error(
    '[clean-and-sync] Credenziali Supabase mancanti nel file .env ' +
      '(servono SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY).'
  );
  process.exit(1);
}

const supabase: SupabaseClient = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// Data odierna in formato ISO (YYYY-MM-DD) — usata per scartare gli scaduti.
function todayIso(): string {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, '0');
  const d = String(now.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

const TODAY_ISO = todayIso();

// ---------------------------------------------------------------------------
// Parole chiave spazzatura (interpelli)
// ---------------------------------------------------------------------------

const JUNK_KEYWORDS = [
  'assemblea sindacale',
  'assemblee sindacali',
  'sciopero',
  'scioperi',
  'cig',
  'delibera',
  'delibere',
  'determina',
  'determine',
];

// ---------------------------------------------------------------------------
// Portali Piemonte (USR / ATP) — base configurabile via env
// ---------------------------------------------------------------------------

const PIEMONTE_BASE =
  process.env.PIEMONTE_BASE_URL || 'https://www.istruzionepiemonte.it';

const PIEMONTE_AMBITI: Array<{ prov: string; path: string }> = [
  { prov: 'AT', path: '/ric_interpello_ambito_at.php' },
  { prov: 'BI', path: '/ric_interpello_ambito_bi.php' },
  { prov: 'CN', path: '/ric_interpello_ambito_cn.php' },
  { prov: 'NO', path: '/ric_interpello_ambito_no.php' },
  { prov: 'TO', path: '/ric_interpello_ambito_to.php' },
  { prov: 'VB', path: '/ric_interpello_ambito_vb.php' },
  { prov: 'VC', path: '/ric_interpello_ambito_vc.php' },
];

// ---------------------------------------------------------------------------
// Altri portali USR/ATP — personalizza i percorsi se necessario.
// Le voci sono predisposte come base URL: il TableReporter le accetterà
// solo se il pre-check strutturale trova una vera tabella interpelli.
// ---------------------------------------------------------------------------

interface TargetSeed {
  url: string;
  region: string;
  province: string | null;
}

const EXTRA_TARGETS: TargetSeed[] = [
  // Veneto
  { url: 'https://www.istruzioneveneto.it/wpusr/interpelli/', region: 'Veneto', province: null },
  { url: 'https://www.istruzioneveneto.it/wpusr/atp-venezia/', region: 'Veneto', province: 'VE' },
  { url: 'https://www.istruzioneveneto.it/wpusr/atp-padova/', region: 'Veneto', province: 'PD' },
  { url: 'https://www.istruzioneveneto.it/wpusr/atp-verona/', region: 'Veneto', province: 'VR' },
  { url: 'https://www.istruzioneveneto.it/wpusr/atp-vicenza/', region: 'Veneto', province: 'VI' },
  { url: 'https://www.istruzioneveneto.it/wpusr/atp-treviso/', region: 'Veneto', province: 'TV' },

  // Liguria
  { url: 'https://www.istruzioneliguria.it/interpelli/', region: 'Liguria', province: null },
  { url: 'https://www.istruzioneliguria.it/atp-genova/', region: 'Liguria', province: 'GE' },
  { url: 'https://www.istruzioneliguria.it/atp-savona/', region: 'Liguria', province: 'SV' },
  { url: 'https://www.istruzioneliguria.it/atp-imperia/', region: 'Liguria', province: 'IM' },
  { url: 'https://www.istruzioneliguria.it/atp-la-spezia/', region: 'Liguria', province: 'SP' },

  // Emilia-Romagna
  { url: 'https://www.istruzioneer.it/interpelli/', region: 'Emilia-Romagna', province: null },
  { url: 'https://www.istruzioneer.it/atp-bologna/', region: 'Emilia-Romagna', province: 'BO' },
  { url: 'https://www.istruzioneer.it/atp-modena/', region: 'Emilia-Romagna', province: 'MO' },
  { url: 'https://www.istruzioneer.it/atp-parma/', region: 'Emilia-Romagna', province: 'PR' },
  { url: 'https://www.istruzioneer.it/atp-reggio-emilia/', region: 'Emilia-Romagna', province: 'RE' },
  { url: 'https://www.istruzioneer.it/atp-ferrara/', region: 'Emilia-Romagna', province: 'FE' },
  { url: 'https://www.istruzioneer.it/atp-ravenna/', region: 'Emilia-Romagna', province: 'RA' },
  { url: 'https://www.istruzioneer.it/atp-forli-cesena/', region: 'Emilia-Romagna', province: 'FC' },
  { url: 'https://www.istruzioneer.it/atp-rimini/', region: 'Emilia-Romagna', province: 'RN' },
  { url: 'https://www.istruzioneer.it/atp-piacenza/', region: 'Emilia-Romagna', province: 'PC' },
];

// ---------------------------------------------------------------------------
// Helper: costruzione filtro OR per ilike su più colonne
// ---------------------------------------------------------------------------

function buildJunkOrFilter(keywords: string[], columns: string[]): string {
  const parts: string[] = [];
  for (const col of columns) {
    for (const kw of keywords) {
      // PostgREST vuole: column.ilike.%pattern%
      parts.push(`${col}.ilike.%${kw}%`);
    }
  }
  return parts.join(',');
}

// ---------------------------------------------------------------------------
// STEP 1 — Eliminazione record spazzatura da interpelli
// ---------------------------------------------------------------------------

async function deleteJunkInterpelli(): Promise<number> {
  const columns = ['title', 'school_name', 'subject'];
  const orFilter = buildJunkOrFilter(JUNK_KEYWORDS, columns);

  // Conteggio preventivo per il report.
  const { count, error: countErr } = await supabase
    .from('interpelli')
    .select('hash_id', { count: 'exact', head: true })
    .or(orFilter);

  if (countErr) {
    console.error(
      `[clean-and-sync] Errore conteggio spazzatura: ${countErr.message}`
    );
    return 0;
  }

  if (!count || count === 0) {
    console.log('[clean-and-sync] Nessun record spazzatura trovato.');
    return 0;
  }

  const { error: delErr } = await supabase
    .from('interpelli')
    .delete()
    .or(orFilter);

  if (delErr) {
    console.error(
      `[clean-and-sync] Errore delete spazzatura: ${delErr.message}`
    );
    return 0;
  }

  console.log(`[clean-and-sync] Eliminati ${count} record spazzatura.`);
  return count;
}

// ---------------------------------------------------------------------------
// STEP 2 — Eliminazione record scaduti (deadline < oggi)
// ---------------------------------------------------------------------------

async function deleteExpiredInterpelli(): Promise<number> {
  const { count, error: countErr } = await supabase
    .from('interpelli')
    .select('hash_id', { count: 'exact', head: true })
    .not('deadline', 'is', null)
    .lt('deadline', TODAY_ISO);

  if (countErr) {
    console.error(
      `[clean-and-sync] Errore conteggio scaduti: ${countErr.message}`
    );
    return 0;
  }

  if (!count || count === 0) {
    console.log('[clean-and-sync] Nessun record scaduto trovato.');
    return 0;
  }

  const { error: delErr } = await supabase
    .from('interpelli')
    .delete()
    .not('deadline', 'is', null)
    .lt('deadline', TODAY_ISO);

  if (delErr) {
    console.error(`[clean-and-sync] Errore delete scaduti: ${delErr.message}`);
    return 0;
  }

  console.log(
    `[clean-and-sync] Eliminati ${count} record con deadline < ${TODAY_ISO}.`
  );
  return count;
}

// ---------------------------------------------------------------------------
// STEP 3 — Eliminazione record con province='EE' non associati a scuola
// ---------------------------------------------------------------------------

async function deleteEeWithoutSchool(): Promise<number> {
  // Due query separate per gestire sia 'ND' che NULL.
  let removed = 0;

  {
    const { count, error: cErr } = await supabase
      .from('interpelli')
      .select('hash_id', { count: 'exact', head: true })
      .eq('province', 'EE')
      .eq('school_code', 'ND');

    if (cErr) {
      console.error(`[clean-and-sync] Errore conteggio EE/ND: ${cErr.message}`);
    } else if (count && count > 0) {
      const { error: dErr } = await supabase
        .from('interpelli')
        .delete()
        .eq('province', 'EE')
        .eq('school_code', 'ND');
      if (dErr) {
        console.error(`[clean-and-sync] Errore delete EE/ND: ${dErr.message}`);
      } else {
        removed += count;
        console.log(
          `[clean-and-sync] Eliminati ${count} record province=EE con school_code=ND.`
        );
      }
    }
  }

  {
    const { count, error: cErr } = await supabase
      .from('interpelli')
      .select('hash_id', { count: 'exact', head: true })
      .eq('province', 'EE')
      .is('school_code', null);

    if (cErr) {
      console.error(
        `[clean-and-sync] Errore conteggio EE/null: ${cErr.message}`
      );
    } else if (count && count > 0) {
      const { error: dErr } = await supabase
        .from('interpelli')
        .delete()
        .eq('province', 'EE')
        .is('school_code', null);
      if (dErr) {
        console.error(
          `[clean-and-sync] Errore delete EE/null: ${dErr.message}`
        );
      } else {
        removed += count;
        console.log(
          `[clean-and-sync] Eliminati ${count} record province=EE con school_code nullo.`
        );
      }
    }
  }

  if (removed === 0) {
    console.log('[clean-and-sync] Nessun record EE orfano trovato.');
  }
  return removed;
}

// ---------------------------------------------------------------------------
// STEP 4 — Disattivazione link generici Umbria (Amministrazione Trasparente)
// ---------------------------------------------------------------------------

async function disableUmbriaTrasparenza(): Promise<number> {
  // Selezioniamo gli id dei link di Umbria che puntano a sezioni generiche
  // e non a tabelle di interpelli, poi li disattiviamo.
  const { data, error } = await supabase
    .from('discovered_links')
    .select('id, url')
    .eq('region', 'Umbria');

  if (error) {
    console.error(
      `[clean-and-sync] Errore query Umbria: ${error.message}`
    );
    return 0;
  }

  const JUNK_URL_PATTERNS = [
    /amministrazione[\-\s_]?trasparente/i,
    /\balbo[\-\s_]?online\b/i,
    /\balbo[\-\s_]?pretorio\b/i,
    /\balbo\b/i,
  ];

  const idsToDisable = (data ?? [])
    .filter((row) => {
      const url = String(row.url ?? '');
      return JUNK_URL_PATTERNS.some((re) => re.test(url));
    })
    .map((row) => row.id);

  if (idsToDisable.length === 0) {
    console.log(
      '[clean-and-sync] Nessun link Umbria generico da disattivare.'
    );
    return 0;
  }

  const { error: updErr } = await supabase
    .from('discovered_links')
    .update({ status: 'disabled' })
    .in('id', idsToDisable);

  if (updErr) {
    console.error(
      `[clean-and-sync] Errore update Umbria: ${updErr.message}`
    );
    return 0;
  }

  console.log(
    `[clean-and-sync] Disattivati ${idsToDisable.length} link Umbria generici.`
  );
  return idsToDisable.length;
}

// ---------------------------------------------------------------------------
// STEP 5 — Upsert target Piemonte + USR/ATP verificati
// ---------------------------------------------------------------------------

async function upsertTarget(
  seed: TargetSeed,
  label: string
): Promise<'inserted' | 'reactivated' | 'unchanged' | 'error'> {
  // Cerchiamo prima per URL.
  const { data, error } = await supabase
    .from('discovered_links')
    .select('id, status')
    .eq('url', seed.url)
    .maybeSingle();

  if (error) {
    console.error(
      `[clean-and-sync] Errore lookup ${seed.url}: ${error.message}`
    );
    return 'error';
  }

  if (!data) {
    const { error: insErr } = await supabase.from('discovered_links').insert({
      url: seed.url,
      region: seed.region,
      province: seed.province,
      status: 'active_crawler',
    });
    if (insErr) {
      console.error(
        `[clean-and-sync] Errore insert ${seed.url}: ${insErr.message}`
      );
      return 'error';
    }
    console.log(`[clean-and-sync] + Inserito [${label}] ${seed.url}`);
    return 'inserted';
  }

  if (data.status !== 'active_crawler') {
    const { error: updErr } = await supabase
      .from('discovered_links')
      .update({
        status: 'active_crawler',
        region: seed.region,
        province: seed.province,
      })
      .eq('id', data.id);
    if (updErr) {
      console.error(
        `[clean-and-sync] Errore reactivate ${seed.url}: ${updErr.message}`
      );
      return 'error';
    }
    console.log(`[clean-and-sync] ~ Riattivato [${label}] ${seed.url}`);
    return 'reactivated';
  }

  // Già attivo: aggiorna solo metadati se diversi (provincia/regione).
  const { error: metaErr } = await supabase
    .from('discovered_links')
    .update({ region: seed.region, province: seed.province })
    .eq('id', data.id);
  if (metaErr) {
    console.error(
      `[clean-and-sync] Errore update meta ${seed.url}: ${metaErr.message}`
    );
    return 'error';
  }
  console.log(`[clean-and-sync] = Già attivo [${label}] ${seed.url}`);
  return 'unchanged';
}

async function syncVerifiedTargets(): Promise<{
  inserted: number;
  reactivated: number;
  unchanged: number;
  errors: number;
}> {
  const stats = { inserted: 0, reactivated: 0, unchanged: 0, errors: 0 };

  // Piemonte
  for (const { prov, path } of PIEMONTE_AMBITI) {
    const url = `${PIEMONTE_BASE.replace(/\/+$/, '')}${path}`;
    const seed: TargetSeed = {
      url,
      region: 'Piemonte',
      province: prov,
    };
    const r = await upsertTarget(seed, `Piemonte/${prov}`);
    if (r === 'inserted') stats.inserted += 1;
    else if (r === 'reactivated') stats.reactivated += 1;
    else if (r === 'unchanged') stats.unchanged += 1;
    else stats.errors += 1;
  }

  // Veneto / Liguria / Emilia-Romagna
  for (const seed of EXTRA_TARGETS) {
    const label = `${seed.region}${seed.province ? '/' + seed.province : ''}`;
    const r = await upsertTarget(seed, label);
    if (r === 'inserted') stats.inserted += 1;
    else if (r === 'reactivated') stats.reactivated += 1;
    else if (r === 'unchanged') stats.unchanged += 1;
    else stats.errors += 1;
  }

  return stats;
}

// ---------------------------------------------------------------------------
// Orchestrazione
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  console.log(
    `[clean-and-sync] Avvio pulizia e sincronizzazione (oggi=${TODAY_ISO}).`
  );

  console.log('\n── STEP 1: eliminazione record spazzatura da interpelli ──');
  const junkRemoved = await deleteJunkInterpelli();

  console.log('\n── STEP 2: eliminazione record scaduti ──');
  const expiredRemoved = await deleteExpiredInterpelli();

  console.log('\n── STEP 3: eliminazione record province=EE orfani ──');
  const eeRemoved = await deleteEeWithoutSchool();

  console.log('\n── STEP 4: disattivazione link Umbria generici ──');
  const umbriaDisabled = await disableUmbriaTrasparenza();

  console.log('\n── STEP 5: sincronizzazione target verificati ──');
  const stats = await syncVerifiedTargets();

  console.log('\n[clean-and-sync] Riepilogo:');
  console.log(`  Record spazzatura eliminati:    ${junkRemoved}`);
  console.log(`  Record scaduti eliminati:       ${expiredRemoved}`);
  console.log(`  Record EE orfani eliminati:     ${eeRemoved}`);
  console.log(`  Link Umbria disattivati:        ${umbriaDisabled}`);
  console.log(`  Target inseriti:                ${stats.inserted}`);
  console.log(`  Target riattivati:              ${stats.reactivated}`);
  console.log(`  Target già attivi (invariati):  ${stats.unchanged}`);
  console.log(`  Errori durante l'upsert:        ${stats.errors}`);

  if (stats.errors > 0) {
    process.exitCode = 2;
  }
}

main().catch((err) => {
  const msg = err instanceof Error ? err.stack ?? err.message : String(err);
  console.error(`[clean-and-sync] Errore fatale: ${msg}`);
  process.exit(1);
});