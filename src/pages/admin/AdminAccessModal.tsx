/**
 * Accesso amministratore dedicato (trigger segreto "riservati" nel footer).
 *
 * Due modalità di accesso, entrambe riservate alle email in ADMIN_EMAILS:
 *  1. Google OAuth  → loginConGoogle(); al ritorno l'app reindirizza su /admin
 *     (vedi AdminReturnRouter in App.tsx, chiave STORAGE_KEY_ADMIN_REDIRECT);
 *  2. Email/password → prima verifica su Supabase Auth (signInWithPassword);
 *     se l'account non esiste / password errata, ricade GRACEFULLY sulla
 *     password di ambiente VITE_ADMIN_PASSWORD (o, solo in DEV, "Bartolino")
 *     senza bloccare l'utente col vecchio messaggio "In produzione accedi con
 *     l'account Google autorizzato".
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { KeyRound, Loader2, ShieldCheck, X } from 'lucide-react';
import { supabase, isSupabaseConfigurato } from '@/lib/supabase';
import { useApp } from '@/contexts/AppContext';
import { ADMIN_EMAILS, STORAGE_KEY_ADMIN_REDIRECT } from './types';

/** Password demo locale: resta valida SOLO in sviluppo (DEV). */
const PASSWORD_LOCALE = 'Bartolino';

/** Password admin di ambiente: valorizzabile in qualunque ambiente (VITE_ADMIN_PASSWORD). */
const passwordAdminEnv =
  (import.meta.env as Record<string, string | undefined>).VITE_ADMIN_PASSWORD?.trim() ?? '';

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47a5.53 5.53 0 0 1-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82Z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09A11.99 11.99 0 0 0 12 24Z"
      />
      <path
        fill="#FBBC05"
        d="M5.27 14.29a7.19 7.19 0 0 1 0-4.58V6.62H1.29a12 12 0 0 0 0 10.76l3.98-3.09Z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.69 1.29 6.62l3.98 3.09C6.22 6.86 8.87 4.75 12 4.75Z"
      />
    </svg>
  );
}

export function AdminAccessModal({ aperto, onChiudi }: { aperto: boolean; onChiudi: () => void }) {
  const { accediDemo, loginConGoogle } = useApp();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);

  if (!aperto) return null;

  /**
   * Verifica la password "di riserva" (VITE_ADMIN_PASSWORD in qualunque
   * ambiente, "Bartolino" solo in DEV) e, se valida, apre una sessione locale
   * per la UI admin. Ritorna true solo se l'accesso è stato concesso.
   */
  const accessoDiRiserva = (em: string): boolean => {
    const demoDev = import.meta.env.DEV && password === PASSWORD_LOCALE;
    const demoEnv = Boolean(passwordAdminEnv) && password === passwordAdminEnv;
    if (!demoDev && !demoEnv) return false;
    accediDemo(em);
    return true;
  };

  const invia = async (): Promise<void> => {
    const em = email.trim().toLowerCase();
    if (!ADMIN_EMAILS.includes(em)) {
      setErrore("Indirizzo email non autorizzato per l'area amministrativa.");
      return;
    }
    if (!password) {
      setErrore('Inserisci la password amministrativa.');
      return;
    }
    setLoading(true);
    setErrore(null);
    try {
      let accessoOk = false;

      if (supabase) {
        // 1) Percorso principale: sessione Supabase REALE con le credenziali dell'account.
        const { error } = await supabase.auth.signInWithPassword({ email: em, password });
        if (!error) {
          accessoOk = true;
        } else if (accessoDiRiserva(em)) {
          // 2) Fallback "graceful": password admin di ambiente / demo DEV.
          accessoOk = true;
        } else {
          // Mai un vicolo cieco: si invita a riprovare o a usare Google (pulsante sotto).
          setErrore(
            'Credenziali non valide per questo account. Controlla la password oppure usa il pulsante "Accedi con Google".',
          );
        }
      } else if (accessoDiRiserva(em)) {
        // Nessun Supabase configurato: accesso demo possibile solo con password di riserva.
        accessoOk = true;
      } else {
        setErrore(
          import.meta.env.DEV
            ? 'Password non riconosciuta. In sviluppo usa la password demo "Bartolino" oppure valorizza VITE_ADMIN_PASSWORD.'
            : 'Pannello admin non disponibile in questa modalità: configura Supabase oppure usa "Accedi con Google".',
        );
      }

      if (accessoOk) {
        onChiudi();
        navigate('/admin');
      }
    } finally {
      setLoading(false);
    }
  };

  /** Google OAuth: al ritorno AdminReturnRouter porta l'admin autorizzato su /admin. */
  const accediConGoogle = async (): Promise<void> => {
    if (googleLoading) return;
    setErrore(null);
    setGoogleLoading(true);
    try {
      if (!isSupabaseConfigurato) {
        setErrore('Login Google non disponibile: Supabase non è configurato.');
        return;
      }
      // Segnaposto per il ritorno OAuth (con scadenza di 10 minuti, per non
      // dirottare login Google successivi e non correlati).
      try {
        sessionStorage.setItem(STORAGE_KEY_ADMIN_REDIRECT, JSON.stringify({ t: Date.now() }));
      } catch {
        // sessionStorage non disponibile: si prosegue comunque (ritorno manuale su /admin).
      }
      await loginConGoogle();
    } catch (err) {
      const msg = (err as { message?: string }).message ?? 'Accesso Google non riuscito. Riprova.';
      setErrore(msg);
    } finally {
      setGoogleLoading(false);
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
          Inserisci un indirizzo autorizzato e la password amministrativa oppure accedi con Google
          per aprire il pannello.
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
            disabled={loading || googleLoading}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary-500 px-4 py-2.5 text-sm font-semibold text-white shadow-soft transition hover:bg-primary-600 disabled:opacity-50"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
            Accedi con email e password
          </button>
        </form>

        {isSupabaseConfigurato ? (
          <>
            <div className="my-4 flex items-center gap-3">
              <span className="h-px flex-1 bg-primary-100" />
              <span className="text-xs font-medium uppercase tracking-wide text-primary-400">oppure</span>
              <span className="h-px flex-1 bg-primary-100" />
            </div>

            <button
              type="button"
              onClick={() => void accediConGoogle()}
              disabled={googleLoading || loading}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-primary-200 bg-white px-4 py-2.5 text-sm font-semibold text-primary-700 shadow-soft transition hover:bg-primary-50 disabled:opacity-60"
            >
              {googleLoading ? <Loader2 className="h-4 w-4 animate-spin text-primary-500" /> : <GoogleIcon className="h-4 w-4" />}
              Accedi con Google
            </button>
          </>
        ) : (
          <p className="mt-3 text-center text-[11px] text-primary-400">
            Google login non disponibile: Supabase non è configurato in questo ambiente.
          </p>
        )}
      </div>
    </div>
  );
}
