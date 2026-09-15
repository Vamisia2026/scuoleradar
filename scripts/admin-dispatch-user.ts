/**
 * ScuoleRadar.it — DIGEST immediato per un singolo utente (strumento ADMIN).
 *
 * Invia UN SOLO messaggio (email + Telegram) con TUTTE le opportunità ATTIVE
 * compatibili con il profilo (province + classi) non ancora notificate. Ogni voce
 * include la FONTE ESTERNA e l'EMAIL DI CANDIDATURA della scuola.
 *
 * Dedupe tramite ledger locale + `notifications_log`: una seconda esecuzione non
 * rispedisce le stesse opportunità.
 *
 * Uso:
 *   npx tsx scripts/admin-dispatch-user.ts bartoloansaldi@gmail.com           # DRY-RUN
 *   npx tsx scripts/admin-dispatch-user.ts bartoloansaldi@gmail.com --apply   # invia davvero
 *
 * In alternativa all'email si può passare un UUID utente.
 */
import process from 'node:process';
import { createClient } from '@supabase/supabase-js';
import { inviaDigestGiornaliero } from '../src/lib/notifier.ts';

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
  `=== Digest per ${target} — ${APPLY ? 'APPLY (invio reale)' : 'DRY-RUN (nessun invio)'} ===`,
);

// `forzato: true`: è un'azione manuale dell'admin, non deve rispettare le 18:00.
const esito = await inviaDigestGiornaliero(sb as never, {
  dryRun: !APPLY,
  forzato: true,
  dashboardUrl: process.env.RESEND_DASHBOARD_URL,
  soloUtente: isUuid ? { userId: target } : { email: target },
});

console.log('\n=== RIEPILOGO ===');
console.log(JSON.stringify(esito, null, 2));
if (!APPLY) console.log('(DRY-RUN: nessun invio. Ripeti con --apply per spedire davvero.)');

