import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, FileText, FolderOpen, House } from 'lucide-react';
import {
  type DocumentoModulistica,
  type MacroAreaModulistica,
  type SottoCategoriaModulistica,
} from '@/data/moduli';

/** Numero di sottocategorie visibili per pagina (griglia 3×5 → 15). */
const PER_PAGINA = 15;

interface EsploraArchivioProps {
  macroArea: MacroAreaModulistica | null;
  /** Modalità compatta: riduce i margini interni (ricerca in corso). */
  compatto?: boolean;
  /** Apre un documento terminale (profilo completo → generazione cache-first). */
  onApriDocumento: (doc: DocumentoModulistica, percorso: string[]) => void;
}

interface Livello {
  sotto: SottoCategoriaModulistica[];
  documenti: DocumentoModulistica[];
}

/** Risolve il livello corrente partendo dalla macroarea e dal percorso di id. */
function livelloCorrente(area: MacroAreaModulistica | null, percorso: string[]): Livello {
  let livello: Livello = { sotto: area?.sotto ?? [], documenti: [] };
  for (const id of percorso) {
    const figlio = livello.sotto.find((s) => s.id === id);
    if (!figlio) break;
    livello = { sotto: figlio.sotto ?? [], documenti: figlio.documenti ?? [] };
  }
  return livello;
}

/** Nomi del percorso (macroarea + sottocartelle) per il breadcrumb. */
function nomiPercorso(area: MacroAreaModulistica | null, percorso: string[]): string[] {
  const nomi: string[] = area ? [area.nome] : [];
  let livello: Livello = { sotto: area?.sotto ?? [], documenti: [] };
  for (const id of percorso) {
    const figlio = livello.sotto.find((s) => s.id === id);
    if (!figlio) break;
    nomi.push(figlio.nome);
    livello = { sotto: figlio.sotto ?? [], documenti: figlio.documenti ?? [] };
  }
  return nomi;
}

/**
 * Contenitore rettangolare principale dell'archivio (navigazione a matrioska):
 * si procede SOLO di sottocategoria in sottocategoria (griglia 3×5 paginata).
 * I documenti finali compaiono esclusivamente nella cartella finale
 * (1 solo modulo per cartella).
 */
export function EsploraArchivio({ macroArea, compatto = false, onApriDocumento }: EsploraArchivioProps) {
  const [percorso, setPercorso] = useState<string[]>([]);
  const [pagina, setPagina] = useState(1);

  const livello = useMemo(() => livelloCorrente(macroArea, percorso), [macroArea, percorso]);
  const breadcrumb = useMemo(() => nomiPercorso(macroArea, percorso), [macroArea, percorso]);

  const totalePagine = Math.max(1, Math.ceil(livello.sotto.length / PER_PAGINA));
  const paginaSicura = Math.min(pagina, totalePagine);
  const sottoPagina = livello.sotto.slice((paginaSicura - 1) * PER_PAGINA, paginaSicura * PER_PAGINA);

  const scendi = (sotto: SottoCategoriaModulistica) => {
    const ultimo = percorso[percorso.length - 1];
    if (ultimo === sotto.id) return; // evita doppio click duplicato
    setPagina(1);
    setPercorso((prev) => [...prev, sotto.id]);
  };

  const sali = (indice: number) => {
    setPagina(1);
    setPercorso((prev) => prev.slice(0, indice));
  };

  if (!macroArea) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-primary-100 p-12 text-center">
        <FolderOpen className="h-10 w-10 text-primary-200" />
        <p className="max-w-md text-sm leading-relaxed text-primary-500">
          Scegli una macroarea qui sopra (Sostegno, Infanzia, Primaria…) e apri la cartella che ti
          serve: il contenitore mostrerà le sottocategorie e, scendendo, il documento esatto.
        </p>
      </div>
    );
  }
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
          <div className={`mx-auto max-w-2xl space-y-3 ${compatto ? 'mt-3' : 'mt-4'}`}>
            {livello.documenti.map((doc) => (
              <div
                key={doc.id}
                className={`flex items-center justify-between gap-4 rounded-xl border border-primary-100 bg-white shadow-soft transition hover:border-primary-300 ${
                  compatto ? 'px-4 py-3' : 'px-5 py-4'
                }`}
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <FileText className="h-5 w-5 shrink-0 text-primary-400" />
                    <p className="truncate text-base font-bold text-primary-800">{doc.nome}</p>
                    <span className="shrink-0 rounded-md bg-primary-100 px-2 py-0.5 text-[10px] font-bold text-primary-700">
                      {doc.tipo}
                    </span>
                  </div>
                  <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-primary-500">
                    {doc.descrizione}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onApriDocumento(doc, breadcrumb)}
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-secondary-500 px-5 py-3 text-sm font-bold text-white shadow-soft transition hover:bg-secondary-600"
                >
                  <FileText className="h-4 w-4" />
                  Apri documento
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {sottoPagina.length === 0 && livello.documenti.length === 0 && (
        <p className="mt-6 rounded-xl border border-dashed border-primary-100 p-8 text-center text-sm text-primary-400">
          Questa cartella è vuota. Torna indietro con il breadcrumb per scegliere un altro percorso.
        </p>
      )}
    </div>
  );
}

