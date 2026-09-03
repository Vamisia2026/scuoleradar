import { useEffect, useMemo, useRef, useState } from 'react';
import { BookmarkPlus, Check, Database, FileText, Printer } from 'lucide-react';
import { Modal } from '@/components/Modal';
import { useToast } from '@/components/Toast';
import { costruisciDocumento } from './pdfGenerator';
import type { DocumentoGenerato } from './cacheService';

interface ModuloPreviewProps {
  open: boolean;
  onClose: () => void;
  modulo: DocumentoGenerato | null;
  cache?: boolean;
  /** Callback di salvataggio nei "Modelli Scaricati" (user_saved_modules). */
  onSalva?: (modulo: DocumentoGenerato) => Promise<{ ok: boolean; errore?: string }>;
}

/**
 * Anteprima del documento generato in un iframe isolato (srcDoc):
 *  - l'iframe contiene l'HTML completo con logo, indice e regole @page,
 *    quindi `iframe.contentWindow.print()` stampa SOLO il documento
 *  - badge "cache" quando il documento proviene dall'archivio (costo API zero)
 *  - pulsanti "Stampa / Salva PDF" e "Salva nei miei modelli"
 */
export function ModuloPreview({ open, onClose, modulo, cache, onSalva }: ModuloPreviewProps) {
  const frameRef = useRef<HTMLIFrameElement | null>(null);
  const { mostraToast } = useToast();
  const [salvato, setSalvato] = useState(false);

  const doc = useMemo(
    () => (modulo ? costruisciDocumento(modulo.title, modulo.content_html) : null),
    [modulo],
  );

  useEffect(() => {
    setSalvato(false);
  }, [open, modulo?.id]);

  const stampa = () => {
    const win = frameRef.current?.contentWindow;
    if (!win) return;
    win.focus();
    win.print();
  };

  const salva = async () => {
    if (!onSalva || !modulo || salvato) return;
    const res = await onSalva(modulo);
    if (res.ok) {
      setSalvato(true);
      mostraToast('successo', 'Documento salvato nei tuoi "Modelli Scaricati".');
    } else {
      mostraToast('errore', res.errore ?? 'Salvataggio non riuscito.');
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Anteprima documento" size="xl">
      <div className="space-y-4">
        {/* Barra azioni */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-base font-bold text-primary-800">{modulo?.title}</h3>
            {doc && (
              <p className="text-xs text-primary-400">
                Anteprima stampabile · ~{doc.pagineStimate} pagine A4
                {doc.conIndice ? ' · indice automatico incluso' : ''}
              </p>
            )}
          </div>
          {cache && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-accent-50 px-3 py-1 text-xs font-semibold text-accent-700">
              <Database className="h-3.5 w-3.5" />
              Ritrovato in archivio · costo di generazione zero
            </span>
          )}
          <button
            onClick={() => void salva()}
            disabled={salvato || !onSalva}
            className={`inline-flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-sm font-semibold shadow-soft transition disabled:cursor-not-allowed disabled:opacity-50 ${
              salvato
                ? 'bg-accent-50 text-accent-700 ring-1 ring-accent-200'
                : 'border border-primary-200 bg-white text-primary-700 hover:bg-primary-50'
            }`}
          >
            {salvato ? <Check className="h-4 w-4" /> : <BookmarkPlus className="h-4 w-4" />}
            {salvato ? 'Salvato nei tuoi modelli' : 'Salva nei miei modelli'}
          </button>
          <button
            onClick={stampa}
            className="inline-flex items-center gap-1.5 rounded-xl bg-secondary-500 px-4 py-2.5 text-sm font-semibold text-white shadow-soft transition hover:bg-secondary-600"
          >
            <Printer className="h-4 w-4" />
            Stampa / Salva PDF
          </button>
        </div>

        {/* Anteprima documento */}
        {doc && modulo ? (
          <iframe
            ref={frameRef}
            title={`Anteprima ${modulo.title}`}
            srcDoc={doc.html}
            className="h-[70vh] w-full rounded-xl border border-primary-100 bg-white shadow-card"
          />
        ) : (
          <div className="flex h-[40vh] items-center justify-center rounded-xl border border-dashed border-primary-100 text-sm text-primary-400">
            <FileText className="mr-2 h-5 w-5" />
            Nessun documento da visualizzare.
          </div>
        )}

        <p className="text-xs leading-relaxed text-primary-400">
          Stampando scegli "Salva come PDF" per ottenere il file. Intestazione e piè di pagina
          (logo e numerazione) vengono aggiunti automaticamente: basta chiudere la finestra di
          stampa quando hai finito. Per un documento pulito da inoltrare come atto d&apos;ufficio,
          nella finestra di stampa disattiva &quot;Intestazioni e piè di pagina&quot; del browser:
          il layout interno del documento è già completo di intestazione, titolo e chiusura.
        </p>
      </div>
    </Modal>
  );
}
