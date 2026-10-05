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
  /**
   * Data di PUBBLICAZIONE dichiarata dalla fonte/`created_at` (ISO). Serve alla
   * finestra dei 60 giorni: un avviso che la fonte NON data resta pubblico solo se
   * pubblicato di recente (`eAvvisoVivo`, `src/lib/scadenza.ts`).
   */
  dataPubblicazione?: string | null;
  descrizione: string;
  linkFonte: string;
  /** Email di candidatura della scuola (PEC/istituzionale), se disponibile. */
  contactEmail?: string | null;
  /**
   * Stato dell'anagrafica della scuola (`completo` | `parziale`): quando è
   * `parziale` (o assente) l'interfaccia dichiara gentilmente «anagrafica in
   * aggiornamento» — l'avviso resta comunque SEMPRE visibile e notificabile.
   */
  statoArricchimento?: 'completo' | 'parziale' | null;
  /**
   * PUNTEGGIO di compatibilità col profilo (0-100): le soglie della banda
   * cromatica vivono in `src/lib/compatibilita.ts` (🟢 ≥ 80 · 🟠 ≥ 70 · 🔴 ≥ 60),
   * il numero lo produce `punteggioCompatibilita` (matching engine) e lo applica
   * il feed della dashboard (`useInterpelliFeed`). Dal mapper del DB arriva a
   * `100` come valore neutro, poi il feed lo sostituisce con quello reale.
   */
  compatibilita: number;
  /**
   * SCOSTAMENTO riconosciuto dalla bacheca (`valutaCompatibilita`,
   * `src/lib/compatibilitaGraduata.ts`): lingua affine, area affine, provincia
   * limitrofa. È il PERCHÉ del punteggio, mostrato nel tooltip del badge
   * (`bandaCompatibilita(punteggio, motivo)`): un match parziale va dichiarato, mai
   * lasciato intuire. Assente = match pieno.
   */
  motivoCompatibilita?: string | null;
  /**
   * true = inclusa D'UFFICIO perché la scuola è nella whitelist dell'utente
   * (Modalità 5 «Filtri Avanzati Scuole»): la card mostra l'etichetta dedicata
   * (`ETICHETTA_SCUOLA_PREFERITA`, `src/lib/compatibilita.ts`) al posto di un voto
   * insufficiente e il cap dei riempitivi non può nasconderla.
   */
  scuolaPreferita?: boolean;
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
