/**
 * ScuoleRadar.it — SALUTE DEL DISPATCH RADAR (modulo, solo-Node).
 *
 * `npm run admin:health` deve dire la VERITÀ su due superfici col metro del codice di
 * produzione: i CANALI (immediati, `channel_posts_log`) e le PERSONE (differite:
 * dispatch PRO + digest, `notifications_log`). Il conteggio degli avvisi passa dallo
 * STESSO giudizio del notifier (`emailAvviso` + `risolviEmailUfficialeScuola` per la
 * PEO dal meccanografico) e dal gate della bacheca (`motivoRigaNonOpportunitaAvviso`):
 * così le righe grezze/contorno non generano più falsi «Dispatch FERMO».
 *
 * Controlla: avvisi NOTIFICABILI, consegne personali (allarme se ferme da
 * `sogliaConsegnaGiorni`), pubblicazioni sui canali, scraper, ledger, Notizie.
 * Non invia e non stampa: restituisce righe di report e anomalie, così il CLI
 * (`scripts/admin-health-check.ts`) resta sottile e il giudizio è verificabile.
 */
import { readFileSync } from 'node:fs';
import type { SupabaseClient } from '@supabase/supabase-js';
import { contaAvvisiNotificabili, dettaglioMotivi } from './avvisiNotificabili.ts';
import type { AlertaAdmin } from '../../src/scraper/adminAlerts.ts';

/** Opzioni della ricognizione. */
export interface OpzioniSalute {
  /** Ampiezza della finestra osservata, in ore. */
  ore: number;
  /** Giorni oltre i quali la sezione Notizie è considerata ferma. */
  sogliaNotizieGiorni: number;
  /** Giorni oltre i quali l'assenza di consegne personali è un'anomalia. */
  sogliaConsegnaGiorni: number;
  /** Archivio ingestito delle notizie (percorso relativo alla radice del progetto). */
  fileNotizie: string;
}

/** Esito della ricognizione: righe di report (da stampare) + anomalie. */
export interface EsitoSalute {
  /** Inizio della finestra (ISO): serve all'intestazione del report. */
  daISO: string;
  report: RigaReport[];
  allarmi: AlertaAdmin[];
}

/** Riga di report: `ok` decide la spunta (✓) o l'avviso (⚠) nel CLI. */
type RigaReport = { ok: boolean; testo: string };

/**
 * Ledger notifiche personali nella finestra. `totale: null` = NON leggibile (tabella
 * assente): è «ledger non disponibile», NON «0 notifiche» — PostgREST con `head:true`
 * non fallisce quando la tabella manca, ritorna `null`.
 */
async function leggiLedgerNotifiche(
  sb: SupabaseClient,
  daISO: string,
): Promise<{ totale: number | null; ultima: string | null }> {
  const { count, error } = await sb
    .from('notifications_log')
    .select('interpello_hash', { count: 'exact', head: true })
    .gte('sent_at', daISO);
  if (error || typeof count !== 'number') return { totale: null, ultima: null };
  const { data } = await sb
    .from('notifications_log')
    .select('sent_at')
    .order('sent_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  return { totale: count, ultima: (data?.sent_at as string) ?? null };
}

/** Pubblicazioni sui canali Telegram nella finestra (`null` = ledger non leggibile). */
async function leggiPostCanali(sb: SupabaseClient, daISO: string): Promise<number | null> {
  const { count, error } = await sb
    .from('channel_posts_log')
    .select('canale', { count: 'exact', head: true })
    .gte('sent_at', daISO);
  return !error && typeof count === 'number' ? count : null;
}

/** Data più recente dell'archivio notizie ingestito (`null` = archivio non letto). */
function leggiUltimaNotizia(fileNotizie: string): { data: string | null; letto: boolean } {
  try {
    const sorgente = readFileSync(fileNotizie, 'utf8');
    const date = [...sorgente.matchAll(/"published_at":\s*"(\d{4}-\d{2}-\d{2})/g)].map((m) => m[1]);
    return { data: date.sort().at(-1) ?? null, letto: true };
  } catch {
    return { data: null, letto: false };
  }
}

/** Utenti con Radar attivo che hanno almeno un canale di recapito. */
async function contaUtentiAttivi(sb: SupabaseClient): Promise<number> {
  const { data } = await sb
    .from('profiles')
    .select('telegram_chat_id,email,email_notifica')
    .eq('radar_attivo', true);
  return (data ?? []).filter(
    (u) =>
      String(u.telegram_chat_id ?? '').trim() !== '' ||
      /@/.test(String(u.email_notifica || u.email || '')),
  ).length;
}


/** Ricognizione completa: righe di report + anomalie (nessun invio, nessuna stampa). */
export async function esaminaSaluteDispatch(
  sb: SupabaseClient,
  opts: OpzioniSalute,
): Promise<EsitoSalute> {
  const finestraMs = Math.max(1, opts.ore) * 3_600_000;
  const daISO = new Date(Date.now() - finestraMs).toISOString();

  // --- Letture (tutte tolleranti: un guasto diventa un allarme, mai un crash) ---
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
  const notifiche = await leggiLedgerNotifiche(sb, daISO);
  const postCanali = await leggiPostCanali(sb, daISO);
  const avvisi = await contaAvvisiNotificabili(sb, daISO);
  const { data: ultimaRun } = await sb
    .from('scraper_runs')
    .select('finished_at,esito,messaggio,nuovi')
    .order('finished_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  const attivi = await contaUtentiAttivi(sb);
  const notizie = leggiUltimaNotizia(opts.fileNotizie);
  const giorniNotizie = notizie.data
    ? Math.floor((Date.now() - new Date(notizie.data).getTime()) / 86_400_000)
    : null;
  // GIORNI dall'ULTIMA consegna personale: intercetta un TRIGGER di consegna fermo
  // (es. workflow del digest che non gira) anche quando le fonti non producono nulla.
  const giorniUltimaConsegna = notifiche.ultima
    ? Math.floor((Date.now() - new Date(notifiche.ultima).getTime()) / 86_400_000)
    : null;
  const consegneFerme =
    attivi > 0 &&
    (giorniUltimaConsegna === null || giorniUltimaConsegna > opts.sogliaConsegnaGiorni);

  // --- Report: i numeri che contano (avvisi NOTIFICABILI, canali), non le righe grezze ---
  const dettaglio = dettaglioMotivi(avvisi.motivi);
  const scartati = avvisi.notificabili == null ? 'n/d' : (interpelliRecenti ?? 0) - avvisi.notificabili;
  const report: RigaReport[] = [
    { ok: true, testo: `Nuovi interpelli nella finestra: ${interpelliRecenti ?? 0} (ultimo: ${ultimoInterpello?.created_at ?? 'nessuno'})` },
    { ok: notifiche.totale == null || notifiche.totale > 0, testo: `Notifiche inviate nella finestra: ${notifiche.totale ?? 'n/d'} (ultima: ${notifiche.ultima ?? 'nessuna'})` },
    { ok: true, testo: `Utenti con Radar attivo e canale: ${attivi}` },
    {
      ok: avvisi.notificabili == null || avvisi.notificabili > 0 || (interpelliRecenti ?? 0) === 0,
      testo:
        `Avvisi NOTIFICABILI nella finestra: ${avvisi.notificabili ?? 'n/d'} su ${interpelliRecenti ?? 0} ` +
        `(non-opportunità: ${avvisi.contorno} · scartati dal gate: ${scartati}${dettaglio})`,
    },
    { ok: postCanali == null || postCanali > 0, testo: `Pubblicazioni sui canali Telegram: ${postCanali ?? 'n/d'}` },
    { ok: true, testo: `Ultima run scraper: ${ultimaRun?.finished_at ?? 'nessuna'} (esito: ${ultimaRun?.esito ?? 'n/d'})` },
    {
      ok: !notizie.letto || (giorniNotizie !== null && giorniNotizie <= opts.sogliaNotizieGiorni),
      testo: `Ultima notizia datata: ${notizie.data ?? 'n/d'} (${giorniNotizie ?? 'n/d'} gg fa)`,
    },
  ];

  if (consegneFerme) {
    report.push({
      ok: false,
      testo:
        `Ultima consegna personale: ${giorniUltimaConsegna === null ? 'mai' : `${giorniUltimaConsegna} gg fa`} ` +
        `(${notifiche.ultima ?? 'nessuna'}) → ${attivi} utenti attivi senza consegne da oltre ${opts.sogliaConsegnaGiorni} gg`,
    });
  }

  // --- Anomalie ---
  const allarmi: AlertaAdmin[] = [];
  const datiRecenti = (interpelliRecenti ?? 0) > 0;
  const nessunaNotifica = notifiche.totale === 0;
  const notificabili = avvisi.notificabili ?? 0;
  const runFerma =
    !ultimaRun?.finished_at || new Date(ultimaRun.finished_at).getTime() < Date.now() - finestraMs;

  if (notifiche.totale == null) allarmi.push({ severity: 'warning', category: 'infrastruttura', title: 'Ledger notifiche non disponibile: monitoraggio dispatch degradato', message: 'La tabella `public.notifications_log` non è leggibile (migrazione non applicata?). Senza ledger non si può rilevare un dispatch Radar FERMO: applicare la migrazione.', meta: { tabella: 'notifications_log' } });

  // DISPATCH PERSONALE FERMO (critical) SOLO con materiale notificabile: se nessun
  // avviso della finestra supera il gate, 0 notifiche è il risultato ATTESO, non una
  // rottura del dispatch (era la causa del falso allarme quotidiano).
  if (datiRecenti && nessunaNotifica && notificabili > 0) allarmi.push({ severity: 'critical', category: 'notifiche', title: 'Dispatch Radar FERMO: avvisi notificabili ma nessuna notifica', message: `Nelle ultime ${opts.ore}h sono entrati ${notificabili} avvisi NOTIFICABILI (link diretto + recapito) ma NON è partita alcuna notifica (email/Telegram). Verificare matching engine, profili con Radar attivo, canali collegati e notifier.`, meta: { ore: opts.ore, notificabili, interpelli: interpelliRecenti, attivi } });
  else if (datiRecenti && nessunaNotifica && avvisi.notificabili != null) allarmi.push({ severity: 'warning', category: 'notifiche', title: 'Nessun avviso notificabile: 0 notifiche personali attese', message: `Nelle ultime ${opts.ore}h sono entrati ${interpelliRecenti} avvisi ma NESSUNO è notificabile${dettaglio} (non-opportunità: ${avvisi.contorno}). Il gate di qualità (link diretto + recapito di candidatura) non ha nulla da consegnare: 0 notifiche è ATTESO. Pubblicazioni sui canali nella stessa finestra: ${postCanali ?? 'n/d'}. Se il caso persiste: verificare le FONTI (contorno / avvisi senza recapito) e l'arricchimento anagrafico.`, meta: { ore: opts.ore, interpelli: interpelliRecenti, notificabili: 0, nonOpportunita: avvisi.contorno, motivi: Object.fromEntries(avvisi.motivi), postCanali, attivi } });

  if (datiRecenti && postCanali === 0) allarmi.push({ severity: 'critical', category: 'notifiche', title: 'Canali Telegram non alimentati: nessuna pubblicazione', message: `Nelle ultime ${opts.ore}h sono entrati ${interpelliRecenti} avvisi ma NESSUNA pubblicazione è registrata in \`channel_posts_log\`: il dispatch sui canali regionali/ATA è interrotto. Verificare TELEGRAM_BOT_TOKEN, i canali attivi e il ledger anti-duplicato.`, meta: { ore: opts.ore, interpelli: interpelliRecenti, postCanali: 0 } });
  else if (datiRecenti && postCanali == null) allarmi.push({ severity: 'warning', category: 'infrastruttura', title: 'Ledger dei canali non raggiungibile', message: 'La tabella `public.channel_posts_log` non è leggibile: non è possibile dire se gli avvisi sono stati pubblicati sui canali Telegram.', meta: { tabella: 'channel_posts_log' } });

  if (runFerma) allarmi.push({ severity: 'warning', category: 'scraper', title: 'Scraper interpelli fermo', message: `Nessuna run di scraping nelle ultime ${opts.ore}h (ultima: ${ultimaRun?.finished_at ?? 'mai'}). Verificare il cron GitHub Actions.`, meta: { ore: opts.ore, ultima: ultimaRun?.finished_at ?? null } });
  // CONSEGNE PERSONALI FERME: ledger leggibile e utenti attivi ma nessuna consegna da
  // oltre la soglia → il sospetto non è il matching ma il TRIGGER (cron del digest).
  if (consegneFerme) allarmi.push({ severity: 'warning', category: 'notifiche', title: 'Consegne personali ferme: nessuna notifica da giorni', message: `Nessuna notifica personale consegnata ${giorniUltimaConsegna === null ? 'in archivio' : `da ${giorniUltimaConsegna} giorni`} (ultima: ${notifiche.ultima ?? 'mai'}) con ${attivi} utenti attivi. Il ledger e il matching rispondono: verificare il workflow «Digest giornaliero» (cron 15/16 UTC, che rispetta la finestra delle 17:00 italiane) e le automazioni del pannello Admin.`, meta: { ore: opts.ore, ultima: notifiche.ultima, giorni: giorniUltimaConsegna, attivi, sogliaGiorni: opts.sogliaConsegnaGiorni } });
  if (ultimaRun?.esito === 'error') allarmi.push({ severity: 'critical', category: 'scraper', title: 'Ultima run scraper in ERRORE', message: `L'ultima esecuzione dello scraper è terminata con errore: ${ultimaRun.messaggio ?? 'senza dettagli'}.`, meta: { finished_at: ultimaRun.finished_at, nuovi: ultimaRun.nuovi } });
  if (!datiRecenti && attivi > 0) allarmi.push({ severity: 'info', category: 'notifiche', title: 'Nessun dato nuovo da notificare', message: `Nelle ultime ${opts.ore}h non sono arrivati interpelli nuovi: nessuna notifica attesa per i ${attivi} utenti attivi.`, meta: { ore: opts.ore, attivi } });
  if (notizie.letto && (giorniNotizie === null || giorniNotizie > opts.sogliaNotizieGiorni)) allarmi.push({ severity: 'warning', category: 'notizie', title: 'Sezione Notizie FERMA', message: `Nessuna notizia DATATA da ${giorniNotizie ?? '∞'} giorni (ultima: ${notizie.data ?? 'nessuna'}). Verificare fonti RSS/pagine di elenco, filtri editoriali e tetto articoli (cron \`scrape-notizie\`).`, meta: { soglia_giorni: opts.sogliaNotizieGiorni, ultima: notizie.data } });

  return { daISO, report, allarmi };
}
