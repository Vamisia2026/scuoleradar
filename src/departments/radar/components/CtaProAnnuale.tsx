/**
 * Radar — CTA «PRO ANNUALE» (chiusura commerciale della prova).
 *
 * Direttiva cliente (28/09/2026): dopo la configurazione del Radar l'utente trova
 * il pulsante in evidenza che porta all'abbonamento ANNUALE con il mese in omaggio
 * scorporato: «Vuoi toglierti il pensiero e passare subito a PRO Annuale? Ti
 * scontiamo il mese e paghi solo 40 € per tutto l'anno, invece di 49!».
 *
 * Superfici che la montano (le stesse dichiarate nella checklist pagamenti §3):
 *  - la schermata di CONFERMA POST-CONFIGURAZIONE (`RadarWizardModal`, fase «done»);
 *  - il BOX DI BENVENUTO PRO (`BenvenutoProRadar`, con il mese in omaggio attivo).
 *
 * Presentazione pura: il contenitore avvia
 * `avviaCheckout('pro_annuale', PROMO_CODE_PRO_ANNUALE_40)`. Qui non si compone
 * nessuna sessione Stripe e non si invia mai un prezzo: al checkout va SOLO il
 * codice del coupon, che la Edge `checkout` mappa sul coupon Stripe `amount_off`
 * da 900 centesimi con durata `once` (primo anno). Gli importi mostrati arrivano da
 * `lib/pricing.ts`: nessuna cifra è scritta a mano in questa superficie.
 */
import { ArrowRight, Sparkles } from 'lucide-react';
import { PROMO_CODE_PRO_ANNUALE_40 } from '@/lib/promo';
import {
  PREZZO_PRO_ANNO_DOPO_OMAGGIO_ETICHETTA,
  PREZZO_PRO_ANNUO_ETICHETTA,
  SCONTO_OMAGGIO_MESE_EUR,
} from '@/lib/pricing';

interface CtaProAnnualeProps {
  /** Avvia il checkout del PRO annuale con il coupon PROANNUALE40 già applicato. */
  onAttiva: () => void;
  /** Checkout in corso: pulsante bloccato (una sola scheda Stripe per azione). */
  inCorso?: boolean;
}

export function CtaProAnnuale({ onAttiva, inCorso = false }: CtaProAnnualeProps) {
  return (
    <div className="mt-4 rounded-2xl border border-accent-200 bg-accent-50 px-4 py-4 text-left">
      <button
        type="button"
        onClick={onAttiva}
        disabled={inCorso}
        className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-accent-500 px-4 py-3 text-center text-sm font-black leading-snug text-white shadow-soft transition hover:bg-accent-600 disabled:cursor-not-allowed disabled:opacity-70"
      >
        <Sparkles className="h-4 w-4 shrink-0" />
        <span>
          {inCorso
            ? 'Apro il pagamento…'
            : `Vuoi toglierti il pensiero e passare subito a PRO Annuale? Ti scontiamo il mese e paghi solo ${PREZZO_PRO_ANNO_DOPO_OMAGGIO_ETICHETTA} per tutto l'anno, invece di ${PREZZO_PRO_ANNUO_ETICHETTA}!`}
        </span>
        {!inCorso && <ArrowRight className="h-4 w-4 shrink-0" />}
      </button>
      <p className="mt-2 text-xs leading-relaxed text-accent-800">
        Coupon <strong>{PROMO_CODE_PRO_ANNUALE_40}</strong> applicato automaticamente al checkout: è
        lo scorporo del mese in omaggio ({SCONTO_OMAGGIO_MESE_EUR} €) e vale per il primo anno; per
        il mese in prova non è dovuto nulla.
      </p>
    </div>
  );
}
