import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

interface ModuleCreatorErrorBoundaryProps {
  children: ReactNode;
}

interface ModuleCreatorErrorBoundaryState {
  errore: Error | null;
}

/**
 * Error Boundary DEDICATO al sotto-modulo ModuleCreator.
 *
 * Qualsiasi errore interno al creatore (rendering, generazione, cache…)
 * viene intercettato qui: la fallback viene mostrata SOLO al posto del
 * creatore, senza far crollare l'intera pagina Modulistica né gli altri
 * servizi di ScuoleRadar.
 */
export class ModuleCreatorErrorBoundary extends Component<
  ModuleCreatorErrorBoundaryProps,
  ModuleCreatorErrorBoundaryState
> {
  state: ModuleCreatorErrorBoundaryState = { errore: null };

  static getDerivedStateFromError(errore: Error): ModuleCreatorErrorBoundaryState {
    return { errore };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('[ModuleCreator] errore intercettato dall\'Error Boundary:', error, info);
  }

  riprova = (): void => this.setState({ errore: null });

  render() {
    if (this.state.errore) {
      return (
        <div className="animate-fade-in mt-4 rounded-2xl border border-error-200 bg-error-50/60 p-5">
          <div className="flex items-start gap-3">
            <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-error-500 text-white">
              <AlertTriangle className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <h4 className="text-sm font-bold text-error-700">
                Il creatore ha inciampato, ma ScuoleRadar continua a funzionare
              </h4>
              <p className="mt-1 text-sm leading-relaxed text-error-700">
                Non ti preoccupare: è successo qualcosa di imprevisto solo nel generatore di
                documenti. Puoi riprovare da capo oppure usare senza problemi il resto della
                Modulistica e gli altri servizi.
              </p>
              <button
                onClick={this.riprova}
                className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-error-600 px-4 py-2 text-sm font-semibold text-white shadow-soft transition hover:bg-error-700"
              >
                <RotateCcw className="h-4 w-4" />
                Riprova il creatore
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
