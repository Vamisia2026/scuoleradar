/**
 * Landing — sezione HERO (primo schermo pubblico).
 *
 * Layout a DUE COLONNE: a sinistra il copy (badge, titolo su due righe, paragrafo),
 * a destra il box interattivo «Prova il Radar» e — SUBITO SOTTO il box — i due
 * inviti all'azione «ATTIVA IL TUO RADAR» e «ACCEDI», su DUE colonne simmetriche
 * della stessa larghezza (direttiva cliente 28/09/2026). Il box è il simulatore
 * pubblico del dominio Radar (`SimulatorRadar`), consumato dalla facciata
 * `@/departments/radar`: qui non vive nessuna logica di dominio.
 *
 * Il box NON viene stirato in altezza (nessun `h-full`): resta alla sua altezza
 * naturale con i pulsanti attaccati sotto. Lo spazio verticale che avanza rispetto
 * alla colonna del copy viene RIPARTITO (`lg:items-center`), mai accumulato in un
 * vuoto sotto i pulsanti; sotto `lg` le colonne restano incolonnate (`items-start`).
 * Se il menu verde dei risultati copre temporaneamente i pulsanti durante
 * l'espansione, è il comportamento atteso.
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

      <div className="relative mx-auto max-w-6xl px-4 pb-8 pt-6 sm:px-6 sm:pt-6">
        {/* `items-start` sotto `lg` (colonne incolonnate) e `lg:items-center`: da
            desktop il box «Prova il Radar» e i suoi pulsanti restano alla loro altezza
            naturale e lo scarto rispetto alla colonna del copy si RIPARTISCE sopra e
            sotto — nessun vuoto sproporzionato in fondo alla colonna destra. */}
        <div className="grid items-start gap-6 lg:items-center lg:grid-cols-[minmax(0,1fr)_34rem] lg:gap-8">
          {/* Colonna sinistra — copy puro: badge, titolo a due righe, paragrafo. */}
          <div className="flex animate-fade-in flex-col text-center lg:text-left">
            <span className="inline-flex items-center gap-2 rounded-full border border-primary-200 bg-white px-3 py-1 text-xs font-bold text-primary-600 shadow-soft">
              <Radar className="h-3.5 w-3.5 text-secondary-500" />
              La piattaforma per chi vive la scuola ogni giorno
            </span>
            {/* COPY A DUE RIGHE (direttiva cliente): ogni frase è una riga a sé.
                La separazione usa `block`, MAI un'interruzione forzata di markup:
                il gate di copy (`npm run test:copy:etico`) resta verde proprio
                perché il testo non contiene tag di a-capo. */}
            <h1 className="mt-4 text-4xl font-bold leading-tight tracking-tight text-primary-900 sm:text-5xl">
              <span className="block">Ogni giorno decine di opportunità.</span>
              <span className="block text-secondary-500">Noi intercettiamo solo quelle per te.</span>
            </h1>
            <p className="mx-auto mt-4 max-w-xl text-lg leading-relaxed text-primary-700 lg:mx-0">
              Scansioniamo h24 interpelli e bandi per TUTTI i lavoratori della scuola: docenti,
              supplenti, personale ATA ed esperti esterni. Progetti retribuiti, PON/PNRR, CPIA e
              supplenze: ti avvisiamo solo quando esce un&apos;opportunità reale nella tua provincia.
            </p>
            {/* Nessun pulsante qui: gli inviti all'azione vivono SOTTO il box
                «Prova il Radar», nella colonna destra (direttiva cliente). */}
          </div>

          {/* Colonna destra — box «Prova il Radar» e, SUBITO SOTTO, i due inviti
              all'azione su due colonne simmetriche (direttiva cliente 28/09/2026). Il
              box non riceve `h-full`: resta alla sua altezza naturale e lo scarto
              rispetto al copy si ripartisce (`lg:items-center` sul contenitore). */}
          <div className="flex animate-fade-in flex-col">
            {/* Nessun titolo doppio (il box dichiara già «Prova il Radar») e nessuna
                riga sopra il box: il responso deve stare tutto nel primo schermo. */}
            <SimulatorRadar />
            {/* Due pulsanti della STESSA larghezza, incolonnati sotto il box e affiancati
                da `sm` in su: blocco di conversione pulito e simmetrico, a filo del box. */}
            <div className="mt-3 grid w-full gap-3 sm:grid-cols-2">
              <button
                onClick={handleRadarClick}
                className={`btn-glint inline-flex w-full items-center justify-center gap-2 rounded-xl px-6 py-3 text-base font-semibold text-white shadow-soft transition ${
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
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-primary-200 bg-white px-6 py-3 text-base font-semibold text-primary-700 transition hover:bg-primary-50"
              >
                Accedi
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
