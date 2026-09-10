/**
 * ScuoleRadar.it — Dipartimento CFU · engine/ssdTaxonomy.
 *
 * TASSONOMIA SSD — PREFIX WILDCARD MATCHING.
 *
 * Le righe ufficiali delle Tabelle A/B citano i settori in due forme:
 *  1. codice SSD esatto:       es. "L-LIN/01", "L-FIL-LET/04";
 *  2. prefisso macro di area:  es. "L-FIL-LET/", "L-ANT/", "M-STO/" — cioè
 *     OGNI settore scientifico-disciplinare il cui codice inizia col prefisso.
 *
 * Per eliminare ogni enumerazione arbitraria dai VincoloCfu, un requisito che
 * termina con "/" è interpretato dal solver come PREFIX PATTERN sulla tassonomia
 * CUN: nessun elenco manuale di sottocodici (L-FIL-LET/01 … L-FIL-LET/15) è
 * ammesso nella regola — il match è risolto dinamicamente qui sotto.
 *
 * La registrazione qui presente è il sotto-insieme dei macro-prefissi citati
 * dalle fonti ingerite nell'engine (DM 22/12/2023, Tabella A e successive) ed è
 * allineata alla ripartizione per area CUN dei settori scientifico-disciplinari.
 */
export interface VocePrefissoMacroSsd {
  /** Pattern canonico: termine con "/" (es. "L-FIL-LET/"). */
  prefisso: string;
  /** Area CUN di riferimento quando univocamente nota (es. 10, 11). */
  areaCun?: string;
  /** Denominazione descrittiva dell'area (documentazione, mai testo di legge). */
  descrizione: string;
}

/**
 * Registro dei prefissi macro SSD riconosciuti (CUN). I pattern usati nei
 * VincoloCfu DEVONO comparire qui (Source Gate strutturale nel solver).
 */
export const TASSONOMIA_PREFISSI_SSD_CUN: readonly VocePrefissoMacroSsd[] = [
  {
    prefisso: 'L-FIL-LET/',
    areaCun: '10',
    descrizione:
      'Filologie e letterature (es. L-FIL-LET/01 … L-FIL-LET/15: letterature, filologia, linguistica italiana).',
  },
  {
    prefisso: 'L-ANT/',
    areaCun: '10',
    descrizione:
      'Scienze dell\u2019antichità (storia antica, archeologia e storia dell\u2019arte greca e romana).',
  },
  {
    prefisso: 'M-STO/',
    areaCun: '11',
    descrizione:
      'Scienze storiche (storia medievale, moderna, contemporanea, e altre).',
  },
  {
    prefisso: 'L-LIN/',
    areaCun: '10',
    descrizione:
      'Lingue, letterature e glottologia (es. L-LIN/01 Glottologia e linguistica).',
  },
  {
    prefisso: 'M-GGR/',
    areaCun: '11',
    descrizione:
      'Geografia (es. M-GGR/01 Geografia, M-GGR/02 Geografia economico-politica); ambito storico-geografico.',
  },
];

const RE_CODICE_SSD = /^[A-Z]{1,2}(?:-[A-Z]{2,5})+\/\d{2}$/;
const RE_PREFISSO_MACRO = /^[A-Z]{1,2}(?:-[A-Z]{2,5})+\/$/;

/** True se il requisito è un PREFIX PATTERN di macro-settore (termina con "/"). */
export function ePrefissoMacroSsd(requisito: string): boolean {
  return RE_PREFISSO_MACRO.test(requisito);
}

/** True se il requisito è un codice SSD esatto nella forma canonica (es. "L-LIN/01"). */
export function eCodiceSsdValido(requisito: string): boolean {
  return RE_CODICE_SSD.test(requisito);
}

/**
 * True se il requisito è valido: codice esatto oppure prefisso macro REGISTRATO
 * nella tassonomia CUN (i pattern liberi non sono mai ammessi).
 */
export function eRequisitoSsdValido(requisito: string): boolean {
  if (eCodiceSsdValido(requisito)) return true;
  if (!ePrefissoMacroSsd(requisito)) return false;
  return TASSONOMIA_PREFISSI_SSD_CUN.some((voce) => voce.prefisso === requisito);
}

/**
 * Verifica se il requisito (codice esatto O prefisso macro) copre un codice SSD
 * concreto di un esame. Esempi:
 *  - requisitoSsdCopre('L-FIL-LET/', 'L-FIL-LET/09')  → true  (prefix wildcard);
 *  - requisitoSsdCopre('L-LIN/01', 'L-LIN/01')        → true  (codice esatto);
 *  - requisitoSsdCopre('L-LIN/01', 'L-LIN/02')        → false.
 */
export function requisitoSsdCopre(requisito: string, codiceSsd: string): boolean {
  if (ePrefissoMacroSsd(requisito)) {
    return codiceSsd.startsWith(requisito);
  }
  return requisito === codiceSsd;
}
