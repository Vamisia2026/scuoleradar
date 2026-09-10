import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

interface CfuErrorBoundaryProps {
  children: ReactNode;
}

interface CfuErrorBoundaryState {
  errore: Error | null;
}

/**
 * Error Boundary DEL DIPARTIMENTO CFU.
 *
 * Qualsiasi errore interno al calcolatore (rendering, parsing, generazione
 * dossier) viene intercettato qui: la fallback compare solo al posto dello
 * strumento CFU. Radar, Modulistica, Notizie e il resto dell'app continuano a
 * funzionare — decoupling a runtime oltre che a livello di cartelle.
 */
export class CfuErrorBoundary extends Component<CfuErrorBoundaryProps, CfuErrorBoundaryState> {
  state: CfuErrorBoundaryState = { errore: null };

  static getDerivedStateFromError(errore: Error): CfuErrorBoundaryState {
    return { errore };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('[Dipartimento CFU] errore intercettato dall\u2019Error Boundary:', error, info);
  }

  riprova = (): void => this.setState({ errore: null });

  render() {
    if (this.state.errore) {
      return (
        <div className="animate-fade-in mt-4 rounded-2xl border border-warning-500/40 bg-warning-50/70 p-5">
          <div className="flex items-start gap-3">
            <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-warning-500 text-white">
              <AlertTriangle className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <h4 className="text-sm font-bold text-warning-700">
                Il Calcolatore CFU ha incontrato un problema
              </h4>
              <p className="mt-1 text-sm leading-relaxed text-warning-700">
                Puoi riavviare il Calcolatore CFU oppure continuare a usare gli altri servizi di
                ScuoleRadar.
              </p>
              <button
                onClick={this.riprova}
                className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-warning-500 px-4 py-2 text-sm font-semibold text-white shadow-soft transition hover:bg-warning-600"
              >
                <RotateCcw className="h-4 w-4" />
                Riapri il Calcolatore CFU
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
