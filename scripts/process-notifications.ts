/**
 * ScuoleRadar.it — CONSUMATORE DELLE NOTIFICHE (§26.86).
 *
 * `npm run notifiche:processa` — il secondo tempo del pattern producer/consumer:
 * lo scraping scrive le righe e accoda (produttore), questo processo consegna e
 * registra l'esito (consumatore). Nessun invio avviene piu' dentro il run di
 * ingestione: un timeout di Telegram non puo' far fallire una scansione che aveva
 * gia' scritto i dati giusti.
 *
 * Uso:
 *   npm run notifiche:processa                 # fino a 25 voci pronte
 *   npm run notifiche:processa -- --limit 100  # giro piu' ampio
 *   npm run notifiche:processa -- --dry-run    # elenca soltanto (nessun invio)
 *   npm run notifiche:processa -- --worker w2  # nome del worker nel lock
 *
 * CANALI: qui parte il canale TELEGRAM in tempo reale (piano PRO), con lo stesso
 * dispatcher dei run di scraping (`inviaAlertTelegramTempoReale`: tier, frequenza
 * e deduplica sono gia' dentro). L'EMAIL NON parte per opportunita': resta al
 * digest giornaliero delle 18:00 (`npm run notifiche:digest`, «una email al
 * giorno», `comunicazione/01_email_riepilogo`).
 *
 * ROBUSTEZZA: un errore su una voce non ferma le altre e non lancia mai
 * (`consumaCoda`); dopo 3 fallimenti la voce diventa `FAILED_NOTIF` e si ferma
 * li'. Exit code 1 solo se ci sono voci abbandonate: e' l'unico caso che merita
 * un allarme del cron.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { consumaCoda, type EsitoDispatch } from '../src/lib/notificationConsumer.ts';
import { riapriBloccati, type VoceNotifica } from '../src/lib/notificationQueue.ts';
import { getPendingNotifications } from '../src/lib/notificationQueue.ts';
import { ponteSupabase } from '../src/lib/notificationQueueDb.ts';
import { inviaAlertTelegramTempoReale } from '../src/lib/notifier.ts';
import { eScaduto, giorniRimanenti } from '../src/lib/scadenza.ts';
import type { InterpelloParsato } from '../src/scraper/parser.ts';

try {
  process.loadEnvFile();
} catch {
  /* .env opzionale */
}

/* ---------------------------------- Args ---------------------------------- */

const args = process.argv.slice(2);

function valoreOpzione(nome: string): string | null {
  const conUguale = args.find((a) => a.startsWith(`${nome}=`));
  if (conUguale) return conUguale.slice(nome.length + 1);
  const posizione = args.indexOf(nome);
  return posizione >= 0 ? (args[posizione + 1] ?? null) : null;
}

const dryRun = args.includes('--dry-run');
const limiteLetto = Number(valoreOpzione('--limit') ?? 25);
const limite = Number.isFinite(limiteLetto) && limiteLetto > 0 ? Math.trunc(limiteLetto) : 25;
const worker = valoreOpzione('--worker') ?? `process-notifications-${process.pid}`;
const bloccatiSecondi = Number(valoreOpzione('--bloccati') ?? 900);

const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? '';
const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';

console.log('━━ ScuoleRadar — Consegna delle notifiche in coda ━━');
console.log(
  `• Voci per giro: ${limite} · worker: ${worker} · modalita': ${
    dryRun ? 'DRY-RUN (nessun invio, nessuna scrittura)' : 'invio reale'
  }`,
);

if (!url || !key) {
  console.error('x Credenziali Supabase mancanti (.env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)');
  process.exit(1);
}

if (!dryRun && !process.env.TELEGRAM_BOT_TOKEN) {
  console.warn('[!] TELEGRAM_BOT_TOKEN non configurato: il canale Telegram non potra inviare.');
}

const client: SupabaseClient = createClient(url, key, { auth: { persistSession: false } });
const ponte = ponteSupabase(client);

/* ------------------------------ Dati della voce ------------------------------ */

/** Colonne minime per ricostruire l'avviso da notificare. */
const COLONNE_INTERPELLO =
  'id, hash_id, title, province, class_codes, school_name, school_code, source_url, expiration_date, contact_email, materia';

interface RigaInterpello {
  id: string;
  hash_id: string | null;
  title: string | null;
  province: string | null;
  class_codes: string[] | null;
  school_name: string | null;
  school_code: string | null;
  source_url: string | null;
  expiration_date: string | null;
  contact_email: string | null;
  materia: string | null;
}

async function caricaInterpello(id: string): Promise<RigaInterpello | null> {
  const { data, error } = await client
    .from('interpelli')
    .select(COLONNE_INTERPELLO)
    .eq('id', id)
    .maybeSingle();
  if (error) {
    console.warn(`[!] interpello ${id.slice(0, 8)} non leggibile: ${error.message}`);
    return null;
  }
  return (data as RigaInterpello | null) ?? null;
}

/** Riga del database -> payload atteso dal notifier (`InterpelloParsato`). */
function interpelloDaNotificare(riga: RigaInterpello): InterpelloParsato {
  return {
    title: riga.title ?? '',
    link: riga.source_url ?? null,
    province: riga.province ?? '',
    classCodes: riga.class_codes ?? [],
    publishedAt: null,
    expirationDate: riga.expiration_date ?? null,
    hashId: riga.hash_id ?? '',
    source: riga.source_url ?? '',
    schoolName: riga.school_name ?? null,
    schoolCode: riga.school_code ?? null,
    materia: riga.materia ?? null,
    contactEmail: riga.contact_email ?? null,
  };
}

/**
 * Consegna di una voce: canale TELEGRAM in tempo reale, con lo stesso dispatcher
 * dei run di scraping. Il notifier applica tier (solo PRO), frequenza e
 * deduplica, e non lancia mai: un guasto torna come contatore `telegramFallite`.
 *
 * Zero invii e zero fallimenti significa «nessun destinatario» (BASE senza
 * chat_id, automatizzazione spenta dal pannello Admin): la voce e' gestita e si
 * chiude, altrimenti la coda non si svuoterebbe mai.
 */
async function consegna(voce: VoceNotifica): Promise<EsitoDispatch> {
  const riga = await caricaInterpello(voce.interpelloId);
  if (!riga) return { inviati: 0, falliti: 0, saltata: 'interpello non trovato' };

  // Scadenza dichiarata e gia' passata: non si notifica un avviso morto. Le righe
  // senza scadenza NON si scartano qui (regola del produttore, §26.71/§26.75).
  if (eScaduto(riga.expiration_date)) {
    const giorni = Math.abs(giorniRimanenti(riga.expiration_date) ?? 0);
    return { inviati: 0, falliti: 0, saltata: `scaduta da ${giorni} giorni` };
  }

  const esito = await inviaAlertTelegramTempoReale(client as never, [interpelloDaNotificare(riga)], {
    dashboardUrl: process.env.RESEND_DASHBOARD_URL,
  });
  return { inviati: esito.telegramInviate, falliti: esito.telegramFallite };
}

/* ---------------------------------- Giro ---------------------------------- */

if (dryRun) {
  const voci = await getPendingNotifications(limite, { client });
  console.log(`[DRY-RUN] ${voci.length} voci pronte: nessun invio, nessuna scrittura.`);
  for (const voce of voci) {
    const riga = await caricaInterpello(voce.interpelloId);
    console.log(
      `  · ${voce.interpelloId.slice(0, 8)} tentativi=${voce.tentativi} · ${
        (riga?.title ?? '(interpello assente)').slice(0, 70)
      }`,
    );
  }
} else {
  // Recupero dei lock di un worker morto: senza questo una voce rimasta
  // PROCESSING non tornerebbe mai in coda.
  const riaperte = await riapriBloccati(bloccatiSecondi, { client });
  if (riaperte > 0) {
    console.log(`↻ ${riaperte} voci rimaste PROCESSING riaperte (worker interrotto).`);
  }

  const riepilogo = await consumaCoda({ ponte, dispatch: consegna, limite, worker });

  console.log('\n=== RIEPILOGO ===');
  console.log(JSON.stringify(riepilogo, null, 2));
  console.log(
    '• Email: delegata al digest giornaliero (una email al giorno) — nessun invio per opportunita.',
  );

  // Exit code 1 solo per le voci abbandonate (FAILED_NOTIF): e' l'unico esito che
  // merita un allarme del cron. I fallimenti ritentabili restano exit 0.
  process.exitCode = riepilogo.abbandonate > 0 ? 1 : 0;
}

