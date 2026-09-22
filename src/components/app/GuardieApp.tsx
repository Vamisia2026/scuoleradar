/**
 * ScuoleRadar.it — guardie e rotte globali dell'app.
 *
 * Estratto da `App.tsx` (che resta il guscio di composizione: provider,
 * `<Routes>` e modali globali) per tenere quel file sotto le soglie di
 * dimensione di `docs/MODULAR_ARCHITECTURE.md`.
 *
 * Contiene:
 *   · `RequireAuth`         → area riservata (apre il modal di accesso);
 *   · `RouteTracker`        → pageview analytics a ogni cambio rotta;
 *   · `AdminReturnRouter`   → ritorno OAuth del pannello Admin su `/admin`;
 *   · `RadarOpenDeepLink`   → deep link `?action=open-radar`.
 */
import { useEffect, type ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { trackPageview } from '@/lib/analytics';
import { useApp } from '@/contexts/AppContext';
import { useToast } from '@/components/Toast';
import { ADMIN_EMAILS, STORAGE_KEY_ADMIN_REDIRECT } from '@/departments/admin';

export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading, openAuthModal } = useApp();
  useEffect(() => {
    if (!loading && !user) openAuthModal('login');
  }, [user, loading, openAuthModal]);
  if (loading) return null; // Attende la verifica della sessione: niente redirect/modal prematuri
  if (!user) {
    // Area riservata: niente redirect forzato, si apre solo il modal di Auth.
    return (
      <div className="flex min-h-[60vh] items-center justify-center px-4">
        <div className="w-full max-w-md rounded-2xl border border-primary-100 bg-white p-8 text-center shadow-card">
          <h3 className="text-lg font-bold text-primary-800">Area riservata</h3>
          <p className="mt-1 text-sm text-primary-500">
            Accedi o crea un account gratuito per continuare.
          </p>
          <button
            onClick={() => openAuthModal('registrazione')}
            className="mt-4 inline-flex items-center justify-center gap-1.5 rounded-xl bg-primary-500 px-5 py-2.5 text-sm font-semibold text-white shadow-soft transition hover:bg-primary-600"
          >
            Crea un account / Accedi
          </button>
        </div>
      </div>
    );
  }
  return <>{children}</>;
}

/** Traccia la pagina vista a ogni cambio di rotta (SPA) — analytics non bloccante. */
export function RouteTracker() {
  const location = useLocation();
  useEffect(() => {
    trackPageview();
  }, [location.pathname, location.search]);
  return null;
}

/**
 * Ritorno dal flusso "Accedi con Google" del pannello admin (AdminAccessModal):
 * se il segnaposto `STORAGE_KEY_ADMIN_REDIRECT` (sessionStorage, max 10 min) è
 * presente e l'account autenticato è in ADMIN_EMAILS, reindirizza su /admin.
 * Il flag viene sempre ripulito (anche se scaduto o non autorizzato).
 */
export function AdminReturnRouter() {
  const { user, loading } = useApp();
  const navigate = useNavigate();
  const { mostraToast } = useToast();

  useEffect(() => {
    if (loading) return;
    let raw: string | null = null;
    try {
      raw = sessionStorage.getItem(STORAGE_KEY_ADMIN_REDIRECT);
    } catch {
      return; // sessionStorage non disponibile: nessun ritorno automatico
    }
    if (!raw) return;
    try {
      sessionStorage.removeItem(STORAGE_KEY_ADMIN_REDIRECT);
    } catch {
      // il flag verrà scartato comunque al prossimo giro
    }

    let marcato = 0;
    try {
      marcato = Number((JSON.parse(raw) as { t?: number }).t ?? 0);
    } catch {
      marcato = 0;
    }
    // Il segnaposto scade dopo 10 minuti: non dirotta login Google non correlati.
    if (!marcato || Date.now() - marcato > 10 * 60 * 1000) return;

    if (user?.email && ADMIN_EMAILS.includes(user.email.toLowerCase())) {
      navigate('/admin', { replace: true });
    } else if (user?.email) {
      mostraToast('errore', 'Questo account Google non è autorizzato per il pannello admin.');
    }
  }, [user, loading, navigate, mostraToast]);

  return null;
}

/**
 * Deep link ?action=open-radar (es. /dashboard?action=open-radar): appena
 * l'utente è autenticato avvia il setup Radar esplicito. Per gli utenti Base
 * senza regole `openRadarSetup` mostra prima il PRO-Gift (mai automatico),
 * poi il wizard completo a 4 passi.
 */
export function RadarOpenDeepLink() {
  const { user, loading, radarWizardOpen, softOnboardingOpen, openRadarSetup, openAuthModal } = useApp();
  const location = useLocation();

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get('action') !== 'open-radar') return;
    // Rimuove subito il parametro (niente ri-aperture su navigazioni successive).
    try {
      const url = new URL(window.location.href);
      url.searchParams.delete('action');
      window.history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`);
    } catch {
      // history non disponibile: il param resta ma la guardia radarWizardOpen evita duplicati
    }
    if (loading) return;
    if (!user) {
      openAuthModal('login');
      return;
    }
    if (!radarWizardOpen && !softOnboardingOpen) openRadarSetup();
  }, [location.search, loading, user, radarWizardOpen, softOnboardingOpen, openRadarSetup, openAuthModal]);

  return null;
}
