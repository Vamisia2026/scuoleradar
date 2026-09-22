/**
 * Scadenze — indicatori di impaginazione del Revolver (dots).
 *
 * Un bottone per scadenza in coda (target touch ≥ ~24 px su mobile): il dot
 * attivo è una pill allungata. `aria-current` marca lo slide visibile.
 *
 * Presentazione pura: coda, indice attivo e navigazione arrivano dal
 * contenitore.
 */
import type { ScadenzaProiettata } from '../types';

interface IndicatoriRevolverProps {
  /** Coda in rotazione (senza il clone di testa). */
  coda: ScadenzaProiettata[];
  /** Indice dello slide visibile. */
  indiceVisibile: number;
  /** Salta a uno slide logico. */
  vaiA: (indice: number) => void;
}

export function IndicatoriRevolver({
  coda,
  indiceVisibile,
  vaiA,
}: IndicatoriRevolverProps) {
  return (
      <div className="flex min-h-0 flex-wrap items-center justify-center gap-0.5 px-4 pb-2 pt-1 sm:gap-1 sm:pb-2.5">
        {coda.map((occ, i) => (
          <button
            key={occ.record.id}
            type="button"
            onClick={() => vaiA(i)}
            aria-label={`Vai alla scadenza ${i + 1}: ${occ.record.title}`}
            aria-current={i === indiceVisibile ? 'true' : undefined}
            className="group flex items-center justify-center rounded-full p-1.5"
          >
            <span
              className={`block h-2 rounded-full transition-all duration-300 ${
                i === indiceVisibile
                  ? 'w-6 bg-primary-500'
                  : 'w-2 bg-primary-200 group-hover:bg-primary-300'
              }`}
            />
          </button>
        ))}
      </div>
  );
}
