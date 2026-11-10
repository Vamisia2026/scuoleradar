/**
 * api-esploratrici.ts
 * ScuoleRadar — Open-discovery national crawler for school job opportunities.
 */

import * as crypto from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

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
  readonly schema_version: '1.2';
}

export interface SearchBackend {
  search(
    query: string,
    region: string,
    province: string,
    signal: AbortSignal,
  ): Promise<RawSearchResult[]>;
}

export interface DiscoveryConfig {
  readonly concurrency: number;
  readonly requestTimeoutMs: number;
  readonly maxRetries: number;
  readonly baseBackoffMs: number;
  readonly passThreshold: number;
  readonly maxCells: number | null;
  readonly supabaseUrl: string | null;
  readonly supabaseServiceRoleKey: string | null;
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
// Configuration — Clean & Focused Keyword Catalog
// =============================================================================

const SEARCH_KEYWORDS: readonly string[] = [
  // Interpelli & Chiamate Dirette
  "Interpello", "Interpelli", "Interpello Chiamata Diretta", "Avviso Interpello Supplenza",
  // Supplenze Docenti
  "Supplenza", "Supplenze", "Supplenza d'Istituto", "Terza Fascia", "Graduatoria d'Istituto", "Disponibilità Ore Spezzone",
  // Personale ATA
  "Ricerca Personale ATA", "Collaboratore Scolastico", "Assistente Amministrativo", "Assistente Tecnico",
  // PNRR & Esperti
  "PNRR", "Bando Progetto PNRR", "Esperti PNRR", "Animatore Digitale", "Tutor PNRR", "Esperti Esterni Madrelingua",
  // Messa a Disposizione
  "MAD", "Messa a Disposizione"
];

// =============================================================================
// Configuration — regexes
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
        snippet: `Istituzione Scolastica di ${province}. Bando di ${query}. Dirigente Scolastico. Protocollo n. 1234.`,
      },
      {
        url: `https://www.liceo-${prov}.net/interpelli/${slug}`,
        title: `${query} — Liceo ${province}`,
        snippet: `Avviso di ${query} presso il Liceo di ${province}. Graduatoria d'Istituto. Codice meccanografico RMIC8AB00C.`,
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
  duplicateSkipped: number;
  backendErrors: number;
}

export class DiscoveryOrchestrator {
  private readonly seenUrls = new Set<string>();
  private readonly stats: DiscoveryStats = {
    cellsProcessed: 0, recordsEmitted: 0,
    rejectedBlacklist: 0, rejectedInstitutional: 0,
    duplicateSkipped: 0, backendErrors: 0,
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
        this.stats.rejectedInstitutional++;
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
        schema_version: '1.2',
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
// Supabase Persistence Hand-off (Staging)
// =============================================================================

export class SartoriaSupabaseClient {
  private readonly supabase;

  constructor(private readonly config: DiscoveryConfig) {
    if (!config.dryRun && config.supabaseUrl && config.supabaseServiceRoleKey) {
      this.supabase = createClient(config.supabaseUrl, config.supabaseServiceRoleKey, {
        auth: { persistSession: false },
      });
    }
  }

  async dispatch(records: readonly DiscoveryRecord[], signal: AbortSignal): Promise<number> {
    if (records.length === 0) return 0;

    if (this.config.dryRun || !this.supabase