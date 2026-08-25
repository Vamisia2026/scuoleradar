import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import { CheckCircle2, XCircle, X } from 'lucide-react';

interface ToastMsg {
  id: number;
  tipo: 'successo' | 'errore';
  messaggio: string;
}

interface ToastContextValue {
  mostraToast: (tipo: 'successo' | 'errore', messaggio: string) => void;
}

const ToastContext = createContext<ToastContextValue>({
  mostraToast: () => undefined,
});

export function useToast() {
  return useContext(ToastContext);
}

/** Provider + container dei toast (errore/successo) in basso a destra. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastMsg[]>([]);

  const mostraToast = useCallback((tipo: 'successo' | 'errore', messaggio: string) => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, tipo, messaggio }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 6000);
  }, []);

  return (
    <ToastContext.Provider value={{ mostraToast }}>
      {children}
      <div className="pointer-events-none fixed bottom-4 right-4 z-[100] flex w-full max-w-sm flex-col gap-2 px-4 sm:px-0">
        {toasts.map((t) => (
          <div
            key={t.id}
            role="status"
            className={`pointer-events-auto flex items-start gap-2.5 rounded-xl border px-4 py-3 text-sm font-medium shadow-card backdrop-blur ${
              t.tipo === 'errore'
                ? 'border-error-200 bg-white/95 text-error-700'
                : 'border-accent-200 bg-white/95 text-accent-700'
            }`}
          >
            {t.tipo === 'errore' ? (
              <XCircle className="mt-0.5 h-4 w-4 shrink-0" />
            ) : (
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
            )}
            <span className="flex-1">{t.messaggio}</span>
            <button
              onClick={() => setToasts((prev) => prev.filter((x) => x.id !== t.id))}
              aria-label="Chiudi notifica"
              className="text-primary-400 transition hover:text-primary-700"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
