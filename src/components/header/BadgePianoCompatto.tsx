/**
 * Header — badge del piano accanto al nome utente (versione compatta, top bar).
 *
 * Un solo compito: mostrare lo stato del piano — verifica in corso, Free Forever,
 * PRO o Base — senza occuparsi di menu, navigazione o azioni.
 * Il markup è identico a quello precedentemente inline in `Header.tsx`.
 */
import { Loader2, Sparkles } from 'lucide-react';
import type { PianoUtente, StatoPiano } from './tipiUtente';

interface BadgePianoCompattoProps {
  /** 'loading' finché il piano non è confermato dal DB (mai degradare a Base). */
  pianoStato: StatoPiano;
  piano: PianoUtente;
  /** true con abbonamento PRO attivo (o piano PRO in prova). */
  abbonato: boolean;
}

export function BadgePianoCompatto({ pianoStato, piano, abbonato }: BadgePianoCompattoProps) {
  return (
    <>
                  {pianoStato === 'loading' ? (
                    <span
                      title="Verifica del piano in corso…"
                      className="inline-flex shrink-0 items-center gap-1 rounded-full bg-primary-50 px-2 py-0.5 text-[11px] font-semibold text-primary-400"
                    >
                      <Loader2 className="h-3 w-3 animate-spin" />
                      <span className="sr-only">Verifica del piano in corso…</span>
                    </span>
                  ) : piano === 'free_forever' ? (
                    <span
                      title="Free Forever — accesso PRO a vita, incluso"
                      className="inline-flex shrink-0 items-center gap-1 rounded-full bg-secondary-500 px-2 py-0.5 text-[10px] font-bold text-white"
                    >
                      ✦ Free Forever
                    </span>
                  ) : abbonato ? (
                    <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-accent-500 px-2 py-0.5 text-[11px] font-bold text-white">
                      <Sparkles className="h-3 w-3" /> PRO
                    </span>
                  ) : (
                    <span className="inline-flex shrink-0 items-center rounded-full bg-primary-50 px-2 py-0.5 text-[11px] font-semibold text-primary-500">
                      Base
                    </span>
                  )}
    </>
  );
}
