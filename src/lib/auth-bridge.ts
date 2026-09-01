/**
 * ACCOUNT BRIDGE — session helpers (ScuoleRadar PRO ↔ PureFocus PRO).
 *
 * La generazione del token/URL firmato vive in `purefocus-bridge.ts` (modulo
 * canonico); questo file mantiene gli helper di sessione (RPC get_user_pro_status)
 * e la convenienza `buildPureFocusBridgeUrl()` senza argomenti.
 */
import { supabase } from '@/lib/supabase';
import {
  generatePureFocusBridgeToken,
  generatePureFocusBridgeUrl,
  verifyPureFocusBridgeToken,
} from '@/lib/purefocus-bridge';

export interface StatoProBridge {
  is_pro: boolean;
  expires_at: string | null;
  tier: string;
}

/** Stato PRO autorevole dalla RPC `get_user_pro_status` (fallback: non PRO). */
export async function ottieniStatoPro(): Promise<StatoProBridge | null> {
  if (!supabase) return null;
  const { data: sessione } = await supabase.auth.getSession();
  if (!sessione.session?.user) return null;
  const { data, error } = await supabase.rpc('get_user_pro_status', {
    p_user_id: sessione.session.user.id,
  });
  if (error || !Array.isArray(data) || data.length === 0) {
    return { is_pro: false, expires_at: null, tier: 'base' };
  }
  const riga = data[0] as Partial<StatoProBridge>;
  return {
    is_pro: Boolean(riga.is_pro),
    expires_at: riga.expires_at ? String(riga.expires_at) : null,
    tier: riga.tier ? String(riga.tier) : 'base',
  };
}

/**
 * URL bridge senza argomenti: usa la sessione attiva + stato PRO autorevole.
 * Convenienza per ottenere il launch link completo in un solo passo.
 */
export async function buildPureFocusBridgeUrl(): Promise<string | null> {
  if (!supabase) return null;
  const { data: sessione } = await supabase.auth.getSession();
  if (!sessione.session?.user?.email) return null;
  const stato = (await ottieniStatoPro()) ?? { is_pro: false, expires_at: null, tier: 'base' };
  return generatePureFocusBridgeUrl(
    sessione.session.user.email,
    stato.is_pro,
    stato.expires_at ?? '',
  );
}

// Re-export per retrocompatibilità (modulo canonico: purefocus-bridge.ts)
export { generatePureFocusBridgeToken, generatePureFocusBridgeUrl, verifyPureFocusBridgeToken };

