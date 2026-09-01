import { useEffect, type ReactNode } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { trackPageview } from '@/lib/analytics';
import { AppProvider, useApp } from '@/contexts/AppContext';
import { AuthModal } from '@/components/AuthModal';
import { VetrinaModal } from '@/components/VetrinaModal';
import { DevToolbar } from '@/components/DevToolbar';
import { ScrollToTop } from '@/components/ScrollToTop';
import { ToastProvider } from '@/components/Toast';
import { GoogleOneTap } from '@/components/GoogleOneTap';
import { RadarWizardModal } from '@/components/RadarWizardModal';
import { AuthCallback } from '@/pages/AuthCallback';
import { LandingPage } from '@/pages/LandingPage';
import { OnboardingPage } from '@/pages/OnboardingPage';
import { DashboardLayout, DashboardPage } from '@/pages/DashboardPage';
import { CvPage } from '@/pages/CvPage';
import { CfuPage } from '@/pages/CfuPage';
import { AssistenteAIPage } from '@/pages/AssistenteAIPage';
import { ModuliPage } from '@/pages/ModuliPage';
import { PureFocusPage } from '@/pages/PureFocusPage';
import { ProfiloPage } from '@/pages/ProfiloPage';
import { InvitaPage } from '@/pages/InvitaPage';
import { PrezziPage } from '@/pages/PrezziPage';
import { NotiziePage } from '@/pages/NotiziePage';
import { NotizieDettaglioPage } from '@/pages/NotizieDettaglioPage';
import { ChiSiamoPage } from '@/pages/ChiSiamoPage';
import { FAQPage } from '@/pages/FAQPage';
import { ServiziPage } from '@/pages/ServiziPage';
import { ServizioPage } from '@/pages/ServizioPage';
import { ContattiPage } from '@/pages/ContattiPage';
import { AdminPage } from '@/pages/AdminPage';

function RequireAuth({ children }: { children: ReactNode }) {
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
function RouteTracker() {
  const location = useLocation();
  useEffect(() => {
    trackPageview();
  }, [location.pathname, location.search]);
  return null;
}

export default function App() {
  return (
    <AppProvider>
      <ToastProvider>
        <BrowserRouter>
          {/* Scroll-to-top globale a ogni cambio di rotta (SPA) */}
          <ScrollToTop />
          {/* Pageview + referrer/source visitatore a ogni cambio rotta */}
          <RouteTracker />
          <Routes>
            {/* Sito vetrina pubblico */}
            <Route path="/" element={<LandingPage />} />
            <Route path="/prezzi" element={<PrezziPage />} />
            <Route path="/chi-siamo" element={<ChiSiamoPage />} />
            <Route path="/faq" element={<FAQPage />} />
            <Route path="/servizi" element={<ServiziPage />} />
            <Route path="/servizi/:slug" element={<ServizioPage />} />
            <Route path="/notizie" element={<NotiziePage />} />
            <Route path="/notizie/:id" element={<NotizieDettaglioPage />} />
            <Route path="/contatti" element={<ContattiPage />} />
            <Route path="/auth/callback" element={<AuthCallback />} />

            {/* Area riservata (autenticazione) */}
            <Route
              path="/onboarding"
              element={
                <RequireAuth>
                  <OnboardingPage />
                </RequireAuth>
              }
            />

            {/* Vetrina Freemium: tutte le sezioni principali navigabili anche senza login */}
            <Route path="/dashboard" element={<DashboardLayout />}>
              <Route index element={<Navigate to="radar" replace />} />
              <Route path="radar" element={<DashboardPage />} />
              <Route path="cv" element={<CvPage />} />
              <Route path="cfu" element={<CfuPage />} />
              <Route path="assistente-ai" element={<AssistenteAIPage />} />
              <Route path="moduli" element={<ModuliPage />} />
              <Route path="purefocus" element={<PureFocusPage />} />
              {/* Profilo e Invita restano riservati agli utenti autenticati */}
              <Route
                path="profilo"
                element={
                  <RequireAuth>
                    <ProfiloPage />
                  </RequireAuth>
                }
              />
              <Route
                path="invita"
                element={
                  <RequireAuth>
                    <InvitaPage />
                  </RequireAuth>
                }
              />
            </Route>

            <Route
              path="/admin"
              element={
                <RequireAuth>
                  <AdminPage />
                </RequireAuth>
              }
            />

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
          <AuthModal />
          <VetrinaModal />
          <GoogleOneTap />
          <RadarWizardModal />
          <DevToolbar />
        </BrowserRouter>
      </ToastProvider>
    </AppProvider>
  );
}
