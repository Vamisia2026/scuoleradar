// ============================================================
// Edge Function Supabase — Telegram Login
//
// Riceve i dati del Telegram Login Widget e:
//   1. VALIDA la firma: HMAC-SHA256(data_check_string, SHA256(BOT_TOKEN))
//   2. CERCA un profilo esistente per telegram_chat_id / telegram_username
//   3. SE TROVATO → imposta una password temporanea sull'utente auth esistente
//   4. SE ASSENTE → crea l'utente auth + profilo con login_type = 'telegram'
//   5. RITORNA { email, password } → il client completa signInWithPassword.
//
// Secrets: TELEGRAM_BOT_TOKEN, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.
// Deploy: supabase functions deploy telegram-login --project-ref <ref> --no-verify-jwt
// ============================================================

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const BOT_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN') ?? '';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const risposta = (data: unknown, status = 200): Response =>
  new Response(JSON.stringify(data), { status, headers: CORS });

/* ------------------------- Validazione firma ------------------------- */

function hex(bytes: Uint8Array): string {
  return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function hexToBytes(esadecimale: string): Uint8Array {
  const out = new Uint8Array(esadecimale.length / 2);
  for (let i = 0; i < out.length; i += 1) {
    out[i] = parseInt(esadecimale.substr(i * 2, 2), 16);
  }
  return out;
}

async function digestSha256(contenuto: string): Promise<Uint8Array> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(contenuto));
  return new Uint8Array(digest);
}

async function hmacSha256(segreto: Uint8Array, messaggio: string): Promise<Uint8Array> {
  const chiave = await crypto.subtle.importKey(
    'raw',
    segreto as BufferSource,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const firma = await crypto.subtle.sign('HMAC', chiave, new TextEncoder().encode(messaggio));
  return new Uint8Array(firma);
}

function confrontoCostante(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let differenza = 0;
  for (let i = 0; i < a.length; i += 1) differenza |= a[i] ^ b[i];
  return differenza === 0;
}

/** Validazione secondo le specifiche Telegram Login. */
async function validaDatiTelegram(dati: Record<string, unknown>): Promise<boolean> {
  if (!BOT_TOKEN) return false;
  const hash = typeof dati.hash === 'string' ? dati.hash : '';
  const authDate = Number(dati.auth_date ?? NaN);
  const id = Number(dati.id ?? NaN);
  if (!hash || !Number.isInteger(authDate) || !Number.isInteger(id)) return false;
  // Dato fresco: max 24 ore.
  if (Math.abs(Math.floor(Date.now() / 1000) - authDate) > 86_400) return false;

  const campi = Object.entries(dati)
    .filter(([chiave]) => chiave !== 'hash')
    .sort(([a], [b]) => a.localeCompare(b));
  const dataString = campi.map(([chiave, valore]) => `${chiave}=${valore}`).join('\n');

  const segreto = await digestSha256(BOT_TOKEN);
  const firma = await hmacSha256(segreto, dataString);
  const attesa = hexToBytes(hash);
  return confrontoCostante(firma, attesa);
}

/* ---------------------- Supporto profilo (resiliente) ---------------------- */

function filtraSuRiga(
  payload: Record<string, unknown>,
  riga: Record<string, unknown> | null,
): Record<string, unknown> {
  const chiavi = riga ? Object.keys(riga) : ['id', 'email', 'nome', 'cognome', 'piano', 'onboarded', 'is_beta_tester'];
  const pulito: Record<string, unknown> = {};
  for (const k of Object.keys(payload)) if (chiavi.includes(k)) pulito[k] = payload[k];
  return pulito;
}

function passwordTemporanea(): string {
  const alfabeto = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  const bytes = crypto.getRandomValues(new Uint8Array(28));
  return [...bytes].map((b) => alfabeto[b % alfabeto.length]).join('');
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  if (req.method !== 'POST') return risposta({ error: 'Metodo non consentito' }, 405);

  let corpo: Record<string, unknown>;
  try {
    corpo = await req.json();
  } catch {
    return risposta({ error: 'Bad Request' }, 400);
  }

  const dati = (corpo.auth_data ?? {}) as Record<string, unknown>;
  if (!(await validaDatiTelegram(dati))) {
    return risposta({ error: 'Firma Telegram non valida o dati scaduti' }, 401);
  }

  const telegramId = String(dati.id ?? '');
  const nome = String(dati.first_name ?? '').trim();
  const cognome = String(dati.last_name ?? '').trim();
  const username = String(dati.username ?? '').replace(/^@/, '').trim();
  const handle = username ? `@${username}` : null;

  const sb = createClient(SUPABASE_URL, SERVICE_ROLE);
  const password = passwordTemporanea();

  // Ricerca account esistente: telegram_chat_id = user id oppure handle.
  const ricerca: string[] = [`telegram_chat_id.eq.${telegramId}`];
  if (handle) ricerca.push(`telegram_username.eq.${handle}`);
  const { data: profili, error: errCerca } = await sb
    .from('profiles')
    .select('*')
    .or(ricerca.join(','))
    .limit(1);

  if (errCerca) return risposta({ error: errCerca.message }, 500);

  const esistente =
    profili && profili.length > 0 ? (profili[0] as Record<string, unknown>) : null;

  let email = '';
  let userId = '';
  if (esistente) {
    userId = String(esistente.id ?? '');
    email = String(esistente.email ?? '');
    const { error: errPass } = await sb.auth.admin.updateUserById(userId, { password });
    if (errPass) return risposta({ error: errPass.message }, 500);

    const aggiornamenti: Record<string, unknown> = { login_type: 'telegram' };
    if (handle && !esistente.telegram_username) aggiornamenti.telegram_username = handle;
    if (!esistente.telegram_chat_id) aggiornamenti.telegram_chat_id = telegramId;
    const puliti = filtraSuRiga(aggiornamenti, esistente);
    if (Object.keys(puliti).length > 0) {
      const { error: errAgg } = await sb.from('profiles').update(puliti).eq('id', userId);
      if (errAgg) return risposta({ error: errAgg.message }, 500);
    }
  } else {
    email = `tg_${telegramId}@telegram.scuoleradar.it`;
    const { data: creato, error: errCrea } = await sb.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        nome,
        cognome,
        provider: 'telegram',
        telegram_id: telegramId,
        force_password_change: true,
      },
    });
    if (errCrea) return risposta({ error: errCrea.message }, 500);
    if (!creato?.user) return risposta({ error: 'Creazione utente fallita' }, 500);
    userId = creato.user.id;

    const { data: campione } = await sb.from('profiles').select('*').limit(1);
    const rigaEsempio =
      campione && campione.length > 0 ? (campione[0] as Record<string, unknown>) : null;
    const profilo = filtraSuRiga(
      {
        id: userId,
        email,
        nome,
        cognome,
        telegram_username: handle,
        telegram_chat_id: telegramId,
        login_type: 'telegram',
        onboarded: false,
      },
      rigaEsempio,
    );
    const { error: errProf } = await sb.from('profiles').upsert(profilo, { onConflict: 'id' });
    if (errProf) return risposta({ error: errProf.message }, 500);
  }

  return risposta({
    ok: true,
    email,
    password,
    nuovo: !esistente,
    telegram_id: telegramId,
  });
});
