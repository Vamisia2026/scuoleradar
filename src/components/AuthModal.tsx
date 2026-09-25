import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogIn, AlertCircle, Eye, EyeOff, Loader2, Radar } from 'lucide-react';
import { useApp } from '@/contexts/AppContext';
import { Modal } from '@/components/Modal';
import { TelegramLoginButton } from '@/components/TelegramLoginButton';
import { CampoProvincia } from '@/components/auth/CampoProvincia';
import { IconaGoogle } from '@/components/auth/IconaGoogle';
import { NotaAccessoScolastico } from '@/components/auth/NotaAccessoScolastico';
import { useToast } from '@/components/Toast';
import { isSupabaseConfigurato } from '@/lib/supabase';
import { getPostLoginRedirect } from '@/lib/showroomRedirect';
import { useFeatureFlags } from '@/hooks/useFeatureFlags';
import {
  bozzaHaDati,
  leggiBozzaRegistrazione,
  type BozzaRegistrazione,
} from '@/lib/bozzaRegistrazione';

/**
 * Campo del form di autenticazione: etichetta compatta (stessa misura in
 * registrazione rapida e in incognito) + controllo.
 */
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold text-primary-700">{label}</span>
      {children}
    </label>
  );
}

export function AuthModal() {
  const navigate = useNavigate();
  const { mostraToast } = useToast();
  const {
    authModalOpen,
    authModalMode,
    authModalCtx,
    closeAuthModal,
    openAuthModal,
    register,
    loginSupabase,
    preferenze,
    loginConGoogle,
  } = useApp();

  const isRegister = authModalMode === 'registrazione';
  // Feature flags: destinazione post-login = primo dipartimento disponibile.
  const { primaRottaVisibile } = useFeatureFlags();

  const [nome, setNome] = useState('');
  const [cognome, setCognome] = useState('');
  const [genere, setGenere] = useState<'M' | 'F' | null>(null);
  const [etaInput, setEtaInput] = useState('');
  /** Provincia di RESIDENZA (codice, es. 'RM'): dato demografico di base, facoltativo. */
  const [provincia, setProvincia] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errore, setErrore] = useState('');
  const [googleLoading, setGoogleLoading] = useState(false);
  /** Bozza anagrafica del wizard: precompila il form (nessun dato richiesto 2 volte). */
  const [bozzaWizard, setBozzaWizard] = useState<BozzaRegistrazione | null>(null);
  /** Attesa risposta Supabase al submit email (login). */
  const [loginLoading, setLoginLoading] = useState(false);
  // Ripulisce il form quando la modale si chiude
  useEffect(() => {
    if (!authModalOpen) {
      setNome('');
      setCognome('');
      setGenere(null);
      setEtaInput('');
      setProvincia('');
      setEmail('');
      setPassword('');
      setShowPassword(false);
      setErrore('');
      setGoogleLoading(false);
      setLoginLoading(false);
    }
  }, [authModalOpen]);

  /**
   * Prefill dei dati demografici già raccolti altrove (wizard Radar → questo form
   * è l'ultimo passo per i Guest): sesso ed età arrivano dalle preferenze, la
   * provincia dalla scelta fatta nel Radar quando è UNA SOLA (indizio forte,
   * resta comunque modificabile). Non sovrascrive mai un valore già digitato.
   */
  useEffect(() => {
    if (!authModalOpen || authModalMode !== 'registrazione') return;
    // BOZZA del wizard: ha la precedenza su tutto (sono i dati che l'utente ha
    // appena inserito) e vale anche per l'EMAIL, così non viene richiesta due volte.
    const bozza = leggiBozzaRegistrazione();
    setBozzaWizard(bozza);
    const etaBozza = bozza?.eta ?? preferenze.eta ?? null;
    setNome((prev) => prev || bozza?.nome || '');
    setCognome((prev) => prev || bozza?.cognome || '');
    setEmail((prev) => prev || bozza?.email || '');
    setGenere((prev) => prev ?? bozza?.genere ?? preferenze.genere ?? null);
    setEtaInput((prev) => prev || (etaBozza != null ? String(etaBozza) : ''));
    setProvincia(
      (prev) =>
        prev ||
        bozza?.provincia ||
        preferenze.provincia ||
        (preferenze.provinceCodici.length === 1 ? preferenze.provinceCodici[0] : ''),
    );
  }, [authModalOpen, authModalMode, preferenze.genere, preferenze.eta, preferenze.provincia, preferenze.provinceCodici]);

  const cambiaModo = (modo: 'login' | 'registrazione') => {
    setErrore('');
    setPassword('');
    openAuthModal(modo);
  };

  const dopoLogin = () => {
    closeAuthModal();
    // Redirect pendente da una showroom pubblica (es. /moduli → /dashboard/moduli)?
    const redirect = getPostLoginRedirect();
    if (redirect) {
      navigate(redirect, { replace: true });
      return;
    }
    // Destinazione = prima sezione DISPONIBILE (feature flags): mai un modulo spento.
    navigate(preferenze.onboarded ? primaRottaVisibile() : '/onboarding');
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setErrore('');

    if (isRegister) {
      if (!nome.trim() || !cognome.trim() || !genere || !email.trim() || !password) {
        setErrore('Compila tutti i campi.');
        return;
      }
      if (password.length < 6) {
        setErrore('La password deve avere almeno 6 caratteri.');
        return;
      }
      let eta: number | null = null;
      if (etaInput.trim()) {
        const n = Number.parseInt(etaInput, 10);
        if (!Number.isFinite(n) || n < 14 || n > 100) {
          setErrore("L'età deve essere un numero tra 14 e 100 anni.");
          return;
        }
        eta = n;
      }
      // Registrazione REALE su Supabase Auth: gli errori (email già registrata,
      // password debole, rate limit) NON restano silenziosi — il form li mostra
      // inline senza navigare, così l'utente può correggere o passare al login.
      setLoginLoading(true);
      try {
        const esito = await register({
          nome: nome.trim(),
          cognome: cognome.trim(),
          email: email.trim(),
          password,
          genere,
          eta,
          provincia: provincia || null,
        });
        if (!esito.ok) {
          const msg = esito.errore ?? 'Registrazione non riuscita. Riprova.';
          setErrore(msg);
          mostraToast('errore', msg);
          return;
        }
        closeAuthModal();
        const redirect = getPostLoginRedirect();
        navigate(redirect ?? '/onboarding');
      } catch (err) {
        const msg = (err as { message?: string }).message ?? 'Registrazione non riuscita. Riprova.';
        setErrore(msg);
        mostraToast('errore', msg);
      } finally {
        setLoginLoading(false);
      }
    } else {
      if (!email.trim() || !password) {
        const msg = 'Inserisci email e password per accedere.';
        setErrore(msg);
        mostraToast('errore', msg);
        return;
      }
      setLoginLoading(true);
      try {
        // Login email REALE: signInWithPassword su Supabase Auth quando configurato,
        // fallback demo (localStorage) solo senza Supabase. Gli errori di Supabase
        // vengono mostrati sia inline sia come toast — mai fallimenti silenziosi.
        const esito = await loginSupabase(email.trim(), password);
        if (!esito.ok) {
          const msg = esito.errore ?? 'Accesso non riuscito. Riprova.';
          setErrore(msg);
          mostraToast('errore', msg);
          return;
        }
        dopoLogin();
      } catch (err) {
        const msg = (err as { message?: string }).message ?? 'Accesso non riuscito. Riprova.';
        setErrore(msg);
        mostraToast('errore', msg);
      } finally {
        setLoginLoading(false);
      }
    }
  };

  const handleGoogle = async () => {
    if (googleLoading) return;
    setErrore('');
    setGoogleLoading(true);
    try {
      await loginConGoogle();
      // Il browser viene reindirizzato a Google; se il flusso fallisce mostriamo l'errore.
    } catch (err) {
      setErrore(`Google OAuth non riuscito: ${(err as Error).message}`);
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <Modal
      open={authModalOpen}
      onClose={closeAuthModal}
      title={
        authModalCtx === 'pro'
          ? 'Crea il tuo account per accedere a ScuoleRadar PRO'
          : isRegister
            ? 'Crea il tuo account'
            : 'Accedi al tuo Radar'
      }
      // UNICA modale di accesso/registrazione (rapida o da incognito/vetrina):
      // `dense` + campi su due colonne = contenuto dentro il viewport, senza zoom
      // ridotto e senza scorrimento verticale forzato.
      size="lg"
      dense
    >
      <div className="space-y-2.5">
        {/* Dati già raccolti nel wizard Radar: si conferma soltanto, non si riscrive. */}
        {isRegister && bozzaHaDati(bozzaWizard) && (
          <div className="flex items-start gap-2 rounded-lg border border-primary-100 bg-primary-50 px-3 py-2 text-xs leading-snug text-primary-700">
            <Radar className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary-500" />
            <p>
              <strong>Abbiamo già i dati del tuo Radar.</strong> Nome, genere, età e provincia sono
              precompilati da quello che hai inserito: controllali e scegli solo la password.
            </p>
          </div>
        )}

        {/* Buone notizie: banner PRO trial (visibile solo in registrazione).
            COPY ETICO: nessuna competizione fra colleghi, nessuna fretta artificiale —
            si parla del VALORE DEL TEMPO che il Radar restituisce. */}
        {isRegister && (
          <div className="rounded-lg border border-accent-200 bg-accent-50 px-3 py-2 text-xs leading-snug text-accent-800">
            <p className="font-semibold">Buone notizie! 🚀</p>
            <p className="mt-0.5">
              Un mese PRO, completamente gratis. Smetti di perdere ore a cercare sui siti delle
              scuole: ci pensa il Radar a trovare gli interpelli per te, così puoi dedicarti alla tua
              vita.
            </p>
          </div>
        )}

        {/* Google OAuth reale: il redirect avviene via URL diretto, nessun preventDefault.
            È il percorso PIÙ RAPIDO (1 click, nessun campo da compilare): per questo è
            il primo pulsante del modal, in evidenza. */}
        <button
          type="button"
          onClick={handleGoogle}
          disabled={googleLoading}
          className="inline-flex w-full items-center justify-center gap-2.5 rounded-lg border-2 border-primary-500 bg-primary-50 px-3 py-2 text-sm font-bold text-primary-800 shadow-soft transition hover:bg-primary-100 disabled:cursor-wait disabled:opacity-70"
        >
          {googleLoading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin text-primary-500" />
              Connessione a Google…
            </>
          ) : (
            <>
              <IconaGoogle className="h-4 w-4" />
              Accedi con Google
            </>
          )}
        </button>

        {/* Supporto account ISTITUZIONALI: il problema va spiegato PRIMA del rifiuto
            di Google (l'utente capisce subito cosa fare se il dominio della scuola
            blocca le app esterne). */}
        <NotaAccessoScolastico onNavigate={closeAuthModal} />

        <TelegramLoginButton onSuccess={dopoLogin} onError={(msg) => setErrore(msg)} />

        <div className="flex items-center gap-3">
          <span className="h-px flex-1 bg-primary-100" />
          <span className="text-xs font-medium uppercase tracking-wide text-primary-400">oppure</span>
          <span className="h-px flex-1 bg-primary-100" />
        </div>

        {errore && (
          <div className="flex items-start gap-2 rounded-xl bg-error-50 px-4 py-2.5 text-sm text-error-700">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            {errore}
          </div>
        )}

        <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          {isRegister && (
            <>
              <Field label="Nome">
                <input
                  type="text"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  className="input"
                  autoComplete="given-name"
                  placeholder="Nome"
                />
              </Field>
              <Field label="Cognome">
                <input
                  type="text"
                  value={cognome}
                  onChange={(e) => setCognome(e.target.value)}
                  className="input"
                  autoComplete="family-name"
                  placeholder="Cognome"
                />
              </Field>
              <Field label="Sesso">
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setGenere('F')}
                    aria-pressed={genere === 'F'}
                    className={`rounded-lg border px-3 py-2 text-sm font-semibold transition ${
                      genere === 'F'
                        ? 'border-accent-400 bg-accent-50 text-accent-700'
                        : 'border-primary-200 bg-white text-primary-600 hover:bg-primary-50'
                    }`}
                  >
                    Donna
                  </button>
                  <button
                    type="button"
                    onClick={() => setGenere('M')}
                    aria-pressed={genere === 'M'}
                    className={`rounded-lg border px-3 py-2 text-sm font-semibold transition ${
                      genere === 'M'
                        ? 'border-accent-400 bg-accent-50 text-accent-700'
                        : 'border-primary-200 bg-white text-primary-600 hover:bg-primary-50'
                    }`}
                  >
                    Uomo
                  </button>
                </div>
              </Field>
              <Field label="Età (facoltativa)">
                <input
                  type="number"
                  inputMode="numeric"
                  min={14}
                  max={100}
                  value={etaInput}
                  onChange={(e) => setEtaInput(e.target.value)}
                  className="input"
                  placeholder="Età"
                />
              </Field>
              <div className="sm:col-span-2">
                <Field label="Provincia di residenza (facoltativa)">
                  <CampoProvincia value={provincia} onChange={setProvincia} />
                </Field>
              </div>
            </>
          )}
          <div className={isRegister ? 'sm:col-span-2' : 'sm:col-span-1'}>
            <Field label="Email">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input"
                autoComplete="email"
                placeholder="La tua email"
              />
            </Field>
          </div>
          <div className={isRegister ? 'sm:col-span-2' : 'sm:col-span-1'}>
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
          </div>

          <button
            type="submit"
            disabled={loginLoading || googleLoading}
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary-500 px-4 py-2.5 text-sm font-semibold text-white shadow-soft transition hover:bg-primary-600 disabled:cursor-wait disabled:opacity-70 sm:col-span-2"
          >
            {loginLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {isRegister ? 'Creazione account…' : 'Accesso in corso…'}
              </>
            ) : isRegister ? (
              <>
                <Radar className="h-4 w-4" />
                Attiva il tuo Radar PRO
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
          {isSupabaseConfigurato
            ? 'Accesso email/Google sicuro con Supabase Auth. Hai ricevuto una password provvisoria (beta)? Al primo accesso dovrai impostarne una nuova.'
            : 'Prototipo dimostrativo senza Supabase: i dati restano solo sul tuo dispositivo.'}
        </p>
      </div>
    </Modal>
  );
}
