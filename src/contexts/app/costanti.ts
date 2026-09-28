/**
 * Contesto App · costanti interne del contesto.
 *
 * Estratto da `AppContext.tsx`: lo stato iniziale delle preferenze, usato come
 * default di `useLocalStorage('sr_preferenze')`.
 */
import type { Preferenze } from './types';

/** Preferenze vuote: profilo non ancora configurato (Radar spento). */
export const defaultPreferenze: Preferenze = {
  genere: null,
  eta: null,
  ordini: [],
  classiCodici: [],
  materieId: [],
  materieCustom: [],
  provinceCodici: [],
  telegramUsername: '',
  telegramChatId: '',
  emailNotifica: '',
  onboarded: false,
  favoriteSchools: [],
  ignoredSchools: [],
  // Sostegno: INCLUSO di default (nessun filtro silenzioso sugli avvisi AD…).
  // Chi non lo vuole lo spegne dalle Preferenze Radar (`SostegnoToggle`).
  sostegno: true,
};
