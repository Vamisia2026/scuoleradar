/**
 * ScuoleRadar.it — Dipartimento Scadenze (Deadlines Engine).
 *
 * Modello dati del dominio. Le date possono essere:
 *   · "MM-DD"          → ricorrenza ANNUALE proiettata nell'anno scolastico
 *                        attivo (rollover automatico corrente/corrente+1);
 *   · "YYYY-MM-DD"     → data ASSOLUTA (override dall'API/table: vale solo
 *                        per quell'anno finché non viene aggiornata).
 *
 * Il formato di ingresso è sempre testo: il motore (engine.ts) risolve le
 * date verso `Date` locali senza ambiguità di fuso orario.
 */

/** Tipologia di scadenza: data esatta oppure finestra operativa. */
export type TipoScadenza = 'exact' | 'window';

/** Fonte di provenienza dei dati (per trasparenza nell'interfaccia). */
export type OrigineScadenze = 'fallback' | 'supabase' | 'api';

/**
 * Record master di una scadenza (fallback JSON, riga Supabase o risposta
 * di un'Edge Function/API). Ogni record supporta una fase operativa
 * (`phase`, es. "Finestra Somministrazione", "Iscrizione Piattaforma",
 * "Correzione e Inserimento Dati").
 */
export interface DeadlineRecord {
  /** Identificativo univoco (es. "lav-01", "inv-02"). */
  id: string;
  /** Macro-categoria (es. "Lavoretti", "Didattica", "INVALSI", "Fisco & Inps"). */
  category: string;
  /** Titolo leggibile della scadenza. */
  title: string;
  /** "exact" = giorno unico; "window" = intervallo startDate→endDate. */
  type: TipoScadenza;
  /** Data esatta: "MM-DD" (ricorrente) oppure "YYYY-MM-DD" (assoluta). */
  date?: string | null;
  /** Inizio finestra: "MM-DD" oppure "YYYY-MM-DD". */
  startDate?: string | null;
  /** Fine finestra: "MM-DD" oppure "YYYY-MM-DD". */
  endDate?: string | null;
  /** Fase operativa (descrizione) — es. "Somministrazione prove CBT". */
  phase?: string | null;
  /** Destinatari (es. "Infanzia/Primaria", "Tutti i Gradi", "Docenti e ATA"). */
  target?: string | null;
  /** Istituzione di riferimento (es. "MIM", "INVALSI") quando nota. */
  source?: string | null;
  /** URL istituzionale di riferimento (fonte ufficiale), se disponibile. */
  officialSourceUrl?: string | null;
  /** false = record disattivato (escluso dalla coda). Default true. */
  active?: boolean;
}

/**
 * Scadenza PROIETTATA e pronta per la coda visibile: il motore ha già
 * risolto la ricorrenza annuale nell'anno scolastico attivo (o nell'anno
 * successivo se quella corrente è già scaduta).
 */
export interface ScadenzaProiettata {
  /** Record originale (per titolo, categoria, destinatari…). */
  record: DeadlineRecord;
  /** Fase operativa risolta (con fallback editoriale). */
  fase: string;
  /** Inizio della finestra — o giorno esatto — alle 00:00 locali. */
  inizio: Date;
  /**
   * Scadenza INCLUSIVA: ultimo secondo utile (23:59:59.999) del giorno
   * esatto o dell'endDate. L'item decade solo allo scoccare della
   * mezzanotte del giorno successivo.
   */
  scadenza: Date;
  /** true se oggi è dentro la finestra (o è il giorno esatto). */
  attiva: boolean;
  /** Giorni civili da oggi all'inizio (negativi se già iniziata). */
  giorniAllInizio: number;
  /** Giorni civili da oggi alla scadenza (0 = scade oggi). */
  giorniAllaScadenza: number;
}
