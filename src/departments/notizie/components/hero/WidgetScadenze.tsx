/**
 * Notizie · widget Scadenze dell'hero (colonna destra).
 *
 * Boundary dedicato attorno al Revolver — un guasto del Dipartimento Scadenze
 * non deve mai oscurare la testata Notizie — più il conto alla rovescia delle
 * vacanze, nascosto in estate quando il revolver occupa tutto il box.
 */
import { DepartmentErrorBoundary } from '@/components/DepartmentErrorBoundary';
import { RevolverScadenze } from '@/departments/scadenze';
import type { ContoVacanze } from '../../vacanzeScolastiche';

interface WidgetScadenzeProps {
  /** Conto alla rovescia corrente (determina anche la modalità estate). */
  contoVacanze: ContoVacanze;
}

export function WidgetScadenze({ contoVacanze }: WidgetScadenzeProps) {
  return (
            <div className="w-full min-w-0 max-w-full lg:col-span-5">
              <aside
                aria-label="Prossime scadenze operative e conto alla rovescia per le vacanze"
                className="flex h-full w-full min-w-0 max-w-full flex-col overflow-hidden rounded-xl border border-primary-100 bg-white shadow-card"
              >
                {/* Revolver Scadenze — 2/3 dell'altezza (in estate occupa tutto il box).
                    Boundary dedicato: un guasto del Dipartimento Scadenze non
                    deve mai oscurare la testata Notizie. */}
                <DepartmentErrorBoundary
                  dipartimento="Scadenze"
                  titolo="Le scadenze non sono disponibili"
                  messaggio="Il calendario delle scadenze non può essere caricato in questo momento: le notizie e il resto del sito funzionano regolarmente."
                  etichettaRiprova="Ricarica le scadenze"
                  className="m-3 shrink-0"
                >
                  <RevolverScadenze
                    className={contoVacanze.estate ? 'min-h-0 flex-1' : 'min-h-0 flex-[2]'}
                  />
                </DepartmentErrorBoundary>

                {/* Scuola iniziata: divisorio netto + conteggio vacanze (1/3 del box),
                    compatto per stare nella fascia inferiore senza tagli. */}
                {!contoVacanze.estate && (
                  <>
                    <div className="mx-5 shrink-0 border-b-2 border-gray-300" />
                    <div className="flex min-h-0 min-w-0 flex-1 flex-col items-center justify-center gap-1 px-3 pb-3 pt-1.5 text-center sm:px-5">
                      <p className="font-display text-2xl font-black leading-none tracking-tight text-primary-900 sm:text-3xl">
                        {contoVacanze.giorni}
                        <span className="ml-2 align-baseline text-sm font-bold uppercase tracking-[0.16em] text-primary-500 sm:text-base">
                          {contoVacanze.giorni === 1 ? 'giorno' : 'giorni'}
                        </span>
                      </p>
                      <p className="w-full min-w-0 text-xs font-bold uppercase leading-snug tracking-[0.14em] text-secondary-600 sm:text-sm">
                        Alle {contoVacanze.nome}.
                      </p>
                    </div>
                  </>
                )}
              </aside>
            </div>
  );
}
