/**
 * Modulistica · Archivio — ricerca tollerante ai refusi.
 *
 * Funzioni PURE (nessun React, nessuna dipendenza): normalizzazione del testo,
 * distanza di Levenshtein, soglia di refuso e correzione dei token digitati.
 * Estratte da `EsploraArchivio.tsx`: sono la parte più delicata della ricerca e
 * ora sono verificabili in isolamento.
 */

/** Normalizza il testo per la ricerca: minuscole e senza accenti. */
export function normalizzaTesto(t: string): string {
  return t
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '');
}

/** Distanza di Levenshtein (iterativa, O(n·m)) per la tolleranza ai refusi. */
export function distanzaLevenshtein(a: string, b: string): number {
  if (a === b) return 0;
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const righe = Array.from({ length: m + 1 }, (_, i) => i);
  for (let j = 1; j <= n; j++) {
    let prec = righe[0];
    righe[0] = j;
    for (let i = 1; i <= m; i++) {
      const salva = righe[i];
      const costo = a[i - 1] === b[j - 1] ? 0 : 1;
      righe[i] = Math.min(righe[i] + 1, righe[i - 1] + 1, prec + costo);
      prec = salva;
    }
  }
  return righe[m];
}

/** Soglia di tolleranza ai refusi: 1 carattere per le parole corte, 2 per le lunghe. */
export function sogliaRefuso(token: string): number {
  return token.length <= 4 ? 1 : 2;
}

/** True se il token trova un match esatto o fuzzy (parola a distanza ≤ soglia) nel testo. */
export function matchaFuzzy(token: string, testo: string): boolean {
  if (testo.includes(token)) return true;
  const parole = testo.split(/[^a-z0-9]+/).filter((w) => w.length >= 2);
  return parole.some((parola) => distanzaLevenshtein(token, parola) <= sogliaRefuso(token));
}

/** Parola più vicina al token tra i testi dati (per il feedback "abbiamo corretto il refuso"). */
export function correggiToken(token: string, ...testi: string[]): string | null {
  let migliore: string | null = null;
  let distMigliore = Number.POSITIVE_INFINITY;
  for (const t of testi) {
    for (const parola of t.split(/[^a-z0-9]+/)) {
      if (parola.length < 2) continue;
      const d = distanzaLevenshtein(token, parola);
      if (d <= sogliaRefuso(token) && d < distMigliore) {
        distMigliore = d;
        migliore = parola;
      }
    }
  }
  return migliore;
}
