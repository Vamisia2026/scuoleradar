/**
 * ScuoleRadar.it — PREFILTRO SEMANTICO DEL RUMORE AMMINISTRATIVO (modulo PURO).
 *
 * L'albo scolastico pubblica anche ciò che NON è un'opportunità di lavoro. Qui
 * vive il giudizio MINIMO che lo scarta prima del parsing:
 *
 *   1. **Il TITOLO è l'atto.** Un «avviso di selezione» nel corpo non trasforma
 *      una determina in un interpello (stessa regola dello scoring, §26.72).
 *   2. **Gare e previdenza sono bloccanti** (`hard`): `CIG`, `CUP`, determine,
 *      forniture, MEPA, quiescenza, TFR/TFS scartano anche una gara B2B
 *      intitolata «avviso di selezione»; li salva solo un indicatore SPECIFICO
 *      nel titolo.
 *   3. **Il rumore di vita scolastica** (soft: circolari, viaggi, orari,
 *      assemblee) si salva con un qualsiasi `RECRUITMENT_INDICATORS`.
 *   4. **Le pagine informative non sono avvisi** (§26.82): «scuola in ospedale»,
 *      «formazione scuola-lavoro», «PCTO», «corsi di formazione», «progetti» e
 *      gli elenchi statici di scuole restano fuori a meno che il TITOLO dichiari
 *      un reclutamento specifico **e** il testo dica ENTRO QUANDO candidarsi.
 *      Una pagina che parla di un progetto non è un bando solo perché il menu
 *      del sito contiene la parola «interpelli».
 *
 * Un testo senza segnali NON è giudicato qui: decide lo scoring a valle. Zero
 * dipendenze ESTERNE: le regex viaggiano in due moduli sorelli puri — i tipi
 * (`noiseFilterTipi.ts`) e la vita sindacale (`noiseFilterSindacale.ts`, §26.91)
 * — così questo file resta sotto la soglia di attenzione dei 250 righe
 * (`npm run test:architettura`). Regex precompilate, lavoro limitato a
 * `MAX_SCAN_CHARS`: la stessa verità per `discovery-engine`, `table-reporter`,
 * ingestion e guardia (`npm run test:noise-filter`, in `npm test`).
 */
import { PATTERN_VITA_SINDACALE } from './noiseFilterSindacale.ts';
import type { NoisePattern, NoiseVerdict } from './noiseFilterTipi.ts';

/** I tipi restano importabili da qui: la superficie pubblica non cambia. */
export type { NoisePattern, NoiseVerdict } from './noiseFilterTipi.ts';

/** Quanti caratteri si analizzano: oltre, si legge una pagina, non l'atto. */
const MAX_SCAN_CHARS = 20_000;

/**
 * Segnali NEGATIVI ancorati alle forme reali degli atti: niente «gara», «bando»
 * o «selezione» da soli (sono anche parole di un interpello).
 */
export const ADMIN_NOISE_PATTERNS: readonly NoisePattern[] = [
  // --- Appalti, forniture, finanza (bloccanti) ---
  { re: /\bCIG\b/, reason: 'CIG (codice identificativo di gara)', hard: true },
  { re: /\bcig\s*[:#]\s*[a-z0-9]/i, reason: 'CIG (codice identificativo di gara)', hard: true },
  { re: /\bCUP\b/, reason: 'CUP', hard: true },
  { re: /\bcup\s*[:#]\s*[a-z0-9]/i, reason: 'CUP', hard: true },
  { re: /codice\s+identificativo\s+(?:di\s+)?gara/i, reason: 'codice identificativo di gara', hard: true },
  { re: /\bdetermina(?:zion[ei])?\b/i, reason: 'determina', hard: true },
  { re: /\bdeliber(?:a|e|zion[ei])\b/i, reason: 'delibera', hard: true },
  { re: /prospett[oi]\s+(?:di\s+)?liquidazione/i, reason: 'prospetto di liquidazione', hard: true },
  { re: /\bfornitur[ae]\b/i, reason: 'fornitura', hard: true },
  { re: /\bMEPA\b/i, reason: 'MEPA', hard: true },
  { re: /affidamento\s+(?:diretto|di\s+servizi|di\s+forniture|del\s+servizio)/i, reason: 'affidamento diretto', hard: true },

  // --- Circolari interne e vita scolastica (non reclutamento) ---
  { re: /circolar[ei].{0,40}(?:famigli|genitori|alunni|studenti)/i, reason: 'circolare per le famiglie' },
  { re: /viagg[oi].{0,12}istruzion/i, reason: "viaggio d'istruzione" },
  { re: /uscit[ae]\s+didattic/i, reason: 'uscita didattica' },
  { re: /orari[oi]\s+scolastic/i, reason: 'orario scolastico' },
  { re: /organi\s+collegiali/i, reason: 'elezione degli organi collegiali' },

  // --- Vita sindacale (§26.91) — regole in `noiseFilterSindacale.ts` ---
  // SOFT: un interpello che descrive l'assemblea di domani si salva con
  // l'indicatore di reclutamento; un titolo di sciopero non ne ha e cade subito.
  ...PATTERN_VITA_SINDACALE,

  // --- Burocrazia del personale e previdenza (bloccanti) ---
  { re: /ricostruzione\s+(?:di\s+|della\s+)?carriera/i, reason: 'ricostruzione della carriera', hard: true },
  { re: /\bquiescenza\b/i, reason: 'quiescenza', hard: true },
  { re: /trattamento\s+di\s+fine\s+rapporto/i, reason: 'trattamento di fine rapporto', hard: true },
  { re: /\bTFR\b/, reason: 'TFR', hard: true },
  { re: /\bTFS\b/, reason: 'TFS', hard: true },

  // --- Contenuto INFORMATIVO/ISTITUZIONALE (§26.82) ---
  // Non sono atti amministrativi ma PAGINE che parlano di scuola: restano SOLO
  // con un titolo di reclutamento SPECIFICO e una finestra di candidatura nel
  // testo (`haFinestraCandidatura`). Senza finestra non si ingerisce.
  { re: /\bscuol[ae]\s+in\s+ospedale\b/i, reason: 'progetto «scuola in ospedale»', informativa: true },
  { re: /\bformazione\s+scuola[\s-]+lavoro\b/i, reason: 'formazione scuola-lavoro', informativa: true },
  { re: /\bPCTO\b/i, reason: 'PCTO', informativa: true },
  { re: /\balternanza\s+scuola[\s-]*lavoro\b/i, reason: 'alternanza scuola-lavoro', informativa: true },
  {
    re: /\bcorsi?\s+(?:di\s+)?(?:formazione|aggiornamento|recupero|extracurricolar\w*|pomeridiani)\b/i,
    reason: 'corso di formazione',
    informativa: true,
  },
  // PNRR/PON restano FUORI: il reclutamento di tutor/esperti su progetto PNRR è
  // una categoria AMMESSA (`CATEGORIE_AMMESSE`), non una pagina informativa.
  {
    re: /\bprogetti\s+(?:europei|extracurricolar\w*|di\s+istituto|di\s+ampliamento|d'istituto)\b/i,
    reason: 'progetto didattico',
    informativa: true,
  },
  {
    re: /\bpercorsi\s+(?:di\s+)?(?:orientamento|competenze\s+trasversali)\b/i,
    reason: 'percorso di orientamento',
    informativa: true,
  },
  // Indirizzari statici (USP Rieti, «Ravenna Dante» e simili): nessun bando.
  {
    re: /\belenco\s+(?:delle\s+|dei\s+|degli\s+)?(?:scuole|istituti|plessi)\b/i,
    reason: 'elenco statico di scuole/istituti',
    informativa: true,
  },
  {
    re: /\b(?:mappa\s+del\s+sito|indice\s+dei\s+contenuti|siti\s+web\s+delle\s+scuole)\b/i,
    reason: 'indice/mappa del sito',
    informativa: true,
  },
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

/**
 * Finestra di CANDIDATURA dichiarata («entro il 30/10/2026», «entro e non oltre
 * il 05/11/2026», «termine di presentazione delle domande», «domanda entro 10
 * giorni»): è l'unica prova che una pagina informativa contenga un bando vero e
 * non il racconto di un'attività già in corso (§26.82).
 */
const FINESTRA_CANDIDATURA: readonly RegExp[] = [
  /\bentro\s+(?:e\s+non\s+oltre\s+)?(?:il|le)\s+\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4}/i,
  /\bnon\s+oltre\s+(?:il|le)\s+\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4}/i,
  /\bentro\s+\d{1,2}\s+giorni\b/i,
  /\btermine\s+(?:ultimo\s+)?(?:per\s+la\s+)?presentazione\b/i,
  /\bpresentazione\s+(?:delle\s+)?(?:domande|candidature|manifestazioni\s+di\s+interesse)\b/i,
  /\bscadenza\s+(?:delle\s+|dei\s+)?(?:domande|candidature|termini)\b/i,
  /\bdomand[ae]\s+(?:entro|non\s+oltre)\b/i,
];

/** True se il testo dichiara ENTRO QUANDO presentare domanda. */
export function haFinestraCandidatura(testo?: string | null): boolean {
  const t = normalizza(testo);
  if (!t) return false;
  return FINESTRA_CANDIDATURA.some((re) => re.test(t));
}

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
 * Decide se una voce è rumore amministrativo e va scartata PRIMA del parsing:
 *   1. rumore nel TITOLO (atto amministrativo) → sempre rumore;
 *   2. nessun rumore (né in titolo né in testo) → non giudicata qui;
 *   3. pagina INFORMATIVA → resta SOLO con titolo di reclutamento SPECIFICO **e**
 *      finestra di candidatura (prima bastava «interpello» nel menu del sito);
 *   4. rumore bloccante nel corpo → salvo solo con un indicatore SPECIFICO nel
 *      titolo (una pagina «Interpelli» che cita un CIG resta);
 *   5. rumore soft + qualsiasi indicatore di reclutamento → NON rumore;
 *   6. altrimenti rumore, con la sua `reason`.
 */
export function isAdministrativeNoise(text: string, title: string): NoiseVerdict {
  const testo = normalizza(text);
  const titolo = normalizza(title);

  const rumoreTitolo = primoRumore(titolo);
  // Un atto amministrativo nel TITOLO è sempre rumore. Un segnale INFORMATIVO nel
  // titolo no: «Interpello … progetto PCTO» è un bando vero, e lo decide il
  // gradino 3 con la finestra di candidatura.
  if (rumoreTitolo && !rumoreTitolo.informativa) {
    return { isNoise: true, reason: rumoreTitolo.reason };
  }

  const rumoreCorpo = rumoreTitolo ?? primoRumore(testo);
  if (!rumoreCorpo) return { isNoise: false };

  if (rumoreCorpo.informativa) {
    const bandoNelTitolo = STRONG_RECRUITMENT_INDICATORS.some((re) => re.test(titolo));
    const finestra = haFinestraCandidatura(`${titolo} ${testo}`);
    return bandoNelTitolo && finestra
      ? { isNoise: false }
      : {
          isNoise: true,
          reason: `${rumoreCorpo.reason} (pagina informativa senza finestra di candidatura)`,
        };
  }

  if (rumoreCorpo.hard) {
    const salvoDaTitolo = STRONG_RECRUITMENT_INDICATORS.some((re) => re.test(titolo));
    return salvoDaTitolo ? { isNoise: false } : { isNoise: true, reason: rumoreCorpo.reason };
  }

  if (hasRecruitmentIndicator(`${titolo} ${testo}`)) return { isNoise: false };
  return { isNoise: true, reason: rumoreCorpo.reason };
}
