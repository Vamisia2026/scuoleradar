/**
 * OAuth Bounce Recovery — intercetta il ritorno fallito dal flusso Google OAuth
 * (query params `error`/`error_code`/`error_description` sul redirect, es.
 * `access_denied`, `admin_policy_enforced`) e mostra una modal di recupero con
 * le alternative di accesso (Email/Password o account Google personale).
 */
import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { GraduationCap, KeyRound, Loader2, Mail, X } from 'lucide-react';
import { useApp } from '@/contexts/AppContext';
import { useToast } from './Toast';

/** Token tipici di rifiuto OAuth (Google / Supabase) → attivano il recupero. */
const PATTERN_RIFIUTO = /access_denied|admin_policy|consent_required|oauthaccountnotlinked|account_not_found|unauthorized|user_cancelled|invalid_request|access not granted|permission_denied/i;

function ciSonoErroriOAuth(search: string): boolean {
  const p = new URLSearchParams(search);
  const valori = [
    p.get('error'),
    p.get('error_code'),
    p.get('error_description'),
  ]
    .map((v) => (v ?? '').trim())
    .filter(Boolean)
    .join(' ');
  return valori.length > 0 && PATTERN_RIFIUTO.test(valori);
}

export function OAuthBounceModal() {
  const { mostraToast } = useToast();
  const { search, pathname } = useLocation();
  const { user, loading, oauthBounceOpen, openOAuthBounce, closeOAuthBounce, openAuthModal, loginConGoogle } =
    useApp();

  const [googleInCorso, setGoogleInCorso] = useState(false);

  // Intercetta qualsiasi redirect fallito (sia /auth/callback sia /dashboard).
  useEffect(() => {
    if (loading || user) return;
    if (!ciSonoErroriOAuth(search)) return;
    // Ripulisce l'URL: evita che la modal si riapra a ogni navigazione.
    if (pathname === window.location.pathname) {
      const url = new URL(window.location.href);
      url.search = '';
      window.history.replaceState({}, '', url.toString());
    }
    openOAuthBounce();
  }, [search, pathname, loading, user, openOAuthBounce]);

  if (!oauthBounceOpen) return null;

  const accediConEmail = (): void => {
    closeOAuthBounce();
    openAuthModal('login');
  };

  const accediConGooglePersonale = async (): Promise<void> => {
    setGoogleInCorso(true);
    try {
      closeOAuthBounce();
      await loginConGoogle();
    } catch (err) {
      const msg = (err as { message?: string }).message ?? 'Accesso Google non riuscito. Riprova.';
      mostraToast('errore', msg);
      openAuthModal('login');
    } finally {
      setGoogleInCorso(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[98] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="Accesso bloccato dal dominio scolastico">
      <div className="absolute inset-0 bg-primary-900/60 backdrop-blur-sm" />
      <div className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-card animate-pop">
        <div className="flex items-start gap-3">
          <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-warning-50 text-warning-600">
            <GraduationCap className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-bold leading-snug text-primary-900">
              Accesso bloccato dal tuo Istituto scolastico?
            </h2>
            <p className="mt-1.5 text-sm leading-relaxed text-primary-600">
              I domini scolastici (.edu.it) spesso bloccano l’autenticazione automatica Google
              verso le app esterne.
            </p>
          </div>
          <button
            type="button"
            onClick={closeOAuthBounce}
            aria-label="Chiudi"
            className="rounded-full p-1.5 text-primary-400 transition hover:bg-primary-50 hover:text-primary-600"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-5 space-y-2.5">
          <button
            type="button"
            onClick={accediConEmail}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary-500 px-4 py-3 text-sm font-semibold text-white shadow-soft transition hover:bg-primary-600"
          >
            <KeyRound className="h-4 w-4" />
            Accedi con Email e Password
          </button>
          <button
            type="button"
            onClick={() => void accediConGooglePersonale()}
            disabled={googleInCorso}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-primary-200 bg-white px-4 py-3 text-sm font-semibold text-primary-700 transition hover:bg-primary-50 disabled:opacity-60"
          >
            {googleInCorso ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
            Usa Account Google Personale
          </button>
        </div>

        <p className="mt-4 text-center text-xs leading-relaxed text-primary-500">
          Sei l’Animatore Digitale della scuola?{' '}
          <Link
            to="/faq#animatore-digitale"
            onClick={closeOAuthBounce}
            className="font-semibold text-primary-600 underline hover:text-primary-800"
          >
            Leggi come sbloccare ScuoleRadar nelle FAQ
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
