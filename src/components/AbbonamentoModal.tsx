import { useEffect, useState } from 'react';
import {
  Sparkles, CheckCircle2, CreditCard, Tag, Loader2, X,
} from 'lucide-react';
import { Modal } from '@/components/Modal';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/components/Toast';
import { PROMO_CODES_ATTIVI } from '@/lib/promo';

interface AbbonamentoModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (promo?: string) => Promise<{ ok: boolean; errore?: string }>;
}

/** Modal di checkout del piano PRO annuale (49€/anno, -10€ con promo referral). */
export function AbbonamentoModal({ open, onClose, onConfirm }: AbbonamentoModalProps) {
  const { mostraToast } = useToast();
  const [invio, setInvio] = useState(false);
  const [promo, setPromo] = useState('');
  const [promoStato, setPromoStato] = useState<'idle' | 'verifica' | 'applicato' | 'errore'>('idle');
  const [promoMsg, setPromoMsg] = useState('');
  const [userId, setUserId] = useState<string | null>(null);

  // Pre-fill + auto-apply del promo da ?promo= (link referral salvato da PrezziPage)
  useEffect(() => {
    if (!open) return;
    const salvato = (() => {
      try {
        return localStorage.getItem('sr_promo') ?? '';
      } catch {
        return '';
      }
    })();
    if (salvato) {
      setPromo(salvato);
      void applicaPromo(salvato);
      try {
        localStorage.removeItem('sr_promo');
      } catch {
        // ignore
      }
    }
  }, [open]);

  useEffect(() => {
    if (!supabase) return;
    void supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
  }, []);

  const applicaPromo = async (codice: string) => {
    if (!supabase) return;
    const upp = codice.toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (!upp) {
      setPromoStato('idle');
      setPromoMsg('');
      return;
    }
    setPromoStato('verifica');
    // Coupon attivo (es. BETA1ANNO): applicato direttamente al checkout Stripe
    // (la Edge Function `checkout` lo mappa sul Coupon ID XRxitsVf, sconto 100%).
    if (PROMO_CODES_ATTIVI.includes(upp)) {
      setPromo(upp);
      setPromoStato('applicato');
      setPromoMsg('Codice promo applicato al checkout');
      return;
    }
    const { data } = await supabase.rpc('valida_codice_promo', { p_codice: upp });
    const riga =
      Array.isArray(data) && data.length > 0
        ? (data[0] as { valido?: boolean; gratuito?: boolean; referrer_id?: string })
        : null;
    // Codice beta/gratuito: valido anche senza referrer.
    // Codice referral: valido SOLO se appartiene a un altro utente (niente auto-promo).
    if (riga?.valido && (riga.gratuito === true || (riga.referrer_id && riga.referrer_id !== userId))) {
      setPromo(upp);
      setPromoStato('applicato');
      setPromoMsg(riga.gratuito === true ? 'Codice promo applicato' : 'Codice sconto applicato (-10€)');
    } else {
      setPromoStato('errore');
      setPromoMsg('Codice promo non valido o non applicabile');
    }
  };

  const handleProcedi = async () => {
    setInvio(true);
    try {
      const esito = await onConfirm(promoStato === 'applicato' ? promo : undefined);
      if (!esito.ok) {
        mostraToast('errore', esito.errore ?? 'Errore durante il pagamento. Riprova.');
      } else {
        // Checkout aperto in una nuova scheda: chiudi il modal e tieni l'app attiva.
        mostraToast('successo', 'Checkout aperto in una nuova scheda.');
        onClose();
      }
    } catch (err) {
      mostraToast('errore', (err as Error).message ?? 'Errore durante il pagamento. Riprova.');
    } finally {
      setInvio(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Abbonati a ScuoleRadar" size="sm">
      <div className="space-y-4">
        <div className="rounded-xl bg-gradient-to-br from-primary-500 to-primary-600 p-5 text-white">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5" />
            <span className="text-sm font-medium">Piano PRO annuale</span>
          </div>
          <p className="mt-2 text-3xl font-bold">
            {promoStato === 'applicato' ? (
              <>
                <span className="mr-1 text-lg font-normal text-white/60 line-through">49€</span>
                39€<span className="text-base font-normal">/anno</span>
              </>
            ) : (
              <>
                49,90€<span className="text-base font-normal">/anno</span>
              </>
            )}
          </p>
          <p className="mt-1 text-sm text-primary-100">
            Ti ripaghi l&apos;abbonamento annuale con meno di due ore di lavoro.
          </p>
        </div>

        {/* Codice promo / sconto */}
        <div className="rounded-xl border border-primary-100 bg-slate-50 p-3">
          <label
            htmlFor="promo-abbonamento"
            className="text-xs font-semibold uppercase tracking-wide text-primary-500"
          >
            Codice promo / sconto
          </label>
          <div className="mt-1.5 flex items-center gap-2">
            <input
              id="promo-abbonamento"
              type="text"
              value={promo}
              onChange={(e) => {
                setPromo(e.target.value.toUpperCase());
                setPromoStato('idle');
                setPromoMsg('');
              }}
              placeholder="ES. BETA1ANNO"
              className="input font-mono text-sm"
              disabled={promoStato === 'applicato'}
            />
            {promoStato === 'applicato' ? (
              <button
                type="button"
                onClick={() => {
                  setPromo('');
                  setPromoStato('idle');
                  setPromoMsg('');
                }}
                className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-primary-200 bg-white px-3 py-2 text-xs font-semibold text-primary-600 transition hover:bg-primary-50"
              >
                <X className="h-3.5 w-3.5" />
                Rimuovi
              </button>
            ) : (
              <button
                type="button"
                onClick={() => void applicaPromo(promo)}
                disabled={promoStato === 'verifica' || !promo}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-primary-500 px-3 py-2 text-xs font-semibold text-white transition hover:bg-primary-600 disabled:opacity-50"
              >
                {promoStato === 'verifica' ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Tag className="h-3.5 w-3.5" />
                )}
                Applica
              </button>
            )}
          </div>
          {promoStato === 'applicato' && (
            <p className="mt-1.5 text-xs font-semibold text-accent-600">✓ {promoMsg}</p>
          )}
          {promoStato === 'errore' && <p className="mt-1.5 text-xs text-error-600">{promoMsg}</p>}
        </div>

        <ul className="space-y-2 text-sm text-primary-700">
          <li className="flex items-start gap-2">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-accent-500" />
            Notifiche mirate e personalizzate su Telegram ed Email (zero spam: solo ciò che ti
            serve, attivo tutto l&apos;anno e disattivabile in qualsiasi momento).
          </li>
          <li className="flex items-start gap-2">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-accent-500" />
            Accesso completo agli Strumenti Docente (CV, Verifica CFU, Modulistica ufficiale e
            Normativa).
          </li>
          <li className="flex items-start gap-2">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-accent-500" />
            Incluso nel piano PRO: Accesso completo a PureFocus (valore commerciale $29/anno).
          </li>
          <li className="flex items-start gap-2">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-accent-500" />
            Rinnovo automatico trasparente, disdicibile in qualsiasi momento dal tuo profilo.
          </li>
        </ul>

        <button
          type="button"
          onClick={() => void handleProcedi()}
          disabled={invio}
          className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-secondary-500 px-5 py-3 text-sm font-semibold text-white shadow-soft transition hover:bg-secondary-600 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {invio ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />}
          {invio ? 'Creazione sessione di pagamento…' : 'Procedi al pagamento (Stripe)'}
        </button>
        <p className="text-left text-xs text-primary-400">
          Pagamento sicuro gestito da Stripe: i tuoi dati non transitano mai da ScuoleRadar.
          Nessun addebito automatico nascosto.
        </p>
      </div>
    </Modal>
  );
}
