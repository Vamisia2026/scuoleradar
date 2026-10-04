/**
 * ScuoleRadar.it — Registro MINIMO delle scuole per codice meccanografico.
 *
 * Contiene SOLO istituti reali registrati a mano (con denominazione, provincia,
 * città, PEO e PEC): serve alle viste pubbliche che non possono mostrare
 * placeholder e — per il codice meccanografico — a `nomeScuolaDaCodice`.
 *
 * ⚠️ POLICY DATI (direttiva 04/10/2026, §26.47 — bonifica dei mock): qui NON si
 * inventa nulla. Un codice meccanografico SCONOSCIUTO non produce un nome
 * sintetico («Istituto <codice>») né una città segnaposto («N/D»): `null` è la
 * risposta corretta e chi chiama prosegue con il dato grezzo della fonte o con la
 * dicitura gestita della vetrina. Il recapito ufficiale, quando serve, nasce
 * dalla convenzione MIM su codice (`risolviEmailUfficialeScuola` in
 * `lib/emailScuola.ts`), MAI da un nome costruito.
 *
 * Verificato da `npm run test:pipeline` (`scripts/test-pipeline-tollerante.ts`).
 */
export interface SchoolInfo {
  code: string;
  name: string;
  province: string;
  city: string;
  peoEmail: string;
  pecEmail?: string;
}

/** Istituti REALI verificati a mano (denominazione, recapiti ufficiali). */
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
 * Istituto registrato a mano per codice meccanografico, altrimenti `null`.
 * Sostituisce il vecchio `resolveSchoolByCode`, che per QUALSIASI codice
 * costruiva un nome fittizio («Istituto <codice>») e una città «N/D»: dati
 * inventati, esattamente ciò che la direttiva 04/10/2026 vieta.
 */
export function scuolaDaCodice(code?: string | null): SchoolInfo | null {
  const clean = (code ?? '').toUpperCase().trim();
  if (!clean) return null;
  return KNOWN_SCHOOLS[clean] ?? null;
}
