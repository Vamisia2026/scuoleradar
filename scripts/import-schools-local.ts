// scripts/import-schools-local.ts
//
// Importa i CSV dell'anagrafica ministeriale delle scuole italiane
// dalla cartella `anagrafica_ministeriale/` e li carica in Supabase
// nella tabella `discovered_links` con status='pending'.
//
// Uso:  npx tsx scripts/import-schools-local.ts
//
// Dipendenze: @supabase/supabase-js, csv-parse, dotenv
//   npm i @supabase/supabase-js csv-parse dotenv

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { parse as parseCsv } from 'csv-parse/sync';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config();

// ---------------------------------------------------------------------------
// Configurazione
// ---------------------------------------------------------------------------

const CONFIG = {
  dataDir: path.join(process.cwd(), 'anagrafica_ministeriale'),
  batchSize: 500,
  csvDelimiters: [';', ',', '\t'] as const,
  allowedProtocols: new Set(['http:', 'https:']),
  invalidPlaceholders: new Set([
    'non disponibile',
    'nd',
    'n.d.',
    'n/d',
    '',
    '-',
  ]),
} as const;

const supabaseUrl =
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY ||
  '';

if (!supabaseUrl || !supabaseKey) {
  console.error('[import-local] Credenziali Supabase mancanti nel file .env');
  process.exit(1);
}

const supabase: SupabaseClient = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// ---------------------------------------------------------------------------
// Mappatura provincia: nome esteso -> codice ISTAT
// ---------------------------------------------------------------------------

const PROVINCE_NAME_TO_CODE: Record<string, string> = {
  agrigento: 'AG', alessandria: 'AL', ancona: 'AN', aosta: 'AO',
  'ascoli piceno': 'AP', "l'aquila": 'AQ',  arezzo: 'AR',
  asti: 'AT', avellino: 'AV', bari: 'BA', bergamo: 'BG', biella: 'BI',
  belluno: 'BL', benevento: 'BN', bologna: 'BO', brindisi: 'BR',
  brescia: 'BS', 'barletta-andria-trani': 'BT', 'barletta andria trani': 'BT',
  bolzano: 'BZ', 'bolzano/bozen': 'BZ', cagliari: 'CA', campobasso: 'CB',
  caserta: 'CE', chieti: 'CH', caltanissetta: 'CL', cuneo: 'CN',
  como: 'CO', cremona: 'CR', cosenza: 'CS', catania: 'CT',
  catanzaro: 'CZ', enna: 'EN', 'forlì-cesena': 'FC', 'forli-cesena': 'FC',
  'forlì cesena': 'FC', 'forli cesena': 'FC', ferrara: 'FE', foggia: 'FG',
  firenze: 'FI', fermo: 'FM', frosinone: 'FR', genova: 'GE',
  gorizia: 'GO', grosseto: 'GR', imperia: 'IM', isernia: 'IS',
  crotone: 'KR', lecco: 'LC', lecce: 'LE', livorno: 'LI', lodi: 'LO',
  latina: 'LT', lucca: 'LU', 'monza e brianza': 'MB',
  'monza e della brianza': 'MB', macerata: 'MC', messina: 'ME',
  milano: 'MI', mantova: 'MN', modena: 'MO', 'massa-carrara': 'MS',
  'massa carrara': 'MS', matera: 'MT', napoli: 'NA', novara: 'NO',
  nuoro: 'NU', oristano: 'OR', palermo: 'PA', piacenza: 'PC',
  padova: 'PD', pescara: 'PE', perugia: 'PG', pisa: 'PI',
  pordenone: 'PN', prato: 'PO', parma: 'PR', pistoia: 'PT',
  'pesaro e urbino': 'PU', pavia: 'PV', potenza: 'PZ', ravenna: 'RA',
  'reggio calabria': 'RC', 'reggio emilia': 'RE', ragusa: 'RG',
  rieti: 'RI', roma: 'RM', rimini: 'RN', rovigo: 'RO', salerno: 'SA',
  siena: 'SI', sondrio: 'SO', 'la spezia': 'SP', siracusa: 'SR',
  sassari: 'SS', 'sud sardegna': 'SU', savona: 'SV', taranto: 'TA',
  teramo: 'TE', trento: 'TN', torino: 'TO', trapani: 'TP',
  terni: 'TR', trieste: 'TS', treviso: 'TV', udine: 'UD',
  varese: 'VA', 'verbano-cusio-ossola': 'VB',
  'verbano cusio ossola': 'VB', vercelli: 'VC', venezia: 'VE',
  vicenza: 'VI', verona: 'VR', viterbo: 'VT', 'vibo valentia': 'VV',
};

function normalizeKey(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function resolveProvinceCode(raw: string): string {
  const value = raw.trim();
  if (!value) return '';

  // Già un codice a 2 lettere (es. "TO", "PG")
  if (/^[A-Za-z]{2}$/.test(value)) {
    return value.toUpperCase();
  }

  const normalized = normalizeKey(value);
  return PROVINCE_NAME_TO_CODE[normalized] || '';
}

// ---------------------------------------------------------------------------
// Lettura file: encoding e BOM
// ---------------------------------------------------------------------------

interface DecodedFile {
  text: string;
  encoding: 'utf8' | 'latin1';
}

function decodeFile(filePath: string): DecodedFile {
  const buffer = fs.readFileSync(filePath);

  // BOM UTF-8
  if (buffer.length >= 3 && buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf) {
    return { text: buffer.slice(3).toString('utf-8'), encoding: 'utf8' };
  }

  // Prova UTF-8
  const utf8 = buffer.toString('utf-8');
  const replacementCount = (utf8.match(/\uFFFD/g) || []).length;

  // Se ci sono molti caratteri di sostituzione, il file non è UTF-8.
  // I CSV del MIUR sono spesso Windows-1252 / Latin-1.
  if (replacementCount > 0 && replacementCount > utf8.length / 10_000) {
    return { text: buffer.toString('latin1'), encoding: 'latin1' };
  }

  return { text: utf8, encoding: 'utf8' };
}

// ---------------------------------------------------------------------------
// Parsing CSV
// ---------------------------------------------------------------------------

interface RawRow {
  [key: string]: string;
}

function detectDelimiter(sample: string): string {
  // Conta occorrenze nella prima riga non vuota
  const firstLine = sample.split(/\r?\n/).find((l) => l.trim().length > 0) || '';
  let best = ';';
  let bestCount = 0;
  for (const d of CONFIG.csvDelimiters) {
    const count = firstLine.split(d).length - 1;
    if (count > bestCount) {
      bestCount = count;
      best = d;
    }
  }
  return best;
}

function parseFile(text: string, filePath: string): RawRow[] {
  const delimiter = detectDelimiter(text);

  try {
    const rows = parseCsv(text, {
      columns: (header: string[]) => header.map((h) => normalizeKey(h)),
      delimiter,
      skip_empty_lines: true,
      trim: true,
      relax_quotes: true,
      relax_column_count: true,
      bom: true,
    }) as RawRow[];

    return rows;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`Parsing CSV fallito per ${filePath}: ${msg}`);
  }
}

// ---------------------------------------------------------------------------
// Risoluzione colonne per nome
// ---------------------------------------------------------------------------

interface ColumnMap {
  codice: string;
  regione: string;
  provincia: string;
  sitoWeb: string;
}

const COLUMN_ALIASES = {
  // 'codicescuola' è l'header esatto dei CSV MIUR.
  // Gli altri alias coprono varianti di altre fonti / anni diversi.
  codice: [
    'codicescuola',
    'codice scuola',
    'codice meccanografico',
    'codice istituto',
    'cod meccanografico',
    'cod mecc',
    'meccanografico',
  ],
  regione: [
    'regione',
    'regione scolastica',
  ],
  provincia: [
    'provincia',
    'provincia scolastica',
    'sigla provincia',
  ],
  // 'sitowebscuola' è l'header esatto dei CSV MIUR.
  // 'sitoweb' copre varianti tipo 'sitowebistituto'.
  sitoWeb: [
    'sitowebscuola',
    'sito web scuola',
    'sito web',
    'sitoweb',
    'sito',
    'url',
    'indirizzo web',
    'indirizzo sito web',
    'pagina web',
  ],
} as const;

function findColumn(
  headers: string[],
  aliases: readonly string[]
): string | null {
  // 1) Match esatto: l'header normalizzato coincide con un alias.
  //    Iteriamo sugli alias in ordine di priorità, non sugli header,
  //    così l'alias più specifico vince sempre.
  for (const alias of aliases) {
    const normalized = normalizeKey(alias);
    if (headers.includes(normalized)) return normalized;
  }

  // 2) Match parziale: l'header contiene l'alias.
  //    Es. header 'sitowebscuola' contiene 'sitoweb'.
  for (const alias of aliases) {
    const normalized = normalizeKey(alias);
    // Ignora alias troppo corti: rischiano falsi positivi
    // ('web', 'url', 'sito' da soli non bastano).
    if (normalized.length < 4) continue;
    const found = headers.find((h) => h.includes(normalized));
    if (found) return found;
  }

  return null;
}

function resolveColumns(headers: string[], filePath: string): ColumnMap {
  const codice = findColumn(headers, COLUMN_ALIASES.codice);
  const regione = findColumn(headers, COLUMN_ALIASES.regione);
  const provincia = findColumn(headers, COLUMN_ALIASES.provincia);
  const sitoWeb = findColumn(headers, COLUMN_ALIASES.sitoWeb);

  if (!codice || !regione || !provincia || !sitoWeb) {
    throw new Error(
      `Colonne obbligatorie non trovate in ${path.basename(filePath)}. ` +
        `Header trovati: ${headers.join(', ')}. ` +
        `codice=${codice ?? 'MANCANTE'} ` +
        `regione=${regione ?? 'MANCANTE'} ` +
        `provincia=${provincia ?? 'MANCANTE'} ` +
        `sitoWeb=${sitoWeb ?? 'MANCANTE'}`
    );
  }

  return { codice, regione, provincia, sitoWeb };
}

// ---------------------------------------------------------------------------
// Validazione e normalizzazione URL
// ---------------------------------------------------------------------------

function normalizeUrl(raw: string): string | null {
  let value = raw.trim();
  if (!value) return null;
  if (CONFIG.invalidPlaceholders.has(value.toLowerCase())) return null;
  if (!value.includes('.')) return null;

  // Rimuove spazi interni e caratteri invisibili
  value = value.replace(/\s+/g, '');

  if (!/^https?:\/\//i.test(value)) {
    value = `https://${value}`;
  }

  try {
    const parsed = new URL(value);
    if (!CONFIG.allowedProtocols.has(parsed.protocol)) return null;
    if (!parsed.hostname || !parsed.hostname.includes('.')) return null;
    return parsed.toString();
  } catch {
    return null;
  }
}

/**
 * Estrae l'hostname da una URL gia validata.
 * Presuppone che `url` sia passata per normalizeUrl, quindi il parsing
 * non dovrebbe fallire; se fallisce comunque, restituisce stringa vuota
 * per non far crashare l'intero batch.
 */
function extractDomain(url: string): string {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return '';
  }
}

// ---------------------------------------------------------------------------
// Trasformazione righe -> record
// ---------------------------------------------------------------------------

interface DiscoveredLinkRecord {
  url: string;
  domain: string;
  region: string;
  province: string;
  status: 'pending';
}

interface RowStats {
  total: number;
  invalidUrl: number;
  missingProvince: number;
  missingRegion: number;
  missingCode: number;
  valid: number;
}

function transformRow(
  row: RawRow,
  cols: ColumnMap,
  stats: RowStats,
  seenUrls: Set<string>
): DiscoveredLinkRecord | null {
  stats.total += 1;

  const url = normalizeUrl(row[cols.sitoWeb] ?? '');
  if (!url) {
    stats.invalidUrl += 1;
    return null;
  }

  // Deduplica in-memory: alcuni file hanno lo stesso istituto su più righe (plessi).
  if (seenUrls.has(url)) {
    return null;
  }

  // Il dominio è obbligatorio nello schema: lo deriviamo dalla URL
  // già normalizzata. Se per qualche motivo non è estraibile,
  // scartiamo la riga invece di inviare un batch che fallirà.
  const domain = extractDomain(url);
  if (!domain) {
    stats.invalidUrl += 1;
    return null;
  }

  const regione = (row[cols.regione] ?? '').trim();
  if (!regione) {
    stats.missingRegion += 1;
    return null;
  }

  const provinciaRaw = (row[cols.provincia] ?? '').trim();
  const province = resolveProvinceCode(provinciaRaw);
  if (!province) {
    stats.missingProvince += 1;
    return null;
  }

  const codice = (row[cols.codice] ?? '').trim();
  if (!codice) {
    stats.missingCode += 1;
    return null;
  }

  seenUrls.add(url);
  stats.valid += 1;

  return {
    url,
    domain,
    region: regione,
    province,
    status: 'pending',
  };
}

// ---------------------------------------------------------------------------
// Upsert a lotti
// ---------------------------------------------------------------------------

function chunk<T>(items: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    result.push(items.slice(i, i + size));
  }
  return result;
}

interface UpsertResult {
  attempted: number;
  succeeded: number;
  failed: number;
}

async function upsertInBatches(
  records: DiscoveredLinkRecord[]
): Promise<UpsertResult> {
  const result: UpsertResult = { attempted: records.length, succeeded: 0, failed: 0 };
  const batches = chunk(records, CONFIG.batchSize);

  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];
    const { error } = await supabase
      .from('discovered_links')
      .upsert(batch, {
        onConflict: 'url',
        // Non tocca i record esistenti: lo status viene aggiornato solo
        // quando il discovery engine promuove la pagina.
        ignoreDuplicates: true,
      });

    if (error) {
      result.failed += batch.length;
      console.error(
        `[import-local] Batch ${i + 1}/${batches.length} fallito: ${error.message}`
      );
    } else {
      result.succeeded += batch.length;
      console.log(
        `[import-local] Batch ${i + 1}/${batches.length}: ${batch.length} record OK.`
      );
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// Elaborazione di un singolo file
// ---------------------------------------------------------------------------

async function importFile(filePath: string): Promise<void> {
  const fileName = path.basename(filePath);
  console.log(`\n[import-local] File: ${fileName}`);

  const { text, encoding } = decodeFile(filePath);
  console.log(`[import-local] Encoding rilevato: ${encoding}`);

  const rows = parseFile(text, filePath);
  if (rows.length === 0) {
    console.warn('[import-local] Nessuna riga trovata, salto il file.');
    return;
  }

  const headers = Object.keys(rows[0]);
  const cols = resolveColumns(headers, filePath);
  console.log(
    `[import-local] Colonne risolte: codice="${cols.codice}" ` +
      `regione="${cols.regione}" provincia="${cols.provincia}" ` +
      `sitoWeb="${cols.sitoWeb}"`
  );

  const stats: RowStats = {
    total: 0,
    invalidUrl: 0,
    missingProvince: 0,
    missingRegion: 0,
    missingCode: 0,
    valid: 0,
  };

  const seenUrls = new Set<string>();
  const records: DiscoveredLinkRecord[] = [];

  for (const row of rows) {
    const record = transformRow(row, cols, stats, seenUrls);
    if (record) records.push(record);
  }

  console.log(
    `[import-local] Righe: ${stats.total} totali, ${stats.valid} valide | ` +
      `URL non validi: ${stats.invalidUrl}, provincia mancante: ${stats.missingProvince}, ` +
      `regione mancante: ${stats.missingRegion}, codice mancante: ${stats.missingCode}, ` +
      `duplicati in-memory: ${stats.total - stats.valid - stats.invalidUrl - stats.missingProvince - stats.missingRegion - stats.missingCode}`
  );

  if (records.length === 0) {
    console.warn('[import-local] Nessun record valido da importare per questo file.');
    return;
  }

  const upsertResult = await upsertInBatches(records);
  console.log(
    `[import-local] Upsert: ${upsertResult.succeeded} OK, ${upsertResult.failed} falliti ` +
      `su ${upsertResult.attempted} record.`
  );
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

async function run(): Promise<void> {
  const dir = CONFIG.dataDir;
  console.log(`[import-local] Cerco CSV in: ${dir}`);

  if (!fs.existsSync(dir)) {
    console.error(
      `[import-local] La cartella '${path.basename(dir)}/' non esiste. ` +
        `Creala nella root del progetto e inserisci i CSV ministeriali.`
    );
    process.exit(1);
  }

  const files = fs
    .readdirSync(dir)
    .filter((f) => f.toLowerCase().endsWith('.csv'))
    .sort();

  if (files.length === 0) {
    console.warn('[import-local] Nessun file .csv trovato nella cartella.');
    return;
  }

  console.log(`[import-local] Trovati ${files.length} file CSV.`);

  const failures: string[] = [];

  for (const file of files) {
    try {
      await importFile(path.join(dir, file));
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[import-local] Errore su ${file}: ${msg}`);
      failures.push(file);
    }
  }

  console.log('\n[import-local] Importazione completata.');
  if (failures.length > 0) {
    console.error(`[import-local] File con errori: ${failures.join(', ')}`);
    process.exitCode = 2;
  }
}

run().catch((err) => {
  const msg = err instanceof Error ? err.stack ?? err.message : String(err);
  console.error(`[import-local] Errore fatale: ${msg}`);
  process.exit(1);
});