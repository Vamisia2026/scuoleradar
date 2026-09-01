import { useEffect, useState, type FormEvent } from 'react';
import { FolderSearch, Search } from 'lucide-react';

interface RicercaArchivistaProps {
  /** Query COMMESSA della ricerca (si aggiorna SOLO all'invio). */
  filtro: string;
  /** Avvia la ricerca (Enter o click su lente/Cerca). */
  onCerca: (q: string) => void;
  /** Apre la modale teaser dell'Archivista Capo (In arrivo a Ottobre per i PRO). */
  onTeaserArchivista: () => void;
  /** Modalità compatta: riduce altezza e padding. */
  compatto?: boolean;
}

/**
 * Barra di ricerca MODULI (disponibile a tutti gli utenti): NIENTE filtro live.
 * La ricerca parte SOLO alla pressione di Enter o al click sulla lente/pulsante
 * "Cerca"; il parent gestisce lo stato di caricamento ("Labor Illusion") e la
 * griglia dei risultati compare poi ad onda.
 *
 * Il pulsante "Chiedi all'Archivista Capo" apre SOLO la modale teaser:
 * la chat guidata dell'Archivista arriverà a Ottobre per gli utenti PRO.
 */
export function RicercaArchivista({
  filtro,
  onCerca,
  onTeaserArchivista,
  compatto = false,
}: RicercaArchivistaProps) {
  /** Testo scritto dall'utente (stato locale semplice: nessun filtraggio live). */
  const [queryInput, setQueryInput] = useState(filtro);

  // Sincronizza il campo se la query cambia dall'esterno (es. reset del parent).
  useEffect(() => setQueryInput(filtro), [filtro]);

  const invia = (e: FormEvent) => {
    e.preventDefault();
    onCerca(queryInput.trim());
  };

  return (
    <div
      className={`flex flex-col gap-2 rounded-2xl border border-primary-100 bg-white shadow-card sm:flex-row sm:items-center ${
        compatto ? 'p-2.5' : 'p-5'
      }`}
    >
      {/* Ricerca su invio: Enter o click su lente/Cerca attivano la consultazione */}
      <form onSubmit={invia} role="search" className="flex min-w-0 flex-1 items-center gap-2">
        <div className="relative flex-1">
          <button
            type="submit"
            aria-label="Cerca nell'archivio"
            className="absolute left-4 top-1/2 -translate-y-1/2 text-primary-400 transition hover:text-primary-600"
          >
            <Search className="h-5 w-5" />
          </button>
          <input
            type="text"
            value={queryInput}
            onChange={(e) => setQueryInput(e.target.value)}
            placeholder="Cerca un modulo nell'archivio: ad esempio «sostegno», «PEI», «delega ritiro»…"
            className={`w-full rounded-xl border border-primary-200 bg-slate-50 pl-12 pr-4 text-base text-primary-800 outline-none transition placeholder:text-primary-300 focus:border-primary-400 focus:bg-white ${
              compatto ? 'py-2.5' : 'py-3.5'
            }`}
          />
        </div>
        <button
          type="submit"
          className={`inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-primary-500 px-4 text-sm font-bold text-white shadow-soft transition hover:bg-primary-600 ${
            compatto ? 'py-2.5' : 'py-3.5'
          }`}
        >
          <Search className="h-4 w-4" />
          Cerca
        </button>
      </form>

      {/* Pulsante teaser Archivista Capo — blu risaltato, esclusivo PRO */}
      <button
        type="button"
        onClick={onTeaserArchivista}
        className={`inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-sky-700 px-5 text-sm font-bold text-white shadow-soft transition hover:bg-sky-800 ${
          compatto ? 'py-2.5' : 'py-3.5'
        }`}
      >
        <FolderSearch className="h-4 w-4" />
        Chiedi all&apos;Archivista Capo
        <span className="rounded-md bg-[#E67E22] px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
          Esclusivo PRO
        </span>
      </button>
    </div>
  );
}

