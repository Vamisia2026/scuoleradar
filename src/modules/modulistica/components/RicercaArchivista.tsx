import { useState, type FormEvent } from 'react';
import { Search } from 'lucide-react';

interface RicercaArchivistaProps {
  onInvia: (query: string) => void;
  /** Disabilita l'invio (es. mentre il documento è in recupero). */
  busy?: boolean;
  /** Modalità compatta: riduce altezza e padding (ricerca in corso). */
  compatto?: boolean;
}

/**
 * Barra di ricerca dell'Archivista Capo, ben visibile e larga, in cima alla
 * Modulistica. La richiesta NON genera subito il documento: avvia l'intervista
 * guidata, una domanda chirurgica alla volta.
 */
export function RicercaArchivista({ onInvia, busy, compatto = false }: RicercaArchivistaProps) {
  const [query, setQuery] = useState('');

  const invia = (e: FormEvent) => {
    e.preventDefault();
    const q = query.trim();
    if (!q || busy) return;
    setQuery('');
    onInvia(q);
  };

  return (
    <form
      onSubmit={invia}
      className={`flex flex-col gap-2 rounded-2xl border border-primary-100 bg-white shadow-card sm:flex-row sm:items-center ${
        compatto ? 'p-2.5' : 'p-5'
      }`}
    >
      <div className="relative flex-1">
        <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-primary-400" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buongiorno. Indichi la modulistica che le occorre, ad esempio un modulo per la richiesta di sostegno…"
          className={`w-full rounded-xl border border-primary-200 bg-slate-50 pl-12 pr-4 text-base text-primary-800 outline-none transition placeholder:text-primary-300 focus:border-primary-400 focus:bg-white ${
            compatto ? 'py-2.5' : 'py-3.5'
          }`}
        />
      </div>
      <button
        type="submit"
        disabled={busy || !query.trim()}
        className={`inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-primary-500 px-6 text-sm font-bold uppercase tracking-wide text-white shadow-soft transition hover:bg-primary-600 disabled:cursor-not-allowed disabled:opacity-50 ${
          compatto ? 'py-2.5' : 'py-3.5'
        }`}
      >
        <Search className="h-4 w-4" />
        Chiedi all&apos;Archivista Capo
      </button>
    </form>
  );
}
