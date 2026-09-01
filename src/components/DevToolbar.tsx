import { useState } from 'react';
import { Zap, X, User as UserIcon, Crown, UserX, RotateCcw, Monitor, Activity } from 'lucide-react';
import { useApp, type RuoloSimulato } from '@/contexts/AppContext';
import { HealthCheckModal } from '@/components/HealthCheckModal';

const ruoli: { id: RuoloSimulato; label: string; desc: string; icon: React.ReactNode }[] = [
  {
    id: 'guest',
    label: 'Guest',
    desc: 'Utente anonimo non registrato',
    icon: <UserX className="h-4 w-4" />,
  },
  {
    id: 'base',
    label: 'Base',
    desc: 'Registrato · 3 segnalazioni incluse · Watermark su PDF',
    icon: <UserIcon className="h-4 w-4" />,
  },
  {
    id: 'pro',
    label: 'PRO',
    desc: 'Abbonamento completo · Tutto illimitato · PureFocus incluso',
    icon: <Crown className="h-4 w-4" />,
  },
];

export function DevToolbar() {
  const { user, abbonato, simulaStato, resettaTutto } = useApp();
  const [open, setOpen] = useState(false);
  const [checkupOpen, setCheckupOpen] = useState(false);

  // Visibile SOLO in ambiente di sviluppo
  if (!import.meta.env.DEV) return null;

  const ruoloCorrente: RuoloSimulato = !user ? 'guest' : abbonato ? 'pro' : 'base';
  const urlApp = typeof window !== 'undefined' ? `${window.location.origin}/` : '';

  return (
    <>
      {/* Pulsante flottante */}
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label="Apri DevToolbar"
        className="fixed bottom-4 right-4 z-[60] inline-flex items-center gap-1.5 rounded-full bg-primary-900 px-4 py-2.5 text-sm font-bold text-white shadow-soft ring-1 ring-white/20 transition hover:bg-primary-700"
      >
        <Zap className="h-4 w-4 text-secondary-400" />
        DEV
      </button>

      {open && (
        <div className="fixed inset-0 z-[70]">
          {/* Overlay INVISIBILE: chiude al click fuori dal pannello ma NON oscura né
              offusca la pagina (nessun backdrop scuro/bloccante durante lo sviluppo). */}
          <div
            className="absolute inset-0 bg-transparent"
            onClick={() => setOpen(false)}
          />

          {/* Pannello laterale */}
          <aside
            role="dialog"
            aria-label="DevToolbar"
            className="absolute right-0 top-0 flex h-full w-full max-w-sm flex-col overflow-y-auto border-l border-primary-100 bg-white shadow-card animate-pop"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-primary-100 px-5 py-4">
              <div>
                <p className="flex items-center gap-1.5 text-base font-bold text-primary-800">
                  <Zap className="h-4 w-4 text-secondary-500" />
                  DEV Toolbar
                </p>
                <p className="text-xs text-primary-400">Solo ambiente di sviluppo · non va in produzione</p>
              </div>
              <button
                onClick={() => setOpen(false)}
                aria-label="Chiudi DevToolbar"
                className="rounded-full p-1.5 text-primary-500 transition hover:bg-primary-50"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-6 p-5">
              {/* Ambiente / porta locale */}
              <section>
                <h3 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-primary-400">
                  <Monitor className="h-4 w-4" />
                  Ambiente
                </h3>
                <div className="mt-2 flex items-center justify-between gap-2 rounded-xl border border-primary-100 bg-primary-50 px-3 py-2.5">
                  <code className="truncate font-mono text-xs font-medium text-primary-700">{urlApp}</code>
                  <span className="shrink-0 rounded-full bg-accent-100 px-2 py-0.5 text-[10px] font-bold uppercase text-accent-700">
                    {import.meta.env.MODE}
                  </span>
                </div>
              </section>

              {/* Stato utente */}
              <section>
                <h3 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-primary-400">
                  <UserIcon className="h-4 w-4" />
                  Stato utente (Frontend State Switcher)
                </h3>
                <div className="mt-2 space-y-2">
                  {ruoli.map((r) => {
                    const attivo = ruoloCorrente === r.id;
                    return (
                      <button
                        key={r.id}
                        onClick={() => simulaStato(r.id)}
                        className={`flex w-full items-start gap-3 rounded-xl border p-3 text-left transition ${
                          attivo
                            ? 'border-primary-500 bg-primary-50 ring-2 ring-primary-500'
                            : 'border-primary-100 bg-white hover:border-primary-300'
                        }`}
                      >
                        <span
                          className={`mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                            attivo ? 'bg-primary-500 text-white' : 'bg-primary-50 text-primary-600'
                          }`}
                        >
                          {r.icon}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center gap-1.5 text-sm font-semibold text-primary-800">
                            {r.label}
                            {attivo && (
                              <span className="rounded-full bg-accent-500 px-2 py-0.5 text-[10px] font-bold uppercase text-white">
                                Attivo
                              </span>
                            )}
                          </span>
                          <span className="mt-0.5 block text-xs leading-relaxed text-primary-500">
                            {r.desc}
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </div>
                <p className="mt-2 text-xs text-primary-400">
                  Cambia stato all&apos;istante, senza ricaricare la pagina.
                </p>
              </section>

              {/* Reset dati */}
              <section>
                <h3 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-primary-400">
                  <RotateCcw className="h-4 w-4" />
                  Reset
                </h3>
                <button
                  onClick={resettaTutto}
                  className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-error-200 bg-error-50 px-4 py-2.5 text-sm font-semibold text-error-700 transition hover:bg-error-100"
                >
                  <RotateCcw className="h-4 w-4" />
                  Reset dati / LocalStorage
                </button>
                <p className="mt-2 text-xs text-primary-400">
                  Ripristina preferenze e onboarding con 1 click.
                </p>
              </section>

              {/* System Health Check */}
              <section>
                <h3 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-primary-400">
                  <Activity className="h-4 w-4" />
                  System Health Check
                </h3>
                <button
                  onClick={() => {
                    // Chiude il pannello DEV e apre il checkup in cima a tutto
                    // (z-[9999]): la modal resta sopra la toolbar e il backdrop.
                    setOpen(false);
                    setCheckupOpen(true);
                  }}
                  className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-primary-200 bg-primary-50 px-4 py-2.5 text-sm font-semibold text-primary-700 transition hover:bg-primary-100"
                >
                  <Activity className="h-4 w-4" />
                  Esegui Checkup Sito
                </button>
                <p className="mt-2 text-xs text-primary-400">
                  Verifica database, Edge Functions, rotte e servizi esterni in tempo reale.
                </p>
              </section>
            </div>
          </aside>
        </div>
      )}

      <HealthCheckModal open={checkupOpen} onClose={() => setCheckupOpen(false)} />
    </>
  );
}
