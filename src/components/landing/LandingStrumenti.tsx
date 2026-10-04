/**
 * Landing — griglia «I nostri strumenti».
 *
 * I tre servizi in vetrina seguono le FEATURE FLAGS: un dipartimento in `off`
 * sparisce anche dal sito pubblico (nessuna card che porta a un modulo spento).
 * Componente autonomo (legge `useFeatureFlags`) per tenere `LandingPage` sotto le
 * soglie di dimensione del gate strutturale.
 *
 * La card PureFocus mostra il WORDMARK UFFICIALE del partner (Pure nero + Focus
 * blu cobalto) al posto dell'icona: niente emoji, il marchio è quello vero.
 */
import { Link } from 'react-router-dom';
import type { DipartimentoId } from '@/config/features';
import { useFeatureFlags } from '@/hooks/useFeatureFlags';
import { PureFocusWordmark } from '@/components/PureFocusCard';

interface Strumento {
  modulo: DipartimentoId;
  to: string;
  emoji?: string;
  /** true → al posto dell'icona si mostra il wordmark ufficiale del partner. */
  wordmark?: boolean;
  titolo: string;
  sottotitolo: string;
}

const STRUMENTI: readonly Strumento[] = [
  {
    modulo: 'radar',
    to: '/servizi/radar-interpelli',
    emoji: '📡',
    titolo: 'Radar Scuole',
    sottotitolo: 'Solo le opportunità che ti riguardano davvero',
  },
  {
    modulo: 'modulistica',
    to: '/servizi/moduli',
    emoji: '📁',
    titolo: 'Modulistica',
    sottotitolo: "Documenti e modulistica pronti all'uso",
  },
  {
    modulo: 'purefocus',
    to: '/dashboard/purefocus',
    wordmark: true,
    titolo: 'Pure Focus',
    sottotitolo: 'Studia e lavora su YouTube senza distrazioni',
  },
];

export function LandingStrumenti() {
  const { visibile } = useFeatureFlags();
  const voci = STRUMENTI.filter((s) => visibile(s.modulo));
  if (voci.length === 0) return null;

  return (
    <section className="bg-white py-8">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mb-6 text-center">
          <h2 className="text-3xl font-bold text-primary-900">I nostri strumenti</h2>
          <p className="mt-3 text-primary-600">
            Tutto in un&apos;unica dashboard, per non perdere tempo.
          </p>
        </div>
        {/* Card CENTRATE e bilanciate: con due strumenti attivi (Radar + Modulistica)
            la griglia a 3 colonne li lasciava spostati a sinistra; il flex-wrap
            centrato li tiene in asse qualunque sia il numero di moduli visibili. */}
        <div className="mx-auto flex max-w-4xl flex-wrap items-stretch justify-center gap-5">
          {voci.map((s) => (
            <Link
              key={s.to}
              to={s.to}
              className="group flex w-full flex-col rounded-2xl border border-primary-100 bg-white p-6 shadow-card transition hover:-translate-y-0.5 hover:shadow-soft sm:w-[19rem]"
            >
              <span className="flex h-12 items-center">
                {s.wordmark ? (
                  <PureFocusWordmark className="text-xl" />
                ) : (
                  <span className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-primary-50 text-2xl">
                    {s.emoji}
                  </span>
                )}
              </span>
              <h3 className={s.wordmark ? 'sr-only' : 'mt-4 text-lg font-bold text-primary-800'}>
                {s.titolo}
              </h3>
              <p className={s.wordmark ? 'mt-3 text-base text-primary-600' : 'mt-1.5 text-base text-primary-600'}>
                {s.sottotitolo}
              </p>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
