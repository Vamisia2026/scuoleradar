// ============================================================
// Edge Function Supabase — Checkout Lemon Squeezy (FASE 6)
//
// Crea una sessione di checkout per il piano richiesto e ritorna
// l'URL a cui redirigere il browser dell'utente.
//
// Autenticazione: --verify-jwt (deve essere un utente loggato).
// Body: { "plan": "pro_annuale" | "pro_mensile" | "alacarte" }
//
// Secrets richiesti:
//   LS_API_KEY               (obbligatoria)
//   LS_VARIANT_PRO_ANNUALE   (id variante PRO annuale)
//   LS_VARIANT_PRO_MENSILE   (id variante PRO mensile)
//   LS_VARIANT_ALACARTE      (id variante A la Carte / sblocco)
//
// Deploy:
//   supabase functions deploy ls-checkout --project-ref <ref> --verify-jwt
// ============================================================

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';

const LS_API_KEY = Deno.env.get('LS_API_KEY') ?? '';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

const LS_VARIANT_IDS: Record<string, string> = {
  pro_annuale: Deno.env.get('LS_VARIANT_PRO_ANNUALE') ?? '',
  pro_mensile: Deno.env.get('LS_VARIANT_PRO_MENSILE') ?? '',
  alacarte: Deno.env.get('LS_VARIANT_ALACARTE') ?? '',
};

type Piano = keyof typeof LS_VARIANT_IDS;

const API_BASE = 'https://api.lemonsqueezy.com/v1';

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

async function leggiProfilo(
  userId: string,
): Promise<{ email?: string; ls_customer_id?: string } | null> {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/profiles?id=eq.${encodeURIComponent(userId)}`,
    {
      headers: {
        apikey: SUPABASE_SERVICE_ROLE,
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE}`,
      },
    },
  );
  if (!res.ok) return null;
  const righe = (await res.json()) as Array<{ email?: string; ls_customer_id?: string | null }>;
  return righe[0] ?? null;
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

async function creaCustomerLS(nome: string, email: string): Promise<string | null> {
  const res = await fetch(`${API_BASE}/customers`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${LS_API_KEY}`,
      'Content-Type': 'application/vnd.api+json',
      Accept: 'application/vnd.api+json',
    },
    body: JSON.stringify({
      data: { type: 'customers', attributes: { name: nome, email } },
    }),
  });
  if (!res.ok) {
    console.error('LS creaCustomer fallito:', res.status, await res.text());
    return null;
  }
  const body = (await res.json()) as { data?: { id?: string } };
  return body.data?.id ?? null;
}

async function creaCheckoutLS(
  variantId: string,
  email: string,
  userId: string,
): Promise<string | null> {
  const res = await fetch(`${API_BASE}/checkouts`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${LS_API_KEY}`,
      'Content-Type': 'application/vnd.api+json',
      Accept: 'application/vnd.api+json',
    },
    body: JSON.stringify({
      data: {
        type: 'checkouts',
        attributes: {
          checkout_data: { email, custom: { user_id: userId } },
          checkout_options: { embed: false },
        },
        relationships: {
          variant: { data: { type: 'variants', id: variantId } },
        },
      },
    }),
  });
  if (!res.ok) {
    console.error('LS creaCheckout fallito:', res.status, await res.text());
    return null;
  }
  const body = (await res.json()) as { data?: { attributes?: { url?: string } } };
  return body.data?.attributes?.url ?? null;
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

  let body: { plan?: string };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Body JSON non valido' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const plan = (body.plan ?? '') as Piano;
  const variantId = LS_VARIANT_IDS[plan];
  if (!variantId) {
    return new Response(JSON.stringify({ error: `Piano non valido: ${plan}` }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Profilo utente (email + eventuale customer già associato)
  const profilo = await leggiProfilo(userId);
  const email = profilo?.email ?? jwt?.email ?? '';
  if (!email) {
    return new Response(JSON.stringify({ error: 'Email utente non trovata' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Crea/recupera il customer Lemon Squeezy
  let customerId = profilo?.ls_customer_id ?? null;
  if (!customerId) {
    customerId = await creaCustomerLS(email.split('@')[0] ?? 'Utente', email);
    if (!customerId) {
      return new Response(JSON.stringify({ error: 'Impossibile creare il customer LS' }), {
        status: 502,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    await aggiornaProfilo(userId, { ls_customer_id: customerId });
  }

  // Crea la sessione di checkout e ritorna l'URL
  const url = await creaCheckoutLS(variantId, email, userId);
  if (!url) {
    return new Response(JSON.stringify({ error: 'Impossibile creare il checkout LS' }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({ url }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
});

