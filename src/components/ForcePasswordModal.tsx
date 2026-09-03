/**
 * Modal OBBLIGATORIA "Cambia la tua password" al primo accesso.
 * Se l'utente (auth.users.user_metadata) ha `force_password_change: true`
 * (impostato alla creazione dall'admin), non può proseguire fino a quando
 * non imposta una nuova password. Richiede una sessione Supabase reale.
 */
import { useEffect, useState } from 'react';
import { KeyRound, Loader2, ShieldAlert } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useToast } from './Toast';

export function ForcePasswordModal() {
  const { mostraToast } = useToast();
  const [aperto, setAperto] = useState(false);
  const [nuova, setNuova] = useState('');
  const [conferma, setConferma] = useState('');
  const [caricamento, setCaricamento] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);

  useEffect(() => {
    if (!supabase) return;
    const verifica = async (): Promise<void> => {
      const { data } = await supabase!.auth.getUser();
      const meta = (data.user?.user_metadata ?? {}) as Record<string, unknown>;
      // "Flag equivalente" a requires_password_change: vive su auth.users.user_metadata
      // (impostato alla creazione/ripristino dall'admin) ed è la fonte canonica perché
      // sopravvive al refresh del token e non richiede RLS aggiuntive su profiles.
      setAperto(meta.force_password_change === true);
    };
    void verifica();
    const { data: sub } = supabase!.auth.onAuthStateChange((evento) => {
      if (evento === 'SIGNED_IN' || evento === 'TOKEN_REFRESHED' || evento === 'USER_UPDATED') {
        void verifica();
      }
      if (evento === 'SIGNED_OUT') setAperto(false);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  // Mentre la modale è aperta l'utente NON può aggirare il cambio password:
  // blocco scroll di sfondo e tasto Escape (niente chiusure accidentali).
  useEffect(() => {
    if (!aperto) return;
    const overflowPrecedente = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const bloccaEscape = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') e.preventDefault();
    };
    window.addEventListener('keydown', bloccaEscape, true);
    return () => {
      document.body.style.overflow = overflowPrecedente;
      window.removeEventListener('keydown', bloccaEscape, true);
    };
  }, [aperto]);

  const salva = async (): Promise<void> => {
    if (nuova.length < 8) {
      setErrore('La nuova password deve avere almeno 8 caratteri.');
      return;
    }
    if (nuova !== conferma) {
      setErrore('Le due password non coincidono.');
      return;
    }
    setCaricamento(true);
    setErrore(null);
    try {
      if (!supabase) {
        setErrore('Sessione non disponibile: ricarica la pagina.');
        return;
      }
      const { error: errPwd } = await supabase!.auth.updateUser({ password: nuova });
      if (errPwd) throw errPwd;
      const { error: errMeta } = await supabase!.auth.updateUser({
        data: { force_password_change: false },
      });
      if (errMeta) throw errMeta;
      mostraToast('successo', 'Password aggiornata. Benvenuto!');
      setAperto(false);
      setNuova('');
      setConferma('');
    } catch (err) {
      const msg = (err as { message?: string }).message ?? 'Errore durante l\'aggiornamento della password.';
      setErrore(msg);
    } finally {
      setCaricamento(false);
    }
  };

  if (!aperto) return null;

  return (
    <div className="fixed inset-0 z-[99] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="Cambia password obbligatoria">
      <div className="absolute inset-0 bg-primary-900/60 backdrop-blur-sm" />
      <div className="relative w-full max-w-sm rounded-2xl bg-white p-6 shadow-card animate-pop">
        <div className="flex items-start gap-3">
          <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-warning-50 text-warning-600">
            <ShieldAlert className="h-5 w-5" />
          </span>
          <div>
            <h2 className="text-sm font-bold text-primary-800">Imposta la tua password definitiva</h2>
            <p className="mt-1 text-xs leading-relaxed text-primary-500">
              Per accedere alla dashboard devi prima impostare una nuova password personale.
              La password provvisoria ricevuta (accesso beta / pre-approvato) non è più valida
              dopo questo passaggio.
            </p>
          </div>
        </div>

        <div className="mt-4 space-y-3">
          <label className="block">
            <span className="text-[11px] font-bold uppercase tracking-wide text-primary-500">Nuova password</span>
            <input
              autoFocus
              type="password"
              value={nuova}
              onChange={(e) => setNuova(e.target.value)}
              placeholder="Almeno 8 caratteri"
              className="mt-1 w-full rounded-lg border border-primary-200 px-3 py-2 text-sm text-primary-800 focus:border-primary-400 focus:outline-none"
            />
          </label>
          <label className="block">
            <span className="text-[11px] font-bold uppercase tracking-wide text-primary-500">Conferma password</span>
            <input
              type="password"
              value={conferma}
              onChange={(e) => setConferma(e.target.value)}
              placeholder="Ripeti la password"
              className="mt-1 w-full rounded-lg border border-primary-200 px-3 py-2 text-sm text-primary-800 focus:border-primary-400 focus:outline-none"
            />
          </label>

          {errore && <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">{errore}</p>}

          <button
            type="button"
            onClick={() => void salva()}
            disabled={caricamento}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary-500 px-4 py-2.5 text-sm font-semibold text-white shadow-soft transition hover:bg-primary-600 disabled:opacity-50"
          >
            {caricamento ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
            Imposta nuova password
          </button>
        </div>
      </div>
    </div>
  );
}
