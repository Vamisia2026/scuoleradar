/**
 * Modulistica · Archivio — skeleton di consultazione («Labor Illusion»).
 *
 * Placeholder animato mostrato durante la consultazione dell'Archivista (~2s):
 * intestazione con spinner + griglia di card fantasma. Nessuna prop.
 */
import { Loader2 } from 'lucide-react';

/** Skeleton della consultazione archivio ("Labor Illusion": micro-spinner + card in caricamento). */
export function SkeletonConsultazione() {
  return (
    <div>
      <div className="flex items-center justify-center gap-2 py-6 text-sm font-semibold text-primary-500">
        <Loader2 className="h-4 w-4 animate-spin" />
        Consultazione archivio in corso...
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex flex-col rounded-xl border border-primary-100 bg-slate-50 p-4">
            <div className="h-10 w-10 animate-pulse rounded-lg bg-primary-100" />
            <div className="mt-3 h-3.5 w-3/4 animate-pulse rounded bg-primary-100" />
            <div className="mt-2 h-3 w-full animate-pulse rounded bg-primary-100" />
            <div className="mt-1 h-3 w-2/3 animate-pulse rounded bg-primary-100" />
            <div className="mt-4 h-8 w-full animate-pulse rounded-xl bg-secondary-100" />
          </div>
        ))}
      </div>
    </div>
  );
}
