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
//   checkout.session.completed   → subscription: piano=pro | payment: +crediti
//   customer.subscription.created/updated → piano=pro, scadenza=current_period_end
//   customer.subscription.deleted → piano=base
//
// Secrets richiesti:
//   STRIPE_WEBHOOK_SECRET  (dal pannello Stripe → Webhooks → signing secret)
//
// Deploy:
//   supabase functions deploy webhook --project-ref <ref> --no-verify-jwt
// ============================================================

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';

const STRIPE_WEBHOOK_SECRET = Deno.env.get('STRIPE_WEBHOOK_SECRET') ?? '';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

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
        // PRO → piano attivo (scadenza gestita da subscription.*)
        const ok = await aggiornaProfilo(userId, {
          piano: 'pro',
          stripe_subscription_id: obj.id ?? null,
        });
        console.log(`  → piano pro (subscription ${obj.id ?? '?'}): ${ok}`);
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
      const ok = await aggiornaProfilo(userId, {
        piano: attivo ? 'pro' : 'base',
        stripe_subscription_id: obj.id ?? null,
        abbonamento_scade_il: attivo ? epochToIso(obj.current_period_end) : null,
      });
      console.log(`  → piano=${attivo ? 'pro' : 'base'} scade=${epochToIso(obj.current_period_end)}: ${ok}`);
      break;
    }

    case 'customer.subscription.deleted': {
      if (!userId) break;
      const ok = await aggiornaProfilo(userId, {
        piano: 'base',
        stripe_subscription_id: null,
        abbonamento_scade_il: null,
      });
      console.log(`  → piano base: ${ok}`);
      break;
    }

    default:
      console.log(`  → evento non gestito (${type}), ack.`);
  }

  // Sempre ack per non far ritentare Stripe
  return new Response('ok', { status: 200 });
});

