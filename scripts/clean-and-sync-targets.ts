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
//   5) Inserisce/attiva (status = 'active_crawler') la lista UFFICIALE
//      e verificata di portali tabellari interpelli per:
//      Emilia-Romagna, Lazio, Liguria, Piemonte, Sicilia, P.A. Trento,
//      Umbria, Valle d'Aosta, Veneto, Sardegna.
//
// FIX v4:
//   • Sostituita integralmente la lista dei target con quella ufficiale
//     fornita dal team. Rimossi TUTTI gli URL generici o non funzionanti.
//   • Ogni URL è mappato con regione e provincia corretta:
//       - Liguria: provincia estratta dal parametro `p=XX`
//         (`provincia.php?p=GE|SP|IM|SV`).
//       - Piemonte: provincia esplicita dal suffisso `_XX.php`
//         (`ric_interpello_ambito_to.php`, `_al.php`, `_at.php`, ...).
//       - Emilia-Romagna: hub regionale + sottodomini UST per provincia
//         (BO/FE/FC/MO/PR/PC/RA/RE) + `interpelloweb.it`.
//       - Lazio: ATP Roma (RM) + USP Rieti (RI).
//       - Sicilia: USR Sicilia (hub regionale, provincia null).
//       - P.A. Trento: `vivoscuola.it` (hub, provincia TN).
//       - Umbria: `istruzione.umbria.it` (hub + pagina interpelli aperti).
//       - Valle d'Aosta: `scuole.vda.it/interpelli` (AO).
//       - Veneto: hub regionale + UAT Padova (PD).
//       - Sardegna: MIM Sassari (SS), Nuoro (NU), Cagliari (CA).
//   • Il campo `domain` continua ad essere estratto automaticamente da
//     ogni URL (`new URL(url).hostname`) e incluso in TUTTI gli
//     insert/update su `discovered_links`, risolvendo il vincolo NOT NULL.
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
// Estrazione dominio da URL — FIX v2
// ---------------------------------------------------------------------------
//
// Il vincolo NOT NULL su `discovered_links.domain` richiede che ogni record
// abbia un dominio popolato. Estraiamo automaticamente lo hostname da ogni
// URL passato a `upsertTarget`. In caso di URL malformato, restituiamo una
// stringa vuota (il chiamante potrà loggare e proseguire).
//

function extractDomain(url: string): string {
  if (!url) return '';
  try {
    return new URL(url).hostname;
  } catch {
    // Fallback: prova a estrarre manualmente lo hostname.
    const m = url.match(/^https?:\/\/([^/?#]+)/i);
    return m ? m[1] : '';
  }
}

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
// Lista UFFICIALE e VERIFICATA dei target di seed — FIX v4
// ---------------------------------------------------------------------------
//
// Ogni voce specifica regione + provincia (o `null` per gli hub regionali).
// La provincia viene mappata esplicitamente, così da non dipendere dalla
// sola estrazione dall'URL del TableReporter.
//

interface TargetSeed {
  url: string;
  region: string;
  province: string | null;
}

const TARGETS: TargetSeed[] = [
  // ── Emilia-Romagna ────────────────────────────────────────────────────────
  { url: 'https://www.istruzioneer.gov.it/', region: 'Emilia-Romagna', province: null },
  { url: 'https://bo.istruzioneer.gov.it/', region: 'Emilia-Romagna', province: 'BO' },
  { url: 'https://interpelloweb.it/interpelli-supplenze/istituto/boss000vd8/', region: 'Emilia-Romagna', province: null },
  { url: 'https://fe.istruzioneer.gov.it/', region: 'Emilia-Romagna', province: 'FE' },
  { url: 'https://fe.istruzioneer.gov.it/category/interpelli_docenti/', region: 'Emilia-Romagna', province: 'FE' },
  { url: 'https://fe.istruzioneer.gov.it/category/interpelli-personale-ata/', region: 'Emilia-Romagna', province: 'FE' },
  { url: 'https://fc.istruzioneer.gov.it/', region: 'Emilia-Romagna', province: 'FC' },
  { url: 'https://fc.istruzioneer.gov.it/category/interpelli-a-s-2026-27/', region: 'Emilia-Romagna', province: 'FC' },
  { url: 'https://mo.istruzioneer.gov.it/', region: 'Emilia-Romagna', province: 'MO' },
  { url: 'https://mo.istruzioneer.gov.it/category/interpelli-personale-docente-2026-27/', region: 'Emilia-Romagna', province: 'MO' },
  { url: 'https://pr.istruzioneer.gov.it/', region: 'Emilia-Romagna', province: 'PR' },
  { url: 'https://pr.istruzioneer.gov.it/interpelli-docenti/', region: 'Emilia-Romagna', province: 'PR' },
  { url: 'https://pc.istruzioneer.gov.it/', region: 'Emilia-Romagna', province: 'PC' },
  { url: 'https://pc.istruzioneer.gov.it/interpelli/', region: 'Emilia-Romagna', province: 'PC' },
  { url: 'https://ra.istruzioneer.gov.it/', region: 'Emilia-Romagna', province: 'RA' },
  { url: 'https://ra.istruzioneer.gov.it/conferimento-supplenze-per-esaurimento-graduatorie-di-istituto/', region: 'Emilia-Romagna', province: 'RA' },
  { url: 'https://re.istruzioneer.gov.it/', region: 'Emilia-Romagna', province: 'RE' },
  { url: 'https://re.istruzioneer.gov.it/category/docenti/interpello/', region: 'Emilia-Romagna', province: 'RE' },

  // ── Lazio ─────────────────────────────────────────────────────────────────
  { url: 'https://www.atpromaistruzione.it/', region: 'Lazio', province: 'RM' },
  { url: 'https://www.atpromaistruzione.it/atp/category/reclutamento/interpelli-personale-docente/', region: 'Lazio', province: 'RM' },
  { url: 'https://www.usp-rieti.it/interpelli/', region: 'Lazio', province: 'RI' },

  // ── Liguria ───────────────────────────────────────────────────────────────
  { url: 'https://servizi.istruzioneliguria.gov.it/provincia.php?p=GE&as=2026%2F2027', region: 'Liguria', province: 'GE' },
  { url: 'https://servizi.istruzioneliguria.gov.it/provincia.php?p=SP&as=2026%2F2027', region: 'Liguria', province: 'SP' },
  { url: 'https://servizi.istruzioneliguria.gov.it/provincia.php?p=IM&as=2026%2F2027', region: 'Liguria', province: 'IM' },
  { url: 'https://servizi.istruzioneliguria.gov.it/provincia.php?p=SV&as=2026%2F2027', region: 'Liguria', province: 'SV' },
  { url: 'https://servizi.istruzioneliguria.gov.it/', region: 'Liguria', province: null },
  { url: 'https://servizi.istruzioneliguria.gov.it/nazionali.php', region: 'Liguria', province: null },

  // ── Piemonte ──────────────────────────────────────────────────────────────
  { url: 'https://www.istruzionepiemonte.it/', region: 'Piemonte', province: null },
  { url: 'https://servizi.istruzionepiemonte.it/interpello2025/ric_interpello_ambito_to.php', region: 'Piemonte', province: 'TO' },
  { url: 'https://servizi.istruzionepiemonte.it/interpello2025/ric_interpello_ambito_al.php', region: 'Piemonte', province: 'AL' },
  { url: 'https://servizi.istruzionepiemonte.it/interpello2025/ric_interpello_ambito_at.php', region: 'Piemonte', province: 'AT' },
  { url: 'https://servizi.istruzionepiemonte.it/interpello2025/ric_interpello_ambito_bi.php', region: 'Piemonte', province: 'BI' },
  { url: 'https://servizi.istruzionepiemonte.it/interpello2025/ric_interpello_ambito_cn.php', region: 'Piemonte', province: 'CN' },
  { url: 'https://servizi.istruzionepiemonte.it/interpello2025/ric_interpello_ambito_no.php', region: 'Piemonte', province: 'NO' },
  { url: 'https://servizi.istruzionepiemonte.it/interpello2025/ric_interpello_ambito_vb.php', region: 'Piemonte', province: 'VB' },
  { url: 'https://servizi.istruzionepiemonte.it/interpello2025/ric_interpello_ambito_vc.php', region: 'Piemonte', province: 'VC' },

  // ── Sicilia ───────────────────────────────────────────────────────────────
  { url: 'https://www.usr.sicilia.it/', region: 'Sicilia', province: null },
  { url: 'https://www.usr.sicilia.it/category/personale-scuola/docenti/interpelli-nazionali-contratti-a-tempo-determinato-docenti/', region: 'Sicilia', province: null },

  // ── Provincia Autonoma di Trento ──────────────────────────────────────────
  { url: 'https://www.vivoscuola.it/', region: 'Trentino-Alto Adige', province: 'TN' },

  // ── Umbria ────────────────────────────────────────────────────────────────
  { url: 'https://istruzione.umbria.it/', region: 'Umbria', province: null },
  { url: 'https://istruzione.umbria.it/interpelli/interpelli-aperti/', region: 'Umbria', province: null },

  // ── Valle d'Aosta ─────────────────────────────────────────────────────────
  { url: 'https://scuole.vda.it/interpelli', region: "Valle d'Aosta", province: 'AO' },

  // ── Veneto ────────────────────────────────────────────────────────────────
  { url: 'https://istruzioneveneto.gov.it/', region: 'Veneto', province: null },
  { url: 'https://padova.istruzioneveneto.gov.it/category/interpelli-personale-docente/', region: 'Veneto', province: 'PD' },
  { url: 'https://padova.istruzioneveneto.gov.it/category/interpelli-dsga/', region: 'Veneto', province: 'PD' },

  // ── Sardegna ──────────────────────────────────────────────────────────────
  { url: 'https://www.mim.gov.it/web/sassari/interpelli-docenti', region: 'Sardegna', province: 'SS' },
  { url: 'https://www.mim.gov.it/web/nuoro/interpelli', region: 'Sardegna', province: 'NU' },
  { url: 'https://www.mim.gov.it/web/cagliari/interpelli-docenti-e-personale-educativo', region: 'Sardegna', province: 'CA' },
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
      // Non disattivare i target ufficiali dell'Umbria che stiamo
      // attivando in questa stessa esecuzione.
      const isWhitelisted = TARGETS.some((t) => t.url === url);
      if (isWhitelisted) return false;
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
// STEP 5 — Upsert dei target ufficiali
// ---------------------------------------------------------------------------
//
// `domain` viene calcolato da `seed.url` e incluso in TUTTI gli
// insert/update. Per i record già esistenti con `domain` nullo,
// l'update dei metadati lo ripara.
//

async function upsertTarget(
  seed: TargetSeed,
  label: string
): Promise<'inserted' | 'reactivated' | 'unchanged' | 'error'> {
  const domain = extractDomain(seed.url);
  if (!domain) {
    console.error(
      `[clean-and-sync] Impossibile estrarre il dominio da ${seed.url} — skip.`
    );
    return 'error';
  }

  // Cerchiamo prima per URL. Selezioniamo anche `domain` per capire se il
  // record esistente è già popolato (evita update inutili).
  const { data, error } = await supabase
    .from('discovered_links')
    .select('id, status, domain')
    .eq('url', seed.url)
    .maybeSingle();

  if (error) {
    console.error(
      `[clean-and-sync] Errore lookup ${seed.url}: ${error.message}`
    );
    return 'error';
  }

  if (!data) {
    // INSERT: includiamo sempre `domain`.
    const { error: insErr } = await supabase.from('discovered_links').insert({
      url: seed.url,
      domain,
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
    console.log(
      `[clean-and-sync] + Inserito [${label}] ${seed.url} (domain=${domain})`
    );
    return 'inserted';
  }

  if (data.status !== 'active_crawler') {
    // REACTIVATE: includiamo `domain` per riparare eventuali record
    // pre-esistenti con dominio mancante.
    const { error: updErr } = await supabase
      .from('discovered_links')
      .update({
        status: 'active_crawler',
        domain,
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
    console.log(
      `[clean-and-sync] ~ Riattivato [${label}] ${seed.url} (domain=${domain})`
    );
    return 'reactivated';
  }

  // Già attivo: aggiorna i metadati. Ripara `domain` se nullo o vuoto.
  const needsDomainFix =
    !data.domain || String(data.domain).trim() === '';

  const { error: metaErr } = await supabase
    .from('discovered_links')
    .update({
      region: seed.region,
      province: seed.province,
      domain: needsDomainFix ? domain : data.domain,
    })
    .eq('id', data.id);

  if (metaErr) {
    console.error(
      `[clean-and-sync] Errore update meta ${seed.url}: ${metaErr.message}`
    );
    return 'error';
  }

  if (needsDomainFix) {
    console.log(
      `[clean-and-sync] = Già attivo [${label}] ${seed.url} (domain riparato=${domain})`
    );
  } else {
    console.log(`[clean-and-sync] = Già attivo [${label}] ${seed.url}`);
  }
  return 'unchanged';
}

async function syncVerifiedTargets(): Promise<{
  inserted: number;
  reactivated: number;
  unchanged: number;
  errors: number;
}> {
  const stats = { inserted: 0, reactivated: 0, unchanged: 0, errors: 0 };

  for (const seed of TARGETS) {
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
// STEP 6 — Riparazione dominio sui record esistenti (safety net)
// ---------------------------------------------------------------------------
//
// Scansiona i record di `discovered_links` con `domain` nullo o vuoto e
// prova a popolarlo dall'URL. Utile per sanare record creati prima del
// FIX v2 da altri script che non popolavano il dominio.
//

async function repairMissingDomains(): Promise<number> {
  const { data, error } = await supabase
    .from('discovered_links')
    .select('id, url, domain')
    .or('domain.is.null,domain.eq.');

  if (error) {
    console.error(
      `[clean-and-sync] Errore query domini mancanti: ${error.message}`
    );
    return 0;
  }

  const rows = data ?? [];
  if (rows.length === 0) {
    console.log(
      '[clean-and-sync] Nessun record con dominio mancante da riparare.'
    );
    return 0;
  }

  let repaired = 0;
  for (const row of rows) {
    const dom = extractDomain(String(row.url ?? ''));
    if (!dom) continue;

    const { error: updErr } = await supabase
      .from('discovered_links')
      .update({ domain: dom })
      .eq('id', row.id);

    if (updErr) {
      console.error(
        `[clean-and-sync] Errore riparazione dominio per ${row.url}: ${updErr.message}`
      );
      continue;
    }
    repaired += 1;
  }

  console.log(
    `[clean-and-sync] Riparati ${repaired}/${rows.length} record con dominio mancante.`
  );
  return repaired;
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

  console.log('\n── STEP 5: sincronizzazione target ufficiali ──');
  const stats = await syncVerifiedTargets();

  console.log('\n── STEP 6: riparazione dominio sui record esistenti ──');
  const domainsRepaired = await repairMissingDomains();

  console.log('\n[clean-and-sync] Riepilogo:');
  console.log(`  Record spazzatura eliminati:    ${junkRemoved}`);
  console.log(`  Record scaduti eliminati:       ${expiredRemoved}`);
  console.log(`  Record EE orfani eliminati:     ${eeRemoved}`);
  console.log(`  Link Umbria disattivati:        ${umbriaDisabled}`);
  console.log(`  Target inseriti:                ${stats.inserted}`);
  console.log(`  Target riattivati:              ${stats.reactivated}`);
  console.log(`  Target già attivi (invariati):  ${stats.unchanged}`);
  console.log(`  Domini riparati:                ${domainsRepaired}`);
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