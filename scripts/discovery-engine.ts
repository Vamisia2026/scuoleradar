// scripts/discovery-engine.ts
// Discovery & Scoring Engine — v4
// Architettura: espansione BFS della homepage + scoring del contenuto
// applicato solo alle sotto-pagine. Vedi migrazione SQL nel README.

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import * as cheerio from 'cheerio';
import * as dotenv from 'dotenv';
import * as crypto from 'crypto';

dotenv.config();

// ---------------------------------------------------------------------------
// Configurazione
// ---------------------------------------------------------------------------

const CONFIG = {
  userAgent: 'ScuoleRadarBot/1.0 (+https://scuoleradar.it)',
  fetchTimeoutMs: 20_000,
  fetchRetries: 2,
  fetchRetryBaseMs: 800,
  maxTextLength: 400_000,

  // Limiti di espansione
  maxDepth: 2,
  maxCandidatesPerPage: 25,
  perDomainDelayMs: 400,

  // Soglie
  pathScoreMinToEnqueue: 4,   // sotto questa soglia il link non entra
  pathScoreMinToExpand: 7,    // sopra questa soglia la pagina si espande
  contentScoreMinForActive: 5,

  blacklist: [
    'scuolainterpelli.it',
    'docenti.it',
    'studenti.it',
    'skuola.net',
    'facebook.com',
    'twitter.com',
    'instagram.com',
    'youtube.com',
    'linkedin.com',
  ] as readonly string[],
} as const;

// ---------------------------------------------------------------------------
// Supabase
// ---------------------------------------------------------------------------

const supabaseUrl =
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY ||
  '';

if (!supabaseUrl || !supabaseKey) {
  console.error('[discovery-engine] Credenziali Supabase mancanti nel file .env');
  process.exit(1);
}

const supabase: SupabaseClient = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// ---------------------------------------------------------------------------
// Utility
// ---------------------------------------------------------------------------

function normalize(input: string): string {
  return input.replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();
}

function extractDomain(urlStr: string): string {
  try {
    return new URL(urlStr).hostname.toLowerCase();
  } catch {
    return '';
  }
}

function sha256(input: string): string {
  return crypto.createHash('sha256').update(input).digest('hex');
}

function absoluteUrl(href: string, base: string): string | null {
  if (!href) return null;
  const trimmed = href.trim();
  if (!trimmed) return null;
  if (
    trimmed.startsWith('#') ||
    trimmed.startsWith('javascript:') ||
    trimmed.startsWith('mailto:') ||
    trimmed.startsWith('tel:')
  ) {
    return null;
  }
  try {
    const u = new URL(trimmed, base);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
    u.hash = '';
    // Rimuove i tracking param
    const keep = new URLSearchParams();
    u.searchParams.forEach((v, k) => {
      const lk = k.toLowerCase();
      if (lk.startsWith('utm_') || lk === 'fbclid' || lk === 'gclid') return;
      keep.set(k, v);
    });
    u.search = keep.toString();
    return u.toString();
  } catch {
    return null;
  }
}

function isBlacklistedDomain(domain: string): boolean {
  if (!domain) return true;
  return CONFIG.blacklist.some((b) => domain === b || domain.endsWith('.' + b));
}

// ---------------------------------------------------------------------------
// Path scoring (per i link estratti da una pagina)
// ---------------------------------------------------------------------------

interface PathScore {
  score: number;
  tags: string[];
}

const PATH_PATTERNS: ReadonlyArray<{ re: RegExp; score: number; tag: string }> = [
  { re: /interpell/i, score: 10, tag: 'path_interpelli' },
  { re: /albo[-_]?(pretorio|online|istituto)?/i, score: 9, tag: 'path_albo' },
  { re: /amministrazione[-_]?trasparente|trasparenza/i, score: 9, tag: 'path_trasparenza' },
  { re: /\bbandi?\b/i, score: 8, tag: 'path_bandi' },
  { re: /concors/i, score: 8, tag: 'path_concorsi' },
  { re: /selezion/i, score: 7, tag: 'path_selezioni' },
  { re: /avvis/i, score: 7, tag: 'path_avvisi' },
  { re: /graduator/i, score: 7, tag: 'path_graduatorie' },
  { re: /reclutament/i, score: 7, tag: 'path_reclutamento' },
  { re: /\bpnrr\b/i, score: 6, tag: 'path_pnrr' },
  { re: /\bpon\b/i, score: 5, tag: 'path_pon' },
  { re: /\bpor\b/i, score: 5, tag: 'path_por' },
  { re: /\bclil\b/i, score: 5, tag: 'path_clil' },
  { re: /\bpersonale\b/i, score: 4, tag: 'path_personale' },
  { re: /\bdocenti\b/i, score: 3, tag: 'path_docenti' },
  { re: /\bata\b/i, score: 3, tag: 'path_ata' },
  { re: /circolar/i, score: 2, tag: 'path_circolari' },
  { re: /comunicazion/i, score: 2, tag: 'path_comunicazioni' },
  { re: /\bnews\b/i, score: 2, tag: 'path_news' },
  // Segnali negativi
  { re: /privacy|cookie|contatt/i, score: -5, tag: 'path_neg_legal' },
  { re: /login|wp-admin|wp-content|wp-json|\bfeed\b|sitemap|\brss\b/i, score: -10, tag: 'path_neg_system' },
  { re: /\.(pdf|docx?|xlsx?|pptx?|zip|rar)$/i, score: -10, tag: 'path_document' },
  { re: /\.(jpg|jpeg|png|gif|svg|webp|ico|css|js)$/i, score: -10, tag: 'path_asset' },
];

function scorePath(pathname: string, anchorText: string): PathScore {
  const haystack = `${pathname} ${anchorText}`;
  let score = 0;
  const tags: string[] = [];
  for (const { re, score: s, tag } of PATH_PATTERNS) {
    if (re.test(haystack)) {
      score += s;
      tags.push(tag);
    }
  }
  return { score, tags };
}

// ---------------------------------------------------------------------------
// Estrazione link candidati
// ---------------------------------------------------------------------------

interface CandidateLink {
  url: string;
  pathScore: number;
  pathTags: string[];
}

function extractCandidateLinks(
  $: cheerio.CheerioAPI,
  baseUrl: string
): CandidateLink[] {
  const baseDomain = extractDomain(baseUrl);
  const seen = new Set<string>();
  const candidates: CandidateLink[] = [];

  $('a[href]').each((_, el) => {
    const href = $(el).attr('href') || '';
    const anchor = normalize($(el).text());
    const abs = absoluteUrl(href, baseUrl);
    if (!abs) return;
    if (seen.has(abs)) return;
    seen.add(abs);

    const domain = extractDomain(abs);
    if (domain !== baseDomain) return;
    if (isBlacklistedDomain(domain)) return;

    let pathname = '';
    try {
      pathname = new URL(abs).pathname;
    } catch {
      return;
    }

    const { score, tags } = scorePath(pathname, anchor);
    if (score < CONFIG.pathScoreMinToEnqueue) return;

    candidates.push({ url: abs, pathScore: score, pathTags: tags });
  });

  candidates.sort((a, b) => b.pathScore - a.pathScore);
  return candidates.slice(0, CONFIG.maxCandidatesPerPage);
}

// ---------------------------------------------------------------------------
// Content scoring (solo per sotto-pagine)
// ---------------------------------------------------------------------------

interface ContentScore {
  score: number;
  tags: string[];
  hasTable: boolean;
  hasPdf: boolean;
  hasCmsStructure: boolean;
  tableCount: number;
  contentTableCount: number;
  deadlineCount: number;
  mechCodeCount: number;
  keywordHits: number;
}

function scoreContentPage(url: string, html: string): ContentScore {
  const $ = cheerio.load(html);
  $('script, style, noscript, iframe, svg, template, nav, header, footer').remove();

  const $main = $('main, article, #content, .content, #main, .main').first();
  const $scope = $main.length > 0 ? $main : $.root();

  const rawText = $scope.text();
  const fullText = normalize(
    rawText.length > CONFIG.maxTextLength
      ? rawText.slice(0, CONFIG.maxTextLength)
      : rawText
  );
  const textLower = fullText.toLowerCase();

  const title = normalize($('title').text()).toLowerCase();
  const metaDesc = normalize(
    $('meta[name="description"]').attr('content') || ''
  ).toLowerCase();

  const tags: string[] = [];
  let score = 0;

  // 1) Keyword di opportunità nel contenuto principale
  const primaryKeywords = [
    'interpello', 'interpelli', 'bando', 'bandi', 'avviso', 'avvisi',
    'selezione', 'graduatoria', 'graduatorie', 'reclutamento',
  ];
  const keywordHits = primaryKeywords.reduce(
    (acc, kw) => acc + (textLower.includes(kw) ? 1 : 0),
    0
  );
  if (keywordHits >= 2) {
    score += 3;
    tags.push('multi_keywords');
  } else if (keywordHits === 1) {
    score += 1;
    tags.push('single_keyword');
  }
  if (
    title.includes('interpell') ||
    title.includes('bando') ||
    title.includes('avvis')
  ) {
    score += 1;
    tags.push('title_keyword');
  }

  // 2) Tabelle di contenuto reali
  const allTables = $('table');
  const tableCount = allTables.length;
  const contentTables = allTables.filter((_, t) => {
    const rows = $(t).find('tr').length;
    const firstRow = $(t).find('tr').first();
    const cols = firstRow.find('td, th').length;
    return rows >= 3 && cols >= 3;
  });
  const contentTableCount = contentTables.length;
  const hasTable = contentTableCount > 0;
  if (hasTable) {
    score += contentTableCount >= 2 ? 3 : 2;
    tags.push('has_content_table');
  }

  // 3) Scadenze (date pattern)
  const dateRe = /\b\d{1,2}[/\-.]\d{1,2}[/\-.]\d{2,4}\b/g;
  const deadlineCount = (fullText.match(dateRe) || []).length;
  if (deadlineCount >= 3) {
    score += 2;
    tags.push('many_dates');
  } else if (deadlineCount >= 1) {
    score += 1;
    tags.push('some_dates');
  }

  // 4) PDF (documento di bando)
  const pdfLinks = $('a[href]')
    .toArray()
    .filter((el) => (($(el).attr('href') || '').toLowerCase().includes('.pdf')));
  const hasPdf = pdfLinks.length > 0;
  if (hasPdf) {
    score += pdfLinks.length >= 3 ? 2 : 1;
    tags.push('has_pdf');
  }

  // 5) Codici classe / meccanografici
  const classCodes = (fullText.match(/\b[A-E]-?\d{2}\b/g) || []).length;
  const mechCodes = extractMechCodes(fullText).size;
  if (classCodes >= 2 || mechCodes >= 2) {
    score += 2;
    tags.push('code_signals');
  } else if (classCodes >= 1 || mechCodes >= 1) {
    score += 1;
    tags.push('code_signal_weak');
  }

  // 6) Fondi speciali
  const fundKeywords = ['pnrr', 'pon', 'por', 'clil', 'potenziamento', 'dispersione'];
  const fundHits = fundKeywords.reduce(
    (acc, kw) => acc + (textLower.includes(kw) ? 1 : 0),
    0
  );
  if (fundHits >= 1) {
    score += 1;
    tags.push('special_funds');
  }

  // 7) Boost dal path (piccolo: il path aiuta, non domina)
  const { score: pScore } = scorePath(new URL(url).pathname, '');
  if (pScore >= 8) {
    score += 2;
    tags.push('path_boost_high');
  } else if (pScore >= 5) {
    score += 1;
    tags.push('path_boost_low');
  }

  return {
    score,
    tags,
    hasTable,
    hasPdf,
    hasCmsStructure: $('article').length > 0 || html.includes('wp-content'),
    tableCount,
    contentTableCount,
    deadlineCount,
    mechCodeCount: mechCodes,
    keywordHits,
  };
}

// ---------------------------------------------------------------------------
// Codici meccanografici (per segnale nel content scoring)
// ---------------------------------------------------------------------------

const PROVINCE_CODES = new Set<string>([
  'AG','AL','AN','AO','AP','AQ','AR','AT','AV','BA','BG','BI','BL','BN','BO',
  'BR','BS','BT','BZ','CA','CB','CE','CH','CL','CN','CO','CR','CS','CT','CZ',
  'EN','FC','FE','FG','FI','FM','FR','GE','GO','GR','IM','IS','KR','LC','LE',
  'LI','LO','LT','LU','MB','MC','ME','MI','MN','MO','MS','MT','NA','NO','NU',
  'OR','PA','PC','PD','PE','PG','PI','PN','PO','PR','PT','PU','PV','PZ','RA',
  'RC','RE','RG','RI','RM','RN','RO','SA','SI','SO','SP','SR','SS','SU','SV',
  'TA','TE','TN','TO','TP','TR','TS','TV','UD','VA','VB','VC','VE','VI','VR',
  'VT','VV',
]);

function extractMechCodes(text: string): Set<string> {
  const found = new Set<string>();
  const re = /\b([A-Z]{2}[A-Z0-9]{8})\b/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const code = m[1];
    if (!PROVINCE_CODES.has(code.slice(0, 2))) continue;
    if (!/^[A-Z]{2}$/.test(code.slice(2, 4))) continue;
    found.add(code);
    if (found.size >= 100) break;
  }
  return found;
}

// ---------------------------------------------------------------------------
// Fetch con retry + throttle per dominio
// ---------------------------------------------------------------------------

const domainLastAccess = new Map<string, number>();

async function throttleDomain(domain: string): Promise<void> {
  const last = domainLastAccess.get(domain) ?? 0;
  const elapsed = Date.now() - last;
  const wait = Math.max(0, CONFIG.perDomainDelayMs - elapsed);
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  domainLastAccess.set(domain, Date.now());
}

interface FetchResult {
  status: number;
  contentType: string;
  html: string;
}

async function fetchHtml(url: string): Promise<FetchResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), CONFIG.fetchTimeoutMs);
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': CONFIG.userAgent,
        Accept: 'text/html,application/xhtml+xml',
        'Accept-Language': 'it-IT,it;q=0.9,en;q=0.8',
      },
      signal: controller.signal,
      redirect: 'follow',
    });
    const contentType = response.headers.get('content-type') || '';
    const html = await response.text();
    return { status: response.status, contentType, html };
  } finally {
    clearTimeout(timer);
  }
}

async function fetchWithRetry(url: string): Promise<FetchResult> {
  let lastErr: Error | null = null;
  for (let attempt = 0; attempt <= CONFIG.fetchRetries; attempt++) {
    try {
      return await fetchHtml(url);
    } catch (err) {
      lastErr = err instanceof Error ? err : new Error(String(err));
      if (attempt < CONFIG.fetchRetries) {
        const delay = CONFIG.fetchRetryBaseMs * 2 ** attempt + Math.random() * 250;
        await new Promise((r) => setTimeout(r, delay));
      }
    }
  }
  throw lastErr ?? new Error('fetch failed');
}

// ---------------------------------------------------------------------------
// Tipi target
// ---------------------------------------------------------------------------

interface Target {
  id: string;
  url: string;
  region: string | null;
  province: string | null;
  depth: number;
  path_score: number;
  parent_url: string | null;
}

// ---------------------------------------------------------------------------
// Espansione: da una pagina, genera i figli
// ---------------------------------------------------------------------------

async function expandPage(
  target: Target,
  $: cheerio.CheerioAPI
): Promise<number> {
  const candidates = extractCandidateLinks($, target.url);
  const nextDepth = target.depth + 1;
  if (nextDepth > CONFIG.maxDepth) return 0;

  let inserted = 0;
  for (const c of candidates) {
    const domain = extractDomain(c.url);
    const { error } = await supabase
      .from('discovered_links')
      .upsert(
        {
          url: c.url,
          domain,
          region: target.region,
          province: target.province,
          status: 'pending',
          depth: nextDepth,
          parent_url: target.url,
          path_score: c.pathScore,
          path_tags: c.pathTags,
          last_scanned_at: new Date().toISOString(),
        },
        { onConflict: 'url', ignoreDuplicates: true }
      );
    if (!error) inserted++;
  }
  return inserted;
}

// ---------------------------------------------------------------------------
// Elaborazione di un target
// ---------------------------------------------------------------------------

async function processTarget(target: Target): Promise<void> {
  const domain = extractDomain(target.url);
  if (isBlacklistedDomain(domain)) {
    await supabase
      .from('discovered_links')
      .update({ status: 'blacklisted', last_scanned_at: new Date().toISOString() })
      .eq('id', target.id);
    return;
  }

  await throttleDomain(domain);

  let result: FetchResult;
  try {
    result = await fetchWithRetry(target.url);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`  [timeout] ${target.url}: ${msg}`);
    await supabase
      .from('discovered_links')
      .update({
        status: 'error_timeout',
        last_scanned_at: new Date().toISOString(),
      })
      .eq('id', target.id);
    return;
  }

  if (
    result.status >= 400 ||
    (!result.contentType.includes('text/html') &&
      !result.contentType.includes('xml'))
  ) {
    await supabase
      .from('discovered_links')
      .update({
        status: 'error_http',
        last_scanned_at: new Date().toISOString(),
      })
      .eq('id', target.id);
    return;
  }

  const $ = cheerio.load(result.html);
  const isHomepage = target.depth === 0;

  if (isHomepage) {
    // Le homepage non si valutano: si espandono e basta.
    const inserted = await expandPage(target, $);
    await supabase
      .from('discovered_links')
      .update({
        status: 'expanded',
        content_hash: sha256(result.html),
        last_scanned_at: new Date().toISOString(),
      })
      .eq('id', target.id);
    console.log(`  [home] ${target.url} → ${inserted} sub-link`);
    return;
  }

  // Sotto-pagina: scoring del contenuto.
  const scored = scoreContentPage(target.url, result.html);

  let newStatus = 'parked_low_score';
  if (scored.score >= CONFIG.contentScoreMinForActive) {
    newStatus = 'active_crawler';
  } else if (scored.hasPdf) {
    newStatus = 'parked_for_pdf';
  }

  console.log(
    `  [d${target.depth}] score=${scored.score} stato=${newStatus} ${target.url}`
  );

  await supabase
    .from('discovered_links')
    .update({
      score: scored.score,
      has_table: scored.hasTable,
      has_cms_structure: scored.hasCmsStructure,
      has_pdf: scored.hasPdf,
      content_type_tags: scored.tags,
      status: newStatus,
      content_hash: sha256(result.html),
      last_scanned_at: new Date().toISOString(),
      last_updated_at: new Date().toISOString(),
    })
    .eq('id', target.id);

  // Espansione ricorsiva solo se la pagina è molto promettente per path
  // e non abbiamo ancora raggiunto la profondità massima.
  if (
    target.depth < CONFIG.maxDepth &&
    target.path_score >= CONFIG.pathScoreMinToExpand
  ) {
    const inserted = await expandPage(target, $);
    if (inserted > 0) {
      console.log(`  [d${target.depth}] → espanso in ${inserted} figli`);
    }
  }
}

// ---------------------------------------------------------------------------
// Loop BFS
// ---------------------------------------------------------------------------

async function fetchPendingTargets(
  limit: number,
  provinceFilter?: string
): Promise<Target[]> {
  let q = supabase
    .from('discovered_links')
    .select('id, url, region, province, depth, path_score, parent_url')
    .eq('status', 'pending')
    .order('depth', { ascending: true })
    .order('path_score', { ascending: false })
    .limit(limit);

  if (provinceFilter) q = q.eq('province', provinceFilter);

  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []) as Target[];
}

async function runDiscoveryEngine(): Promise<void> {
  const args = process.argv.slice(2);
  const provinceArg = args
    .find((a) => a.startsWith('--provincia='))
    ?.split('=')[1]
    ?.toUpperCase();

  console.log(
    `[discovery-engine] Avvio BFS${
      provinceArg ? ` (provincia=${provinceArg})` : ''
    }...`
  );

  const BATCH_SIZE = 40;
  let totalProcessed = 0;
  let emptyRounds = 0;

  while (true) {
    let targets: Target[];
    try {
      targets = await fetchPendingTargets(BATCH_SIZE, provinceArg);
    } catch (err) {
      console.error(
        `[discovery-engine] Errore lettura coda: ${
          err instanceof Error ? err.message : String(err)
        }`
      );
      break;
    }

    if (targets.length === 0) {
      emptyRounds++;
      // Se stiamo lavorando su una provincia e la coda si è svuotata,
      // aspettiamo che altre run popolino nuovi 'pending'. Dopo 3 round
      // vuoti consecutivi, usciamo.
      if (provinceArg && emptyRounds >= 3) break;
      if (!provinceArg) break;
      await new Promise((r) => setTimeout(r, 5_000));
      continue;
    }

    emptyRounds = 0;
    console.log(
      `[discovery-engine] Batch di ${targets.length} target (depth 0=${targets.filter((t) => t.depth === 0).length}).`
    );

    for (const t of targets) {
      try {
        await processTarget(t);
        totalProcessed++;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`  [fatal-target] ${t.url}: ${msg}`);
        await supabase
          .from('discovered_links')
          .update({
            status: 'error_internal',
            last_scanned_at: new Date().toISOString(),
          })
          .eq('id', t.id);
      }
    }
  }

  console.log(
    `[discovery-engine] Scansione completata. Target processati: ${totalProcessed}.`
  );
}

runDiscoveryEngine().catch((err) => {
  console.error('[discovery-engine] Errore fatale:', err);
  process.exit(1);
});