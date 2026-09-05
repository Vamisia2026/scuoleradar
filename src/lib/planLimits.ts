/**
 * ScuoleRadar.it — Limiti dei piani e regole di notifica (fonte condivisa UI/onboarding).
 *
 * Regole Radar:
 *  - Piano BASE  → 1 Provincia · max 2 Classi di Concorso · notifiche DIGEST quotidiane alle 17:00.
 *  - Piano PRO / Free Forever → fino a 4 Province · max 4 Classi di Concorso · notifiche REAL-TIME.
 *
 * La fonte autorevole del piano è server-side (profiles.piano / subscription_tier);
 * questo modulo espone solo configurazione UI e validazione del frontend, così che
 * wizard, preferenze, dashboard e pagine vetrina usino gli stessi numeri e la stessa copy.
 */

export type PianoAccesso = 'base' | 'pro' | 'free_forever';

/** Programma di consegna notifiche: digest Base alle 17:00 vs real-time PRO. */
export type ProgrammaNotifiche = 'base_digest_17' | 'pro_real_time';

export interface PianoLimits {
  piano: 'base' | 'pro';
  maxProvince: number;
  maxClassiConcorso: number;
  programmaNotifiche: ProgrammaNotifiche;
  etichettaNotifiche: string;
  banner: string;
}

/** Tetti massimi di selezione (Radar) per livello di accesso. */
export const LIMITI_RADAR: Record<'base' | 'pro', { maxProvince: number; maxClassiConcorso: number }> = {
  base: { maxProvince: 1, maxClassiConcorso: 2 },
  pro: { maxProvince: 4, maxClassiConcorso: 4 },
};

/** Programma notifiche per livello: digest Base alle 17:00 · real-time PRO. */
export const PROGRAMMA_NOTIFICHE: Record<'base' | 'pro', { programma: ProgrammaNotifiche; etichetta: string }> = {
  base: { programma: 'base_digest_17', etichetta: 'Notifiche quotidiane alle 17:00' },
  pro: { programma: 'pro_real_time', etichetta: 'Avvisi istantanei (real-time)' },
};

/** Copy standard per i banner/label di piano nell'app. */
export const BANNER_PIANO: Record<'base' | 'pro', string> = {
  base: 'Piano Base (1 Provincia, 2 Classi) - Notifiche quotidiane alle 17:00. Passa a PRO per avvisi istantanei e fino a 4 province.',
  pro: 'Piano PRO (fino a 4 Province, 4 Classi) - Avvisi istantanei in tempo reale su Telegram ed Email.',
};

/**
 * Limiti del piano corrente. Il piano PRO è concesso anche a 'free_forever'
 * (e a chiunque abbia hasProAccess già risolto altrove, es. contesto autenticato).
 */
export function pianoLimits(piano?: PianoAccesso | string | null, hasProAccess?: boolean): PianoLimits {
  const pro = Boolean(hasProAccess) || piano === 'pro' || piano === 'free_forever';
  const livello: 'base' | 'pro' = pro ? 'pro' : 'base';
  return {
    piano: livello,
    maxProvince: LIMITI_RADAR[livello].maxProvince,
    maxClassiConcorso: LIMITI_RADAR[livello].maxClassiConcorso,
    programmaNotifiche: PROGRAMMA_NOTIFICHE[livello].programma,
    etichettaNotifiche: PROGRAMMA_NOTIFICHE[livello].etichetta,
    banner: BANNER_PIANO[livello],
  };
}

/** Tronca una lista (province/classi) al tetto del piano, conservando i primi elementi. */
export function limitaSelezione<T>(lista: T[] | undefined, max: number): T[] {
  return Array.isArray(lista) ? lista.slice(0, Math.max(0, max)) : [];
}
