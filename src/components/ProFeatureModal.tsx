import { Link } from 'react-router-dom';
import { Modal } from '@/components/Modal';

/**
 * Modal paywall leggero per le funzionalità PRO (es. "Opportunità mappate").
 * Si apre al posto dell'espansione per gli utenti del piano Base.
 */
export function ProFeatureModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Modal open={open} onClose={onClose} title="Funzionalità PRO" size="sm">
      <div className="space-y-4">
        <p className="text-sm leading-relaxed text-primary-600">
          Questa funzionalità è riservata agli account PRO. Passa a PRO per accedere all&apos;elenco
          completo delle opportunità rilevate in tempo reale.
        </p>
        <div className="flex flex-col gap-2 sm:flex-row-reverse">
          <Link
            to="/prezzi"
            onClick={onClose}
            className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-secondary-500 px-5 py-3 text-sm font-semibold text-white shadow-soft transition hover:bg-secondary-600 sm:w-auto"
          >
            Passa a PRO
          </Link>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl border border-primary-200 px-5 py-3 text-sm font-medium text-primary-700 transition hover:bg-primary-50 sm:w-auto"
          >
            Chiudi
          </button>
        </div>
      </div>
    </Modal>
  );
}
