/**
 * Landing — sezione «Offerta PRO».
 *
 * È il blocco che spiega piano e prezzo in una schermata sola. Le regole di
 * prodotto stanno in `comunicazione/05_abbonamenti_pagamenti/checklist_pagamenti.md`
 * e sono vincolanti: cifre esplicite (`30 giorni`, `49 €/anno`, `9 €/mese`),
 * nessun termine da volantino (omaggi, sconti a tempo, parole di pagamento
 * accostate al periodo incluso), nessuna spinta all'urgenza. L'elenco esatto
 * delle diciture vietate e ammesse sta nella checklist stessa.
 * Le cifre arrivano da `@/lib/pricing` (fonte unica lato client).
 *
 * Presentazione pura: la CTA riusa l'handler del Radar passato dal contenitore.
 */
import { ArrowRight, Check, Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';
import { GIORNI_TRIAL_PRO, PREZZO_PRO_ANNUO_ETICHETTA } from '@/lib/pricing';

interface LandingOffertaProProps {
  /** Avvia il setup del Radar (wizard) o apre la gestione se è già attivo. */
  handleRadarClick: () => void;
  /** true se l'utente ha un Radar già configurato e attivo. */
  radarPronto: boolean;
}

interface PuntoOfferta {
  titolo: string;
  testo: string;
}

/**
 * I tre punti dell'offerta: cosa cambia con il PRO, il partner incluso, il prezzo.
 * Il primo descrive il comportamento reale dei piani (Base = digest, PRO = alert in
 * tempo reale su Telegram; l'email resta una al giorno), senza promettere «tutto».
 */
const PUNTI: readonly PuntoOfferta[] = [
  {
    titolo: 'Alert in tempo reale su Telegram',
    testo:
      "Appena esce un interpello per una delle tue province e classi di concorso il messaggio parte: niente riassunto una volta al giorno.",
  },
  {
    titolo: 'PureFocus PRO incluso',
    testo:
      "Studio e lavoro su YouTube senza distrazioni (29 $/anno): incluso nell'offerta PRO, nessun costo aggiuntivo.",
  },
  {
    titolo: `Poi ${PREZZO_PRO_ANNUO_ETICHETTA}/anno`,
    testo:
      "Un'unica quota annuale (9 €/mese se preferisci il mensile). Alla scadenza torni su Base, senza costi.",
  },
];

export function LandingOffertaPro({ handleRadarClick, radarPronto }: LandingOffertaProProps) {
  return (
    <section className="bg-white py-10" aria-label="Offerta PRO">
      <div className="mx-auto max-w-5xl px-4 sm:px-6">
        <div className="overflow-hidden rounded-2xl border border-primary-100 bg-primary-50/70 shadow-card">
          <div className="border-b border-primary-100 bg-white px-6 py-6 text-center sm:px-8">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-accent-50 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-accent-700 ring-1 ring-inset ring-accent-200">
              <Sparkles className="h-3 w-3" />
              Offerta PRO
            </span>
            <h2 className="mt-3 text-3xl font-bold text-primary-900">
              {GIORNI_TRIAL_PRO} giorni di PRO, tutto incluso
            </h2>
            <p className="mx-auto mt-3 max-w-2xl text-primary-600">
              La prova è la stessa per tutti e resta disponibile tutto l&apos;anno: nessun countdown,
              nessun prezzo che cambia. Alla scadenza torni su Base, senza costi.
            </p>
          </div>

          <div className="grid gap-5 px-6 py-7 sm:grid-cols-3 sm:px-8">
            {PUNTI.map((punto) => (
              <div key={punto.titolo}>
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                  <Check className="h-4 w-4" />
                </span>
                <h3 className="mt-3 text-base font-bold text-primary-800">{punto.titolo}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-primary-600">{punto.testo}</p>
              </div>
            ))}
          </div>

          <div className="flex flex-col items-center gap-3 border-t border-primary-100 bg-white px-6 py-5 sm:flex-row sm:justify-center sm:px-8">
            <button
              onClick={handleRadarClick}
              className={`inline-flex items-center justify-center gap-2 rounded-xl px-6 py-3 text-base font-semibold text-white shadow-soft transition ${
                radarPronto ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-[#2B6F9E] hover:bg-[#225a82]'
              }`}
            >
              {radarPronto ? 'Gestisci il tuo Radar' : 'Attiva il Radar'}
              <ArrowRight className="h-4 w-4" />
            </button>
            <Link
              to="/prezzi"
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-primary-200 bg-white px-6 py-3 text-base font-semibold text-primary-700 transition hover:bg-primary-50"
            >
              Confronta i piani
            </Link>
          </div>

          <p className="border-t border-primary-100 bg-primary-50/70 px-6 py-3 text-center text-xs text-primary-500 sm:px-8">
            PRO: rinnovo automatico di {PREZZO_PRO_ANNUO_ETICHETTA}/anno, disdici quando vuoi. La
            prova termina senza costi.
          </p>
        </div>
      </div>
    </section>
  );
}
