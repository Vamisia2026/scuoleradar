// File: src/types/user.ts
// Tipi di piano, limiti Radar e programma di notifica.
//
// Regole applicate da onboarding, preferenze e validazione profilo:
//  - Piano BASE  → 1 Provincia · max 2 Classi di Concorso · notifiche DIGEST quotidiane alle 17:00.
//  - Piano PRO / Free Forever → max 4 Province · max 4 Classi di Concorso · notifiche REAL-TIME
//    (istantanee su Telegram/Email).
//
// La fonte autorevole del piano è server-side (profiles.piano / subscription_tier).
// I valori condivisi vivono in src/lib/planLimits.ts; qui troviamo i TIPI e la documentazione
// del programma di notifica per ogni account.

export type AccountType = 'base' | 'pro';

/** Piano salvato su profiles.piano (alias subscription_tier). */
export type PianoUtente = 'base' | 'pro' | 'free_forever';

/**
 * Programma di consegna delle notifiche Radar flaggato sul profilo:
 *  - 'base_digest_17' → riepilogo DIGEST una volta al giorno alle 17:00 (piano Base);
 *  - 'pro_real_time'  → avvisi ISTANTANEI non appena esce un avviso (piano PRO / Free Forever).
 */
export type ProgrammaNotifiche = 'base_digest_17' | 'pro_real_time';

export interface UserPlanInfo {
  isPro: boolean;
  /** Province monitorabili dal Radar (Base: 1 · PRO: 4). */
  maxProvince: number;
  /** Classi di concorso monitorabili (Base: 2 · PRO: 4). */
  maxClassiConcorso: number;
  /** Programma di notifica del piano (Base: digest 17:00 · PRO: real-time). */
  programmaNotifiche: ProgrammaNotifiche;
}

