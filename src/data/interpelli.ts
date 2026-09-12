/**
 * ScuoleRadar — Feed Interpelli: tipo condiviso + fallback VUOTO.
 *
 * ⚠️ POLICY DATI (strict validation): in questo modulo NON sono ammessi dati
 * mock/demo né URL segnaposto (es. `esempio-N`, `example.com`, `localhost`,
 * fixture/dummy). Il feed mostrato in app proviene SOLO da fonti verificate:
 *   1. tabella `interpelli` (Matching Engine — `src/lib/matchingEngine.ts`);
 *   2. fallback sulla tabella legacy `notices` (popolata dallo scraper);
 *   3. se non c'è nessun avviso attivo → feed VUOTO (stato vuoto in UI).
 *
 * Gli avvisi con titoli o URL fittizi vengono scartati a monte dalla pipeline di
 * ingestione (`src/scraper/parser.ts` → `verificaAvviso`, `eSorgenteVerificata`)
 * e non entrano mai nel database.
 *
 * Guard test: `npm run test:dati-fallback`.
 */

import type { OrdineScuola } from './ordiniMaterie';

export interface Interpello {
  id: string;
  titolo: string;
  istituto: string;
  provinciaCodice: string;
  provinciaNome: string;
  classeCodice: string;
  /** Tutti i codici di classe rilevati (popolato dai dati reali di `notices`) */
  classiCodes?: string[];
  /** Materia/settore dell'avviso (dal testo) o nome ufficiale della classe, se disponibile. */
  materia?: string | null;
  ordine: OrdineScuola;
  dataScadenza: string; // ISO date
  descrizione: string;
  linkFonte: string;
  /** Email di candidatura della scuola (PEC/istituzionale), se disponibile. */
  contactEmail?: string | null;
  compatibilita: number; // 0-100
}

/**
 * Fallback INTENZIONALMENTE VUOTO: nessun interpello dimostrativo.
 *
 * È il valore iniziale/stato vuoto del feed finché il Matching Engine non
 * restituisce dati reali (`getFeedInterpelli` → tabella `interpelli`, poi
 * `notices`). Se non c'è nulla da mostrare la UI espone uno stato vuoto, mai
 * contenuti finti o con link segnaposto.
 */
export const interpelli: Interpello[] = [];
