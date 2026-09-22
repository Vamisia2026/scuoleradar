/**
 * Notizie · testata editoriale dell'hero («Daily Planet»).
 *
 * Masthead con righe doppie, sottotitolo, slogan, badge di fiducia e menu
 * Categorie (scrollabile su mobile, a capo da `lg`). Il menu viene mostrato
 * solo se arrivano categorie e un callback: senza filtro la colonna resta la
 * sola testata.
 *
 * Presentazione pura: copy, categorie e selezione arrivano dal contenitore.
 */
import { BadgeCheck, FileCheck2, Newspaper } from 'lucide-react';

interface TestataEditorialeProps {
  /** Sottotitolo editoriale ufficiale della pagina Notizie. */
  sottotitolo: string;
  /** Slogan in carattere display, mostrato tra virgolette. */
  slogan: string;
  /** Voci del menu categorie (es. 'Tutte', 'GPS'…). */
  categorie: string[];
  /** Categoria attiva. */
  categoria: string;
  /** Conteggio articoli per categoria (chiavi = nomi categoria). */
  conteggi: Record<string, number>;
  /** Callback di selezione: se assente il menu categorie non compare. */
  onCategoriaChange?: (categoria: string) => void;
}

export function TestataEditoriale({
  sottotitolo,
  slogan,
  categorie,
  categoria,
  conteggi,
  onCategoriaChange,
}: TestataEditorialeProps) {
  return (
            <div className="flex min-w-0 flex-col lg:col-span-7">
              <div className="border-b-4 border-double border-primary-900/80 py-3 sm:py-4">
                <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-primary-500">
                  <span className="inline-flex items-center gap-1.5">
                    <Newspaper className="h-3.5 w-3.5" />
                    Rassegna stampa
                  </span>
                  <span className="hidden sm:inline">Edizione Docenti &amp; ATA</span>
                </div>
                <h1 className="mt-2 font-display text-2xl font-black leading-tight tracking-tight text-primary-900 sm:text-4xl">
                  Notizie <span className="text-secondary-500">per chi lavora nella Scuola</span>
                </h1>
              </div>

              <p className="mt-3 min-w-0 max-w-xl text-sm leading-relaxed text-primary-700 sm:text-lg">
                {sottotitolo}
              </p>

              {/* Slogan: sotto il sottotitolo, sopra i badge di fiducia */}
              <p className="mt-2 font-display text-xl font-semibold leading-snug text-primary-900 sm:text-2xl">
                «{slogan}»
              </p>

              <div className="mt-3 flex flex-wrap gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-primary-200 bg-white px-3 py-1 text-xs font-semibold text-primary-700">
                  <BadgeCheck className="h-3.5 w-3.5 text-accent-500" />
                  Solo fonti ufficiali verificate
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-primary-200 bg-white px-3 py-1 text-xs font-semibold text-primary-700">
                  <FileCheck2 className="h-3.5 w-3.5 text-secondary-500" />
                  Max 3 articoli a settimana
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-primary-200 bg-white px-3 py-1 text-xs font-semibold text-primary-700">
                  <span className="h-1.5 w-1.5 animate-pulse-soft rounded-full bg-accent-500" />
                  Aggiornato ogni giorno
                </span>
              </div>

              {/* Menu Categorie: subito sotto i badge di verifica, occupa lo spazio
                  residuo della colonna e chiude il suo bordo inferiore in linea con
                  il fondo del box "PROSSIME SCADENZE" a destra. */}
              {onCategoriaChange && categorie.length > 0 && (
                <div
                  role="toolbar"
                  aria-label="Filtra le notizie per categoria"
                  className="mt-4 flex w-full min-w-0 items-center gap-1.5 overflow-x-auto whitespace-nowrap py-1 no-scrollbar lg:flex-wrap lg:overflow-visible lg:whitespace-normal"
                >
                  <span className="mr-1 shrink-0 text-[11px] font-black uppercase tracking-[0.16em] text-secondary-600">
                    Categorie
                  </span>
                  {categorie.map((c) => {
                    const attiva = categoria === c;
                    const conteggio = conteggi[c] ?? 0;
                    return (
                      <button
                        key={c}
                        type="button"
                        onClick={() => onCategoriaChange(c)}
                        aria-pressed={attiva}
                        className={`inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-bold uppercase tracking-wide transition ${
                          attiva
                            ? 'bg-primary-700 text-white shadow-soft'
                            : 'bg-white text-primary-600 ring-1 ring-inset ring-primary-200 hover:bg-primary-50'
                        }`}
                      >
                        {c}
                        {c !== 'Tutte' && conteggio > 0 && (
                          <span
                            className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold tabular-nums ${
                              attiva ? 'bg-white/20 text-white' : 'bg-primary-100 text-primary-500'
                            }`}
                          >
                            {conteggio}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
  );
}
