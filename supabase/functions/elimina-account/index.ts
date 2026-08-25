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

serve(async (req) => {
  const auth = req.headers.get('Authorization') ?? '';
  const token = auth.replace('Bearer ', '').trim();
  if (!token) {
    return new Response(JSON.stringify({ error: 'Non autorizzato' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const jwt = decodeJwt(token);
  const userId = jwt?.sub;
  if (!userId) {
    return new Response(JSON.stringify({ error: 'Token non valido' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const admin = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  const { error } = await admin.auth.admin.deleteUser(userId);
  if (error) {
    console.error('elimina-account:', error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  console.log(`[elimina-account] utente ${userId.slice(0, 8)}… eliminato`);
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
});
