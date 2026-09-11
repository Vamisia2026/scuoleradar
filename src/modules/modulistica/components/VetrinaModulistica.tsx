import { FileText } from 'lucide-react';

/**
 * Hero banner della Modulistica (utenti NON registrati).
 *
 * Un'unica fascia elegante su sfondo blu: titolo, sottotitolo e descrizione.
 * NIENTE schermate intermedie né barre di ricerca "finte": l'archivio completo
 * (macroaree + ricerca dell'Archivista Capo) è disponibile SUBITO sotto.
 * I moduli sono PDF compilabili e stampabili.
 */
export function VetrinaModulistica() {
  return (
    <div className="animate-fade-in overflow-hidden rounded-2xl border border-primary-100 bg-white shadow-card">
      <div className="bg-gradient-to-br from-primary-900 via-primary-800 to-primary-600 px-6 py-10 text-center sm:px-10 sm:py-14">
        <span className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-3 py-1 text-xs font-bold uppercase tracking-wide text-accent-200">
          <FileText className="h-3.5 w-3.5" />
          Dipartimento Modulistica
        </span>
        <h2 className="mx-auto mt-4 max-w-3xl text-3xl font-extrabold leading-tight text-white sm:text-4xl">
          Oltre 1.000 moduli per la scuola, pronti all&apos;uso.
        </h2>
        <p className="mx-auto mt-4 max-w-3xl text-lg font-semibold text-accent-300">
          PDF compilabili e stampabili, per docenti, ATA, famiglie e studenti.
        </p>
        <p className="mx-auto mt-2 max-w-3xl text-base leading-relaxed text-primary-100 sm:text-lg">
          Cerca ed esplora liberamente l&apos;archivio: scegli la macroarea o usa la barra di
          ricerca. La registrazione (gratuita) serve solo per generare e scaricare il modulo.
        </p>
      </div>
    </div>
  );
}

