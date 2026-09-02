/**
 * Radar Status Toggle — Attivo / In Pausa (Profilo / Dashboard).
 * Quando in pausa le preferenze (province, classi, canali) vengono CONSERVATE,
 * ma il Radar non invia notifiche finché non viene riattivato.
 */
import { useState } from 'react';
import { Loader2, Radar } from 'lucide-react';
import { useApp } from '@/contexts/AppContext';

export function RadarStatusToggle() {
  const { radarAttivo, aggiornaRadarAttivo, preferenze } = useApp();
  const [inCorso, setInCorso] = useState(false);

  const cambia = async (valore: boolean): Promise<void> => {
    if (inCorso) return;
    setInCorso(true);
    try {
      await aggiornaRadarAttivo(valore);
    } finally {
      setInCorso(false);
    }
  };

  const provinceCount = preferenze.provinceCodici.length;
  const classiCount = preferenze.classiCodici.length + preferenze.materieId.length;

  return (
    <section className="rounded-2xl border border-primary-100 bg-white p-5 shadow-card">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <span
            className={`inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${
              radarAttivo ? 'bg-emerald-100 text-emerald-600' : 'bg-warning-100 text-warning-700'
            }`}
          >
            <Radar className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <h3 className="text-sm font-bold text-primary-800">Stato del Radar Scuole</h3>
            <p className="mt-0.5 text-xs leading-relaxed text-primary-500">
              {radarAttivo
                ? 'In attività: ti avvisiamo appena esce un’opportunità per il tuo profilo.'
                : 'In pausa: le tue preferenze restano salvate, ma non inviamo notifiche.'}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              {radarAttivo ? (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-black uppercase tracking-wide text-emerald-700 ring-1 ring-inset ring-emerald-300">
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                  </span>
                  🟢 Radar attivo
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-warning-50 px-3 py-1 text-[11px] font-black uppercase tracking-wide text-warning-700 ring-1 ring-inset ring-warning-300">
                  🟡 In pausa
                </span>
              )}
              {provinceCount > 0 && (
                <span className="rounded-full bg-primary-50 px-2.5 py-1 text-[10px] font-semibold text-primary-600">
                  {provinceCount} {provinceCount === 1 ? 'provincia' : 'province'}
                </span>
              )}
              {classiCount > 0 && (
                <span className="rounded-full bg-primary-50 px-2.5 py-1 text-[10px] font-semibold text-primary-600">
                  {classiCount} tra classi e materie
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Interruttore */}
        <div className="flex shrink-0 items-center gap-3">
          <span
            className={`text-xs font-bold uppercase tracking-wide ${radarAttivo ? 'text-emerald-600' : 'text-warning-700'}`}
          >
            {radarAttivo ? 'Attivo' : 'In pausa'}
          </span>
          <button
            type="button"
            role="switch"
            aria-checked={radarAttivo}
            aria-label="Attiva o metti in pausa il Radar"
            disabled={inCorso}
            onClick={() => void cambia(!radarAttivo)}
            className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors disabled:opacity-50 ${
              radarAttivo ? 'bg-emerald-500' : 'bg-slate-300'
            }`}
          >
            {inCorso ? (
              <Loader2 className="absolute left-1/2 h-4 w-4 -translate-x-1/2 animate-spin text-white" />
            ) : (
              <span
                className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                  radarAttivo ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            )}
          </button>
        </div>
      </div>
    </section>
  );
}
