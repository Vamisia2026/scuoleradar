/**
 * Contesto App · bootstrap di sessione e profilo: composizione dei moduli.
 *
 * Facade sottile (wave 15): gli effetti vivono in `./useProfileBootstrap`
 * (caricamento iniziale del profilo dal DB), `./useAuthSync` (listener Supabase
 * Auth + refresh su focus/60 s) e `./useBootstrapCheckout` (wizard Radar in
 * attesa + ripresa del checkout scelto da anonimo).
 *
 * L'ordine di chiamata è quello originale degli effetti, quindi la sequenza di
 * esecuzione non cambia. Firma e API pubblica restano identiche: `AppContext.tsx`
 * non cambia una riga.
 */
import { type Dispatch, type MutableRefObject, type SetStateAction } from 'react';
import type { PianoId } from '@/lib/pricing';
import { useAuthSync } from './useAuthSync';
import { useBootstrapCheckout } from './useBootstrapCheckout';
import { useProfileBootstrap } from './useProfileBootstrap';
import type { Preferenze, User } from './types';

/** Dipendenze esterne: stati, setter e azioni che restano nel provider. */
export interface OpzioniBootstrapProfilo {
  /** Utente locale (guardia dell'effetto "wizard Radar in attesa"). */
  user: User | null;
  /** Id Supabase dell'utente autenticato (trigger della ripresa checkout). */
  supabaseUserId: string | null;
  /** Avvio checkout Stripe (ripresa del piano scelto prima del login). */
  avviaCheckout: (
    plan: PianoId,
    promo?: string,
    quantita?: number,
  ) => Promise<{ ok: boolean; errore?: string }>;
  /** Verifica nome/cognome su `profiles` → mini-onboarding anagrafico. */
  valutaProfiloIncompleto: (userId: string) => Promise<void>;
  /** Ricarica piano/abbonamento e contatori dal DB. */
  refreshProfilo: () => Promise<void>;
  /** Apre il wizard Radar (onboarding a 4 passi). */
  openRadarWizard: () => void;
  /** Id dell'ultima sessione per cui il piano è stato caricato dal DB. */
  pianoSessionUserIdRef: MutableRefObject<string | null>;
  setUser: Dispatch<SetStateAction<User | null>>;
  setPref: Dispatch<SetStateAction<Preferenze>>;
  setLoading: Dispatch<SetStateAction<boolean>>;
  setAvatarUrl: Dispatch<SetStateAction<string | null>>;
  setSupabaseUserId: Dispatch<SetStateAction<string | null>>;
  setPiano: Dispatch<SetStateAction<'base' | 'pro' | 'free_forever'>>;
  setAbbonato: Dispatch<SetStateAction<boolean>>;
  setPianoStato: Dispatch<SetStateAction<'loading' | 'pronto'>>;
  setCrediti: Dispatch<SetStateAction<number>>;
  setNotificheUsate: Dispatch<SetStateAction<number>>;
  setRadarAttivo: Dispatch<SetStateAction<boolean>>;
  setTrialScadenza: Dispatch<SetStateAction<string | null>>;
  setProfiloIncompleto: Dispatch<SetStateAction<boolean>>;
}

/** Effetti di bootstrap/sessione: nessun valore di ritorno. */
export function useBootstrapProfilo({
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
}: OpzioniBootstrapProfilo): void {
  // 1) Caricamento iniziale: profilo/preferenze/piano dal DB + verifica anagrafica.
  useProfileBootstrap({
    valutaProfiloIncompleto,
    pianoSessionUserIdRef,
    setPref,
    setLoading,
    setAvatarUrl,
    setUser,
    setSupabaseUserId,
    setPiano,
    setAbbonato,
    setPianoStato,
    setCrediti,
    setNotificheUsate,
    setRadarAttivo,
    setTrialScadenza,
  });

  // 2-3) Sincronizzazione sessione: listener Supabase Auth + refresh del piano
  // su focus/visibility e ogni 60 secondi + Realtime sulla riga profilo.
  useAuthSync({
    valutaProfiloIncompleto,
    refreshProfilo,
    supabaseUserId,
    pianoSessionUserIdRef,
    setUser,
    setLoading,
    setAvatarUrl,
    setSupabaseUserId,
    setPiano,
    setAbbonato,
    setPianoStato,
    setProfiloIncompleto,
    setPref,
  });

  // 4-5) Wizard Radar "in attesa" e ripresa automatica del checkout.
  useBootstrapCheckout({ user, supabaseUserId, avviaCheckout, openRadarWizard });
}
