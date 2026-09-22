/**
 * Contesto App · wizard Radar "in attesa" e ripresa del checkout.
 *
 * Estratto da `useBootstrapProfilo.ts` (a sua volta da `AppContext.tsx`):
 * gli ultimi due effetti di avvio — apertura automatica del wizard Radar dopo
 * il login e ripresa del piano scelto da anonimo ("intended plan").
 */
import { useEffect } from 'react';
import {
  STORAGE_KEY_INTENDED_PLAN,
  STORAGE_KEY_INTENDED_PLAN_DATA,
  type PianoId,
} from '@/lib/pricing';
import { STORAGE_KEY_RADAR_WIZARD_PENDING, type User } from './types';

/** Dipendenze esterne: identità, wizard Radar e avvio checkout. */
export interface OpzioniBootstrapCheckout {
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
  /** Apre il wizard Radar (onboarding a 4 passi). */
  openRadarWizard: () => void;
}

/** Effetti di sessione/checkout: nessun valore di ritorno. */
export function useBootstrapCheckout({
  user,
  supabaseUserId,
  avviaCheckout,
  openRadarWizard,
}: OpzioniBootstrapCheckout): void {
  // Wizard Radar in attesa: se un utente NON autenticato ha cliccato "ATTIVA IL TUO RADAR",
  // al termine di login/registrazione si apre automaticamente il wizard di onboarding.
  useEffect(() => {
    const pending = localStorage.getItem(STORAGE_KEY_RADAR_WIZARD_PENDING);
    if (pending !== '1') return;
    if (!user && !supabaseUserId) return;
    try {
      localStorage.removeItem(STORAGE_KEY_RADAR_WIZARD_PENDING);
    } catch {
      // localStorage non disponibile
    }
    openRadarWizard();
  }, [user, supabaseUserId, openRadarWizard]);

  // FASE 7 — Ripresa automatica del checkout ("intended plan").
  // Se un utente anonimo aveva scelto un piano prima del login, appena la sessione
  // Supabase è disponibile si riprende il checkout per quel piano (localStorage).
  useEffect(() => {
    if (!supabaseUserId) return;
    let piano = '';
    try {
      piano = localStorage.getItem(STORAGE_KEY_INTENDED_PLAN) ?? '';
    } catch {
      return;
    }
    if (!piano) return;

    try {
      localStorage.removeItem(STORAGE_KEY_INTENDED_PLAN);
    } catch {
      // ignore
    }
    let promo: string | undefined;
    let quantita = 1;
    try {
      const raw = localStorage.getItem(STORAGE_KEY_INTENDED_PLAN_DATA);
      localStorage.removeItem(STORAGE_KEY_INTENDED_PLAN_DATA);
      if (raw) {
        const dati = JSON.parse(raw) as { promo?: string; quantita?: number };
        if (dati.promo) promo = dati.promo;
        if (typeof dati.quantita === 'number') quantita = dati.quantita;
      }
    } catch {
      // payload non valido: si procede con quantità 1 e senza promo
    }

    void avviaCheckout(piano as PianoId, promo, quantita);
  }, [supabaseUserId, avviaCheckout]);
}
