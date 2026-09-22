/**
 * Modulistica · intestazione del bancone dell'Archivista Capo.
 *
 * Fascia scura con sigillo e titolo, più le due azioni di servizio:
 * «Ricomincia» (azzera l'intervista) e «Archivio» (torna alla consultazione).
 *
 * Presentazione pura: le azioni arrivano dal contenitore.
 */
import { ArrowLeft, FileText, RotateCcw } from 'lucide-react';

interface IntestazioneArchivistaProps {
  /** Azzera l'intervista e riparte dal saluto. */
  onRicomincia: () => void;
  /** Torna alla vista archivio. */
  onTornaAllArchivio: () => void;
}

export function IntestazioneArchivista({
  onRicomincia,
  onTornaAllArchivio,
}: IntestazioneArchivistaProps) {
  return (
      <div className="flex items-center justify-between gap-3 bg-gradient-to-r from-primary-900 via-primary-800 to-primary-700 px-6 py-4">
        <div className="flex min-w-0 items-center gap-3">
          <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/15 text-white">
            <FileText className="h-5 w-5" />
          </span>
          <p className="truncate text-base font-bold text-white">Archivista Capo</p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <button
            type="button"
            onClick={onRicomincia}
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/25 bg-white/10 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-white/20"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Ricomincia
          </button>
          <button
            type="button"
            onClick={onTornaAllArchivio}
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/25 bg-white/10 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-white/20"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Archivio
          </button>
        </div>
      </div>
  );
}
