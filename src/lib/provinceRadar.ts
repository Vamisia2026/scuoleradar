/**
 * ScuoleRadar.it — Provincia PRINCIPALE del Radar (fonte condivisa UI).
 *
 * La provincia principale è la PRIMA che l'utente seleziona (wizard o preferenze):
 * è la sua zona di riferimento e il Radar le dà priorità nella presentazione degli
 * avvisi. Le altre restano "province di contorno" (secondarie).
 *
 * Qui vivono solo le regole di ordine: nessun accesso a stato, rete o localStorage.
 * L'ordine dell'array `provinceCodici` è la fonte di verità (persistita su
 * `profiles.province` e in `sr_preferenze`), quindi la principale è sempre
 * l'elemento in posizione 0.
 */

/** Codice della provincia principale (la prima selezionata), oppure null. */
export function provinciaPrincipale(provinceCodici: readonly string[] | undefined): string | null {
  const codici = Array.isArray(provinceCodici) ? provinceCodici : [];
  return codici.length > 0 ? codici[0] : null;
}

/** true se `codice` è la provincia principale della selezione. */
export function eProvinciaPrincipale(
  provinceCodici: readonly string[] | undefined,
  codice: string,
): boolean {
  return provinciaPrincipale(provinceCodici) === codice;
}

/** Province "di contorno": tutte tranne la principale (ordine conservato). */
export function provinceDiContorno(provinceCodici: readonly string[] | undefined): string[] {
  const codici = Array.isArray(provinceCodici) ? provinceCodici : [];
  return codici.slice(1);
}

/**
 * Tronca la selezione al tetto del piano MANTENENDO SEMPRE LA PRINCIPALE.
 *
 * La provincia principale è la prima dell'elenco (vedi `provinciaPrincipale`):
 * questa funzione rende ESPLICITO l'invariante usato dai downgrade — se il piano
 * torna Base (1 provincia) resta attiva la zona di riferimento dell'utente, mai
 * una provincia «di contorno» scelta dopo. L'ordine delle altre è conservato.
 */
export function limitaProvinceMantenendoPrincipale(
  provinceCodici: readonly string[] | undefined,
  max: number,
): string[] {
  const codici = Array.isArray(provinceCodici) ? [...provinceCodici] : [];
  const tetto = Math.max(0, Math.trunc(max));
  if (tetto === 0) return [];
  if (codici.length <= tetto) return codici;
  const principale = codici[0];
  return [principale, ...codici.slice(1, tetto)];
}

/**
 * Promuove `codice` a provincia principale (lo porta in testa) conservando
 * l'ordine delle altre. Idempotente e tollerante a codici assenti: se il codice
 * non è nella selezione la lista torna invariata.
 */
export function promuoviProvinciaPrincipale(
  provinceCodici: readonly string[] | undefined,
  codice: string,
): string[] {
  const codici = Array.isArray(provinceCodici) ? [...provinceCodici] : [];
  const indice = codici.indexOf(codice);
  if (indice <= 0) return codici;
  codici.splice(indice, 1);
  codici.unshift(codice);
  return codici;
}
