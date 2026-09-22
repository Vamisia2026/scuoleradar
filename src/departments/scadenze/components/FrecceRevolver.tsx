/**
 * Scadenze — control bar del Revolver (frecce precedente / successiva).
 *
 * Sovrapposte ai bordi del viewport con aree `pointer-events-none`: solo i
 * bottoni ricevono il puntatore, così lo swipe resta possibile su tutta la
 * superficie dello slide. Inner target ≥ 36 px su mobile (32 px da `sm`).
 *
 * Presentazione pura: le azioni arrivano dal contenitore.
 */
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface FrecceRevolverProps {
  /** Slide precedente. */
  indietro: () => void;
  /** Slide successivo. */
  avanti: () => void;
}

export function FrecceRevolver({ indietro, avanti }: FrecceRevolverProps) {
  return (
            <>
            <div className="pointer-events-none absolute inset-y-0 left-0 z-20 flex w-10 items-center justify-start pl-0.5">
              <button
                type="button"
                onClick={indietro}
                aria-label="Scadenza precedente"
                className="pointer-events-auto flex h-9 w-9 items-center justify-center rounded-full border border-primary-100 bg-white/90 text-primary-600 shadow-soft transition hover:bg-primary-50 hover:text-primary-800 active:scale-95 sm:h-8 sm:w-8"
              >
                <ChevronLeft className="h-5 w-5 sm:h-4 sm:w-4" aria-hidden="true" />
              </button>
            </div>
            <div className="pointer-events-none absolute inset-y-0 right-0 z-20 flex w-10 items-center justify-end pr-0.5">
              <button
                type="button"
                onClick={avanti}
                aria-label="Prossima scadenza"
                className="pointer-events-auto flex h-9 w-9 items-center justify-center rounded-full border border-primary-100 bg-white/90 text-primary-600 shadow-soft transition hover:bg-primary-50 hover:text-primary-800 active:scale-95 sm:h-8 sm:w-8"
              >
                <ChevronRight className="h-5 w-5 sm:h-4 sm:w-4" aria-hidden="true" />
              </button>
            </div>
            </>
  );
}
