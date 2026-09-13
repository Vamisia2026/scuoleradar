/**
 * ScuoleRadar.it — MONITOR di SALUTE del dispatch Radar (Admin bot).
 *
 * Rileva e segnala ANOMALIE del ciclo di notifica:
 *  1. DISPATCH GLOBALE FERMO: negli ultimi N ore sono arrivati NUOVI interpelli
 *     (dati scrapati) ma NON è partita nessuna notifica (nessuna voce in
 *     `notifications_log`).
 *  2. SCRAPER FERMO: nessuna run in `scraper_runs` nella finestra.
 *  3. SCRAPER IN ERRORE: l'ultima run ha esito `error`.
 *  4. Nessun dato nuovo ma utenti attivi (informativo).
 *
 * Gli avvisi vengono inviati al bot Telegram ADMIN (`ScuoleRadar Admin`) tramite
 * l'helper `inviaAlertaAdmin` (Edge `telegram-admin-webhook` → ADMIN_TELEGRAM_ID).
 *
 * Uso:
 *   npm run admin:health               # esegue e invia gli avvisi
 *   npm run admin:health -- --dry      # solo report, nessun invio
 *   npm run admin:health -- --hours 24 # finestra personalizzata
 *
 * Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ADMIN_ALERT_SECRET.
 */
import process from 'node:process';
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { inviaAlertaAdmin, type AlertaAdmin } from '../src/scraper/adminAlerts.ts';

try {
  process.loadEnvFile();
} catch {
  /* .env opzionale */
}

const args = process.argv.slice(2);
const DRY = args.includes('--dry');
const oreIdx = args.indexOf('--hours');
const ORE = oreIdx >= 0 ? Number(args[oreIdx + 1]) : Number(process.env.HEALTH_STALE_HOURS ?? 48);
const SOGLIA_MS = Math.max(1, ORE) * 60 * 60 * 1000;
const daISO = new Date(Date.now() - SOGLIA_MS).toISOString();
/** Giorni oltre i quali la sezione Notizie è considerata FERMA (nessuna notizia datata). */
const NOTIZIE_FERME_GIORNI = Number(process.env.HEALTH_NEWS_STALE_DAYS ?? 14);
const FILE_NOTIZIE = 'src/departments/notizie/data/notizieIngestite.ts';

const URL_ = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? '';
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
if (!URL_ || !KEY) {
  console.error('✗ Credenziali Supabase mancanti (.env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)');
  process.exit(1);
}
const sb = createClient(URL_, KEY, { auth: { persistSession: false } });

const allarmi: AlertaAdmin[] = [];
const log = (ok: boolean, msg: string): void => console.log(`${ok ? '✓' : '⚠'} ${msg}`);

// 1) Dati scrapati nella finestra.
const { count: interpelliRecenti } = await sb
  .from('interpelli')
  .select('id', { count: 'exact', head: true })
  .gte('created_at', daISO);
const { data: ultimoInterpello } = await sb
  .from('interpelli')
  .select('created_at')
  .order('created_at', { ascending: false })
  .limit(1)
  .maybeSingle();

// 2) Notifiche inviate nella finestra (tabella opzionale).
let notificheRecenti: number | null = null;
let ultimaNotifica: string | null = null;
{
  const { count, error } = await sb
    .from('notifications_log')
    .select('interpello_hash', { count: 'exact', head: true })
    .gte('sent_at', daISO);
  if (error) {
    console.warn(`⚠ notifications_log non disponibile (${error.message}): deduzione notifiche non possibile.`);
  } else if (typeof count !== 'number') {
    // PostgREST con `head:true` NON restituisce errore quando la tabella manca:
    // ritorna `count: null`. Va trattato come "ledger non disponibile" e NON
    // come "0 notifiche inviate", altrimenti si genera un falso allarme.
    console.warn('⚠ notifications_log non raggiungibile (count nullo): deduzione notifiche non possibile.');
  } else {
    notificheRecenti = count;
    const { data } = await sb
      .from('notifications_log')
      .select('sent_at')
      .order('sent_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    ultimaNotifica = (data?.sent_at as string) ?? null;
  }
}

// 3) Scraper runs.
const { data: ultimaRun } = await sb
  .from('scraper_runs')
  .select('finished_at,esito,messaggio,nuovi')
  .order('finished_at', { ascending: false })
  .limit(1)
  .maybeSingle();

// 4) Utenti con Radar attivo con almeno un canale.
const { data: utentiAttivi } = await sb
  .from('profiles')
  .select('telegram_chat_id,email,email_notifica')
  .eq('radar_attivo', true);
const attivi = (utentiAttivi ?? []).filter(
  (u) => String(u.telegram_chat_id ?? '').trim() !== '' || /@/.test(String(u.email_notifica || u.email || '')),
).length;

// 5) Sezione Notizie: ultima data di pubblicazione nell'archivio ingestito.
//    L'archivio vive nel repo (`notizieIngestite.ts`) quindi è leggibile sia in
//    locale sia nel cron GitHub Actions (checkout del codice).
let ultimaNotizia: string | null = null;
let notizieReadOk = false;
try {
  const sorgente = readFileSync(FILE_NOTIZIE, 'utf8');
  const date = [...sorgente.matchAll(/"published_at":\s*"(\d{4}-\d{2}-\d{2})/g)].map(
    (m) => m[1],
  );
  ultimaNotizia = date.sort().at(-1) ?? null;
  notizieReadOk = true;
} catch {
  /* file assente: monitor notizie saltato */
}
const giorniNotizie = ultimaNotizia
  ? Math.floor((Date.now() - new Date(ultimaNotizia).getTime()) / 86_400_000)
  : null;

console.log(`\n=== Radar Health Check — finestra ${ORE}h (dal ${daISO}) ===`);
log(true, `Nuovi interpelli nella finestra: ${interpelliRecenti ?? 0} (ultimo: ${ultimoInterpello?.created_at ?? 'nessuno'})`);
log(notificheRecenti == null || notificheRecenti > 0, `Notifiche inviate nella finestra: ${notificheRecenti ?? 'n/d'} (ultima: ${ultimaNotifica ?? 'nessuna'})`);
log(true, `Utenti con Radar attivo e canale: ${attivi}`);
log(true, `Ultima run scraper: ${ultimaRun?.finished_at ?? 'nessuna'} (esito: ${ultimaRun?.esito ?? 'n/d'})`);
log(giorniNotizie !== null && giorniNotizie <= NOTIZIE_FERME_GIORNI, `Ultima notizia datata: ${ultimaNotizia ?? 'n/d'} (${giorniNotizie ?? 'n/d'} gg fa)`);

// ---- Valutazione anomalie ----
const datiRecenti = (interpelliRecenti ?? 0) > 0;
const nessunaNotifica = notificheRecenti === 0;
const ledgerDisponibile = notificheRecenti !== null;
const runFerma =
  !ultimaRun?.finished_at || new Date(ultimaRun.finished_at).getTime() < Date.now() - SOGLIA_MS;

if (!ledgerDisponibile) {
  allarmi.push({
    severity: 'warning',
    category: 'infrastruttura',
    title: 'Ledger notifiche non disponibile: monitoraggio dispatch degradato',
    message:
      'La tabella `public.notifications_log` non è leggibile (migrazione non applicata?). ' +
      'Senza ledger non è possibile rilevare un dispatch Radar FERMO: applicare la migrazione.',
    meta: { tabella: 'notifications_log' },
  });
}
if (datiRecenti && nessunaNotifica) {
  allarmi.push({
    severity: 'critical',
    category: 'notifiche',
    title: 'Dispatch Radar FERMO: dati nuovi ma nessuna notifica',
    message:
      `Nelle ultime ${ORE}h sono stati scrapati ${interpelliRecenti} interpelli ma NON è partita alcuna notifica ` +
      `(email/Telegram). Verificare matching engine, canali collegati e notifier.`,
    meta: { ore: ORE, interpelli: interpelliRecenti, attivi },
  });
}
if (runFerma) {
  allarmi.push({
    severity: 'warning',
    category: 'scraper',
    title: 'Scraper interpelli fermo',
    message: `Nessuna run di scraping nelle ultime ${ORE}h (ultima: ${ultimaRun?.finished_at ?? 'mai'}). Verificare il cron GitHub Actions.`,
    meta: { ore: ORE, ultima: ultimaRun?.finished_at ?? null },
  });
}
if (ultimaRun?.esito === 'error') {
  allarmi.push({
    severity: 'critical',
    category: 'scraper',
    title: 'Ultima run scraper in ERRORE',
    message: `L'ultima esecuzione dello scraper è terminata con errore: ${ultimaRun.messaggio ?? 'senza dettagli'}.`,
    meta: { finished_at: ultimaRun.finished_at, nuovi: ultimaRun.nuovi },
  });
}
if (!datiRecenti && attivi > 0) {
  allarmi.push({
    severity: 'info',
    category: 'notifiche',
    title: 'Nessun dato nuovo da notificare',
    message: `Nelle ultime ${ORE}h non sono arrivati interpelli nuovi: nessuna notifica attesa per i ${attivi} utenti attivi.`,
    meta: { ore: ORE, attivi },
  });
}
if (notizieReadOk && (giorniNotizie === null || giorniNotizie > NOTIZIE_FERME_GIORNI)) {
  allarmi.push({
    severity: 'warning',
    category: 'notizie',
    title: 'Sezione Notizie FERMA',
    message:
      `Nessuna notizia DATATA da ${giorniNotizie ?? '∞'} giorni (ultima: ${ultimaNotizia ?? 'nessuna'}). ` +
      `Verificare fonti RSS/pagine di elenco, filtri editoriali e tetto articoli (cron \`scrape-notizie\`).`,
    meta: { soglia_giorni: NOTIZIE_FERME_GIORNI, ultima: ultimaNotizia },
  });
}

// ---- Esito ----
if (allarmi.length === 0) {
  console.log('\n✅ Nessuna anomalia rilevata.');
  process.exit(0);
}
console.log(`\n⚠ ${allarmi.length} anomalia/e rilevata/e.`);
for (const a of allarmi) {
  console.log(`  • [${a.severity}] ${a.title}: ${a.message}`);
}
if (DRY) {
  console.log('\n(--dry: nessun avviso inviato.)');
} else {
  for (const a of allarmi) {
    const esito = await inviaAlertaAdmin(a);
    console.log(esito.ok ? `  ✓ Avviso inviato: ${a.title}` : `  ✗ Invio avviso fallito (${esito.error})`);
  }
}
process.exitCode = 1;

