/**
 * ScuoleRadar.it — Provisioning accesso BETA / utenti PRE-APPROVATI.
 *
 * Verifica su Supabase Auth (`auth.users`) la presenza degli indirizzi
 * pre-approvati (beta tester). Per ogni email:
 *   · ASSENTE   → crea l'account (email confermata) con la password provvisoria
 *                 di default "Scuoleradar2026" e il flag `force_password_change`;
 *   · PRESENTE MA MAI ACCEDUTO → riallinea password provvisoria + flag;
 *   · GIÀ ATTIVO → NON sovrascrive la password personale (solo profilo beta),
 *                 a meno di `--force`.
 *
 * Il flag `force_password_change` (equivalente server di requires_password_change)
 * fa scattare, al primo login, il modal "Imposta la tua password definitiva"
 * (src/components/ForcePasswordModal.tsx) PRIMA dell'accesso alla dashboard.
 *
 * Uso (dalla cartella `project/`):
 *   npm run provision:beta                 # crea/riallinea gli utenti pre-approvati
 *   npm run provision:beta -- --check      # solo verifica, nessuna scrittura
 *   npm run provision:beta -- --force      # reset password provvisoria anche per account già attivi
 *   npm run provision:beta -- -- email@x.it altra@y.it   # lista email personalizzata
 *
 * Richiede in `.env`:
 *   SUPABASE_URL                (project URL)
 *   SUPABASE_SERVICE_ROLE_KEY   (chiave service_role — MAI nel browser)
 */

import process from 'node:process';
import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js';

/** Password provvisoria di default per gli accessi beta / pre-approvati. */
export const PASSWORD_PROVVISORIA = 'Scuoleradar2026';

/** Email PRE-APPROVATE gestite da questo script (estendibile con argomenti). */
export const EMAIL_PRE_APPROVATI = [
  'piergiacomodileonardo@yahoo.it',
  // Beta tester già presenti su profiles.is_beta_tester = true (rilevati sul DB):
  'valentina.salla@gmail.com',
  'valentina.salla@icsandamiano.edu.it',
  'g.pampanaro@gmail.com',
  'pampanaro.giuseppe@itisartom.edu.it',
  'dineh3@gmail.com',
  'fasogliomarco@gmail.com',
  'bisonproductions@gmail.com',
  'bartoloansaldi@gmail.com',
];


function caricaEnv(): void {
  try {
    // Node >= 20.12: carica il file `.env` dalla cartella corrente.
    process.loadEnvFile?.();
  } catch {
    // Nessun .env: si usano le variabili già presenti nell'ambiente.
  }
}

/** Cerca un utente in auth.users per email esatta (case-insensitive), paginando listUsers. */
async function trovaUtenteByEmail(sb: SupabaseClient, email: string): Promise<User | null> {
  const target = email.trim().toLowerCase();
  let pagina = 1;
  while (pagina <= 50) {
    const { data, error } = await sb.auth.admin.listUsers({ page: pagina, perPage: 200 });
    if (error) throw error;
    const lista = data?.users ?? [];
    const trovato = lista.find((u) => String(u.email ?? '').trim().toLowerCase() === target);
    if (trovato) return trovato;
    if (lista.length < 200) return null;
    pagina += 1;
  }
  return null;
}

/** Solo le colonne realmente presenti su profiles (feature-detect, come l'Edge admin). */
async function rigaProfiles(sb: SupabaseClient, payload: Record<string, unknown>): Promise<Record<string, unknown>> {
  const { data } = await sb.from('profiles').select('*').limit(1);
  const colonne = data && data.length > 0 ? Object.keys(data[0]) : null;
  if (!colonne) return payload;
  const filtrato: Record<string, unknown> = {};
  for (const k of Object.keys(payload)) if (colonne.includes(k)) filtrato[k] = payload[k];
  return filtrato;
}

interface Esito {
  email: string;
  stato: 'assente' | 'creato' | 'preparato' | 'reset' | 'attivo' | 'presente' | 'errore';
  id?: string;
  ultimo_accesso?: string | null;
  force_password_change?: boolean;
  nota?: string;
  errore?: string;
}

async function processaEmail(
  sb: SupabaseClient,
  email: string,
  opts: { check?: boolean; force?: boolean },
): Promise<Esito> {
  const em = email.trim().toLowerCase();
  if (!em) return { email: em, stato: 'errore', errore: 'email vuota' };

  let esistente: User | null;
  try {
    esistente = await trovaUtenteByEmail(sb, em);
  } catch (err) {
    return { email: em, stato: 'errore', errore: (err as Error).message };
  }

  const flagAttuale =
    esistente && (esistente.user_metadata as Record<string, unknown> | undefined)?.force_password_change === true;

  // Modalità --check: nessuna scrittura, solo stato.
  if (opts.check) {
    if (!esistente) return { email: em, stato: 'assente' };
    return {
      email: em,
      stato: 'presente',
      id: String(esistente.id),
      ultimo_accesso: esistente.last_sign_in_at ?? null,
      force_password_change: Boolean(flagAttuale),
    };
  }

  try {
    // ---- 1. Assente → creazione automatica con accesso beta.
    if (!esistente) {
      const { data: creato, error } = await sb.auth.admin.createUser({
        email: em,
        password: PASSWORD_PROVVISORIA,
        email_confirm: true,
        user_metadata: { force_password_change: true },
      });
      if (error || !creato?.user) {
        return { email: em, stato: 'errore', errore: error?.message ?? 'creazione non riuscita' };
      }
      const id = String(creato.user.id);
      const { error: errProfilo } = await sb.from('profiles').upsert(
        await rigaProfiles(sb, { id, email: em, is_beta_tester: true, onboarded: false }),
        { onConflict: 'id' },
      );
      return {
        email: em,
        stato: 'creato',
        id,
        ...(errProfilo ? { errore: `account creato ma profilo non salvato: ${errProfilo.message}` } : {}),
      };
    }

    // ---- 2. Presente: marca il profilo beta (il piano non viene toccato).
    const id = String(esistente.id);
    const giaAcceduto = Boolean(esistente.last_sign_in_at);
    try {
      await sb.from('profiles').upsert(
        await rigaProfiles(sb, { id, email: em, is_beta_tester: true }),
        { onConflict: 'id' },
      );
    } catch (err) {
      return { email: em, stato: 'errore', id, errore: `profilo beta non salvato: ${(err as Error).message}` };
    }

    // ---- 3. Mai acceduto (oppure --force) → password provvisoria + cambio obbligatorio.
    if (!giaAcceduto || opts.force) {
      const meta = { ...((esistente.user_metadata ?? {}) as Record<string, unknown>) };
      const { error: errReset } = await sb.auth.admin.updateUserById(id, {
        password: PASSWORD_PROVVISORIA,
        user_metadata: { ...meta, force_password_change: true },
      });
      if (errReset) return { email: em, stato: 'errore', id, errore: errReset.message };
      return {
        email: em,
        stato: giaAcceduto ? 'reset' : 'preparato',
        id,
        ultimo_accesso: esistente.last_sign_in_at ?? null,
        force_password_change: true,
      };
    }

    // ---- 4. Già attivo: password personale preservata.
    return {
      email: em,
      stato: 'attivo',
      id,
      ultimo_accesso: esistente.last_sign_in_at ?? null,
      force_password_change: Boolean(flagAttuale),
      nota: 'password personale preservata (usa --force per il reset provvisorio)',
    };
  } catch (err) {
    return { email: em, stato: 'errore', errore: (err as Error).message };
  }
}


async function main(): Promise<number> {
  caricaEnv();

  const url = process.env.SUPABASE_URL?.trim() ?? '';
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? '';
  if (!url || !serviceRole) {
    console.error(
      "\n[provision:beta] Variabili mancanti in `.env` (o nell'ambiente):\n" +
        '  SUPABASE_URL                -> https://<project-ref>.supabase.co\n' +
        '  SUPABASE_SERVICE_ROLE_KEY   -> chiave service_role (Supabase Dashboard > Settings > API).\n' +
        "Aggiungile al file project/.env e riprova. Nessuna modifica e' stata eseguita.\n",
    );
    return 1;
  }
  if (url.includes('xxxx') || serviceRole.includes('xxxx')) {
    console.error('[provision:beta] Trovati placeholder (xxxx) in .env: inserisci i valori reali.\n');
    return 1;
  }

  const args = process.argv.slice(2);
  const check = args.includes('--check');
  const force = args.includes('--force');
  const emailArg = args.filter((a) => !a.startsWith('--'));
  const emails = emailArg.length > 0 ? emailArg : EMAIL_PRE_APPROVATI;

  const sb = createClient(url, serviceRole, { auth: { persistSession: false } });

  console.log('');
  console.log('-'.repeat(70));
  console.log(`  Provisioning accesso BETA / pre-approvati  [${check ? 'SOLO VERIFICA' : 'SCRITTURA'}]`);
  console.log(`  Password provvisoria: ${PASSWORD_PROVVISORIA}  |  force: ${force ? 'SI' : 'no'}`);
  console.log('-'.repeat(70));

  let errori = 0;
  for (const email of emails) {
    const esito = await processaEmail(sb, email, { check, force });
    const stato = esito.stato.padEnd(9);
    const extra = [
      esito.id ? `id=${esito.id}` : '',
      esito.ultimo_accesso ? `ultimo_accesso=${esito.ultimo_accesso}` : '',
      esito.force_password_change === true ? 'force_password_change=true' : '',
      esito.nota ?? '',
    ]
      .filter(Boolean)
      .join(' · ');
    const errore = esito.errore ? ` — ${esito.errore}` : '';
    console.log(`  ${stato}  ${esito.email}${extra ? `   (${extra})` : ''}${errore}`);
    if (esito.stato === 'errore') errori += 1;
  }

  console.log('-'.repeat(70));
  if (errori > 0) {
    console.error(`  Completato con ${errori} errore/i.`);
    return 1;
  }
  console.log('  OK.\n');
  return 0;
}

main()
  .then((codice) => {
    process.exitCode = codice;
  })
  .catch((err) => {
    console.error('\n[provision:beta] Errore imprevisto:', err);
    process.exitCode = 1;
  });

