import { Download, FolderOpen, Sparkles } from 'lucide-react';
import type { VistaModulistica } from '../types';

interface ModuliNavigationProps {
  vista: VistaModulistica;
  onNaviga: (v: VistaModulistica) => void;
}

/**
 * Barra di navigazione della sezione Modulistica:
 * separa l'archivio/navigazione (catalogo e modelli salvati) dal creatore.
 */
export function ModuliNavigation({ vista, onNaviga }: ModuliNavigationProps) {
  return (
    <div className="mt-4 flex gap-1 overflow-x-auto rounded-xl bg-primary-50 p-1">
      <button
        onClick={() => onNaviga('catalogo')}
        className={`inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition ${
          vista === 'catalogo' ? 'bg-white text-primary-700 shadow-soft' : 'text-primary-600 hover:text-primary-800'
        }`}
      >
        <FolderOpen className="h-4 w-4" />
        Catalogo
      </button>
      <button
        onClick={() => onNaviga('genera')}
        className={`inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition ${
          vista === 'genera'
            ? 'bg-secondary-500 text-white shadow-soft'
            : 'text-secondary-700 hover:bg-secondary-50'
        }`}
      >
        <Sparkles className="h-4 w-4" />
        Genera un Documento
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
        I miei Modelli Scaricati
      </button>
    </div>
  );
}
