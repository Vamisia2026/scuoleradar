import { useNavigate } from 'react-router-dom';
import { FolderOpen, Lock, Sparkles } from 'lucide-react';
import { Modal } from '@/components/Modal';

/**
 * Modale dedicato per gli utenti Base che cliccano la cartella "Moduli scaricati":
 * spiega che l'archiviazione è una Funzionalità PRO e invita all'aggiornamento.
 */
export function ModuliProLockModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate();
  return (
    <Modal open={open} onClose={onClose} title="Moduli scaricati — Funzionalità PRO" size="sm">
      <div className="flex flex-col items-center gap-4 text-center">
        <span className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-secondary-50 text-secondary-500">
          <FolderOpen className="h-7 w-7" />
        </span>
        <div>
          <p className="flex items-center justify-center gap-1.5 text-sm font-bold text-primary-800">
            <Lock className="h-4 w-4 text-secondary-500" />
            Archiviazione riservata agli account PRO
          </p>
          <p className="mt-2 text-sm leading-relaxed text-primary-600">
            La funzionalità di archiviazione dei moduli scaricati è riservata agli account PRO.
            Con il PRO conservi tutti i tuoi documenti e modelli nel tuo archivio personale, sempre
            a portata di mano.
          </p>
        </div>
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
          Non ora
        </button>
      </div>
    </Modal>
  );
}
