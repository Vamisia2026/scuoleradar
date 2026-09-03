/**
 * CheckoutRedirectPage — link diretto Stripe: /checkout/:plan?coupon=CODICE
 *
 * Su mount avvia immediatamente il checkout per il piano indicato applicando
 * il coupon passato in query (es. /checkout/pro-annuale?coupon=RADAR50).
 * Se l'utente non è autenticato il piano+coupon vengono salvati come "intended
 * plan": dopo il login il checkout riparte da solo con lo sconto già applicato.
 */
import { useEffect, useRef, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Loader2, ShieldCheck } from 'lucide-react';
import { useApp } from '@/contexts/AppContext';
import type { PianoId } from '@/lib/pricing';
import { PROMO_CODES_ATTIVI } from '@/lib/promo';

const SLUG_TO_PIANO: Record<string, PianoId> = {
  'pro-annuale': 'pro_annuale',
  'pro-annual': 'pro_annuale',
  pro_annuale: 'pro_annuale',
  'pro-mensile': 'pro_mensile',
  'pro-monthly': 'pro_mensile',
  pro_mensile: 'pro_mensile',
  'a-consumo': 'a_consumo',
  alacarte: 'a_consumo',
  a_consumo: 'a_consumo',
};

export function CheckoutRedirectPage() {
  const { plan } = useParams<{ plan: string }>();
  const [searchParams] = useSearchParams();
  const { avviaCheckout } = useApp();

  const [stato, setStato] = useState<'inizio' | 'inCorso' | 'fatto' | 'errore'>('inizio');
  const [errore, setErrore] = useState<string | null>(null);
  const avviato = useRef(false);

  useEffect(() => {
    if (avviato.current) return;
    avviato.current = true;

    const slug = (plan ?? '').toLowerCase();
    const piano = SLUG_TO_PIANO[slug];
    if (!piano) {
      setStato('errore');
      setErrore('Piano non valido.');
      return;
    }

    const coupon = (searchParams.get('coupon') ?? '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '') || undefined;
    if (coupon && !PROMO_CODES_ATTIVI.includes(coupon)) {
      setStato('errore');
      setErrore('Codice promo non riconosciuto.');
      return;
    }

    setStato('inCorso');
    void avviaCheckout(piano, coupon)
      .then((esito) => {
        if (!esito.ok) {
          setStato('errore');
          setErrore(esito.errore ?? 'Impossibile avviare il pagamento. Riprova.');
        } else {
          setStato('fatto');
        }
      })
      .catch((err) => {
        setStato('errore');
        setErrore((err as { message?: string }).message ?? 'Impossibile avviare il pagamento.');
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-gradient-to-b from-primary-50 to-white px-4">
      {stato === 'inCorso' && (
        <>
          <span className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-500 text-white shadow-soft">
            <Loader2 className="h-7 w-7 animate-spin" />
          </span>
          <p className="text-lg font-semibold text-primary-800">Reindirizzamento a Stripe…</p>
          <p className="max-w-md text-center text-sm text-primary-500">
            Stiamo preparando il checkout con lo sconto già applicato. Se il popup è stato bloccato,
            autorizza la nuova scheda oppure usa il link manuale.
          </p>
        </>
      )}

      {stato === 'fatto' && (
        <>
          <span className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-accent-500 text-white shadow-soft">
            <ShieldCheck className="h-7 w-7" />
          </span>
          <p className="text-lg font-semibold text-primary-800">Checkout aperto</p>
          <p className="max-w-md text-center text-sm text-primary-500">
            Il pagamento si è aperto in una nuova scheda. Al termine tornerai automaticamente nella
            tua dashboard.
          </p>
          <Link
            to="/dashboard/radar"
            className="inline-flex items-center gap-1.5 rounded-xl border border-primary-200 bg-white px-4 py-2.5 text-sm font-semibold text-primary-700 transition hover:bg-primary-50"
          >
            <ArrowLeft className="h-4 w-4" /> Torna alla dashboard
          </Link>
        </>
      )}

      {stato === 'errore' && (
        <>
          <p className="text-sm font-semibold text-error-600">{errore}</p>
          <Link
            to="/prezzi"
            className="inline-flex items-center gap-1.5 rounded-xl bg-primary-500 px-5 py-2.5 text-sm font-semibold text-white shadow-soft transition hover:bg-primary-600"
          >
            <ArrowLeft className="h-4 w-4" /> Vai ai piani
          </Link>
        </>
      )}

      {stato === 'inizio' && <Loader2 className="h-6 w-6 animate-spin text-primary-400" />}
    </div>
  );
}
