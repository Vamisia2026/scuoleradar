import { useEffect, useState } from 'react';
import { Activity, Loader2, RotateCcw } from 'lucide-react';
import { Modal } from '@/components/Modal';
import { eseguiHealthCheck, type HealthCheckResult } from '@/services/healthCheck';

const BADGE: Record<
  HealthCheckResult['status'],
  { etichetta: string; emoji: string; cls: string }
> = {
  ok: {
    etichetta: 'OK',
    emoji: '🟢',
    cls: 'border-accent-200 bg-accent-50 text-accent-700',
  },
  warning: {
    etichetta: 'WARNING',
    emoji: '🟡',
    cls: 'border-warning-200 bg-warning-50 text-warning-700',
  },
  error: {
    etichetta: 'ERROR',
    emoji: '🔴',
    cls: 'border-error-200 bg-error-50 text-error-700',
  },
};

/**
 * Modal "System Health Check" (solo sviluppo/admin): esegue i test diagnostici
 * in tempo reale e mostra i risultati con badge colorati e latenza.
 */
export function HealthCheckModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [risultati, setRisultati] = useState<HealthCheckResult[]>([]);
  const [inCorso, setInCorso] = useState(false);

  const esegui = async () => {
    setInCorso(true);
    const r = await eseguiHealthCheck();
    setRisultati(r);
    setInCorso(false);
  };

  useEffect(() => {
    if (open) void esegui();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const conteggio = (stato: HealthCheckResult['status']) =>
    risultati.filter((r) => r.status === stato).length;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="System Health Check"
      zClass="z-[9999]"
    >
      <div className="space-y-4">
        {/* Intestazione + Riesegui */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="flex items-center gap-1.5 text-sm text-primary-500">
            <Activity className="h-4 w-4 text-primary-400" />
            Diagnostica in tempo reale dello stato dell&apos;app
          </p>
          <button
            type="button"
            onClick={() => void esegui()}
            disabled={inCorso}
            className="inline-flex items-center gap-1.5 rounded-lg border border-primary-200 bg-white px-3 py-1.5 text-xs font-semibold text-primary-700 transition hover:bg-primary-50 disabled:opacity-60"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Riesegui Test
          </button>
        </div>

        {/* Riepilogo conteggi */}
        <div className="flex flex-wrap gap-2 text-xs font-semibold">
          <span className="rounded-full border border-accent-200 bg-accent-50 px-2.5 py-1 text-accent-700">
            🟢 {conteggio('ok')} OK
          </span>
          <span className="rounded-full border border-warning-200 bg-warning-50 px-2.5 py-1 text-warning-700">
            🟡 {conteggio('warning')} WARNING
          </span>
          <span className="rounded-full border border-error-200 bg-error-50 px-2.5 py-1 text-error-700">
            🔴 {conteggio('error')} ERROR
          </span>
        </div>

        {/* Risultati */}
        {inCorso && risultati.length === 0 ? (
          <p className="flex items-center gap-2 rounded-xl border border-primary-100 bg-primary-50 px-4 py-6 text-sm text-primary-600">
            <Loader2 className="h-4 w-4 animate-spin" />
            Esecuzione dei test in corso…
          </p>
        ) : (
          <ul className="space-y-2">
            {risultati.map((r) => (
              <li
                key={r.name}
                className="flex items-start gap-3 rounded-xl border border-primary-100 bg-white p-3"
              >
                <span
                  className={`inline-flex shrink-0 items-center gap-1 rounded-lg border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${BADGE[r.status].cls}`}
                >
                  {BADGE[r.status].emoji} {BADGE[r.status].etichetta}
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-primary-800">{r.name}</p>
                  <p className="mt-0.5 text-xs leading-relaxed text-primary-600">{r.message}</p>
                  {r.latencyMs !== undefined && (
                    <p className="mt-0.5 text-[11px] text-primary-400">Latenza: {r.latencyMs} ms</p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Modal>
  );
}
