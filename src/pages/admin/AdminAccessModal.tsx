/**
 * Accesso amministratore dedicato (trigger segreto "riservati" nel footer).
 * Richiede un indirizzo autorizzato + password admin prima di aprire /admin.
 *  · Supabase configurato → tenta signInWithPassword;
 *  · ambiente DEV senza account → accetta la password locale demo "Bartolino".
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { KeyRound, Loader2, ShieldCheck, X } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useApp } from '@/contexts/AppContext';
import { ADMIN_EMAILS } from './types';

const PASSWORD_LOCALE = 'Bartolino';

export function AdminAccessModal({ aperto, onChiudi }: { aperto: boolean; onChiudi: () => void }) {
  const { register } = useApp();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);

  if (!aperto) return null;

  const invia = async (): Promise<void> => {
    const em = email.trim().toLowerCase();
    if (!ADMIN_EMAILS.includes(em)) {
      setErrore('Indirizzo email non autorizzato per l\'area amministrativa.');
      return;
    }
    setLoading(true);
    setErrore(null);
    try {
      let accessoOk = false;
      if (supabase) {
        const { error } = await supabase.auth.signInWithPassword({ email: em, password });
        if (!error) accessoOk = true;
        else if (import.meta.env.DEV && password === PASSWORD_LOCALE) {
          register({ nome: 'Admin', cognome: 'ScuoleRadar', email: em, password, genere: 'M' });
          accessoOk = true;
        } else {
          setErrore('Credenziali non valide. In produzione accedi con l\'account Google autorizzato.');
        }
      } else if (import.meta.env.DEV && password === PASSWORD_LOCALE) {
        register({ nome: 'Admin', cognome: 'ScuoleRadar', email: em, password, genere: 'M' });
        accessoOk = true;
      } else {
        setErrore('Accesso locale disponibile solo in sviluppo (password demo).');
      }

      if (accessoOk) {
        onChiudi();
        navigate('/admin');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[95] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="Accesso amministratore">
      <div className="absolute inset-0 bg-primary-900/40 backdrop-blur-sm" onClick={onChiudi} />
      <div className="relative w-full max-w-sm rounded-2xl bg-white p-6 shadow-card animate-pop">
        <div className="flex items-start justify-between">
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-primary-500 text-white shadow-soft">
            <ShieldCheck className="h-5 w-5" />
          </span>
          <button type="button" onClick={onChiudi} aria-label="Chiudi" className="rounded-full p-1.5 text-primary-400 hover:bg-primary-50">
            <X className="h-4 w-4" />
          </button>
        </div>
        <h2 className="mt-3 text-base font-bold text-primary-800">Accesso amministratore</h2>
        <p className="mt-1 text-xs leading-relaxed text-primary-500">
          Inserisci un indirizzo autorizzato e la password amministrativa per aprire il pannello.
          {import.meta.env.DEV && ' In sviluppo è attiva la password demo “Bartolino”.'}
        </p>

        <form
          className="mt-4 space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            void invia();
          }}
        >
          <label className="block">
            <span className="text-[11px] font-bold uppercase tracking-wide text-primary-500">Email</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="nome@scuoleradar.it"
              className="mt-1 w-full rounded-lg border border-primary-200 px-3 py-2 text-sm text-primary-800 focus:border-primary-400 focus:outline-none"
            />
          </label>
          <label className="block">
            <span className="text-[11px] font-bold uppercase tracking-wide text-primary-500">Password admin</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="mt-1 w-full rounded-lg border border-primary-200 px-3 py-2 text-sm text-primary-800 focus:border-primary-400 focus:outline-none"
            />
          </label>

          {errore && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">{errore}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary-500 px-4 py-2.5 text-sm font-semibold text-white shadow-soft transition hover:bg-primary-600 disabled:opacity-50"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
            Accedi al pannello admin
          </button>
        </form>
      </div>
    </div>
  );
}
