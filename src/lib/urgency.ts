/**
 * ScuoleRadar.it — URGENZA della scadenza per il «Radar Live» (modulo PURO).
 *
 * Traduce i giorni rimanenti in una BANDA cromata più fine del semaforo
 * condiviso, pensata per il tabellone pubblico (dove il colore serve a
 * distinguere a colpo d'occhio le opportunità più vicine):
 *
 *   🔴 rosso    → scade oggi (con `animate-pulse`)
 *   🔴 rosso    → entro 48 ore («Ultime 48h»)
 *   🟠 arancio  → entro 3 giorni
 *   🟡 giallo   → entro 7 giorni
 *   🟢 verde    → oltre 7 giorni («In corso»)
 *   ⚪ slate    → data assente o non valida: «Scadenza n/d», nessuna pulsazione
 *
 * Regole di prodotto (non negoziabili):
 *   · il calcolo dei giorni NON si duplica: arriva da `giorniRimanenti`, che
 *     confronta per GIORNO (le scadenze reali arrivano a mezzanotte UTC e un
 *     conteggio a ore anticiperebbe di un giorno l'allarme);
 *   · l'etichetta è un'informazione di SERVIZIO: dice cosa c'è in bacheca, mai
 *     fretta artificiale o inviti a correre (`comunicazione/00_regole_generali`);
 *   · gli avvisi SCADUTI non entrano mai nella bacheca: la banda `concluso`
 *     esiste solo perché questa funzione è TOTALE (nessun input la rompe), non
 *     per essere mostrata in tabellone.
 */

/** Calcola i giorni rimanenti rispetto a una data ISO e un riferimento temporale. */
export function giorniRimanenti(iso?: string | null, oggi: Date = new Date()): number | null {
  if (!iso) return null;
  const dataScadenza = new Date(iso);
  if (isNaN(dataScadenza.getTime())) return null;

  const utcOggi = Date.UTC(oggi.getUTCFullYear(), oggi.getUTCMonth(), oggi.getUTCDate());
  const utcScadenza = Date.UTC(dataScadenza.getUTCFullYear(), dataScadenza.getUTCMonth(), dataScadenza.getUTCDate());

  const diffMs = utcScadenza - utcOggi;
  return Math.round(diffMs / (1000 * 60 * 60 * 24));
}

/** Soglie (in giorni) delle bande del tabellone. */
export const SOGLIA_ULTIME_48H = 2; // 1–2 giorni → ROSSO (entro 48 ore)
export const SOGLIA_ENTRO_3_GIORNI = 3; // 3 giorni    → ARANCIO
export const SOGLIA_ENTRO_7_GIORNI = 7; // 4–7 giorni  → GIALLO
//                                       > 7 giorni  → VERDE (in corso)

export type BandaUrgenza =
  | 'concluso'
  | 'oggi'
  | 'ultime48'
  | 'entro3'
  | 'entro7'
  | 'inCorso'
  | 'sconosciuto';

export interface UrgenzaScadenza {
  banda: BandaUrgenza;
  /** Classi Tailwind del badge. */
  className: string;
  /** Etichetta breve («Scade oggi», «Ultime 48h», «Scade tra 5g», «In corso»). */
  label: string;
}

/** Etichetta dei giorni residui nel formato compatto del tabellone. */
function etichettaGiorni(giorni: number): string {
  return `Scade tra ${giorni}g`;
}

/**
 * Banda di urgenza della scadenza.
 *   · positivo → giorni mancanti; · 0 → scade oggi; · negativo → scaduto;
 *   · `null` (data assente o non valida) → banda NEUTRA `sconosciuto`
 *     (`bg-slate-100`, nessuna pulsazione) con etichetta di servizio «Scadenza
 *     n/d»: se la data non c'è il colore non deve allarmare
 *     (`docs/SYSTEM_HANDOVER.md` §26.22).
 */
export function calcolaUrgenza(iso?: string | null, oggi: Date = new Date()): UrgenzaScadenza {
  const giorni = giorniRimanenti(iso, oggi);

  if (giorni === null) {
    return { banda: 'sconosciuto', className: 'bg-slate-100 text-slate-600', label: 'Scadenza n/d' };
  }
  if (giorni < 0) {
    return { banda: 'concluso', className: 'bg-slate-200 text-slate-600', label: 'Concluso' };
  }
  if (giorni === 0) {
    return { banda: 'oggi', className: 'bg-red-600 text-white animate-pulse', label: 'Scade oggi' };
  }
  if (giorni <= SOGLIA_ULTIME_48H) {
    return { banda: 'ultime48', className: 'bg-red-600 text-white', label: 'Ultime 48h' };
  }
  if (giorni <= SOGLIA_ENTRO_3_GIORNI) {
    return { banda: 'entro3', className: 'bg-orange-500 text-white', label: etichettaGiorni(giorni) };
  }
  if (giorni <= SOGLIA_ENTRO_7_GIORNI) {
    return { banda: 'entro7', className: 'bg-amber-500 text-white', label: etichettaGiorni(giorni) };
  }
  return { banda: 'inCorso', className: 'bg-emerald-600 text-white', label: 'In corso' };
}