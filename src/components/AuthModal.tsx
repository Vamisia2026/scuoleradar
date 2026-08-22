import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogIn, UserPlus, AlertCircle, Eye, EyeOff, Loader2 } from 'lucide-react';
import { useApp } from '@/contexts/AppContext';
import { Modal } from '@/components/Modal';

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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-primary-700">{label}</span>
      {children}
    </label>
  );
}

export function AuthModal() {
  const navigate = useNavigate();
  const {
    authModalOpen,
    authModalMode,
    closeAuthModal,
    openAuthModal,
    register,
    login,
    preferenze,
  } = useApp();

  const isRegister = authModalMode === 'registrazione';

  const [nome, setNome] = useState('');
  const [cognome, setCognome] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errore, setErrore] = useState('');
  const [googleLoading, setGoogleLoading] = useState(false);

  // Ripulisce il form quando la modale si chiude
  useEffect(() => {
    if (!authModalOpen) {
      setNome('');
      setCognome('');
      setEmail('');
      setPassword('');
      setShowPassword(false);
      setErrore('');
      setGoogleLoading(false);
    }
  }, [authModalOpen]);

  const cambiaModo = (modo: 'login' | 'registrazione') => {
    setErrore('');
    setPassword('');
    openAuthModal(modo);
  };

  const dopoLogin = () => {
    closeAuthModal();
    navigate(preferenze.onboarded ? '/dashboard/radar' : '/onboarding');
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    setErrore('');

    if (isRegister) {
      if (!nome.trim() || !cognome.trim() || !email.trim() || !password) {
        setErrore('Compila tutti i campi.');
        return;
      }
      if (password.length < 6) {
        setErrore('La password deve avere almeno 6 caratteri.');
        return;
      }
      register({ nome: nome.trim(), cognome: cognome.trim(), email: email.trim(), password });
      closeAuthModal();
      navigate('/onboarding');
    } else {
      if (!login(email.trim(), password)) {
        setErrore('Credenziali non valide. Controlla email e password oppure registrati.');
        return;
      }
      dopoLogin();
    }
  };

  const handleGoogle = () => {
    if (googleLoading) return;
    setErrore('');
    setGoogleLoading(true);
    // Login Google simulato per il prototipo
    window.setTimeout(() => {
      register({ nome: 'Mario', cognome: 'Rossi', email: 'mario.rossi@gmail.com', password: '' });
      setGoogleLoading(false);
      dopoLogin();
    }, 1200);
  };

  return (
    <Modal
      open={authModalOpen}
      onClose={closeAuthModal}
      title={isRegister ? 'Crea il tuo account' : 'Accedi al tuo Radar'}
      size="sm"
    >
      <div className="space-y-5">
        {/* Google (simulato) */}
        <button
          type="button"
          onClick={handleGoogle}
          disabled={googleLoading}
          className="inline-flex w-full items-center justify-center gap-2.5 rounded-xl border border-primary-200 bg-white px-5 py-3 text-sm font-semibold text-primary-800 shadow-soft transition hover:bg-primary-50 disabled:cursor-wait disabled:opacity-70"
        >
          {googleLoading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin text-primary-500" />
              Connessione a Google…
            </>
          ) : (
            <>
              <GoogleIcon className="h-4 w-4" />
              Continua con Google
            </>
          )}
        </button>

        <div className="flex items-center gap-3">
          <span className="h-px flex-1 bg-primary-100" />
          <span className="text-xs font-medium uppercase tracking-wide text-primary-400">oppure</span>
          <span className="h-px flex-1 bg-primary-100" />
        </div>

        {errore && (
          <div className="flex items-start gap-2 rounded-xl bg-error-50 px-4 py-3 text-sm text-error-700">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            {errore}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {isRegister && (
            <div className="grid grid-cols-2 gap-3">
              <Field label="Nome">
                <input
                  type="text"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  className="input"
                  autoComplete="given-name"
                  placeholder="Mario"
                />
              </Field>
              <Field label="Cognome">
                <input
                  type="text"
                  value={cognome}
                  onChange={(e) => setCognome(e.target.value)}
                  className="input"
                  autoComplete="family-name"
                  placeholder="Rossi"
                />
              </Field>
            </div>
          )}
          <Field label="Email">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input"
              autoComplete="email"
              placeholder="mario.rossi@email.it"
            />
          </Field>
          <Field label="Password">
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input pr-10"
                autoComplete={isRegister ? 'new-password' : 'current-password'}
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowPassword((s) => !s)}
                aria-label={showPassword ? 'Nascondi password' : 'Mostra password'}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-primary-400 transition hover:text-primary-600"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </Field>

          <button
            type="submit"
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary-500 px-5 py-3 text-sm font-semibold text-white shadow-soft transition hover:bg-primary-600"
          >
            {isRegister ? (
              <>
                <UserPlus className="h-4 w-4" />
                Crea account
              </>
            ) : (
              <>
                <LogIn className="h-4 w-4" />
                Accedi
              </>
            )}
          </button>
        </form>

        <p className="text-center text-sm text-primary-600">
          {isRegister ? (
            <>
              Hai già un account?{' '}
              <button
                type="button"
                onClick={() => cambiaModo('login')}
                className="font-semibold text-primary-700 hover:underline"
              >
                Accedi
              </button>
            </>
          ) : (
            <>
              Non sei registrato?{' '}
              <button
                type="button"
                onClick={() => cambiaModo('registrazione')}
                className="font-semibold text-primary-700 hover:underline"
              >
                Crea un account
              </button>
            </>
          )}
        </p>

        <p className="text-center text-xs text-primary-400">
          Prototipo dimostrativo: login Google simulato, i dati restano sul tuo dispositivo.
        </p>
      </div>
    </Modal>
  );
}
