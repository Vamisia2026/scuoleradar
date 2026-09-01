// ============================================================
// Edge Function Supabase — Webhook Stripe (FASE 6)
//
// Riceve gli eventi di pagamento da Stripe e aggiorna il piano /
// i crediti dell'utente nella tabella profiles.
//
// Autenticazione: NESSUNA (--no-verify-jwt) ma protetta dalla firma
// `stripe-signature` (HMAC-SHA256) con STRIPE_WEBHOOK_SECRET.
//
// Eventi gestiti:
//   checkout.session.completed   → subscription: piano=pro + subscription_tier | payment: +crediti
//   customer.subscription.created/updated → piano, subscription_status, current_period_end
//   customer.subscription.deleted → piano=base, subscription_status=canceled
// Nota: l'Account Bridge (get_user_pro_status) deriva is_pro da
// subscription_status + current_period_end → la scadenza casca automaticamente.
//
// Secrets richiesti:
//   STRIPE_WEBHOOK_SECRET  (signing secret dal pannello Stripe → Webhooks, formato whsec_…;
//                           in LIVE va usato il signing secret dell'endpoint Live)
//   STRIPE_MODE            (opzionale — 'test' | 'live': modalità dichiarata, solo per i log)
//   WEBHOOK_ENDPOINT       (URL pubblico di questo endpoint —
//                           es. https://gwdmsgsshvdnfrplbjiv.supabase.co/functions/v1/webhook)
//
// Passaggio TEST → LIVE: basta usare il signing secret LIVE in STRIPE_WEBHOOK_SECRET.
//
// Deploy:
//   supabase functions deploy webhook --project-ref <ref> --no-verify-jwt
// ============================================================

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';

const STRIPE_WEBHOOK_SECRET = Deno.env.get('STRIPE_WEBHOOK_SECRET') ?? '';
/** Modalità Stripe dichiarata (test | live): la firma usa il webhook secret corrispondente. */
const STRIPE_MODE = Deno.env.get('STRIPE_MODE') ?? 'test';
console.log(
  `[stripe-webhook] modalità Stripe: ${STRIPE_MODE} — webhook secret: ${STRIPE_WEBHOOK_SECRET
    ? STRIPE_WEBHOOK_SECRET.startsWith('whsec_')
      ? STRIPE_WEBHOOK_SECRET.slice(0, 10) + '…'
      : 'formato non whsec_ (da verificare)'
    : 'mancante'}`,
);
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
/**
 * Price ID LIVE (secrets): mapping prezzo → tier per subscription_tier (Account Bridge).
 * Fallback sui Price ID LIVE attivi: NON modificare, sono i prezzi di produzione.
 */
const STRIPE_PRICE_ID_ANNUAL =
  Deno.env.get('STRIPE_PRICE_ID_ANNUAL') ??
  Deno.env.get('STRIPE_PRICE_PRO_ANNUALE') ??
  'price_1UAnSqKHxfBbZQd8xtvuLMVK'; // LIVE — PRO annuale 49€ (prod_VB9makC3Y0XBKH)
const STRIPE_PRICE_ID_MONTHLY =
  Deno.env.get('STRIPE_PRICE_ID_MONTHLY') ??
  Deno.env.get('STRIPE_PRICE_PRO_MENSILE') ??
  'price_1UAnTeKHxfBbZQd8iqjzlvn0'; // LIVE — PRO mensile 9€ (prod_VB9nHSVaw9Tlhi)
const STRIPE_PRICE_ID_CONSUMO =
  Deno.env.get('STRIPE_PRICE_ID_CONSUMO') ??
  Deno.env.get('STRIPE_PRICE_A_CONSUMO') ??
  Deno.env.get('STRIPE_PRICE_CONSUMO') ??
  Deno.env.get('STRIPE_PRICE_ALACARTE') ??
  'price_1UAnUXKHxfBbZQd8n1UfrIkI'; // LIVE — a consumo 5€ (prod_VB9oCAZRUAgjEp)

/** Verifica l'header `stripe-signature` (t=<timestamp>,v1=<hmac hex>). */
async function verificaFirma(body: string, signatureHeader: string): Promise<boolean> {
  if (!STRIPE_WEBHOOK_SECRET || !signatureHeader) return false;
  const coppie = new Map(
    signatureHeader
      .split(',')
      .map((p) => p.trim().split('='))
      .filter(([k]) => k === 't' || k === 'v1')
      .map(([k, v]) => [k, v]),
  );
  const t = coppie.get('t');
  const v1 = coppie.get('v1');
  if (!t || !v1) return false;

  try {
    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(STRIPE_WEBHOOK_SECRET),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign'],
    );
    const mac = await crypto.subtle.sign(
      'HMAC',
      key,
      new TextEncoder().encode(`${t}.${body}`),
    );
    const hex = [...new Uint8Array(mac)].map((b) => b.toString(16).padStart(2, '0')).join('');
    return hex === v1;
  } catch {
    return false;
  }
}

async function aggiornaProfilo(userId: string, campi: Record<string, unknown>): Promise<boolean> {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/profiles?id=eq.${encodeURIComponent(userId)}`,
    {
      method: 'PATCH',
      headers: {
        apikey: SUPABASE_SERVICE_ROLE,
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify(campi),
    },
  );
  return res.ok;
}

/** Incrementa i crediti via RPC (PostgREST non supporta { inc } sulle colonne integer). */
async function incrementaCrediti(userId: string, delta: number): Promise<boolean> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/incrementa_crediti_utente`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_SERVICE_ROLE,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ p_user_id: userId, p_delta: delta }),
  });
  return res.ok;
}

/** Registra la riga referral (sconto applicato + ricompensa del referrer). */
async function registraReferral(
  referrerId: string,
  referredUserId: string,
  discount: number,
  reward: number,
): Promise<boolean> {
  if (!referrerId || referrerId === referredUserId) return false; // niente auto-referral
  const res = await fetch(`${SUPABASE_URL}/rest/v1/referrals`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_SERVICE_ROLE,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      referrer_id: referrerId,
      referred_user_id: referredUserId || null,
      discount_applied: discount,
      reward_amount: reward,
      status: 'completed',
    }),
  });
  return res.ok;
}

/** Converte un timestamp epoch (secondi) in data ISO, o null. */
function epochToIso(epoch: number | null | undefined): string | null {
  if (!epoch) return null;
  return new Date(epoch * 1000).toISOString();
}

/** Mappa un Price ID Stripe al tier canonico (per subscription_tier, Account Bridge). */
function tierDaPriceId(priceId?: string | null): string {
  if (!priceId) return 'pro_annuale';
  if (STRIPE_PRICE_ID_ANNUAL && priceId === STRIPE_PRICE_ID_ANNUAL) return 'pro_annuale';
  if (STRIPE_PRICE_ID_MONTHLY && priceId === STRIPE_PRICE_ID_MONTHLY) return 'pro_mensile';
  if (STRIPE_PRICE_ID_CONSUMO && priceId === STRIPE_PRICE_ID_CONSUMO) return 'a_consumo';
  return 'pro_annuale';
}

serve(async (req: Request) => {
  // 1. Verifica della firma Stripe sul body grezzo
  const raw = await req.text();
  const signature = req.headers.get('stripe-signature') ?? '';
  if (!(await verificaFirma(raw, signature))) {
    return new Response('Forbidden', { status: 401 });
  }

  // 2. Parsing dell'evento
  let evento: {
    type?: string;
    data?: {
      object?: {
        id?: string;
        metadata?: { user_id?: string; promo?: string; promo_referrer?: string };
        mode?: string;
        payment_status?: string;
        status?: string;
        current_period_end?: number | null;
        customer?: string;
        /** Line items della sessione/abbonamento: usati per derivare il tier dal Price ID. */
        items?: { data?: { price?: { id?: string } }[] };
      };
    };
  };
  try {
    evento = JSON.parse(raw);
  } catch {
    return new Response('Bad Request', { status: 400 });
  }

  const type = evento.type ?? '';
  const obj = evento.data?.object ?? {};
  const userId = obj.metadata?.user_id ?? '';
  console.log(`[stripe-webhook] evento=${type} user=${userId.slice(0, 8)}…`);

  // 3. Elaborazione per evento
  switch (type) {
    case 'checkout.session.completed': {
      if (!userId) break;
      if (obj.mode === 'payment' && obj.payment_status === 'paid') {
        // A consumo → +1 credito (via RPC atomica)
        const ok = await incrementaCrediti(userId, 1);
        console.log(`  → crediti +1: ${ok}`);
      } else if (obj.mode === 'subscription') {
        // PRO → piano attivo (scadenza gestita da subscription.*).
        // Account Bridge: imposta anche subscription_tier/status espliciti.
        const tier = tierDaPriceId(obj.items?.data?.[0]?.price?.id);
        const ok = await aggiornaProfilo(userId, {
          piano: 'pro',
          stripe_subscription_id: obj.id ?? null,
          subscription_tier: tier,
          subscription_status: 'active',
        });
        console.log(`  → piano pro (subscription ${obj.id ?? '?'}, tier ${tier}): ${ok}`);
      }

      // Referral: se il checkout usava un codice promo, registra la ricompensa del referrer
      if (obj.metadata?.promo && obj.metadata.promo_referrer && obj.payment_status === 'paid') {
        const ok = await registraReferral(obj.metadata.promo_referrer, userId, 10, 10);
        console.log(`  → referral registrato (${obj.metadata.promo}): ${ok}`);
      }
      break;
    }

    case 'customer.subscription.created':
    case 'customer.subscription.updated': {
      if (!userId) break;
      const attivo = obj.status === 'active' || obj.status === 'trialing';
      const tier = tierDaPriceId(obj.items?.data?.[0]?.price?.id);
      const scadenza = attivo ? epochToIso(obj.current_period_end) : null;
      const ok = await aggiornaProfilo(userId, {
        piano: attivo ? 'pro' : 'base',
        stripe_subscription_id: obj.id ?? null,
        subscription_tier: attivo ? tier : 'base',
        subscription_status: obj.status ?? (attivo ? 'active' : 'inactive'),
        abbonamento_scade_il: scadenza,
        current_period_end: scadenza,
      });
      console.log(
        `  → piano=${attivo ? 'pro' : 'base'} tier=${tier} status=${obj.status ?? '?'} scade=${scadenza}: ${ok}`,
      );
      break;
    }

    case 'customer.subscription.deleted': {
      if (!userId) break;
      const ok = await aggiornaProfilo(userId, {
        piano: 'base',
        stripe_subscription_id: null,
        subscription_tier: 'base',
        subscription_status: 'canceled',
        abbonamento_scade_il: null,
        current_period_end: null,
      });
      console.log(`  → piano base (status=canceled): ${ok}`);
      break;
    }

    default:
      console.log(`  → evento non gestito (${type}), ack.`);
  }

  // Sempre ack per non far ritentare Stripe
  return new Response('ok', { status: 200 });
});

