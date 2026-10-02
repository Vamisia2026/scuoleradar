/**
 * Landing — REGISTRAZIONE RAPIDA (sezione sotto l'hero).
 *
 * Le tre informazioni che servono davvero per aprire un account — nome, cognome
 * ed email — stanno qui, nel punto di massima attenzione della pagina. Il form è
 * quello CONDIVISO dell'homepage (`FormRegistrazioneRapida`, montato anche nella
 * chiusura dell'offerta PRO): il submit NON apre una seconda modale, perché il
 * contenitore scrive questi dati nella BOZZA (`lib/bozzaRegistrazione.ts`) e
 * avvia la modale di onboarding/configurazione del Radar, che li trova già
 * compilati (nome, cognome ed email di notifica).
 *
 * Presentazione pura: nessuno stato in questa sezione, nessun secondo percorso.
 */
import { FormRegistrazioneRapida, type DatiRegistrazioneRapida } from './FormRegistrazioneRapida';

/** I dati raccolti dal form restano esportati da qui per i contenitori. */
export type { DatiRegistrazioneRapida } from './FormRegistrazioneRapida';

interface LandingRegistrazioneRapidaProps {
  /** Apre la registrazione con i dati già precompilati. */
  onSubmit: (dati: DatiRegistrazioneRapida) => void;
}

export function LandingRegistrazioneRapida({ onSubmit }: LandingRegistrazioneRapidaProps) {
  return (
    <section className="bg-white pb-8 pt-6" aria-label="Attiva il Radar">
      <div className="mx-auto max-w-5xl px-4 sm:px-6">
        <div className="rounded-2xl border border-primary-100 bg-gradient-to-b from-primary-50 to-white p-6 shadow-card sm:p-7">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-primary-900 sm:text-3xl">
              Attiva il Radar: tre dati e ci pensiamo noi
            </h2>
            <p className="mx-auto mt-2 max-w-2xl text-primary-600">
              Apriamo subito la configurazione del tuo Radar e lo mettiamo a caccia per te. Il primo
              mese di PRO è incluso, con PureFocus dentro.
            </p>
          </div>

          <div className="mt-5">
            <FormRegistrazioneRapida onSubmit={onSubmit} />
          </div>
        </div>
      </div>
    </section>
  );
}
