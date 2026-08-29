import { FolderOpen } from 'lucide-react';
import {
  macroAreeModulistica,
  ordineMacroAree,
  type MacroAreaModulistica,
} from '@/data/moduli';

interface MacroAreaMenuProps {
  /** Id della macroarea attualmente esplorata. */
  attiva: string | null;
  /** Modalità compatta: riduce l'altezza delle schede (ricerca in corso). */
  compatto?: boolean;
  /** Seleziona/apre la macroarea (click o doppio click). */
  onSeleziona: (area: MacroAreaModulistica) => void;
}

/**
 * Menu a schede con le Macroaree dell'archivio, nell'ordine esatto:
 * Infanzia · Primaria · Secondaria 1° Grado · Secondaria 2° Grado ·
 * Università · Enti · Altro · Sostegno.
 * Un click (o un doppio click) apre la macroarea: il contenitore sotto
 * mostra le sue sottocategorie in una griglia 3×5 con paginazione.
 */
export function MacroAreaMenu({ attiva, compatto = false, onSeleziona }: MacroAreaMenuProps) {
  const aree: MacroAreaModulistica[] = ordineMacroAree
    .map((nome) => macroAreeModulistica.find((m) => m.nome === nome))
    .filter((m): m is MacroAreaModulistica => Boolean(m));

  return (
    <div
      className={`flex gap-1.5 overflow-x-auto rounded-2xl border border-primary-100 bg-white shadow-card ${
        compatto ? 'p-1' : 'p-1.5'
      }`}
    >
      {aree.map((area) => {
        const selezionata = area.id === attiva;
        return (
          <button
            key={area.id}
            type="button"
            title={`Esplora ${area.nome} (doppio click per aprire)`}
            onClick={() => onSeleziona(area)}
            onDoubleClick={() => onSeleziona(area)}
            className={`inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-xl text-sm font-semibold transition ${
              compatto ? 'px-3 py-1.5' : 'px-4 py-2.5'
            } ${
              selezionata
                ? 'bg-primary-500 text-white shadow-soft'
                : 'text-primary-700 hover:bg-primary-50'
            }`}
          >
            <FolderOpen className="h-4 w-4" />
            {area.nome}
          </button>
        );
      })}
    </div>
  );
}
