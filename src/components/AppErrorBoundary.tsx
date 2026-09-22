import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Undo2 } from 'lucide-react';

interface AppErrorBoundaryProps {
  children: ReactNode;
}

interface AppErrorBoundaryState {
  errore: Error | null;
}

/**
 * ULTIMA LINEA DI DIFESA del guscio applicativo (montata in `main.tsx`).
 *
 * Intercetta solo i guasti che nessun boundary di dipartimento può vedere
 * (provider globali: AppContext, Toast, Router). Serve a garantire che
 * ScuoleRadar non mostri MAI una pagina bianca: l'utente vede una schermata
 * di servizio con due vie d'uscita sicure (torna alla home / ricarica).
 */
export class AppErrorBoundary extends Component<AppErrorBoundaryProps, AppErrorBoundaryState> {
  state: AppErrorBoundaryState = { errore: null };

  static getDerivedStateFromError(errore: Error): AppErrorBoundaryState {
    return { errore };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('[ScuoleRadar] errore non gestito a livello di applicazione:', error, info);
  }

  /** Ricarica l'applicazione da zero (stato pulito, nessuna cache in memoria). */
  ricarica = (): void => {
    try {
      window.location.reload();
    } catch {
      this.setState({ errore: null });
    }
  };

  /** Torna alla home senza ricaricare la pagina. */
  tornaAllaHome = (): void => {
    try {
      window.location.assign('/');
    } catch {
      this.setState({ errore: null });
    }
  };

  render() {
    if (this.state.errore) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-16">
          <div className="w-full max-w-lg rounded-2xl border border-warning-500/40 bg-white p-8 text-center shadow-card">
            <span className="mx-auto inline-flex h-12 w-12 items-center justify-center rounded-full bg-warning-500 text-white">
              <AlertTriangle className="h-6 w-6" />
            </span>
            <h1 className="mt-4 text-xl font-bold text-primary-900">
              Si è verificato un problema imprevisto
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-primary-600">
              Il servizio ha incontrato un errore e la pagina non può essere mostrata. I tuoi dati
              sono al sicuro: ricarica l&apos;applicazione o torna alla home per continuare.
            </p>
            <div className="mt-5 flex flex-col justify-center gap-2 sm:flex-row">
              <button
                type="button"
                onClick={this.ricarica}
                className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-primary-500 px-5 py-2.5 text-sm font-semibold text-white shadow-soft transition hover:bg-primary-600"
              >
                <RefreshCw className="h-4 w-4" />
                Ricarica l&apos;applicazione
              </button>
              <button
                type="button"
                onClick={this.tornaAllaHome}
                className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-primary-200 bg-white px-5 py-2.5 text-sm font-semibold text-primary-700 transition hover:bg-primary-50"
              >
                <Undo2 className="h-4 w-4" />
                Torna alla home
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
