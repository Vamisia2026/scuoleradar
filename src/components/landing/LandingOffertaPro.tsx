/**
 * Landing — sezione «Offerta PRO».
 *
 * La sezione CHIUDE la conversione: le tre colonne contengono SOLO i benefici
 * reali del piano — avvisi Telegram in tempo reale, email riepilogativa delle
 * 17.00, PureFocus incluso — e non esistono vie d'uscita (nessun link ad altri
 * piani o alla pagina dei piani). Qui non compare nessun importo: la dichiarazione
 * commerciale dell'offerta di continuazione vive nelle superfici di fine flusso
 * (regole vincolanti in `comunicazione/05_abbonamenti_pagamenti/checklist_pagamenti.md`).
 *
 * SOTTO il testo dell'offerta la sezione porta la REGISTRAZIONE PARZIALE (nome,
 * cognome, email) per chi non ha ancora un account: il form è quello condiviso
 * della homepage (`FormRegistrazioneRapida`, campi di input nativi) e porta dritto
 * alla configurazione del Radar PRO a 4 province. Per chi non ha un account è
 * l'unica azione disponibile: nessun piano alternativo, nessun link di uscita. Chi
 * è già dentro vede la CTA del proprio Radar.
 *
 * Presentazione pura: la CTA riusa l'handler del Radar passato dal contenitore.
 */
import { ArrowRight, Check, Sparkles } from 'lucide-react';
import { GIORNI_TRIAL_PRO } from '@/lib/pricing';
import { type ChiaveTesto } from '@/data/editableTexts';
import { useTestiEditabili } from '@/hooks/useTestiEditabili';
import { FormRegistrazioneRapida, type DatiRegistrazioneRapida } from './FormRegistrazioneRapida';

interface LandingOffertaProProps {
  /** Avvia il setup del Radar (wizard) o apre la gestione se è già attivo. */
  handleRadarClick: () => void;
  /** true se l'utente ha un Radar già configurato e attivo. */
  radarPronto: boolean;
  /**
   * Chiusura con registrazione parziale per chi non ha ancora un account: il
   * contenitore scrive i dati nella bozza e apre la configurazione del Radar.
   * Assente = utente già autenticato → resta la CTA del Radar.
   */
  onRegistrazioneRapida?: (dati: DatiRegistrazioneRapida) => void;
}

/** Un blocco dell'offerta: titolo e paragrafo sono CHIAVI del registro testi. */
interface PuntoOfferta {
  titolo: ChiaveTesto;
  testo: ChiaveTesto;
}

/**
 * I TRE punti dell'offerta — e solo questi tre: avvisi Telegram in tempo reale,
 * email riepilogativa delle 17.00, PureFocus incluso nel piano PRO. Descrivono
 * ciò che il piano fa davvero, senza aprire nessuna via d'uscita.
 *
 * I TESTI vivono nel registro modificabile `src/data/editableTexts.ts`
 * (`prezzi.offerta.*`) e la vetrina li rende PER CHIAVE: una sola verità,
 * modificabile al volo dall'«Editor Testi Rapido» della DEV Toolbar.
 */
const PUNTI: readonly PuntoOfferta[] = [
  { titolo: 'prezzi.offerta.telegram.titolo', testo: 'prezzi.offerta.telegram.testo' },
  { titolo: 'prezzi.offerta.email.titolo', testo: 'prezzi.offerta.email.testo' },
  { titolo: 'prezzi.offerta.purefocus.titolo', testo: 'prezzi.offerta.purefocus.testo' },
];

export function LandingOffertaPro({
  handleRadarClick,
  radarPronto,
  onRegistrazioneRapida,
}: LandingOffertaProProps) {
  // Testi dei tre blocchi dal registro (default del codice + eventuale override DEV).
  const { testo } = useTestiEditabili();
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
            {/* COPY ESATTA DELLA DIRETTIVA CLIENTE (28/09/2026): la frase sta su UNA
                riga di sorgente — nessun testo spezzato — ed è più grande: è la
                promessa che vende. Le cifre NON entrano qui: la vetrina resta senza
                importi e l'offerta di continuazione si dichiara a fine flusso. */}
            <p className="mx-auto mt-3 max-w-3xl text-lg font-medium leading-relaxed text-primary-700">
              Siamo così sicuri che Scuole Radar ti piacerà che il primo mese PRO te lo offriamo noi. Se poi non vuoi abbonarti, passerai automaticamente a un account Base.
            </p>

            {/* LEAD CAPTURE — IMMEDIATAMENTE SOTTO la copy (direttiva cliente): campi
                di input nativi Nome, Cognome ed Email (tutti `required`) e pulsante
                principale con la scritta esatta «ATTIVA IL TUO RADAR». Nessun
                passaggio intermedio: il submit scrive i tre dati nella BOZZA e apre
                direttamente la modale di configurazione del Radar (PRO, fino a 4
                province) già compilata. Chi è già autenticato vede la CTA del proprio
                Radar. */}
            {onRegistrazioneRapida ? (
              <div className="mx-auto mt-4 max-w-3xl text-left">
                <FormRegistrazioneRapida
                  onSubmit={onRegistrazioneRapida}
                  etichetta="ATTIVA IL TUO RADAR"
                />
              </div>
            ) : (
              <div className="mt-4 flex justify-center">
                <button
                  onClick={handleRadarClick}
                  className={`inline-flex items-center justify-center gap-2 rounded-xl px-6 py-3 text-base font-semibold text-white shadow-soft transition ${
                    radarPronto ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-[#2B6F9E] hover:bg-[#225a82]'
                  }`}
                >
                  {radarPronto ? 'GESTISCI IL TUO RADAR' : 'ATTIVA IL TUO RADAR'}
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>

          <div className="grid gap-5 px-6 py-7 sm:grid-cols-3 sm:px-8">
            {PUNTI.map((punto) => (
              <div key={punto.titolo}>
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                  <Check className="h-4 w-4" />
                </span>
                <h3 className="mt-3 text-base font-bold text-primary-800">{testo(punto.titolo)}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-primary-600">{testo(punto.testo)}</p>
              </div>
            ))}
          </div>

        </div>
      </div>
    </section>
  );
}
