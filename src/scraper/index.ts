/**
 * ScuoleRadar.it — Modulo di scraping on-demand (Fase 1 · BLOCCO 1: INTERPELLI & PNRR)
 *
 * Pipeline:
 *   1. Carica le variabili d'ambiente da `.env` (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY).
 *   2. Legge le province di interesse attive (da `profiles.province_attive`; fallback env).
 *   3. Scarica le fonti reali per provincia (pagina regione → post del giorno → interpelli
 *      ufficiali). Nessun seed di test: la pipeline usa SOLO fonti live ufficiali.
 *   4. Passa ogni avviso al parser (src/scraper/parser.ts) che estrae:
 *      classi di concorso/sostegno (via Regex), data di scadenza e hash_id SHA-256 univoco.
 *   5. VALIDA ogni avviso (`verificaAvviso`): scarta titoli vuoti/da test e fonti non
 *      ufficiali/non verificabili (niente mock/dummy).
 *   6. Effettua l'UPSERT nella tabella `interpelli` di Supabase usando `hash_id`
 *      (onConflict) per ignorare i duplicati; fallback sulla tabella legacy `notices`.
 *   7. Invia le notifiche per i soli interpelli NUOVI (email/Telegram) e pubblica sui
 *      canali regionali — vedi src/lib/notifier.ts e src/lib/telegram.ts.
 *
 * Uso:
 *   npm run scrape                       # pipeline completa (serve .env valido)
 *   npm run scrape -- --dry-run          # solo estrazione + validazione, nessun inserimento
 *   npm run scrape -- --no-email         # disattiva le notifiche email
 */

import process from 'node:process';
import axios from 'axios';
import * as cheerio from 'cheerio';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import {
  parseInterpello,
  estraiDataPubblicazione,
  estraiDataScadenza,
  estraiProvincia,
  rilevaCategoriaAvviso,
  sembraOpportunita,
  verificaAvviso,
  type InterpelloParsato,
} from './parser.ts';
import { notificaNuoviInterpelli } from '../lib/notifier.ts';
import {
  CHIAVE_CANALE_ATA_NAZIONALE,
  getTelegramCanaliRegionali,
  getTelegramChannels,
  pubblicaInterpelloSuCanali,
} from '../lib/telegram.ts';
import { inviaAlertaAdmin, registraRunScraper, type RunScraperLog } from './adminAlerts.ts';

/* ------------------------------- Tipi ------------------------------- */

/** Alias per retro-compatibilità: gli avvisi parsati dal nuovo parser.ts. */
export type AvvisoRilevato = InterpelloParsato;

type Env = Record<string, string>;

/* ----------------------------- Config / env ----------------------------- */

function caricaEnv(): Env {
  try {
    // Node >= 20.12: carica il file `.env` dalla cartella corrente
    process.loadEnvFile();
  } catch {
    // Nessun file .env presente: si continua con l'ambiente del sistema
  }
  return process.env as Env;
}

/**
 * Province di interesse attive, lette direttamente dalla tabella `profiles` (FASE 2):
 * raccoglie le `province_attive` dei profili esistenti.
 * Se non ci sono profili (o la tabella non è ancora pronta), usa il fallback di test da env.
 */
async function ottieniProvinceAttive(env: Env, supabase: SupabaseClient | null): Promise<string[]> {
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('province_attive');

      if (error) {
        console.warn(`⚠ Lettura profiles: ${error.message} — uso il fallback di test.`);
      } else if (data && data.length > 0) {
        const province = new Set<string>();
        for (const riga of data) {
          for (const p of (riga.province_attive ?? []) as string[]) {
            if (typeof p === 'string' && p.trim()) province.add(p.trim().toUpperCase());
          }
        }
        if (province.size > 0) {
          console.log(`• Province attive lette da profiles: ${[...province].join(', ')}`);
          return [...province];
        }
        console.warn('⚠ Profili presenti ma senza province attive: uso il fallback di test.');
      } else {
        console.warn('⚠ Nessun profilo onboarded con province attive: uso il fallback di test.');
      }
    } catch (err) {
      console.warn(`⚠ Lettura province da profiles non riuscita: ${(err as Error).message} — uso il fallback di test.`);
    }
  }

  const raw = env.SCRAPER_PROVINCE_TEST ?? 'MI,TO';
  return raw
    .split(',')
    .map((p) => p.trim().toUpperCase())
    .filter(Boolean);
}

/* -------------------- Parsing (delegato a parser.ts) -------------------- */

// Estrazione di classi di concorso, date di scadenza e hash_id:
// vedi `parseInterpello` in src/scraper/parser.ts (modulo puro e testabile).

/* ------------------------------ Parsing ------------------------------ */

/**
 * Estrae gli avvisi da una pagina HTML usando cheerio.
 * Selettore di esempio: ogni avviso è un link che contiene parole chiave
 * (interpell, avviso, supplenz, bando) oppure sta dentro una riga di lista.
 */
export function parseAvvisi(html: string, provincia: string, source: string): AvvisoRilevato[] {
  const $ = cheerio.load(html);
  const risultati: AvvisoRilevato[] = [];

  $('a').each((_, el) => {
    const $el = $(el);
    const href = $el.attr('href') ?? '';
    const testo = $el.text().replace(/\s+/g, ' ').trim();

    const contesto = `${href} ${testo}`;
    // Filtro di rilevanza: vedi `sembraOpportunita` in parser.ts (copre
    // interpelli/supplenze, bandi, avvisi, selezioni di esperti, PON/POR/PNRR).
    if (!sembraOpportunita(contesto)) return;
    if (testo.length < 10) return;

    // Scadenza e pubblicazione sono estratte dal PARSER in modo contestuale
    // (qui si passa solo il testo del link + del contenitore, senza pre-assegnare
    // la prima data trovata alla scadenza).
    const contenitore = $el.closest('li, article, .entry, .post, .avviso').text().replace(/\s+/g, ' ');

    let link = href;
    if (href && !href.startsWith('http')) {
      try {
        link = new URL(href, source).href;
      } catch {
        link = href;
      }
    }

    risultati.push(
      parseInterpello({
        title: testo,
        link: link || null,
        provincia,
        source,
        corpo: contenitore,
      }),
    );
  });

  return risultati;
}

/* ------------------------------- Fetch ------------------------------- */

async function scaricaPagina(url: string): Promise<string> {
  const { data } = await axios.get<string>(url, {
    timeout: 15_000,
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36 ScuoleRadar/0.1',
      Accept: 'text/html,application/xhtml+xml',
    },
  });
  return data;
}

/* --------------------------- Fonti reali (per provincia) --------------------------- */

interface FonteProvincia {
  provincia: string;
  url: string;
}

/** Fonti reali di interpelli: una landing per REGIONE (provincia rappresentativa). */
const FONTI_REALI: FonteProvincia[] = [
  { provincia: 'MI', url: 'https://www.scuolainterpelli.it/interpelli-lombardia/' },
  { provincia: 'RM', url: 'https://www.scuolainterpelli.it/interpelli-lazio/' },
  { provincia: 'VE', url: 'https://www.scuolainterpelli.it/interpelli-veneto/' },
  { provincia: 'BO', url: 'https://www.scuolainterpelli.it/interpelli-emilia-romagna/' },
  { provincia: 'FI', url: 'https://www.scuolainterpelli.it/interpelli-toscana/' },
  { provincia: 'NA', url: 'https://www.scuolainterpelli.it/interpelli-campania/' },
  { provincia: 'PA', url: 'https://www.scuolainterpelli.it/interpelli-sicilia/' },
  { provincia: 'BA', url: 'https://www.scuolainterpelli.it/interpelli-puglia/' },
  { provincia: 'TO', url: 'https://www.scuolainterpelli.it/tag/interpelli-scuola-piemonte/' },
];

/**
 * Estrae gli URL dei post giornalieri ("Interpelli Scuola <data>...")
 * dalla pagina di elenco di una regione/tag.
 */
export function parsePostUrl(html: string): string[] {
  const $ = cheerio.load(html);
  const urls = new Set<string>();
  $('a').each((_, el) => {
    const href = $(el).attr('href') ?? '';
    const testo = $(el).text().replace(/\s+/g, ' ').trim();
    if (/interpelli-scuola-\d/.test(href) && testo.length >= 15) urls.add(href);
  });
  return [...urls];
}

/**
 * Estrae i singoli interpelli (link esterni ufficiali) dal contenuto di un post
 * giornaliero. Il post è NAZIONALE: le voci sono blocchi <p>/<li> sequenziali,
 * precedute da "Interpelli pubblicati da: <CITTÀ>"; la voce contiene le classi e
 * il link ufficiale. Si cammina l'intero contenuto in ORDINE di documento per
 * associare a ogni voce la CITTÀ corrente (→ provincia reale) e le classi,
 * coprendo così TUTTE le regioni d'Italia in un solo passaggio.
 */
export function parsePostInterpelli(
  postHtml: string,
  provincia: string,
  source: string,
): AvvisoRilevato[] {
  const $ = cheerio.load(postHtml);
  const contenuto = $('.entry-content, article, .post-content, main').first();
  const titoloPost = $('h1.entry-title, article h1, .entry-title').first().text();
  // Il titolo del post è l'INTESTAZIONE: la sua data è la PUBBLICAZIONE (non la scadenza).
  const dataPubblicazione = estraiDataPubblicazione(titoloPost);

  const risultato: AvvisoRilevato[] = [];
  let cittaCorrente = '';

  contenuto.find('p, li, h2, h3, h4').each((_, el) => {
    const $blocco = $(el);
    const testoBlocco = $blocco.text().replace(/\s+/g, ' ').trim();
    if (!testoBlocco) return;

    // Aggiorna la città corrente ("Interpelli pubblicati da: BERGAMO" in un <h3>).
    const mCitta = testoBlocco.match(
      /pubblicat[ie]\s+da\s*:?\s*([A-ZÀ-Ý][A-Za-zÀ-ÿ'’.\- ]{1,40})/,
    );
    if (mCitta) {
      cittaCorrente = mCitta[1].split(/[|/–—-]|\d/)[0]?.trim() || cittaCorrente;
    }

    // Link ESTERNI della voce (fonte ufficiale dell'interpello).
    const $link = $blocco
      .find('a[href^="http"]')
      .filter((_, a) => {
        const h = $(a).attr('href') ?? '';
        return !/scuolainterpelli\.it|t\.me|facebook|twitter|pinterest|whatsapp|linkedin|instagram|altervista|iubenda/.test(
          h,
        );
      })
      .first();
    if ($link.length === 0) return;

    const href = $link.attr('href') ?? '';
    const testoLink = $link
      .text()
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/\s*\[\d+(?:[.,]\d+)?\s*(?:KB|MB)\]\s*$/i, '');

    // Titolo: testo descrittivo del link; per le voci "VISUALIZZA INTERPELLI" si
    // usa la riga della voce (città + classi) ripulita dall'etichetta generica.
    let titolo = /^visualizza/i.test(testoLink) || testoLink.length < 8 ? '' : testoLink;
    if (!titolo) {
      titolo = testoBlocco
        .replace(/VISUALIZZA INTERPELLI/i, '')
        .replace(/[–—-]\s*$/, '')
        .trim();
    }
    if (titolo.length < 8) return;

    // Città → codice provincia (fallback: provincia della fonte). Il codice
    // risolto entra anche nell'hash_id → niente duplicati tra fonti diverse.
    const codiceCitta = cittaCorrente ? estraiProvincia(cittaCorrente) : null;

    risultato.push(
      parseInterpello({
        title: titolo.slice(0, 300),
        link: href,
        provincia: codiceCitta ?? provincia,
        source,
        corpo: `${cittaCorrente} ${testoBlocco}`,
        dataPubblicazione,
      }),
    );
  });

  return risultato;
}

// Conversione delle date testuali italiane ("22 agosto 2026") e numeriche, con
// distinzione tra PUBBLICAZIONE e SCADENZA: gestita dal parser in
// src/scraper/parser.ts (estraiDataPubblicazione / estraiDataScadenza).

/** Verifica che un link sia raggiungibile (HEAD con fallback GET). */
async function verificaLink(url: string): Promise<boolean> {
  const opts = { timeout: 10_000, maxRedirects: 5, validateStatus: (s: number) => s < 400 };
  try {
    await axios.head(url, opts);
    return true;
  } catch {
    try {
      const res = await axios.get(url, { ...opts, responseType: 'arraybuffer' });
      return res.status < 400;
    } catch {
      return false;
    }
  }
}

/** Raccolta interpelli dalle fonti reali: pagina regione → post del giorno → link ufficiali. */
async function raccogliAvvisiReali(
  env: Env,
  province: string[],
): Promise<{ avvisi: AvvisoRilevato[]; fonti: string }> {
  const avvisi: AvvisoRilevato[] = [];
  const descrizioneFonti: string[] = [];

  for (const provincia of province) {
    const fonte = FONTI_REALI.find((f) => f.provincia === provincia);
    if (!fonte) {
      console.warn(`⚠ Nessuna fonte configurata per la provincia ${provincia} (aggiungila a FONTI_REALI)`);
      continue;
    }
    descrizioneFonti.push(`${fonte.provincia}→${fonte.url}`);

    let lista: string;
    try {
      lista = await scaricaPagina(fonte.url);
    } catch (err) {
      console.warn(`⚠ Fetch pagina regione [${fonte.provincia}] non riuscito: ${(err as Error).message}`);
      continue;
    }

    const postUrl = parsePostUrl(lista);
    if (postUrl.length === 0) {
      console.warn(`⚠ Nessun post giornaliero trovato per [${fonte.provincia}]`);
      continue;
    }
    const primoPost = postUrl[0];
    console.log(`• [${fonte.provincia}] ultimo post: ${primoPost}`);

    let postHtml: string;
    try {
      postHtml = await scaricaPagina(primoPost);
    } catch (err) {
      console.warn(`⚠ Fetch del post non riuscito: ${(err as Error).message}`);
      continue;
    }

    const estratti = parsePostInterpelli(postHtml, fonte.provincia, primoPost);
    console.log(`• [${fonte.provincia}] interpelli estratti dal post: ${estratti.length}`);
    avvisi.push(...estratti);
  }

  return { avvisi, fonti: descrizioneFonti.join(' · ') };
}

/**
 * Arricchisce la SCADENZA degli avvisi che non la dichiarano nell'elenco:
 * scarica la PAGINA UFFICIALE e prova a estrarre "scadenza / entro il / termine…"
 * dal suo testo. Best-effort e limitato (max N richieste); non inventa mai date.
 */
async function arricchisciScadenze(avvisi: AvvisoRilevato[], max = 20): Promise<number> {
  const senzaScadenza = avvisi.filter((a) => !a.expirationDate && a.link);
  if (senzaScadenza.length === 0) return 0;
  let arricchiti = 0;
  for (const a of senzaScadenza.slice(0, max)) {
    try {
      const html = await scaricaPagina(a.link as string);
      const testo = cheerio.load(html).text().replace(/\s+/g, ' ');
      const scad = estraiDataScadenza(testo);
      if (scad) {
        a.expirationDate = scad;
        arricchiti += 1;
      }
    } catch {
      // pagina non raggiungibile: l'avviso resta senza scadenza (nessuna data inventata)
    }
  }
  console.log(
    `• Scadenze: ${arricchiti}/${Math.min(senzaScadenza.length, max)} arricchite dalla pagina ufficiale (${senzaScadenza.length} avvisi senza data dichiarata).`,
  );
  return arricchiti;
}

/* ------------------- Nessun seed di test nella pipeline ------------------- */

// La vecchia FIXTURE_HTML (dati di esempio usati per i test offline) è stata
// RIMOSSA: la pipeline di ingestione usa esclusivamente FONTI REALI ufficiali.
// La validazione `verificaAvviso` scarta comunque titoli/fonti non verificabili.

/* ------------------------------- Supabase ------------------------------- */

function clientSupabase(url: string, key: string): SupabaseClient {
  return createClient(url, key);
}

/** Mappa un avviso parsato sulle colonne della tabella `interpelli` (FASE 2 schema). */
function mappaRigaInterpelli(a: InterpelloParsato) {
  return {
    hash_id: a.hashId,
    title: a.title,
    province: a.province,
    class_codes: a.classCodes,
    school_name: a.schoolName,
    school_code: a.schoolCode,
    source_url: a.link,
    published_at: a.publishedAt,
    expiration_date: a.expirationDate,
    materia: a.materia,
    contact_email: a.contactEmail,
  };
}

/** Mappa un avviso parsato sulle colonne della tabella legacy `notices`. */
function mappaRigaNotices(a: InterpelloParsato) {
  return {
    hash_id: a.hashId,
    title: a.title,
    source_url: a.link,
    province: a.province,
    class_codes: a.classCodes,
    expiration_date: a.expirationDate,
  };
}

/* ------------------------ Upsert resiliente interpelli ------------------------ */

/** Colonne "recenti" che possono non esistere ancora se le migrazioni non sono applicate. */
const COLONNE_OPZIONALI = ['published_at', 'materia', 'contact_email'];

/**
 * Upsert resiliente su `interpelli`: se il DB non ha ancora le colonne OPZIONALI
 * recenti, le rimuove dal payload e riprova. Evita così il fallback su `notices`
 * (legacy) quando le migrazioni non sono ancora state applicate.
 */
async function upsertInterpelliResiliente(
  supabase: SupabaseClient,
  righe: ReturnType<typeof mappaRigaInterpelli>[],
): Promise<{ error: { message: string } | null; rimosse: string[] }> {
  let payload = righe.map((r) => ({ ...r })) as Array<Record<string, unknown>>;
  const rimosse: string[] = [];
  for (let tentativo = 0; tentativo <= COLONNE_OPZIONALI.length; tentativo += 1) {
    const { error } = (await supabase
      .from('interpelli')
      .upsert(payload as never, { onConflict: 'hash_id', ignoreDuplicates: true })) as {
      error: { message: string } | null;
    };
    if (!error) return { error: null, rimosse };
    const colonna = error.message.match(/Could not find the '([^']+)' column/i)?.[1];
    if (!colonna || !COLONNE_OPZIONALI.includes(colonna)) return { error, rimosse };
    rimosse.push(colonna);
    payload = payload.map((r) => {
      const copia = { ...r };
      delete copia[colonna];
      return copia;
    });
  }
  return {
    error: { message: `Impossibile adattare l'upsert (colonne: ${rimosse.join(', ')})` },
    rimosse,
  };
}

/* ------------------------------ Notifiche email (FASE 4) ------------------------------ */

// L'invio delle notifiche email è gestito dal modulo condiviso src/lib/notifier.ts:
// riceve i nuovi interpelli, interroga il Matching Engine (findUtentiCompatibili)
// per trovare gli utenti con preferenze compatibili e invia le mail via Resend.

/* -------------------- Canali Telegram regionali (FASE 5) -------------------- */

/** Esito aggregato della pubblicazione Telegram sui canali. */
interface EsitoCanaliTelegram {
  attesi: number;
  riusciti: number;
  falliti: number;
  senzaCanale: number;
}

/**
 * Pubblica gli avvisi NUOVI sulle destinazioni Telegram corrette:
 *   - il canale REGIONALE attivo della provincia (9 canali regionali attivi
 *     configurati in src/lib/telegram.ts → CANALI_TELEGRAM_REGIONALI);
 *   - il canale ATA nazionale @scuoleradar_ata in AGGIUNTA per ogni
 *     🔵 [AVVISO ATA], da qualunque regione d'Italia.
 * Gli errori vengono loggati singolarmente: nessun fallimento silenzioso.
 * Ritorna le statistiche di invio (per diagnostica/alert).
 */
async function pubblicaNuoviSuCanali(nuovi: AvvisoRilevato[]): Promise<EsitoCanaliTelegram> {
  const nessuno: EsitoCanaliTelegram = { attesi: 0, riusciti: 0, falliti: 0, senzaCanale: 0 };
  if (nuovi.length === 0) return nessuno;

  const canaliAttivi = getTelegramCanaliRegionali();
  const canaleAta = canaliAttivi[CHIAVE_CANALE_ATA_NAZIONALE] ?? null;
  const overrideProvince = getTelegramChannels();
  if (Object.keys(canaliAttivi).length === 0 && Object.keys(overrideProvince).length === 0) return nessuno;

  const regionaliAttivi = Object.keys(canaliAttivi).filter(
    (chiave) => chiave !== CHIAVE_CANALE_ATA_NAZIONALE,
  );
  console.log(
    `• Pubblicazione Telegram: ${regionaliAttivi.length} canali regionali attivi${
      canaleAta ? ` + ATA nazionale (${canaleAta})` : ''
    } + ${Object.keys(overrideProvince).length} override per provincia`,
  );

  let inviiRiusciti = 0;
  let inviiAttesi = 0;
  let falliti = 0;
  let senzaCanale = 0;
  for (const n of nuovi) {
    const esito = await pubblicaInterpelloSuCanali({
      title: n.title,
      schoolName: n.schoolName,
      province: n.province,
      classCodes: n.classCodes,
      materia: n.materia,
      contactEmail: n.contactEmail,
      expirationDate: n.expirationDate,
      link: n.link,
    });
    inviiAttesi += esito.destinazioni.length;
    if (esito.destinazioni.length === 0) {
      senzaCanale += 1;
      console.warn(
        `  – [${n.province}] nessun canale attivo per la regione (${n.title.slice(0, 60)})`,
      );
      continue;
    }
    inviiRiusciti += esito.pubblicati;
    falliti += esito.errori.length;
    if (esito.errori.length === 0) {
      console.log(
        `  ✓ [${n.province}] → ${esito.destinazioni.join(', ')}: ${n.title.slice(0, 50)}`,
      );
    } else {
      for (const e of esito.errori) {
        console.warn(`  ✗ [${n.province}] → ${e.canale}: ${e.errore} (${n.title.slice(0, 50)})`);
      }
    }
  }
  console.log(
    `  ✓ Canali Telegram: ${inviiRiusciti}/${inviiAttesi} invii riusciti (${nuovi.length} avvisi)`,
  );
  return { attesi: inviiAttesi, riusciti: inviiRiusciti, falliti, senzaCanale };
}

/**
 * Chiude una run dello scraper: registra le statistiche in `scraper_runs`
 * (diagnostica remota `/status`) e invia un ALERT ad ADMIN_TELEGRAM_ID se
 * rileva un fallimento critico o un'anomalia di routing Telegram.
 */
async function concludiRun(run: RunScraperLog): Promise<void> {
  const registrata = await registraRunScraper(run);
  if (!registrata && run.esito !== 'ok') {
    console.warn('⚠ Registrazione run non riuscita (tabella scraper_runs non disponibile?).');
  }

  if (run.esito === 'error') {
    await inviaAlertaAdmin({
      severity: 'critical',
      category: 'scraper',
      title: 'Scraper interpelli: errore critico',
      message: run.messaggio ?? 'Errore non specificato durante lo scraping.',
      meta: {
        modalita: run.modalita,
        province: run.province,
        trovati: run.trovati,
        nuovi: run.nuovi,
        errori: run.errori,
      },
    });
    return;
  }
  if (!run.upsertOk) {
    await inviaAlertaAdmin({
      severity: 'warning',
      category: 'database',
      title: 'Scraper: scrittura su interpelli non riuscita',
      message: run.messaggio ?? 'Upsert su `interpelli` fallito (usato fallback).',
      meta: { province: run.province, nuovi: run.nuovi },
    });
    return;
  }
  if (run.telegramAttesi > 0 && run.telegramRiusciti < run.telegramAttesi) {
    await inviaAlertaAdmin({
      severity: 'warning',
      category: 'routing',
      title: 'Anomalia di routing Telegram',
      message:
        `Invii Telegram riusciti ${run.telegramRiusciti}/${run.telegramAttesi}. ` +
        'Verifica che il bot sia amministratore dei canali e la mappatura regioni (nessun canale di default).',
      meta: { province: run.province, falliti: run.telegramAttesi - run.telegramRiusciti },
    });
  }
}

/* -------------------------------- main -------------------------------- */

async function main() {
  const env = caricaEnv();
  const isDryRun = process.argv.includes('--dry-run');
  const noEmail = process.argv.includes('--no-email');
  const inizio = Date.now();

  const url = env.SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY ?? env.SUPABASE_ANON_KEY;
  const supabase = url && key ? clientSupabase(url, key) : null;

  const province = await ottieniProvinceAttive(env, supabase);

  console.log('━━ ScuoleRadar Scraper (Fase 1 · BLOCCO 1) ━━');
  console.log(`• Province attive: ${province.join(', ')}`);
  console.log(`• Modalità: fonti reali (web) · inserimento: ${isDryRun ? 'DISATTIVATO (dry-run)' : 'Supabase'} · email: ${noEmail ? 'DISATTIVATE' : 'attive (Resend)'}`);

  // SOLO fonti reali (nessun fixture/seed): la pipeline non usa dati di test.
  const { avvisi, fonti } = await raccogliAvvisiReali(env, province);
  let trovati: AvvisoRilevato[] = avvisi;
  console.log(`• Fonti reali: ${fonti}`);
  console.log('• Verifica raggiungibilità dei link…');
  const raggiungibiliList: AvvisoRilevato[] = [];
  let raggiungibili = 0;
  for (const a of trovati) {
    const ok = await verificaLink(a.link ?? '');
    if (ok) {
      raggiungibili++;
      raggiungibiliList.push(a);
    } else {
      console.warn(`  ✗ scartato (link non raggiungibile): ${a.link}`);
    }
  }
  console.log(`• Link raggiungibili: ${raggiungibili}/${trovati.length}`);
  trovati = raggiungibiliList;

  // Scadenze mancanti: prova a estrarle dalla pagina ufficiale (best-effort).
  await arricchisciScadenze(trovati, Number(env.SCRAPER_SCADENZA_MAX ?? 20));

  // Dedupe per hash_id + VALIDAZIONE anti-dummy (solo fonti ufficiali verificabili).
  const dedup = [...new Map(trovati.map((t) => [t.hashId, t])).values()];
  const scartatiValidazione: { motivo: string; title: string }[] = [];
  const unici = dedup.filter((a) => {
    const esito = verificaAvviso({ title: a.title, link: a.link });
    if (!esito.ok) {
      scartatiValidazione.push({ motivo: esito.motivo ?? 'non verificato', title: a.title });
      return false;
    }
    return true;
  });
  console.log(
    `• Interpelli estratti: ${trovati.length} · unici per hash_id: ${dedup.length} · verificati: ${unici.length}`,
  );
  if (scartatiValidazione.length > 0) {
    console.warn(
      `⚠ Scartati ${scartatiValidazione.length} avvisi non verificati (mock/test/fonte non ufficiale):`,
    );
    for (const s of scartatiValidazione.slice(0, 10)) {
      console.warn(`   ✗ ${s.motivo} — ${s.title.slice(0, 60)}`);
    }
  }

  unici.forEach((n) => {
    console.log(
      `  [${n.province}] ${n.title.slice(0, 70)} | tipo: ${rilevaCategoriaAvviso(n.title)} | scad: ${
        n.expirationDate ?? 'n/d'
      } | classi: ${
        n.classCodes.length ? n.classCodes.join(', ') : 'n/d'
      } | hash: ${n.hashId.slice(0, 12)}…`,
    );
  });

  if (unici.length === 0) {
    console.log('Nessun interpello trovato nelle fonti. Verifica URL o selettori.');
    if (!isDryRun) {
      await concludiRun({
        modalita: 'reali',
        province,
        trovati: 0,
        nuovi: 0,
        upsertOk: true,
        telegramAttesi: 0,
        telegramRiusciti: 0,
        errori: 0,
        esito: 'warn',
        messaggio: 'Nessun interpello trovato nelle fonti (possibile cambio di selettori/URL).',
        durataMs: Date.now() - inizio,
      });
    }
    return;
  }

  if (isDryRun) {
    console.log('✓ DRY-RUN completato: nessun dato inviato a Supabase.');
    return;
  }

  if (!supabase) {
    console.error('✗ Mancano SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY nel file .env');
    console.error('  Copia .env.example in .env e compila le credenziali.');
    process.exitCode = 1;
    await concludiRun({
      modalita: 'reali',
      province,
      trovati: unici.length,
      nuovi: 0,
      upsertOk: false,
      telegramAttesi: 0,
      telegramRiusciti: 0,
      errori: 1,
      esito: 'error',
      messaggio: 'Credenziali Supabase mancanti (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY).',
      durataMs: Date.now() - inizio,
    });
    return;
  }

  // FASE 4 — determina quali interpelli sono realmente NUOVI (per le notifiche email)
  const { data: righeEsistenti } = (await supabase
    .from('interpelli')
    .select('hash_id')
    .in('hash_id', unici.map((u) => u.hashId))) as {
    data: { hash_id: string }[] | null;
    error: { message: string } | null;
  };
  const hashEsistenti = new Set((righeEsistenti ?? []).map((r) => r.hash_id));
  const nuovi = unici.filter((u) => !hashEsistenti.has(u.hashId));
  console.log(`• Interpelli NUOVI nel DB: ${nuovi.length} (candidati alle notifiche email)`);

  // Upsert nella tabella `interpelli` (nuovo schema FASE 2, con school_name/school_code).
  // `onConflict: 'hash_id'` + `ignoreDuplicates` evita di reinserire gli stessi avvisi.
  const righeInterpelli = unici.map(mappaRigaInterpelli);
  const righeNotices = unici.map(mappaRigaNotices);

  const { error, rimosse } = await upsertInterpelliResiliente(supabase, righeInterpelli);
  if (rimosse.length > 0) {
    console.warn(
      `⚠ Colonne non presenti in 'interpelli' (migrazioni non applicate?) → rimosse dall'upsert: ${rimosse.join(', ')}`,
    );
  }

  if (error) {
    // Fallback per retro-compatibilità: se la tabella `interpelli` non esiste ancora
    // (migration non eseguita), si scrive sulla tabella legacy `notices`.
    console.warn(
      `⚠ Tabella interpelli non disponibile (${error.message}) — fallback sulla tabella notices.`,
    );
    const { error: errNotices } = (await supabase
      .from('notices')
      .upsert(righeNotices, { onConflict: 'hash_id', ignoreDuplicates: true })) as {
      data: unknown[] | null;
      error: { message: string } | null;
    };
    if (errNotices) {
      console.error(`✗ Errore Supabase (notices): ${errNotices.message}`);
      process.exitCode = 1;
      await concludiRun({
        modalita: 'reali',
        province,
        trovati: unici.length,
        nuovi: nuovi.length,
        upsertOk: false,
        telegramAttesi: 0,
        telegramRiusciti: 0,
        errori: 1,
        esito: 'error',
        messaggio: `Errore Supabase (notices): ${errNotices.message}`,
        durataMs: Date.now() - inizio,
      });
      return;
    }
    console.log(`✓ Upsert completato su notices (fallback · righe inviate: ${righeNotices.length}).`);

    // FASE 4 — notifiche email per i soli interpelli nuovi
    if (!noEmail) {
      await notificaNuoviInterpelli(supabase, nuovi);
    }
    // FASE 5 — canali Telegram regionali + ATA nazionale (solo avvisi NUOVI e fonti reali).
    const tgFallback = await pubblicaNuoviSuCanali(nuovi);

    await concludiRun({
      modalita: 'reali',
      province,
      trovati: unici.length,
      nuovi: nuovi.length,
      upsertOk: false,
      telegramAttesi: tgFallback.attesi,
      telegramRiusciti: tgFallback.riusciti,
      errori: tgFallback.falliti,
      esito: 'warn',
      messaggio: `Upsert su interpelli non riuscito (${error.message}); usato il fallback notices.`,
      durataMs: Date.now() - inizio,
    });
    return;
  }

  console.log(`✓ Upsert completato su interpelli (righe inviate: ${righeInterpelli.length}).`);

  // FASE 5 — canali Telegram regionali + ATA nazionale (solo avvisi NUOVI e fonti reali).
  const tg = await pubblicaNuoviSuCanali(nuovi);

  // FASE 4 — notifiche email per i soli interpelli nuovi
  if (!noEmail) {
    await notificaNuoviInterpelli(supabase, nuovi);
  }

  // Diagnostica + alert: registra la run (`scraper_runs`) e avvisa l'admin se ci
  // sono stati invii Telegram falliti o avvisi senza canale (anomalie di routing).
  await concludiRun({
    modalita: 'reali',
    province,
    trovati: unici.length,
    nuovi: nuovi.length,
    upsertOk: true,
    telegramAttesi: tg.attesi,
    telegramRiusciti: tg.riusciti,
    errori: tg.falliti,
    esito: tg.falliti > 0 || tg.senzaCanale > 0 ? 'warn' : 'ok',
    messaggio:
      tg.senzaCanale > 0 ? `${tg.senzaCanale} avvisi senza canale regionale attivo` : undefined,
    durataMs: Date.now() - inizio,
  });
}

main().catch(async (err) => {
  console.error('✗ Errore imprevisto nello scraper:', err);
  process.exitCode = 1;
  if (!process.argv.includes('--dry-run')) {
    await concludiRun({
      modalita: 'reali',
      province: [],
      trovati: 0,
      nuovi: 0,
      upsertOk: false,
      telegramAttesi: 0,
      telegramRiusciti: 0,
      errori: 1,
      esito: 'error',
      messaggio: `Errore imprevisto: ${(err as Error).message}`,
    });
  }
});

