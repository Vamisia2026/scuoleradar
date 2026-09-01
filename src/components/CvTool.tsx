import { FileText, Mail, MapPin, Phone } from 'lucide-react';

/** Sezioni del CV mostrate nel mockup (anteprima illustrativa). */
const sezioni = [
  { titolo: 'Esperienze professionali', righe: 3 },
  { titolo: 'Formazione', righe: 2 },
  { titolo: 'Competenze e certificazioni', righe: 3 },
] as const;

/**
 * Crea CV — Anteprima ad alta fedeltà (mockup) di ciò che il CV Builder
 * genererà a Ottobre per i membri PRO.
 */
export function CvTool() {
  return (
    <div className="space-y-4">
      {/* Banner riservato ai membri PRO */}
      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-secondary-200 bg-gradient-to-r from-secondary-50 via-white to-accent-50 px-4 py-3">
        <span className="rounded-full bg-secondary-500 px-3 py-1 text-[11px] font-extrabold uppercase tracking-wide text-white shadow-soft">
          IN ARRIVO AD OTTOBRE
        </span>
        <p className="text-sm font-semibold leading-relaxed text-primary-800">
          Riservato ai membri PRO. Il tuo CV perfetto per interpelli, GPS e candidature scolastiche.
        </p>
      </div>

      {/* Mockup glassmorphism del CV generato */}
      <div className="rounded-3xl border border-white/50 bg-gradient-to-br from-white/80 via-primary-50/50 to-accent-50/40 p-4 shadow-card backdrop-blur sm:p-6">
        <div className="mx-auto max-w-2xl rounded-2xl border border-white/60 bg-white/75 p-6 shadow-soft backdrop-blur">
          {/* Intestazione */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xl font-extrabold text-primary-900">Mario Rossi</p>
              <p className="text-xs font-semibold text-primary-500">
                Docente di Matematica e Fisica · A-28
              </p>
            </div>
            <span className="rounded-full bg-accent-50 px-3 py-1 text-[10px] font-bold uppercase tracking-wide text-accent-700 ring-1 ring-accent-200">
              CV PRO
            </span>
          </div>
          <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-xs text-primary-500">
            <span className="inline-flex items-center gap-1.5">
              <Mail className="h-3.5 w-3.5 text-primary-400" />
              mario.rossi@email.it
            </span>
            <span className="inline-flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5 text-primary-400" />
              Milano (MI)
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Phone className="h-3.5 w-3.5 text-primary-400" />
              333 123 4567
            </span>
          </div>

          {/* Sezioni */}
          <div className="mt-5 space-y-4">
            {sezioni.map((s) => (
              <div key={s.titolo}>
                <p className="text-[11px] font-extrabold uppercase tracking-widest text-primary-400">
                  {s.titolo}
                </p>
                <div className="mt-2 space-y-1.5">
                  {Array.from({ length: s.righe }).map((_, i) => (
                    <div key={i} className="rounded-lg bg-slate-50/80 px-3 py-2">
                      <div className="h-2.5 w-2/3 rounded-full bg-primary-200/70" />
                      <div className="mt-1.5 h-2 w-1/2 rounded-full bg-primary-100" />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        <p className="mt-3 max-w-2xl text-xs font-medium text-primary-400">
          Anteprima illustrativa del layout che genererà il CV Builder a Ottobre, riservato ai membri PRO.
        </p>
      </div>
    </div>
  );
}
