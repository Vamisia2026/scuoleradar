/**
 * Landing — sezione CTA finale (ultimo invito all'azione della pagina).
 *
 * Presentazione pura: testo fisso + stato del Radar e handler di avvio passati
 * dal contenitore. Il copy cambia in base a `radarPronto` (già attivo / da
 * attivare), senza duplicare la logica nel contenitore.
 */
import { Radar } from 'lucide-react';

interface LandingCtaProps {
  /** Avvia il setup del Radar (wizard o PRO-Gift). */
  handleRadarClick: () => void;
  /** true se l'utente ha un Radar già configurato e attivo. */
  radarPronto: boolean;
}

export function LandingCta({ handleRadarClick, radarPronto }: LandingCtaProps) {
  return (
      <section className="bg-white py-10 sm:py-12">
        <div className="mx-auto max-w-3xl px-4 text-center sm:px-6">
          <h2 className="text-3xl font-bold text-primary-900 sm:text-4xl">
            {radarPronto ? 'Il tuo Radar è attivo' : 'ATTIVA IL TUO RADAR'}
          </h2>
          <button
            onClick={handleRadarClick}
            className={`mt-8 inline-flex items-center justify-center gap-2 rounded-xl px-8 py-4 text-base font-semibold text-white shadow-soft transition ${
              radarPronto
                ? 'bg-emerald-600 hover:bg-emerald-700'
                : 'bg-primary-500 hover:bg-primary-600'
            }`}
          >
            {radarPronto ? 'GESTRISCI RADAR 🟢' : (
              <>
                <Radar className="h-5 w-5" />
                ATTIVA IL TUO RADAR
              </>
            )}
          </button>
        </div>
      </section>
  );
}
