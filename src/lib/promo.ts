import { supabase } from '@/lib/supabase';

export interface PromoValido {
  valido: boolean;
  gratuito?: boolean;
  referrer_id?: string;
  codice?: string;
  piano?: string;
  durata?: string;
}

/**
 * Coupon attivo (Stripe): codice utente applicabile al checkout.
 * "BETA1ANNO" → Coupon ID XRxitsVf (sconto 100% sul PRO annuale)
 * (la mappatura è server-side nella Edge Function `checkout`).
 */
export const PROMO_CODE_BETA1ANNO = 'BETA1ANNO';

/**
 * Promo "50% primo anno": 24,95 € (prezzo pieno 49,90 € dal 2° anno).
 * Mappare il codice al coupon percentuale Stripe sul prodotto PRO annuale
 * nella Edge `checkout` (configurazione server-side, coupon "SCUOLERADAR50").
 */
export const PROMO_CODE_50_PRIMO_ANNO = 'SCUOLERADAR50';

/**
 * Coupon RADAR50 — 50% sul PRO annuale.
 * Dinamico e monouso: valido solo nei primi 40 giorni dalla registrazione,
 * una volta per utente (anti-abuso su Telegram ID / email secondaria).
 * La validazione è server-side (RPC valida_coupon_radar50 → Edge checkout).
 */
export const PROMO_CODE_RADAR50 = 'RADAR50';

/** Codici promo attivi accettati in pre-fill (mappati server-side sul coupon Stripe). */
export const PROMO_CODES_ATTIVI = [PROMO_CODE_BETA1ANNO, PROMO_CODE_50_PRIMO_ANNO, PROMO_CODE_RADAR50];

/**
 * Valida un codice promo/referral contro promo_codes / profiles.referral_code
 * (RPC valida_codice_promo). Un codice referral è applicabile solo se appartiene
 * a un ALTRO utente (niente auto-promo); i codici beta/gratuiti (es. BETA1ANNO)
 * sono validi anche senza referrer.
 */
export async function validaPromo(codice: string, userId?: string | null): Promise<PromoValido> {
  if (!supabase) return { valido: false };
  const upp = codice.toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (!upp) return { valido: false };
  const { data } = await supabase.rpc('valida_codice_promo', { p_codice: upp });
  const riga =
    Array.isArray(data) && data.length > 0
      ? (data[0] as {
          valido?: boolean;
          gratuito?: boolean;
          referrer_id?: string;
          codice?: string;
          piano?: string;
          durata?: string;
        })
      : null;
  const valido = Boolean(
    riga?.valido &&
      (riga.gratuito === true || (Boolean(riga.referrer_id) && riga.referrer_id !== userId)),
  );
  return {
    valido,
    gratuito: riga?.gratuito,
    referrer_id: riga?.referrer_id,
    codice: riga?.codice,
    piano: riga?.piano,
    durata: riga?.durata,
  };
}

/** Importo dello sconto promo referral applicato (coincide con il coupon Stripe amount_off). */
export const SCONTO_PROMO_EUR = 10;
