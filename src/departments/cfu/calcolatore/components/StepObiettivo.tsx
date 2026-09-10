import { ArrowRight } from 'lucide-react';
import type { ObiettivoUtenteCfu } from '../../shared/types';
import { OBIETTIVI_UTENTE } from '../obiettivi';

interface StepObiettivoProps {
  selezionato: ObiettivoUtenteCfu | null;
  onSeleziona: (chiave: ObiettivoUtenteCfu) => void;
  onContinua: () => void;
}

/** Step A — "Perché sei qui?": presentazione tutor e scelta dell'obiettivo. */
export function StepObiettivo({ selezionato, onSeleziona, onContinua }: StepObiettivoProps) {
  return (
    <div className="animate-fade-in space-y-6">
      <div className="space-y-1.5">
        <p className="text-sm font-bold uppercase tracking-widest text-primary-400">
          Obiettivo · 01
        </p>
        <h3 className="text-2xl font-extrabold leading-snug text-primary-900 sm:text-3xl">
          Perché sei qui?
        </h3>
        <p className="max-w-3xl pt-1 text-base leading-relaxed text-primary-600 sm:text-lg">
          La tua scelta orienta come l&apos;AI imposta il calcolo della tua carriera e come viene
          costruito il report finale: sotto ogni opzione trovi «Dove ci concentreremo», ovvero cosa
          riceverai al termine del calcolo.
        </p>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        {OBIETTIVI_UTENTE.map((opzione) => {
          const attiva = selezionato === opzione.chiave;
          return (
            <button
              key={opzione.chiave}
              type="button"
              onClick={() => onSeleziona(opzione.chiave)}
              aria-pressed={attiva}
              className={`flex flex-col rounded-2xl border p-5 text-left transition-all duration-150 ${
                attiva
                  ? 'border-primary-500 bg-primary-50 shadow-soft ring-1 ring-primary-300'
                  : 'border-slate-200 bg-white hover:border-primary-200 hover:bg-primary-50/40'
              }`}
            >
              <span
                className={`block text-lg font-bold leading-snug ${
                  attiva ? 'text-primary-800' : 'text-primary-700'
                }`}
              >
                {opzione.etichetta}
              </span>
              <span className="mt-1.5 block text-base leading-relaxed text-primary-600">
                {opzione.descrizione}
              </span>
              <span className="mt-4 block flex-1 rounded-xl bg-primary-50/70 px-3.5 py-3 text-sm leading-relaxed text-primary-600 ring-1 ring-inset ring-primary-100 sm:text-base">
                <span className="font-bold text-primary-800">Dove ci concentreremo:</span>{' '}
                {opzione.focus}
              </span>
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-5">
        <p className="max-w-xl text-sm font-medium leading-relaxed text-primary-500 sm:text-base">
          {selezionato
            ? 'Perfetto: la cartella di lavoro è pronta.'
            : 'Scegli un obiettivo: il resto lo facciamo noi.'}
        </p>
        <button
          type="button"
          onClick={onContinua}
          disabled={!selezionato}
          className="inline-flex items-center gap-1.5 rounded-xl bg-primary-500 px-6 py-3 text-base font-semibold text-white shadow-soft transition hover:bg-primary-600 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Continua
          <ArrowRight className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}
