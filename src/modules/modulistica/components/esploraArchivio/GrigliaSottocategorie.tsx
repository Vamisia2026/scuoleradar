/**
 * Modulistica · Archivio — vista a drill-down dell'albero (macroarea → cartelle).
 *
 * Comprende breadcrumb con tasto «casa», descrizione della macroarea al primo
 * livello, griglia 3×5 delle sottocategorie con paginazione, cartella terminale
 * con i documenti e stato vuoto. Presentazione pura: percorso, livello e handler
 * di navigazione arrivano da `EsploraArchivio`.
 */
import type { Dispatch, SetStateAction } from 'react';
import { ChevronLeft, ChevronRight, FolderOpen, House } from 'lucide-react';
import type {
  DocumentoModulistica,
  MacroAreaModulistica,
  SottoCategoriaModulistica,
} from '@/data/moduli';
import type { Livello } from './alberoCatalogo';
import { CardModulo } from './CardModulo';

interface GrigliaSottocategorieProps {
  /** Macroarea attualmente aperta (mai null: il contenitore ha già il guard). */
  macroArea: MacroAreaModulistica;
  /** Percorso di id dall'interno della macroarea (vuoto = primo livello). */
  percorso: string[];
  /** Nomi leggibili del percorso (per il breadcrumb). */
  breadcrumb: string[];
  /** Livello corrente dell'albero (sottocategorie + documenti). */
  livello: Livello;
  /** Sottocategorie della pagina corrente. */
  sottoPagina: SottoCategoriaModulistica[];
  /** Numero totale di pagine della griglia. */
  totalePagine: number;
  /** Pagina corrente (già limitata al range valido). */
  paginaSicura: number;
  /** Cambia pagina della griglia. */
  setPagina: Dispatch<SetStateAction<number>>;
  /** Scende di un livello nella sottocategoria indicata. */
  scendi: (sotto: SottoCategoriaModulistica) => void;
  /** Risale al livello del breadcrumb indicato. */
  sali: (indice: number) => void;
  /** Modalità compatta: riduce i margini interni. */
  compatto: boolean;
  /** Apre un documento terminale. */
  onApriDocumento: (doc: DocumentoModulistica, percorso: string[]) => void;
}

export function GrigliaSottocategorie({
  macroArea,
  percorso,
  breadcrumb,
  livello,
  sottoPagina,
  totalePagine,
  paginaSicura,
  setPagina,
  scendi,
  sali,
  compatto,
  onApriDocumento,
}: GrigliaSottocategorieProps) {
  return (
    <div className={`animate-fade-in ${compatto ? 'mt-2' : 'mt-4'}`}>
      {/* Breadcrumb + tasto casa */}
      <nav className="flex flex-wrap items-center gap-1 text-xs" aria-label="Percorso">
        <button
          type="button"
          onClick={() => sali(0)}
          className="inline-flex items-center gap-1 rounded-lg px-2 py-1 font-semibold text-primary-500 transition hover:bg-primary-50 hover:text-primary-700"
          title="Torna alle macroaree"
        >
          <House className="h-3.5 w-3.5" />
          Macroaree
        </button>
        {breadcrumb.map((nome, i) => (
          <span key={`${i}-${nome}`} className="flex items-center gap-1">
            <span className="text-primary-300">/</span>
            {i === breadcrumb.length - 1 ? (
              <span className="rounded-lg bg-primary-50 px-2 py-1 font-bold text-primary-800">{nome}</span>
            ) : (
              <button
                type="button"
                onClick={() => sali(i)}
                className="rounded-lg px-2 py-1 font-medium text-primary-500 transition hover:bg-primary-50 hover:text-primary-700"
              >
                {nome}
              </button>
            )}
          </span>
        ))}
      </nav>

      {/* Descrizione della macroarea (visibile al primo livello, prima delle cartelle) */}
      {percorso.length === 0 && macroArea.descrizione && (
        <div className="mt-3 rounded-xl border border-primary-100 bg-primary-50/70 px-4 py-3 text-sm leading-relaxed text-primary-600">
          {macroArea.descrizione}
        </div>
      )}

      {/* Griglia sottocategorie 3×3 con paginazione */}
      {sottoPagina.length > 0 && (
        <div className={compatto ? 'mt-2' : 'mt-4'}>
          <div
            className={
              compatto ? 'grid grid-cols-2 gap-2.5 lg:grid-cols-3' : 'grid grid-cols-2 gap-3 lg:grid-cols-3'
            }
          >
            {sottoPagina.map((sotto) => (
              <button
                key={sotto.id}
                type="button"
                title="Doppio click per aprire la cartella"
                onClick={() => scendi(sotto)}
                onDoubleClick={() => scendi(sotto)}
                className={`group flex items-start gap-3 rounded-xl border border-primary-100 bg-slate-50 text-left transition hover:border-primary-300 hover:bg-white hover:shadow-soft ${
                  compatto ? 'p-3' : 'p-4'
                }`}
              >
                <span className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-100 text-primary-600 transition group-hover:bg-primary-500 group-hover:text-white">
                  <FolderOpen className="h-[18px] w-[18px]" />
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-bold text-primary-800">
                    {sotto.nome}
                  </span>
                  {sotto.descrizione && (
                    <span className="mt-0.5 block line-clamp-2 text-xs leading-relaxed text-primary-500">
                      {sotto.descrizione}
                    </span>
                  )}
                </span>
              </button>
            ))}
          </div>

          {/* Frecce di paginazione */}
          {totalePagine > 1 && (
            <div className="mt-4 flex items-center justify-center gap-3">
              <button
                type="button"
                aria-label="Pagina precedente"
                disabled={paginaSicura <= 1}
                onClick={() => setPagina((p) => Math.max(1, p - 1))}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-primary-200 bg-white text-primary-600 transition hover:bg-primary-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="text-xs font-semibold text-primary-500">
                Pagina {paginaSicura} di {totalePagine}
              </span>
              <button
                type="button"
                aria-label="Pagina successiva"
                disabled={paginaSicura >= totalePagine}
                onClick={() => setPagina((p) => Math.min(totalePagine, p + 1))}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-primary-200 bg-white text-primary-600 transition hover:bg-primary-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      )}


      {/* Cartella finale: i moduli compaiono SOLO in fondo all'albero */}
      {sottoPagina.length === 0 && livello.documenti.length > 0 && (
        <div className={compatto ? 'mt-3' : 'mt-6'}>
          <p className="text-center text-xs font-bold uppercase tracking-wide text-primary-400">
            Cartella finale · moduli disponibili
          </p>
          <div
            key={`cartella-${percorso.join('/')}`}
            className={`grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 ${compatto ? 'mt-3' : 'mt-4'}`}
          >
            {livello.documenti.map((doc, index) => (
              <CardModulo
                key={doc.id}
                doc={doc}
                percorso={breadcrumb}
                onApri={onApriDocumento}
                index={index}
              />
            ))}
          </div>
        </div>
      )}

      {sottoPagina.length === 0 && livello.documenti.length === 0 && (
        <p className="mt-6 rounded-xl border border-dashed border-primary-100 p-8 text-left text-sm text-primary-400">
          Questa cartella è vuota. Torna indietro con il breadcrumb per scegliere un altro percorso.
        </p>
      )}
    </div>
  );
}
