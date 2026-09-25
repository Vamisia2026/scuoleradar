/**
 * Onboarding · PASSO 1 — anagrafica rapida (facoltativa) e ordini di scuola.
 *
 * L'anagrafica personalizza le email (Cara/Caro) e i dati admin; gli ordini
 * determinano le opportunità monitorate. Presentazione pura: stato e handler
 * arrivano dalla pagina (`OnboardingPage`).
 */
import type { ReactNode } from 'react';
import { Check } from 'lucide-react';
import { ordiniScuola, type OrdineScuola } from '@/data/ordiniMaterie';

interface PassoAnagraficaOrdiniProps {
  /** Genere dichiarato (facoltativo: personalizza le email). */
  genereOnb: 'M' | 'F' | null;
  setGenereOnb: (valore: 'M' | 'F' | null) => void;
  /** Età in anni, come stringa (campo numerico facoltativo). */
  etaOnb: string;
  setEtaOnb: (valore: string) => void;
  /** Ordini di scuola selezionati. */
  ordini: OrdineScuola[];
  toggleOrdine: (id: OrdineScuola) => void;
  /** Icone degli ordini (fornite dalla pagina, unica fonte in comune). */
  ordineIcons: Record<OrdineScuola, ReactNode>;
}

export function PassoAnagraficaOrdini({
  genereOnb,
  setGenereOnb,
  etaOnb,
  setEtaOnb,
  ordini,
  toggleOrdine,
  ordineIcons,
}: PassoAnagraficaOrdiniProps) {
  return (
            <div className="animate-fade-in">
              {/* Anagrafica rapida (facoltativa): personalizza le email (Cara/Caro) e i dati admin */}
              <div className="mb-6 rounded-xl border border-primary-100 bg-primary-50/40 p-4">
                <p className="text-sm font-bold text-primary-800">Qualche dato su di te (facoltativo)</p>
                <p className="mt-0.5 text-xs text-primary-500">
                  Usato per personalizzare le email e per il pannello di gestione. Puoi saltarlo.
                </p>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <div>
                    <span className="mb-1.5 block text-xs font-semibold text-primary-700">Genere</span>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setGenereOnb('F')}
                        aria-pressed={genereOnb === 'F'}
                        className={`rounded-lg border px-3 py-2 text-sm font-semibold transition ${
                          genereOnb === 'F'
                            ? 'border-accent-400 bg-accent-50 text-accent-700'
                            : 'border-primary-200 bg-white text-primary-600 hover:bg-primary-50'
                        }`}
                      >
                        Donna
                      </button>
                      <button
                        type="button"
                        onClick={() => setGenereOnb('M')}
                        aria-pressed={genereOnb === 'M'}
                        className={`rounded-lg border px-3 py-2 text-sm font-semibold transition ${
                          genereOnb === 'M'
                            ? 'border-accent-400 bg-accent-50 text-accent-700'
                            : 'border-primary-200 bg-white text-primary-600 hover:bg-primary-50'
                        }`}
                      >
                        Uomo
                      </button>
                    </div>
                  </div>
                  <div>
                    <span className="mb-1.5 block text-xs font-semibold text-primary-700">Età (anni)</span>
                    <input
                      type="number"
                      inputMode="numeric"
                      min={14}
                      max={100}
                      value={etaOnb}
                      onChange={(e) => setEtaOnb(e.target.value)}
                      className="input"
                      placeholder="Età"
                    />
                  </div>
                </div>
              </div>
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
