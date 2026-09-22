/**
 * Header — dati di navigazione.
 *
 * Estratti da `Header.tsx`: prima erano costanti locali del componente, ora sono
 * condivisi da tre sotto-componenti (`NavIstituzionale`, `BarraStrumenti`,
 * `MenuMobile`) senza duplicazioni. Nessuna dipendenza: solo dati.
 *
 * Ogni voce della barra strumenti dichiara il `modulo` di appartenenza: la
 * visibilità (stato delle feature flags → `on` | `test` | `off`) viene filtrata
 * dai componenti con l'hook `useFeatureFlags`.
 */
import type { DipartimentoId } from '@/config/features';

/** Link istituzionali/informativi (nav pubblica + sezione «Info» del menu mobile). */
export const navLinks: { to: string; label: string }[] = [
  { to: '/notizie', label: 'Notizie' },
  { to: '/prezzi', label: 'Prezzi' },
  { to: '/faq', label: 'FAQ' },
  { to: '/chi-siamo', label: 'Chi siamo' },
];

/** Voce della barra strumenti (link della dashboard, con eventuale badge accent). */
export interface LinkStrumento {
  to: string;
  label: string;
  accent?: boolean;
  /** Dipartimento che governa la visibilità della voce (feature flags). */
  modulo: DipartimentoId;
}

/** Barra Servizi/Strumenti dell'area riservata (livello inferiore dell'header). */
export const strumentiLinks: LinkStrumento[] = [
  { to: '/dashboard/radar', label: '📡 Radar Scuole', modulo: 'radar' },
  { to: '/dashboard/moduli', label: '📁 Modulistica', modulo: 'modulistica' },
  { to: '/calcolatore-cfu', label: '🎓 Calcolatore CFU', modulo: 'cfu' },
  { to: '/dashboard/purefocus', label: '🧘 Pure Focus', modulo: 'purefocus' },
  { to: '/dashboard/invita', label: '🎁 Invita un Collega', accent: true, modulo: 'referral' },
];

