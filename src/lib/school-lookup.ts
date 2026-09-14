export interface SchoolInfo {
  code: string;
  name: string;
  province: string;
  city: string;
  peoEmail: string;
  pecEmail?: string;
}

/**
 * Fallback and primary dictionary for known mechanical codes.
 * Can be dynamically extended or queried from DB.
 */
const KNOWN_SCHOOLS: Record<string, SchoolInfo> = {
  'BSIS02900X': {
    code: 'BSIS02900X',
    name: "I.I.S. 'L. Gigli'",
    province: 'BS',
    city: 'Rovato',
    peoEmail: 'bsis02900x@istruzione.it',
    pecEmail: 'bsis02900x@pec.istruzione.it',
  },
  'MNIC81800E': {
    code: 'MNIC81800E',
    name: 'I.C. Castiglione 1',
    province: 'MN',
    city: 'Castiglione delle Stiviere',
    peoEmail: 'mnic81800e@istruzione.it',
  },
};

/**
 * Nome REALE della scuola per codice meccanografico, SOLO se conosciuto dal
 * registro (mai nomi sintetici tipo "Istituto <codice>"): usato dalle viste
 * pubbliche che non possono mostrare placeholder.
 */
export function nomeScuolaDaCodice(code?: string | null): string | null {
  const clean = (code ?? '').toUpperCase().trim();
  if (!clean) return null;
  return KNOWN_SCHOOLS[clean]?.name?.trim() || null;
}

/**
 * Resolves full school information using the mechanical code (Codice Meccanografico).
 * If unknown, generates standard institutional email fallback (code@istruzione.it).
 */
export function resolveSchoolByCode(code: string | null): SchoolInfo | null {
  if (!code) return null;
  const cleanCode = code.toUpperCase().trim();

  // 1. Match from dictionary if registered
  if (KNOWN_SCHOOLS[cleanCode]) {
    return KNOWN_SCHOOLS[cleanCode];
  }

  // 2. Standard MIM convention fallback for all valid mechanical codes
  return {
    code: cleanCode,
    name: `Istituto ${cleanCode}`,
    province: cleanCode.substring(0, 2),
    city: 'N/D',
    peoEmail: `${cleanCode.toLowerCase()}@istruzione.it`,
    pecEmail: `${cleanCode.toLowerCase()}@pec.istruzione.it`,
  };
}