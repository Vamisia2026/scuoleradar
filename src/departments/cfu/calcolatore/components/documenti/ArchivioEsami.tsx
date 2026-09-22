/**
 * Calcolatore CFU · riepilogo degli esami inseriti (fase Esami).
 *
 * Elenco compatto su due colonne con CFU, settore SSD e rimozione puntuale.
 * Gli esami senza settore sono marcati esplicitamente: il settore non
 * dichiarato non viene mai mostrato come se esistesse.
 */
import { Trash2 } from 'lucide-react';
import type { Esame } from '../../../shared/types';

interface ArchivioEsamiProps {
  /** Esami inseriti (manuale o incollati). */
  esami: Esame[];
  /** Somma dei CFU inseriti. */
  totaleCfu: number;
  /** Rimuove un esame per id. */
  onRimuoviEsame: (id: string) => void;
}

export function ArchivioEsami({ esami, totaleCfu, onRimuoviEsame }: ArchivioEsamiProps) {
  const senzaSettore = esami.filter((esame) => !esame.ssd).length;
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-3.5">
      <p className="mb-2.5 flex flex-wrap items-center gap-2 text-sm font-bold uppercase tracking-wide text-primary-500">
        Esami inseriti ({esami.length}) · {totaleCfu} CFU
        {senzaSettore > 0 && (
          <span className="rounded-full bg-warning-50 px-2 py-0.5 text-[10px] font-bold tracking-normal text-warning-700 ring-1 ring-warning-200">
            {senzaSettore} senza settore SSD
          </span>
        )}
      </p>
      <ul className="grid gap-2 sm:grid-cols-2">
        {esami.map((esame) => (
          <li
            key={esame.id}
            className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-sm text-primary-700"
          >
            <span className="min-w-0 flex-1 truncate font-medium">{esame.denominazione}</span>
            {esame.ssd ? (
              <span className="shrink-0 font-mono text-xs text-secondary-600">{esame.ssd}</span>
            ) : (
              <span className="shrink-0 rounded-full bg-warning-50 px-2 py-0.5 text-[10px] font-bold text-warning-700 ring-1 ring-warning-200">
                settore non dichiarato
              </span>
            )}
            <span className="shrink-0 font-bold text-primary-500">{esame.cfu} CFU</span>
            <button
              type="button"
              aria-label="Rimuovi esame"
              onClick={() => onRimuoviEsame(esame.id)}
              className="inline-flex h-6 w-6 items-center justify-center rounded text-primary-400 transition hover:bg-error-50 hover:text-error-600"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
