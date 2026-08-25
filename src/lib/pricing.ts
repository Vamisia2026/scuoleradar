/**
 * Price IDs Stripe visibili al frontend (da VITE_STRIPE_*).
 * Nota: la fonte autorevole è server-side (secrets Supabase STRIPE_PRICE_*);
 * questi valori servono solo per verifica/debug e sono passati alla Edge
 * Function `checkout` come parametro `priceId`.
 */
export const STRIPE_PRICE_IDS: Record<string, string> = {
  pro_annuale: import.meta.env.VITE_STRIPE_PRICE_PRO_ANNUALE ?? '',
  pro_mensile: import.meta.env.VITE_STRIPE_PRICE_PRO_MENSILE ?? '',
  alacarte: import.meta.env.VITE_STRIPE_PRICE_ALACARTE ?? '',
};

/** Ritorna il priceId configurato per il piano, o undefined se non valorizzato. */
export function priceIdPerPiano(plan: string): string | undefined {
  return STRIPE_PRICE_IDS[plan] || undefined;
}
