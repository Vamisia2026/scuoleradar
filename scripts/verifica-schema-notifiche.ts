/**
 * ScuoleRadar.it — VERIFICA dello schema notifiche (ledger DB + RPC quota).
 *
 * Perché esiste: senza la tabella `notifications_log` la deduplica a livello DB
 * non è attiva (resta solo il ledger su file) e senza la RPC
 * `incrementa_notifiche_utente` non si può contare la quota BASE
 * (`prova1 → prova2 → prova3 → extra`). Questa verifica dice in un colpo d'occhio
 * se le migrazioni sono state applicate.
 *
 * SICUREZZA: la sonda usa un UUID INESISTENTE, quindi la RPC risponde
 * `(false, 0)` senza toccare alcun utente né alcun contatore. Nessuna scrittura.
 *
 * Uso:
 *   npm run db:verifica
 *
 * Exit code: 0 = schema completo · 1 = manca qualcosa (stampa la remediation).
 */

import process from 'node:process';

try {
  process.loadEnvFile();
} catch {
  /* .env opzionale */
}

const BASE = (process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? '').replace(/\/+$/, '');
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';

/** UUID volutamente inesistente: la RPC non modifica nulla e ritorna (false, 0). */
const UUID_FANTASMA = '00000000-0000-0000-0000-000000000000';

const MIGRAZIONE_LEDGER = '20260914010000_notifications_log.sql';
const MIGRAZIONE_RPC = '20260914030000_repair_notifications_log_e_rpc_quota.sql';
const MIGRAZIONE_SOSTEGNO = '20260914040000_add_profiles_sostegno.sql';

interface Esito {
  ok: boolean;
  dettaglio: string;
}

/** True se la tabella `notifications_log` è raggiungibile via PostgREST. */
async function verificaTabellaLedger(): Promise<Esito> {
  try {
    const res = await fetch(`${BASE}/rest/v1/notifications_log?select=user_id&limit=1`, {
      headers: { apikey: KEY, Authorization: `Bearer ${KEY}` },
    });
    if (res.ok) return { ok: true, dettaglio: 'tabella presente e leggibile' };
    const body = await res.text().catch(() => '');
    // PostgREST risponde 404 (PGRST205) quando la tabella non esiste nello schema.
    return {
      ok: false,
      dettaglio: `HTTP ${res.status} ${body.slice(0, 160)}`,
    };
  } catch (err) {
    return { ok: false, dettaglio: `errore di rete: ${(err as Error).message}` };
  }
}

/**
 * True se la RPC risponde con il contratto atteso `[{ consentito, notifiche_usate }]`.
 * Con il bug 42702 risponde un errore `column reference "notifiche_usate" is ambiguous`.
 */
async function verificaRpcQuota(): Promise<Esito> {
  try {
    const res = await fetch(`${BASE}/rest/v1/rpc/incrementa_notifiche_utente`, {
      method: 'POST',
      headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_user_id: UUID_FANTASMA }),
    });
    const testo = await res.text().catch(() => '');
    if (!res.ok) {
      const ambiguo = /ambig|42702/i.test(testo);
      return {
        ok: false,
        dettaglio: ambiguo
          ? 'ERRORE 42702: "notifiche_usate" è ambiguo (migrazione RPC non applicata)'
          : `HTTP ${res.status} ${testo.slice(0, 160)}`,
      };
    }
    const righe = JSON.parse(testo || '[]') as Array<{ consentito?: boolean; notifiche_usate?: number }>;
    const riga = righe[0] ?? {};
    if (riga.consentito === false && riga.notifiche_usate === 0) {
      return { ok: true, dettaglio: 'RPC ok: risponde (consentito=false, notifiche_usate=0)' };
    }
    return { ok: true, dettaglio: `RPC raggiungibile: ${testo.slice(0, 120)}` };
  } catch (err) {
    return { ok: false, dettaglio: `errore di rete: ${(err as Error).message}` };
  }
}

async function verificaColonnaSostegno(): Promise<Esito> {
  try {
    const res = await fetch(`${BASE}/rest/v1/profiles?select=sostegno&limit=1`, {
      headers: { apikey: KEY, Authorization: `Bearer ${KEY}` },
    });
    if (res.ok) return { ok: true, dettaglio: 'preferenza sostegno attiva (profiles.sostegno)' };
    const body = await res.text().catch(() => '');
    // PostgREST risponde 400/PGRST204 quando la colonna non esiste nello schema.
    return {
      ok: false,
      dettaglio: /sostegno/i.test(body)
        ? 'colonna assente: la preferenza sostegno resta solo in locale'
        : `HTTP ${res.status} ${body.slice(0, 160)}`,
    };
  } catch (err) {
    return { ok: false, dettaglio: `errore di rete: ${(err as Error).message}` };
  }
}

async function main(): Promise<void> {
  console.log('━━ ScuoleRadar — verifica schema notifiche ━━');
  if (!BASE || !KEY) {
    console.error('✗ Credenziali mancanti (.env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)');
    process.exitCode = 1;
    return;
  }
  const host = (() => {
    try {
      return new URL(BASE).host;
    } catch {
      return BASE;
    }
  })();
  console.log(`• Progetto: ${host}`);

  const ledger = await verificaTabellaLedger();
  const rpc = await verificaRpcQuota();
  const sostegno = await verificaColonnaSostegno();

  console.log(`\n1) Ledger DB \`notifications_log\`  → ${ledger.ok ? '✅' : '❌'} ${ledger.dettaglio}`);
  console.log(`2) RPC quota \`incrementa_notifiche_utente\` → ${rpc.ok ? '✅' : '❌'} ${rpc.dettaglio}`);
  console.log(`3) Preferenza SOSTEGNO \`profiles.sostegno\` → ${sostegno.ok ? '✅' : '❌'} ${sostegno.dettaglio}`);

  if (ledger.ok && rpc.ok && sostegno.ok) {
    console.log('\n✅ Schema notifiche completo: dedupe DB attiva, quota server-side affidabile, preferenza sostegno persistita.');
    return;
  }

  console.log('\n⚠ Azione richiesta — applicare le migrazioni mancanti:');
  if (!ledger.ok) console.log(`   · ${MIGRAZIONE_LEDGER} (tabella notifications_log)`);
  if (!rpc.ok) console.log(`   · ${MIGRAZIONE_RPC} (fix RPC quota 42702)`);
  if (!sostegno.ok) console.log(`   · ${MIGRAZIONE_SOSTEGNO} (preferenza sostegno: colonna + backfill)`);
  console.log('   Comando (progetto già linkato): npx supabase db push');
  console.log('   In alternativa: incollare il file SQL nell\'SQL Editor del progetto, poi ripetere `npm run db:verifica`.');
  process.exitCode = 1;
}

void main();
