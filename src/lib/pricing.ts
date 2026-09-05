/**
 * Catalogo piani di pagamento (FASE 6/7).
 * La fonte autorevole dei prezzi è server-side (secrets Supabase STRIPE_PRICE_*):
 * il frontend invia SOLO il nome del piano alla Edge Function `checkout`,
 * che lo mappa ai Price ID di Stripe. Nessun Price ID lato client.
 */

export type PianoId = 'pro_annuale' | 'pro_mensile' | 'a_consumo';

/** Prezzo ancorato PRO annuale (€/anno) — fonte autorevole: Price ID Stripe server-side. */
export const PREZZO_PRO_ANNUO_EUR = 49;
/** Prezzo PRO annuale formattato per le UI. */
export const PREZZO_PRO_ANNUO_ETICHETTA = '49 €';
/** Durata del TRIAL gratuito concesso al termine dell'onboarding. */
export const GIORNI_TRIAL_PRO = 30;
/** Sconto promozionale primo anno (%) applicato prima della scadenza del trial. */
export const SCONTO_PRIMO_ANNO_PERCENTO = 50;
/** Prezzo scontato primo anno (24,50 €) — rinnovo poi al prezzo pieno. */
export const PREZZO_PRIMO_ANNO_SCONTATO_EUR = PREZZO_PRO_ANNUO_EUR * (1 - SCONTO_PRIMO_ANNO_PERCENTO / 100);

/** Piani disponibili (in ordine di presentazione). */
export const PIANI: PianoId[] = ['pro_annuale', 'pro_mensile', 'a_consumo'];

/** Chiave localStorage: piano scelto da un utente anonimo (ripresa checkout dopo il login). */
export const STORAGE_KEY_INTENDED_PLAN = 'scuoleradar:intended_plan';

/** Chiave localStorage: payload aggiuntivo del piano (promo, quantità) per la ripresa checkout. */
export const STORAGE_KEY_INTENDED_PLAN_DATA = 'scuoleradar:intended_plan_data';
