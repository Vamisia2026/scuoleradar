import { useEffect, useState } from 'react';
import {
  Sparkles, Minus, Plus, Tag, Loader2, X, AlertTriangle, CreditCard,
} from 'lucide-react';
import { Modal } from '@/components/Modal';
import { useApp } from '@/contexts/AppContext';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/components/Toast';
import { validaPromo, SCONTO_PROMO_EUR } from '@/lib/promo';

const PREZZO_CREDITO = 5;
const MAX_CREDITI = 10;

/** Modal di checkout per i "Crediti a consumo" (5€/credito, quantità 1–10). */
export function CreditiModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { avviaCheckout } = useApp();
  const { mostraToast } = useToast();
  const [quantita, setQuantita] = useState(1);
  const [promo, setPromo] = useState('');
  const [promoStato, setPromoStato] = useState<'idle' | 'verifica' | 'applicato' | 'errore'>('idle');
  const [promoMsg, setPromoMsg] = useState('');
  const [userId, setUserId] = useState<string | null>(null);
  const [invio, setInvio] = useState(false);

  // Reset dello stato a ogni apertura
  useEffect(() => {
    if (!open) return;
    setQuantita(1);
    setPromo('');
    setPromoStato('idle');
    setPromoMsg('');
    setInvio(false);
  }, [open]);

  useEffect(() => {
    if (!supabase) return;
    void supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
  }, []);

  const totale = quantita * PREZZO_CREDITO;
  const sconto = promoStato === 'applicato' ? Math.min(SCONTO_PROMO_EUR, totale) : 0;
  const totaleFinale = totale - sconto;

  const applicaPromo = async (codice: string) => {
    if (!supabase) return;
    const upp = codice.toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (!upp) {
      setPromoStato('idle');
      setPromoMsg('');
      return;
    }
    setPromoStato('verifica');
    const esito = await validaPromo(upp, userId);
    if (esito.valido) {
      setPromo(upp);
      setPromoStato('applicato');
      setPromoMsg('Codice sconto applicato (-10€)');
    } else {
      setPromoStato('errore');
      setPromoMsg('Codice promo non valido o non applicabile');
    }
  };

  const handleProcedi = async () => {
    setInvio(true);
    try {
      const esito = await avviaCheckout(
        'alacarte',
        promoStato === 'applicato' ? promo : undefined,
        quantita,
      );
      if (!esito.ok) {
        mostraToast('errore', esito.errore ?? 'Errore durante il pagamento. Riprova.');
      }
    } catch (err) {
      mostraToast('errore', (err as Error).message ?? 'Errore durante il pagamento. Riprova.');
    } finally {
      setInvio(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Crediti a consumo" size="sm">
      <div className="space-y-4">
        <div className="rounded-xl bg-gradient-to-br from-secondary-500 to-secondary-600 p-5 text-white">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5" />
            <span className="text-sm font-medium">Crediti a consumo</span>
          </div>
          <p className="mt-2 text-3xl font-bold">
            {totaleFinale}€
            {sconto > 0 && (
              <span className="ml-1 text-lg font-normal text-white/60 line-through">{totale}€</span>
            )}
          </p>
          <p className="mt-1 text-sm text-white/80">
            {quantita} credito{quantita > 1 ? 'i' : ''} × {PREZZO_CREDITO}€ — ogni credito vale un
            servizio singolo (CV, Check CFU, modelli).
          </p>
        </div>

        {/* Quantità */}
        <div>
          <span className="text-xs font-semibold uppercase tracking-wide text-primary-500">
            Quantità crediti
          </span>
          <div className="mt-1.5 flex items-center gap-2">
            <button
              onClick={() => setQuantita((q) => Math.max(1, q - 1))}
              aria-label="Riduci crediti"
              disabled={quantita <= 1}
              className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-primary-200 text-primary-700 transition hover:bg-primary-50 disabled:opacity-40"
            >
              <Minus className="h-4 w-4" />
            </button>
            <span className="min-w-12 text-center text-xl font-bold text-primary-800">{quantita}</span>
            <button
              onClick={() => setQuantita((q) => Math.min(MAX_CREDITI, q + 1))}
              aria-label="Aumenta crediti"
              disabled={quantita >= MAX_CREDITI}
              className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-primary-200 text-primary-700 transition hover:bg-primary-50 disabled:opacity-40"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {[1, 3, 5, 10].map((n) => (
              <button
                key={n}
                onClick={() => setQuantita(n)}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                  quantita === n
                    ? 'bg-secondary-500 text-white'
                    : 'border border-primary-200 text-primary-600 hover:bg-primary-50'
                }`}
              >
                {n} {n === 1 ? 'credito' : 'crediti'}
              </button>
            ))}
          </div>
        </div>

        {/* Codice promo / sconto */}
        <div className="rounded-xl border border-primary-100 bg-slate-50 p-3">
          <label
            htmlFor="promo-crediti"
            className="text-xs font-semibold uppercase tracking-wide text-primary-500"
          >
            Codice promo / sconto
          </label>
          <div className="mt-1.5 flex items-center gap-2">
            <input
              id="promo-crediti"
              type="text"
              value={promo}
              onChange={(e) => {
                setPromo(e.target.value.toUpperCase());
                setPromoStato('idle');
                setPromoMsg('');
              }}
              placeholder="ES. BARTOLOANSALDI"
              className="input font-mono text-sm"
              disabled={promoStato === 'applicato'}
            />
            {promoStato === 'applicato' ? (
              <button
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

        {/* Avviso trasparente/ironico */}
        <div className="rounded-xl border border-secondary-200 bg-secondary-50 p-4 text-sm text-secondary-800">
          <p className="flex items-center gap-1.5 font-semibold">
            <AlertTriangle className="h-4 w-4" />
            La scelta è tua (ma ascolta)
          </p>
          <p className="mt-1 text-xs leading-relaxed">
            Con 10 crediti spendi 50€ ed è una tantum. Il piano PRO costa 49€/anno e include tutto
            illimitato + PureFocus (valore 29$). Se fai questa scelta sei libero di farlo, ma non
            conviene ed è a fondo perduto (nessun rimborso).
          </p>
        </div>

        <button
          onClick={() => void handleProcedi()}
          disabled={invio}
          className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-secondary-500 px-5 py-3 text-sm font-semibold text-white shadow-soft transition hover:bg-secondary-600 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {invio ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />}
          {invio ? 'Creazione sessione di pagamento…' : `Procedi al pagamento (${totaleFinale}€)`}
        </button>
      </div>
    </Modal>
  );
}

