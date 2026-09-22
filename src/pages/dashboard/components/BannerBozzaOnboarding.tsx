/**
 * Dashboard · banner «Finisci di completare il tuo Radar».
 *
 * Compare quando esiste una bozza di onboarding (preferenze parziali) ma il
 * Radar non è ancora stato attivato: il bottone riprende esattamente dal passo
 * salvato. Presentazione pura: l'azione arriva dal contenitore.
 */
import { SlidersHorizontal } from 'lucide-react';

interface BannerBozzaOnboardingProps {
  /** Riprende l'onboarding dal passo salvato (apre il wizard del Radar). */
  onRiprendi: () => void;
}

export function BannerBozzaOnboarding({ onRiprendi }: BannerBozzaOnboardingProps) {
  return (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-warning-200 bg-warning-50 px-4 py-2.5 text-sm shadow-card">
          <div className="flex min-w-0 items-center gap-3">
            <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-warning-500 text-white">
              <SlidersHorizontal className="h-4 w-4" />
            </span>
            <p className="min-w-0 leading-relaxed text-warning-800">
              <strong>Finisci di completare il tuo Radar per attivarlo</strong>
              <span className="block text-xs text-warning-700">
                Hai già salvato una bozza: riprendi esattamente dal passo in cui ti eri fermato.
              </span>
            </p>
          </div>
          <button
            type="button"
            onClick={onRiprendi}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-primary-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary-600"
          >
            <SlidersHorizontal className="h-4 w-4" />
            Completa il Radar
          </button>
        </div>
  );
}
