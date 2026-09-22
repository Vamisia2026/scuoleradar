/**
 * Dashboard · vetrina freemium per i visitatori non autenticati.
 *
 * Hero Radar con copy essenziale (provincia + classe di concorso → avvisi su
 * Telegram ed email) e CTA di registrazione: nessun elenco, perché per gli
 * ospiti l'accordion delle opportunità mostra al massimo 3 avvisi.
 */
import { Radar } from 'lucide-react';

interface VetrinaRadarOspitiProps {
  /** Apre la modale di registrazione (CTA «Attiva il tuo Radar»). */
  onRegistrati: () => void;
}

export function VetrinaRadarOspiti({ onRegistrati }: VetrinaRadarOspitiProps) {
  return (
        <div className="rounded-2xl border border-secondary-200 bg-secondary-50 p-5 shadow-card">
          <h3 className="text-xl font-bold text-primary-900">
            Smetti di cercare a mano. Monitoriamo noi la scuola per te.
          </h3>
          <p className="mt-2 text-sm leading-relaxed text-primary-700">
            Imposta provincia e classe di concorso: ti avvisiamo istantaneamente su Telegram ed Email
            non appena esce un&apos;opportunità adatta a te.
          </p>
          <p className="mt-2 text-sm font-semibold text-secondary-700">
            🎁 Registrati oggi: per te 1 Mese PRO Gratis offerto da{' '}
            <a
              href="https://purefocus.one"
              target="_blank"
              rel="noopener noreferrer"
              className="underline decoration-secondary-300 underline-offset-2 transition hover:text-secondary-800"
            >
              PureFocus.one
            </a>
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={onRegistrati}
              className="inline-flex items-center gap-2 rounded-xl bg-primary-500 px-5 py-2.5 text-sm font-bold uppercase tracking-wide text-white shadow-soft transition hover:bg-primary-600"
            >
              <Radar className="h-4 w-4" />
              Attiva il tuo Radar
            </button>
          </div>
        </div>
  );
}
