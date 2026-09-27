/**
 * Landing — fascia PARTNER (PureFocus, sponsor ufficiale).
 *
 * Estratta da `pages/LandingPage.tsx`: la pagina torna sotto la soglia di
 * attenzione del gate strutturale e la fascia resta una sezione isolata.
 * Copy allineata alla decisione di prodotto (LOCKED_MODULES.md): il piano PRO
 * si descrive con il vocabolario approvato, `incluso nell'offerta PRO`, mai con
 * termini da volantino (omaggi o regalie).
 * Presentazione pura: lo stato PRO arriva come prop.
 */
import { Link } from 'react-router-dom';
import { Sparkles } from 'lucide-react';

export function LandingPartnerPureFocus({ hasProAccess }: { hasProAccess: boolean }) {
  return (
    <section className="bg-primary-50 py-10" aria-label="Partner ufficiale PureFocus">
      <div className="mx-auto max-w-4xl px-4 sm:px-6">
        <div className="overflow-hidden rounded-2xl bg-gradient-to-br from-primary-700 to-primary-900 text-white shadow-card">
          {/* Fascia partner */}
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/15 px-6 py-3 sm:px-8">
            <span className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.22em] text-primary-200">
              <Sparkles className="h-3.5 w-3.5" />
              Partner ufficiale
            </span>
            <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary-300">
              Sponsor Ufficiale
            </span>
          </div>

          <div className="p-6 sm:p-8">
            <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center">
              <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white/10 text-2xl">
                🧘
              </span>
              <div className="min-w-0 flex-1">
                <h2 className="text-2xl font-bold sm:text-3xl">PureFocus</h2>
                <p className="mt-1 text-sm text-primary-200">
                  purefocus.one — studio e lavoro su YouTube senza distrazioni
                </p>
              </div>
              <a
                href="https://purefocus.one"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-white/15 px-4 py-2 text-sm font-semibold text-white ring-1 ring-white/25 transition hover:bg-white/25"
              >
                Scopri PureFocus ↗
              </a>
            </div>

            <p className="mt-5 max-w-2xl leading-relaxed text-primary-100">
              La piattaforma che trasforma YouTube in un ambiente di studio e lavoro: elimina
              distrazioni, suggerimenti e contenuti irrilevanti, lasciandoti solo ciò che ti serve
              per ottimizzare il tuo tempo.
            </p>

            {hasProAccess ? (
              <div className="mt-6 rounded-2xl bg-white/10 p-5 ring-1 ring-white/20">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-accent-400/20 px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-accent-300 ring-1 ring-inset ring-accent-300/40">
                      <Sparkles className="h-3 w-3" />
                      Incluso nel tuo piano
                    </span>
                    <p className="mt-2 text-sm leading-relaxed text-primary-100">
                      Hai PureFocus già incluso nel piano PRO (mensile, annuale o Free Forever):
                      nessun costo aggiuntivo, entra e inizia subito.
                    </p>
                  </div>
                  <a
                    href="https://purefocus.one"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-6 py-3 text-sm font-bold text-primary-800 shadow-soft transition hover:bg-primary-50"
                  >
                    ACCEDI A PUREFOCUS ↗
                  </a>
                </div>
              </div>
            ) : (
              <div className="mt-6 rounded-2xl bg-white/10 p-5 ring-1 ring-white/20">
                <p className="max-w-2xl text-sm leading-relaxed text-primary-100">
                  PureFocus costa 29 $/anno ed è{' '}
                  <strong className="text-white">incluso nell&apos;offerta PRO</strong> di
                  ScuoleRadar: con il piano PRO attivo non paghi nulla in più.
                </p>
                <div className="mt-4 flex flex-col gap-2.5 sm:flex-row sm:items-center">
                  <Link
                    to="/prezzi"
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-secondary-500 px-6 py-3 text-sm font-bold text-white shadow-soft transition hover:bg-secondary-600"
                  >
                    Passa a PRO
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
      </div>
    </section>
  );
}
