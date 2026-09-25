/**
 * «I Miei Documenti» — AREA DI CARICAMENTO (drag & drop + selezione dal computer).
 *
 * Estratta da `MieiDocumenti` (SRP: la UI di rilascio non conosce lo storage).
 * Si occupa solo di raccogliere i file scelti — trascinati o selezionati — e di
 * comunicare lo stato visivo (normale, trascinamento attivo, limite raggiunto,
 * caricamento in corso). I limiti restano in `lib/mieiDocumenti.ts`.
 */
import { useRef, useState } from 'react';
import type { DragEvent, KeyboardEvent } from 'react';
import { Loader2, UploadCloud } from 'lucide-react';

interface AreaCaricamentoDocumentiProps {
  /** true mentre i file vengono letti/salvati. */
  caricamento: boolean;
  /** true quando il numero massimo di documenti è raggiunto. */
  alLimite: boolean;
  /** Riga di sintesi (formati ammessi, spazio usato). */
  riepilogo: string;
  /** Consegna i file selezionati o trascinati al contenitore. */
  onFiles: (files: File[]) => void;
}

export function AreaCaricamentoDocumenti({
  caricamento,
  alLimite,
  riepilogo,
  onFiles,
}: AreaCaricamentoDocumentiProps) {
  /** true mentre un file viene trascinato sull'area di rilascio. */
  const [trascinando, setTrascinando] = useState(false);
  const inputFile = useRef<HTMLInputElement | null>(null);

  const apriSelezione = () => {
    if (!caricamento && !alLimite) inputFile.current?.click();
  };

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label="Carica i tuoi documenti: trascina i file qui oppure scegli dal computer"
      aria-disabled={caricamento || alLimite}
      onClick={apriSelezione}
      onKeyDown={(e: KeyboardEvent<HTMLDivElement>) => {
        if ((e.key === 'Enter' || e.key === ' ') && !caricamento && !alLimite) {
          e.preventDefault();
          apriSelezione();
        }
      }}
      onDragOver={(e: DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        if (!alLimite) setTrascinando(true);
      }}
      onDragLeave={() => setTrascinando(false)}
      onDrop={(e: DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        setTrascinando(false);
        onFiles(Array.from(e.dataTransfer?.files ?? []));
      }}
      className={`flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed px-4 py-5 text-center transition ${
        trascinando
          ? 'border-primary-500 bg-primary-50 ring-2 ring-primary-300'
          : alLimite
            ? 'cursor-not-allowed border-primary-100 bg-slate-50 opacity-70'
            : 'border-primary-200 bg-white hover:border-primary-400 hover:bg-primary-50/40'
      }`}
    >
      <input
        ref={inputFile}
        type="file"
        multiple
        accept=".pdf,.doc,.docx,.txt,.jpg,.jpeg,.png"
        className="hidden"
        onClick={(e) => e.stopPropagation()}
        onChange={(e) => {
          onFiles(Array.from(e.target.files ?? []));
          // Reset: ricaricare lo stesso file deve funzionare.
          e.target.value = '';
        }}
      />
      {caricamento ? (
        <Loader2 className="h-6 w-6 animate-spin text-primary-500" />
      ) : (
        <UploadCloud className={`h-6 w-6 ${trascinando ? 'text-primary-600' : 'text-primary-400'}`} />
      )}
      <p className="text-sm font-semibold text-primary-800">
        {caricamento
          ? 'Caricamento in corso…'
          : alLimite
            ? 'Hai raggiunto il limite di documenti'
            : trascinando
              ? 'Rilascia qui i tuoi file'
              : 'Trascina qui i tuoi file'}
      </p>
      <p className="text-[11px] leading-relaxed text-primary-500">
        oppure <span className="font-semibold text-primary-600">scegli dal computer</span> — {riepilogo}
      </p>
    </div>
  );
}
