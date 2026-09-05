// File: src/components/modals/RadarPromoModal.tsx (o OnboardingModal.tsx)
import { useState } from 'react';
import type { User } from '@/contexts/AppContext';

/** Regola Radar minima: una coppia filtro (provincia + classe/materia) salvata nel profilo. */
export interface RadarRule {
  provincia: string;
  classe: string;
}

export const useRadarModalTrigger = (user: User | null, userRadarRules: RadarRule[]) => {
  const [shouldShowModal, setShouldShowModal] = useState(false);

  // 1. Controllo restrittivo: Se l'utente ha già un radar attivo o l'account Free Forever/PRO configurato, blocchiamo qualsiasi auto-open.
  const hasActiveRadar = userRadarRules.length > 0;
  const isFullySetup = user && hasActiveRadar;

  // 2. Trigger basato su azione/scroll invece del timer casuale all'ingresso
  const triggerRadarFlow = () => {
    if (isFullySetup) return; // Blocco di sicurezza
    setShouldShowModal(true);
  };

  return { shouldShowModal, setShouldShowModal, triggerRadarFlow };
};
