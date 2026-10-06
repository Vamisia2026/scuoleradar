/**
 * ScuoleRadar.it — MONITOR di SALUTE del dispatch Radar (Admin bot).
 *
 * CLI SOTTILE: la ricognizione (letture, gate di qualità, allarmi) vive in
 * `scripts/lib/saluteDispatch.ts`, così monitor e dispatch usano lo STESSO metro e
 * il report è verificabile senza inviare nulla.
 *
 * Cosa sorveglia (dettaglio nel modulo):
 *  · CANALI Telegram (`channel_posts_log`) → nuovi avvisi senza NESSUNA
 *    pubblicazione = dispatch rotto (critical);
 *  · DISPATCH PERSONALE (`notifications_log`) → `critical` SOLO se nella finestra
 *    esistevano avvisi NOTIFICABILI (link diretto + recapito di candidatura) senza
 *    alcuna notifica. Se nessun avviso supera il gate, 0 notifiche è il risultato
 *    ATTESO (§26.65) e l'allarme è un warning che dichiara i motivi di scarto: era
 *    questa la causa del falso «Dispatch Radar FERMO» quotidiano;
 *  · scraper fermo / in errore, ledger non leggibili, sezione Notizie ferma.
 *
 * Gli allarmi critical/warning partono verso il bot Telegram ADMIN (Edge
 * `telegram-admin-webhook` via `inviaAlertaAdmin` → `ADMIN_TELEGRAM_ID`). Exit code
 * 1 se c'è almeno un allarme grave, 0 altrimenti (le voci `info` sono contesto).
 *
 * Uso:
 *   npm run admin:health               # esegue e invia gli avvisi
 *   npm run admin:health -- --dry      # solo report, nessun invio
 *   npm run admin:health -- --hours 24 # finestra personalizzata
 *
 * Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ADMIN_ALERT_SECRET (fail-closed:
 * senza secret l'allerta resta nel log locale e NON arriva al bot admin).
 */
import process from 'node:process';
import { createClient } from '@supabase/supabase-js';
import { inviaAlertaAdmin } from '../src/scraper/adminAlerts.ts';
import { esaminaSaluteDispatch } from './lib/saluteDispatch.ts';

try {
  process.loadEnvFile();
} catch {
  /* .env opzionale */
}

const args = process.argv.slice(2);
const DRY = args.includes('--dry');
const oreIdx = args.indexOf('--hours');
const ORE = oreIdx >= 0 ? Number(args[oreIdx + 1]) : Number(process.env.HEALTH_STALE_HOURS ?? 48);
/** Giorni oltre i quali la sezione Notizie è considerata FERMA (nessuna notizia datata). */
const NOTIZIE_FERME_GIORNI = Number(process.env.HEALTH_NEWS_STALE_DAYS ?? 14);
/** Giorni oltre i quali l'assenza di consegne personali è un'anomalia. */
const CONSEGNE_FERME_GIORNI = Number(process.env.HEALTH_DELIVERY_STALE_DAYS ?? 7);
const FILE_NOTIZIE = 'src/departments/notizie/data/notizieIngestite.ts';

const URL_ = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? '';
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
if (!URL_ || !KEY) {
  console.error('✗ Credenziali Supabase mancanti (.env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)');
  process.exit(1);
}

const sb = createClient(URL_, KEY, { auth: { persistSession: false } });
const { daISO, report, allarmi } = await esaminaSaluteDispatch(sb, {
  ore: ORE,
  sogliaNotizieGiorni: NOTIZIE_FERME_GIORNI,
  sogliaConsegnaGiorni: CONSEGNE_FERME_GIORNI,
  fileNotizie: FILE_NOTIZIE,
});

console.log(`\n=== Radar Health Check — finestra ${ORE}h (dal ${daISO}) ===`);
for (const r of report) console.log(`${r.ok ? '✓' : '⚠'} ${r.testo}`);

// ---- Esito ----
const gravi = allarmi.filter((a) => a.severity !== 'info');
if (allarmi.length === 0) {
  console.log('\n✅ Nessuna anomalia rilevata.');
  process.exit(0);
}
console.log(`\n⚠ ${allarmi.length} anomalia/e rilevata/e (critical/warning: ${gravi.length}).`);
for (const a of allarmi) console.log(`  • [${a.severity}] ${a.title}: ${a.message}`);
if (gravi.length === 0) {
  console.log('\n(info: nessun avviso inviato al bot admin.)');
} else if (DRY) {
  console.log('\n(--dry: nessun avviso inviato.)');
} else {
  for (const a of gravi) {
    const esito = await inviaAlertaAdmin(a);
    console.log(
      esito.ok ? `  ✓ Avviso inviato: ${a.title}` : `  ✗ Invio avviso fallito (${esito.error})`,
    );
    if (!esito.ok && /non configurat/i.test(esito.error ?? '')) {
      console.warn(
        "    ↳ Azione richiesta: impostare ADMIN_ALERT_SECRET (STESSO valore dei secrets Supabase " +
          "dell'Edge `telegram-admin-webhook`) in locale (.env) e nei secrets del repository GitHub: " +
          "senza quel valore l'allerta NON arriva al bot admin (percorso fail-closed).",
      );
    }
  }
}
// Exit 1 SOLO per anomalie gravi: le voci `info` sono contesto, non un guasto.
process.exitCode = gravi.length > 0 ? 1 : 0;
