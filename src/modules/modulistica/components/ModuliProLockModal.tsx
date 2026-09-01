import { useNavigate } from 'react-router-dom';
import { FolderOpen, Sparkles } from 'lucide-react';
import { Modal } from '@/components/Modal';

/**
 * Paywall soft-sell per gli utenti Base che cliccano "I Miei Moduli Scaricati":
 * spiega il valore dell'archivio personale e invita a passare a PRO.
 */
export function ModuliProLockModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate();
  return (
    <Modal open={open} onClose={onClose} title="Archivio Personale Moduli" size="sm">
      <div className="flex flex-col items-center gap-4 text-center">
        <span className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-secondary-50 text-secondary-500">
          <FolderOpen className="h-7 w-7" />
        </span>
        <p className="text-sm leading-relaxed text-primary-600">
          Salva, organizza e ritrova i tuoi moduli scaricati da qualsiasi dispositivo senza doverli
          cercare ogni volta. Questa funzione è riservata agli utenti PRO.
        </p>
        <button
          type="button"
          onClick={() => {
            onClose();
            navigate('/prezzi');
          }}
          className="inline-flex items-center gap-1.5 rounded-xl bg-secondary-500 px-5 py-2.5 text-sm font-semibold text-white shadow-soft transition hover:bg-secondary-600"
        >
          <Sparkles className="h-4 w-4" />
          Passa a PRO
        </button>
        <button
          type="button"
          onClick={onClose}
          className="text-sm font-medium text-primary-500 transition hover:text-primary-700"
        >
          Chiudi
        </button>
      </div>
    </Modal>
  );
}
