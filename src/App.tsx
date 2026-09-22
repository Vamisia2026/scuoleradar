import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppProvider } from '@/contexts/AppContext';
import { AuthModal } from '@/components/AuthModal';
import { VetrinaModal } from '@/components/VetrinaModal';
import {
  AdminReturnRouter,
  RadarOpenDeepLink,
  RequireAuth,
  RouteTracker,
} from '@/components/app/GuardieApp';
import { DevToolbar } from '@/components/DevToolbar';
import { ScrollToTop } from '@/components/ScrollToTop';
import { ToastProvider } from '@/components/Toast';
import { GoogleOneTap } from '@/components/GoogleOneTap';
import { RadarWizardModal } from '@/departments/radar';
import { ForcePasswordModal } from '@/components/ForcePasswordModal';
import { SoftOnboardingModal } from '@/components/SoftOnboardingModal';
import { DatiProfiloModal } from '@/components/DatiProfiloModal';
import { OAuthBounceModal } from '@/components/OAuthBounceModal';
import { AuthCallback } from '@/pages/AuthCallback';
import { CheckoutRedirectPage } from '@/pages/CheckoutRedirectPage';
import { LandingPage } from '@/pages/LandingPage';
import { OnboardingPage } from '@/pages/onboarding/OnboardingPage';
import { DashboardPage } from '@/pages/DashboardPage';
import { DashboardLayout } from '@/pages/dashboard/components/DashboardLayout';
import { ReindirizzaDipartimentoPrincipale } from '@/pages/dashboard/components/ReindirizzaDipartimentoPrincipale';
import { FeatureGate } from '@/components/FeatureGate';
import { CvPage } from '@/pages/CvPage';
import { CalcolatoreCFUPage } from '@/pages/CalcolatoreCFUPage';
import { CalcolatoreCFUDashboardPage } from '@/pages/dashboard/CalcolatoreCFUDashboardPage';
import { AssistenteAIPage } from '@/pages/AssistenteAIPage';
import { ModuliPage } from '@/pages/ModuliPage';
import { PureFocusPage } from '@/pages/PureFocusPage';
import { ProfiloPage } from '@/pages/ProfiloPage';
import { InvitaPage } from '@/pages/InvitaPage';
import { PrezziPage } from '@/pages/PrezziPage';
import { NotiziePage } from '@/pages/NotiziePage';
import { NotizieDettaglioPage } from '@/pages/NotizieDettaglioPage';
import { InterpelloDettaglioPage } from '@/pages/interpello/InterpelloDettaglioPage';
import { ChiSiamoPage } from '@/pages/ChiSiamoPage';
import { FAQPage } from '@/pages/FAQPage';
import { ServiziPage } from '@/pages/ServiziPage';
import { ServizioPage } from '@/pages/ServizioPage';
import { ContattiPage } from '@/pages/ContattiPage';
import { AdminPage } from '@/pages/AdminPage';

export default function App() {
  return (
    <AppProvider>
      <ToastProvider>
        <BrowserRouter>
          {/* Scroll-to-top globale a ogni cambio di rotta (SPA) */}
          <ScrollToTop />
          {/* Pageview + referrer/source visitatore a ogni cambio rotta */}
          <RouteTracker />
          {/* Ritorno OAuth admin (segnaposto sessionStorage) → /admin */}
          <AdminReturnRouter />
          {/* Deep link ?action=open-radar → apertura automatica setup Radar */}
          <RadarOpenDeepLink />
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
            {/* Scheda pubblica di un avviso: atterraggio dei DEEP LINK delle
                notifiche quando l'avviso non ha una fonte esterna. Prima di questa
                rotta il catch-all "path=*" rimandava l'utente sulla HOME. */}
            <Route path="/interpello/:id" element={<InterpelloDettaglioPage />} />
            <Route path="/contatti" element={<ContattiPage />} />
            {/* La Modulistica porta DIRETTAMENTE alla dashboard completa: la
                vecchia landing di anteprima /moduli è stata rimossa (redirect). */}
            <Route path="/moduli" element={<Navigate to="/dashboard/moduli" replace />} />
            {/* Calcolatore CFU (dipartimento `cfu`): la pagina pubblica resta
                dietro la guardia delle feature flags come la sua sezione interna. */}
            <Route
              path="/calcolatore-cfu"
              element={
                <FeatureGate modulo="cfu">
                  <CalcolatoreCFUPage />
                </FeatureGate>
              }
            />
            <Route path="/auth/callback" element={<AuthCallback />} />
            {/* Checkout diretto Stripe con coupon: /checkout/pro-annuale?coupon=RADAR50 */}
            <Route path="/checkout/:plan" element={<CheckoutRedirectPage />} />

            {/* Area riservata (autenticazione) */}
            <Route
              path="/onboarding"
              element={
                <RequireAuth>
                  <OnboardingPage />
                </RequireAuth>
              }
            />

            {/* Vetrina Freemium: tutte le sezioni principali navigabili anche senza login.
                Ogni sezione è protetta da `FeatureGate`: con dipartimento in `off`
                (o `test` per i non admin) compare la pagina «in arrivo». */}
            <Route path="/dashboard" element={<DashboardLayout />}>
              <Route index element={<ReindirizzaDipartimentoPrincipale />} />
              <Route
                path="radar"
                element={
                  <FeatureGate modulo="radar">
                    <DashboardPage />
                  </FeatureGate>
                }
              />
              <Route
                path="cv"
                element={
                  <FeatureGate modulo="cv_builder">
                    <CvPage />
                  </FeatureGate>
                }
              />
            {/* Il vecchio calcolatore mockup /dashboard/cfu è stato rimosso:
                la rotta resta come redirect per i link/bookmark esistenti. */}
            <Route path="cfu" element={<Navigate to="/dashboard/calcolatore-cfu" replace />} />
              {/* Calcolatore CFU: strumento privato (nuovo Dipartimento CFU) */}
              <Route
                path="calcolatore-cfu"
                element={
                  <RequireAuth>
                    <FeatureGate modulo="cfu">
                      <CalcolatoreCFUDashboardPage />
                    </FeatureGate>
                  </RequireAuth>
                }
              />
              <Route path="assistente-ai" element={<AssistenteAIPage />} />
              <Route
                path="moduli"
                element={
                  <FeatureGate modulo="modulistica">
                    <ModuliPage />
                  </FeatureGate>
                }
              />
              <Route
                path="purefocus"
                element={
                  <FeatureGate modulo="purefocus">
                    <PureFocusPage />
                  </FeatureGate>
                }
              />
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
                    <FeatureGate modulo="referral">
                      <InvitaPage />
                    </FeatureGate>
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
          <ForcePasswordModal />
          <SoftOnboardingModal />
          <DatiProfiloModal />
          <OAuthBounceModal />
          <DevToolbar />
        </BrowserRouter>
      </ToastProvider>
    </AppProvider>
  );
}