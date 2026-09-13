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
  estraiEmails,
  estraiProvincia,
  punteggioEmailScuola,
  rilevaCategoriaAvviso,
  sembraOpportunita,
  urlIstituzionaleEnte,
  eSorgenteVerificata,
  eUrlDocumento,
  verificaAvviso,
  type InterpelloParsato,
} from './parser.ts';
import { resolveSchoolByCode } from '../lib/school-lookup.ts';
import { notificaNuoviInterpelli, type EsitoNotifiche } from '../lib/notifier.ts';
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
        linkCandidati: link ? [link] : [],
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

  // Includiamo anche `tr` (e quindi le celle `td/th`): molte fonti provinciali
  // pubblicano gli interpelli come TABELLE multi-riga → ogni riga è un avviso.
  contenuto.find('p, li, h2, h3, h4, tr').each((_, el) => {
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

    // Link ESTERNI della voce (fonti ufficiali CANDIDATE dell'interpello).
    // Si raccolgono TUTTI i candidati: il parser sceglie il MIGLIORE (documento
    // specifico PDF/circolare/allegato, poi pagina istituzionale, poi fallback ente).
    const candidati: { href: string; testo: string }[] = [];
    $blocco.find('a[href^="http"]').each((_, a) => {
      const h = ($(a).attr('href') ?? '').trim();
      if (!h) return;
      if (/scuolainterpelli\.it|t\.me|facebook|twitter|pinterest|whatsapp|linkedin|instagram|altervista|iubenda/.test(h)) {
        return;
      }
      const t = $(a)
        .text()
        .replace(/\s+/g, ' ')
        .trim()
        .replace(/\s*\[\d+(?:[.,]\d+)?\s*(?:KB|MB)\]\s*$/i, '');
      candidati.push({ href: h, testo: t });
    });
    if (candidati.length === 0) return;

    // Email CANDIDATURA nel blocco: i `mailto:` sono nell'attributo href (non nel
    // testo visibile) → vanno estratti esplicitamente e passati al parser, così
    // non si perde il contatto al momento della pubblicazione/notifica.
    const emailBlocco: string[] = [];
    $blocco.find('a[href^="mailto:"]').each((_, a) => {
      const h = (($(a).attr('href') ?? '').replace(/^mailto:/i, '').split(/[?;,]/)[0] ?? '').trim();
      if (h.includes('@')) emailBlocco.push(h);
    });

    const href = candidati[0].href;
    const testoLink = candidati[0].testo;

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
        linkCandidati: candidati.map((c) => c.href),
        provincia: codiceCitta ?? provincia,
        source,
        corpo: `${cittaCorrente} ${testoBlocco} ${emailBlocco.join(' ')}`,
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

/* ------------------------- Arricchimento contatti ------------------------- */

/** Email estratte da un HTML: testo della pagina + link `mailto:`. */
function emailDaHtml(html: string): string[] {
  const $ = cheerio.load(html);
  const emails = new Set<string>(estraiEmails($.text()));
  $('a[href^="mailto:"]').each((_, a) => {
    const href = (($(a).attr('href') ?? '').replace(/^mailto:/i, '').split(/[?;,]/)[0] ?? '')
      .trim()
      .toLowerCase();
    if (href.includes('@')) emails.add(href);
  });
  return [...emails];
}

/** Sottolink documentali della pagina di dettaglio (allegati/circolari/avvisi). */
function sottolinkCandidati(html: string, baseUrl: string, max = 2): string[] {
  const $ = cheerio.load(html);
  const out = new Set<string>();
  $('a[href]').each((_, a) => {
    const href = ($(a).attr('href') ?? '').trim();
    if (!href || href.startsWith('#') || /^(mailto|tel|javascript):/i.test(href)) return;
    let assoluto: string;
    try {
      assoluto = new URL(href, baseUrl).href;
    } catch {
      return;
    }
    if (!/^https?:\/\//i.test(assoluto)) return;
    if (!eUrlDocumento(assoluto) && !eSorgenteVerificata(assoluto)) return;
    if (
      /(bando|avviso|interpell|supplenz|allegato|circolare|documento|protocollo|convocazione|domanda|graduator)/i.test(
        assoluto,
      )
    ) {
      out.add(assoluto);
    }
  });
  return [...out].slice(0, max);
}

/** True per URL di cui NON possiamo leggere il testo (documenti binari). */
function eDocumentoBinario(url: string): boolean {
  return /\.(pdf|docx?|odt|xlsx?|pptx?|zip)($|\?)/i.test(url);
}

/**
 * Cerca l'email di candidatura su PIÙ fonti collegate all'avviso:
 *   1. il link di dettaglio e gli altri link candidati della voce;
 *   2. i sottolink documentali (allegati/circolari) della pagina di dettaglio.
 * Sceglie l'indirizzo più pertinente all'istituto. Non inventa nulla.
 */
async function cercaEmailNelleFonti(a: AvvisoRilevato): Promise<string | null> {
  const ctx = { schoolCode: a.schoolCode, schoolName: a.schoolName };
  const radici = [...new Set([a.link, ...(a.linkCandidati ?? [])].filter((u): u is string => Boolean(u)))]
    .filter((u) => /^https?:\/\//i.test(u) && !eDocumentoBinario(u))
    .slice(0, 2);
  if (radici.length === 0) return null;

  const visitate = new Set<string>();
  const emailTrovate = new Set<string>();
  const pagine: { html: string; url: string }[] = [];

  // Livello 1: pagine di dettaglio / link candidati (testo + mailto:).
  for (const url of radici) {
    if (visitate.has(url)) continue;
    visitate.add(url);
    try {
      const html = await scaricaPagina(url);
      pagine.push({ html, url });
      for (const e of emailDaHtml(html)) emailTrovate.add(e);
    } catch {
      // pagina non raggiungibile: si prosegue
    }
  }

  // Livello 2 (solo se ancora nulla): un livello di profondità verso gli allegati.
  if (emailTrovate.size === 0) {
    for (const { html, url } of pagine) {
      for (const sub of sottolinkCandidati(html, url, 2)) {
        if (visitate.has(sub) || eDocumentoBinario(sub)) continue;
        visitate.add(sub);
        try {
          for (const e of emailDaHtml(await scaricaPagina(sub))) emailTrovate.add(e);
        } catch {
          // allegato non raggiungibile
        }
      }
    }
  }

  let migliore: string | null = null;
  let migliorPunteggio = -Infinity;
  for (const e of emailTrovate) {
    const p = punteggioEmailScuola(e, ctx);
    if (p > migliorPunteggio) {
      migliorPunteggio = p;
      migliore = e;
    }
  }
  return migliore;
}

/** Email istituzionale derivata dal codice meccanografico (convenzione MIM). */
function emailIstituzionaleDaCodice(schoolCode?: string | null): string | null {
  const info = resolveSchoolByCode(schoolCode ?? null);
  return info?.peoEmail ?? null;
}

/** Sotto questa soglia l'email è considerata debole → vale la pena approfondire. */
const SOGLIA_EMAIL_AFFIDABILE = 30;

/**
 * Arricchisce l'EMAIL di candidatura scavando su più fonti (pagina di dettaglio,
 * allegati, altri link candidati) e confrontando la pertinenza con l'istituto.
 * Ultima ratio: email istituzionale derivata dal codice meccanografico
 * (convenzione MIM, vedi `school-lookup.ts`). "Email non disponibile" resta solo
 * se NESSUNA fonte produce un indirizzo. Non inventa nulla oltre tale convenzione.
 */
async function arricchisciContatti(
  avvisi: AvvisoRilevato[],
  max = 20,
  usaCodice = true,
): Promise<number> {
  if (avvisi.length === 0) return 0;

  // Priorità agli avvisi SENZA email (poi a quelli con email).
  const ordinati = [...avvisi].sort(
    (x, y) => (x.contactEmail ? 1 : 0) - (y.contactEmail ? 1 : 0),
  );
  const campione = ordinati.slice(0, max);

  let migliorati = 0;
  let daPagine = 0;
  let daCodice = 0;
  for (const a of campione) {
    const ctx = { schoolCode: a.schoolCode, schoolName: a.schoolName };
    const attuale = a.contactEmail ?? null;
    let migliore = attuale;
    let migliorPunteggio = attuale ? punteggioEmailScuola(attuale, ctx) : -Infinity;

    // Approfondisce su più fonti solo se manca l'email o è debole.
    if (migliorPunteggio < SOGLIA_EMAIL_AFFIDABILE) {
      const trovata = await cercaEmailNelleFonti(a);
      if (trovata) {
        const p = punteggioEmailScuola(trovata, ctx);
        if (p > migliorPunteggio) {
          migliore = trovata;
          migliorPunteggio = p;
          daPagine += 1;
        }
      }
    }

    // Ultima ratio / RINFORZO: convenzione MIM sul codice meccanografico.
    // Si usa l'email derivata sia quando manca un contatto, sia quando quello
    // trovato è DEBOLE (es. dominio personale) e la derivata è più pertinente:
    // così si evita "Email non disponibile" (o un contatto sbagliato) quando
    // l'istituto ha una casella istituzionale desumibile dal codice.
    if (usaCodice && a.schoolCode && (!migliore || migliorPunteggio < SOGLIA_EMAIL_AFFIDABILE)) {
      const derivata = emailIstituzionaleDaCodice(a.schoolCode);
      if (derivata) {
        const p = punteggioEmailScuola(derivata, ctx);
        if (!migliore || p > migliorPunteggio) {
          migliore = derivata;
          migliorPunteggio = p;
          daCodice += 1;
        }
      }
    }

    if (migliore && migliore !== attuale) {
      a.contactEmail = migliore;
      migliorati += 1;
    }
  }

  console.log(
    `• Contatti: ${migliorati} email trovate/migliorate su ${campione.length} avvisi ` +
      `(${daPagine} dalle pagine collegate, ${daCodice} derivate dal codice meccanografico).`,
  );
  return migliorati;
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

/**
 * True se l'URL è SPECIFICO (non è il fallback alla radice dell'ente/regione).
 * Serve a deduplicare le notifiche per identità stabile: i fallback alla
 * homepage USR/USP sono condivisi da più avvisi distinti e NON vanno usati
 * come chiave di deduplica.
 */
function eUrlSpecifico(url?: string | null): url is string {
  const u = (url ?? '').trim();
  if (!/^https?:\/\//i.test(u)) return false;
  try {
    const p = new URL(u);
    return p.pathname.split('/').filter(Boolean).length > 0 || Boolean(p.search);
  } catch {
    return false;
  }
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
 * Guard del DISPATCH: se sono stati importati NUOVI avvisi ma nessun canale ha
 * ricevuto nulla (0 email e 0 Telegram), il ciclo di notifica è rotto → avvisa
 * subito gli admin sul bot Telegram `ScuoleRadar Admin`.
 */
async function avvisaSeDispatchFermo(
  esito: EsitoNotifiche,
  nuovi: number,
  province: string[],
): Promise<void> {
  if (nuovi <= 0) return;
  if (esito.inviate > 0 || esito.telegramInviate > 0) return;
  const errori = esito.fallite + esito.telegramFallite;
  await inviaAlertaAdmin({
    severity: 'critical',
    category: 'notifiche',
    title: 'Dispatch Radar fermo: nuovi interpelli senza alcuna notifica',
    message:
      `Importati ${nuovi} nuovi interpelli ma inviate 0 notifiche (email: 0, Telegram: 0; errori: ${errori}). ` +
      'Possibile rottura del matching o dei canali utente (verificare radar attivi e chat/email collegate).',
    meta: { nuovi, errori, province, esito },
  });
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
    if (await verificaLink(a.link ?? '')) {
      raggiungibili++;
      raggiungibiliList.push(a);
      continue;
    }
    // Link specifico non raggiungibile → fallback all'ente (USP/USR), se mappato
    // e raggiungibile. Nessun link rotto viene mai persistito.
    const ente = urlIstituzionaleEnte(a.province);
    if (ente && (await verificaLink(ente))) {
      console.warn(`  ↩ [${a.province}] link non raggiungibile → fallback ente: ${ente}`);
      a.link = ente;
      raggiungibili++;
      raggiungibiliList.push(a);
      continue;
    }
    console.warn(`  ✗ scartato (link non raggiungibile): ${a.link}`);
  }
  console.log(`• Link raggiungibili: ${raggiungibili}/${trovati.length}`);
  trovati = raggiungibiliList;

  // Scadenze mancanti: prova a estrarle dalla pagina ufficiale (best-effort).
  await arricchisciScadenze(trovati, Number(env.SCRAPER_SCADENZA_MAX ?? 20));

  // Email mancanti/deboli: arricchimento multi-fonte (pagina di dettaglio,
  // allegati, altri link) + ultima ratio dal codice meccanografico (MIM).
  await arricchisciContatti(
    trovati,
    Number(env.SCRAPER_CONTATTI_MAX ?? 60),
    env.SCRAPER_EMAIL_DA_CODICE !== '0',
  );

  // Dedupe per hash_id + VALIDAZIONE anti-dummy (solo fonti ufficiali verificabili).
  const dedup = [...new Map(trovati.map((t) => [t.hashId, t])).values()];
  const scartatiValidazione: { motivo: string; title: string }[] = [];
  const unici = dedup.filter((a) => {
    // Un link che coincide col fallback istituzionale dell'ente è accettato
    // anche se è la radice del dominio (vedi `fonteEnte` in verificaAvviso).
    const ente = urlIstituzionaleEnte(a.province);
    const esito = verificaAvviso({
      title: a.title,
      link: a.link,
      fonteEnte: Boolean(ente && a.link === ente),
    });
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

  // FASE 4 — determina quali interpelli sono realmente NUOVI (per le notifiche).
  // L'identità primaria resta l'hash_id, ma l'hash include titolo/data che sulla
  // pagina sorgente possono variare tra un run e l'altro: per NON ri-notificare
  // lo STESSO avviso (loop sul record) si escludono anche le voci il cui URL di
  // fonte è già presente in DB. La deduplica per URL vale solo per gli URL
  // SPECIFICI: i fallback alla radice dell'ente (condivisi da più avvisi) no.
  const hashCandidati = unici.map((u) => u.hashId);
  const linkSpecifici = unici.map((u) => u.link).filter(eUrlSpecifico);
  const esistentiPerHash = hashCandidati.length
    ? ((await supabase
        .from('interpelli')
        .select('hash_id, source_url')
        .in('hash_id', hashCandidati)) as { data: { hash_id: string; source_url: string }[] | null })
        .data
    : [];
  const esistentiPerUrl = linkSpecifici.length
    ? ((await supabase
        .from('interpelli')
        .select('hash_id, source_url')
        .in('source_url', linkSpecifici)) as { data: { hash_id: string; source_url: string }[] | null })
        .data
    : [];
  const hashEsistenti = new Set((esistentiPerHash ?? []).map((r) => r.hash_id));
  const urlEsistenti = new Set((esistentiPerUrl ?? []).map((r) => r.source_url));
  const nuovi = unici.filter(
    (u) => !hashEsistenti.has(u.hashId) && !(eUrlSpecifico(u.link) && urlEsistenti.has(u.link)),
  );
  console.log(
    `• Interpelli NUOVI nel DB: ${nuovi.length} (candidati alle notifiche; ` +
      `${unici.length - nuovi.length} già presenti per hash/fonte)`,
  );

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
      const esitoNot = await notificaNuoviInterpelli(supabase, nuovi);
      await avvisaSeDispatchFermo(esitoNot, nuovi.length, province);
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
    const esitoNot = await notificaNuoviInterpelli(supabase, nuovi);
    await avvisaSeDispatchFermo(esitoNot, nuovi.length, province);
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

/**
 * Esegue la pipeline SOLO quando il file è invocato come CLI (`npm run scrape`),
 * NON quando il modulo viene IMPORTATO (es. test del parser): un import non
 * avvia mai una run reale con scritture su Supabase/email/Telegram.
 * Si controllano TUTTI gli argomenti (tsx/node possono mettere il percorso in
 * posizioni diverse) per non disattivare mai l'esecuzione in produzione.
 */
const eseguitoComeCli = process.argv
  .slice(1)
  .some((a) => /[\\/]scraper[\\/]index\.(?:ts|js|mjs|cjs)$/i.test(a));

if (eseguitoComeCli) {
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
}

