import { useState } from 'react';
import { Lock, Sparkles } from 'lucide-react';
import { useApp } from '@/contexts/AppContext';
import { AbbonamentoModal } from '@/components/AbbonamentoModal';
import { CreditiModal } from '@/components/CreditiModal';

/** Paywall riusabile per gli strumenti riservati (CFU, Assistente Sindacalista Virtuale): PRO o 1 credito. */
export function ServiziPaywall({
  titolo = 'Contenuto riservato',
  messaggio = 'Questo strumento richiede il piano PRO oppure 1 credito a consumo.',
}: {
  titolo?: string;
  messaggio?: string;
}) {
  const { avviaCheckout, crediti } = useApp();
  const [apriPro, setApriPro] = useState(false);
  const [apriCrediti, setApriCrediti] = useState(false);

  return (
    <>
      <div className="rounded-2xl border border-primary-100 bg-white p-8 text-center shadow-card">
        <span className="mx-auto inline-flex h-14 w-14 items-center justify-center rounded-full bg-primary-50">
          <Lock className="h-7 w-7 text-primary-400" />
        </span>
        <h3 className="mt-4 text-lg font-bold text-primary-800">{titolo}</h3>
        <p className="mx-auto mt-1 max-w-md text-sm text-primary-500">{messaggio}</p>
        <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
          <button
            onClick={() => setApriPro(true)}
            className="inline-flex items-center gap-1.5 rounded-xl bg-secondary-500 px-5 py-2.5 text-sm font-semibold text-white shadow-soft transition hover:bg-secondary-600"
          >
            <Sparkles className="h-4 w-4" />
            Passa a PRO (49€/anno)
          </button>
          <button
            onClick={() => setApriCrediti(true)}
            className="inline-flex items-center gap-1.5 rounded-xl border border-secondary-300 px-5 py-2.5 text-sm font-semibold text-secondary-700 transition hover:bg-secondary-50"
          >
            <Sparkles className="h-4 w-4" />
            Acquista crediti{crediti > 0 ? ` (ne hai ${crediti})` : ''}
          </button>
        </div>
      </div>

      <AbbonamentoModal
        open={apriPro}
        onClose={() => setApriPro(false)}
        onConfirm={(promo) => avviaCheckout('pro_annuale', promo)}
      />
      <CreditiModal open={apriCrediti} onClose={() => setApriCrediti(false)} />
    </>
  );
}
