// scripts/table-reporter.ts
//
// Diagnostica portali USR: legge usr_portals, scarica l'HTML, conta
// le righe valide, calcola una firma strutturale e salva il report su Supabase.

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import * as cheerio from 'cheerio';
import * as dotenv from 'dotenv';
import * as crypto from 'crypto';

dotenv.config();

// ---------------------------------------------------------------------------
// Validazione configurazione
// ---------------------------------------------------------------------------

const supabaseUrl =
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY ||
  '';

if (!supabaseUrl) {
  console.error(
    '[table-reporter] SUPABASE_URL (o VITE_SUPABASE_URL) non impostata.'
  );
  process.exit(1);
}

if (!supabaseKey) {
  console.error(
    '[table-reporter] SUPABASE_SERVICE_ROLE_KEY (o VITE_SUPABASE_ANON_KEY) non impostata.'
  );
  process.exit(1);
}

const supabase: SupabaseClient = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// ---------------------------------------------------------------------------
// Tipi
// ---------------------------------------------------------------------------

interface UsrPortal {
  id: string;
  name: string;
  url: string;
  health_status: string;
  last_success_at?: string | null;
  consecutive_failures?: number | null;
}

// ---------------------------------------------------------------------------
// Utility
// ---------------------------------------------------------------------------

const USER_AGENT =
  'ScuoleRadarBot/1.0 (+https://scuoleradar.it; contatto: info@scuoleradar.it)';

const FETCH_TIMEOUT_MS = 20_000;

function normalize(input: string): string {
  return input.replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();
}

async function fetchHtml(url: string): Promise<{ status: number; html: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'text/html,application/xhtml+xml',
        'Accept-Language': 'it-IT,it;q=0.9,en;q=0.8',
      },
      signal: controller.signal,
      redirect: 'follow',
    });

    const html = await response.text();
    return { status: response.status, html };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Calcola una firma strutturale basata sulle tabelle e intestazioni presenti nella pagina.
 * Utile per intercettare cambi di layout silenziosi dei portali PA.
 */
function getStructuralSignature($: cheerio.CheerioAPI): string {
  const parts: string[] = [];
  $('table').each((tIdx, tableEl) => {
    const $table =$(tableEl);
    const rowCount = $table.find('tr').length;
    const headers = $table
      .find('th')
      .map((_, el) => $(el).text().trim())
      .get()
      .join('|');
    parts.push(`t${tIdx}:r${rowCount}:h[${headers}]`);
  });
  const raw = parts.join(';');
  return crypto.createHash('md5').update(raw).digest('hex');
}

// ---------------------------------------------------------------------------
// Estrazione
// ---------------------------------------------------------------------------

function countExtractedRows($: cheerio.CheerioAPI): number {
  let extractedCount = 0;

  $('table').each((_tableIndex, tableEl) => {$(tableEl)
      .find('tr')
      .each((rowIndex, rowEl) => {
        const $row =$(rowEl);

        if (rowIndex === 0 && $row.find('th').length > 0) {
          return;
        }

        const cols = $row.find('td');
        if (cols.length < 3) {
          return;
        }

        const linkText = normalize($row.find('a').first().text());
        const secondCellText = normalize($(cols[1]).text());
        const schoolMatch = linkText || secondCellText;

        if (
          schoolMatch.length > 3 &&
          !schoolMatch.toLowerCase().includes('scuola non specificata')
        ) {
          extractedCount += 1;
        }
      });
  });

  return extractedCount;
}

// ---------------------------------------------------------------------------
// Ciclo principale
// ---------------------------------------------------------------------------

async function runTableReporter(): Promise<void> {
  console.log('[table-reporter] Avvio scansione portali USR...');

  const { data: portals, error: portalError } = await supabase
    .from('usr_portals')
    .select('id, name, url, health_status, last_success_at, consecutive_failures')
    .eq('health_status', 'healthy');

  if (portalError) {
    console.error(
      `[table-reporter] Errore nel recupero dei portali: ${portalError.message}`
    );
    process.exitCode = 1;
    return;
  }

  if (!portals || portals.length === 0) {
    console.warn('[table-reporter] Nessun portale con health_status=healthy.');
    return;
  }

  console.log(`[table-reporter] Trovati ${portals.length} portali attivi.`);

  let totalExtracted = 0;
  let brokenCount = 0;

  for (const portal of portals as UsrPortal[]) {
    console.log(`\n[table-reporter] Esamino ${portal.name} (${portal.url})`);

    try {
      const { status, html } = await fetchHtml(portal.url);

      if (status >= 400) {
        console.warn(
          `[table-reporter] HTTP ${status} per ${portal.url}: salto.`
        );
        brokenCount += 1;

        // Registra report di errore HTTP
        await supabase.from('scrape_reports').insert({
          portal_id: portal.id,
          extracted_count: 0,
          structural_signature: null,
          status: `http_${status}`,
          error_message: `HTTP error status: ${status}`,
        });

        continue;
      }

      const $ = cheerio.load(html);
      const extractedCount = countExtractedRows($);
      const structuralSignature = getStructuralSignature($);
      totalExtracted += extractedCount;

      console.log(
        `[table-reporter] ${extractedCount} opportunita potenziali da ${portal.name} (Firma: ${structuralSignature.substring(0, 8)}...)`
      );

      // Aggiorna lo stato del portale
      const { error: updateError } = await supabase
        .from('usr_portals')
        .update({
          last_success_at: new Date().toISOString(),
          consecutive_failures: 0,
        })
        .eq('id', portal.id);

      if (updateError) {
        console.error(
          `[table-reporter] Aggiornamento usr_portals fallito per ${portal.id}: ${updateError.message}`
        );
      }

      // Registra il report di successo su scrape_reports
      const { error: reportError } = await supabase.from('scrape_reports').insert({
        portal_id: portal.id,
        extracted_count: extractedCount,
        structural_signature: structuralSignature,
        status: 'success',
      });

      if (reportError) {
        console.error(
          `[table-reporter] Salvataggio report fallito per ${portal.id}: ${reportError.message}`
        );
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(
        `[table-reporter] Errore su ${portal.url}: ${message}`
      );
      brokenCount += 1;

      // Registra report di errore di esecuzione/parsing
      await supabase.from('scrape_reports').insert({
        portal_id: portal.id,
        extracted_count: 0,
        structural_signature: null,
        status: 'error',
        error_message: message,
      });
    }
  }

  console.log('\n[table-reporter] Riepilogo:');
  console.log(`  Portali elaborati: ${portals.length}`);
  console.log(`  Portali in errore: ${brokenCount}`);
  console.log(`  Righe potenziali estratte: ${totalExtracted}`);

  if (brokenCount > 0) {
    process.exitCode = 2;
  }
}

runTableReporter().catch((err) => {
  const message = err instanceof Error ? err.stack ?? err.message : String(err);
  console.error(`[table-reporter] Errore fatale: ${message}`);
  process.exit(1);
});