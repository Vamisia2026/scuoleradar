/**
 * Radar — pill di una provincia selezionata, con il ruolo di PRINCIPALE.
 *
 * La prima provincia scelta è quella di riferimento (badge «principale»): le
 * altre sono di contorno e possono essere promosse con un click (star). Così
 * l'utente capisce e governa la priorità della propria zona senza riordinare a mano.
 */
import { Star, X } from 'lucide-react';

interface ProvinciaPillProps {
  /** Nome leggibile della provincia (es. «Torino»). */
  nome: string;
  /** Codice/sigla della provincia (es. «TO»). */
  codice: string;
  /** true = è la provincia principale (la prima selezionata). */
  principale: boolean;
  /**
   * true = oltre il tetto del piano corrente: resta SALVATA e si riattiva con PRO.
   * Non è un errore né un dato da rimuovere: è una selezione in attesa.
   */
  inAttesa?: boolean;
  /** Rimuove la provincia dalla selezione. */
  onRimuovi: () => void;
  /** Promuove la provincia a principale (assente quando è già principale). */
  onPromuovi?: () => void;
}

export function ProvinciaPill({
  nome,
  codice,
  principale,
  inAttesa = false,
  onRimuovi,
  onPromuovi,
}: ProvinciaPillProps) {
  return (
    <span
      title={inAttesa ? 'Salvata: si attiva con il piano PRO' : undefined}
      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-sm font-medium ${
        inAttesa
          ? 'border-primary-100 bg-slate-50 text-primary-500'
          : principale
            ? 'border-accent-300 bg-accent-50 text-accent-800'
            : 'border-primary-200 bg-primary-50 text-primary-700'
      }`}
    >
      {principale && !inAttesa && (
        <Star className="h-3.5 w-3.5 fill-current text-accent-500" aria-hidden />
      )}
      <span>
        {nome} <span className="text-xs text-primary-400">({codice})</span>
      </span>
      {inAttesa && (
        <span className="rounded-full bg-primary-100 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-primary-500">
          PRO
        </span>
      )}
      {!inAttesa && principale && (
        <span className="rounded-full bg-accent-500 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
          principale
        </span>
      )}
      {!inAttesa && !principale && onPromuovi && (
        <button
          type="button"
          onClick={onPromuovi}
          aria-label={`Rendi ${nome} la provincia principale`}
          title="Rendi principale"
          className="rounded-full p-0.5 transition hover:bg-white/70"
        >
          <Star className="h-3.5 w-3.5" />
        </button>
      )}
      <button
        type="button"
        onClick={onRimuovi}
        aria-label={`Rimuovi ${nome}`}
        className="rounded-full p-0.5 transition hover:bg-white/70"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </span>
  );
}
