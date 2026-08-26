import { useState } from 'react';
import { Lock, PenLine, Sparkles } from 'lucide-react';
import { useApp } from '@/contexts/AppContext';
import { AbbonamentoModal } from '@/components/AbbonamentoModal';

/** PureFocus: suite di scrittura senza distrazioni, inclusa SOLO nel piano PRO. */
export function PureFocusPage() {
  const { abbonato, user, avviaCheckout, openVetrina } = useApp();
  const [apriPro, setApriPro] = useState(false);
  const [testo, setTesto] = useState('');

  // Riservato ESCLUSIVAMENTE agli abbonati PRO: non disponibile a consumo.
  if (!abbonato) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-2">
          <PenLine className="h-5 w-5 text-primary-600" />
          <h2 className="text-3xl font-bold text-primary-800">PureFocus</h2>
        </div>

        <div className="rounded-2xl border border-primary-100 bg-white p-8 text-center shadow-card">
          <span className="mx-auto inline-flex items-center gap-1.5 rounded-full bg-accent-50 px-3 py-1 text-xs font-bold text-accent-700">
            <Lock className="h-3.5 w-3.5" />
            Riservato agli abbonati PRO
          </span>
          <h3 className="mt-4 text-2xl font-bold text-primary-800">
            Scrivi e prepara i tuoi materiali senza distrazioni
          </h3>
          <p className="mx-auto mt-1 max-w-2xl text-lg leading-relaxed text-primary-500">
            PureFocus è una piattaforma straordinaria che trasforma YouTube in un ambiente di studio e
            lavoro: elimina distrazioni, suggerimenti e contenuti irrilevanti, lasciandoti solo ciò che
            ti serve per ottimizzare il tuo tempo. PureFocus costa 29$ all&apos;anno ed è incluso nel
            tuo abbonamento a ScuoleRadar.
          </p>
          <button
            onClick={() => (user ? setApriPro(true) : openVetrina('purefocus'))}
            className="mt-5 inline-flex items-center gap-1.5 rounded-xl bg-secondary-500 px-5 py-2.5 text-sm font-semibold text-white shadow-soft transition hover:bg-secondary-600"
          >
            <Sparkles className="h-4 w-4" />
            {user ? 'Passa a PRO' : 'Registrati qui'}
          </button>
          <p className="mt-2 text-xs text-primary-400">
            Non disponibile a consumo: solo abbonamento PRO (annuo o mensile).
          </p>
        </div>

        <AbbonamentoModal
          open={apriPro}
          onClose={() => setApriPro(false)}
          onConfirm={(promo) => avviaCheckout('pro_annuale', promo)}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <PenLine className="h-5 w-5 text-primary-600" />
        <h2 className="text-lg font-bold text-primary-800">PureFocus</h2>
      </div>

      <div className="rounded-2xl border border-primary-100 bg-white p-5 shadow-card">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold text-primary-800">Modalità Focus</h3>
          <span className="rounded-full bg-accent-50 px-2.5 py-0.5 text-[11px] font-bold text-accent-700">
            PRO
          </span>
        </div>
        <p className="mt-1 text-sm text-primary-500">
          Nessuna distrazione: scrivi qui i tuoi materiali. Salvataggio ed esportazione in arrivo.
        </p>
        <textarea
          value={testo}
          onChange={(e) => setTesto(e.target.value)}
          rows={16}
          placeholder="Inizia a scrivere in totale concentrazione..."
          className="input mt-4 font-serif text-base leading-relaxed"
        />
      </div>
    </div>
  );
}