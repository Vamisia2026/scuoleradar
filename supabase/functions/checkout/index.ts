// ============================================================
// Edge Function Supabase — Checkout Stripe (FASE 6)
//
// Crea una sessione di Checkout per il piano richiesto e ritorna
// l'URL a cui redirigere il browser dell'utente.
//
// Autenticazione: --verify-jwt (deve essere un utente loggato).
// Body: { "plan": "pro_annuale" | "pro_mensile" | "a_consumo", "promo": "CODICE", "quantita": 3 }
//   "plan" (obbligatorio): piano richiesto. La Edge Function accetta anche le varianti
//   inglesi (pro_annual, pro_monthly, alacarte) e le normalizza ai nomi canonici italiani.
//   Il mapping ai Price ID usa SOLO i secrets server-side (STRIPE_PRICE_*):
//   MAI fidarsi di priceId inviati dal client.
//   "promo" (opzionale): codice referral → validato via RPC valida_codice_promo;
//   se valido applica il coupon -10€ (PRO annuale e crediti a consumo) e traccia il referrer.
//   "quantita" (opzionale, default 1): numero di crediti a consumo (1€/cad).
//
// Secrets richiesti:
//   STRIPE_SECRET_KEY              (obbligatoria — sk_test_… / sk_live_…)
//   STRIPE_PRICE_ID_ANNUAL         (Price ID PRO annuale — 49€, es. price_1UAnSqKHxfBbZQd8xtvuLMVK)
//   STRIPE_PRICE_ID_MONTHLY        (Price ID PRO mensile — 9€, es. price_1UAnTeKHxfBbZQd8iqjzlvn0)
//   STRIPE_PRICE_ID_CONSUMO        (Price ID a consumo — 5€, es. price_1UAnUXKHxfBbZQd8n1UfrIkI)
//   REFERRAL_COUPON_ID             (Coupon referral -10€ sul PRO annuale, es. TOQf7ze2)
//   STRIPE_COUPON_BETA1ANNO        (Coupon ID di "BETA1ANNO" — sconto 100% sul PRO annuale —
//                                    LIVE: XRxitsVf)
//   STRIPE_MODE                    (opzionale — 'test' | 'live'; default: auto-rilevata dalla chiave sk_live_*)
//   WEBHOOK_ENDPOINT               (URL dell'endpoint webhook configurato nel dashboard Stripe,
//                                    es. https://gwdmsgsshvdnfrplbjiv.supabase.co/functions/v1/webhook)
//
// Stripe LIVE — Product ID di riferimento (le sessioni usano SOLO i Price ID sopra):
//   PRO annuale 49€ → prod_VB9makC3Y0XBKH · PRO mensile 9€ → prod_VB9nHSVaw9Tlhi
//   A consumo 5€    → prod_VB9oCAZRUAgjEp
//
// Retrocompatibilità: in lettura vengono accettati anche i vecchi nomi
// STRIPE_PRICE_PRO_ANNUALE / STRIPE_PRICE_PRO_MENSILE / STRIPE_PRICE_A_CONSUMO
// (con fallback _CONSUMO / _ALACARTE) e STRIPE_COUPON_REFERRAL_10 (fallback del coupon).
// Se i secrets STRIPE_PRICE_ID_* mancano, il codice usa i Price ID LIVE qui sotto come fallback:
// NON modificare mai questi ID: sono i prezzi attivi di produzione.
//
// Passaggio TEST → LIVE: aggiorna SOLO i secrets — STRIPE_SECRET_KEY=sk_live_…,
// i Price ID e il coupon di produzione (nessuna modifica al codice necessaria).
//
// Deploy:
//   supabase functions deploy checkout --project-ref <ref>   (JWT verificato di default)
// ============================================================

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';

const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY') ?? '';
/** Modalità Stripe: 'live' se la chiave è sk_live_*, 'test' altrimenti (sovrascrivibile via STRIPE_MODE). */
const STRIPE_MODE =
  Deno.env.get('STRIPE_MODE') ?? (STRIPE_SECRET_KEY.startsWith('sk_live_') ? 'live' : 'test');
console.log(
  `[checkout] modalità Stripe: ${STRIPE_MODE} — chiave: ${STRIPE_SECRET_KEY ? STRIPE_SECRET_KEY.slice(0, 7) + '…' : 'mancante'}`,
);
const STRIPE_API = 'https://api.stripe.com/v1';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
/** Coupon referral Stripe (-10€ sul PRO annuale): REFERRAL_COUPON_ID (fallback STRIPE_COUPON_REFERRAL_10). */
const COUPON_REFERRAL = Deno.env.get('REFERRAL_COUPON_ID') ?? Deno.env.get('STRIPE_COUPON_REFERRAL_10') ?? '';
/** Endpoint webhook Stripe (configurato nel dashboard Stripe) — esposto nel health-check e nei log. */
const WEBHOOK_ENDPOINT = Deno.env.get('WEBHOOK_ENDPOINT') ?? '';

/**
 * Normalizza un piano ricevuto nel body (anche le varianti inglesi) al nome canonico italiano.
 * Varianti accettate: pro_annuale/pro_annual, pro_mensile/pro_monthly, a_consumo/alacarte.
 */
function normalizzaPiano(plan: string): string {
  switch (plan) {
    case 'pro_annual':
      return 'pro_annuale';
    case 'pro_monthly':
      return 'pro_mensile';
    case 'alacarte':
      return 'a_consumo';
    default:
      return plan;
  }
}

const STRIPE_PRICE_IDS: Record<string, string> = {
  pro_annuale:
    Deno.env.get('STRIPE_PRICE_ID_ANNUAL') ??
    Deno.env.get('STRIPE_PRICE_PRO_ANNUALE') ??
    'price_1UAnSqKHxfBbZQd8xtvuLMVK', // LIVE — PRO annuale 49€ (prod_VB9makC3Y0XBKH)
  pro_mensile:
    Deno.env.get('STRIPE_PRICE_ID_MONTHLY') ??
    Deno.env.get('STRIPE_PRICE_PRO_MENSILE') ??
    'price_1UAnTeKHxfBbZQd8iqjzlvn0', // LIVE — PRO mensile 9€ (prod_VB9nHSVaw9Tlhi)
  a_consumo:
    Deno.env.get('STRIPE_PRICE_ID_CONSUMO') ??
    Deno.env.get('STRIPE_PRICE_A_CONSUMO') ??
    Deno.env.get('STRIPE_PRICE_CONSUMO') ??
    Deno.env.get('STRIPE_PRICE_ALACARTE') ??
    'price_1UAnUXKHxfBbZQd8n1UfrIkI', // LIVE — a consumo 5€ (prod_VB9oCAZRUAgjEp)
};

/** Stripe LIVE — Product ID di riferimento (verifica/diagnostica; le sessioni usano i Price ID). */
const STRIPE_PRODUCT_IDS: Record<string, string> = {
  pro_annuale: 'prod_VB9makC3Y0XBKH', // PRO annuale 49€
  pro_mensile: 'prod_VB9nHSVaw9Tlhi', // PRO mensile 9€
  a_consumo: 'prod_VB9oCAZRUAgjEp', // a consumo 5€
};

/**
 * Coupon Stripe LIVE applicato DIRETTAMENTE alla sessione per il codice "BETA1ANNO"
 * (sconto 100%: totale 0,00 € mostrato subito nel checkout hosted).
 * Bypassa la validazione dei promo code usando il Coupon ID via `discounts[0][coupon]`.
 * Override via secret STRIPE_COUPON_BETA1ANNO.
 */
const STRIPE_COUPON_BETA1ANNO = Deno.env.get('STRIPE_COUPON_BETA1ANNO') ?? 'XRxitsVf';

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

/** POST form-urlencoded a un endpoint Stripe con dettaglio dell'errore. */
async function postStripe<T>(
  path: string,
  campi: Record<string, string>,
): Promise<{ ok: true; data: T } | { ok: false; errore: string }> {
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
    const testo = await res.text();
    console.error(`Stripe ${path} fallito (${res.status}):`, testo);
    let dettaglio = testo;
    try {
      const json = JSON.parse(testo) as { error?: { message?: string } };
      dettaglio = json.error?.message ?? testo;
    } catch {
      // corpo non JSON: lo riportiamo comunque
    }
    return { ok: false, errore: dettaglio };
  }
  return { ok: true, data: (await res.json()) as T };
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

/** Header CORS per richieste dal browser (l'app gira su un origin diverso da *.supabase.co). */
const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/** Risposta JSON uniforme con flag `success` — mai crash senza risposta. */
function risposta(data: Record<string, unknown>, status = 200): Response {
  const body = { success: status >= 200 && status < 300, ...data };
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
  });
}

serve(async (req: Request) => {
  // Preflight CORS (OPTIONS) — richiesto dalle chiamate fetch del browser.
  // NB: 204 No Content non deve avere body (causerebbe un errore runtime → 500).
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }
  if (req.method !== 'POST') {
    return risposta({ error: 'Metodo non consentito' }, 405);
  }

  try {
    // Verifica della chiave Stripe (letto dai secrets Supabase)
    if (!STRIPE_SECRET_KEY) {
      return risposta(
        { error: 'Configurazione mancante: STRIPE_SECRET_KEY non è impostato nei secrets Supabase.' },
        500,
      );
    }

    // Utente dal JWT (già verificato dal runtime grazie a --verify-jwt)
    const auth = req.headers.get('authorization') ?? '';
    const token = auth.replace(/^Bearer\s+/i, '').trim();
    const jwt = decodeJwt(token);
    const userId = jwt?.sub;
    if (!userId) {
      return risposta({ error: 'Non autorizzato' }, 401);
    }

    let body: {
      plan?: string;
      promo?: string;
      quantita?: number;
      origin?: string;
      ping?: boolean;
    };
    try {
      body = await req.json();
    } catch {
      return risposta({ error: 'Body JSON non valido' }, 400);
    }

    // Health-check mode (ping): nessuna sessione Stripe creata, solo stato di configurazione.
    if (body.ping === true) {
      const priceMancanti = Object.entries(STRIPE_PRICE_IDS)
        .filter(([, v]) => !v)
        .map(([k]) => k);
      return risposta({
        ok: true,
        configurato: Boolean(STRIPE_SECRET_KEY) && priceMancanti.length === 0,
        stripeKey: Boolean(STRIPE_SECRET_KEY),
        priceMancanti,
        productIds: STRIPE_PRODUCT_IDS,
        couponBeta1Anno: STRIPE_COUPON_BETA1ANNO,
        mode: STRIPE_MODE,
        webhookEndpoint: WEBHOOK_ENDPOINT,
        couponReferral: Boolean(COUPON_REFERRAL),
      });
    }

    const plan = normalizzaPiano((body.plan ?? '').trim());
    const priceId = STRIPE_PRICE_IDS[plan];
    if (!priceId) {
      // Piano inesistente OPPURE secret non configurato: risposta esplicita (mai 500).
      return risposta({ success: false, error: 'Secret non configurato per il piano selezionato' }, 400);
    }

    // mode Stripe: "payment" per i crediti a consumo (a_consumo/alacarte NON è un
    // abbonamento: con mode="subscription" Stripe risponderebbe 400), "subscription"
    // solo per i piani PRO (pro_annuale / pro_mensile).
    const mode =
      plan === 'a_consumo' || plan === 'alacarte' ? 'payment' : 'subscription';
    const quantita = Math.max(1, Math.min(100, Math.floor(body.quantita ?? 1)));

    // URL di ritorno DINAMICI: usiamo l'origin inviata dal client (body.origin), con fallback
    // sull'header Origin della richiesta HTTP. In locale i redirect puntano quindi a
    // http://localhost:<porta>/dashboard/radar (e mai a produzione): fallback finale su
    // env APP_URL o sul dominio di produzione. NB: il frontend invia SEMPRE window.location.origin.
    const originHeader = req.headers.get('origin')?.trim();
    const origin = (
      body.origin?.trim() ||
      originHeader ||
      Deno.env.get('APP_URL') ||
      'https://scuoleradar.it'
    ).replace(/\/+$/, ''); // rimuove eventuali slash finali prima di comporre le URL
    const successUrl = `${origin}/dashboard/radar?esito=successo`;
    const cancelUrl = `${origin}/dashboard/radar?esito=annullato`;

    const campi: Record<string, string> = {
      mode,
      success_url: successUrl,
      cancel_url: cancelUrl,
      // Lingua italiana forzata per il checkout hosted di Stripe.
      locale: 'it',
      'line_items[0][price]': priceId,
      'line_items[0][quantity]': String(quantita),
      'client_reference_id': userId,
      'metadata[user_id]': userId,
    };
    if (jwt?.email) campi.customer_email = jwt.email;

    // Codice promo / referral:
    // 1) "BETA1ANNO": coupon Stripe applicato DIRETTAMENTE alla sessione via
    //    `discounts[0][coupon]` (MAI `discounts[0][promotion_code]`). Il coupon
    //    (XRxitsVf, sconto 100%) è già applicato in fase di creazione sessione, quindi
    //    il checkout hosted mostra subito il totale a 0,00 € senza validazione promo.
    // 2) Codice referral (-10€): valida via RPC e applica il coupon automatico.
    if (body.promo) {
      const codiceUpp = body.promo.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
      if (codiceUpp === 'BETA1ANNO') {
        campi['discounts[0][coupon]'] = STRIPE_COUPON_BETA1ANNO;
        campi['metadata[promo]'] = codiceUpp;
        console.log(`  → coupon Stripe applicato: ${codiceUpp} (${STRIPE_COUPON_BETA1ANNO})`);
      } else {
        const promo = await validaPromo(body.promo);
        if (promo?.valido && promo.referrer_id) {
          campi['metadata[promo]'] = promo.codice ?? body.promo;
          campi['metadata[promo_referrer]'] = promo.referrer_id;
          if (COUPON_REFERRAL && (plan === 'pro_annuale' || plan === 'a_consumo')) {
            campi['discounts[0][coupon]'] = COUPON_REFERRAL;
          }
        }
      }
    }

    // Promo codes Stripe nel checkout hosted (es. BETA1ANNO): consentono all'utente
    // di inserire un codice sconto direttamente nella pagina di pagamento.
    // NB: `allow_promotion_codes` è mutuamente esclusivo con `discounts` (coupon referral
    // o promotion code pre-fillato): se è già stato applicato uno sconto automatico,
    // MAI inviare allow_promotion_codes=true (Stripe rifiuterebbe la richiesta).
    if (campi['discounts[0][coupon]'] || campi['discounts[0][promotion_code]']) {
      delete campi['allow_promotion_codes'];
    } else {
      campi['allow_promotion_codes'] = 'true';
    }

    const esito = await postStripe<{ url?: string }>('/checkout/sessions', campi);
    if (!esito.ok) {
      // Messaggio ESATTO di Stripe inoltrato al client (per il toast): niente errori generici.
      return new Response(JSON.stringify({ success: false, error: esito.errore }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
      });
    }
    if (!esito.data.url) {
      return risposta({ error: 'Stripe non ha restituito un URL di checkout' }, 400);
    }

    console.log(
      `✓ Sessione di checkout creata: plan=${plan} mode=${mode} user=${userId.slice(0, 8)}… url=${esito.data.url.slice(0, 40)}…`,
    );
    return risposta({ url: esito.data.url });
  } catch (err) {
    // Non lasciare MAI la richiesta senza risposta: log completo + messaggio esatto di Stripe.
    console.error('checkout — errore non gestito:', err);
    const rawError = err as { raw?: { message?: string }; message?: string } | null;
    const stripeError = rawError?.raw?.message || rawError?.message || 'Errore interno sconosciuto';
    return new Response(JSON.stringify({ success: false, error: stripeError }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
    });
  }
});

