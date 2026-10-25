/**
 * ScuoleRadar.it — TIPI DEL REGISTRO FONTI INTERPELLI (Node-only, PURO).
 *
 * Estratti da `fonti.ts` per rispettare il limite di 250 righe per file
 * (`docs/MODULAR_ARCHITECTURE.md`, SRP): qui sta SOLO la forma dei dati, nessuna
 * logica. `fonti.ts` li ri-esporta, quindi chi importa da `./fonti.ts` non
 * cambia nulla. I dati verificati stanno in `fontiRegistro.ts`,
 * `fontiTerritoriali.ts` e `fontiEsclusiVerifica.ts`.
 */

/** Famiglia della fonte: aggregatore di post oppure hub istituzionale (USR/USP/ATP). */
export type TipoFonte = 'aggregatore' | 'hub-istituzionale';

/** Una fonte del registro: URL verificata, territorio, stato e motivo. */
export interface FonteInterpelli {
  /** Chiave stabile (log e test). */
  id: string;
  /** Nome leggibile della fonte. */
  etichetta: string;
  url: string;
  tipo: TipoFonte;
  /** Regioni coperte (vuoto = fonte nazionale). */
  regioni: string[];
  /**
   * Provincia di riferimento (capoluogo/hub) usata come fallback per le fonti
   * LOCALI. Le fonti nazionali non hanno fallback: la riga deve dichiarare la
   * propria provincia, altrimenti si scarta (mai una provincia inventata).
   */
  capoluogo: string | null;
  /** Feed nazionale: la provincia si rileva riga per riga. */
  nazionale: boolean;
  /** Fonte interrogata nei run (false = registrata ma non usata). */
  attiva: boolean;
  /** Data ISO dell'ultima verifica HTTP (null = mai verificata → non attiva). */
  verificata: string | null;
  /** Motivo dell'esclusione (obbligatorio quando attiva è false). */
  note?: string;
}
