/**
 * Onboarding · navigazione del wizard (Indietro / Avanti / Attiva il Radar).
 *
 * Presentazione pura: la validazione del passo (`canNext`) e le azioni restano
 * nella pagina. Nessuno stato proprio.
 */
import type { Dispatch, SetStateAction } from 'react';
import { ArrowLeft, ArrowRight, Radar } from 'lucide-react';

interface NavigazioneOnboardingProps {
  /** Passo corrente (1..totalSteps). */
  step: number;
  /** Numero totale di passi. */
  totalSteps: number;
  /** Cambia passo (Indietro/Avanti). */
  setStep: Dispatch<SetStateAction<number>>;
  /** true se il passo corrente è completo (abilita «Avanti»/«Attiva»). */
  canNext: () => boolean;
  /** Chiude l'onboarding salvando le preferenze. */
  handleFinish: () => void;
}

export function NavigazioneOnboarding({
  step,
  totalSteps,
  setStep,
  canNext,
  handleFinish,
}: NavigazioneOnboardingProps) {
  return (
          <div className="mt-8 flex items-center justify-between">
            {step > 1 ? (
              <button
                onClick={() => setStep((s) => s - 1)}
                className="inline-flex items-center gap-1.5 rounded-xl border border-primary-200 px-4 py-2.5 text-sm font-medium text-primary-700 transition hover:bg-primary-50"
              >
                <ArrowLeft className="h-4 w-4" />
                Indietro
              </button>
            ) : (
              <span />
            )}

            {step < totalSteps ? (
              <button
                onClick={() => setStep((s) => s + 1)}
                disabled={!canNext()}
                className="inline-flex items-center gap-1.5 rounded-xl bg-primary-500 px-5 py-2.5 text-sm font-semibold text-white shadow-soft transition hover:bg-primary-600 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Avanti
                <ArrowRight className="h-4 w-4" />
              </button>
            ) : (
              <button
                onClick={handleFinish}
                disabled={!canNext()}
                className="inline-flex items-center gap-2 rounded-xl bg-accent-500 px-5 py-2.5 text-sm font-semibold text-white shadow-soft transition hover:bg-accent-600 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Radar className="h-4 w-4" />
                Attiva il Radar
              </button>
            )}
          </div>
  );
}
