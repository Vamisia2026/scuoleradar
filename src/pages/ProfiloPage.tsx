import { useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, Download, FolderOpen, Loader2, Lock, Trash2 } from 'lucide-react';
import { useApp } from '@/contexts/AppContext';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { supabase } from '@/lib/supabase';
import {
  conAggiuntaInCima,
  STORAGE_KEY_MODULI_SCARICATI,
  type ModuloScaricato,
} from '@/data/moduli';
import { Modal } from '@/components/Modal';
import { Accordion } from '@/components/Accordion';
import { RadarStatusToggle } from '@/components/RadarStatusToggle';

export function ProfiloPage() {
  const { abbonato } = useApp();

  // Storico dei modelli scaricati (condiviso con la pagina Moduli via localStorage)
  const [moduliScaricati, setModuliScaricati] = useLocalStorage<ModuloScaricato[]>(
    STORAGE_KEY_MODULI_SCARICATI,
    [],
  );

  // Tendina "Modelli Scaricati" (solo PRO) e sezione Sicurezza
  const [moduliAperti, setModuliAperti] = useState(true);
  const [sicurezzaAperti, setSicurezzaAperti] = useState(false);

  // Disdetta / cancellazione account
  const [mostraModaleElimina, setMostraModaleElimina] = useState(false);
  const [testoConferma, setTestoConferma] = useState('');
  const [cancellando, setCancellando] = useState(false);
  const [erroreElimina, setErroreElimina] = useState('');

  const formatDataScaricato = (iso: string) => {
    try {
      return new Date(iso).toLocaleDateString('it-IT', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      });
    } catch {
      return iso;
    }
  };

  const riscaricaModulo = (m: ModuloScaricato) => {
    setModuliScaricati(conAggiuntaInCima(moduliScaricati, m));
    alert(`Download simulato di "${m.nome}" (${m.tipo}).`);
  };

  const rimuoviModulo = (id: string) =>
    setModuliScaricati(moduliScaricati.filter((m) => m.id !== id));

  const svuotaStorico = () => setModuliScaricati([]);

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

      {/* Gestione Moduli — tendina apribile/comprimibile (solo PRO);
          per gli utenti Base una barra grigia compatta di upsell */}
      {abbonato ? (
        <Accordion
          icona="📁"
          titolo="Modelli Scaricati di Recente"
          badge={moduliScaricati.length ? `${moduliScaricati.length} scaricati` : undefined}
          aperto={moduliAperti}
          onToggle={() => setModuliAperti((v) => !v)}
        >
          {moduliScaricati.length === 0 ? (
            <p className="text-sm text-primary-400">
              Non hai ancora scaricato modelli. Visita la pagina Moduli per trovare documenti e
              template pronti all&apos;uso.
            </p>
          ) : (
            <ul className="space-y-2">
              {moduliScaricati.map((m) => (
                <li
                  key={m.id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-primary-100 bg-slate-50 px-4 py-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-primary-800">{m.nome}</p>
                    <p className="text-xs text-primary-400">
                      {m.tipo} · scaricato il {formatDataScaricato(m.scaricatoIl)}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      onClick={() => riscaricaModulo(m)}
                      aria-label={`Scarica di nuovo ${m.nome}`}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-primary-200 bg-white px-3 py-2 text-xs font-semibold text-primary-700 transition hover:bg-primary-50"
                    >
                      <Download className="h-3.5 w-3.5" />
                      Scarica
                    </button>
                    <button
                      onClick={() => rimuoviModulo(m.id)}
                      aria-label={`Rimuovi ${m.nome} dallo storico`}
                      className="rounded-lg p-2 text-primary-400 transition hover:bg-error-50 hover:text-error-600"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
          <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-primary-100 pt-3">
            <Link
              to="/dashboard/moduli?tab=miei"
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary-500 px-3 py-2 text-xs font-semibold text-white transition hover:bg-primary-600"
            >
              <FolderOpen className="h-3.5 w-3.5" />
              Vai alla pagina Moduli
            </Link>
            {moduliScaricati.length > 0 && (
              <button
                onClick={svuotaStorico}
                className="text-xs font-medium text-primary-400 transition hover:text-error-600"
              >
                Svuota storico
              </button>
            )}
          </div>
        </Accordion>
      ) : (
        <div className="flex flex-col items-start justify-between gap-3 rounded-2xl bg-slate-100 px-5 py-4 sm:flex-row sm:items-center">
          <p className="flex items-center gap-2 text-sm font-semibold text-primary-600">
            <Lock className="h-4 w-4 text-primary-400" />
            Modelli Scaricati — Funzionalità PRO
          </p>
          <Link
            to="/prezzi"
            className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-secondary-500 px-4 py-2.5 text-sm font-semibold text-white shadow-soft transition hover:bg-secondary-600"
          >
            Strumento disponibile per gli utenti PRO
          </Link>
        </div>
      )}

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
        <div className="mt-4 rounded-xl border border-error-200 bg-error-50/40 p-5">
          <h4 className="flex items-center gap-1.5 text-sm font-bold text-error-700">
            <AlertTriangle className="h-4 w-4" />
            Disdetta e cancellazione account
          </h4>
          <p className="mt-1 text-sm text-primary-600">
            La disdetta elimina definitivamente profilo, preferenze, moduli scaricati e accesso a
            PureFocus. L&apos;operazione è irreversibile.
          </p>
          <button
            onClick={() => setMostraModaleElimina(true)}
            className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-error-500 px-4 py-2.5 text-sm font-semibold text-white shadow-soft transition hover:bg-error-600"
          >
            <Trash2 className="h-4 w-4" />
            Cancella il mio account
          </button>
        </div>
      </Accordion>

      <Modal
        open={mostraModaleElimina}
        onClose={() => setMostraModaleElimina(false)}
        title="Cancellazione definitiva"
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
