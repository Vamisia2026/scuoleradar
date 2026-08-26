// ============================================================
// Edge Function Supabase — Eliminazione account (cancellazione definitiva)
//
// Elimina l'utente autenticato da Supabase Auth con il service role.
// Le righe collegate (profiles, referrals) vengono rimosse in cascata
// dalle FK (ON DELETE CASCADE).
//
// Autenticazione: --verify-jwt (solo utenti loggati).
// Deploy:
//   supabase functions deploy elimina-account --project-ref <ref>
// ============================================================

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';

/** Decodifica il payload (base64url) di un JWT (la firma è verificata dal runtime con --verify-jwt). */
function decodeJwt(token: string): { sub?: string } | null {
  try {
    const payload = token.split('.')[1];
    const json = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
    return JSON.parse(json) as { sub?: string };
  } catch {
    return null;
  }
}

/** Header CORS per richieste dal browser. */
const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function risposta(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
  });
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }
  if (req.method !== 'POST') {
    return risposta({ error: 'Metodo non consentito' }, 405);
  }

  try {
    const auth = req.headers.get('Authorization') ?? '';
    const token = auth.replace('Bearer ', '').trim();
    if (!token) {
      return risposta({ error: 'Non autorizzato' }, 401);
    }

    const jwt = decodeJwt(token);
    const userId = jwt?.sub;
    if (!userId) {
      return risposta({ error: 'Token non valido' }, 401);
    }

    const admin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } },
    );

    const { error } = await admin.auth.admin.deleteUser(userId);
    if (error) {
      console.error('elimina-account:', error.message);
      return risposta({ error: error.message }, 500);
    }

    console.log(`[elimina-account] utente ${userId.slice(0, 8)}… eliminato`);
    return risposta({ ok: true });
  } catch (err) {
    console.error('elimina-account — errore non gestito:', err);
    return risposta({ error: 'Errore interno nella cancellazione dell account' }, 500);
  }
});
