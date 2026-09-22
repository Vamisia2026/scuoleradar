import { CheckCircle2, GraduationCap, ShieldCheck, Tag } from 'lucide-react';
import { APERTURA_TUTOR_CFU, DOCUMENTI_RICHIESTI_CFU, NOTA_SSD_CFU } from './tutorIntro';
import { PRIVACY_PROMESSA_CFU } from './privacy';

/**
 * Presentazione del Tutor del Dipartimento CFU (Welcome / landing).
 *
 * Usata in cima al percorso del calcolatore e nella landing pubblica: cosa fa
 * il Tutor, quali dati servono e la promessa privacy della V1 (nessun documento
 * caricato o analizzato).
 */
export function CfuTutorIntro() {
  return (
    <div className="rounded-3xl border border-primary-100 bg-gradient-to-br from-primary-50 via-white to-accent-50/40 px-4 py-3.5 shadow-card sm:px-6 sm:py-4">
      <p className="flex items-center gap-2 text-[11px] font-extrabold uppercase tracking-[0.18em] text-primary-600">
        <GraduationCap className="h-4 w-4" />
        Il Tutor del Dipartimento CFU
      </p>

      <p className="mt-2 text-base font-medium leading-relaxed text-primary-800 sm:text-lg">
        {APERTURA_TUTOR_CFU}
      </p>

      {/* Privacy subito sotto l'intro del Tutor */}
      <p className="mt-3 flex items-start gap-2.5 rounded-xl bg-accent-50/80 px-4 py-2.5 text-sm font-medium leading-relaxed text-accent-900 ring-1 ring-accent-200 sm:text-base">
        <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-accent-600" />
        {PRIVACY_PROMESSA_CFU}
      </p>

      <div className="mt-4">
        <p className="text-sm font-bold text-primary-700">Cosa ti serve per partire:</p>
        <ul className="mt-2 grid gap-2 lg:grid-cols-2">
          {DOCUMENTI_RICHIESTI_CFU.map((voce) => (
            <li
              key={voce}
              className="flex items-start gap-2.5 rounded-xl bg-white/80 px-3.5 py-2.5 text-sm leading-relaxed text-primary-700 ring-1 ring-primary-100 sm:text-base"
            >
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-accent-500" />
              {voce}
            </li>
          ))}
        </ul>
      </div>

      <p className="mt-3 flex items-start gap-2.5 rounded-xl bg-white/80 px-4 py-2.5 text-sm leading-relaxed text-primary-600 ring-1 ring-primary-100 sm:text-base">
        <Tag className="mt-0.5 h-5 w-5 shrink-0 text-secondary-500" />
        {NOTA_SSD_CFU}
      </p>
    </div>
  );
}
