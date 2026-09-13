/**
 * ScuoleRadar.it — Dispatch IMMEDIATO delle notifiche per un singolo utente.
 *
 * Notifica OGNI interpello ATTIVO compatibile con il profilo (province + classi),
 * anche se già presente in bacheca ma mai notificato. Ogni notifica (email +
 * Telegram) include l'EMAIL DI CANDIDATURA dell'avviso.
 *
 * Dedupe tramite `notifications_log` (migrazione 20260914010000): una seconda
 * esecuzione non rispedisce le stesse segnalazioni.
 *
 * Uso:
 *   npx tsx scripts/admin-dispatch-user.ts bartoloansaldi@gmail.com           # DRY-RUN (nessun invio)
 *   npx tsx scripts/admin-dispatch-user.ts bartoloansaldi@gmail.com --apply   # invia davvero
 *
 * In alternativa all'email si può passare un UUID utente.
 */
import process from 'node:process';
import { createClient } from '@supabase/supabase-js';
import { notificaInterpelliPerUtente } from '../src/lib/notifier.ts';

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

const APPLY = process.argv.includes('--apply');
const target = process.argv.slice(2).find((a) => !a.startsWith('--')) ?? '';
if (!target) {
  console.error('✗ Specifica un\'email o un UUID utente.');
  console.error('  Es: npx tsx scripts/admin-dispatch-user.ts bartoloansaldi@gmail.com --apply');
  process.exit(1);
}

const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(target);
const sb = createClient(URL_, KEY, { auth: { persistSession: false } });

console.log(
  `=== Dispatch notifiche per ${target} — ${APPLY ? 'APPLY (invio reale)' : 'DRY-RUN (nessun invio)'} ===`,
);

const esito = await notificaInterpelliPerUtente(
  sb as never,
  isUuid ? { userId: target } : { email: target },
  { dryRun: !APPLY, dashboardUrl: process.env.RESEND_DASHBOARD_URL },
);

console.log('\n=== RIEPILOGO ===');
console.log(JSON.stringify(esito, null, 2));
if (!APPLY) console.log('(DRY-RUN: nessun invio. Ripeti con --apply per spedire davvero.)');
