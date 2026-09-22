import { ArrowRight, BookOpenCheck, ShieldCheck } from 'lucide-react';
import { classiCoperteAttive, notaCoperturaV1 } from '../classi';

interface StepClasseProps {
  /** Codice della classe selezionata (null = nessuna scelta). */
  selezionata: string | null;
  onSeleziona: (codice: string) => void;
  onContinua: () => void;
}

/**
 * Fase 1 — Classe obiettivo: il calcolo parte SEMPRE da qui.
 *
 * Vengono proposte solo le classi con copertura normativa reale (`classi.ts`).
 * Nessun obiettivo astratto che non alimenta il calcolo.
 */
export function StepClasse({ selezionata, onSeleziona, onContinua }: StepClasseProps) {
  const classi = classiCoperteAttive();

  return (
    <div className="animate-fade-in space-y-5">
      <div className="space-y-2">
        <p className="text-sm font-bold uppercase tracking-widest text-primary-400">
          Classe obiettivo · 01
        </p>
        <h3 className="text-2xl font-extrabold leading-snug text-primary-900 sm:text-3xl">
          Quale classe di concorso vuoi verificare?
        </h3>
        <p className="max-w-3xl text-base leading-relaxed text-primary-600 sm:text-lg">
          Scegli la classe: confronteremo i requisiti scritti nella norma con gli esami che hai
          sostenuto e ti diremo se risulti ammissibile, cosa manca e cosa verificare.
        </p>
      </div>

      <p className="flex items-start gap-2.5 rounded-2xl bg-primary-50/70 px-4 py-3 text-sm leading-relaxed text-primary-700 ring-1 ring-primary-100 sm:text-base">
        <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-primary-500" />
        {notaCoperturaV1()}
      </p>

      <div className="grid gap-3 lg:grid-cols-2">
        {classi.map((classe) => {
          const attiva = selezionata === classe.codice;
          return (
            <button
              key={classe.codice}
              type="button"
              onClick={() => onSeleziona(classe.codice)}
              aria-pressed={attiva}
              className={`flex flex-col rounded-2xl border p-5 text-left transition-all duration-150 ${
                attiva
                  ? 'border-primary-500 bg-primary-50 shadow-soft ring-1 ring-primary-300'
                  : 'border-slate-200 bg-white hover:border-primary-200 hover:bg-primary-50/40'
              }`}
            >
              <span className="flex items-center gap-2">
                <span className="rounded-lg bg-primary-800 px-2 py-0.5 font-mono text-xs font-bold text-white">
                  {classe.codice}
                </span>
                <BookOpenCheck className="h-4 w-4 text-primary-500" />
              </span>
              <span className="mt-2 block text-lg font-bold leading-snug text-primary-800">
                {classe.denominazione}
              </span>
              <span className="mt-2 block text-sm leading-relaxed text-primary-600">
                Titolo di accesso dichiarato dalla fonte:{' '}
                <strong className="text-primary-800">
                  {classe.classiLaureaAmmesse.join(', ') || 'non dichiarato'}
                </strong>
              </span>
              <span className="mt-3 block font-mono text-[11px] leading-relaxed text-primary-400">
                {classe.fonte}
              </span>
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-5">
        <p className="max-w-xl text-sm font-medium leading-relaxed text-primary-500 sm:text-base">
          {selezionata
            ? 'Classe scelta: passiamo al tuo titolo di studio.'
            : 'Scegli una classe per iniziare la verifica.'}
        </p>
        <button
          type="button"
          onClick={onContinua}
          disabled={!selezionata}
          className="inline-flex items-center gap-1.5 rounded-xl bg-primary-500 px-6 py-3 text-base font-semibold text-white shadow-soft transition hover:bg-primary-600 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Continua
          <ArrowRight className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}
