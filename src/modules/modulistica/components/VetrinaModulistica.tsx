import { useState, type FormEvent } from 'react';
import { ArrowRight, Search } from 'lucide-react';
import { useApp } from '@/contexts/AppContext';

/**
 * Vetrina / Landing Page della Modulistica per gli utenti NON autenticati.
 *
 * Un'unica Hero Section pulita su sfondo scuro/blu: titolo, sottotitolo,
 * barra di ricerca finta con pulsante arancione e nota sulla registrazione.
 * La barra di ricerca "finta" — al click o all'invio apre la modale di
 * registrazione gratuita.
 */
export function VetrinaModulistica() {
  const { openAuthModal } = useApp();
  const [query, setQuery] = useState('');

  const registrati = () => openAuthModal('registrazione');

  const invia = (e: FormEvent) => {
    e.preventDefault();
    registrati();
  };

  return (
    <div className="animate-fade-in overflow-hidden rounded-2xl border border-primary-100 bg-white shadow-card">
      {/* Hero Section pulita */}
      <div className="bg-gradient-to-br from-primary-900 via-primary-800 to-primary-600 px-6 py-10 text-center sm:px-10 sm:py-14">
        <h2 className="mx-auto max-w-3xl text-3xl font-extrabold leading-tight text-white sm:text-4xl">
          Oltre 1.000 moduli per la scuola, pronti all&apos;uso.
        </h2>
        <p className="mx-auto mt-4 max-w-3xl text-lg font-semibold text-accent-300">
          Disponibili gratuitamente per tutti gli utenti registrati, anche con Account Base.
        </p>
        <p className="mx-auto mt-2 max-w-3xl text-base leading-relaxed text-primary-100 sm:text-lg">
          Scuole Radar mette a tua disposizione oltre 1.000 moduli per la scuola (insegnanti,
          studenti, famiglie, sostegno, rapporti con ASL e servizi sociali, università e molto
          altro). Ti aiutiamo noi a trovare il documento che ti serve.
        </p>

        {/* Barra di ricerca finta → registrazione gratuita */}
        <form onSubmit={invia} className="mx-auto mt-8 flex max-w-2xl flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-primary-400" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onFocus={registrati}
              placeholder="Cerca il tuo modulo"
              aria-label="Cerca il tuo modulo (richiede la registrazione)"
              className="w-full cursor-pointer rounded-xl border-0 bg-white py-3.5 pl-12 pr-4 text-base text-primary-800 shadow-lg outline-none placeholder:text-primary-300"
            />
          </div>
          <button
            type="submit"
            onClick={registrati}
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-secondary-500 px-6 py-3.5 text-sm font-semibold text-white shadow-soft transition hover:bg-secondary-600"
          >
            Cerca il tuo modulo
            <ArrowRight className="h-4 w-4" />
          </button>
        </form>
        <p className="mt-4 text-sm font-semibold text-white/90">
          Il servizio è gratis, basta registrarsi.
        </p>
      </div>
    </div>
  );
}

