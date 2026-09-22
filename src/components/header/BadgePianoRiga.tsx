/**
 * Header — badge del piano nel menu mobile (versione «riga», con colori propri).
 *
 * Gemello di `BadgePianoCompatto`, ma con il contenitore a pillola colorata usato
 * dal drawer mobile. Stessa logica di stato: verifica in corso / Free Forever /
 * PRO / Base.
 */
import { Loader2, Sparkles } from 'lucide-react';
import type { PianoUtente, StatoPiano } from './tipiUtente';

interface BadgePianoRigaProps {
  /** 'loading' finché il piano non è confermato dal DB. */
  pianoStato: StatoPiano;
  piano: PianoUtente;
  /** true con abbonamento PRO attivo (o piano PRO in prova). */
  abbonato: boolean;
}

export function BadgePianoRiga({ pianoStato, piano, abbonato }: BadgePianoRigaProps) {
  return (
                  <span
                    className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                      piano === 'free_forever'
                        ? 'bg-secondary-500 text-white'
                        : abbonato
                          ? 'bg-accent-500 text-white'
                          : 'bg-primary-50 text-primary-600'
                    }`}
                  >
                    {pianoStato === 'loading' ? (
                      <>
                        <Loader2 className="h-3 w-3 animate-spin" />
                        <span className="sr-only">Verifica del piano in corso…</span>
                      </>
                    ) : piano === 'free_forever' ? (
                      '✦ Free Forever'
                    ) : abbonato ? (
                      <>
                        <Sparkles className="h-3 w-3" /> PRO
                      </>
                    ) : (
                      'Base'
                    )}
                  </span>
  );
}
