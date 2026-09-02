import { Link } from 'react-router-dom';
import { PenLine, Sparkles } from 'lucide-react';
import { useApp } from '@/contexts/AppContext';

/**
 * PureFocus — sponsor esterno (purefocus.one) incluso nel piano PRO.
 * Card pubblicitaria ad alto impatto (stile homepage) con CTA dinamica in
 * base allo stato dell'utente:
 *  - Base / non registrati: bottone arancione "PASSA A PRO" → /prezzi.
 *  - PRO: "VAI SU PUREFOCUS.ONE" con messaggio di stato personalizzato.
 */
export function PureFocusPage() {
  const { hasProAccess } = useApp();

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <PenLine className="h-5 w-5 text-primary-600" />
        <h2 className="text-3xl font-bold text-primary-800">PureFocus</h2>
      </div>

      {/* Card sponsor ad alto impatto (gradiente dark, stile homepage) */}
      <div className="rounded-3xl bg-gradient-to-br from-primary-700 to-primary-900 p-8 text-white shadow-card sm:p-10">
        <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center">
          <span className="inline-flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white/10 text-3xl">
            🧘
          </span>
          <div className="min-w-0">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-primary-100">
              <Sparkles className="h-3.5 w-3.5" />
              {hasProAccess ? 'Incluso nel tuo piano' : 'Sponsor Ufficiale'}
            </span>
            <h3 className="mt-2 text-2xl font-bold sm:text-3xl">PureFocus · purefocus.one</h3>
            <a
              href="https://purefocus.one"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1 inline-flex items-center gap-1 text-sm font-semibold text-primary-200 underline-offset-4 transition hover:text-white hover:underline"
            >
              Visita purefocus.one ↗
            </a>
          </div>
        </div>

        <p className="mt-5 max-w-2xl text-base leading-relaxed text-primary-100">
              La piattaforma che trasforma YouTube in un ambiente di studio e lavoro: elimina
              distrazioni, suggerimenti e contenuti irrilevanti, lasciandoti solo ciò che ti serve
              per ottimizzare il tuo tempo.
        </p>

        {hasProAccess ? (
          <div className="mt-6 rounded-2xl bg-white/10 p-5 ring-1 ring-white/20">
            <p className="max-w-2xl text-sm leading-relaxed text-primary-100">
              🎉 PureFocus è già incluso nel tuo piano PRO (mensile, annuale o Free Forever): nessun
              costo aggiuntivo. Entra e inizia subito a studiare e lavorare su YouTube senza distrazioni.
            </p>
            <a
              href="https://purefocus.one"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 inline-flex items-center gap-2 rounded-xl bg-white px-6 py-3 text-sm font-bold text-primary-800 shadow-soft transition hover:bg-primary-50"
            >
              ACCEDI A PUREFOCUS ↗
            </a>
          </div>
        ) : (
          <div className="mt-6 rounded-2xl bg-white/10 p-5 ring-1 ring-white/20">
            <p className="max-w-2xl text-sm leading-relaxed text-primary-100">
              PureFocus costa 29$/anno ed è <strong className="text-white">INCLUSO GRATUITAMENTE</strong>{' '}
              per tutti gli utenti PRO di ScuoleRadar.
            </p>
            <div className="mt-4 flex flex-col gap-2.5 sm:flex-row sm:items-center">
              <Link
                to="/prezzi"
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-secondary-500 px-6 py-3 text-sm font-bold text-white shadow-soft transition hover:bg-secondary-600"
              >
                PASSA A PRO
              </Link>
              <a
                href="https://purefocus.one"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-white/15 px-5 py-3 text-sm font-semibold text-white ring-1 ring-white/25 transition hover:bg-white/25"
              >
                Visita purefocus.one ↗
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
