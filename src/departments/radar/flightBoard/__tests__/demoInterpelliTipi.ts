/**
 * ScuoleRadar.it — Dipartimento Radar · TIPI delle righe dimostrative del tabellone.
 *
 * Un solo posto per la forma del dato, così `demoInterpelliCasi.ts` (la TABELLA dei
 * casi), `demoInterpelli.ts` (le funzioni) e `demoInterpelliVerifica.ts` (il
 * confronto con la bacheca vera) possono importarla SENZA dipendenze circolari:
 *
 *   demoInterpelliTipi.ts ← demoInterpelliCasi.ts ← demoInterpelli.ts ← demoInterpelliVerifica.ts
 *
 * Il gate strutturale (`scripts/check-architettura.ts`) ferma i cicli e i file
 * oltre le 300 righe: la separazione non è estetica, è ciò che tiene verdi
 * `npm run test:architettura` e `npm test`.
 */

/** Prefisso che identifica le righe dimostrative in `interpelli.hash_id`. */
export const PREFISSO_DEMO = 'demo-';

/** Esito atteso in bacheca: la riga si vede (con quale fonte/badge) o non entra. */
export type EsitoAtteso =
  | {
      esito: 'mostrata';
      /** Tipo di fonte che il click deve aprire. */
      fonte: 'avviso' | 'sito-scuola';
      /** Etichetta ESATTA del badge della colonna «Scadenza». */
      badge: 'Scade oggi' | 'Scade domani' | 'Ultime 48h' | 'In corso';
      nota: string;
    }
  | { esito: 'scartata'; nota: string };

/** Riga dimostrativa: payload completo per `interpelli` + esito atteso. */
export interface RigaDemo {
  /** Identità STABILE della riga demo (uuid valido e riconoscibile, mai generato). */
  id: string;
  hash_id: string;
  title: string;
  province: string;
  class_codes: string[];
  school_name: string | null;
  school_code: string | null;
  materia: string | null;
  source_url: string;
  /** Data locale `YYYY-MM-DD` (giorni di calendario da oggi). */
  expiration_date: string;
  contact_email: string | null;
  school_pec: string | null;
  /** Host del sito istituzionale (anagrafica MIM): MAI con schema né percorso. */
  school_site: string | null;
  atteso: EsitoAtteso;
}

/**
 * Caso dimostrativo: la riga senza la data assoluta, più i giorni da oggi. La
 * scadenza si calcola al momento del run (`righeDemo`), mai scritta a mano.
 */
export type CasoDemo = Omit<RigaDemo, 'expiration_date'> & { giorniAllaScadenza: number };

const DUE_CIFRE = (n: number): string => String(n).padStart(2, '0');

/** Data locale `oggi + giorni` in forma `YYYY-MM-DD` (mezzogiorno: nessun salto di fuso). */
export function giornoDemo(oggi: Date, piuGiorni: number): string {
  const d = new Date(oggi);
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() + piuGiorni);
  return `${d.getFullYear()}-${DUE_CIFRE(d.getMonth() + 1)}-${DUE_CIFRE(d.getDate())}`;
}
