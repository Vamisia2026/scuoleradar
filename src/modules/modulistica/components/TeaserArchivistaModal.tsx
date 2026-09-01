import { FolderSearch } from 'lucide-react';
import { Modal } from '@/components/Modal';

interface TeaserArchivistaModalProps {
  open: boolean;
  onClose: () => void;
}

/**
 * Teaser "Archivista Capo — In arrivo ad Ottobre per utenti PRO".
 *
 * Modale informativa mostrata a chiunque (BASE e PRO) clicchi sul pulsante
 * dedicato accanto alla barra di ricerca. NON avvia la chat: il flusso
 * guidato arriverà con il rilascio per gli utenti PRO.
 */
export function TeaserArchivistaModal({ open, onClose }: TeaserArchivistaModalProps) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Archivista Capo — In arrivo ad Ottobre per utenti PRO"
      size="md"
      cardClassName="bg-slate-50"
    >
      <div className="text-center">
        <span className="mx-auto inline-flex h-12 w-12 items-center justify-center rounded-full bg-primary-100 text-primary-500">
          <FolderSearch className="h-6 w-6" />
        </span>
        <p className="mt-4 text-base font-semibold text-slate-800">
          La ricerca guidata per la tua modulistica scolastica.
        </p>
        <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-slate-500">
          L&apos;Archivista Capo è attualmente in fase di affinamento. A differenza della ricerca classica che ti
          mostra un elenco di documenti correlati lasciandoti il dubbio su quale scegliere, con l&apos;Archivista
          Capo ti basterà indicare le tue esigenze: analizzerà la tua richiesta, ti farà un paio di domande
          mirate e ti porgerà direttamente il modulo ufficiale perfetto per la tua situazione.
        </p>
        <button
          type="button"
          onClick={onClose}
          className="mt-6 inline-flex items-center gap-2 rounded-xl bg-sky-700 px-8 py-3 text-sm font-bold text-white shadow-soft transition hover:bg-sky-800"
        >
          Ho capito
        </button>
      </div>
    </Modal>
  );
}
