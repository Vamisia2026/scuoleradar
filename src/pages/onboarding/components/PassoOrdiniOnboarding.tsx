/**
 * Onboarding · PASSO 1 — ordini di scuola.
 *
 * L'ordine di scuola determina le opportunità monitorate. Nessuna domanda
 * personale in apertura: i dati facoltativi (genere, età) sono raccolti a FINE
 * percorso, nel passo 4. Presentazione pura: stato e handler arrivano dalla
 * pagina (`OnboardingPage`).
 */
import type { ReactNode } from 'react';
import { Check } from 'lucide-react';
import { ordiniScuola, type OrdineScuola } from '@/data/ordiniMaterie';

interface PassoOrdiniOnboardingProps {
  /** Ordini di scuola selezionati. */
  ordini: OrdineScuola[];
  toggleOrdine: (id: OrdineScuola) => void;
  /** Icone degli ordini (fornite dalla pagina, unica fonte in comune). */
  ordineIcons: Record<OrdineScuola, ReactNode>;
}

export function PassoOrdiniOnboarding({
  ordini,
  toggleOrdine,
  ordineIcons,
}: PassoOrdiniOnboardingProps) {
  return (
            <div className="animate-fade-in">
              <h2 className="text-xl font-bold text-primary-800">
                In quale ordine vuoi insegnare o lavorare?
              </h2>
              <p className="mt-1 text-sm text-primary-600">
                Puoi selezionare più opzioni. Il Radar cercherà opportunità per tutte le tipologie scelte.
              </p>
              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                {ordiniScuola.map((o) => {
                  const selected = ordini.includes(o.id);
                  return (
                    <button
                      key={o.id}
                      onClick={() => toggleOrdine(o.id)}
                      className={`flex items-start gap-3 rounded-xl border p-4 text-left transition ${
                        selected
                          ? 'border-primary-500 bg-primary-50 ring-2 ring-primary-500'
                          : 'border-primary-200 bg-white hover:border-primary-300'
                      }`}
                    >
                      <span
                        className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${
                          selected ? 'bg-primary-500 text-white' : 'bg-primary-50 text-primary-600'
                        }`}
                      >
                        {ordineIcons[o.id]}
                      </span>
                      <span className="flex-1">
                        <span className="block font-semibold text-primary-800">{o.nome}</span>
                        <span className="block text-xs text-primary-500">{o.descrizione}</span>
                      </span>
                      {selected && <Check className="h-5 w-5 shrink-0 text-primary-600" />}
                    </button>
                  );
                })}
              </div>
              {ordini.length > 0 && (
                <p className="mt-4 text-sm font-medium text-primary-600">
                  Hai selezionato {ordini.length} {ordini.length === 1 ? 'tipologia' : 'tipologie'}.
                </p>
              )}
            </div>
  );
}
