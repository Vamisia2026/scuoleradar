/* Refactor UI/UX — CvTool: nomi realistici, pitch ad alta conversione,
   mockup moderno. Uso: node scripts/_cv-redesign.mjs */
import fs from 'node:fs';
import path from 'node:path';
const root = process.cwd();
const scrivi = (f, txt) => {
  fs.writeFileSync(path.join(root, f), txt.split('\n').join('\r\n'), 'utf8');
};

const parte1 = `import { Award, Briefcase, GraduationCap, Mail, MapPin, Phone, Sparkles } from 'lucide-react';

/** Sezioni del CV mostrate nel mockup. */
const sezioni = [
  { titolo: 'Esperienze professionali', righe: 3 },
  { titolo: 'Formazione', righe: 2 },
  { titolo: 'Competenze e certificazioni', righe: 3 },
] as const;

/**
 * Crea CV — Anteprima ad alta fedeltà del CV Builder che arriverà a Ottobre
 * per i membri PRO.
 */
export function CvTool() {
  return (
    <div className="space-y-5">
      {/* Banner */}
      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-secondary-200 bg-gradient-to-r from-secondary-50 via-white to-accent-50 px-4 py-3">
        <span className="rounded-full bg-secondary-500 px-3 py-1 text-[11px] font-extrabold uppercase tracking-wide text-white shadow-soft">
          IN ARRIVO AD OTTOBRE
        </span>
        <p className="text-sm font-semibold leading-relaxed text-primary-800">
          Riservato ai membri PRO. Il tuo CV perfetto per interpelli, GPS e candidature scolastiche.
        </p>
      </div>

      {/* Pitch ad alta conversione */}
      <div className="rounded-2xl bg-gradient-to-br from-primary-700 to-primary-900 p-6 text-white shadow-card sm:p-7">
        <h3 className="text-xl font-bold leading-snug sm:text-2xl">
          Il tuo CV su misura per ogni scuola in pochi secondi.
        </h3>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-primary-100 sm:text-base">
          Un generatore intelligente che riorganizza le tue esperienze per valorizzare al massimo il
          tuo profilo per ogni candidatura, interpello o supplenza.
        </p>
      </div>

      {/* Mockup CV */}
      <div className="rounded-3xl border border-primary-100 bg-gradient-to-br from-slate-50 to-white p-4 shadow-card sm:p-6">
        <div className="mx-auto max-w-2xl overflow-hidden rounded-2xl border border-primary-100 bg-white shadow-soft">
          {/* Intestazione profilo */}
          <div className="bg-gradient-to-r from-primary-700 to-primary-900 px-6 py-5 text-white">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-2xl font-extrabold tracking-tight">Elena Bianchi</p>
                <p className="mt-0.5 text-xs font-semibold text-primary-200">
                  Docente di Matematica e Fisica · A-27
                </p>
              </div>
              <span className="inline-flex items-center gap-1 rounded-full bg-white/15 px-3 py-1 text-[10px] font-bold uppercase tracking-wide text-accent-200 ring-1 ring-white/20">
                <Sparkles className="h-3 w-3" />
                CV PRO
              </span>
            </div>
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-[11px] text-primary-200">
              <span className="inline-flex items-center gap-1.5">
                <Mail className="h-3 w-3" />
                elena.bianchi@email.it
              </span>
              <span className="inline-flex items-center gap-1.5">
                <MapPin className="h-3 w-3" />
                Milano (MI)
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Phone className="h-3 w-3" />
                333 987 6543
              </span>
            </div>
          </div>
`;
const parte2 = `          {/* Corpo: sezioni con evidenziazioni */}
          <div className="space-y-5 p-5">
            {sezioni.map((s) => (
              <div key={s.titolo}>
                <p className="flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-widest text-primary-400">
                  {s.titolo === 'Esperienze professionali' ? (
                    <Briefcase className="h-3.5 w-3.5 text-secondary-500" />
                  ) : s.titolo === 'Formazione' ? (
                    <GraduationCap className="h-3.5 w-3.5 text-primary-500" />
                  ) : (
                    <Award className="h-3.5 w-3.5 text-accent-500" />
                  )}
                  {s.titolo}
                </p>
                <div className="mt-2 space-y-2">
                  {Array.from({ length: s.righe }).map((_, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-3 rounded-lg border border-primary-50 bg-slate-50/70 px-3 py-2.5"
                    >
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary-100 text-xs font-bold text-primary-500">
                        {i + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="h-2.5 w-3/4 rounded-full bg-primary-200/70" />
                        <div className="mt-1.5 h-2 w-1/2 rounded-full bg-primary-100" />
                      </div>
                      {i === 0 && (
                        <span className="inline-flex shrink-0 items-center rounded-full bg-accent-50 px-2 py-0.5 text-[10px] font-bold text-accent-700 ring-1 ring-accent-200">
                          IN EVIDENZA
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        <p className="mx-auto mt-4 max-w-2xl text-xs font-medium text-primary-400">
          Inserisci i tuoi dati e ottieni un CV pronto in pochi secondi: formattato, elegante e
          perfetto per ogni candidatura.
        </p>
      </div>
    </div>
  );
}
`;
scrivi('src/components/CvTool.tsx', parte1 + parte2);
console.log('  ✓ CvTool: Elena Bianchi, pitch ad alta conversione, mockup moderno');

