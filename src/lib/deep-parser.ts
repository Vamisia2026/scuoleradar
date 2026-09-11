export interface DeepParsedInterpello {
  schoolName: string | null;
  schoolCode: string | null; // Codice Meccanografico (es. BSIS02900X)
  deadline: string | null;   // ISO Date String or YYYY-MM-DD HH:mm
  contactEmail: string | null;
  subjectCode: string | null; // Classe di concorso / A040 / ADAA etc.
}

/**
 * Regex for Italian School Mechanical Codes (Codice Meccanografico)
 * Es. BSIS02900X, BGIC812008, TVEE010001
 */
const MECHANICAL_CODE_REGEX = /\b([A-Z]{2}[A-Z0-9]{4}\d{3}[A-Z0-9])\b/i;

/**
 * Regex for Italian School emails (PEO / PEC / EDU)
 */
const EMAIL_REGEX = /\b[A-Za-z0-9._%+-]+@(istruzione\.it|pec\.istruzione\.it|[a-zA-Z0-9.-]+\.edu\.it)\b/gi;

/**
 * Regex for explicit application deadlines in Italian text
 */
const DEADLINE_REGEX = /(?:entro\s+e\s+non\s+oltre\s+|entro\s+il\s+|scadenza\s*:?\s*|entro\s+le\s+ore\s+\d{1,2}[:.]\d{2}\s+del\s+)(\d{1,2}[\/\.-]\d{1,2}[\/\.-]\d{2,4})/i;

/**
 * Extracts enriched metadata from full page text/HTML of an interpello.
 */
export function parseDeepInterpelloContent(rawText: string): DeepParsedInterpello {
  if (!rawText) {
    return {
      schoolName: null,
      schoolCode: null,
      deadline: null,
      contactEmail: null,
      subjectCode: null,
    };
  }

  // 1. Extract Mechanical Code (Codice Meccanografico)
  const codeMatch = rawText.match(MECHANICAL_CODE_REGEX);
  const schoolCode = codeMatch ? codeMatch[1].toUpperCase() : null;

  // 2. Extract Emails
  const emailMatches = rawText.match(EMAIL_REGEX);
  const contactEmail = emailMatches && emailMatches.length > 0 ? emailMatches[0].toLowerCase() : null;

  // 3. Extract Deadline Date
  const deadlineMatch = rawText.match(DEADLINE_REGEX);
  let deadline: string | null = null;
  if (deadlineMatch && deadlineMatch[1]) {
    const rawDate = deadlineMatch[1].replace(/\./g, '/').replace(/-/g, '/');
    const parts = rawDate.split('/');
    if (parts.length === 3) {
      const day = parts[0].padStart(2, '0');
      const month = parts[1].padStart(2, '0');
      let year = parts[2];
      if (year.length === 2) year = `20${year}`;
      deadline = `${year}-${month}-${day}`;
    }
  }

  return {
    schoolName: null,
    schoolCode,
    deadline,
    contactEmail,
    subjectCode: null,
  };
}