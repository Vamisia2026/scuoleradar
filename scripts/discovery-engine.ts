// scripts/discovery-engine.ts
// Discovery & Scoring Engine — v6
// Architettura: espansione BFS della homepage + scoring del contenuto
// applicato solo alle sotto-pagine, con disqualificazione semantica del rumore
// generico (scioperi, circolari famiglie), del rumore amministrativo
// (CIG, gare, elezioni organi, quiescenza) e delle pagine vuote/indice.
//
// NOTA SCHEMA: gli stati 'disqualified_noise' e 'empty_view' devono essere
// accettati da eventuali CHECK constraint su discovered_links.status.

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

  // Soglie di path scoring
  pathScoreMinToEnqueue: 4,
  pathScoreMinToExpand: 7,

  // Soglie di content scoring
  contentScoreMinForActive: 5,

  // Soglie di disqualificazione semantica
  softNoiseThresholdForDisqualify: 3,
  hardNoisePenalty: 6,
  softNoisePenalty: 2,
  adminNoisePenalty: 8,

  // Soglie per pagine vuote / indice
  minMeaningfulTextLength: 400,
  emptyViewPhrases: [
    'nessun contenuto da visualizzare',
    'nessun elemento trovato',
    'nessun risultato',
    'non ci sono contenuti',
    'no content to display',
    'la ricerca non ha prodotto risultati',
  ] as readonly string[],

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
// SEMANTIC PATTERNS
// Tre famiglie indipendenti di segnali:
//   - OPPORTUNITY: reclutamento / supplenze / incarichi (positivi)
//   - HARD_NOISE: eventi scolastici che escludono un bando (negativi forti)
//   - SOFT_NOISE: contesto generico che, accumulato, segnala non-bando
//   - ADMIN_NOISE: atti amministrativi (CIG, gare, elezioni, quiescenza)
//     che NON sono opportunità di lavoro per docenti/ATA.
// I pattern sono "distinct match": ripetizioni non contano più di 1.
// ---------------------------------------------------------------------------

/** Segnali FORTI di reclutamento. La loro presenza salva la pagina dal rumore. */
const OPPORTUNITY_SIGNAL_PATTERNS: readonly RegExp[] = [
  /\binterpell/i,
  /\bdisponibilit[aà]/i,
  /messa a disposizione/i,
  /\bMAD\b/, // case-sensitive: MAD in maiuscolo è acronimo
  /\breclutament/i,
  /\bsupplenz/i,
  /conferimento (di |dell['’]?)?incarico/i,
  /\bgraduatorie? (di merito|definitive|provvisorie|d['’]?istituto)/i,
  /\bselezion(e|i) (pubblica|per il conferimento|di esperti)/i,
  /avviso (pubblico|di selezione|per il reclutamento|di interpello)/i,
  /incarico (a tempo determinato|di docenza|di esperto)/i,
  /\bposto (di|per) (sostegno|docente|insegnante)/i,
];

/**
 * Rumore FORTE generico. Una singola occorrenza squalifica la pagina
 * quando NON ci sono segnali di opportunità.
 */
const HARD_NOISE_PATTERNS: readonly RegExp[] = [
  /\bscioper[oi]\b/i,
  /\bassemblea sindacale\b/i,
  /\bassemblea (studentesca|di classe|d['’]?istituto|plenaria|dei genitori)\b/i,
  /\belezione(i)? (studentesche?|dei rappresentanti|del consiglio|per il rinnovo|delle rsu)/i,
  /\bviaggio (di |d['’]?)?istruzione\b/i,
  /\buscita didattica\b/i,
  /\bgita scolastica\b/i,
  /\bricevimento (dei |delle )?(genitori|famiglie)\b/i,
  /\bcolloqui? con le famiglie\b/i,
  /\bpermesso di uscita\b/i,
  /\bentrata posticipata\b/i,
  /\buscita anticipata\b/i,
  /\bsospensione (delle )?attivit[aà]\b/i,
  /\bmanifestazione (studentesca|sindacale)\b/i,
];

/**
 * Rumore SOFT. La singola occorrenza è innocua, ma tre o più insieme —
 * in assenza di segnali di opportunità — squalificano la pagina.
 */
const SOFT_NOISE_PATTERNS: readonly RegExp[] = [
  /\bfamigli[ae]\b/i,
  /\bgenitori\b/i,
  /\balunn[oi]\b/i,
  /\bstudenti\b/i,
  /\brappresentanti (di classe|degli studenti|dei genitori)\b/i,
  /\bconsiglio di classe\b/i,
  /\bconsiglio di istituto\b/i,
  /\bcircolare\b/i,
  /\bnewsletter\b/i,
];

/**
 * Rumore AMMINISTRATIVO. Atti che NON sono opportunità di lavoro per
 * docenti/ATA e che vengono pubblicati nell'Albo Pretorio insieme agli
 * interpelli. La loro presenza, senza segnali di opportunità, squalifica.
 *
 * Categorie:
 *   - Appalti e forniture (CIG, gare, affidamenti)
 *   - Elezioni organi collegiali
 *   - Burocrazia interna del personale (quiescenza, liquidazioni)
 *   - Contratti e convenzioni non di lavoro
 */
const ADMIN_NOISE_PATTERNS: readonly RegExp[] = [
  // --- Appalti, forniture, gare ---
  /\bCIG\b/, // case-sensitive: CIG in maiuscolo è il Codice Identificativo Gara
  /codice identificativo (di )?gara/i,
  /\bdetermina(zione)? a contrarre\b/i,
  /\bbandi? di gara\b/i,
  /\bfornitura (di |di beni|di servizi)/i,
  /\baffidamento (diretto|di servizi|di forniture)/i,
  /\bproc[eé]d(ura|ure) (di |per )?(gara|affidamento|aggiudicazione)/i,
  /\baggiudicazione (definitiva|provvisoria|di gara)/i,
  /\bcapitolato (d['’]?oneri|speciale|tecnico)/i,
  /\bgara (telematica|deserta|andata deserta)/i,
  /\bRDO\b/, // Richiesta di Offerta (MEPA)
  /\bordine (di acquisto|diretto)/i,
  /\bDUVRI\b/,
  /\bMEPA\b/,

  // --- Elezioni e governance ---
  /\belezioni?( scolastiche| degli organi|dei rappresentanti|del consiglio|delle rsu|per il rinnovo)/i,
  /\borgani collegiali\b/i,
  /\brinnovo (del )?consiglio/i,
  /\bproclamazione (degli )?eletti\b/i,
  /\binsediamento (del |degli )?(consiglio|organi)/i,
  /\bcommissione elettorale\b/i,

  // --- Burocrazia interna al personale (non reclutamento) ---
  /\bcessazioni? dal servizio\b/i,
  /\bquiescenza\b/i,
  /\bliquidazione (dei )?compensi\b/i,
  /\bcompensi MOF\b/i,
  /\bbuonuscita\b/i,
  /\btrattamento di (quiescenza|fine rapporto)\b/i,
  /\bTFR\b/,
  /\bricostruzione (di )?carriera\b/i,
  /\briscatto (ai fini|degli anni)/i,
  /\bcontratti? (collettivi|integrativi d['’]?istituto)/i, // CCNL/CCNI firmati, non bandi

  // --- Altri atti amministrativi ---
  /\bdecreto (di |del )?(nomina|approvazione|costituzione)/i,
  /\bdelibera (del consiglio|del collegio)/i,
  /\bverbale (della |del )?(seduta|riunione|consiglio)/i,
];

function countDistinctMatches(patterns: readonly RegExp[], text: string): number {
  let count = 0;
  for (const re of patterns) {
    if (re.test(text)) count++;
  }
  return count;
}

// ---------------------------------------------------------------------------
// Path scoring
// ---------------------------------------------------------------------------

interface PathScore {
  score: number;
  tags: string[];
}

const PATH_PATTERNS: ReadonlyArray<{ re: RegExp; score: number; tag: string }> = [
  // --- Segnali POSITIVI ---
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

  // --- Segnali NEGATIVI generici ---
  { re: /privacy|cookie|contatt/i, score: -5, tag: 'path_neg_legal' },
  {
    re: /login|wp-admin|wp-content|wp-json|\bfeed\b|sitemap|\brss\b/i,
    score: -10,
    tag: 'path_neg_system',
  },
  {
    re: /\.(pdf|docx?|xlsx?|pptx?|zip|rar)$/i,
    score: -10,
    tag: 'path_document',
  },
  {
    re: /\.(jpg|jpeg|png|gif|svg|webp|ico|css|js)$/i,
    score: -10,
    tag: 'path_asset',
  },

  // --- Segnali NEGATIVI di rumore generico ---
  { re: /^\/tag(\/|$)/i, score: -15, tag: 'path_neg_tag' },
  { re: /^\/categoria(\/|$)/i, score: -10, tag: 'path_neg_categoria' },
  { re: /scioper/i, score: -25, tag: 'path_neg_sciopero' },
  { re: /assemble[ae]/i, score: -20, tag: 'path_neg_assemblea' },
  { re: /elezion/i, score: -20, tag: 'path_neg_elezioni' },
  {
    re: /circolari?.{0,3}(famigli|genitori|alunni|studenti)/i,
    score: -20,
    tag: 'path_neg_circolare_famiglie',
  },
  { re: /famigli[ae]/i, score: -15, tag: 'path_neg_famiglie' },
  { re: /\/genitori\b/i, score: -15, tag: 'path_neg_genitori' },
  { re: /\bviaggi?i?.{0,3}istruzion/i, score: -15, tag: 'path_neg_viaggio' },
  { re: /\/studenti?\b/i, score: -10, tag: 'path_neg_studenti' },
  { re: /sindacal/i, score: -15, tag: 'path_neg_sindacale' },

  // --- Segnali NEGATIVI amministrativi ---
  { re: /\bcig\b/i, score: -20, tag: 'path_neg_cig' },
  { re: /\bgare?\b/i, score: -15, tag: 'path_neg_gara' },
  { re: /appalt/i, score: -15, tag: 'path_neg_appalto' },
  { re: /fornitur/i, score: -12, tag: 'path_neg_fornitura' },
  { re: /contratt/i, score: -10, tag: 'path_neg_contratto' },
  { re: /determin[ae]/i, score: -12, tag: 'path_neg_determina' },
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
// Content scoring
// ---------------------------------------------------------------------------

interface ContentScore {
  score: number;
  tags: string[];
  hasTable: boolean;
  hasPdf: boolean;
  hasCmsStructure: boolean;
  hasStrongTable: boolean;
  tableCount: number;
  contentTableCount: number;
  deadlineCount: number;
  mechCodeCount: number;
  opportunitySignals: number;
  hardNoiseSignals: number;
  softNoiseSignals: number;
  adminNoiseSignals: number;
  isEmptyView: boolean;
  disqualified: boolean;
}

function isStrongOpportunityTable(
  $: cheerio.CheerioAPI,
  tableEl: cheerio.Element
): boolean {
  const $t = $(tableEl);
  const rows = $t.find('tr');
  if (rows.length < 3) return false;

  const firstRow = rows.first();
  const cols = firstRow.find('td, th').length;
  if (cols < 3) return false;

  const headerText = firstRow.text().toLowerCase();
  const hasSemanticHeader =
    /\b(classe|scadenz|deadline|codice|provincia|settore|materia|posto|data)\b/i.test(
      headerText
    );
  if (hasSemanticHeader) return true;

  const bodyText = $t.find('td').text();
  const dateCount = (
    bodyText.match(/\b\d{1,2}[/\-.]\d{1,2}[/\-.]\d{2,4}\b/g) || []
  ).length;
  const codeCount = (bodyText.match(/\b[A-E]-?\d{2}\b/g) || []).length;

  return dateCount >= 3 || codeCount >= 2;
}

/**
 * Rileva pagine vuote o viste indice di categoria senza contenuto reale.
 * Criteri (uno solo basta):
 *   - il testo principale è troppo corto (< minMeaningfulTextLength)
 *   - contiene una delle frasi tipiche di "nessun contenuto"
 *   - contiene solo link di navigazione (rapporto link/testo alto)
 */
function isEmptyOrIndexView(
  $: cheerio.CheerioAPI,
  $scope: cheerio.Cheerio<cheerio.Element>,
  fullText: string
): boolean {
  const lower = fullText.toLowerCase();

  for (const phrase of CONFIG.emptyViewPhrases) {
    if (lower.includes(phrase)) return true;
  }

  if (fullText.length < CONFIG.minMeaningfulTextLength) {
    return true;
  }

  // Rapporto link/testo: se il contenuto è dominato da link, è una lista
  // di navigazione, non una pagina con contenuto informativo.
  const linkTextLength = $scope
    .find('a')
    .toArray()
    .reduce((acc, el) => acc + normalize($(el).text()).length, 0);
  if (fullText.length > 0 && linkTextLength / fullText.length > 0.75) {
    return true;
  }

  return false;
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

  // -------------------------------------------------------------------------
  // 1) Analisi semantica: opportunità vs tre famiglie di rumore
  // -------------------------------------------------------------------------

  const opportunitySignals = countDistinctMatches(
    OPPORTUNITY_SIGNAL_PATTERNS,
    fullText
  );
  const hardNoiseSignals = countDistinctMatches(HARD_NOISE_PATTERNS, fullText);
  const softNoiseSignals = countDistinctMatches(SOFT_NOISE_PATTERNS, fullText);
  const adminNoiseSignals = countDistinctMatches(ADMIN_NOISE_PATTERNS, fullText);

  if (opportunitySignals >= 2) {
    score += 4;
    tags.push('strong_opportunity_signals');
  } else if (opportunitySignals === 1) {
    score += 2;
    tags.push('opportunity_signal');
  }

  if (hardNoiseSignals > 0) tags.push('hard_noise_detected');
  if (softNoiseSignals >= 2) tags.push('soft_noise_detected');
  if (adminNoiseSignals > 0) tags.push('admin_noise_detected');

  // -------------------------------------------------------------------------
  // 2) Tabelle di contenuto
  // -------------------------------------------------------------------------

  const allTables = $('table');
  const tableCount = allTables.length;

  const contentTables: cheerio.Element[] = [];
  let strongTable = false;

  allTables.each((_, t) => {
    const rows = $(t).find('tr').length;
    const firstRow = $(t).find('tr').first();
    const cols = firstRow.find('td, th').length;
    if (rows < 3 || cols < 3) return;

    contentTables.push(t);
    if (!strongTable && isStrongOpportunityTable($, t)) {
      strongTable = true;
    }
  });

  const contentTableCount = contentTables.length;
  const hasTable = contentTableCount > 0;

  if (hasTable) {
    score += contentTableCount >= 2 ? 3 : 2;
    tags.push('has_content_table');
  }
  if (strongTable) {
    score += 2;
    tags.push('has_strong_table');
  }

  // -------------------------------------------------------------------------
  // 3) Scadenze (date pattern)
  // -------------------------------------------------------------------------

  const dateRe = /\b\d{1,2}[/\-.]\d{1,2}[/\-.]\d{2,4}\b/g;
  const deadlineCount = (fullText.match(dateRe) || []).length;
  if (deadlineCount >= 3) {
    score += 2;
    tags.push('many_dates');
  } else if (deadlineCount >= 1) {
    score += 1;
    tags.push('some_dates');
  }

  // -------------------------------------------------------------------------
  // 4) PDF
  // -------------------------------------------------------------------------

  const pdfLinks = $('a[href]')
    .toArray()
    .filter((el) => ($(el).attr('href') || '').toLowerCase().includes('.pdf'));
  const hasPdf = pdfLinks.length > 0;
  if (hasPdf) {
    score += pdfLinks.length >= 3 ? 2 : 1;
    tags.push('has_pdf');
  }

  // -------------------------------------------------------------------------
  // 5) Codici classe / meccanografici
  // -------------------------------------------------------------------------

  const classCodes = (fullText.match(/\b[A-E]-?\d{2}\b/g) || []).length;
  const mechCodes = extractMechCodes(fullText).size;
  if (classCodes >= 2 || mechCodes >= 2) {
    score += 2;
    tags.push('code_signals');
  } else if (classCodes >= 1 || mechCodes >= 1) {
    score += 1;
    tags.push('code_signal_weak');
  }

  // -------------------------------------------------------------------------
  // 6) Fondi speciali
  // -------------------------------------------------------------------------

  const fundKeywords = [
    'pnrr',
    'pon',
    'por',
    'clil',
    'potenziamento',
    'dispersione',
  ];
  const fundHits = fundKeywords.reduce(
    (acc, kw) => acc + (textLower.includes(kw) ? 1 : 0),
    0
  );
  if (fundHits >= 1) {
    score += 1;
    tags.push('special_funds');
  }

  // -------------------------------------------------------------------------
  // 7) Boost dal path
  // -------------------------------------------------------------------------

  const { score: pScore } = scorePath(new URL(url).pathname, '');
  if (pScore >= 8) {
    score += 2;
    tags.push('path_boost_high');
  } else if (pScore >= 5) {
    score += 1;
    tags.push('path_boost_low');
  }

  // -------------------------------------------------------------------------
  // 8) Rilevamento pagina vuota / vista indice
  // -------------------------------------------------------------------------

  const isEmptyView = isEmptyOrIndexView($, $scope, fullText);
  if (isEmptyView) {
    tags.push('empty_view_detected');
  }

  // -------------------------------------------------------------------------
  // 9) Penalità per rumore
  // -------------------------------------------------------------------------

  if (hardNoiseSignals > 0) {
    score -= hardNoiseSignals * CONFIG.hardNoisePenalty;
    tags.push(`hard_noise_penalty_x${hardNoiseSignals}`);
  }
  if (softNoiseSignals > 0) {
    score -= softNoiseSignals * CONFIG.softNoisePenalty;
    tags.push(`soft_noise_penalty_x${softNoiseSignals}`);
  }
  if (adminNoiseSignals > 0) {
    score -= adminNoiseSignals * CONFIG.adminNoisePenalty;
    tags.push(`admin_noise_penalty_x${adminNoiseSignals}`);
  }

  // -------------------------------------------------------------------------
  // 10) Regola di disqualificazione
  // -------------------------------------------------------------------------
  // Ordine di priorità:
  //   a) Admin noise senza opportunità → sempre squalificato.
  //      Un CIG o un'elezione di organi collegiali non è MAI un interpello,
  //      nemmeno se il titolo contiene "avviso" o "bando".
  //   b) Vista vuota / indice → squalificata (indipendentemente dal resto).
  //   c) Hard noise senza opportunità → squalificato.
  //   d) Soft noise diffuso senza opportunità e senza tabella forte → squalificato.
  //
  // La presenza di segnali di opportunità (opportunitySignals >= 1) NON
  // salva dalla squalifica per admin noise o per vista vuota: un bando di
  // gara può contenere "avviso" e "selezione", ma resta un bando di gara.

  let disqualified = false;

  if (adminNoiseSignals >= 1) {
    disqualified = true;
  } else if (isEmptyView) {
    disqualified = true;
  } else if (opportunitySignals === 0) {
    if (hardNoiseSignals >= 1) {
      disqualified = true;
    } else if (
      softNoiseSignals >= CONFIG.softNoiseThresholdForDisqualify &&
      !strongTable
    ) {
      disqualified = true;
    }
  }

  if (disqualified) {
    score = 0;
    tags.push('disqualified_noise');
  } else {
    score = Math.max(0, score);
  }

  return {
    score,
    tags,
    hasTable,
    hasPdf,
    hasCmsStructure: $('article').length > 0 || html.includes('wp-content'),
    hasStrongTable: strongTable,
    tableCount,
    contentTableCount,
    deadlineCount,
    mechCodeCount: mechCodes,
    opportunitySignals,
    hardNoiseSignals,
    softNoiseSignals,
    adminNoiseSignals,
    isEmptyView,
    disqualified,
  };
}

// ---------------------------------------------------------------------------
// Codici meccanografici
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
        const delay =
          CONFIG.fetchRetryBaseMs * 2 ** attempt + Math.random() * 250;
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
// Espansione
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

  const scored = scoreContentPage(target.url, result.html);

  let newStatus: string;
  if (scored.disqualified) {
    // Distinguiamo la causa per il monitoraggio:
    if (scored.adminNoiseSignals >= 1) {
      newStatus = 'disqualified_noise';
    } else if (scored.isEmptyView) {
      newStatus = 'empty_view';
    } else {
      newStatus = 'disqualified_noise';
    }
  } else if (scored.score >= CONFIG.contentScoreMinForActive) {
    newStatus = 'active_crawler';
  } else if (scored.hasPdf) {
    newStatus = 'parked_for_pdf';
  } else {
    newStatus = 'parked_low_score';
  }

  const noiseInfo: string[] = [];
  if (scored.hardNoiseSignals > 0) noiseInfo.push(`hard=${scored.hardNoiseSignals}`);
  if (scored.softNoiseSignals > 0) noiseInfo.push(`soft=${scored.softNoiseSignals}`);
  if (scored.adminNoiseSignals > 0) noiseInfo.push(`admin=${scored.adminNoiseSignals}`);
  const noiseStr = noiseInfo.length > 0 ? ` | rumore: ${noiseInfo.join(' ')}` : '';
  const emptyStr = scored.isEmptyView ? ' | VUOTA' : '';

  console.log(
    `  [d${target.depth}] score=${scored.score} stato=${newStatus}` +
      ` | opp=${scored.opportunitySignals}${noiseStr}${emptyStr} ${target.url}`
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

  // Espansione ricorsiva SOLO se la pagina è attiva e promettente per path.
  // Non espandiamo pagine squalificate o vuote: propagherebbero rumore.
  if (
    newStatus === 'active_crawler' &&
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
  let disqualifiedCount = 0;
  let emptyCount = 0;
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
      if (provinceArg && emptyRounds >= 3) break;
      if (!provinceArg) break;
      await new Promise((r) => setTimeout(r, 5_000));
      continue;
    }

    emptyRounds = 0;
    console.log(
      `[discovery-engine] Batch di ${targets.length} target (depth 0=${
        targets.filter((t) => t.depth === 0).length
      }).`
    );

    for (const t of targets) {
      try {
        await processTarget(t);
        totalProcessed++;

        // Conteggi reattivi: rifacciamo il fetch dello status appena scritto
        // sarebbe uno spreco; contiamo invece dai log dei sub-processing.
        // Qui contiamo solo per il summary finale in modo approssimativo.
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

  // Riepilogo finale: contiamo direttamente dal DB, è la fonte di verità.
  const { data: summary } = await supabase
    .from('discovered_links')
    .select('status')
    .in('status', [
      'active_crawler',
      'disqualified_noise',
      'empty_view',
      'parked_low_score',
      'parked_for_pdf',
    ]);

  if (summary) {
    const counts: Record<string, number> = {};
    for (const row of summary as Array<{ status: string }>) {
      counts[row.status] = (counts[row.status] ?? 0) + 1;
    }
    console.log('\n[discovery-engine] Riepilogo stati:');
    for (const [status, count] of Object.entries(counts)) {
      console.log(`  ${status}: ${count}`);
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