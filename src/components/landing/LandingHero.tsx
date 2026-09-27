/**
 * Landing — sezione HERO (primo schermo pubblico).
 *
 * Responsabilità unica: headline, badge di stato Radar e i due inviti
 * all'azione (accedi / configura il Radar). Presentazione pura: lo stato
 * «Radar pronto» e gli handler arrivano come props.
 *
 * Il box «Prova il Radar» (simulatore) NON vive più qui: occupava metà del primo
 * schermo. È diventato la sezione `LandingProvaRadar` (dopo gli strumenti), così
 * l'hero resta un invito compatto e il Radar Live prende il palco subito sotto.
 */
import { ArrowDown, ArrowRight, Radar } from 'lucide-react';

interface LandingHeroProps {
  /** true quando il bagliore animato del titolo è attivo. */
  glintOn: boolean;
  /** Apre il flusso di accesso/registrazione. */
  handleAccedi: () => void;
  /** Avvia il setup del Radar (wizard o PRO-Gift). */
  handleRadarClick: () => void;
  /** true se l'utente ha un Radar già configurato e attivo. */
  radarPronto: boolean;
}

export function LandingHero({
  glintOn,
  handleAccedi,
  handleRadarClick,
  radarPronto,
}: LandingHeroProps) {
  return (
      <section className="relative overflow-hidden bg-gradient-to-b from-primary-50 via-white to-white">
        <div className="pointer-events-none absolute -top-24 -right-24 h-72 w-72 rounded-full bg-secondary-100/60 blur-3xl" />
        <div className="pointer-events-none absolute top-40 -left-24 h-72 w-72 rounded-full bg-primary-100/60 blur-3xl" />
        <div className="relative mx-auto max-w-3xl px-4 pt-8 pb-8 text-center sm:px-6 sm:pt-12 sm:pb-10">
          <div className="animate-fade-in">
            <span className="inline-flex items-center gap-2 rounded-full border border-primary-200 bg-white px-3 py-1 text-xs font-bold text-primary-600 shadow-soft">
              <Radar className="h-3.5 w-3.5 text-secondary-500" />
              La piattaforma per chi vive la scuola ogni giorno
            </span>
            <h1 className="mt-4 text-4xl font-bold leading-tight tracking-tight text-primary-900 sm:text-5xl">
              Ogni giorno decine di opportunità.
              <br />
              <span className="text-secondary-500">Noi intercettiamo solo quelle per te.</span>
            </h1>
            <p className="mx-auto mt-5 max-w-2xl text-lg leading-relaxed text-primary-700">
              Scansioniamo h24 interpelli e bandi per TUTTI i lavoratori della scuola: docenti,
              supplenti, personale ATA ed esperti esterni. Progetti retribuiti, PON/PNRR, CPIA e
              supplenze: ti avvisiamo solo quando esce un&apos;opportunità reale nella tua provincia.
            </p>
            <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
              <button
                onClick={handleRadarClick}
                className={`btn-glint inline-flex items-center justify-center gap-2 rounded-xl px-6 py-3 text-base font-semibold text-white shadow-soft transition ${
                  radarPronto ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-[#2B6F9E] hover:bg-[#225a82]'
                }${glintOn && !radarPronto ? ' btn-glint-on' : ''}`}
              >
                {radarPronto ? (
                  <>
                    <span className="relative flex h-2.5 w-2.5">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white/60 opacity-75" />
                      <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-white" />
                    </span>
                    RADAR ATTIVO 🟢
                  </>
                ) : (
                  <>
                    <Radar className="h-5 w-5" />
                    ATTIVA IL TUO RADAR
                  </>
                )}
                {!radarPronto && <ArrowRight className="h-4 w-4" />}
              </button>
              <button
                onClick={handleAccedi}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-primary-200 bg-white px-6 py-3 text-base font-semibold text-primary-700 transition hover:bg-primary-50"
              >
                Accedi
              </button>
            </div>

            {/* L'hero non contiene più il simulatore: il Radar Live è il primo
                contenuto della pagina, quindi l'hero lo annuncia e basta. */}
            <p className="mt-7 inline-flex flex-wrap items-center justify-center gap-2 text-sm font-semibold text-primary-500">
              <ArrowDown className="h-4 w-4" />
              Qui sotto il Radar Live: gli interpelli pubblicati in questi giorni in tutta Italia.
            </p>
          </div>
        </div>
      </section>
  );
}
