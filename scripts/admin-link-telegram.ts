/**
 * ScuoleRadar.it — Collega un Chat ID Telegram a un profilo (Admin).
 *
 * Perché serve: senza `profiles.telegram_chat_id` il Notifier NON ha un canale
 * Telegram verso cui inviare, quindi l'utente non riceve nulla (anche se il bot
 * è raggiungibile). Questo script collega (o riallinea) il chat ID e verifica
 * che il bot possa scrivere nella chat.
 *
 * Uso:
 *   npx tsx scripts/admin-link-telegram.ts <email> <chatId>            # DRY-RUN (nessuna scrittura)
 *   npx tsx scripts/admin-link-telegram.ts <email> <chatId> --apply    # scrive su profiles
 *   npx tsx scripts/admin-link-telegram.ts <email> <chatId> --apply --test   # + messaggio di prova
 *
 * Richiede in `.env`:
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, TELEGRAM_BOT_TOKEN
 */
import process from 'node:process';
import { createClient } from '@supabase/supabase-js';
import { getTelegramBotToken, inviaMessaggioTelegram } from '../src/lib/telegram.ts';

try {
  process.loadEnvFile();
} catch {
  /* .env opzionale */
}

const URL_ = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? '';
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
if (!URL_ || !KEY) {
  console.error('✗ Credenziali Supabase mancanti (.env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)');
  process.exit(1);
}

const args = process.argv.slice(2);
const APPLY = args.includes('--apply');
const TEST = args.includes('--test');
const positional = args.filter((a) => !a.startsWith('--'));
const email = (positional[0] ?? '').trim().toLowerCase();
const chatId = (positional[1] ?? '').trim();

if (!email || !chatId) {
  console.error('✗ Uso: npx tsx scripts/admin-link-telegram.ts <email> <chatId> [--apply] [--test]');
  process.exit(1);
}

const token = getTelegramBotToken();
const sb = createClient(URL_, KEY, { auth: { persistSession: false } });

console.log(`=== Link Telegram — ${email} ↔ chat ${chatId} — ${APPLY ? 'APPLY' : 'DRY-RUN'} ===`);

// 1) Verifica che il bot possa raggiungere la chat (getChat).
let username = '';
if (token) {
  const res = await fetch(`https://api.telegram.org/bot${token}/getChat?chat_id=${encodeURIComponent(chatId)}`);
  const j = (await res.json()) as { ok?: boolean; description?: string; result?: { username?: string; first_name?: string } };
  if (j.ok) {
    username = j.result?.username ?? '';
    console.log(`✓ Chat raggiungibile: ${j.result?.first_name ?? ''} ${username ? `(@${username})` : ''}`);
  } else {
    console.error(`✗ getChat fallito: ${j.description ?? 'errore'} — l'utente deve aprire il bot e premere Start.`);
    process.exitCode = 1;
  }
} else {
  console.warn('⚠ TELEGRAM_BOT_TOKEN mancante: salto la verifica getChat.');
}

// 2) Profilo target.
const { data: prof, error } = await sb
  .from('profiles')
  .select('id,email,telegram_chat_id,telegram_username,radar_attivo,piano,is_free_forever')
  .eq('email', email)
  .maybeSingle();
if (error || !prof) {
  console.error(`✗ Profilo non trovato per ${email}: ${error?.message ?? 'nessuna riga'}`);
  process.exit(1);
}
console.log(
  `• Profilo: id=${prof.id} — telegram_chat_id attuale=${prof.telegram_chat_id || '-'} ` +
    `radar=${prof.radar_attivo} piano=${prof.is_free_forever ? 'FFE' : prof.piano}`,
);

// 3) Scrittura.
if (!APPLY) {
  console.log(`ℹ DRY-RUN: imposterei telegram_chat_id="${chatId}"${username ? ` e telegram_username="${username}"` : ''} su ${email}.`);
  console.log('  Ripeti con --apply per scrivere.');
} else {
  const patch: Record<string, unknown> = { telegram_chat_id: chatId };
  if (username) patch.telegram_username = username;
  const { error: e2 } = await sb.from('profiles').update(patch).eq('id', prof.id);
  if (e2) {
    console.error(`✗ Aggiornamento non riuscito: ${e2.message}`);
    process.exit(1);
  }
  console.log(`✓ telegram_chat_id aggiornato a "${chatId}" per ${email}.`);
}

// 4) Messaggio di prova (opzionale).
if (TEST) {
  const esito = await inviaMessaggioTelegram(
    chatId,
    '✅ <b>ScuoleRadar</b>: collegamento Telegram verificato. Riceverai qui le tue notifiche personalizzate.',
  );
  console.log(esito.ok ? '✓ Messaggio di prova inviato.' : `✗ Invio di prova fallito: ${esito.error}`);
  if (!esito.ok) process.exitCode = 1;
}
