import { useState } from 'react';
import { Lock, Sparkles } from 'lucide-react';
import { useApp } from '@/contexts/AppContext';
import { AbbonamentoModal } from '@/components/AbbonamentoModal';

/** Paywall riusabile per gli strumenti riservati ai membri PRO. */
export function ServiziPaywall({
  titolo = 'Contenuto riservato',
  messaggio = 'Questo strumento è riservato ai membri PRO.',
}: {
  titolo?: string;
  messaggio?: string;
}) {
  const { avviaCheckout } = useApp();
  const [apriPro, setApriPro] = useState(false);

  return (
    <>
      <div className="max-w-2xl rounded-2xl border border-primary-100 bg-white p-8 shadow-card">
        <span className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-primary-50">
          <Lock className="h-7 w-7 text-primary-400" />
        </span>
        <h3 className="mt-4 text-lg font-bold text-primary-800">{titolo}</h3>
        <p className="mt-1 max-w-md text-sm text-primary-500">{messaggio}</p>
        <button
          onClick={() => setApriPro(true)}
          className="mt-5 inline-flex items-center gap-1.5 rounded-xl bg-secondary-500 px-5 py-2.5 text-sm font-semibold text-white shadow-soft transition hover:bg-secondary-600"
        >
          <Sparkles className="h-4 w-4" />
          Passa a PRO
        </button>
      </div>

      <AbbonamentoModal
        open={apriPro}
        onClose={() => setApriPro(false)}
        onConfirm={(promo) => avviaCheckout('pro_annuale', promo)}
      />
    </>
  );
}
