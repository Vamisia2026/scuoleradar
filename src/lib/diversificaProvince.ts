/**
 * ScuoleRadar.it — Diversità geografica della vetrina «Radar Live» (modulo puro).
 *
 * Estratto da `liveBoard.ts` (§26.76, 22/10/2026) per rispettare il limite di
 * 250 righe del gate strutturale: qui vive SOLO l'ordine delle righe, non il gate
 * che decide quali righe entrano (`preparaRigheBoard` resta in `liveBoard.ts`).
 *
 * Il tabellone non deve sembrare la classifica di una sola provincia: le righe
 * vengono raggruppate per provincia, i gruppi MESCOLATI con un seme derivato dal
 * giorno e poi alternati a giri (round-robin), così ogni schermata mostra province
 * diverse.
 */

/**
 * MESCOLAMENTO GIORNALIERO DELL'ORDINE DELLE PROVINCE (§26.72, 15/10/2026).
 *
 * L'alternanza a giri da sola non basta: l'ordine dei gruppi seguiva l'ordine di
 * arrivo della query, quindi le prime schermate mostravano sempre le stesse
 * province e il tabellone sembrava fermo. Qui l'ordine dei gruppi viene mescolato
 * con un SEME derivato dal giorno:
 *   · STABILE per tutta la giornata — due richieste dello stesso giorno danno lo
 *     stesso tabellone (la paginazione non cambia sotto il dito dell'utente);
 *   · DIVERSO domani — in pochi giorni il tabellone ruota su tutta l'Italia;
 *   · deterministico e senza dipendenze: stessa data ⇒ stesso ordine (testabile).
 * Dentro ogni provincia l'ordine di arrivo resta INTATTO (cronologia decrescente).
 */
function semeDelGiorno(oggi: Date): number {
  const chiave = `${oggi.getFullYear()}-${oggi.getMonth() + 1}-${oggi.getDate()}`;
  let hash = 2166136261;
  for (let i = 0; i < chiave.length; i += 1) {
    hash ^= chiave.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

/** Fisher-Yates deterministico (mai in loco): stesso seme ⇒ stesso ordine. */
function mescolaConSeme<T>(valori: T[], seme: number): T[] {
  const copia = [...valori];
  let stato = seme;
  const prossimo = (): number => {
    stato = (stato + 0x6d2b79f5) >>> 0;
    let t = stato;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  for (let i = copia.length - 1; i > 0; i -= 1) {
    const j = Math.floor(prossimo() * (i + 1));
    const scambio = copia[i];
    copia[i] = copia[j];
    copia[j] = scambio;
  }
  return copia;
}

/**
 * Diversità geografica: nessuna provincia monopolizza le prime pagine. I gruppi
 * (uno per provincia) vengono MESCOLATI con il seme del giorno e poi alternati a
 * giri (round-robin). `oggi` è iniettabile: i test fissano il giorno e ottengono
 * un ordine stabile; in produzione l'ordine ruota ogni giorno.
 */
export function diversificaProvince<T extends { riga: { province?: string } }>(
  righe: T[] | null | undefined,
  oggi: Date = new Date(),
): T[] {
  const elenco = righe ?? [];
  const perProvincia = new Map<string, T[]>();
  for (const riga of elenco) {
    const chiave = (riga.riga.province ?? '').trim().toUpperCase();
    const gruppo = perProvincia.get(chiave);
    if (gruppo) gruppo.push(riga);
    else perProvincia.set(chiave, [riga]);
  }

  const gruppi = mescolaConSeme([...perProvincia.values()], semeDelGiorno(oggi));
  const alternate: T[] = [];
  for (let giro = 0; alternate.length < elenco.length; giro += 1) {
    let aggiunteNelGiro = 0;
    for (const gruppo of gruppi) {
      const riga = gruppo[giro];
      if (!riga) continue;
      alternate.push(riga);
      aggiunteNelGiro += 1;
    }
    if (aggiunteNelGiro === 0) break;
  }
  return alternate;
}
