/**
 * Modulistica · esiti del bancone dell'Archivista Capo.
 *
 * Tre stati alternativi: la preparazione del documento (con i pensieri sobri di
 * `PensieriArchivista`), il bottone che apre il documento consegnato e l'avviso
 * con il riavvio quando l'archivio non individua nulla.
 *
 * Presentazione pura: fase, messaggio e azioni arrivano dal contenitore.
 */
import { FileText, RotateCcw } from 'lucide-react';
import type { DocumentoGenerato } from '../cacheService';
import { PensieriArchivista } from '../PensieriArchivista';
import type { Fase } from '../archivistaTipi';

interface EsitoArchivistaProps {
  /** Fase corrente (recupero, pronto, errore). */
  fase: Fase;
  /** Messaggio dell'Archivista per lo stato di errore. */
  messaggio: string;
  /** Documento consegnato dall'archivio, con l'origine (cache o generato). */
  pronto: { modulo: DocumentoGenerato; cache: boolean } | null;
  /** Apre l'anteprima del documento consegnato. */
  onApriDocumento: () => void;
  /** Riavvia il bancone dallo stato di errore. */
  onRicomincia: () => void;
}

export function EsitoArchivista({
  fase,
  messaggio,
  pronto,
  onApriDocumento,
  onRicomincia,
}: EsitoArchivistaProps) {
  return (
    <>
          {/* Recupero del documento */}
          {fase === 'recupero' && (
            <div className="mx-auto mt-8 max-w-lg text-left">
              <PensieriArchivista etichetta="Archivista Capo" />
            </div>
          )}

          {/* Documento pronto */}
          {fase === 'pronto' && pronto && (
            <button
              type="button"
              onClick={onApriDocumento}
              className="mt-8 inline-flex items-center gap-2 rounded-xl bg-secondary-500 px-7 py-3.5 text-base font-bold text-white shadow-soft transition hover:bg-secondary-600"
            >
              <FileText className="h-5 w-5" />
              Apri il documento
            </button>
          )}

          {/* Errore neutro */}
          {fase === 'errore' && (
            <div className="mx-auto mt-8 max-w-lg rounded-2xl border border-warning-500/40 bg-warning-50/70 p-4">
              <p className="text-sm leading-relaxed text-warning-700">{messaggio}</p>
              <button
                type="button"
                onClick={onRicomincia}
                className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-warning-500 px-4 py-2 text-sm font-semibold text-white shadow-soft transition hover:bg-warning-600"
              >
                <RotateCcw className="h-4 w-4" />
                Ricomincia
              </button>
            </div>
          )}
    </>
  );
}
