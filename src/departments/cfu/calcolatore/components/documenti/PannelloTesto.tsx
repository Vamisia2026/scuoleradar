/**
 * Calcolatore CFU · pannello «Incolla l'elenco» (Step Documenti).
 *
 * Area di testo dove incollare gli esami (una materia per riga, con CFU e SSD
 * facoltativo) e bottone che avvia il riconoscimento automatico: la nota di
 * esito la costruisce il contenitore, che conosce i risultati.
 */
import { Wand2 } from 'lucide-react';

interface PannelloTestoProps {
  /** Testo incollato dall'utente. */
  testo: string;
  /** Aggiorna il testo (il contenitore azzera la nota di esito). */
  onCambiaTesto: (valore: string) => void;
  /** Riconosce gli esami dal testo incollato. */
  onRiconosci: () => void;
}

export function PannelloTesto({ testo, onCambiaTesto, onRiconosci }: PannelloTestoProps) {
  return (
        <div className="space-y-2.5">
          <textarea
            value={testo}
            onChange={(e) => onCambiaTesto(e.target.value)}
            rows={6}
            placeholder={
              'Esempio (una materia per riga):\nPedagogia generale — 6 CFU — M-PED/01\nAnalisi matematica I — 9 CFU — MAT/05'
            }
            className="w-full resize-y rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-primary-800 placeholder:text-primary-300 focus:border-primary-300 focus:bg-white focus:outline-none"
          />
          <button
            type="button"
            onClick={onRiconosci}
            className="inline-flex items-center gap-1.5 rounded-xl bg-primary-500 px-4 py-2 text-sm font-semibold text-white shadow-soft transition hover:bg-primary-600"
          >
            <Wand2 className="h-4 w-4" />
            Riconosci esami dal testo
          </button>
        </div>
  );
}
