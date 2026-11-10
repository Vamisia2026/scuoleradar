/**
 * api-esploratrici.ts
 * ScuoleRadar — Open-discovery national crawler for school job opportunities.
 */

import * as crypto from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// =============================================================================
// Types
// =============================================================================

export interface RawSearchResult {
  url: string;
  title?: string;
  snippet?: string;
}

export interface DiscoveryRecord {
  readonly record_id: string;
  readonly region: string;
  readonly province: string;
  readonly keyword: string;
  readonly source_url: string;
  readonly school_identifier: string | null;
  readonly school_name: string | null;
  readonly title: string | null;
  readonly snippet: string | null;
  readonly institutional_score: number;
  readonly schema_version: '1.3';
}

export interface SearchBackend {
  search(
    query: string,
    region: string,
    province: string,
    signal: AbortSignal,
  ): Promise<RawSearchResult[]>;
}

export interface SupabaseColumnMap {
  readonly record_id: string;
  readonly region: string;
  readonly province: string;
  readonly matched_keyword: string;
  readonly source_url: string;
  readonly url_alias: string | null;
  readonly domain_alias: string | null;
  readonly school_identifier: string;
  readonly school_name: string;
  readonly title: string;
  readonly snippet: string;
  readonly discovery_confidence: string;
  readonly schema_version: string;
}

const DEFAULT_COLUMN_MAP: SupabaseColumnMap = {
  record_id: 'record_id',
  region: 'region',
  province: 'province',
  matched_keyword: 'matched_keyword',
  source_url: 'source_url',
  url_alias: 'url',
  domain_alias: 'domain',
  school_identifier: 'school_identifier',
  school_name: 'school_name',
  title: 'title',
  snippet: 'snippet',
  discovery_confidence: 'discovery_confidence',
  schema_version: 'schema_version',
};

export interface DiscoveryConfig {
  readonly concurrency: number;
  readonly requestTimeoutMs: number;
  readonly maxRetries: number;
  readonly baseBackoffMs: number;
  readonly passThreshold: number;
  readonly maxCells: number | null;
  readonly supabaseUrl: string | null;
  readonly supabaseServiceRoleKey: string | null;
  readonly supabaseTable: string;
  readonly supabaseColumnMap: SupabaseColumnMap;
  readonly verifySchema: boolean;
  readonly strictSchema: boolean;
  readonly sartoriaBatchSize: number;
  readonly dryRun: boolean;
}

// =============================================================================
// Configuration — geography (107 provinces)
// =============================================================================

const REGION_PROVINCE_MAP: Readonly<Record<string, readonly string[]>> = {
  "Abruzzo": ["L'Aquila", "Chieti", "Pescara", "Teramo"],
  "Basilicata": ["Potenza", "Matera"],
  "Calabria": ["Catanzaro", "Cosenza", "Crotone", "Reggio Calabria", "Vibo Valentia"],
  "Campania": ["Napoli", "Avellino", "Benevento", "Caserta", "Salerno"],
  "Emilia-Romagna": ["Bologna", "Ferrara", "Forlì-Cesena", "Modena", "Parma", "Piacenza", "Ravenna", "Reggio Emilia", "Rimini"],
  "Friuli-Venezia Giulia": ["Gorizia", "Pordenone", "Trieste", "Udine"],
  "Lazio": ["Roma", "Frosinone", "Latina", "Rieti", "Viterbo"],
  "Liguria": ["Genova", "Imperia", "La Spezia", "Savona"],
  "Lombardia": ["Milano", "Bergamo", "Brescia", "Como", "Cremona", "Lecco", "Lodi", "Mantova", "Monza e Brianza", "Pavia", "Sondrio", "Varese"],
  "Marche": ["Ancona", "Ascoli Piceno", "Fermo", "Macerata", "Pesaro e Urbino"],
  "Molise": ["Campobasso", "Isernia"],
  "Piemonte": ["Torino", "Alessandria", "Asti", "Biella", "Cuneo", "Novara", "Verbano-Cusio-Ossola", "Vercelli"],
  "Puglia": ["Bari", "Barletta-Andria-Trani", "Brindisi", "Foggia", "Lecce", "Taranto"],
  "Sardegna": ["Cagliari", "Nuoro", "Oristano", "Sassari", "Sud Sardegna"],
  "Sicilia": ["Palermo", "Agrigento", "Caltanissetta", "Catania", "Enna", "Messina", "Ragusa", "Siracusa", "Trapani"],
  "Toscana": ["Firenze", "Arezzo", "Grosseto", "Livorno", "Lucca", "Massa-Carrara", "Pisa", "Pistoia", "Prato", "Siena"],
  "Trentino-Alto Adige": ["Trento", "Bolzano"],
  "Umbria": ["Perugia", "Terni"],
  "Valle d'Aosta": ["Aosta"],
  "Veneto": ["Venezia", "Belluno", "Padova", "Rovigo", "Treviso", "Verona", "Vicenza"],
};

// =============================================================================
// Configuration — 21-Term Clean Keyword Catalog
// =============================================================================

const SEARCH_KEYWORDS: readonly string[] = [
  // Interpelli & Chiamate Dirette (3)
  "Interpello", "Interpelli", "Interpello Chiamata Diretta",
  // Supplenze Docenti (6)
  "Supplenza", "Supplenze", "Supplenza d'Istituto", "Terza Fascia", "Graduatoria d'Istituto", "Disponibilità Ore Spezzone",
  // Personale Docente & ATA (6)
  "Ricerca Personale Docente", "Ricerca Personale ATA", "Collaboratore Scolastico", "Collaboratrici Scolastiche", "Assistente Amministrativo", "Assistente Tecnico",
  // PNRR & Esperti (4)
  "PNRR", "Bando Progetto PNRR", "Esperti PNRR", "Animatore Digitale",
  // Messa a Disposizione (2)
  "MAD", "Messa a Disposizione"
];

const EXPECTED_KEYWORD_COUNT = 21;

// =============================================================================
// Configuration — regexes & negative role penalization
// =============================================================================

interface WeightedPattern { readonly re: RegExp; readonly weight: number }

const INSTITUTIONAL_PATTERNS: readonly WeightedPattern[] = [
  { re: /\balbo\s+pretorio\b/i, weight: 4 },
  { re: /\bamministrazione\s+trasparente\b/i, weight: 4 },
  { re: /\bdirigente\s+scolastico\b/i, weight: 3 },
  { re: /\bistituzione\s+scolastica\b/i, weight: 3 },
  { re: /\bistituto\s+comprensivo\b/i, weight: 2 },
  { re: /\bistituto\s+(tecnico|professionale)\b/i, weight: 2 },
  { re: /\bliceo\b/i, weight: 2 },
  { re: /\bscuola\s+(primaria|dell['’]infanzia|secondaria)\b/i, weight: 2 },
  { re: /\bprotocollo\b/i, weight: 1 },
  { re: /\bdetermina\b/i, weight: 1 },
  { re: /\bgraduatoria\b/i, weight: 1 },
  { re: /\bbando\b/i, weight: 1 },
  { re: /\bavviso\b/i, weight: 1 },
  { re: /\bscuola\b/i, weight: 1 },
  { re: /\binterpell[oi]\b/i, weight: 2 },
  { re: /\bsupplenz[ae]\b/i, weight: 2 },
  { re: /\bATA\b/i, weight: 2 },
  { re: /\bcollaboratore\s+scolastico\b/i, weight: 2 },
  { re: /\bPNRR\b/, weight: 2 },
  { re: /\bmessa\s+a\s+disposizione\b/i, weight: 2 },
  { re: /\bchiamata\s+diretta\b/i, weight: 2 },
  { re: /\bMAD\b/, weight: 1 },
];

const NEGATIVE_PATTERNS: readonly WeightedPattern[] = [
  { re: /\bcuoc[oi]\b/i, weight: 6 },
  { re: /\bservizio\s+mensa\b/i, weight: 5 },
  { re: /\bpsicolog[io]\b/i, weight: 5 },
  { re: /\bnutrizionist[ae]\b/i, weight: 5 },
  { re: /\bfisioterapist[ae]\b/i, weight: 5 },
  { re: /\blogopedist[ae]\b/i, weight: 5 },
  { re: /\blevatrice|ostetric[ae]\b/i, weight: 5 },
  { re: /\bpedagogist[ae]\b/i, weight: 4 },
  { re: /\bmanutenzione\s+impianti\b/i, weight: 4 },
];

const BLACKLIST_PATTERNS: readonly RegExp[] = [
  /\.(?:css|js|png|jpe?g|gif|svg|webp|ico|pdf|zip|rar|7z|docx?|xlsx?|pptx?)$/i,
  /\/wp-content\//i,
  /\/wp-includes\//i,
  /facebook\.com/i, /twitter\.com/i, /linkedin\.com/i,
  /instagram\.com/i, /tiktok\.com/i, /youtube\.com\/watch/i,
  /doubleclick\.net/i, /googlesyndication\.com/i,
  /googleadservices\.com/i, /\/adserver\//i,
  /[?&](?:utm_|fbclid|gclid)=/i,
  /google\.com\/search/i, /bing\.com\/search/i,
];

const MIM_CODE_RE = /\b([A-Z]{2}[A-Z]{2}[A-Z0-9]{6})\b/;

// =============================================================================
// Utilities
// =============================================================================

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));
const jitter = (ms: number): number => Math.round(ms * (0.5 + Math.random() * 0.5));

class Semaphore {
  private permits: number;
  private readonly waiters: Array<() => void> = [];
  constructor(permits: number) { this.permits = permits; }
  async acquire(): Promise<void> {
    if (this.permits > 0) { this.permits--; return; }
    await new Promise<void>((res) => this.waiters.push(res));
  }
  release(): void {
    const next = this.waiters.shift();
    if (next) next(); else this.permits++;
  }
  async run<T>(fn: () => Promise<T>): Promise<T> {
    await this.acquire();
    try { return await fn(); } finally { this.release(); }
  }
}

function anySignal(signals: readonly AbortSignal[]): AbortSignal {
  const controller = new AbortController();
  for (const s of signals) {
    if (s.aborted) { controller.abort(s.reason); return controller.signal; }
    s.addEventListener('abort', () => controller.abort(s.reason), { once: true });
  }
  return controller.signal;
}

function parseRetryAfter(value: string | null): number | null {
  if (!value) return null;
  const seconds = Number(value);
  if (Number.isFinite(seconds)) return Math.max(0, Math.round(seconds * 1000));
  const date = Date.parse(value);
  if (Number.isFinite(date)) return Math.max(0, date - Date.now());
  return null;
}

function computeRecordId(region: string, province: string, url: string, keyword: string): string {
  return crypto.createHash('sha256')
    .update(`${region}|${province}|${url}|${keyword}`)
    .digest('hex')
    .slice(0, 16);
}

function cleanText(raw: string | undefined, limit: number): string | null {
  if (!raw) return null;
  return raw.replace(/\s+/g, ' ').trim().slice(0, limit) || null;
}

function institutionalScore(title: string | null, snippet: string | null): number {
  if (!title && !snippet) return 0;
  const text = `${title ?? ''} ${snippet ?? ''}`;
  let score = 0;
  for (const { re, weight } of INSTITUTIONAL_PATTERNS) {
    if (re.test(text)) score += weight;
  }
  for (const { re, weight } of NEGATIVE_PATTERNS) {
    if (re.test(text)) score -= weight;
  }
  if (MIM_CODE_RE.test(text)) score += 10;
  return score;
}

function isBlacklisted(url: string): boolean {
  return BLACKLIST_PATTERNS.some((re) => re.test(url));
}

function isValidUrl(url: string): boolean {
  if (!url.startsWith('http://') && !url.startsWith('https://')) return false;
  try { new URL(url); return true; } catch { return false; }
}

function extractMimCode(text: string): string | null {
  const m = MIM_CODE_RE.exec(text);
  return m ? m[1] : null;
}

async function fetchWithRetry(
  url: string,
  init: RequestInit,
  config: DiscoveryConfig,
  parentSignal: AbortSignal,
): Promise<Response> {
  let attempt = 0;
  for (;;) {
    const controller = new AbortController();
    const timer = setTimeout(
      () => controller.abort(new Error('request timeout')),
      config.requestTimeoutMs,
    );
    const signal = anySignal([parentSignal, controller.signal]);
    try {
      const resp = await fetch(url, { ...init, signal });
      clearTimeout(timer);

      const retryable = resp.status === 429 || (resp.status >= 500 && resp.status < 600);
      if (!retryable || attempt >= config.maxRetries) return resp;

      const retryAfter = parseRetryAfter(resp.headers.get('retry-after'));
      const waitMs = retryAfter ?? jitter(config.baseBackoffMs * 2 ** attempt);
      attempt++;
      await sleep(waitMs);
    } catch (err) {
      clearTimeout(timer);
      if (parentSignal.aborted) throw err;
      if (attempt >= config.maxRetries) throw err;
      await sleep(jitter(config.baseBackoffMs * 2 ** attempt));
      attempt++;
    }
  }
}

// =============================================================================
// Search backends
// =============================================================================

export class MockSearchBackend implements SearchBackend {
  async search(
    query: string,
    region: string,
    province: string,
    _signal: AbortSignal,
  ): Promise<RawSearchResult[]> {
    const prov = province.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const slug = query.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    return [
      {
        url: `https://www.ic-${prov}.edu.it/albo/${slug}`,
        title: `Albo Pretorio — ${query} — ${province}`,
        snippet: `Istituzione Scolastica di ${province}. Bando di ${query}. Dirigente Scolastico. Protocollo n. 1234. Codice RMIC8AB00C.`,
      },
    ];
  }
}

export class HttpSearchBackend implements SearchBackend {
  constructor(
    private readonly endpoint: string,
    private readonly apiKey: string,
    private readonly config: DiscoveryConfig,
  ) {}

  async search(
    query: string,
    region: string,
    province: string,
    signal: AbortSignal,
  ): Promise<RawSearchResult[]> {
    const url = new URL(this.endpoint);
    url.searchParams.set('q', query);
    url.searchParams.set('region', region);
    url.searchParams.set('province', province);

    const resp = await fetchWithRetry(
      url.toString(),
      {
        method: 'GET',
        headers: { Authorization: `Bearer ${this.apiKey}`, Accept: 'application/json' },
      },
      this.config,
      signal,
    );

    if (!resp.ok) throw new Error(`search HTTP ${resp.status}`);
    const body = (await resp.json()) as { results?: RawSearchResult[] };
    return Array.isArray(body.results) ? body.results : [];
  }
}

// =============================================================================
// Discovery orchestrator
// =============================================================================

interface DiscoveryStats {
  cellsProcessed: number;
  recordsEmitted: number;
  rejectedBlacklist: number;
  rejectedInstitutional: number;
  rejectedNegativeRole: number;
  duplicateSkipped: number;
  backendErrors: number;
}

export class DiscoveryOrchestrator {
  private readonly seenUrls = new Set<string>();
  private readonly stats: DiscoveryStats = {
    cellsProcessed: 0, recordsEmitted: 0,
    rejectedBlacklist: 0, rejectedInstitutional: 0,
    rejectedNegativeRole: 0, duplicateSkipped: 0, backendErrors: 0,
  };

  constructor(
    private readonly backend: SearchBackend,
    private readonly config: DiscoveryConfig,
  ) {}

  get totalCells(): number {
    const provinces = Object.values(REGION_PROVINCE_MAP).reduce((n, p) => n + p.length, 0);
    return provinces * SEARCH_KEYWORDS.length;
  }

  getStats(): Readonly<DiscoveryStats> { return { ...this.stats }; }

  private *iterMatrix(): IterableIterator<readonly [string, string, string]> {
    for (const [region, provinces] of Object.entries(REGION_PROVINCE_MAP)) {
      for (const province of provinces) {
        for (const keyword of SEARCH_KEYWORDS) {
          yield [region, province, keyword] as const;
        }
      }
    }
  }

  private async processCell(
    region: string,
    province: string,
    keyword: string,
    signal: AbortSignal,
  ): Promise<DiscoveryRecord[]> {
    const query = `${keyword} ${province} scuola`;
    let raw: RawSearchResult[];
    try {
      raw = await this.backend.search(query, region, province, signal);
    } catch (err) {
      this.stats.backendErrors++;
      console.error(`[WARN] backend failed | ${region}/${province}/${keyword} | ${(err as Error).message}`);
      return [];
    }

    const out: DiscoveryRecord[] = [];
    for (const item of raw) {
      const title = cleanText(item.title, 300);
      const snippet = cleanText(item.snippet, 500);

      if (!isValidUrl(item.url) || isBlacklisted(item.url)) {
        this.stats.rejectedBlacklist++;
        continue;
      }
      const score = institutionalScore(title, snippet);
      if (score < this.config.passThreshold) {
        const text = `${title ?? ''} ${snippet ?? ''}`;
        const hitNegative = NEGATIVE_PATTERNS.some(({ re }) => re.test(text));
        if (hitNegative) {
          this.stats.rejectedNegativeRole++;
        } else {
          this.stats.rejectedInstitutional++;
        }
        continue;
      }
      if (this.seenUrls.has(item.url)) {
        this.stats.duplicateSkipped++;
        continue;
      }
      this.seenUrls.add(item.url);

      const combined = `${title ?? ''} ${snippet ?? ''}`;
      out.push({
        record_id: computeRecordId(region, province, item.url, keyword),
        region, province, keyword,
        source_url: item.url,
        school_identifier: extractMimCode(combined),
        school_name: null,
        title, snippet,
        institutional_score: score,
        schema_version: '1.3',
      });
    }
    this.stats.recordsEmitted += out.length;
    return out;
  }

  async run(signal: AbortSignal): Promise<DiscoveryRecord[]> {
    const limiter = new Semaphore(this.config.concurrency);
    const tasks: Array<Promise<DiscoveryRecord[]>> = [];
    let queued = 0;

    for (const [region, province, keyword] of this.iterMatrix()) {
      if (signal.aborted) break;
      if (this.config.maxCells !== null && queued >= this.config.maxCells) break;
      queued++;
      tasks.push(
        limiter.run(async () => {
          this.stats.cellsProcessed++;
          return this.processCell(region, province, keyword, signal);
        }),
      );
    }

    const batches = await Promise.all(tasks);
    return batches.flat();
  }
}

// =============================================================================
// Supabase Persistence Hand-off (Staging) with Schema Preflight
// =============================================================================

export class SartoriaSupabaseClient {
  private readonly supabase: SupabaseClient | null = null;
  private tableColumns: ReadonlySet<string> | null = null;
  private readonly columnMap: SupabaseColumnMap;

  constructor(private readonly config: DiscoveryConfig) {
    this.columnMap = config.supabaseColumnMap;
    if (!config.dryRun && config.supabaseUrl && config.supabaseServiceRoleKey) {
      this.supabase = createClient(config.supabaseUrl, config.supabaseServiceRoleKey, {
        auth: { persistSession: false },
      });
    }
  }

  private async probeSchema(signal: AbortSignal): Promise<ReadonlySet<string> | null> {
    if (!this.supabase || !this.config.verifySchema) return null;
    try {
      const url = new URL(`${this.config.supabaseUrl}/rest/v1/`);
      const resp = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          apikey: this.config.supabaseServiceRoleKey!,
          Authorization: `Bearer ${this.config.supabaseServiceRoleKey}`,
          Accept: 'application/openapijson',
        },
        signal,
      });
      if (!resp.ok) return null;
      const spec = (await resp.json()) as {
        paths?: Record<string, { get?: { parameters?: Array<{ name: string; in: string }> } }>;
      };
      const pathKey = `/${this.config.supabaseTable}`;
      const pathObj = spec.paths?.[pathKey];
      const params = pathObj?.get?.parameters;
      if (!Array.isArray(params)) return null;

      const cols = new Set<string>();
      for (const p of params) {
        if (p.in === 'query') cols.add(p.name);
      }
      return cols.size > 0 ? cols : null;
    } catch {
      return null;
    }
  }

  private toRow(record: DiscoveryRecord): Record<string, unknown> {
    const m = this.columnMap;
    const row: Record<string, unknown> = {
      [m.record_id]: record.record_id,
      [m.region]: record.region,
      [m.province]: record.province,
      [m.matched_keyword]: record.keyword,
      [m.source_url]: record.source_url,
      [m.school_identifier]: record.school_identifier,
      [m.school_name]: record.school_name,
      [m.title]: record.title,
      [m.snippet]: record.snippet,
      [m.discovery_confidence]: record.institutional_score,
      [m.schema_version]: record.schema_version,
    };
    if (m.url_alias && m.url_alias !== m.source_url) {
      row[m.url_alias] = record.source_url;
    }
    if (m.domain_alias) {
      try {
        row[m.domain_alias] = new URL(record.source_url).hostname;
      } catch {
        row[m.domain_alias] = 'unknown';
      }
    }
    return row;
  }

  private filterRow(row: Record<string, unknown>, allowed: ReadonlySet<string>): Record<string, unknown> {
    const filtered: Record<string, unknown> = {};
    const dropped: string[] = [];
    for (const [k, v] of Object.entries(row)) {
      if (allowed.has(k)) {
        filtered[k] = v;
      } else {
        dropped.push(k);
      }
    }
    if (dropped.length > 0 && this.config.strictSchema) {
      throw new Error(`Strict schema violation: columns [${dropped.join(', ')}] not found in table '${this.config.supabaseTable}'`);
    }
    return filtered;
  }

  async dispatch(records: readonly DiscoveryRecord[], signal: AbortSignal): Promise<number> {
    if (records.length === 0) return 0;

    if (this.config.dryRun || !this.supabase) {
      for (const r of records) console.log('[SARTORIA-DRYRUN]', JSON.stringify(this.toRow(r)));
      return records.length;
    }

    if (this.tableColumns === null) {
      this.tableColumns = await this.probeSchema(signal);
      if (this.tableColumns) {
        console.log(`[INFO] Supabase table '${this.config.supabaseTable}' columns: ${[...this.tableColumns].join(', ')}`);
      }
    }

    const rows = records.map((r) => {
      const raw = this.toRow(r);
      return this.tableColumns ? this.filterRow(raw, this.tableColumns) : raw;
    });

    let dispatched = 0;
    for (let i = 0; i < rows.length; i += this.config.sartoriaBatchSize) {
      if (signal.aborted) break;
      const batch = rows.slice(i, i + this.config.sartoriaBatchSize);

      const { error } = await this.supabase
        .from(this.config.supabaseTable)
        .upsert(batch, { onConflict: 'record_id' });

      if (error) {
        console.error(`[ERROR] Supabase upsert failed | ${error.message} | ${batch.length} records dropped`);
        continue;
      }
      dispatched += batch.length;
    }
    return dispatched;
  }
}

// =============================================================================
// Config from environment
// =============================================================================

function loadColumnMap(): SupabaseColumnMap {
  const raw = process.env.SUPABASE_COLUMN_MAP_JSON;
  if (!raw) return DEFAULT_COLUMN_MAP;
  try {
    const parsed = JSON.parse(raw) as Partial<SupabaseColumnMap>;
    const merged: SupabaseColumnMap = { ...DEFAULT_COLUMN_MAP };
    for (const key of Object.keys(DEFAULT_COLUMN_MAP) as Array<keyof SupabaseColumnMap>) {
      const value = parsed[key];
      if (key === 'url_alias' || key === 'domain_alias') {
        if (value === null || value === '') merged[key] = null;
        else if (typeof value === 'string') merged[key] = value;
        continue;
      }
      if (typeof value === 'string' && value.length > 0) merged[key] = value;
    }
    return merged;
  } catch {
    console.warn('[WARN] SUPABASE_COLUMN_MAP_JSON is not valid JSON — using defaults');
    return DEFAULT_COLUMN_MAP;
  }
}

function loadConfig(): DiscoveryConfig {
  const int = (name: string, def: number): number => {
    const raw = process.env[name];
    if (!raw) return def;
    const n = Number.parseInt(raw, 10);
    return Number.isFinite(n) ? n : def;
  };
  const str = (name: string, def: string | null): string | null =>
    process.env[name] ?? def;
  const bool = (name: string, def: boolean): boolean => {
    const raw = process.env[name];
    if (raw === undefined) return def;
    return raw.toLowerCase() === 'true';
  };

  const maxCellsRaw = process.env.MAX_CELLS;
  const maxCells = maxCellsRaw ? Number.parseInt(maxCellsRaw, 10) : null;

  return {
    concurrency: int('CONCURRENCY', 8),
    requestTimeoutMs: int('REQUEST_TIMEOUT_MS', 15_000),
    maxRetries: int('MAX_RETRIES', 4),
    baseBackoffMs: int('BASE_BACKOFF_MS', 500),
    passThreshold: int('PASS_THRESHOLD', 3),
    maxCells: maxCells !== null && Number.isFinite(maxCells) ? maxCells : null,
    supabaseUrl: str('SUPABASE_URL', null),
    supabaseServiceRoleKey: str('SUPABASE_SERVICE_ROLE_KEY', null),
    supabaseTable: str('SUPABASE_TABLE', 'discovered_links') ?? 'discovered_links',
    supabaseColumnMap: loadColumnMap(),
    verifySchema: bool('VERIFY_SCHEMA', true),
    strictSchema: bool('STRICT_SCHEMA', false),
    sartoriaBatchSize: int('SARTORIA_BATCH_SIZE', 50),
    dryRun: (process.env.DRY_RUN ?? 'true').toLowerCase() !== 'false',
  };
}

function buildBackend(config: DiscoveryConfig): SearchBackend {
  const kind = (process.env.SEARCH_BACKEND ?? 'mock').toLowerCase();
  if (kind === 'http') {
    const endpoint = process.env.SEARCH_ENDPOINT;
    const apiKey = process.env.SEARCH_API_KEY ?? '';
    if (!endpoint) throw new Error('SEARCH_BACKEND=http requires SEARCH_ENDPOINT');
    return new HttpSearchBackend(endpoint, apiKey, config);
  }
  console.log('[INFO] using MockSearchBackend (set SEARCH_BACKEND=http for live)');
  return new MockSearchBackend();
}

// =============================================================================
// Entry point
// =============================================================================

async function main(): Promise<void> {
  const config = loadConfig();
  const shutdown = new AbortController();
  let sigCount = 0;
  const onSignal = (sig: string): void => {
    sigCount++;
    if (sigCount > 1) { console.error(`[${sig}] second signal — hard exit`); process.exit(130); }
    console.warn(`[${sig}] received — graceful shutdown requested`);
    shutdown.abort();
  };
  process.on('SIGINT', () => onSignal('SIGINT'));
  process.on('SIGTERM', () => onSignal('SIGTERM'));

  if (SEARCH_KEYWORDS.length !== EXPECTED_KEYWORD_COUNT) {
    console.warn(
      `[WARN] keyword count drift: expected ${EXPECTED_KEYWORD_COUNT}, got ${SEARCH_KEYWORDS.length}`,
    );
  }

  const backend = buildBackend(config);
  const orchestrator = new DiscoveryOrchestrator(backend, config);

  console.log(
    `[INFO] ScuoleRadar discovery start | cells=${orchestrator.totalCells} | ` +
    `keywords=${SEARCH_KEYWORDS.length} | concurrency=${config.concurrency} | ` +
    `dry_run=${config.dryRun} | max_cells=${config.maxCells ?? 'all'} | ` +
    `table=${config.supabaseTable}`,
  );

  const startedAt = Date.now();
  const records = await orchestrator.run(shutdown.signal);
  const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1);

  const stats = orchestrator.getStats();
  const withMim = records.filter((r) => r.school_identifier !== null).length;
  console.log(
    `[INFO] discovery done | ${elapsed}s | cells=${stats.cellsProcessed} | ` +
    `records=${records.length} | with_mim=${withMim} | ` +
    `rejected_blacklist=${stats.rejectedBlacklist} | ` +
    `rejected_score=${stats.rejectedInstitutional} | ` +
    `rejected_negative_role=${stats.rejectedNegativeRole} | ` +
    `dupes=${stats.duplicateSkipped} | backend_errors=${stats.backendErrors}`,
  );

  const sartoria = new SartoriaSupabaseClient(config);
  const dispatched = await sartoria.dispatch(records, shutdown.signal);
  console.log(`[INFO] hand-off complete | records written/dispatched=${dispatched}`);
}

if (
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  main().catch((err) => {
    console.error('[FATAL]', err);
    process.exit(1);
  });
}