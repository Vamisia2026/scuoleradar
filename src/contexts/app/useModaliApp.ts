/**
 * Contesto App · stato e azioni dei modali globali.
 *
 * Estratto da `AppContext.tsx`: modale di autenticazione (modalità + contesto
 * 'pro'), wizard Radar, PRO-Gift (SoftOnboarding), recupero del bounce OAuth e
 * vetrina Freemium. È solo stato locale di interfaccia: nessuna chiamata di
 * servizio, nessuna dipendenza dal contesto.
 */
import { useCallback, useState } from 'react';

/** Stato e azioni dei modali globali, consumati dal provider. */
export interface ModaliApp {
  /** Modale di login/registrazione. */
  authModalOpen: boolean;
  authModalMode: 'login' | 'registrazione';
  /** Contesto della modale Auth: 'pro' = l'utente stava scegliendo un piano. */
  authModalCtx: 'default' | 'pro';
  openAuthModal: (mode?: 'login' | 'registrazione', ctx?: 'default' | 'pro') => void;
  closeAuthModal: () => void;
  /** Wizard Radar (onboarding a 4 passi). */
  radarWizardOpen: boolean;
  openRadarWizard: () => void;
  closeRadarWizard: () => void;
  /** PRO-Gift "Sorpresa" (SoftOnboarding): si apre solo da CTA esplicita. */
  softOnboardingOpen: boolean;
  openSoftOnboarding: () => void;
  closeSoftOnboarding: () => void;
  /** Recupero dopo un bounce OAuth Google (es. dominio .edu.it bloccato). */
  oauthBounceOpen: boolean;
  openOAuthBounce: () => void;
  closeOAuthBounce: () => void;
  /** Vetrina Freemium per gli utenti non autenticati. */
  vetrinaAperta: boolean;
  vetrinaSezione: string | null;
  openVetrina: (sezione: string) => void;
  closeVetrina: () => void;
}

export function useModaliApp(): ModaliApp {
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authModalMode, setAuthModalMode] = useState<'login' | 'registrazione'>('login');
  const [authModalCtx, setAuthModalCtx] = useState<'default' | 'pro'>('default');

  // Wizard Radar (onboarding a 4 passi) — aperto da "ATTIVA IL TUO RADAR".
  const [radarWizardOpen, setRadarWizardOpen] = useState(false);
  const openRadarWizard = useCallback(() => setRadarWizardOpen(true), []);
  const closeRadarWizard = useCallback(() => setRadarWizardOpen(false), []);

  // PRO-Gift / SoftOnboarding — MAI automatico al load/refresh: viene aperto
  // SOLO da openRadarSetup() quando l'utente elegibile clicca una CTA Radar.
  const [softOnboardingOpen, setSoftOnboardingOpen] = useState(false);
  const openSoftOnboarding = useCallback(() => setSoftOnboardingOpen(true), []);
  const closeSoftOnboarding = useCallback(() => setSoftOnboardingOpen(false), []);

  const openAuthModal = useCallback(
    (mode: 'login' | 'registrazione' = 'login', ctx: 'default' | 'pro' = 'default') => {
      setAuthModalMode(mode);
      setAuthModalCtx(ctx);
      setAuthModalOpen(true);
    },
    [],
  );

  const closeAuthModal = useCallback(() => {
    setAuthModalOpen(false);
    setAuthModalCtx('default');
  }, []);

  // Bounce OAuth (dominio scolastico / Google bloccato): modal di recupero.
  const [oauthBounceOpen, setOauthBounceOpen] = useState(false);
  const openOAuthBounce = useCallback(() => setOauthBounceOpen(true), []);
  const closeOAuthBounce = useCallback(() => setOauthBounceOpen(false), []);

  // Vetrina Freemium: modal di conversione per gli utenti non autenticati.
  const [vetrinaAperta, setVetrinaAperta] = useState(false);
  const [vetrinaSezione, setVetrinaSezione] = useState<string | null>(null);
  const openVetrina = useCallback((sezione: string) => {
    setVetrinaSezione(sezione);
    setVetrinaAperta(true);
  }, []);
  const closeVetrina = useCallback(() => setVetrinaAperta(false), []);

  return {
    authModalOpen,
    authModalMode,
    authModalCtx,
    openAuthModal,
    closeAuthModal,
    radarWizardOpen,
    openRadarWizard,
    closeRadarWizard,
    softOnboardingOpen,
    openSoftOnboarding,
    closeSoftOnboarding,
    oauthBounceOpen,
    openOAuthBounce,
    closeOAuthBounce,
    vetrinaAperta,
    vetrinaSezione,
    openVetrina,
    closeVetrina,
  };
}
