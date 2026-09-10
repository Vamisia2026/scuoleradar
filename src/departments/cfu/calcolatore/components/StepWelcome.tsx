import { ArrowRight, Sparkles } from 'lucide-react';
import { CfuTutorIntro } from '../../shared/CfuTutorIntro';

interface StepWelcomeProps {
  /** Avvia il percorso: passa allo Step 1 "Perché sei qui?". */
  onInizia: () => void;
}

/**
 * Step 0 — Benvenuto / presentazione del Tutor del Dipartimento CFU.
 *
 * Schermata separata dallo Step 1: il Tutor presenta cosa fa il calcolatore,
 * quali documenti servono e la nota privacy integrata. L'utente legge e poi
 * sceglie consapevolmente di partire con "Calcola i tuoi CFU".
 */
export function StepWelcome({ onInizia }: StepWelcomeProps) {
  return (
    <div className="animate-fade-in space-y-4">
      <CfuTutorIntro />

      <div className="rounded-2xl border border-primary-100 bg-white px-5 py-4 text-center shadow-card">
        <button
          type="button"
          onClick={onInizia}
          className="inline-flex items-center justify-center gap-2 rounded-2xl bg-primary-500 px-9 py-3.5 text-lg font-bold text-white shadow-soft transition hover:bg-primary-600"
        >
          <Sparkles className="h-5 w-5" />
          Calcola i tuoi CFU
          <ArrowRight className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}