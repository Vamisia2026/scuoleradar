// ============================================================
// Edge Function Supabase — Webhook Lemon Squeezy (FASE 6)
//
// Riceve gli eventi di pagamento da Lemon Squeezy e aggiorna il
// piano / i crediti dell'utente nella tabella profiles.
//
// Autenticazione: NESSUNA (--no-verify-jwt) ma protetta da firma
// HMAC-SHA256 (header X-Signature) con LEMONSQUEEZY_WEBHOOK_SECRET.
//
// Eventi gestiti:
//   order_created            → +crediti (se variante A la Carte)
//   subscription_created     → piano = pro, scadenza = renews_at
//   subscription_updated     → aggiorna scadenza/status
//   subscription_cancelled   → mantiene pro fino a ends_at
//   subscription_expired     → piano = base
//
// Secrets richiesti:
//   LS_API_KEY, LS_WEBHOOK_SECRET, LS_VARIANT_ALACARTE
//
// Deploy:
//   supabase functions deploy ls-webhook --project-ref <ref> --no-verify-jwt
// ============================================================

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';

const LS_WEBHOOK_SECRET = Deno.env.get('LS_WEBHOOK_SECRET') ?? '';
const LS_VARIANT_ALACARTE = Deno.env.get('LS_VARIANT_ALACARTE') ?? '';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

/** Verifica la firma HMAC-SHA256 (hex) del body rispetto al secret del webhook. */
async function verificaFirma(body: string, signature: string): Promise<boolean> {
  if (!LS_WEBHOOK_SECRET || !signature) return false;
  try {
    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(LS_WEBHOOK_SECRET),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign'],
    );
    const mac = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(body));
    const hex = [...new Uint8Array(mac)].map((b) => b.toString(16).padStart(2, '0')).join('');
    return hex === signature;
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

serve(async (req: Request) => {
  // 1. Verifica della firma HMAC sul body grezzo
  const raw = await req.text();
  const signature = req.headers.get('x-signature') ?? '';
  if (!(await verificaFirma(raw, signature))) {
    return new Response('Forbidden', { status: 401 });
  }

  // 2. Parsing dell'evento
  let evento: {
    meta?: { event_name?: string; custom_data?: { user_id?: string } };
    data?: {
      id?: string;
      attributes?: {
        status?: string;
        renews_at?: string | null;
        trial_ends_at?: string | null;
        ends_at?: string | null;
        first_order_item?: { variant_id?: string; quantity?: number };
      };
    };
  };
  try {
    evento = JSON.parse(raw);
  } catch {
    return new Response('Bad Request', { status: 400 });
  }

  const eventName = evento.meta?.event_name ?? '';
  const userId = evento.meta?.custom_data?.user_id ?? '';
  const attrs = evento.data?.attributes ?? {};

  console.log(`[ls-webhook] evento=${eventName} user=${userId.slice(0, 8)}…`);

  // 3. Elaborazione per evento
  switch (eventName) {
    case 'order_created': {
      if (!userId) break;
      // Ordine A la Carte → somma i crediti acquistati
      const variant = attrs.first_order_item?.variant_id;
      const quantity = attrs.first_order_item?.quantity ?? 1;
      if (variant === LS_VARIANT_ALACARTE) {
        const ok = await aggiornaProfilo(userId, {
          crediti: { inc: quantity },
        } as unknown as Record<string, unknown>);
        console.log(`  → crediti +${quantity}: ${ok}`);
      }
      break;
    }

    case 'subscription_created':
    case 'subscription_updated': {
      if (!userId) break;
      const scade = attrs.renews_at ?? attrs.trial_ends_at ?? null;
      const attivo = attrs.status === 'active' || attrs.status === 'on_trial';
      const ok = await aggiornaProfilo(userId, {
        piano: attivo ? 'pro' : 'base',
        ls_subscription_id: evento.data?.id ?? null,
        abbonamento_scade_il: attivo ? scade : null,
      });
      console.log(`  → piano=${attivo ? 'pro' : 'base'} scade=${scade}: ${ok}`);
      break;
    }

    case 'subscription_cancelled': {
      if (!userId) break;
      // Mantiene i privilegi fino alla fine del periodo (ends_at)
      const ok = await aggiornaProfilo(userId, {
        abbonamento_scade_il: attrs.ends_at ?? null,
      });
      console.log(`  → cancellato, scadenza=${attrs.ends_at}: ${ok}`);
      break;
    }

    case 'subscription_expired': {
      if (!userId) break;
      const ok = await aggiornaProfilo(userId, {
        piano: 'base',
        ls_subscription_id: null,
        abbonamento_scade_il: null,
      });
      console.log(`  → piano base: ${ok}`);
      break;
    }

    default:
      console.log(`  → evento non gestito (${eventName}), ack.`);
  }

  // Sempre ack per non far ritentare Lemon Squeezy
  return new Response('ok', { status: 200 });
});

