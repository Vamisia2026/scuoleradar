/**
 * Catalogo piani di pagamento (FASE 6/7).
 * La fonte autorevole dei prezzi è server-side (secrets Supabase STRIPE_PRICE_*):
 * il frontend invia SOLO il nome del piano alla Edge Function `checkout`,
 * che lo mappa ai Price ID di Stripe. Nessun Price ID lato client.
 */

export type PianoId = 'pro_annuale' | 'pro_mensile' | 'a_consumo';

/** Piani disponibili (in ordine di presentazione). */
export const PIANI: PianoId[] = ['pro_annuale', 'pro_mensile', 'a_consumo'];

/** Chiave localStorage: piano scelto da un utente anonimo (ripresa checkout dopo il login). */
export const STORAGE_KEY_INTENDED_PLAN = 'scuoleradar:intended_plan';

/** Chiave localStorage: payload aggiuntivo del piano (promo, quantità) per la ripresa checkout. */
export const STORAGE_KEY_INTENDED_PLAN_DATA = 'scuoleradar:intended_plan_data';
