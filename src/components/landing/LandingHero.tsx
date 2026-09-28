/**
 * Landing — sezione HERO (primo schermo pubblico).
 *
 * Layout a DUE COLONNE: a sinistra il copy e i due inviti all'azione, a destra il
 * box interattivo «Prova il Radar» (si sceglie la SOLA provincia: nessun selettore
 * di classe di concorso e nessuna riga difensiva sopra il box). Il box è il
 * simulatore pubblico del dominio Radar (`SimulatorRadar`), consumato dalla
 * facciata `@/departments/radar`: qui non vive nessuna logica di dominio.
 *
 * Presentazione pura: lo stato «Radar pronto» e gli handler arrivano come props.
 * Spaziature compatte (`pt-6` / `pb-8`): lo stacco fra header, menu e primo
 * contenuto è minimo, così l'impatto visivo arriva subito.
 */
import { ArrowRight, Radar } from 'lucide-react';
import { SimulatorRadar } from '@/departments/radar';

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

      <div className="relative mx-auto max-w-6xl px-4 pb-8 pt-6 sm:px-6 sm:pt-8">
        <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_34rem] lg:gap-8">
          {/* Colonna sinistra — copy + inviti all'azione. */}
          <div className="animate-fade-in text-center lg:text-left">
            <span className="inline-flex items-center gap-2 rounded-full border border-primary-200 bg-white px-3 py-1 text-xs font-bold text-primary-600 shadow-soft">
              <Radar className="h-3.5 w-3.5 text-secondary-500" />
              La piattaforma per chi vive la scuola ogni giorno
            </span>
            <h1 className="mt-4 text-4xl font-bold leading-tight tracking-tight text-primary-900 sm:text-5xl">
              Ogni giorno decine di opportunità.{' '}
              <span className="text-secondary-500">Noi intercettiamo solo quelle per te.</span>
            </h1>
            <p className="mx-auto mt-4 max-w-xl text-lg leading-relaxed text-primary-700 lg:mx-0">
              Scansioniamo h24 interpelli e bandi per TUTTI i lavoratori della scuola: docenti,
              supplenti, personale ATA ed esperti esterni. Progetti retribuiti, PON/PNRR, CPIA e
              supplenze: ti avvisiamo solo quando esce un&apos;opportunità reale nella tua provincia.
            </p>
            <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row lg:justify-start">
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
          </div>

          {/* Colonna destra — box «Prova il Radar» (simulatore del dominio Radar). */}
          <div className="animate-fade-in">
            {/* Nessun titolo doppio (il box dichiara già «Prova il Radar») e nessuna
                riga sopra il box: il responso deve stare tutto nel primo schermo. */}
            <SimulatorRadar />
          </div>
        </div>
      </div>
    </section>
  );
}
