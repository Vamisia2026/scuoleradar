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
  /** Piano letto dal DB (`profiles.piano`): fonte di verità dell'etichetta. */
  piano: PianoUtente;
  /** true con abbonamento PRO attivo (rinnovo/pagamento): NON decide da solo il piano. */
  abbonato: boolean;
}

export function BadgePianoRiga({ pianoStato, piano, abbonato }: BadgePianoRigaProps) {
  // Come `BadgePianoCompatto`: l'etichetta segue il piano del DB, mai il solo
  // flag di pagamento (un PRO regalato dal backend non deve mostrare «Base»).
  const ePianoPro = piano === 'pro' || abbonato;
  return (
                  <span
                    className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                      piano === 'free_forever'
                        ? 'bg-secondary-500 text-white'
                        : ePianoPro
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
                    ) : ePianoPro ? (
                      <>
                        <Sparkles className="h-3 w-3" /> PRO
                      </>
                    ) : (
                      'Base'
                    )}
                  </span>
  );
}
