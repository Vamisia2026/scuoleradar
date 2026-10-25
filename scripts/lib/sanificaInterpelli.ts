/**
 * ScuoleRadar.it — REGOLA della sanificazione di `interpelli` (pura, testabile).
 *
 * Vive qui e non nello script perché è una REGOLA, non un effetto: la usano il
 * comando `npm run db:sanifica`, il suo test (`scripts/test-sanifica-interpelli.ts`)
 * e — come contratto — la migrazione
 * `supabase/migrations/20261025120000_finestra_opportunita_interpelli.sql`,
 * che la applica al database (colonne, funzione `in_finestra_opportunita`,
 * trigger, refresh schedulato, gate della RPC `match_interpelli`).
 *
 * Due verdetti, nessuna euristica nuova:
 *   1. **finestra di candidatura** — `eOpportunitaConScadenza` (`src/lib/scadenza.ts`):
 *      la riga è un'opportunità solo con una scadenza dichiarata, non passata e
 *      entro `GIORNI_ORIZZONTE_OPPORTUNITA` (15 giorni). Fuori → `fuori_finestra = true`.
 *   2. **segnaposto del nome** — un `school_name` che *contiene* «scuola non
 *      specificata» o «più plessi» è una dichiarazione di dato mancante, non una
 *      denominazione (§26.77) → va riportato a `NULL`.
 */

import {
  eOpportunitaConScadenza,
  giorniRimanenti,
  GIORNI_ORIZZONTE_OPPORTUNITA,
} from '../../src/lib/scadenza.ts';

/** Migrazione che crea la struttura: è la fonte della verità della regola. */
export const MIGRAZIONE =
  'supabase/migrations/20261025120000_finestra_opportunita_interpelli.sql';
/** Marcatore persistito della finestra. */
export const COLONNA_FINESTRA = 'fuori_finestra';
/** Quando la finestra è stata valutata l'ultima volta (data della VERIFICA). */
export const COLONNA_VERIFICA = 'finestra_verificata_at';

/**
 * SEGNAPOSTO RESIDUO nel nome della scuola: la forma *contenuta*, non solo
 * l'uguaglianza del gate pubblico (`lib/nomeIstituto.eSegnaposto`), perché qui si
 * ripulisce lo storico — «Scuola non specificata / Più plessi», «SCUOLA NON
 * SPECIFICATA», «Piu plessi», «PIU' PLESSI» sono lo stesso residuo.
 */
export const SEGNAPOSTO_RESIDUO = /scuola\s+non\s+specificat[oa]|pi[uù]['’]?\s*plessi/i;

/** Riga minima che serve alla sanificazione. */
export interface RigaSanificazione {
  id: string;
  school_name: string | null;
  expiration_date: string | null;
}

/** Perché una riga è fuori finestra (misura e stampa: il verdetto è uno solo). */
export type MotivoFuoriFinestra = 'senza-data' | 'non-valida' | 'scaduta' | 'oltre-orizzonte';

export interface Piano {
  /** Righe con un segnaposto residuo in `school_name` → da riportare a NULL. */
  nomiDaAzzerare: RigaSanificazione[];
  /** Righe che NON sono opportunità → `fuori_finestra = true`. */
  fuoriFinestra: RigaSanificazione[];
  /** Righe dentro la finestra → `fuori_finestra = false` (riallineamento). */
  inFinestra: RigaSanificazione[];
  /** Conteggio dei motivi, per la stampa. */
  motivi: Record<MotivoFuoriFinestra, number>;
}

/** True se il nome è un segnaposto residuo (da azzerare), non una denominazione. */
export function eNomeSegnaposto(nome?: string | null): boolean {
  const testo = (nome ?? '').trim();
  return testo.length > 0 && SEGNAPOSTO_RESIDUO.test(testo);
}

/** Motivo per cui la riga NON è un'opportunità attiva, `null` se lo è. */
export function motivoFuoriFinestra(
  scadenza: string | null,
  oggi: Date,
): MotivoFuoriFinestra | null {
  if (eOpportunitaConScadenza(scadenza, oggi)) return null;
  if (!(scadenza ?? '').trim()) return 'senza-data';
  const giorni = giorniRimanenti(scadenza, oggi);
  if (giorni === null) return 'non-valida';
  if (giorni < 0) return 'scaduta';
  return 'oltre-orizzonte';
}

/**
 * Separa le righe nei gruppi del piano. PURA: nessuna rete, nessun database,
 * nessun orologio implicito (la data `oggi` si passa).
 */
export function costruisciPiano(righe: RigaSanificazione[], oggi: Date = new Date()): Piano {
  const piano: Piano = {
    nomiDaAzzerare: [],
    fuoriFinestra: [],
    inFinestra: [],
    motivi: { 'senza-data': 0, 'non-valida': 0, scaduta: 0, 'oltre-orizzonte': 0 },
  };

  for (const riga of righe) {
    if (eNomeSegnaposto(riga.school_name)) piano.nomiDaAzzerare.push(riga);

    const motivo = motivoFuoriFinestra(riga.expiration_date, oggi);
    if (motivo === null) piano.inFinestra.push(riga);
    else {
      piano.fuoriFinestra.push(riga);
      piano.motivi[motivo] += 1;
    }
  }

  return piano;
}

/** Riga di stampa della misura (una sola formulazione, condivisa con il test). */
export function descriviPiano(piano: Piano, totale: number): string {
  const { motivi } = piano;
  return (
    `righe: ${totale} · dentro la finestra: ${piano.inFinestra.length} · ` +
    `fuori finestra: ${piano.fuoriFinestra.length} (senza data ${motivi['senza-data']}, ` +
    `non valide ${motivi['non-valida']}, scadute ${motivi.scaduta}, ` +
    `oltre ${GIORNI_ORIZZONTE_OPPORTUNITA} giorni ${motivi['oltre-orizzonte']}) · ` +
    `nomi con segnaposto: ${piano.nomiDaAzzerare.length}`
  );
}
