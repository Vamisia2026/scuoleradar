/**
 * ScuoleRadar.it — DIGEST GIORNALIERO delle opportunità.
 *
 * Sostituisce l'invio in tempo reale: raccoglie TUTTE le opportunità attive e non
 * ancora notificate di ogni utente e le consegna in UN SOLO messaggio (email +
 * Telegram) alla chiusura delle scuole — 18:00 italiane.
 *
 * Uso:
 *   npm run notifiche:digest                     # rispetta la finestra delle 18:00
 *   npm run notifiche:digest -- --force          # ignora l'orario (lancio manuale)
 *   npm run notifiche:digest -- --dry-run        # nessun invio reale
 *   npm run notifiche:digest -- --dry-run a@b.it # un solo destinatario (email o UUID)
 *   npm run notifiche:digest -- --registra-consegnate [--fino-a <ISO>]
 *                                                # RECUPERO: marca come consegnate
 *                                                # le opportunità già inviate, senza
 *                                                # rispedire nulla (non consuma quota)
 *
 * È il comando eseguito dal workflow `.github/workflows/digest.yml`.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { descrizioneFinestraDigest, eOraDelDigest, oraLocaleItalia } from '../src/lib/digest.ts';
import { ledgerLocaleSalva } from '../src/lib/ledgerLocale.ts';
import { inviaDigestGiornaliero } from '../src/lib/notifier.ts';

// RETE DI SICUREZZA: il ledger su file viene salvato anche se il processo esce
// in modo imprevisto (eccezione non gestita, interruzione del runner CI). Le
// opportunità già consegnate non devono MAI essere rimandate.
process.on('exit', () => ledgerLocaleSalva());

try {
  process.loadEnvFile();
} catch {
  /* .env opzionale */
}

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const force = args.includes('--force');
const soloRegistrare = args.includes('--registra-consegnate');
const posFinoA = args.indexOf('--fino-a');
let finoA: string | null = posFinoA >= 0 ? (args[posFinoA + 1] ?? null) : null;
if (finoA && Number.isNaN(new Date(finoA).getTime())) {
  console.warn(`⚠ --fino-a non è una data valida ("${finoA}"): il tetto temporale viene ignorato.`);
  finoA = null;
}
if (soloRegistrare && !finoA) {
  console.warn(
    '⚠ RECUPERO senza --fino-a: verranno marcate TUTTE le opportunità pendenti (anche eventuali novità non ancora inviate).',
  );
}
const IGNORATI = new Set(['--dry-run', '--force', '--registra-consegnate', '--fino-a', finoA ?? '']);
const target = args.find((a) => !a.startsWith('--') && !IGNORATI.has(a)) ?? '';

const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? '';
const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';

console.log('━━ ScuoleRadar — Digest giornaliero delle opportunità ━━');
console.log(`• Finestra di invio: ${descrizioneFinestraDigest()}`);
console.log(
  `• Ora italiana: ${oraLocaleItalia()}:00 · modalità: ${
    soloRegistrare ? 'RECUPERO (marca senza inviare)' : dryRun ? 'DRY-RUN (nessun invio)' : 'invio reale'
  }${force ? ' · FORZATO' : ''}${finoA ? ` · fino a ${finoA}` : ''}`,
);

// Il cron di GitHub gira in UTC: si schedula su due orari e si invia SOLO quando
// in Italia sono le 18:00 (estate/inverno). `--force` serve ai lanci manuali.
// Il controllo è PRIMA di tutto: l'esecuzione "fuori finestra" esce subito,
// senza toccare credenziali, database o provider di invio.
// La modalità RECUPERO (nessun invio) non è soggetta alla finestra oraria.
if (!soloRegistrare && !eOraDelDigest(new Date(), force)) {
  console.log('ℹ Fuori finestra (attesa 18:00 italiane): nessun invio. Usa --force per forzare.');
  process.exit(0);
}

if (!url || !key) {
  console.error('✗ Credenziali Supabase mancanti (.env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)');
  process.exit(1);
}

if (!process.env.RESEND_API_KEY && !dryRun) {
  console.warn('⚠ RESEND_API_KEY non configurata: il digest email non potrà partire (solo Telegram).');
}

const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(target);
const client: SupabaseClient = createClient(url, key, { auth: { persistSession: false } });

const esito = await inviaDigestGiornaliero(client as never, {
  dryRun,
  forzato: force,
  dashboardUrl: process.env.RESEND_DASHBOARD_URL,
  soloUtente: target ? (isUuid ? { userId: target } : { email: target }) : undefined,
  soloRegistrare,
  finoA,
});

console.log('\n=== RIEPILOGO ===');
console.log(JSON.stringify(esito, null, 2));
if (dryRun) console.log('(DRY-RUN: nessun invio. Ripeti senza --dry-run per spedire davvero.)');

// Exit code ≠ 0 solo se ci sono stati ERRORI di invio: il workflow può allertare.
process.exitCode = esito.fallite + esito.telegramFallite > 0 ? 1 : 0;
