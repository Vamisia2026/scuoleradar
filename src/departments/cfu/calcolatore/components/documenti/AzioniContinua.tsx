/**
 * Calcolatore CFU · barra di avanzamento della fase Esami.
 *
 * Riga di chiusura con lo stato degli esami inseriti (e quanti sono senza
 * settore SSD) e la CTA «Calcola», attiva solo con almeno un esame.
 */
import { ArrowRight } from 'lucide-react';

interface AzioniContinuaProps {
  /** true quando esiste almeno un esame inserito. */
  pronto: boolean;
  /** Esami senza settore SSD dichiarato (segnalati, mai dedotti). */
  senzaSettore: number;
  /** Passa alla fase di calcolo. */
  onContinua: () => void;
}

export function AzioniContinua({ pronto, senzaSettore, onContinua }: AzioniContinuaProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-5">
      <p className="max-w-xl text-sm font-medium leading-relaxed text-primary-500 sm:text-base">
        {!pronto
          ? 'Inserisci almeno un esame per calcolare la tua posizione sulla classe scelta.'
          : senzaSettore > 0
            ? `Puoi calcolare, ma ${senzaSettore} esami non hanno un settore dichiarato: il risultato lo segnalerà.`
            : 'Esami pronti: possiamo confrontarli con i requisiti della classe.'}
      </p>
      <button
        type="button"
        onClick={onContinua}
        disabled={!pronto}
        className="inline-flex items-center gap-1.5 rounded-xl bg-primary-500 px-6 py-3 text-base font-semibold text-white shadow-soft transition hover:bg-primary-600 disabled:cursor-not-allowed disabled:opacity-40"
      >
        Calcola la mia posizione
        <ArrowRight className="h-4 w-4" />
      </button>
    </div>
  );
}
