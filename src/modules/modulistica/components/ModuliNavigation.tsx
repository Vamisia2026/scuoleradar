import { Download, FolderOpen, FolderUp } from 'lucide-react';
import type { VistaModulistica } from '../types';

interface ModuliNavigationProps {
  vista: VistaModulistica;
  onNaviga: (v: VistaModulistica) => void;
}

/**
 * Barra di navigazione della sezione Modulistica: archivio (macroaree), modelli
 * salvati e «I Miei Documenti» (spazio personale dell'utente). La ricerca filtra
 * il catalogo; l'Archivista Capo (in arrivo a Ottobre per i PRO) si apre dalla
 * modale teaser, non da un tab.
 */
export function ModuliNavigation({ vista, onNaviga }: ModuliNavigationProps) {
  return (
    <div className="mt-4 flex gap-1 overflow-x-auto rounded-xl bg-primary-50 p-1">
      <button
        onClick={() => onNaviga('archivio')}
        className={`inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition ${
          vista === 'archivio' ? 'bg-white text-primary-700 shadow-soft' : 'text-primary-600 hover:text-primary-800'
        }`}
      >
        <FolderOpen className="h-4 w-4" />
        Esplora l&apos;archivio
      </button>
      <button
        onClick={() => onNaviga('miei')}
        className={`inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition ${
          vista === 'miei'
            ? 'bg-secondary-500 text-white shadow-soft'
            : 'text-secondary-700 hover:bg-secondary-50'
        }`}
      >
        <Download className="h-4 w-4" />
        I Miei Moduli Scaricati
      </button>
      {/* Spazio personale: sempre disponibile (nessun paywall PRO: sono file dell'utente). */}
      <button
        onClick={() => onNaviga('documenti')}
        aria-label="I Miei Documenti: spazio personale di archiviazione file"
        className={`inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition ${
          vista === 'documenti'
            ? 'bg-white text-primary-700 shadow-soft'
            : 'text-primary-600 hover:text-primary-800'
        }`}
      >
        <FolderUp className="h-4 w-4" />
        I Miei Documenti
      </button>
    </div>
  );
}
