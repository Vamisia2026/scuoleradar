import { supabase } from '@/lib/supabase';

export interface PromoValido {
  valido: boolean;
  referrer_id?: string;
  codice?: string;
}

/**
 * Valida un codice promo/referral contro profiles.referral_code (RPC valida_codice_promo).
 * Un codice è applicabile solo se appartiene a un ALTRO utente (niente auto-promo).
 */
export async function validaPromo(codice: string, userId?: string | null): Promise<PromoValido> {
  if (!supabase) return { valido: false };
  const upp = codice.toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (!upp) return { valido: false };
  const { data } = await supabase.rpc('valida_codice_promo', { p_codice: upp });
  const riga =
    Array.isArray(data) && data.length > 0
      ? (data[0] as { valido?: boolean; referrer_id?: string; codice?: string })
      : null;
  const valido = Boolean(riga?.valido && riga.referrer_id && riga.referrer_id !== userId);
  return {
    valido,
    referrer_id: riga?.referrer_id,
    codice: riga?.codice,
  };
}

/** Importo dello sconto promo applicato (coincide con il coupon Stripe amount_off). */
export const SCONTO_PROMO_EUR = 10;
