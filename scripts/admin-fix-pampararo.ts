/**
 * ScuoleRadar.it — Cleanup account "Giuseppe Pampararo" (Admin).
 *
 * Obiettivi:
 *  1. STANDARDIZZARE la grafia del cognome a "Pampararo" (rimuove "Pampanaro")
 *     sia su `profiles` sia sul metadata di `auth.users`.
 *  2. Eliminare gli account DUPLICATI/ERRATI creati con le email sbagliate
 *     (`*pampanaro*`) SOLO quando NON hanno Radar attivo né registrazione valida.
 *  3. PRESERVARE i due account corretti:
 *       · g.pampararo@gmail.com                (Gmail personale)
 *       · pampararo.giuseppe@itisartom.edu.it  (istituzionale ITIS "A. Artom", Asti)
 *
 * SICUREZZA: DRY-RUN di default. Passa `--apply` per scrivere davvero.
 * L'eliminazione avviene via `auth.admin.deleteUser` (cascade su `profiles`).
 *
 *   npx tsx scripts/admin-fix-pampararo.ts            # report
 *   npx tsx scripts/admin-fix-pampararo.ts --apply    # applica
 */
import process from 'node:process';
import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js';

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
const sb: SupabaseClient = createClient(URL_, KEY, { auth: { persistSession: false } });

/** Grafia canonica del cognome. */
const COGNOME_CANONICO = 'Pampararo';
/** Account corretti da NON toccare. */
const EMAIL_KEEPERS = ['g.pampararo@gmail.com', 'pampararo.giuseppe@itisartom.edu.it'];
/** Rileva la variante errata in qualsiasi campo (email/cognome/full_name). */
const CONTIENE_VARIANTE = /pampanaro/i;

type Riga = Record<string, unknown>;
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const presente = (v: unknown): boolean => String(v ?? '').trim() !== '';
const log = (ok: boolean, msg: string): void => console.log(`${ok ? '✓' : '•'} ${msg}`);

/** Elenca TUTTI gli utenti di auth.users (paginazione a blocchi di 1000). */
async function listAllAuthUsers(): Promise<User[]> {
  const out: User[] = [];
  for (let page = 1; ; page += 1) {
    const { data, error } = await sb.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    out.push(...data.users);
    if (data.users.length < 1000) break;
  }
  return out;
}

function metaContieneVariante(m: Record<string, unknown>): boolean {
  return ['cognome', 'nome', 'full_name', 'name'].some((k) => CONTIENE_VARIANTE.test(String(m[k] ?? '')));
}

function metaNormalizzato(m: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = { ...m };
  for (const k of ['cognome', 'nome', 'full_name', 'name']) {
    const v = String(out[k] ?? '');
    if (v) out[k] = v.replace(/pampanaro/gi, 'Pampararo');
  }
  return out;
}

/** True se la riga ha Radar attivo o segnali di registrazione VALIDA (da preservare). */
function daPreservare(p: Riga | null, u: User): boolean {
  if (u.last_sign_in_at) return true; // l'utente ha effettuato almeno un accesso
  if (!p) return false;
  return (
    p.radar_attivo === true ||
    p.onboarded === true ||
    p.is_beta_tester === true ||
    p.is_free_forever === true ||
    p.piano === 'free_forever' ||
    arr(p.classi_concorso).length > 0 ||
    arr(p.province_interesse).length > 0 ||
    arr(p.province_attive).length > 0 ||
    arr(p.materie_id).length > 0 ||
    presente(p.telegram_chat_id) ||
    presente(p.stripe_customer_id) ||
    presente(p.stripe_subscription_id)
  );
}

/* ------------------------------- STEP A — profiles ------------------------------- */

async function stepCognomeProfiles(): Promise<number> {
  console.log('\n── STEP A — Grafia cognome su profiles ──');
  const { data, error } = await sb.from('profiles').select('id,email,cognome');
  if (error) {
    console.error('✗ lettura profiles:', error.message);
    return 0;
  }
  const daCorreggere = (data ?? []).filter((r) => {
    const c = String(r.cognome ?? '');
    if (!c) return false;
    if (CONTIENE_VARIANTE.test(c)) return true; // variante errata "Pampanaro"
    return c !== COGNOME_CANONICO && c.toLowerCase() === 'pampararo'; // grafia non canonica
  });
  let n = 0;
  for (const r of daCorreggere) {
    console.log(`  → ${r.email}: cognome "${r.cognome}" → "${COGNOME_CANONICO}"`);
    if (APPLY) {
      const { error: e } = await sb.from('profiles').update({ cognome: COGNOME_CANONICO }).eq('id', r.id);
      if (e) {
        console.log(`     ✗ ${e.message}`);
        continue;
      }
    }
    n += 1;
  }
  console.log(`  ${APPLY ? 'Aggiornati' : 'Da aggiornare'}: ${n} profili.`);
  return n;
}

/* ------------------------- STEP B — auth.users metadata ------------------------- */

async function stepCognomeAuth(users: User[]): Promise<number> {
  console.log('\n── STEP B — Grafia cognome su auth.users (metadata) ──');
  const da = users.filter((u) => metaContieneVariante((u.user_metadata ?? {}) as Record<string, unknown>));
  let n = 0;
  for (const u of da) {
    console.log(`  → ${u.email}: metadata → cognome "${COGNOME_CANONICO}"`);
    if (APPLY) {
      const { error } = await sb.auth.admin.updateUserById(u.id, {
        user_metadata: metaNormalizzato((u.user_metadata ?? {}) as Record<string, unknown>),
      });
      if (error) {
        console.log(`     ✗ ${error.message}`);
        continue;
      }
    }
    n += 1;
  }
  console.log(`  ${APPLY ? 'Aggiornati' : 'Da aggiornare'}: ${n} utenti auth.`);
  return n;
}

/* ----------------------- STEP C — potatura account errati ----------------------- */

async function stepPurgeErrati(users: User[]): Promise<number> {
  console.log('\n── STEP C — Potatura account errati (*pampanaro*) ──');
  const errati = users.filter((u) => {
    const em = String(u.email ?? '').toLowerCase();
    return CONTIENE_VARIANTE.test(em) && !EMAIL_KEEPERS.includes(em);
  });
  if (errati.length === 0) {
    console.log('  ✓ Nessun account errato presente.');
    return 0;
  }
  let eliminati = 0;
  let preservati = 0;
  for (const u of errati) {
    const { data: p } = await sb.from('profiles').select('*').eq('id', u.id).maybeSingle();
    const riga = (p ?? null) as Riga | null;
    if (daPreservare(riga, u)) {
      log(false, `PRESERVATO (Radar/registrazione valida): ${u.email} id=${u.id}`);
      preservati += 1;
      continue;
    }
    console.log(`  🗑️  da eliminare (vuoto/errato): ${u.email} id=${u.id}`);
    if (APPLY) {
      const { error } = await sb.auth.admin.deleteUser(u.id);
      if (error) {
        console.log(`     ✗ ${error.message}`);
        continue;
      }
    }
    eliminati += 1;
  }
  console.log(
    `  ${APPLY ? 'Eliminati' : 'Da eliminare'}: ${eliminati} account errati · preservati: ${preservati}.`,
  );
  return eliminati;
}

/* -------------------------- STEP D — controllo keeper -------------------------- */

async function stepKeeper(users: User[]): Promise<void> {
  console.log('\n── STEP D — Account corretti da preservare ──');
  for (const email of EMAIL_KEEPERS) {
    const u = users.find((x) => String(x.email ?? '').toLowerCase() === email);
    if (!u) {
      log(false, `MANCANTE in auth.users: ${email}`);
      continue;
    }
    const { data: p } = await sb
      .from('profiles')
      .select('cognome,piano,radar_attivo,onboarded')
      .eq('id', u.id)
      .maybeSingle();
    log(
      true,
      `${email} → id=${u.id} cognome="${p?.cognome ?? '?'}" piano=${p?.piano ?? '?'} ` +
        `radar=${p?.radar_attivo ?? '?'} onboarded=${p?.onboarded ?? '?'}`,
    );
  }
}

async function main(): Promise<void> {
  console.log(`=== Cleanup "Giuseppe Pampararo" — ${APPLY ? 'APPLY (scrittura)' : 'DRY-RUN (nessuna scrittura)'} ===`);
  const users = await listAllAuthUsers();
  console.log(`Utenti auth totali: ${users.length}`);

  const a = await stepCognomeProfiles();
  const b = await stepCognomeAuth(users);
  const c = await stepPurgeErrati(users);
  await stepKeeper(users);

  console.log('\n=== RIEPILOGO ===');
  console.log(`  Cognomi normalizzati — profiles: ${a} · auth: ${b} · account errati rimossi: ${c}`);
  if (!APPLY) console.log('  (DRY-RUN: nessuna scrittura. Ripeti con --apply per applicare.)');
}

main().catch((e) => {
  console.error('✗', e);
  process.exit(1);
});

