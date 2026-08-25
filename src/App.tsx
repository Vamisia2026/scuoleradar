import { useEffect, type ReactNode } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppProvider, useApp } from '@/contexts/AppContext';
import { AuthModal } from '@/components/AuthModal';
import { DevToolbar } from '@/components/DevToolbar';
import { AuthCallback } from '@/pages/AuthCallback';
import { LandingPage } from '@/pages/LandingPage';
import { OnboardingPage } from '@/pages/OnboardingPage';
import { DashboardLayout, DashboardPage } from '@/pages/DashboardPage';
import { CvPage } from '@/pages/CvPage';
import { CfuPage } from '@/pages/CfuPage';
import { AssistenteAIPage } from '@/pages/AssistenteAIPage';
import { ModuliPage } from '@/pages/ModuliPage';
import { ProfiloPage } from '@/pages/ProfiloPage';
import { InvitaPage } from '@/pages/InvitaPage';
import { PrezziPage } from '@/pages/PrezziPage';
import { ChiSiamoPage } from '@/pages/ChiSiamoPage';
import { ServiziPage } from '@/pages/ServiziPage';
import { ServizioPage } from '@/pages/ServizioPage';

function RequireAuth({ children }: { children: ReactNode }) {
  const { user, openAuthModal } = useApp();
  useEffect(() => {
    if (!user) openAuthModal('login');
  }, [user, openAuthModal]);
  if (!user) return <Navigate to="/" replace />;
  return <>{children}</>;
}

function RequireOnboarding({ children }: { children: ReactNode }) {
  const { user, preferenze, openAuthModal } = useApp();
  useEffect(() => {
    if (!user) openAuthModal('login');
  }, [user, openAuthModal]);
  if (!user) return <Navigate to="/" replace />;
  if (!preferenze.onboarded) return <Navigate to="/onboarding" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <AppProvider>
      <BrowserRouter>
        <Routes>
          {/* Sito vetrina pubblico */}
          <Route path="/" element={<LandingPage />} />
          <Route path="/prezzi" element={<PrezziPage />} />
          <Route path="/chi-siamo" element={<ChiSiamoPage />} />
          <Route path="/servizi" element={<ServiziPage />} />
          <Route path="/servizi/:slug" element={<ServizioPage />} />
          <Route path="/auth/callback" element={<AuthCallback />} />

          {/* Area riservata */}
          <Route
            path="/onboarding"
            element={
              <RequireAuth>
                <OnboardingPage />
              </RequireAuth>
            }
          />
          <Route
            path="/dashboard"
            element={
              <RequireOnboarding>
                <DashboardLayout />
              </RequireOnboarding>
            }
          >
            <Route index element={<Navigate to="radar" replace />} />
            <Route path="radar" element={<DashboardPage />} />
            <Route path="cv" element={<CvPage />} />
            <Route path="cfu" element={<CfuPage />} />
            <Route path="assistente-ai" element={<AssistenteAIPage />} />
            <Route path="moduli" element={<ModuliPage />} />
            <Route path="profilo" element={<ProfiloPage />} />
            <Route path="invita" element={<InvitaPage />} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        <AuthModal />
        <DevToolbar />
      </BrowserRouter>
    </AppProvider>
  );
}
