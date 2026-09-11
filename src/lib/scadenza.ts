/**
 * ScuoleRadar.it — Helper SCADENZA (puro, condiviso da UI e logica)
 *
 * Fornisce:
 *   · `giorniRimanenti(iso)`   → giorni (data-only) alla scadenza, `null` se assente;
 *   · `eScaduto(iso)`          → true se la scadenza è passata;
 *   · `eInterpelloAttivo(iso)` → filtro per ESCLUDERE gli scaduti dalle liste pubbliche;
 *   · `stileScadenza(giorni)`  → semaforo del badge: 🟢 lungo · 🟡 vicino · 🔴 imminente.
 */

/** Soglie (in giorni) del semaforo di scadenza. */
export const SOGLIA_IMMINENTE = 2; // ≤ 2 giorni  → ROSSO (ultimi giorni / scade oggi)
export const SOGLIA_VICINA = 7; //   3–7 giorni  → GIALLO (in avvicinamento)
//                                   > 7 giorni  → VERDE (lungo termine)

export type LivelloScadenza = 'scaduto' | 'imminente' | 'vicino' | 'lungo' | 'sconosciuto';

export interface StileScadenza {
  livello: LivelloScadenza;
  /** Classi Tailwind per il badge. */
  className: string;
  /** Etichetta breve ("In corso", "Tra 3 giorni", "Ultimi 2 giorni", "Scade oggi", "Scaduto"). */
  label: string;
}

/** Mezzanotte (locale) del giorno indicato. */
function mezzanotte(oggi: Date): Date {
  const d = new Date(oggi);
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Giorni rimanenti alla scadenza (confronto per GIORNO, non per orario).
 *   · positivo → giorni mancanti; · 0 → scade oggi; · negativo → già scaduto;
 *   · `null` → data assente o non valida.
 */
export function giorniRimanenti(iso?: string | null, oggi: Date = new Date()): number | null {
  if (!iso) return null;
  // Se la stringa inizia con YYYY-MM-DD si usa la PARTE DATA (locale), evitando
  // slittamenti di giorno dovuti ai fusi orari sui timestamptz (es. 00:00 UTC).
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso.trim());
  const d = m ? new Date(`${m[1]}-${m[2]}-${m[3]}T00:00:00`) : new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  d.setHours(0, 0, 0, 0);
  return Math.round((d.getTime() - mezzanotte(oggi).getTime()) / 86_400_000);
}

/** True se l'interpello è scaduto (scadenza precedente a oggi). */
export function eScaduto(iso?: string | null, oggi: Date = new Date()): boolean {
  const g = giorniRimanenti(iso, oggi);
  return g !== null && g < 0;
}

/**
 * True se l'interpello va tenuto nelle liste ATTIVE.
 * Senza scadenza → considerato attivo (non dimostrabile come scaduto).
 */
export function eInterpelloAttivo(iso?: string | null, oggi: Date = new Date()): boolean {
  return !eScaduto(iso, oggi);
}

/**
 * Semaforo di scadenza per i badge:
 *   🟢 verde   → lungo termine (> 7 giorni)
 *   🟡 giallo  → in avvicinamento (3–7 giorni)
 *   🔴 rosso   → imminente / ultimi giorni (≤ 2 giorni, "scade oggi")
 *   ⚫ grigio  → scaduto o scadenza non indicata
 */
export function stileScadenza(giorni: number | null): StileScadenza {
  if (giorni === null) {
    return { livello: 'sconosciuto', className: 'bg-slate-100 text-slate-600', label: 'Scadenza n/d' };
  }
  if (giorni < 0) {
    return { livello: 'scaduto', className: 'bg-slate-200 text-slate-600', label: 'Scaduto' };
  }
  if (giorni === 0) {
    return { livello: 'imminente', className: 'bg-red-600 text-white animate-pulse', label: 'Scade oggi' };
  }
  if (giorni <= SOGLIA_IMMINENTE) {
    return {
      livello: 'imminente',
      className: 'bg-red-600 text-white animate-pulse',
      label: `Ultimi ${giorni} ${giorni === 1 ? 'giorno' : 'giorni'}`,
    };
  }
  if (giorni <= SOGLIA_VICINA) {
    return { livello: 'vicino', className: 'bg-amber-500 text-white', label: `Tra ${giorni} giorni` };
  }
  return { livello: 'lungo', className: 'bg-emerald-600 text-white', label: 'In corso' };
}
