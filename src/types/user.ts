// File: src/types/user.ts
// Rimuoviamo il tipo Base e le limitazioni relative alle 3 segnalazioni

export type AccountType = 'pro'; // Unico livello attivo per la prova/registrazione

export interface UserPlanInfo {
  isPro: true;
  // Rimossi: freeReportsLeft, maxFreeReports, accountType: 'base' | 'pro'
}
