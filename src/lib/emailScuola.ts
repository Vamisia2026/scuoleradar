/**
 * ScuoleRadar.it — Email UFFICIALE della scuola (PEO/PEC) — modulo puro.
 *
 * Regola di servizio: un avviso di reclutamento senza un recapito a cui
 * candidarsi è un servizio incompleto. Quando la fonte non pubblica l'email,
 * questa viene ricostruita dalla CONVENZIONE UFFICIALE del Ministero, che lega
 * il CODICE MECCANOGRAFICO della scuola alle caselle istituzionali:
 *
 *   · PEO (posta ordinaria, uso candidature) → codice@istruzione.it
 *   · PEC (posta certificata, atti formali)  → codice@pec.istruzione.it
 *
 * Se il codice non è dichiarato dal testo, si prova a ricavarlo dai recapiti
 * già trovati o dal contesto (`normalizzaCodiceMeccanografico`). Nessuna email
 * viene mai inventata fuori da questa convenzione.
 */

/** Formato ufficiale del codice meccanografico (es. "ASTF01000X", "BSIS02900X"). */
const RE_CODICE_MECCANOGRAFICO = /\b([A-Z]{2}[A-Z]{2}\d{5}[A-Z0-9])\b/;

/** Domini di posta NON istituzionali: mai usati come recapito ufficiale generico. */
const DOMINI_NON_ISTITUZIONALI =
  /@(?:gmail|googlemail|libero|virgilio|alice|tin|hotmail|outlook|live|yahoo|icloud|protonmail|tiscali|fastwebnet|scuoleradar)\./i;

export interface EmailUfficialeScuola {
  email: string;
  /** PEO = posta ordinaria (candidature) · PEC = posta certificata. */
  tipo: 'peo' | 'pec';
  /** Come è stata risolta: dal testo della fonte o dalla convenzione MIM. */
  fonte: 'fonte' | 'codice';
}

/** Convalida/normalizza un codice meccanografico (maiuscolo, senza spazi). */
export function normalizzaCodiceMeccanografico(valore?: string | null): string | null {
  const pulito = (valore ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (!pulito) return null;
  return /^[A-Z]{2}[A-Z]{2}\d{5}[A-Z0-9]$/.test(pulito) ? pulito : null;
}

/** Estrae il codice meccanografico dal testo della fonte (best-effort). */
export function estraiCodiceMeccanograficoDaTesto(testo?: string | null): string | null {
  const t = (testo ?? '').toUpperCase();
  const m = t.match(RE_CODICE_MECCANOGRAFICO);
  return m ? normalizzaCodiceMeccanografico(m[1]) : null;
}

/** PEO e PEC ufficiali del codice meccanografico (convenzione MIM). */
export function emailDaCodiceMeccanografico(codice: string): { peo: string; pec: string } | null {
  const c = normalizzaCodiceMeccanografico(codice);
  if (!c) return null;
  const base = c.toLowerCase();
  return { peo: `${base}@istruzione.it`, pec: `${base}@pec.istruzione.it` };
}

/**
 * Risolve il recapito ufficiale di candidatura:
 *   1. un'email ISTITUZIONALE già trovata nel testo (la più affidabile);
 *   2. altrimenti la PEO/PEC ricostruita dal codice meccanografico.
 * Ritorna `null` quando non c'è alcun appiglio reale (nessuna email inventata).
 */
export function risolviEmailUfficialeScuola(opts: {
  /** Email candidate raccolte dalla fonte (pagina/PDF/allegati). */
  emailsTrovate?: string[];
  /** Codice meccanografico della scuola, se già noto. */
  schoolCode?: string | null;
  /** Testo della fonte: usato per recuperare il codice meccanografico. */
  testo?: string | null;
  /** true → preferisci la PEC (atti formali) invece della PEO. */
  preferisciPec?: boolean;
}): EmailUfficialeScuola | null {
  const trovate = (opts.emailsTrovate ?? [])
    .map((e) => (e ?? '').trim().toLowerCase())
    .filter((e) => e.includes('@') && !DOMINI_NON_ISTITUZIONALI.test(e));
  if (trovate.length > 0) {
    const pec = trovate.find((e) => e.includes('@pec.'));
    const scelta = opts.preferisciPec && pec ? pec : (trovate.find((e) => !e.includes('@pec.')) ?? trovate[0]);
    return {
      email: scelta,
      tipo: scelta.includes('@pec.') ? 'pec' : 'peo',
      fonte: 'fonte',
    };
  }

  const codice =
    normalizzaCodiceMeccanografico(opts.schoolCode) ??
    estraiCodiceMeccanograficoDaTesto(opts.testo);
  if (!codice) return null;
  const caselle = emailDaCodiceMeccanografico(codice);
  if (!caselle) return null;
  return opts.preferisciPec
    ? { email: caselle.pec, tipo: 'pec', fonte: 'codice' }
    : { email: caselle.peo, tipo: 'peo', fonte: 'codice' };
}
