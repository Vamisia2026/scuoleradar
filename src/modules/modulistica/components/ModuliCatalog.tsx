import { useMemo, useState } from 'react';
import { CheckCircle2, Download, Search } from 'lucide-react';
import { macroAree, moduli, type MacroArea, type Modulo } from '@/data/moduli';

interface ModuliCatalogProps {
  /** Callback di download (registra in locale + user_saved_modules). */
  onScarica: (m: Pick<Modulo, 'id' | 'nome' | 'tipo'>) => void;
  /** Nome dell'ultimo modulo scaricato (per il segno di spunta). */
  scaricato: string | null;
}

/**
 * Archivio/Navigazione del catalogo: ricerca rapida, filtro per macro-area
 * e griglia dei modelli disponibili.
 */
export function ModuliCatalog({ onScarica, scaricato }: ModuliCatalogProps) {
  const [macroArea, setMacroArea] = useState<MacroArea>('Tutti');
  const [query, setQuery] = useState('');

  const moduliFiltrati = useMemo(() => {
    const q = query.trim().toLowerCase();
    return moduli.filter((m) => {
      const matchArea = macroArea === 'Tutti' || m.macroArea === macroArea;
      const matchQuery = !q || `${m.nome} ${m.descrizione} ${m.categoria}`.toLowerCase().includes(q);
      return matchArea && matchQuery;
    });
  }, [macroArea, query]);

  return (
    <div className="mt-4">
      {/* Ricerca rapida */}
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-primary-400" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Cerca un modulo o documento..."
          className="w-full rounded-xl border border-primary-200 bg-white py-2.5 pl-10 pr-4 text-sm text-primary-800 outline-none transition focus:border-primary-400"
        />
      </div>

      {/* Filtri per macro-area */}
      <div className="mt-3 flex gap-1 overflow-x-auto rounded-xl bg-primary-50 p-1">
        {macroAree.map((area) => (
          <button
            key={area}
            onClick={() => setMacroArea(area)}
            className={`inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition ${
              macroArea === area ? 'bg-white text-primary-700 shadow-soft' : 'text-primary-600 hover:text-primary-800'
            }`}
          >
            {area}
          </button>
        ))}
      </div>

      {/* Griglia catalogo */}
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {moduliFiltrati.length === 0 ? (
          <div className="col-span-full rounded-xl border border-dashed border-primary-100 p-8 text-center text-sm text-primary-400">
            Nessun modulo trovato con i filtri attuali.
          </div>
        ) : (
          moduliFiltrati.map((m) => (
            <div
              key={m.nome}
              className="flex items-start justify-between gap-3 rounded-xl border border-primary-100 bg-slate-50 p-4 transition hover:border-primary-200"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="rounded-md bg-primary-100 px-2 py-0.5 text-xs font-bold text-primary-700">
                    {m.tipo}
                  </span>
                  <span className="rounded-full bg-primary-50 px-2 py-0.5 text-xs font-medium text-primary-500">
                    {m.categoria}
                  </span>
                </div>
                <p className="mt-2 truncate text-sm font-bold text-primary-800">{m.nome}</p>
                <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-primary-500">{m.descrizione}</p>
              </div>
              <button
                onClick={() => onScarica(m)}
                aria-label={`Scarica ${m.nome}`}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-primary-200 bg-white px-3 py-2 text-xs font-semibold text-primary-700 transition hover:bg-primary-50"
              >
                {scaricato === m.nome ? (
                  <CheckCircle2 className="h-4 w-4 text-accent-500" />
                ) : (
                  <Download className="h-4 w-4" />
                )}
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
