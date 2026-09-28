/**
 * Landing — REGISTRAZIONE RAPIDA (sotto l'hero).
 *
 * Le tre informazioni che servono davvero per aprire un account — nome, cognome
 * ed email — stanno qui, nel punto di massima attenzione della pagina. Il submit
 * NON apre una seconda modale: il contenitore scrive questi dati nella BOZZA
 * (`lib/bozzaRegistrazione.ts`) e avvia la modale di onboarding/configurazione del
 * Radar, che li trova già compilati (nome, cognome ed email di notifica).
 *
 * Presentazione pura: la logica di prefill vive nel contenitore (`LandingPage`).
 */
import { useState, type FormEvent } from 'react';
import { AlertCircle, ArrowRight, Radar } from 'lucide-react';

export interface DatiRegistrazioneRapida {
  nome: string;
  cognome: string;
  email: string;
}

interface LandingRegistrazioneRapidaProps {
  /** Apre la registrazione con i dati già precompilati. */
  onSubmit: (dati: DatiRegistrazioneRapida) => void;
}

const CAMPO =
  'w-full rounded-xl border border-primary-200 bg-white px-4 py-3 text-sm text-primary-800 transition focus:border-primary-500';

export function LandingRegistrazioneRapida({ onSubmit }: LandingRegistrazioneRapidaProps) {
  const [nome, setNome] = useState('');
  const [cognome, setCognome] = useState('');
  const [email, setEmail] = useState('');
  const [errore, setErrore] = useState('');

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const dati = { nome: nome.trim(), cognome: cognome.trim(), email: email.trim() };
    if (!dati.nome || !dati.cognome || !dati.email) {
      setErrore('Inserisci nome, cognome ed email per attivare il Radar.');
      return;
    }
    setErrore('');
    onSubmit(dati);
  };

  return (
    <section className="bg-white py-8" aria-label="Attiva il Radar">
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

          <form onSubmit={handleSubmit} className="mt-5 grid gap-3 sm:grid-cols-3" noValidate>
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-primary-700">Nome</span>
              <input
                type="text"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                className={CAMPO}
                autoComplete="given-name"
                placeholder="Nome"
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-primary-700">Cognome</span>
              <input
                type="text"
                value={cognome}
                onChange={(e) => setCognome(e.target.value)}
                className={CAMPO}
                autoComplete="family-name"
                placeholder="Cognome"
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-primary-700">Email</span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={CAMPO}
                autoComplete="email"
                placeholder="La tua email"
              />
            </label>

            <div className="sm:col-span-3">
              {errore && (
                <p className="mb-2 flex items-center gap-1.5 text-sm font-medium text-red-600">
                  <AlertCircle className="h-4 w-4" />
                  {errore}
                </p>
              )}
              <button
                type="submit"
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#2B6F9E] px-6 py-3.5 text-base font-black uppercase tracking-wide text-white shadow-soft transition hover:bg-[#225a82] sm:w-auto"
              >
                <Radar className="h-5 w-5" />
                Attiva il tuo Radar
                <ArrowRight className="h-4 w-4" />
              </button>
              <p className="mt-2 text-xs text-primary-500">
                Si apre la configurazione del Radar: nome, cognome ed email sono già impostati.
              </p>
            </div>
          </form>
        </div>
      </div>
    </section>
  );
}