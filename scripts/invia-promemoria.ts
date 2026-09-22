/**
 * ScuoleRadar.it — PROMEMORIA 24h (scadenza vicina).
 *
 * Invia UN SOLO promemoria per interpello: le opportunità consegnate dal digest
 * da almeno 24 ore, ancora attive e con la scadenza VICINA (alta priorità)
 * vengono riunite in UNA sola email per utente. Guardia anti-duplicato nel ledger
 * (DB `notifications_log.canale = 'promemoria'` + file locale): la seconda
 * esecuzione non rimanda nulla.
 *
 * Uso:
 *   npm run notifiche:promemoria                  # rispetta la finestra del digest
 *   npm run notifiche:promemoria -- --force        # esegue subito (admin/CI manuale)
 *   npm run notifiche:promemoria -- --dry-run      # nessun invio reale
 *   npm run notifiche:promemoria -- --dry-run a@b.it [--ore 24] [--giorni 3]
 *
 * È eseguito dal workflow `.github/workflows/digest.yml` subito DOPO il digest.
 */
import process from 'node:process';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import {
  GIORNI_URGENZA_PROMEMORIA,
  ORE_PROMEMORIA,
} from '../src/lib/promemoria.ts';
import { descrizioneFinestraDigest, eOraDelDigest, oraLocaleItalia } from '../src/lib/digest.ts';
import { ledgerLocaleSalva } from '../src/lib/ledgerLocale.ts';
import { inviaPromemoria24h } from '../src/lib/notifier.ts';

// RETE DI SICUREZZA: il ledger su file va salvato anche se il processo termina in
// modo imprevisto. Un promemoria già inviato non deve MAI ripartire.
process.on('exit', () => ledgerLocaleSalva());

try {
  process.loadEnvFile();
} catch {
  /* .env opzionale */
}

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const force = args.includes('--force');

/** Legge un'opzione numerica (`--ore 24`, `--giorni 3`) con default sicuro. */
function numero(flag: string, fallback: number): number {
  const i = args.indexOf(flag);
  const valore = i >= 0 ? Number(args[i + 1]) : NaN;
  return Number.isFinite(valore) && valore >= 0 ? valore : fallback;
}

const oreMinime = numero('--ore', ORE_PROMEMORIA);
const giorniUrgenza = numero('--giorni', GIORNI_URGENZA_PROMEMORIA);
const IGNORATI = new Set(['--dry-run', '--force', '--ore', '--giorni', String(oreMinime), String(giorniUrgenza)]);
const target = args.find((a) => !a.startsWith('--') && !IGNORATI.has(a)) ?? '';

const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? '';
const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';

console.log('━━ ScuoleRadar — Promemoria 24h (scadenza vicina) ━━');
console.log(`• Finestra: ${descrizioneFinestraDigest()}`);
console.log(
  `• Ora italiana: ${oraLocaleItalia()}:00 · modalità: ${
    dryRun ? 'DRY-RUN (nessun invio)' : 'invio reale'
  }${force ? ' · FORZATO' : ''} · soglie: ≥ ${oreMinime}h dalla consegna, scadenza entro ${giorniUrgenza} gg`,
);

// Il promemoria vive nello stesso giro giornaliero del digest: fuori finestra
// esce subito (nessun accesso a database o provider), `--force` per i lanci admin.
if (!eOraDelDigest(new Date(), force)) {
  console.log('ℹ Fuori finestra (attesa 17:00 italiane): nessun promemoria. Usa --force per forzare.');
  process.exit(0);
}

if (!url || !key) {
  console.error('✗ Credenziali Supabase mancanti (.env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)');
  process.exit(1);
}

if (!process.env.RESEND_API_KEY && !dryRun) {
  console.warn('⚠ RESEND_API_KEY non configurata: nessun promemoria email possibile.');
}

const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(target);
const client: SupabaseClient = createClient(url, key, { auth: { persistSession: false } });

const esito = await inviaPromemoria24h(client as never, {
  dryRun,
  dashboardUrl: process.env.RESEND_DASHBOARD_URL,
  oreMinime,
  giorniUrgenza,
  soloUtente: target ? (isUuid ? { userId: target } : { email: target }) : undefined,
});

console.log('\n=== RIEPILOGO ===');
console.log(JSON.stringify(esito, null, 2));
if (dryRun) console.log('(DRY-RUN: nessun invio. Ripeti senza --dry-run per spedire davvero.)');

// Exit code ≠ 0 solo se ci sono stati ERRORI di invio: il workflow può allertare.
process.exitCode = esito.fallite > 0 ? 1 : 0;
