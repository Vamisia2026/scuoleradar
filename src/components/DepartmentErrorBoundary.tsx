import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

interface DepartmentErrorBoundaryProps {
  /** Nome del dipartimento/sotto-dipartimento protetto (es. "Notizie", "Modulistica"). */
  dipartimento: string;
  children: ReactNode;
  /** Titolo della fallback (default: "Il dipartimento <X> ha incontrato un problema"). */
  titolo?: string;
  /** Testo della fallback (default: invito a riprovare senza perdere il resto del sito). */
  messaggio?: string;
  /** Etichetta del bottone di ripristino (default: "Riprova"). */
  etichettaRiprova?: string;
  /** Classi extra applicate al contenitore della fallback. */
  className?: string;
  /** Callback diagnostico (analytics/log esterni). Le eccezioni al suo interno vengono ignorate. */
  onErrore?: (errore: Error, info: ErrorInfo) => void;
}

interface DepartmentErrorBoundaryState {
  errore: Error | null;
}

/**
 * ERROR BOUNDARY CONDIVISO tra i dipartimenti di ScuoleRadar.
 *
 * Ogni superficie di dipartimento (Notizie, Scadenze, CFU, CV, Modulistica,
 * PureFocus, Assistente AI, Radar…) va montata dentro un boundary dedicato:
 * un errore di rendering/parsing resta confinato a QUELLA sezione, mentre
 * Header, navigazione, dashboard e gli altri dipartimenti continuano a
 * funzionare normalmente.
 *
 * Non dipende da nessun modulo di dipartimento: è l'unico punto di contatto
 * ammesso tra il guscio dell'app e i domini isolati (`src/departments/`,
 * `src/modules/`), così un guasto non può propagarsi a cascata.
 */
export class DepartmentErrorBoundary extends Component<
  DepartmentErrorBoundaryProps,
  DepartmentErrorBoundaryState
> {
  state: DepartmentErrorBoundaryState = { errore: null };

  static getDerivedStateFromError(errore: Error): DepartmentErrorBoundaryState {
    return { errore };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error(
      `[Dipartimento ${this.props.dipartimento}] errore intercettato dall'Error Boundary:`,
      error,
      info,
    );
    try {
      this.props.onErrore?.(error, info);
    } catch {
      // Il callback diagnostico non deve mai peggiorare la fallback.
    }
  }

  /** Ripristina il sottoalbero: il dipartimento viene rimontato da zero. */
  riprova = (): void => this.setState({ errore: null });

  render() {
    const { dipartimento, titolo, messaggio, etichettaRiprova, className } = this.props;

    if (this.state.errore) {
      return (
        <div
          role="alert"
          className={`animate-fade-in mt-4 rounded-2xl border border-warning-500/40 bg-warning-50/70 p-5 ${
            className ?? ''
          }`}
        >
          <div className="flex items-start gap-3">
            <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-warning-500 text-white">
              <AlertTriangle className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <h4 className="text-sm font-bold text-warning-700">
                {titolo ?? `Il dipartimento ${dipartimento} ha incontrato un problema`}
              </h4>
              <p className="mt-1 text-sm leading-relaxed text-warning-700">
                {messaggio ??
                  `Questa sezione è temporaneamente non disponibile: puoi riprovare oppure continuare a usare gli altri servizi di ScuoleRadar senza interruzioni.`}
              </p>
              <button
                type="button"
                onClick={this.riprova}
                className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-warning-500 px-4 py-2 text-sm font-semibold text-white shadow-soft transition hover:bg-warning-600"
              >
                <RotateCcw className="h-4 w-4" />
                {etichettaRiprova ?? `Riapri ${dipartimento}`}
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
