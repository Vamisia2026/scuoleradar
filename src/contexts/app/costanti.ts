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
  // Sostegno: INCLUSO in modo PERMANENTE (nessun filtro silenzioso sugli avvisi
  // AD…). Non è più una preferenza: non esiste alcun interruttore né un'uscita,
  // e la consegna non dipende da questo valore (resta solo per compatibilità).
  sostegno: true,
};
