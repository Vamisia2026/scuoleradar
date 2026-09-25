import { useState } from 'react';
import { Loader2, Trash2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Modal } from '@/components/Modal';
import { Accordion } from '@/components/Accordion';
import { DocumentiProfilo } from '@/components/profile/DocumentiProfilo';
import { RadarStatusToggle } from '@/departments/radar';

export function ProfiloPage() {
  // Tendina "Sicurezza e Account" + modale di cancellazione account.
  const [sicurezzaAperti, setSicurezzaAperti] = useState(false);

  // Disdetta / cancellazione account
  const [mostraModaleElimina, setMostraModaleElimina] = useState(false);
  const [testoConferma, setTestoConferma] = useState('');
  const [cancellando, setCancellando] = useState(false);
  const [erroreElimina, setErroreElimina] = useState('');

  /** Cancellazione definitiva: Edge Function elimina-account (cascata su profiles/referrals). */
  const handleEliminaAccount = async () => {
    setCancellando(true);
    setErroreElimina('');
    try {
      if (supabase) {
        const { error } = await supabase.functions.invoke('elimina-account');
        if (error) {
          setErroreElimina(error.message);
          return;
        }
        await supabase.auth.signOut();
      }
      // Pulizia di eventuali dati demo/locali e redirect alla home
      try {
        localStorage.clear();
      } catch {
        // localStorage non disponibile
      }
      window.location.href = '/';
    } catch (err) {
      setErroreElimina((err as Error).message ?? 'Errore durante la cancellazione. Riprova.');
    } finally {
      setCancellando(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-primary-800">Il mio profilo</h2>
      </div>

      {/* Stato Radar: Attivo / In Pausa (preferenze conservate quando in pausa) */}
      <RadarStatusToggle />

      {/* Documenti — archivio dei Moduli scaricati + «I Miei Documenti» (storage
          personale con disclaimer). Accessibile anche dal menu utente → Documenti. */}
      <DocumentiProfilo />

      {/* Sicurezza e Account */}
      <Accordion
        icona="🛡️"
        titolo="Sicurezza e Account"
        aperto={sicurezzaAperti}
        onToggle={() => setSicurezzaAperti((v) => !v)}
      >
        <p className="text-xs leading-relaxed text-primary-600">
          I tuoi dati personali sono trattati in conformità con il GDPR. Puoi esportare o cancellare
          i tuoi dati in qualsiasi momento. La disdetta dell&apos;abbonamento è disponibile qui sotto;
          la cancellazione dell&apos;account è irreversibile e comporta la perdita di profilo,
          preferenze, moduli scaricati e accesso a PureFocus.
        </p>
        <div className="mt-5 border-t border-primary-100 pt-4">
          <h4 className="flex items-center gap-1.5 text-sm font-bold text-primary-800">
            <Trash2 className="h-4 w-4 text-primary-400" />
            Disdetta e cancellazione account
          </h4>
          <p className="mt-1 max-w-2xl text-sm leading-relaxed text-primary-600">
            La disdetta elimina definitivamente profilo, preferenze, moduli scaricati e accesso a
            PureFocus. L&apos;operazione è irreversibile.
          </p>
          <button
            onClick={() => setMostraModaleElimina(true)}
            className="mt-4 inline-flex items-center gap-1.5 rounded-xl border border-primary-200 bg-white px-4 py-2.5 text-sm font-medium text-primary-600 transition hover:bg-primary-50 hover:text-primary-800"
          >
            <Trash2 className="h-4 w-4" />
            Cancella il mio account
          </button>
        </div>
      </Accordion>

      <Modal
        open={mostraModaleElimina}
        onClose={() => setMostraModaleElimina(false)}
        title="Se procedi, la tua cancellazione sarà definitiva"
        size="sm"
      >
        <div className="space-y-4">
          <div className="rounded-xl border border-error-200 bg-error-50 p-4 text-sm text-error-700">
            <p className="font-semibold">Attenzione: azione irreversibile.</p>
            <ul className="mt-2 list-disc space-y-1 pl-4 text-xs">
              <li>Il tuo profilo e le preferenze saranno cancellati per sempre.</li>
              <li>I moduli scaricati e gli accessi agli strumenti andranno persi.</li>
              <li>L&apos;accesso a PureFocus (incluso nel PRO) sarà revocato.</li>
              <li>L&apos;abbonamento attivo verrà disdetto.</li>
            </ul>
          </div>
          <div>
            <label htmlFor="conferma-delete" className="mb-1.5 block text-sm font-medium text-primary-700">
              Digita <strong>DELETE</strong> per confermare
            </label>
            <input
              id="conferma-delete"
              type="text"
              value={testoConferma}
              onChange={(e) => setTestoConferma(e.target.value)}
              placeholder="DELETE"
              className="input font-mono"
            />
          </div>
          {erroreElimina && <p className="text-xs text-error-600">{erroreElimina}</p>}
          <div className="flex flex-col gap-2 sm:flex-row-reverse">
            <button
              onClick={() => void handleEliminaAccount()}
              disabled={testoConferma !== 'DELETE' || cancellando}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-error-500 px-5 py-3 text-sm font-semibold text-white shadow-soft transition hover:bg-error-600 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
            >
              {cancellando ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4" />
              )}
              {cancellando ? 'Eliminazione…' : 'Cancella definitivamente'}
            </button>
            <button
              onClick={() => setMostraModaleElimina(false)}
              disabled={cancellando}
              className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl border border-primary-200 px-5 py-3 text-sm font-medium text-primary-700 transition hover:bg-primary-50 disabled:opacity-50 sm:w-auto"
            >
              Annulla
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
