/**
 * Landing — sezione «Offerta PRO».
 *
 * La sezione CHIUDE la conversione: le tre colonne contengono SOLO i benefici
 * reali del piano — avvisi Telegram in tempo reale, email riepilogativa delle
 * 17.00, PureFocus incluso — e non esistono vie d'uscita (nessun link ad altri
 * piani o alla pagina dei piani). Qui non compare nessun importo né alcuna
 * condizione contrattuale: la dichiarazione commerciale vive in `/prezzi`, nelle
 * FAQ e nel passo di pagamento (regole vincolanti in
 * `comunicazione/05_abbonamenti_pagamenti/checklist_pagamenti.md`).
 *
 * Presentazione pura: la CTA riusa l'handler del Radar passato dal contenitore.
 */
import { ArrowRight, Check, Sparkles } from 'lucide-react';
import { GIORNI_TRIAL_PRO } from '@/lib/pricing';

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
 * I TRE punti dell'offerta — e solo questi tre: avvisi Telegram in tempo reale,
 * email riepilogativa delle 17.00, PureFocus incluso nel piano PRO. Descrivono
 * ciò che il piano fa davvero, senza aprire nessuna via d'uscita.
 */
const PUNTI: readonly PuntoOfferta[] = [
  {
    titolo: 'Avvisi Telegram in tempo reale',
    testo:
      "Appena esce un interpello per una delle tue province il messaggio parte: niente riepilogo una volta al giorno.",
  },
  {
    titolo: 'Email riepilogativa tutti i giorni alle 17.00',
    testo:
      "Un solo messaggio al giorno con tutte le opportunità uscite: le ritrovi nella tua casella, quando puoi.",
  },
  {
    titolo: 'PureFocus incluso nel piano PRO',
    testo:
      "Studio e lavoro su YouTube senza distrazioni (29 $/anno): incluso nel PRO, nessun costo aggiuntivo.",
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
            <p className="mx-auto mt-3 max-w-2xl font-medium text-primary-700">
              Un mese intero di PRO offerto da noi: attivi il Radar e da subito le opportunità
              arrivano a te.
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

          {/* CTA unica: nessun link alla pagina prezzi — la sezione chiude la
              conversione e non offre vie d'uscita verso altri piani. */}
          <div className="flex justify-center border-t border-primary-100 bg-white px-6 py-5 sm:px-8">
            <button
              onClick={handleRadarClick}
              className={`inline-flex items-center justify-center gap-2 rounded-xl px-6 py-3 text-base font-semibold text-white shadow-soft transition ${
                radarPronto ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-[#2B6F9E] hover:bg-[#225a82]'
              }`}
            >
              {radarPronto ? 'Gestisci il tuo Radar' : 'Attiva il tuo Radar'}
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
