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
// FIX v5 (15/10/2026):
//   • STEP 3-bis — eliminazione dei record che arrivano da BACHECHE CHIUSE
//     (login-walled): `*spaggiari.eu` e `nuvola.madisoft.it`. Misurato: 347
//     righe, TUTTE senza `class_codes` e senza `materia`, 290 con la stessa
//     scadenza (la data dell'INDICE bacheca, non dell'avviso) e pagine che non
//     consegnano testo leggibile (1–167 byte: app solo-JS). I siti delle scuole
//     su `*.madisoft.it` (es. `scuolatest.madisoft.it`) NON sono toccati.
//   • STEP 3 esteso — `province = 'EE'` è il SENTINELLA «provincia non nota»:
//     quando nemmeno `school_code` dichiara una provincia (es. `SCOLASTICO`,
//     un'intestazione di tabella presa per codice) la riga è orfana: sparisce.
//   • STEP 4-bis — disattivazione in `discovered_links` dei link alle stesse
//     piattaforme: la regola vale anche per i prossimi giri di scansione.
//
// FIX v6 (22/10/2026) — A.S. 2026/2027 e target morti:
//   • PIEMONTE: i target tabellari passano da `/interpello2025/` a
//     `/interpello2026/`. [SUPERATO dalla FIX v7: la pagina 2026 serve le
//     stesse righe della 2025 ma con la colonna «Stato interpello» non
//     aggiornata — vedi sotto.]
//   • LIGURIA: gli URL `servizi.istruzioneliguria.gov.it/provincia.php?p=XX`
//     portano la query string dell'A.S. corrente (`&as=2026%2F2027`); verificato
//     HTTP 200 su GE/SP/IM/SV il 22/10/2026.
//   • STEP 3-ter — eliminazione da `interpelli` delle righe che arrivano dalle
//     FONTI TABELLARI MORTE (path su host dismesso, `/ric_interpello_ambito_*`
//     dell'host istituzionale, `alessandria-asti/…`, `servizi.istruzione.liguria.it`):
//     sono righe che nessun giro di scansione può più aggiornare.
//   • STEP 7 — `discovered_links` a LISTA CHIUSA per Piemonte e Liguria: le due
//     regioni hanno un seed completo e verificato, quindi ogni altro link attivo
//     è deriva (404, host morto, A.S. vecchio) e viene disattivato. È la ragione
//     per cui il reporter continuava a interrogare `www.istruzionepiemonte.it/
//     alessandria-asti/…` e `servizi.istruzione.liguria.it/…`.
//
//   • STEP 3-quater — eliminazione delle righe orfane con `region` NULLA sui
//     domini ufficiali delle regioni a lista chiusa. Misurato: **76** righe su
//     `/interpello2026/` senza regione, senza scuola e senza scadenza (avanzi
//     di un'ingestione precedente) + **40** righe di news del portale
//     istituzionale finite in `interpelli` per errore: invisibili al matching e
//     indistinguibili dai record nuovi, che il reporter ricrea corretti.
//
// FIX v7 (22/10/2026) — PIEMONTE: si torna a `/interpello2025/`.
//   • MISURATO il 22/10/2026 sulle pagine AT/TO/AL/BI/CN/NO/VB/VC: i due path
//     (`/interpello2025/` e `/interpello2026/`) servono **lo stesso elenco**.
//     Su AT: 164 chiavi `meccanografico|classe|data interpello` comuni, **0**
//     righe esclusive dell'uno o dell'altro; identici anche i numeri `progr`
//     dell'azione «Stampa» (2442, 2438, 3546, …), cioè gli stessi interpelli.
//   • Cambia solo la colonna «Stato interpello», e la 2026 è quella SBAGLIATA:
//     su AT dichiara **112 righe «aperto»** contro le **6** della 2025, e **93**
//     di quelle 112 hanno la scadenza già passata (es. scadenza 2026-09-11
//     marcata «aperto» dalla 2026 e «chiuso» dalla 2025). Un flag fermo su
//     «aperto» non è un dato in più: è un avviso che nessuno può più
//     candidare. La 2025 è quindi la sorgente veritiera.
//   • Conseguenza sul DB: `source_url` entra nell'hash (`province|school_code|
//     title|url`), quindi le righe ingerite da `/interpello2026/` NON vengono
//     sovrascritte da quelle della 2025: restano duplicate accanto alle nuove.
//     Per questo `/interpello2026/` diventa una FONTE TABELLARE MORTA (STEP
//     3-ter le elimina) e `/interpello2025/` rientra in TARGETS (la guardia
//     `TARGETS.some(...)` impedisce di cancellare una sorgente tornata
//     ufficiale). Ordine di esecuzione: questo script, poi il reporter.
//
// Dipendenze: @supabase/supabase-js, dotenv
// Uso:        npx tsx scripts/clean-and-sync-targets.ts
//
// Nota: richiede la SERVICE ROLE KEY perché esegue DELETE/UPDATE/INSERT
//       su tabelle di produzione.

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { provinciaDaCodice } from '../src/lib/scanTargets.ts';
import { AGGREGATORI_PRIVATI } from '../src/lib/dominiIstituzionali.ts';

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
// Piattaforme a BACHECA CHIUSA (login-walled) — FIX v5
// ---------------------------------------------------------------------------
//
// MISURATO il 15/10/2026 sul progetto di produzione (347 righe di `interpelli`):
//   · host: `web.spaggiari.eu` 133 · `cspace.spaggiari.eu` 58 · `nuvola.madisoft.it` 156;
//   · 347/347 senza `class_codes` e senza `materia` → nessun utente può matcharle;
//   · 290 con la STESSA scadenza (la data dell'indice bacheca) e titoli come
//     «Istituto PROTOCOLLO - Interpello Ufficiale» / «Avviso - Interpello Ufficiale»;
//   · le pagine non consegnano contenuto: `web.spaggiari.eu` risponde 200 con
//     **1 byte di testo visibile** (app solo-JS), `nuvola.madisoft.it` con
//     «abilita JavaScript…» (167 byte); alcuni URL sono `auth.php?token=…`
//     (token di sessione) o `…/Documenti/…` → 404 Not Found.
// Sono artefatti dell'ingestione su pagine NON leggibili: fuori dal pool e fuori
// dalla coda. `*.madisoft.it` NON è bloccato in blocco: i siti delle scuole
// ospitati sulla piattaforma sono pagine vere.

const HOST_BACHECA_CHIUSA = ['spaggiari.eu', 'nuvola.madisoft.it'];

/** Filtro PostgREST `ilike` su una colonna URL per le bacheche login-walled. */
function filtroPiattaformeBloccate(colonna: string): string {
  return HOST_BACHECA_CHIUSA.map((host) => `${colonna}.ilike.%${host}%`).join(',');
}

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
  // §26.122 — l'aggregatore `interpelloweb.it` NON è più un target: un aggregatore
  // privato non è una fonte (vedi `scraper/fontiWhitelist2610.ts`, voce spenta).
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
  // FIX v6: la query string `as=2026%2F2027` è OBBLIGATORIA — senza, il portale
  // serve l'elenco dell'anno scolastico precedente. Verificato HTTP 200 su
  // GE/SP/IM/SV il 22/10/2026 (GE: 9.596 caratteri di griglia «results-row»).
  { url: 'https://servizi.istruzioneliguria.gov.it/provincia.php?p=GE&as=2026%2F2027', region: 'Liguria', province: 'GE' },
  { url: 'https://servizi.istruzioneliguria.gov.it/provincia.php?p=SP&as=2026%2F2027', region: 'Liguria', province: 'SP' },
  { url: 'https://servizi.istruzioneliguria.gov.it/provincia.php?p=IM&as=2026%2F2027', region: 'Liguria', province: 'IM' },
  { url: 'https://servizi.istruzioneliguria.gov.it/provincia.php?p=SV&as=2026%2F2027', region: 'Liguria', province: 'SV' },
  { url: 'https://servizi.istruzioneliguria.gov.it/', region: 'Liguria', province: null },
  { url: 'https://servizi.istruzioneliguria.gov.it/nazionali.php', region: 'Liguria', province: null },

  // ── Piemonte ──────────────────────────────────────────────────────────────
  // FIX v7: `/interpello2025/` è la sorgente VERITIERA. Il path 2026 serve le
  // stesse righe (164 chiavi comuni su AT, 0 esclusive) ma dichiara «aperto» su
  // 112 avvisi di cui 93 già scaduti: il flag di stato non è aggiornato.
  // Verificato HTTP 200 su tutti gli 8 ambiti il 22/10/2026 (6–71 righe
  // «aperto» per ambito, tutte con scadenza futura).
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
// FIX v6 — Regioni a LISTA CHIUSA e fonti tabellari morte
// ---------------------------------------------------------------------------

// Regioni con seed COMPLETO e verificato: per queste la lista TARGETS è l'unica
// fonte ammessa, quindi qualunque altro link attivo in `discovered_links` è
// deriva (404, host morto, A.S. precedente) e va disattivato.
const REGIONI_A_LISTA_CHIUSA = new Set<string>(['Piemonte', 'Liguria']);

// Sorgenti tabellari che non possono più produrre dati: i record che le citano
// sono immutabili e invisibili al matching (region NULLA o A.S. scaduto).
const FONTI_TABELLARI_MORTE: Array<{ pattern: string; motivo: string }> = [
  {
    pattern: 'servizi.istruzionepiemonte.it/interpello2026/',
    motivo:
      'stato interpello non aggiornato (112 «aperto» su AT di cui 93 già scaduti): la sorgente ufficiale è /interpello2025/',
  },
  {
    pattern: 'www.istruzionepiemonte.it/ric_interpello_ambito_',
    motivo: 'path inesistente sull\'host istituzionale (404)',
  },
  {
    pattern: 'istruzionepiemonte.it/alessandria-asti/',
    motivo: 'pagina interpelli non più pubblicata (404)',
  },
  {
    pattern: 'istruzionepiemonte.it/vercelli/interpelli-supplenze',
    motivo: 'pagina interpelli non più pubblicata (404)',
  },
  {
    pattern: 'servizi.istruzione.liguria.it',
    motivo: 'host dismesso: il portale è servizi.istruzioneliguria.gov.it',
  },
  {
    pattern: 'www.istruzioneliguria.it',
    motivo: 'pagina interpelli non più pubblicata (404)',
  },
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

  // PASS 3 (FIX v5) — `school_code` che NON sa dichiarare una provincia: è
  // l'orfano vero. `province = 'EE'` è il sentinella «provincia non nota»: se
  // nemmeno il codice la dichiara, la riga non ha né provincia né scuola.
  // Misurato: 7 righe con `school_code = 'SCOLASTICO'` (un'intestazione di
  // tabella presa per codice) su `servizi.istruzionepiemonte.it`.
  {
    const { data, error: qErr } = await supabase
      .from('interpelli')
      .select('id, school_code')
      .eq('province', 'EE')
      .limit(1000);

    if (qErr) {
      console.error(`[clean-and-sync] Errore lettura EE/codice: ${qErr.message}`);
    } else {
      const orfane = (data ?? [])
        .filter((r) => !provinciaDaCodice(String(r.school_code ?? '').slice(0, 2)))
        .map((r) => r.id);

      if (orfane.length === 0) {
        console.log(
          '[clean-and-sync] Nessun record EE con codice che non dichiara provincia.'
        );
      } else {
        for (let i = 0; i < orfane.length; i += 50) {
          const lotto = orfane.slice(i, i + 50);
          const { error: dErr } = await supabase
            .from('interpelli')
            .delete()
            .in('id', lotto);

          if (dErr) {
            console.error(
              `[clean-and-sync] Errore delete EE/codice ignoto: ${dErr.message}`
            );
            continue;
          }
          removed += lotto.length;
        }
        console.log(
          `[clean-and-sync] Eliminati ${orfane.length} record province=EE senza provincia nel codice.`
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
// STEP 3-bis — Eliminazione dei record da BACHECHE CHIUSE (Spaggiari / Nuvola)
// ---------------------------------------------------------------------------
//
// I record arrivati da queste piattaforme non contengono un avviso: l'ingestione
// ha letto una pagina che NON ha contenuto nel HTML (app solo-JS o login). Sono
// già fuori da ogni matching (nessuna classe, nessuna materia) ma occupano la
// bacheca con scadenze inventate: vanno tolti dal pool, non "aggiustati".

async function deleteInterpelliPiattaformeBloccate(): Promise<number> {
  const orFilter = filtroPiattaformeBloccate('source_url');

  const { count, error: countErr } = await supabase
    .from('interpelli')
    .select('hash_id', { count: 'exact', head: true })
    .or(orFilter);

  if (countErr) {
    console.error(
      `[clean-and-sync] Errore conteggio bacheche chiuse: ${countErr.message}`
    );
    return 0;
  }

  if (!count || count === 0) {
    console.log(
      '[clean-and-sync] Nessun record da bacheche chiuse (Spaggiari/Nuvola).'
    );
    return 0;
  }

  const { error: delErr } = await supabase
    .from('interpelli')
    .delete()
    .or(orFilter);

  if (delErr) {
    console.error(
      `[clean-and-sync] Errore delete bacheche chiuse: ${delErr.message}`
    );
    return 0;
  }

  console.log(
    `[clean-and-sync] Eliminati ${count} record da bacheche chiuse (Spaggiari/Nuvola).`
  );
  return count;
}

// ---------------------------------------------------------------------------
// STEP 3-quinquies — Eliminazione dei record e dei target da AGGREGATORI PRIVATI
// ---------------------------------------------------------------------------
//
// §26.123 — un aggregatore concorrente (`scuolainterpelli.it`, `interpelloweb.it`,
// …) non è una fonte: le righe nate da lì portano in bacheca il link di un terzo
// e vengono comunque respinte in ingresso (`lib/dominiIstituzionali.ts`). I record
// già salvati prima del blocco restano però nel pool: qui si tolgono, e i target
// sulla loro bacheca vengono disattivati (non si scarica più quella pagina).
// La lista dei domini è UNA sola: `AGGREGATORI_PRIVATI`.

async function deleteInterpelliDaAggregatori(): Promise<number> {
  if (AGGREGATORI_PRIVATI.length === 0) return 0;
  const orFilter = AGGREGATORI_PRIVATI.map((d) => `source_url.ilike.%${d}%`).join(',');

  // 1. I target che puntano a un aggregatore non si visitano più.
  const { data: target } = await supabase
    .from('discovered_links')
    .select('id, url')
    .in('status', ['active_crawler', 'pending'])
    .limit(5000);
  const daDisattivare = (target ?? []).filter((row) =>
    AGGREGATORI_PRIVATI.some((d) => String(row.url ?? '').toLowerCase().includes(d))
  );
  for (let i = 0; i < daDisattivare.length; i += 50) {
    const lotto = daDisattivare.slice(i, i + 50);
    const { error: updErr } = await supabase
      .from('discovered_links')
      .update({ status: 'disabled' })
      .in('id', lotto.map((row) => row.id));
    if (updErr) {
      console.error(`[clean-and-sync] Errore disattivazione target aggregatore: ${updErr.message}`);
    }
  }
  if (daDisattivare.length > 0) {
    console.log(
      `[clean-and-sync] Disattivati ${daDisattivare.length} target di aggregatori privati.`
    );
  }

  // 2. I record con il link dell'aggregatore escono dal pool.
  const { count, error: countErr } = await supabase
    .from('interpelli')
    .select('hash_id', { count: 'exact', head: true })
    .or(orFilter);

  if (countErr) {
    console.error(`[clean-and-sync] Errore conteggio record aggregatori: ${countErr.message}`);
    return 0;
  }
  if (!count || count === 0) {
    console.log('[clean-and-sync] Nessun record da aggregatori privati.');
    return 0;
  }

  const { error: delErr } = await supabase.from('interpelli').delete().or(orFilter);
  if (delErr) {
    console.error(`[clean-and-sync] Errore delete record aggregatori: ${delErr.message}`);
    return 0;
  }

  console.log(`[clean-and-sync] Eliminati ${count} record da aggregatori privati.`);
  return count;
}


// ---------------------------------------------------------------------------
// STEP 3-ter — Eliminazione record che arrivano da FONTI TABELLARI MORTE
// ---------------------------------------------------------------------------
//
// MISURATO il 22/10/2026: le righe con `source_url` su `/interpello2025/`
// avevano `region` NULLA perché lette quando la sorgente era già stata
// dichiarata morta (v6). Con la FIX v7 il rapporto si inverte: la pagina
// veritiera è `/interpello2025/` e i morti sono i path `/interpello2026/`,
// che servono le stesse righe con la colonna «Stato interpello» ferma su
// «aperto» (su AT: 112 aperte di cui 93 con scadenza già passata). Poiché
// `source_url` entra nell'hash del record, quelle righe non verrebbero
// sovrascritte: vanno eliminate e ricreate una sola volta dalla 2025.
//
// La guardia `TARGETS.some(...)` impedisce di cancellare una sorgente che nel
// frattempo è tornata ufficiale.

function filtroFontiTabellariMorte(colonna: string): string {
  return FONTI_TABELLARI_MORTE
    // Non toccare una sorgente che è (di nuovo) nella lista ufficiale.
    .filter((f) => !TARGETS.some((t) => t.url.includes(f.pattern)))
    .map((f) => `${colonna}.ilike.%${f.pattern}%`)
    .join(',');
}

async function deleteInterpelliDaFontiMorte(): Promise<number> {
  const orFilter = filtroFontiTabellariMorte('source_url');
  if (!orFilter) {
    console.log(
      '[clean-and-sync] Nessuna fonte tabellare morta da ripulire (tutte tornate ufficiali).'
    );
    return 0;
  }

  const { count, error: countErr } = await supabase
    .from('interpelli')
    .select('hash_id', { count: 'exact', head: true })
    .or(orFilter);

  if (countErr) {
    console.error(
      `[clean-and-sync] Errore conteggio fonti morte: ${countErr.message}`
    );
    return 0;
  }

  if (!count || count === 0) {
    console.log('[clean-and-sync] Nessun record da fonti tabellari morte.');
    return 0;
  }

  const { error: delErr } = await supabase
    .from('interpelli')
    .delete()
    .or(orFilter);

  if (delErr) {
    console.error(
      `[clean-and-sync] Errore delete fonti morte: ${delErr.message}`
    );
    return 0;
  }

  console.log(
    `[clean-and-sync] Eliminati ${count} record da fonti tabellari morte (A.S. vecchio / URL 404).`
  );
  return count;
}

// ---------------------------------------------------------------------------
// STEP 3-quater — Eliminazione righe orfane PRIVE DI REGIONE
// ---------------------------------------------------------------------------
//
// Le righe delle tabelle ufficiali devono portare `region` (arriva dal target
// in `discovered_links`): senza regione il pool non le mostra a nessun utente e
// nessun giro di scansione le aggiorna, perché l'upsert del reporter usa un
// hash_id diverso e inserisce righe nuove.
//
// MISURATO il 22/10/2026: 76 righe su `/interpello2026/` con `region` NULLA,
// `school_name` NULLO, `deadline` NULLA ma `class_codes` popolate — avanzi di
// un'ingestione precedente, invisibili e indistinguibili dai record nuovi —
// più 40 righe di news del portale istituzionale finite in `interpelli`.
// Il reporter le ricrea corrette al primo giro: qui si eliminano i fantasmi.
//
// Domini ufficiali delle regioni a LISTA CHIUSA (Piemonte, Liguria): lì le
// uniche sorgenti ammesse sono i portali elencati in TARGETS, che scrivono
// sempre `region`; una riga senza regione da questi domini è quindi sempre un
// residuo rotto.
const DOMINI_UFFICIALI_LISTA_CHIUSA = [
  'istruzionepiemonte.it',
  'istruzioneliguria.it',
];

async function deleteInterpelliSenzaRegione(): Promise<number> {
  // Le fonti tabellari morte sono già coperte dallo STEP 3-ter, che non filtra
  // per `region`: qui si intercettano i residui rimasti sui domini ufficiali.
  const orFilter = DOMINI_UFFICIALI_LISTA_CHIUSA
    .map((d) => `source_url.ilike.%${d}%`)
    .join(',');

  const { count, error: countErr } = await supabase
    .from('interpelli')
    .select('hash_id', { count: 'exact', head: true })
    .or(orFilter)
    .is('region', null);

  if (countErr) {
    console.error(
      `[clean-and-sync] Errore conteggio righe senza regione: ${countErr.message}`
    );
    return 0;
  }

  if (!count || count === 0) {
    console.log(
      '[clean-and-sync] Nessuna riga orfana senza regione da eliminare.'
    );
    return 0;
  }

  const { error: delErr } = await supabase
    .from('interpelli')
    .delete()
    .or(orFilter)
    .is('region', null);

  if (delErr) {
    console.error(
      `[clean-and-sync] Errore delete righe senza regione: ${delErr.message}`
    );
    return 0;
  }

  console.log(
    `[clean-and-sync] Eliminate ${count} righe orfane senza regione (invisibili al matching).`
  );
  return count;
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
    /amministrazione[\s_-]?trasparente/i,
    /\balbo[\s_-]?online\b/i,
    /\balbo[\s_-]?pretorio\b/i,
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
// STEP 4-bis — Disattivazione dei link di BACHECA CHIUSA nella coda
// ---------------------------------------------------------------------------
//
// La stessa regola del STEP 3-bis applicata a monte: `discovered_links` non deve
// consegnare allo scanner pagine che non hanno contenuto leggibile. La scansione
// oggi non ha righe di questo tipo in coda (misurato: 0 link `web.spaggiari.eu` e
// 0 `nuvola.madisoft.it`), quindi questo passo è la GUARDIA per i prossimi giri.

async function blacklistLinkPiattaforme(): Promise<number> {
  const { data, error } = await supabase
    .from('discovered_links')
    .select('id, url, status')
    .or(filtroPiattaformeBloccate('url'))
    .limit(1000);

  if (error) {
    console.error(
      `[clean-and-sync] Errore lettura link bacheche chiuse: ${error.message}`
    );
    return 0;
  }

  const daDisattivare = (data ?? [])
    .filter((row) => row.status !== 'disabled')
    .map((row) => row.id);

  if (daDisattivare.length === 0) {
    console.log(
      '[clean-and-sync] Nessun link di bacheca chiusa in coda (guardia attiva per i prossimi giri).'
    );
    return 0;
  }

  let disattivati = 0;
  for (let i = 0; i < daDisattivare.length; i += 50) {
    const lotto = daDisattivare.slice(i, i + 50);
    const { error: updErr } = await supabase
      .from('discovered_links')
      .update({ status: 'disabled' })
      .in('id', lotto);

    if (updErr) {
      console.error(
        `[clean-and-sync] Errore disattivazione link bacheca chiusa: ${updErr.message}`
      );
      continue;
    }
    disattivati += lotto.length;
  }

  console.log(
    `[clean-and-sync] Disattivati ${disattivati} link di bacheca chiusa (Spaggiari/Nuvola).`
  );
  return disattivati;
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
// STEP 7 — `discovered_links` a LISTA CHIUSA per Piemonte e Liguria
// ---------------------------------------------------------------------------
//
// Per queste due regioni il seed è completo e verificato: la lista TARGETS è
// l'unica fonte ammessa. Ogni altro link attivo è deriva — path
// `/interpello2026/` (stato non aggiornato, FIX v7),
// `www.istruzionepiemonte.it/alessandria-asti/…` (404),
// `servizi.istruzione.liguria.it` (host dismesso) — e il reporter lo
// interrogherebbe a ogni giro producendo record sbagliati o rumore nei log.
//
// Misurato il 22/10/2026: 17 link attivi fuori lista per il Piemonte (8 path
// `/interpello2025/` quando la lista puntava alla 2026, 7
// `www.…/ric_interpello_ambito_*.php`, `alessandria-asti`, `vercelli`) e 5 per
// la Liguria (4 host dismesso + `www.istruzioneliguria.it`). Con la FIX v7 il
// set si ribalta: restano fuori lista gli 8 path `/interpello2026/`.

async function disableObsoleteTargets(): Promise<number> {
  const regioni = Array.from(REGIONI_A_LISTA_CHIUSA);
  const { data, error } = await supabase
    .from('discovered_links')
    .select('id, url, region, status')
    .in('region', regioni)
    .limit(5000);

  if (error) {
    console.error(
      `[clean-and-sync] Errore lettura target fuori lista (${regioni.join(', ')}): ${error.message}`
    );
    return 0;
  }

  const ufficiali = new Set(TARGETS.map((t) => t.url));
  const daDisattivare = (data ?? []).filter(
    (row) => row.status !== 'disabled' && !ufficiali.has(String(row.url ?? ''))
  );

  if (daDisattivare.length === 0) {
    console.log(
      '[clean-and-sync] Nessun target fuori lista per le regioni a lista chiusa.'
    );
    return 0;
  }

  let disattivati = 0;
  for (let i = 0; i < daDisattivare.length; i += 50) {
    const lotto = daDisattivare.slice(i, i + 50);
    const { error: updErr } = await supabase
      .from('discovered_links')
      .update({ status: 'disabled' })
      .in('id', lotto.map((row) => row.id));

    if (updErr) {
      console.error(
        `[clean-and-sync] Errore disattivazione target fuori lista: ${updErr.message}`
      );
      continue;
    }
    disattivati += lotto.length;
    for (const row of lotto) {
      console.log(`[clean-and-sync]   × [${row.region}] ${row.url}`);
    }
  }

  console.log(
    `[clean-and-sync] Disattivati ${disattivati} target fuori lista (${regioni.join(', ')}).`
  );
  return disattivati;
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

  console.log(
    '\n── STEP 3-bis: eliminazione record da bacheche chiuse (Spaggiari/Nuvola) ──'
  );
  const bachecheChiuseRemoved = await deleteInterpelliPiattaformeBloccate();

  console.log('\n── STEP 3-ter: eliminazione record da fonti tabellari morte ──');
  const fontiMorteRemoved = await deleteInterpelliDaFontiMorte();

  console.log('\n── STEP 3-quinquies: record e target da AGGREGATORI PRIVATI (§26.123) ──');
  const aggregatoriRemoved = await deleteInterpelliDaAggregatori();

  console.log(
    '\n── STEP 3-quater: eliminazione righe orfane senza regione ──'
  );
  const righeSenzaRegioneRemoved = await deleteInterpelliSenzaRegione();

  console.log('\n── STEP 4: disattivazione link Umbria generici ──');
  const umbriaDisabled = await disableUmbriaTrasparenza();

  console.log('\n── STEP 4-bis: disattivazione link di bacheca chiusa ──');
  const linkBachecaChiusa = await blacklistLinkPiattaforme();

  console.log('\n── STEP 5: sincronizzazione target ufficiali ──');
  const stats = await syncVerifiedTargets();

  console.log('\n── STEP 6: riparazione dominio sui record esistenti ──');
  const domainsRepaired = await repairMissingDomains();

  console.log(
    '\n── STEP 7: disattivazione target fuori lista (regioni a lista chiusa) ──'
  );
  const targetObsoleti = await disableObsoleteTargets();

  console.log('\n[clean-and-sync] Riepilogo:');
  console.log(`  Record spazzatura eliminati:    ${junkRemoved}`);
  console.log(`  Record scaduti eliminati:       ${expiredRemoved}`);
  console.log(`  Record EE orfani eliminati:     ${eeRemoved}`);
  console.log(`  Record bacheche chiuse eliminati: ${bachecheChiuseRemoved}`);
  console.log(`  Record fonti morte eliminati:   ${fontiMorteRemoved}`);
  console.log(`  Righe senza regione eliminate:  ${righeSenzaRegioneRemoved}`);
  console.log(`  Record da aggregatori (SPENTI): ${aggregatoriRemoved}`);
  console.log(`  Link Umbria disattivati:        ${umbriaDisabled}`);
  console.log(`  Link bacheca chiusa disattivati: ${linkBachecaChiusa}`);
  console.log(`  Target inseriti:                ${stats.inserted}`);
  console.log(`  Target riattivati:              ${stats.reactivated}`);
  console.log(`  Target già attivi (invariati):  ${stats.unchanged}`);
  console.log(`  Domini riparati:                ${domainsRepaired}`);
  console.log(`  Target fuori lista disattivati: ${targetObsoleti}`);
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