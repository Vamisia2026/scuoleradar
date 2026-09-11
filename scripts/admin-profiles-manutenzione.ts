/**
 * ScuoleRadar.it — Manutenzione profili (Admin): FFE + dedupe + igiene.
 *
 * OPERAZIONI (idempotenti):
 *  A. Imposta a `free_forever` (FFE) i profili indicati, PRESERVANDO la
 *     configurazione Radar (classi/province/materie), radar_attivo, beta, ecc.
 *  B. Dedupe per email: se esistono più righe `profiles` con la STESSA email,
 *     mantiene la riga "valida/attiva" ed elimina SOLO le righe vuote/fantoccia.
 *     Non elimina MAI la riga con la configurazione Radar attiva.
 *  C. Igiene: segnala i profili orfani (id assente in auth.users).
 *
 * SICUREZZA: DRY-RUN di default. Usa `--apply` per scrivere davvero.
 *
 *   npx tsx scripts/admin-profiles-manutenzione.ts          # solo report
 *   npx tsx scripts/admin-profiles-manutenzione.ts --apply  # applica
 */
import process from 'node:process';
import { createClient } from '@supabase/supabase-js';

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
const sb = createClient(URL_, KEY, { auth: { persistSession: false } });

/** Email da portare a Free Forever (piano PRO gratuito a vita). */
const EMAIL_FFE = ['g.pampararo@gmail.com', 'pampararo.giuseppe@itisartom.edu.it'];

const CAMPI = [
  'id', 'email', 'nome', 'cognome', 'piano', 'is_free_forever', 'is_beta_tester',
  'radar_attivo', 'onboarded', 'classi_concorso', 'materie_id', 'materie_custom',
  'province_attive', 'province_interesse', 'favorite_schools', 'ignored_schools',
  'telegram_chat_id', 'stripe_customer_id', 'stripe_subscription_id',
  'abbonamento_scade_il', 'subscription_status', 'subscription_tier', 'scadenza_avviso_stadio',
  'created_at', 'updated_at',
].join(',');

type Riga = Record<string, unknown>;

const arrOf = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const str = (v: unknown): string => (v == null || v === '' ? '-' : String(v));

/** La riga ha una configurazione Radar attiva/utile (da NON cancellare mai). */
function haConfigRadar(r: Riga): boolean {
  return (
    r.radar_attivo === true ||
    arrOf(r.classi_concorso).length > 0 ||
    arrOf(r.province_attive).length > 0 ||
    arrOf(r.province_interesse).length > 0 ||
    arrOf(r.materie_id).length > 0 ||
    arrOf(r.materie_custom).length > 0
  );
}

/** Riga "vuota/fantoccia": nessun dato utile, nessun segnale di vita reale. */
function eVuotaFantoccia(r: Riga): boolean {
  if (haConfigRadar(r)) return false;
  if (r.onboarded === true) return false;
  if (r.is_beta_tester === true) return false;
  if (r.is_free_forever === true) return false;
  if (r.piano === 'free_forever') return false;
  if (str(r.telegram_chat_id) !== '-') return false;
  if (str(r.stripe_customer_id) !== '-') return false;
  if (str(r.stripe_subscription_id) !== '-') return false;
  return true;
}

function punteggioKeeper(r: Riga): number {
  let p = 0;
  if (haConfigRadar(r)) p += 100;
  if (r.onboarded === true) p += 10;
  if (r.piano === 'free_forever' || r.is_free_forever === true) p += 5;
  if (r.is_beta_tester === true) p += 3;
  return p;
}

function descr(r: Riga): string {
  return (
    `id=${str(r.id)} email=${str(r.email)} piano=${str(r.piano)} ffe=${str(r.is_free_forever)} ` +
    `beta=${str(r.is_beta_tester)} radar=${str(r.radar_attivo)} onboarded=${str(r.onboarded)} ` +
    `classi=[${arrOf(r.classi_concorso).join(',')}] prov=[${arrOf(r.province_attive).join(',')}]`
  );
}

/** STEP A — porta a Free Forever le email indicate, preservando tutto il resto. */
async function stepFfe(righe: Riga[]): Promise<number> {
  console.log('\n── STEP A — Free Forever (FFE) ──');
  let modificati = 0;
  for (const email of EMAIL_FFE) {
    const riga = righe.find((r) => String(r.email ?? '').toLowerCase() === email.toLowerCase());
    if (!riga) {
      console.log(`  ⚠ ${email}: profilo NON trovato (nessuna modifica).`);
      continue;
    }
    if (riga.piano === 'free_forever' && riga.is_free_forever === true) {
      console.log(
        `  ✓ ${email}: già Free Forever. Radar preservato: ${haConfigRadar(riga) ? 'sì' : 'no'} ` +
          `classi=[${arrOf(riga.classi_concorso).join(',')}] prov=[${arrOf(riga.province_attive).join(',')}]`,
      );
      continue;
    }
    // Preserva la configurazione Radar e i flag: si aggiornano SOLO piano/scadenza/stato.
    const created = String(riga.created_at ?? '');
    const scadenza =
      riga.abbonamento_scade_il ??
      new Date((created ? new Date(created).getTime() : Date.now()) + 365 * 86_400_000).toISOString();
    const payload: Record<string, unknown> = {
      piano: 'free_forever',
      subscription_status: 'active',
      abbonamento_scade_il: scadenza,
      scadenza_avviso_stadio: riga.scadenza_avviso_stadio ?? 'free_confermato',
    };
    console.log(
      `  → ${email}: ${str(riga.piano)} → free_forever | Radar PRESERVATO ` +
        `classi=[${arrOf(riga.classi_concorso).join(',')}] prov=[${arrOf(riga.province_attive).join(',')}] radar_attivo=${str(riga.radar_attivo)}`,
    );
    if (APPLY) {
      const { error } = await sb.from('profiles').update(payload).eq('id', String(riga.id));
      if (error) {
        console.log(`    ✗ errore: ${error.message}`);
        continue;
      }
    }
    modificati += 1;
  }
  console.log(`  ${APPLY ? 'Applicate' : 'Da applicare'}: ${modificati} modifiche FFE.`);
  return modificati;
}

/** STEP B — dedupe per email (STESSA email su più righe). */
async function stepDedupe(righe: Riga[]): Promise<number> {
  console.log('\n── STEP B — Dedupe per email ──');
  const perEmail = new Map<string, Riga[]>();
  for (const r of righe) {
    const e = String(r.email ?? '').trim().toLowerCase();
    if (!e) continue;
    perEmail.set(e, [...(perEmail.get(e) ?? []), r]);
  }
  const gruppi = [...perEmail.entries()].filter(([, a]) => a.length > 1);
  if (gruppi.length === 0) {
    console.log('  ✓ Nessun duplicato per stessa email: nulla da eliminare.');
    return 0;
  }
  let eliminati = 0;
  for (const [email, gruppo] of gruppi) {
    const ordinati = [...gruppo].sort((a, b) => punteggioKeeper(b) - punteggioKeeper(a));
    console.log(`\n  === ${email} (${gruppo.length} righe) → KEEPER: ${descr(ordinati[0])}`);
    for (const r of ordinati.slice(1)) {
      if (haConfigRadar(r)) {
        console.log(`    ⛔ NON eliminata (contiene config Radar): ${descr(r)}`);
        continue;
      }
      if (!eVuotaFantoccia(r)) {
        console.log(`    ⛔ NON eliminata (ha segnali reali): ${descr(r)}`);
        continue;
      }
      console.log(`    🗑️  da eliminare (vuota/fantoccia): ${descr(r)}`);
      if (APPLY) {
        const { error } = await sb.from('profiles').delete().eq('id', String(r.id));
        if (error) {
          console.log(`       ✗ errore: ${error.message}`);
          continue;
        }
      }
      eliminati += 1;
    }
  }
  console.log(`\n  ${APPLY ? 'Eliminate' : 'Da eliminare'}: ${eliminati} righe vuote/fantoccia.`);
  return eliminati;
}

/** STEP C — igiene: profili orfani (id assente in auth.users). Solo segnalazione. */
async function stepOrfani(righe: Riga[]): Promise<void> {
  console.log('\n── STEP C — Igiene: profili orfani ──');
  const authIds = new Set<string>();
  for (let page = 1; ; page += 1) {
    const { data, error } = await sb.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) {
      console.log(`  ⚠ listUsers: ${error.message}`);
      break;
    }
    for (const u of data.users) authIds.add(u.id);
    if (data.users.length < 1000) break;
  }
  const orfani = righe.filter((r) => !authIds.has(String(r.id)));
  if (orfani.length === 0) {
    console.log('  ✓ Nessun profilo orfano (tutti gli id esistono in auth.users).');
    return;
  }
  for (const r of orfani) console.log(`  ⚠ ORFANO (solo segnalato, non eliminato): ${descr(r)}`);
}

async function main(): Promise<void> {
  console.log(`=== Manutenzione profili — ${APPLY ? 'APPLY (scrittura)' : 'DRY-RUN (nessuna scrittura)'} ===`);
  const { data, error } = await sb.from('profiles').select(CAMPI).order('created_at', { ascending: true });
  if (error) {
    console.error('✗ lettura profiles:', error.message);
    process.exit(1);
  }
  const righe = (data ?? []) as Riga[];
  console.log(`Profili totali: ${righe.length}`);

  const a = await stepFfe(righe);
  const b = await stepDedupe(righe);
  await stepOrfani(righe);

  console.log('\n=== RIEPILOGO ===');
  console.log(`  FFE aggiornati: ${a} | righe vuote eliminate: ${b}`);
  if (!APPLY) console.log('  (DRY-RUN: nessuna scrittura. Ripeti con --apply per applicare.)');
}

main().catch((e) => {
  console.error('✗', e);
  process.exit(1);
});

