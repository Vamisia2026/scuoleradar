import { Download, Eye, Loader2, Trash2 } from 'lucide-react';
import type { Modulo } from '@/data/moduli';
import type { VoceModulo } from '../types';

interface SavedModuliProps {
  caricamento: boolean;
  voci: VoceModulo[];
  /** Apre l'anteprima di un documento generato (cache). */
  onApriGenerato: (key: string) => void;
  /** Ri-scarica un modulo del catalogo. */
  onScarica: (m: Pick<Modulo, 'id' | 'nome' | 'tipo'>) => void;
  /** Rimuove una voce (locale e/o DB). */
  onRimuovi: (voce: VoceModulo) => void;
}

function formatData(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('it-IT', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return '';
  }
}

/**
 * Archivio/Navigazione: tab "I miei Modelli Scaricati".
 * Unisce lo storico locale (catalogo) e i download registrati su
 * `user_saved_modules` (catalogo + documenti generati dal ModuleCreator).
 */
export function SavedModuli({ caricamento, voci, onApriGenerato, onScarica, onRimuovi }: SavedModuliProps) {
  if (caricamento) {
    return (
      <div className="mt-4">
        <p className="flex items-center gap-2 text-sm text-primary-500">
          <Loader2 className="h-4 w-4 animate-spin" /> Caricamento dei tuoi modelli…
        </p>
      </div>
    );
  }

  return (
    <div className="mt-4">
      {voci.length === 0 ? (
        <p className="rounded-xl border border-dashed border-primary-100 p-8 text-left text-sm text-primary-400">
          Non hai ancora scaricato modelli. Torna al catalogo e scarica il primo documento, oppure
          genera un documento su misura nella tab &quot;Genera un Documento&quot;.
        </p>
      ) : (
        <ul className="space-y-2">
          {voci.map((voce) => (
            <li
              key={voce.key}
              className="flex items-center justify-between gap-3 rounded-xl border border-primary-100 bg-slate-50 px-4 py-3"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="truncate text-sm font-semibold text-primary-800">{voce.title}</p>
                  {voce.source === 'generated' && (
                    <span className="shrink-0 rounded-full bg-secondary-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-secondary-700">
                      Generato
                    </span>
                  )}
                </div>
                <p className="text-xs text-primary-400">
                  {voce.tipo}
                  {voce.catalogo?.categoria ? ` · ${voce.catalogo.categoria}` : ''}
                  {voce.data ? ` · ${formatData(voce.data)}` : ''}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                {voce.source === 'generated' ? (
                  <button
                    onClick={() => onApriGenerato(voce.key)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-primary-200 bg-white px-3 py-2 text-xs font-semibold text-primary-700 transition hover:bg-primary-50"
                  >
                    <Eye className="h-3.5 w-3.5" /> Apri
                  </button>
                ) : (
                  <button
                    onClick={() =>
                      onScarica(
                        voce.catalogo
                          ? { id: voce.catalogo.id, nome: voce.catalogo.nome, tipo: voce.catalogo.tipo }
                          : { id: voce.key.replace(/^cat:/, ''), nome: voce.title, tipo: voce.tipo },
                      )
                    }
                    className="inline-flex items-center gap-1.5 rounded-lg border border-primary-200 bg-white px-3 py-2 text-xs font-semibold text-primary-700 transition hover:bg-primary-50"
                  >
                    <Download className="h-3.5 w-3.5" /> Scarica
                  </button>
                )}
                <button
                  onClick={() => onRimuovi(voce)}
                  aria-label={`Rimuovi ${voce.title}`}
                  className="rounded-lg p-2 text-primary-400 transition hover:bg-error-50 hover:text-error-600"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-3 text-xs text-primary-400">
        La cronologia di download è condivisa con la sezione &quot;Modelli Scaricati di Recente&quot;
        del tuo profilo e viene salvata anche su ScuoleRadar, così la ritrovi da qualsiasi dispositivo.
      </p>
    </div>
  );
}
