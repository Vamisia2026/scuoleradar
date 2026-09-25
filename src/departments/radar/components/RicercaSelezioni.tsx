/**
 * Radar — campo di RICERCA UNIFICATA (classi di concorso + competenze + parole chiave).
 *
 * Un solo input per il passo 3 del wizard e per la sezione «In cosa puoi lavorare»
 * delle Preferenze: i risultati arrivano già raggruppati da
 * `lib/ricercaSelezioniRadar.ts`, quindi le due superfici mostrano esattamente gli
 * stessi suggerimenti (digitando «Pedagogia» escono le classi collegate *e* la
 * possibilità di usarla come parola chiave).
 *
 * Il pannello dei risultati è INLINE (non un dropdown assoluto): compare solo
 * mentre si digita, quindi a riposo non allunga la modale.
 */
import { CornerDownLeft, Search } from 'lucide-react';
import type { GruppiRicercaSelezioni, SuggerimentoSelezione } from '@/lib/ricercaSelezioniRadar';

interface RicercaSelezioniProps {
  /** Testo corrente digitato. */
  query: string;
  setQuery: (valore: string) => void;
  /** Risultati già raggruppati (dal modulo condiviso). */
  gruppi: GruppiRicercaSelezioni;
  /** Applica un risultato (seleziona la classe o la competenza). */
  onScegli: (suggerimento: SuggerimentoSelezione) => void;
  /** Aggiunge la parola digitata ai tag personali del profilo. */
  onParolaChiave: (testo: string) => void;
  placeholder?: string;
  ariaLabel?: string;
  /** Riga di aiuto sotto al campo. */
  helper?: string;
}

/** Riga di risultato (＋ per i nuovi, ✓ per quelli già nel profilo). */
function RigaRisultato({
  suggerimento,
  onScegli,
  descrizione,
}: {
  suggerimento: SuggerimentoSelezione;
  onScegli: (s: SuggerimentoSelezione) => void;
  descrizione: string;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={() => onScegli(suggerimento)}
        aria-pressed={suggerimento.selezionato}
        className={`flex w-full items-start justify-between gap-2 rounded-lg px-2.5 py-1.5 text-left transition ${
          suggerimento.selezionato ? 'bg-accent-50 text-primary-800' : 'text-primary-700 hover:bg-primary-50'
        }`}
      >
        <span className="min-w-0">
          <span className="block truncate text-sm font-semibold">{suggerimento.etichetta}</span>
          <span className="block truncate text-[11px] text-primary-500">
            {descrizione}
            {suggerimento.dettaglio ? ` · ${suggerimento.dettaglio}` : ''}
          </span>
        </span>
        <span className="mt-0.5 shrink-0 text-[11px] font-bold text-primary-500">
          {suggerimento.selezionato ? '✓ nel profilo' : '＋ aggiungi'}
        </span>
      </button>
    </li>
  );
}

export function RicercaSelezioni({
  query,
  setQuery,
  gruppi,
  onScegli,
  onParolaChiave,
  placeholder = 'Cerca una classe di concorso o una competenza',
  ariaLabel = 'Cerca classi di concorso e competenze',
  helper,
}: RicercaSelezioniProps) {
  const { classi, competenze, paroleChiave, queryTroppoCorta } = gruppi;
  const nessunRisultato =
    !queryTroppoCorta && classi.length === 0 && competenze.length === 0 && paroleChiave.length === 0;

  return (
    <div>
      <label className="block">
        <span className="relative block">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-primary-400" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={placeholder}
            aria-label={ariaLabel}
            className="w-full rounded-xl border border-primary-200 bg-white py-2 pl-9 pr-3 text-sm text-primary-800 focus:border-primary-400 focus:outline-none"
          />
        </span>
      </label>
      {helper && <p className="mt-1 text-[11px] leading-relaxed text-primary-500">{helper}</p>}

      {!queryTroppoCorta && (
        <div className="mt-2 rounded-xl border border-primary-100 bg-slate-50 p-2">
          {nessunRisultato ? (
            <p className="p-1 text-xs text-primary-500">
              Nessun risultato per «{query.trim()}». Puoi aggiungerla come tua parola chiave.
            </p>
          ) : (
            <div className="space-y-2">
              {classi.length > 0 && (
                <div>
                  <p className="px-1 text-[11px] font-bold uppercase tracking-wide text-primary-400">
                    Classi di concorso
                  </p>
                  <ul className="mt-0.5 space-y-0.5">
                    {classi.map((s) => (
                      <RigaRisultato
                        key={`classe-${s.chiave}`}
                        suggerimento={s}
                        onScegli={onScegli}
                        descrizione="Classe di concorso"
                      />
                    ))}
                  </ul>
                </div>
              )}
              {competenze.length > 0 && (
                <div>
                  <p className="px-1 text-[11px] font-bold uppercase tracking-wide text-primary-400">
                    Competenze e laboratori
                  </p>
                  <ul className="mt-0.5 space-y-0.5">
                    {competenze.map((s) => (
                      <RigaRisultato
                        key={`competenza-${s.chiave}`}
                        suggerimento={s}
                        onScegli={onScegli}
                        descrizione="Competenza extra"
                      />
                    ))}
                  </ul>
                </div>
              )}
              {paroleChiave.length > 0 && (
                <button
                  type="button"
                  onClick={() => onParolaChiave(paroleChiave.join(', '))}
                  className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-primary-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-primary-700 transition hover:bg-primary-50"
                >
                  <CornerDownLeft className="h-3.5 w-3.5" />
                  {paroleChiave.length === 1
                    ? `Aggiungi «${paroleChiave[0]}» come tua parola chiave`
                    : `Aggiungi ${paroleChiave.length} parole chiave: ${paroleChiave.join(' · ')}`}
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
