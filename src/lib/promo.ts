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
 * Coupon UNICO di sconto attivo: **SCUOLERADAR50** — 50% sulla sottoscrizione
 * ANNUALE del piano PRO (49 €/anno → 24,50 €).
 *
 * Regole tassative (le stesse applicate server-side da
 * `valida_coupon_scuoleradar50` in `supabase/migrations/*_coupon_scuoleradar50_unico.sql`):
 *  1. 50% di sconto sulla sottoscrizione annuale (nessun altro piano);
 *  2. MONOUSO per email: una sola volta per utente, e nessun altro account con la
 *     stessa email / email di notifica / Telegram può riutilizzarlo;
 *  3. valido **40 giorni** a partire dalla registrazione iniziale (la data che ha
 *     attivato il mese PRO gratuito);
 *  4. case-insensitive: `scuoleradar50`, `ScuoleRadar50` e `SCUOLERADAR50` sono lo
 *     stesso codice (`normalizzaCodicePromo`).
 *
 * Il coupon `RADAR50` è stato RIMOSSO definitivamente: non è più accettato né dal
 * client né dalle Edge Function (e la riga è cancellata da `promo_codes`).
 */
export const PROMO_CODE_50_PRIMO_ANNO = 'SCUOLERADAR50';

/** Sconto percentuale del coupon SCUOLERADAR50 (sottoscrizione annuale). */
export const SCONTO_SCUOLERADAR50_PERCENTO = 50;

/** Validità del coupon SCUOLERADAR50: giorni dalla registrazione iniziale. */
export const GIORNI_VALIDITA_SCUOLERADAR50 = 40;

/**
 * Normalizza un codice promo digitato dall'utente: maiuscolo, senza spazi né
 * separatori. Rende il confronto **case-insensitive** (`scuoleradar50` ≡
 * `SCUOLERADAR50`) e tollera l'incollo da email/chat (`SCUOLERADAR-50`).
 */
export function normalizzaCodicePromo(codice: string): string {
  return (codice ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}

/** Codici promo attivi accettati in pre-fill (mappati server-side sul coupon Stripe). */
export const PROMO_CODES_ATTIVI = [PROMO_CODE_BETA1ANNO, PROMO_CODE_50_PRIMO_ANNO];

/**
 * Valida un codice promo/referral contro promo_codes / profiles.referral_code
 * (RPC valida_codice_promo). Un codice referral è applicabile solo se appartiene
 * a un ALTRO utente (niente auto-promo); i codici beta/gratuiti (es. BETA1ANNO)
 * sono validi anche senza referrer.
 */
export async function validaPromo(codice: string, userId?: string | null): Promise<PromoValido> {
  if (!supabase) return { valido: false };
  const upp = normalizzaCodicePromo(codice);
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

/* ------------------------------------------------------------------ */
/*  Catalogo promo & gestione rapida (System Health Check / DevToolbar) */
/* ------------------------------------------------------------------ */

/** Stato visualizzabile di un codice promo nella sezione "Promo Codes / Coupons". */
export type StatoPromo = 'attivo' | 'disattivato' | 'scaduto';

/** Voce del catalogo promo mostrato nel System Health Check. */
export interface CatalogoPromo {
  codice: string;
  /**
   * Etichetta breve mostrata sotto il codice (es. per SCUOLERADAR50:
   * "Sconto 50% sul piano PRO dopo il mese di prova. Valido 40 giorni
   * dall'attivazione account").
   */
  descrizione: string;
  tipo: 'beta' | 'sconto';
  /**
   * 'sistema' → codice promo amministrativo/di campagna (unico catalogo mostrato nel DEV panel);
   * 'referral' → codice referral AUTOMATICO "Invita un collega" legato a un profilo utente
   *              (es. sconto -10€ / bonus): MAI mostrato tra i promo di sistema.
   */
  origine: 'sistema' | 'referral';
  /** Stato di default quando non ci sono override né righe DB più recenti. */
  defaultStato: StatoPromo;
}

/**
 * Catalogo dei soli codici promo DI SISTEMA (campagne/marketing amministrative).
 * I codici referral automatici generati da "Invita un collega" (NOME+COGNOME,
 * -10€/bonus) sono esclusi: sono legati a singoli profili e non vanno gestiti qui.
 */
export const CATALOGO_PROMO: CatalogoPromo[] = [
  {
    codice: PROMO_CODE_BETA1ANNO,
    descrizione: 'Accesso PRO gratuito per 1 anno di test beta',
    tipo: 'beta',
    origine: 'sistema',
    defaultStato: 'attivo',
  },
  {
    codice: PROMO_CODE_50_PRIMO_ANNO,
    descrizione:
      "Sconto 50% sulla sottoscrizione annuale PRO, monouso per email: valido 40 giorni dalla registrazione (quella che attiva il mese PRO gratuito)",
    tipo: 'sconto',
    origine: 'sistema',
    defaultStato: 'attivo',
  },
  {
    codice: 'BETALIFETIME',
    descrizione: 'Accesso PRO a vita per i beta tester (seed)',
    tipo: 'beta',
    origine: 'sistema',
    defaultStato: 'disattivato',
  },
];

/** Chiave localStorage degli override di stato dei promo (solo tool di sviluppo). */
const STORAGE_KEY_STATI_PROMO = 'sr_promo_stati_dev';

/** Legge gli override locali (dev/admin) dello stato dei promo. */
export function leggiOverridePromo(): Record<string, StatoPromo> {
  if (typeof localStorage === 'undefined') return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY_STATI_PROMO);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const out: Record<string, StatoPromo> = {};
    for (const [k, v] of Object.entries(parsed)) {
      if (v === 'attivo' || v === 'disattivato' || v === 'scaduto') out[k] = v;
    }
    return out;
  } catch {
    return {};
  }
}

/** Persiste gli override locali (dev/admin) dello stato dei promo. */
export function salvaOverridePromo(stati: Record<string, StatoPromo>): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY_STATI_PROMO, JSON.stringify(stati));
  } catch {
    // localStorage non disponibile
  }
}
