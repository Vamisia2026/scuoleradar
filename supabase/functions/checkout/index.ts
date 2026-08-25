// ============================================================
// Edge Function Supabase — Checkout Stripe (FASE 6)
//
// Crea una sessione di Checkout per il piano richiesto e ritorna
// l'URL a cui redirigere il browser dell'utente.
//
// Autenticazione: --verify-jwt (deve essere un utente loggato).
// Body: { "plan": "pro_annuale" | "pro_mensile" | "alacarte", "promo": "CODICE" }
//   "promo" (opzionale): codice referral → validato via RPC valida_codice_promo;
//   se valido applica il coupon -10€ (solo PRO annuale) e traccia il referrer nei metadata.
//
// Secrets richiesti:
//   STRIPE_SECRET_KEY              (obbligatoria)
//   STRIPE_PRICE_PRO_ANNUALE       (id price PRO annuale)
//   STRIPE_PRICE_PRO_MENSILE       (id price PRO mensile)
//   STRIPE_PRICE_ALACARTE          (id price A la Carte / sblocco)
//   STRIPE_COUPON_REFERRAL_10      (opzionale — coupon amount_off 10€ per i referral)
//
// Deploy:
//   supabase functions deploy checkout --project-ref <ref>   (JWT verificato di default)
// ============================================================

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';

const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY') ?? '';
const STRIPE_API = 'https://api.stripe.com/v1';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
/** Coupon Stripe (amount_off 10€, una tantum) per il programma referral. */
const COUPON_REFERRAL = Deno.env.get('STRIPE_COUPON_REFERRAL_10') ?? '';

const STRIPE_PRICE_IDS: Record<string, string> = {
  pro_annuale: Deno.env.get('STRIPE_PRICE_PRO_ANNUALE') ?? '',
  pro_mensile: Deno.env.get('STRIPE_PRICE_PRO_MENSILE') ?? '',
  alacarte: Deno.env.get('STRIPE_PRICE_ALACARTE') ?? '',
};

type Piano = keyof typeof STRIPE_PRICE_IDS;

const SUCCESS_URL =
  Deno.env.get('APP_URL') ?? 'https://scuoleradar.it/dashboard/radar?esito=successo';
const CANCEL_URL =
  Deno.env.get('APP_URL') ?? 'https://scuoleradar.it/dashboard/radar?esito=annullato';

/** Decodifica il payload (base64url) di un JWT senza verificarne la firma (il runtime la verifica con --verify-jwt). */
function decodeJwt(token: string): { sub?: string; email?: string } | null {
  try {
    const payload = token.split('.')[1];
    const json = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
    return JSON.parse(json) as { sub?: string; email?: string };
  } catch {
    return null;
  }
}

/** POST form-urlencoded a un endpoint Stripe. */
async function postStripe<T>(path: string, campi: Record<string, string>): Promise<T | null> {
  const body = new URLSearchParams(campi).toString();
  const res = await fetch(`${STRIPE_API}${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${STRIPE_SECRET_KEY}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
  });
  if (!res.ok) {
    console.error(`Stripe ${path} fallito:`, res.status, await res.text());
    return null;
  }
  return (await res.json()) as T;
}

/** Valida il codice promo contro profiles.referral_code (via RPC). */
async function validaPromo(
  codice: string,
): Promise<{ valido: boolean; referrer_id?: string; codice?: string } | null> {
  if (!codice.trim()) return { valido: false };
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/valida_codice_promo`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_SERVICE_ROLE,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ p_codice: codice.trim() }),
  });
  if (!res.ok) {
    console.error('valida_codice_promo fallita:', res.status, await res.text());
    return null;
  }
  const righe = (await res.json()) as Array<{
    valido: boolean;
    referrer_id: string;
    codice: string;
  }>;
  return righe[0] ?? { valido: false };
}

serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  // Utente dal JWT (già verificato dal runtime grazie a --verify-jwt)
  const auth = req.headers.get('authorization') ?? '';
  const token = auth.replace(/^Bearer\s+/i, '').trim();
  const jwt = decodeJwt(token);
  const userId = jwt?.sub;
  if (!userId) {
    return new Response(JSON.stringify({ error: 'Non autorizzato' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  let body: { plan?: string; promo?: string };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Body JSON non valido' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const plan = (body.plan ?? '') as Piano;
  const priceId = STRIPE_PRICE_IDS[plan];
  if (!priceId) {
    return new Response(JSON.stringify({ error: `Piano non valido: ${plan}` }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // mode: subscription per i PRO, payment (one-time) per l'A la Carte
  const mode = plan === 'alacarte' ? 'payment' : 'subscription';

  const campi: Record<string, string> = {
    mode,
    success_url: SUCCESS_URL,
    cancel_url: CANCEL_URL,
    'line_items[0][price]': priceId,
    'line_items[0][quantity]': '1',
    // Stripe Managed Payments: i metodi di pagamento gestiti da Stripe sono abilitati
    // (parametro `managed_payments` è un oggetto { enabled: boolean } nelle API aggiornate)
    'managed_payments[enabled]': 'true',
    'client_reference_id': userId,
    'metadata[user_id]': userId,
  };
  if (jwt?.email) campi.customer_email = jwt.email;

  // Codice promo / referral: valida e applica il coupon (-10€ sul piano PRO annuale)
  if (body.promo) {
    const promo = await validaPromo(body.promo);
    if (promo?.valido && promo.referrer_id) {
      campi['metadata[promo]'] = promo.codice ?? body.promo;
      campi['metadata[promo_referrer]'] = promo.referrer_id;
      if (COUPON_REFERRAL && plan === 'pro_annuale') {
        campi['discounts[0][coupon]'] = COUPON_REFERRAL;
      }
    }
  }

  const session = await postStripe<{ url?: string; id?: string }>('/checkout/sessions', campi);
  if (!session?.url) {
    return new Response(JSON.stringify({ error: 'Impossibile creare la sessione di checkout' }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({ url: session.url }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
});

