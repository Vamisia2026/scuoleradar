import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { useGuardiaPiano } from '@/hooks/useGuardiaPiano';

import type { AppContextValue, User } from './app/types';
import { useModaliApp } from './app/useModaliApp';
import { useAzioniAccount } from './app/useAzioniAccount';
import { usePreferenzeUtente } from './app/usePreferenzeUtente';
import { useCheckout } from './app/useCheckout';
import { useProfiloAccount } from './app/useProfiloAccount';
import { useBootstrapProfilo } from './app/useBootstrapProfilo';
import { useInterpelliFeed } from './app/useInterpelliFeed';

export type { Esame, Preferenze, RuoloSimulato, User } from './app/types';
export { LIMITE_NOTIFICHE_PROVA, STORAGE_KEY_RADAR_WIZARD_PENDING } from './app/types';

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useLocalStorage<User | null>('sr_user', null);

  // FASE 6 — piano e contatori letti da Supabase (non più localStorage)
  const [abbonato, setAbbonato] = useState(false);
  /** Piano letto da profiles.piano: 'base' | 'pro' | 'free_forever'. */
  const [piano, setPiano] = useState<'base' | 'pro' | 'free_forever'>('base');
  /**
   * 'loading' = piano NON ancora confermato dal DB (badge: indicatore, mai 'Base').
   * 'pronto'  = piano letto/confermato dal DB (o modalità demo senza Supabase).
   */
  const [pianoStato, setPianoStato] = useState<'loading' | 'pronto'>('loading');
  /** Id dell'ultima sessione per cui il piano è stato (ri)caricato dal DB. */
  const pianoSessionUserIdRef = useRef<string | null>(null);
  /** Stato Radar Scuole letto da profiles.radar_attivo (default false). */
  const [radarAttivo, setRadarAttivo] = useState(false);
  /** Fine della prova PRO (ISO) se `subscription_status = 'trialing'`, altrimenti null. */
  const [trialScadenza, setTrialScadenza] = useState<string | null>(null);
  const [notificheUsate, setNotificheUsate] = useState(0);
  const [crediti, setCrediti] = useState(0);
  const [supabaseUserId, setSupabaseUserId] = useState<string | null>(null);
  /** Avatar dell'utente (user_metadata.avatar_url / picture, es. login Google). */
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  /** Profilo autenticato senza nome/cognome → serve il mini-onboarding anagrafico. */
  const [profiloIncompleto, setProfiloIncompleto] = useState(false);

  /** Entitlement globale: accesso PRO completo con piano 'pro' oppure 'free_forever'. */
  const hasProAccess = piano === 'pro' || piano === 'free_forever';

  /**
   * Tetti Radar applicati alle preferenze SOLO quando il piano è confermato dal DB
   * (mentre è in lettura vale `null`: nessun troncamento per un PRO/promo assegnato
   * dal backend) + guardia anti-blocco del caricamento. Logica in
   * `@/hooks/useGuardiaPiano` (tiene questo provider sotto le soglie di dimensione).
   */
  const { tetti: tettiPreferenze } = useGuardiaPiano({
    piano,
    hasProAccess,
    pianoStato,
    setPianoStato,
  });

  // Preferenze, esami e notifiche dell'utente: stato persistito + handler.
  const {
    preferenze,
    setPref,
    setPreferenze,
    completaOnboarding,
    esami,
    setEsamiState,
    setEsami,
    interpelliNotificati,
    setNotificati,
    incrementaNotifica,
  } = usePreferenzeUtente({ supabaseUserId, abbonato, setNotificheUsate, tetti: tettiPreferenze });

  // Modali globali (auth, wizard Radar, PRO-Gift, bounce OAuth, vetrina):
  // stato e azioni vivono nell'hook dedicato `./app/useModaliApp`.
  const {
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
  } = useModaliApp();

  const {
    register,
    login,
    loginSupabase,
    accediDemo,
    logout,
    loginConGoogle,
  } = useAzioniAccount({
    user,
    setUser,
    setPianoStato,
    setPref,
    setNotificheUsate,
    setAbbonato,
    setPiano,
    setRadarAttivo,
    setCrediti,
    setSupabaseUserId,
    setEsamiState,
    setNotificati,
    pianoSessionUserIdRef,
  });

  // Checkout Stripe (salva "intended plan" + avvio sessione con lock anti-concorrenza):
  // logica isolata nell'hook dedicato `./app/useCheckout`.
  const { avviaCheckout } = useCheckout({ openAuthModal });

  // Profilo, anagrafica, piano/abbonamento, crediti e simulazione di stato:
  // tutto vive nell'hook dedicato `./app/useProfiloAccount`.
  const {
    simulaStato,
    resettaTutto,
    salvaProfilo,
    consumaCredito,
    valutaProfiloIncompleto,
    aggiornaAnagrafica,
    refreshProfilo,
    aggiornaRadarAttivo,
    attivaTrialPro,
  } = useProfiloAccount({
    user,
    preferenze,
    piano,
    supabaseUserId,
    crediti,
    pianoSessionUserIdRef,
    setUser,
    setPref,
    setNotificheUsate,
    setAbbonato,
    setPiano,
    setPianoStato,
    setRadarAttivo,
    setCrediti,
    setSupabaseUserId,
    setTrialScadenza,
    setProfiloIncompleto,
    setEsamiState,
    setNotificati,
  });

  // `loading` resta nel provider (è esposto dal context): lo pilotano gli effetti
  // di bootstrap del profilo, isolati nell'hook `./app/useBootstrapProfilo`.
  const [loading, setLoading] = useState(true);

  // Bootstrap di sessione/profilo: caricamento iniziale dal DB, listener
  // Supabase Auth, refresh su focus/visibility, wizard Radar in attesa e
  // ripresa automatica del checkout ("intended plan").
  useBootstrapProfilo({
    user,
    supabaseUserId,
    avviaCheckout,
    valutaProfiloIncompleto,
    refreshProfilo,
    openRadarWizard,
    pianoSessionUserIdRef,
    setUser,
    setPref,
    setLoading,
    setAvatarUrl,
    setSupabaseUserId,
    setPiano,
    setAbbonato,
    setPianoStato,
    setCrediti,
    setNotificheUsate,
    setRadarAttivo,
    setTrialScadenza,
    setProfiloIncompleto,
  });

  // Feed degli interpelli (Matching Engine): stato, fetch dal DB e filtri del
  // profilo vivono nell'hook dedicato `./app/useInterpelliFeed`.
  // I TETTI del piano confermato limitano l'USO della selezione (query + filtri):
  // le province/classi oltre il tetto restano salvate e si riattivano con PRO.
  const { origineDati, interpelliFiltrati } = useInterpelliFeed(preferenze, tettiPreferenze);

  /** Trial PRO attivo: piano 'pro' + stato Stripe 'trialing' + scadenza futura. */
  const trialAttivo =
    piano === 'pro' && trialScadenza !== null && new Date(trialScadenza).getTime() > Date.now();

  /** Regole Radar presenti sul profilo (province + classi/materie), anche se Radar in pausa. */
  const radarConfigurato =
    preferenze.provinceCodici.length > 0 &&
    (preferenze.classiCodici.length > 0 ||
      preferenze.materieId.length > 0 ||
      preferenze.materieCustom.length > 0);

  /** Elegibile al PRO-Gift: autenticato, profilo letto, Base senza accesso PRO e senza regole Radar. */
  const elegibileProGift =
    Boolean(user || supabaseUserId) &&
    pianoStato === 'pronto' &&
    !hasProAccess &&
    !abbonato &&
    !radarConfigurato;

  /**
   * Entry point delle CTA "Attiva il tuo Radar" / tentativi di setup Radar.
   *  - utente elegibile (Base, senza regole) → apre il PRO-Gift come interstitial;
   *    il suo pulsante "Completa il tuo profilo per iniziare" aprirà il wizard;
   *  - guest, utenti già configurati, PRO/Free Forever o abbonati → wizard direttamente.
   */
  const openRadarSetup = useCallback(() => {
    if (elegibileProGift) openSoftOnboarding();
    else openRadarWizard();
  }, [elegibileProGift, openSoftOnboarding, openRadarWizard]);

  // Guardia anti-stato: se il PRO-Gift è aperto ma l'account non è più elegibile
  // (regole salvate altrove, piano cambiato, logout) il modal si chiude da solo.
  useEffect(() => {
    if (softOnboardingOpen && !elegibileProGift) closeSoftOnboarding();
  }, [softOnboardingOpen, elegibileProGift, closeSoftOnboarding]);

  const value: AppContextValue = {
    user,
    preferenze,
    notificheUsate,
    abbonato,
    piano,
    pianoStato,
    hasProAccess,
    trialAttivo,
    trialScadenza,
    crediti,
    esami,
    interpelliNotificati,
    register,
    login,
    loginSupabase,
    accediDemo,
    logout,
    setPreferenze,
    completaOnboarding,
    incrementaNotifica,
    avviaCheckout,
    setEsami,
    interpelliFiltrati,
    origineDati,
    loading,
    supabaseUserId,
    avatarUrl,
    profiloIncompleto,
    aggiornaAnagrafica,
    refreshProfilo,
    radarAttivo,
    aggiornaRadarAttivo,
    attivaTrialPro,
    authModalOpen,
    authModalMode,
    authModalCtx,
    openAuthModal,
    closeAuthModal,
    oauthBounceOpen,
    openOAuthBounce,
    closeOAuthBounce,
    radarWizardOpen,
    openRadarWizard,
    closeRadarWizard,
    softOnboardingOpen,
    openSoftOnboarding,
    closeSoftOnboarding,
    openRadarSetup,
    vetrinaAperta,
    vetrinaSezione,
    openVetrina,
    closeVetrina,
    simulaStato,
    resettaTutto,
    salvaProfilo,
    loginConGoogle,
    consumaCredito,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
