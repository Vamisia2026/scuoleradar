/**
 * ScuoleRadar.it — PREFILTRO SEMANTICO DEL RUMORE AMMINISTRATIVO (modulo PURO).
 *
 * Le fonti scolastiche pubblicano sullo stesso albo cose che NON sono
 * opportunità di lavoro: atti di gara (`CIG`, `CUP`, determine, forniture,
 * MEPA), circolari per le famiglie (viaggi, uscite, orari, organi collegiali),
 * assemblee sindacali e burocrazia del personale (`quiescenza`, `TFR`/`TFS`,
 * ricostruzione di carriera). Se entrano nel motore costano parsing, punteggi e
 * perfino righe in bacheca. Qui vive il giudizio MINIMO che le scarta subito:
 *
 *   1. **Il TITOLO è l'atto.** Un «avviso di selezione» nel corpo non trasforma
 *      una determina in un interpello (stessa regola dello scoring, §26.72).
 *   2. **Gare e previdenza sono bloccanti** (`hard: true`): un `CIG` o una
 *      `quiescenza` nel corpo scartano anche una gara B2B intitolata «avviso di
 *      selezione». Li salva solo un indicatore SPECIFICO nel titolo.
 *   3. **Il rumore di vita scolastica** (soft) si salva con un qualsiasi
 *      `RECRUITMENT_INDICATORS`: una circolare citata di sfuggita non basta.
 *
 * Un testo senza segnali NON è giudicato qui: quello è compito dello scoring a
 * valle, che conosce tabelle, scadenze e codici meccanografici.
 *
 * Invarianti: zero dipendenze; lavoro limitato a `MAX_SCAN_CHARS` caratteri con
 * regex precompilate (meno di 2 ms per voce, quindi utilizzabile PRIMA del
 * parsing); stessa verità per `discovery-engine`, `table-reporter` e guardia.
 *
 * Guardia: `npm run test:noise-filter` (incluso in `npm test`).
 */

/** Esito del pre-filtro: con `isNoise` true la voce si scarta subito. */
export interface NoiseVerdict {
  isNoise: boolean;
  /** Segnale che ha deciso, in forma leggibile (presente solo se `isNoise`). */
  reason?: string;
}

/** Segnale negativo con l'etichetta che finisce nei log e nei test. */
export interface NoisePattern {
  re: RegExp;
  reason: string;
  /**
   * Atto di gara o documento previdenziale: blocca anche in presenza di un
   * generico «avviso di selezione» nel corpo (le gare B2B si intitolano così).
   */
  hard?: boolean;
}

/**
 * Quanti caratteri si analizzano. Un documento di reclutamento dichiara il suo
 * segnale nelle prime righe; oltre questa soglia si sta leggendo una pagina
 * (indice, footer, allegati), non l'atto da giudicare.
 */
const MAX_SCAN_CHARS = 20_000;

/**
 * Segnali NEGATIVI. Sono volutamente ancorati alle forme reali degli atti:
 * niente «gara», «bando» o «selezione» da soli (sono anche parole di un
 * interpello), ma i codici e le formule che identificano un atto amministrativo.
 */
export const ADMIN_NOISE_PATTERNS: readonly NoisePattern[] = [
  // --- Appalti, forniture, finanza (bloccanti) ---
  { re: /\bCIG\b/, reason: 'CIG (codice identificativo di gara)', hard: true },
  { re: /\bcig\s*[:#]\s*[a-z0-9]/i, reason: 'CIG (codice identificativo di gara)', hard: true },
  { re: /\bCUP\b/, reason: 'CUP', hard: true },
  { re: /\bcup\s*[:#]\s*[a-z0-9]/i, reason: 'CUP', hard: true },
  {
    re: /codice\s+identificativo\s+(?:di\s+)?gara/i,
    reason: 'codice identificativo di gara',
    hard: true,
  },
  { re: /\bdetermina(?:zion[ei])?\b/i, reason: 'determina', hard: true },
  { re: /\bdeliber(?:a|e|zion[ei])\b/i, reason: 'delibera', hard: true },
  {
    re: /prospett[oi]\s+(?:di\s+)?liquidazione/i,
    reason: 'prospetto di liquidazione',
    hard: true,
  },
  { re: /\bfornitur[ae]\b/i, reason: 'fornitura', hard: true },
  { re: /\bMEPA\b/i, reason: 'MEPA', hard: true },
  {
    re: /affidamento\s+(?:diretto|di\s+servizi|di\s+forniture|del\s+servizio)/i,
    reason: 'affidamento diretto',
    hard: true,
  },

  // --- Circolari interne e vita scolastica (non reclutamento) ---
  { re: /circolar[ei].{0,40}(?:famigli|genitori|alunni|studenti)/i, reason: 'circolare per le famiglie' },
  { re: /viagg[oi].{0,12}istruzion/i, reason: "viaggio d'istruzione" },
  { re: /uscit[ae]\s+didattic/i, reason: 'uscita didattica' },
  { re: /orari[oi]\s+scolastic/i, reason: 'orario scolastico' },
  { re: /organi\s+collegiali/i, reason: 'elezione degli organi collegiali' },
  { re: /assemble[ae].{0,20}sindacal/i, reason: 'assemblea sindacale' },

  // --- Burocrazia del personale e previdenza (bloccanti) ---
  {
    re: /ricostruzione\s+(?:di\s+|della\s+)?carriera/i,
    reason: 'ricostruzione della carriera',
    hard: true,
  },
  { re: /\bquiescenza\b/i, reason: 'quiescenza', hard: true },
  {
    re: /trattamento\s+di\s+fine\s+rapporto/i,
    reason: 'trattamento di fine rapporto',
    hard: true,
  },
  { re: /\bTFR\b/, reason: 'TFR', hard: true },
  { re: /\bTFS\b/, reason: 'TFS', hard: true },
];

/**
 * Indicatori POSITIVI di reclutamento: senza almeno uno di questi una voce che
 * porta un segnale negativo non passa. Sono radici, non forme piene: le fonti
 * scrivono «interpello/interpelli», «supplenza/supplenze», «disponibilità».
 */
export const RECRUITMENT_INDICATORS: readonly RegExp[] = [
  /\binterpell/i,
  /\bsupplenz/i,
  /\bdisponibilit/i,
  /\bcandidatur/i,
  /class[ei]\s+di\s+concors/i,
  /\bMAD\b/,
  /messa\s+a\s+disposizione/i,
  /attribuzione\s+(?:di\s+)?cattedr/i,
  /post[oi]\s+vacant/i,
  /avvis[oi]\s+(?:di\s+|per\s+la\s+)?selezion/i,
];

/**
 * Sottoinsieme SPECIFICO di `RECRUITMENT_INDICATORS`, usato nel titolo per
 * salvare una pagina che cita un atto di gara: «Interpelli», «Supplenze»,
 * «Classe di concorso», «MAD». Esclude i generici («avviso di selezione»,
 * «candidatura», «disponibilità») che compaiono anche nelle gare B2B.
 */
export const STRONG_RECRUITMENT_INDICATORS: readonly RegExp[] = [
  /\binterpell/i,
  /\bsupplenz/i,
  /class[ei]\s+di\s+concors/i,
  /\bMAD\b/,
  /messa\s+a\s+disposizione/i,
  /attribuzione\s+(?:di\s+)?cattedr/i,
  /post[oi]\s+vacant/i,
];

/** Normalizza gli spazi (NBSP compresi) e limita il lavoro sul testo. */
function normalizza(testo: string | null | undefined): string {
  if (typeof testo !== 'string' || testo.length === 0) return '';
  const pulito = testo
    .replace(/[\u00a0\u2007\u202f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return pulito.length > MAX_SCAN_CHARS ? pulito.slice(0, MAX_SCAN_CHARS) : pulito;
}

/** Primo segnale negativo presente nel testo (`null` se non ce n'è). */
function primoRumore(testo: string): NoisePattern | null {
  if (!testo) return null;
  for (const pattern of ADMIN_NOISE_PATTERNS) {
    if (pattern.re.test(testo)) return pattern;
  }
  return null;
}

/** True se il testo dichiara un reclutamento possibile (indicatore positivo). */
export function hasRecruitmentIndicator(testo: string): boolean {
  const t = normalizza(testo);
  if (!t) return false;
  return RECRUITMENT_INDICATORS.some((re) => re.test(t));
}

/**
 * Decide se una voce è rumore amministrativo e va scartata PRIMA del parsing.
 *
 * Ordine dei gradini (documentato anche nell'intestazione):
 *   1. rumore nel TITOLO → sempre rumore;
 *   2. nessun rumore (né in titolo né in testo) → non giudicata qui;
 *   3. rumore bloccante nel corpo → si salva solo con un indicatore SPECIFICO
 *      nel titolo (una pagina «Interpelli» che cita un CIG resta);
 *   4. rumore soft nel corpo + qualsiasi indicatore di reclutamento → NON rumore;
 *   5. altrimenti rumore, con la sua `reason`.
 */
export function isAdministrativeNoise(text: string, title: string): NoiseVerdict {
  const testo = normalizza(text);
  const titolo = normalizza(title);

  const rumoreTitolo = primoRumore(titolo);
  if (rumoreTitolo) return { isNoise: true, reason: rumoreTitolo.reason };

  const rumoreCorpo = primoRumore(testo);
  if (!rumoreCorpo) return { isNoise: false };

  if (rumoreCorpo.hard) {
    const salvoDaTitolo = STRONG_RECRUITMENT_INDICATORS.some((re) => re.test(titolo));
    return salvoDaTitolo ? { isNoise: false } : { isNoise: true, reason: rumoreCorpo.reason };
  }

  if (hasRecruitmentIndicator(`${titolo} ${testo}`)) return { isNoise: false };
  return { isNoise: true, reason: rumoreCorpo.reason };
}
