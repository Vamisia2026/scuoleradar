/**
 * Modulistica · Archivio — card di un documento del catalogo.
 *
 * Mostra icona, tipo, nome, descrizione, percorso e CTA «Apri». Presentazione
 * pura: nessuno stato, nessuna logica di ricerca. Estratta da `EsploraArchivio.tsx`
 * con markup invariato.
 */
import { FileText } from 'lucide-react';
import type { DocumentoModulistica } from '@/data/moduli';

/** Card verticale compatta di un modulo (icona + titolo + descrizione + CTA in basso). */
export function CardModulo({
  doc,
  percorso,
  onApri,
  index,
}: {
  doc: DocumentoModulistica;
  percorso: string[];
  onApri: (doc: DocumentoModulistica, percorso: string[]) => void;
  index: number;
}) {
  return (
    <div
      className="card-onda flex flex-col rounded-xl border border-primary-100 bg-white p-4 shadow-soft transition hover:-translate-y-0.5 hover:border-primary-300 hover:shadow-card"
      style={{ animationDelay: `${index * 70}ms` }}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary-100 text-primary-600">
          <FileText className="h-5 w-5" />
        </span>
        <span className="shrink-0 rounded-md bg-primary-100 px-2 py-0.5 text-[10px] font-bold text-primary-700">
          {doc.tipo}
        </span>
      </div>
      <p className="mt-3 line-clamp-2 text-sm font-bold leading-snug text-primary-800">{doc.nome}</p>
      <p className="mt-1 line-clamp-2 flex-1 text-xs leading-relaxed text-primary-500">{doc.descrizione}</p>
      {percorso.length > 0 && (
        <p className="mt-1.5 truncate text-[11px] font-semibold text-primary-400">📁 {percorso.join(' › ')}</p>
      )}
      <button
        type="button"
        onClick={() => onApri(doc, percorso)}
        className="mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-secondary-500 px-4 py-2.5 text-xs font-bold text-white shadow-soft transition hover:bg-secondary-600"
      >
        <FileText className="h-3.5 w-3.5" />
        Apri documento
      </button>
    </div>
  );
}
