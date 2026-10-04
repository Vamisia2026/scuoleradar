/**
 * ScuoleRadar.it — Motore degli INTERPELLI di lavoro (Node-only) — Capoluoghi & hub.
 *
 * PERIMETRO (separazione dei domini): questo motore pubblica SOLO opportunità di
 * lavoro (interpelli/supplenze docenti e ATA, bandi PNRR/PON/POR, incarichi per
 * esperti esterni). Le NOTIZIE editoriali del MIM vivono in
 * `src/departments/notizie/`: nessun comunicato stampa, dichiarazione o rassegna
 * entra nella bacheca né nelle notifiche (guardia `npm run test:scraper:domini`).
 *
 * Pipeline:
 *   1. `caricaEnv()` (SUPABASE_URL + SERVICE_ROLE_KEY, per profili e scrittura);
 *   2. `ottieniProvinceAttive()`: province dai profili (`profiles.province_attive`),
 *      con fallback `SCRAPER_PROVINCE_TEST` (default `MI,TO`);
 *   3. FONTI (`fonti.ts` + `fontiRegistro.ts`): hub di reclutamento USR/USP dei
 *      capoluoghi di regione (Torino, Milano, Genova, Bologna, Firenze, Roma,
 *      Napoli, Bari, Palermo, Cagliari, Perugia, Venezia…) + feed dell'aggregatore.
 *      Gli hub vengono esplorati con `hub.ts` (sezioni interpelli/avvisi); il post
 *      giornaliero dell'aggregatore è NAZIONALE e viene letto UNA volta sola;
 *   4. GATE 1 — conformità: contenuti editoriali, atti informativi (esiti,
 *      graduatorie), voci fuori target e righe senza provincia rilevabile sono
 *      scartati a monte (`qualitaOpportunita.ts`); le pagine indice diventano
 *      avvisi individuali (`elenchi.ts`, mai il link alla lista master);
 *   5. arricchimento di scadenze ed email di candidatura (fonti ufficiali);
 *   6. GATE 2 — solo bandi ATTIVI: gli scaduti non entrano in bacheca;
 *   7. GATE 3 — link: un ping fallito (403/anti-bot/timeout dei server regionali)
 *      NON scarta il record se il bando è STRUTTURATO (classe/materia + email di
 *      candidatura); gli altri vengono verificati in parallelo;
 *   8. dedupe per `hash_id` + validazione anti-mock (`verificaAvviso`) e UPSERT in
 *      `interpelli` (fallback legacy `notices`);
 *   9. pubblicazione sui canali Telegram regionali/ATA e alert in tempo reale ai
 *      soli utenti PRO (i BASE ricevono il digest delle 17:00).
 *
 * Uso:
 *   npm run scrape                       # pipeline completa (serve .env valido)
 *   npm run scrape -- --dry-run          # solo estrazione + validazione, nessun inserimento
 *   npm run scrape -- --no-email         # salta il log di accodamento per il riepilogo
 *   SCRAPER_FONTI_MAX=6 npm run scrape   # limita le fonti interrogate (budget di rete)
 *   SCRAPER_ARCHIVI=1 npm run scrape     # include gli archivi regionali (backfill)
 *   npm run fonti:verifica               # ricontrolla dal vivo tutte le URL del registro
 */

import process from 'node:process';
import axios from 'axios';
import * as cheerio from 'cheerio';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { arricchisciConAnagrafica, riepilogoAnagrafica } from './anagraficaInterpelli.ts';
import {
  parseInterpello,
  estraiDataPubblicazione,
  estraiDataScadenza,
  estraiEmails,
  deoffuscaEmail,
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
import {
  ePaginaElenco,
  eUrlElenco,
  espandiElencoInAvvisi,
  sembraTitoloElenco,
} from './elenchi.ts';
import { MAX_FONTI_PER_RUN, fontiPerRun, type FonteInterpelli } from './fonti.ts';
import { sintesiCopertura } from './fontiCopertura.ts';
import { MAX_SEZIONI_HUB, eTitoloNavigazione, scopriSezioniReclutamento } from './hub.ts';
import { motivoScartoOpportunita, valutaGateLink, eRecordStrutturato } from './qualitaOpportunita.ts';
import { statoArricchimento } from '../lib/statoArricchimento.ts';
import { inviaAlertTelegramTempoReale } from '../lib/notifier.ts';
import {
  emailDaCodiceMeccanografico,
  estraiCodiceMeccanograficoDaTesto,
  normalizzaCodiceMeccanografico,
  risolviEmailUfficialeScuola,
} from '../lib/emailScuola.ts';
import {
  CHIAVE_CANALE_ATA_NAZIONALE,
  getTelegramCanaliRegionali,
  getTelegramChannels,
  pubblicaInterpelloSuCanali,
} from '../lib/telegram.ts';
import { inviaAlertaAdmin, registraRunScraper, type RunScraperLog } from './adminAlerts.ts';
import { canaliGiaPubblicati, registraPubblicazioneCanale } from './channelLog.ts';
import { ledgerLocaleSalva } from '../lib/ledgerLocale.ts';
import { GIORNI_IMPRONTA, improntaAvviso } from '../lib/dedupAvvisi.ts';

/* ------------------------------- Tipi ------------------------------- */

/** Alias per retro-compatibilità: gli avvisi parsati dal nuovo parser.ts. */
export type AvvisoRilevato = InterpelloParsato;

type Env = Record<string, string>;

/** Contatori di raccolta (diagnostica: mai scarti silenziosi). */
interface StatsRaccolta {
  /** Righe senza provincia rilevabile (feed nazionale): scartate, mai indovinate. */
  senzaProvincia: number;
  /** Voci editoriali (comunicati/dichiarazioni/eventi) scartate: altro dominio. */
  editoriali: number;
  /** Voci fuori target (categoria non ammessa, scadute, non-opportunità). */
  fuoriTarget: number;
  /** Voci di navigazione del sito (menu/archivi/ricerca) scartate a monte. */
  navigazione: number;
}

/** Post giornalieri letti per fonte (il più recente + l'ultimo precedente). */
const MAX_POST_PER_FONTE = 2;


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

/* --------------------------- Fonti (capoluoghi & hub) --------------------------- */

// Il CATALOGO delle fonti vive in `fonti.ts` (dati in `fontiRegistro.ts`): feed
// dell'aggregatore (post NAZIONALI) + hub di reclutamento USR/USP dei capoluoghi.
// Qui restano solo gli estrattori specifici dei due formati di pagina.

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
  opts: { richiedeProvinciaRilevata?: boolean; stats?: { senzaProvincia: number } } = {},
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

    // FEED NAZIONALE (aggregatore): la provincia DEVE essere rilevata dalla riga.
    // Senza città/codice riconosciuto la riga si scarta: mai attribuire un avviso
    // alla provincia della landing regionale (era la causa di record duplicati e
    // di avvisi "spostati" in un'altra regione).
    if (opts.richiedeProvinciaRilevata && !codiceCitta) {
      if (opts.stats) opts.stats.senzaProvincia += 1;
      return;
    }

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

/**
 * Raggiungibilità del link di un avviso (HEAD con fallback GET, UA da browser).
 *
 * Cambio di politica (ping fallace): il risultato NON è più una condanna. Molti
 * server scolastici regionali rispondono 403/timeout ai client automatici; il
 * record viene quindi valutato dal `gate del link` (vedi
 * `qualitaOpportunita.ts`): se è strutturato (classe/materia + email di
 * candidatura) resta in bacheca, altrimenti si scarta.
 */
async function linkRaggiungibile(url: string): Promise<boolean> {
  const opts = {
    timeout: 12_000,
    maxRedirects: 5,
    validateStatus: (s: number) => s < 400,
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36',
      Accept: 'text/html,application/xhtml+xml,application/pdf;q=0.9,*/*;q=0.8',
      'Accept-Language': 'it-IT,it;q=0.9,en;q=0.6',
    },
  };
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

/** Raggiungibilità in PARALLELO (concorrenza limitata): N ping non sono N attese. */
async function mappaRaggiungibilita(urls: string[], concorrenza = 8): Promise<Map<string, boolean>> {
  const unici = [...new Set(urls.filter(Boolean))];
  const esiti = new Map<string, boolean>();
  for (let i = 0; i < unici.length; i += Math.max(1, concorrenza)) {
    const lotto = unici.slice(i, i + Math.max(1, concorrenza));
    const risultati = await Promise.all(lotto.map((u) => linkRaggiungibile(u)));
    lotto.forEach((u, idx) => esiti.set(u, risultati[idx] ?? false));
  }
  return esiti;
}

/**
 * CONNETTORE · FEED DELL'AGGREGATORE (post giornalieri NAZIONALI).
 *
 * L'indice e gli archivi regionali espongono gli stessi post del giorno: ogni
 * POST viene scaricato UNA volta sola (`postVisitati`, condiviso fra le fonti) e
 * ogni voce diventa un avviso con la PROPRIA provincia, rilevata dall'intestazione
 * di città (`Interpelli pubblicati da: …`). Nessuna provincia inventata: le righe
 * senza città riconosciuta si scartano e si contano.
 */
async function raccogliDaAggregatore(
  fonte: FonteInterpelli,
  postVisitati: Set<string>,
  stats: StatsRaccolta,
): Promise<AvvisoRilevato[]> {
  const avvisi: AvvisoRilevato[] = [];
  let lista: string;
  try {
    lista = await scaricaPagina(fonte.url);
  } catch (err) {
    console.warn(`⚠ Fetch fonte [${fonte.id}] non riuscito: ${(err as Error).message}`);
    return avvisi;
  }

  const postUrl = parsePostUrl(lista).filter((u) => !postVisitati.has(u));
  if (postUrl.length === 0) {
    console.log(`  – [${fonte.id}] nessun post nuovo da leggere`);
    return avvisi;
  }
  const daLeggere = postUrl.slice(0, MAX_POST_PER_FONTE);
  console.log(`  • [${fonte.id}] post da leggere: ${daLeggere.length} (di ${postUrl.length})`);

  for (const post of daLeggere) {
    postVisitati.add(post);
    let html: string;
    try {
      html = await scaricaPagina(post);
    } catch (err) {
      console.warn(`  ⚠ [${fonte.id}] fetch del post non riuscito: ${(err as Error).message}`);
      continue;
    }
    const estratti = parsePostInterpelli(html, '', post, {
      richiedeProvinciaRilevata: true,
      stats,
    });
    if (estratti.length > 0) {
      avvisi.push(...estratti);
      console.log(`  ✓ [${fonte.id}] voci con provincia rilevata: ${estratti.length}`);
      continue;
    }
    // Nessuna voce strutturata: la pagina può essere un ELENCO (indice) → si espande.
    const daElenco = espandiElencoInAvvisi(html, {
      baseUrl: post,
      provincia: '',
      source: post,
    }).filter((a) => {
      if (a.province) return true;
      stats.senzaProvincia += 1;
      return false;
    });
    if (daElenco.length > 0) {
      avvisi.push(...daElenco);
      console.log(`  ✓ [${fonte.id}] pagina elenco espansa: ${daElenco.length} voci`);
    }
  }
  return avvisi;
}

/**
 * CONNETTORE · HUB ISTITUZIONALE DEL CAPOLUOGO (USR/USP).
 *
 * 1. scarica la pagina dell'hub;
 * 2. scopre le SEZIONI di reclutamento presenti (`scopriSezioniReclutamento`,
 *    max `MAX_SEZIONI_HUB` fetch per hub) e le esplora;
 * 3. per ogni pagina: righe d'avviso (`parseAvvisi`) + espansione elenchi.
 * La provincia di fallback è quella del capoluogo dell'hub: le voci che citano
 * la scuola/città reale vengono comunque riattribuite dal parser.
 */
async function raccogliDaHub(
  fonte: FonteInterpelli,
  stats: StatsRaccolta,
): Promise<AvvisoRilevato[]> {
  const avvisi: AvvisoRilevato[] = [];
  const fallback = fonte.capoluogo ?? '';
  let html: string;
  try {
    html = await scaricaPagina(fonte.url);
  } catch (err) {
    console.warn(`⚠ Fetch hub [${fonte.id}] non riuscito: ${(err as Error).message}`);
    return avvisi;
  }

  const pagine = [fonte.url, ...scopriSezioniReclutamento(html, fonte.url, MAX_SEZIONI_HUB)];
  const hashVisti = new Set<string>();
  for (const [i, pagina] of pagine.entries()) {
    let paginaHtml = html;
    if (i > 0) {
      try {
        paginaHtml = await scaricaPagina(pagina);
      } catch (err) {
        console.warn(`  ⚠ [${fonte.id}] sezione non raggiungibile (${pagina}): ${(err as Error).message}`);
        continue;
      }
    }
    const candidati = [
      ...parseAvvisi(paginaHtml, fallback, pagina),
      ...espandiElencoInAvvisi(paginaHtml, { baseUrl: pagina, provincia: fallback, source: pagina }),
    ];
    let aggiunti = 0;
    for (const a of candidati) {
      if (hashVisti.has(a.hashId)) continue;
      hashVisti.add(a.hashId);
      // Rumore di navigazione (menu, archivi, paginazione, ricerca): mai un avviso.
      if (eTitoloNavigazione(a.title)) {
        stats.navigazione += 1;
        continue;
      }
      if (!a.province) {
        stats.senzaProvincia += 1;
        continue;
      }
      avvisi.push(a);
      aggiunti += 1;
    }
    console.log(`  ✓ [${fonte.id}] ${pagina} → ${aggiunti} voci`);
  }
  return avvisi;
}

/**
 * RACCOLTA dalle fonti del registro (capoluoghi & hub).
 *
 * Ordine: prima gli hub istituzionali della regione (bandi del capoluogo), poi
 * il feed dell'aggregatore. Le voci di contenuto editoriale (comunicati stampa,
 * dichiarazioni, eventi) vengono scartate QUI, a monte: mai in bacheca e mai
 * nelle notifiche Telegram/email.
 */
async function raccogliAvvisiReali(
  province: string[],
  maxFonti = MAX_FONTI_PER_RUN,
  includiArchivi = false,
): Promise<{ avvisi: AvvisoRilevato[]; fonti: string; stats: StatsRaccolta }> {
  const avvisi: AvvisoRilevato[] = [];
  const descrizioneFonti: string[] = [];
  const postVisitati = new Set<string>();
  const stats: StatsRaccolta = { senzaProvincia: 0, editoriali: 0, fuoriTarget: 0, navigazione: 0 };

  const fonti = fontiPerRun(province, maxFonti, { includiArchivi });
  console.log(`• Fonti selezionate: ${fonti.length} (${fonti.map((f) => f.id).join(', ')})`);

  for (const fonte of fonti) {
    descrizioneFonti.push(fonte.id);
    const estratti =
      fonte.tipo === 'hub-istituzionale'
        ? await raccogliDaHub(fonte, stats)
        : await raccogliDaAggregatore(fonte, postVisitati, stats);

    // GATE 1 — CONFORMITÀ: solo opportunità di lavoro, mai contenuto editoriale.
    // Il feed dell'aggregatore è un feed STRUTTURATO di interpelli (la natura è
    // garantita dalla fonte); le pagine generiche degli enti no, quindi lì si
    // pretende anche il segnale di opportunità nel testo.
    const daFonteInterpelli = fonte.tipo === 'aggregatore';
    let tenuti = 0;
    for (const a of estratti) {
      const motivo = motivoScartoOpportunita({ title: a.title }, new Date(), { daFonteInterpelli });
      if (motivo) {
        if (motivo.includes('editoriale')) stats.editoriali += 1;
        else stats.fuoriTarget += 1;
        if (stats.fuoriTarget + stats.editoriali <= 10) {
          console.warn(`  ✗ scartato (${motivo}): ${a.title.slice(0, 70)}`);
        }
        continue;
      }
      avvisi.push(a);
      tenuti += 1;
    }
    console.log(`• [${fonte.id}] ${fonte.etichetta} → ${tenuti}/${estratti.length} voci ammesse`);
  }

  return { avvisi, fonti: descrizioneFonti.join(' · '), stats };
}

/**
 * ESPANSIONE DEGLI ELENCHI (indice → tanti avvisi).
 *
 * Quando un avviso raccolto punta a una PAGINA INDICE (es. gli elenchi degli
 * Uffici Scolastici Regionali: USR Lombardia, USP…), la pagina viene scaricata
 * UNA volta e ogni voce dell'elenco diventa un avviso INDIPENDENTE, con:
 *   · il proprio URL (documento/pagina dell'avviso, mai la lista master);
 *   · la propria provincia, le proprie classi e la propria scadenza.
 * Un indice che non produce voci viene SCARTATO (non si pubblica mai il link
 * alla lista master come se fosse un avviso). Best-effort e limitato da
 * `SCRAPER_ELENCHI_MAX` (default 25 pagine per run).
 */
async function espandiElenchi(
  avvisi: AvvisoRilevato[],
  max = 25,
): Promise<{
  avvisi: AvvisoRilevato[];
  indiciEspansi: number;
  vociCreate: number;
  indiciScartati: string[];
}> {
  const out: AvvisoRilevato[] = [];
  const indiciScartati: string[] = [];
  let indiciEspansi = 0;
  let vociCreate = 0;
  let fetchEffettuati = 0;

  for (const a of avvisi) {
    const link = (a.link ?? '').trim();
    // Solo pagine che "sembrano" un indice (percorso da elenco + titolo/dati
    // coerenti): così i post giornalieri già strutturati non vengono ri-espansi.
    const probabileIndice =
      Boolean(link) &&
      eUrlElenco(link) &&
      (sembraTitoloElenco(a.title) || a.classCodes.length === 0);
    if (!probabileIndice || fetchEffettuati >= max) {
      out.push(a);
      continue;
    }

    fetchEffettuati += 1;
    let html: string;
    try {
      html = await scaricaPagina(link);
    } catch {
      out.push(a); // pagina non raggiungibile: si tiene l'avviso com'è
      continue;
    }
    if (!ePaginaElenco(html, link, link)) {
      out.push(a); // non è un indice: è l'avviso vero
      continue;
    }

    const figli = espandiElencoInAvvisi(html, {
      baseUrl: link,
      provincia: a.province,
      source: link,
      dataPubblicazione: a.publishedAt ?? null,
    }).filter((f) => (f.link ?? '') !== link);

    if (figli.length === 0) {
      // Indice senza voci estraibili: si scarta (mai il link alla lista master).
      indiciScartati.push(link);
      console.warn(`  ✗ indice senza voci estraibili, scartato: ${link}`);
      continue;
    }

    indiciEspansi += 1;
    vociCreate += figli.length;
    out.push(...figli);
  }

  return { avvisi: out, indiciEspansi, vociCreate, indiciScartati };
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
      const testo = testoLeggibile(html);
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

/**
 * Testo della pagina con SEPARATORI tra i blocchi HTML. Senza separatori cheerio
 * incolla le parole di tag adiacenti ("…@istruzione.it" + "posta" →
 * "…@istruzione.itposta", oppure "15/09/2026Scadenza"). Serve per email e scadenze.
 */
function testoLeggibile(html: string): string {
  const separato = html
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<\/(?:p|div|li|tr|td|th|h[1-6]|section|article|table|ul|ol|blockquote|span|a)>/gi, ' ');
  return cheerio.load(separato).text().replace(/\s+/g, ' ');
}

/** Email estratte da un HTML: testo della pagina (anche tabelle) + link `mailto:`. */
function emailDaHtml(html: string): string[] {
  const emails = new Set<string>(estraiEmails(testoLeggibile(html)));
  const $ = cheerio.load(html);
  $('a[href^="mailto:"]').each((_, a) => {
    // De-offusca anche l'href: alcune fonti scrivono `mailto:` con entità HTML.
    const href = (
      deoffuscaEmail($(a).attr('href') ?? '').replace(/^mailto:/i, '').split(/[?;,]/)[0] ?? ''
    )
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
async function cercaEmailNelleFonti(
  a: AvvisoRilevato,
): Promise<{ email: string | null; codice: string | null }> {
  const tuttiLink = [
    ...new Set([a.link, ...(a.linkCandidati ?? [])].filter((u): u is string => Boolean(u))),
  ];
  // Il codice meccanografico può stare ANCHE nell'URL di un documento binario
  // (PDF) o di una pagina di riepilogo/"Stampa" — es. `…/ASTF01000X-interpello.pdf`.
  // Va letto PRIMA di scartare i link non leggibili come testo, altrimenti si
  // perde la casella ufficiale (PEO) proprio sugli avvisi più "poveri".
  let codice =
    normalizzaCodiceMeccanografico(a.schoolCode) ??
    estraiCodiceMeccanograficoDaTesto(tuttiLink.join(' '));
  const radici = tuttiLink
    .filter((u) => /^https?:\/\//i.test(u) && !eDocumentoBinario(u))
    .slice(0, 2);
  if (radici.length === 0) return { email: null, codice };

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
      codice = codice ?? estraiCodiceMeccanograficoDaTesto(testoLeggibile(html));
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
          const htmlAllegato = await scaricaPagina(sub);
          codice = codice ?? estraiCodiceMeccanograficoDaTesto(testoLeggibile(htmlAllegato));
          for (const e of emailDaHtml(htmlAllegato)) emailTrovate.add(e);
        } catch {
          // allegato non raggiungibile
        }
      }
    }
  }

  let migliore: string | null = null;
  let migliorPunteggio = -Infinity;
  // Il codice (anche quello appena ricavato da URL/pagina) aiuta a preferire la
  // casella effettivamente legata all'istituto.
  const ctxFinale = { schoolCode: codice ?? a.schoolCode, schoolName: a.schoolName };
  for (const e of emailTrovate) {
    const p = punteggioEmailScuola(e, ctxFinale);
    if (p > migliorPunteggio) {
      migliorPunteggio = p;
      migliore = e;
    }
  }
  return {
    email:
      risolviEmailUfficialeScuola({
        emailsTrovate: migliore ? [migliore] : [],
        schoolCode: codice ?? a.schoolCode,
      })?.email ?? null,
    codice,
  };
}

/**
 * Email istituzionale derivata dal codice meccanografico.
 *
 * SOLO la convenzione UFFICIALE del Ministero (`codice@istruzione.it`,
 * `emailDaCodiceMeccanografico`): nessuna email costruita su un codice
 * malformato e nessun nome di scuola inventato per giustificarla (direttiva
 * 04/10/2026, §26.47 — bonifica dei mock: il vecchio `resolveSchoolByCode`
 * fabbricava «Istituto &lt;codice&gt;» e un recapito anche per codici non validi).
 */
function emailIstituzionaleDaCodice(schoolCode?: string | null): string | null {
  return emailDaCodiceMeccanografico(schoolCode ?? '')?.peo ?? null;
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
      const esito = await cercaEmailNelleFonti(a);
      // Il codice meccanografico può emergere anche dalla pagina ufficiale:
      // salvarlo permette la risoluzione PEO/PEC e il nome reale della scuola.
      if (esito.codice && !a.schoolCode) a.schoolCode = esito.codice;
      const trovata = esito.email;
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

/**
 * Mappa un avviso parsato sulle colonne della tabella `interpelli` (FASE 2 schema).
 * L'avviso passa prima dall'ANAGRAFICA NAZIONALE (`arricchisciConAnagrafica`):
 * nome reale dell'istituto, codice meccanografico, email PEO e PEC vengono
 * completati qui una volta sola, così bacheca pubblica, feed personale e Radar di
 * prova ricevono la stessa riga completa (nessuna logica duplicata a valle).
 */
function mappaRigaInterpelli(a: InterpelloParsato) {
  const avviso = arricchisciConAnagrafica(a);
  return {
    hash_id: avviso.hashId,
    title: avviso.title,
    province: avviso.province,
    class_codes: avviso.classCodes,
    school_name: avviso.schoolName,
    school_code: avviso.schoolCode,
    school_pec: avviso.schoolPec ?? null,
    source_url: avviso.link,
    published_at: avviso.publishedAt,
    expiration_date: avviso.expirationDate,
    materia: avviso.materia,
    contact_email: avviso.contactEmail,
    // STATO dell'anagrafica: la riga entra SEMPRE. Questa colonna dice soltanto
    // se l'istituto è identificato e c'è un recapito (`completo`) oppure se la
    // riga vive dei dati grezzi del bando (`parziale`) — l'interfaccia lo dichiara
    // con «anagrafica in aggiornamento», senza mai scartare o nascondere l'avviso
    // (direttiva 04/10/2026, §26.47: caso Padova).
    stato_arricchimento: statoArricchimento({
      school_name: avviso.schoolName,
      school_code: avviso.schoolCode,
      contact_email: avviso.contactEmail,
      school_pec: avviso.schoolPec ?? null,
    }),
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
const COLONNE_OPZIONALI = [
  'published_at',
  'materia',
  'contact_email',
  'stato_arricchimento',
  'school_pec',
];

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

/* --------------------------- Notifiche personali (digest) --------------------------- */

// Le notifiche personali NON partono più da qui: il modulo condiviso
// `src/lib/notifier.ts` (`inviaDigestGiornaliero`) raccoglie le opportunità e le
// consegna in UN SOLO digest giornaliero alle 18:00 (`npm run notifiche:digest`).
// Questo scraper si limita a inserire gli avvisi e a pubblicarli sui canali.

/* -------------------- Canali Telegram regionali (FASE 5) -------------------- */

/** Esito aggregato della pubblicazione Telegram sui canali. */
interface EsitoCanaliTelegram {
  attesi: number;
  riusciti: number;
  falliti: number;
  senzaCanale: number;
  /** Avvisi NON pubblicati perché privi di un link diretto all'avviso. */
  senzaFonte: number;
}

/**
 * Pubblica gli avvisi NUOVI sulle destinazioni Telegram corrette:
 *   - il canale REGIONALE attivo della provincia (9 canali regionali attivi
 *     configurati in src/lib/telegram.ts → CANALI_TELEGRAM_REGIONALI);
 *   - il canale ATA nazionale @scuoleradar_ata in AGGIUNTA per ogni
 *     avvisi ATA (🗂️), da qualunque regione d'Italia.
 *
 * GATE DI LINK SAFETY: gli avvisi privi di un link DIRETTO all'avviso specifico
 * (home regionali, archivi, elenchi, pagine di ricerca) NON vengono pubblicati:
 * sono contati in `senzaFonte` e non entrano in `attesi` (nessun falso allarme
 * di "dispatch fermo").
 *
 * Gli errori vengono loggati singolarmente: nessun fallimento silenzioso.
 * Ritorna le statistiche di invio (per diagnostica/alert).
 */
async function pubblicaNuoviSuCanali(nuovi: AvvisoRilevato[]): Promise<EsitoCanaliTelegram> {
  const nessuno: EsitoCanaliTelegram = {
    attesi: 0,
    riusciti: 0,
    falliti: 0,
    senzaCanale: 0,
    senzaFonte: 0,
  };
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
  let senzaFonte = 0;
  let saltatiGia = 0;
  // Dedup in-run: una coppia (hash, canale) non viene mai processata due volte
  // nemmeno se lo stesso avviso comparisse più volte nell'elenco.
  const processati = new Set<string>();
  for (const n of nuovi) {
    // ANTI-SPAM (ledger): i canali su cui questo avviso è già stato pubblicato
    // vengono esclusi — il run ripetuto NON ripubblica lo stesso messaggio.
    const giaPubblicati = await canaliGiaPubblicati(n.hashId);
    const esito = await pubblicaInterpelloSuCanali(
      {
        title: n.title,
        schoolName: n.schoolName,
        province: n.province,
        classCodes: n.classCodes,
        materia: n.materia,
        contactEmail: n.contactEmail,
        expirationDate: n.expirationDate,
        link: n.link,
      },
      { escludi: [...giaPubblicati] },
    );
    const daPubblicare = esito.destinazioni.filter((c) => {
      const chiave = `${n.hashId}|${c}`;
      if (processati.has(chiave)) return false;
      processati.add(chiave);
      return true;
    });
    inviiAttesi += daPubblicare.length;
    // GATE DI LINK SAFETY: senza un link DIRETTO all'avviso la pubblicazione è
    // annullata a monte (mai home regionali/archivi/ricerche sui canali).
    if (esito.saltato) {
      senzaFonte += 1;
      continue; // il motivo è già loggato da `pubblicaInterpelloSuCanali`
    }
    if (esito.destinazioni.length === 0) {
      if (giaPubblicati.size > 0) {
        saltatiGia += 1;
        continue; // già pubblicato ovunque: nessuna azione
      }
      senzaCanale += 1;
      console.warn(
        `  – [${n.province}] nessun canale attivo per la regione (${n.title.slice(0, 60)})`,
      );
      continue;
    }
    inviiRiusciti += esito.pubblicati;
    falliti += esito.errori.length;
    if (esito.errori.length === 0) {
      // Registra i canali serviti: da qui in avanti l'avviso non si ripubblica.
      for (const canale of daPubblicare) await registraPubblicazioneCanale(n.hashId, canale);
      console.log(
        `  ✓ [${n.province}] → ${esito.destinazioni.join(', ')}: ${n.title.slice(0, 50)}`,
      );
    } else {
      for (const e of esito.errori) {
        console.warn(`  ✗ [${n.province}] → ${e.canale}: ${e.errore} (${n.title.slice(0, 50)})`);
      }
    }
  }
  if (saltatiGia > 0) {
    console.log(`  • Canali Telegram: ${saltatiGia} avvisi già pubblicati (ledger) → saltati`);
  }
  if (senzaFonte > 0) {
    console.log(
      `  • Canali Telegram: ${senzaFonte} avvisi senza link diretto all'avviso → NON pubblicati`,
    );
  }
  console.log(
    `  ✓ Canali Telegram: ${inviiRiusciti}/${inviiAttesi} invii riusciti (${nuovi.length} avvisi)`,
  );
  return { attesi: inviiAttesi, riusciti: inviiRiusciti, falliti, senzaCanale, senzaFonte };
}

/* --------------------- Deduplica: hash + impronta dell'opportunità --------------------- */

/** Riga di `interpelli` letta per la deduplica. */
interface RigaEsistente {
  hash_id: string;
  source_url?: string | null;
  title?: string | null;
  school_name?: string | null;
  province?: string | null;
  class_codes?: string[] | null;
}

/**
 * Dimensione dei lotti per le query `.in()`: PostgREST passa i filtri nella query
 * string, quindi centinaia di hash SHA-256 (o di URL lunghi) fanno superare i
 * limiti di lunghezza della richiesta e la lettura FALLISCE. Spezzando in lotti
 * la deduplica resta affidabile.
 */
const LOTTO_IN = 40;

/**
 * Legge da `interpelli` le righe che hanno `campo IN (valori)`, in LOTTI.
 *
 * IMPORTANTE: l'errore viene SEMPRE loggato e contato. Prima di questa fix un
 * errore passava inosservato (`data` null) e il chiamante considerava NUOVI tutti
 * gli avvisi → l'intero feed veniva rinotificato (bug "notifiche ripetute").
 */
async function leggiEsistentiInLotti(
  supabase: SupabaseClient,
  campo: 'hash_id' | 'source_url',
  valori: string[],
): Promise<{ righe: RigaEsistente[]; errori: number }> {
  const righe: RigaEsistente[] = [];
  let errori = 0;
  const uniciValori = [...new Set(valori.filter(Boolean))];
  for (let i = 0; i < uniciValori.length; i += LOTTO_IN) {
    const lotto = uniciValori.slice(i, i + LOTTO_IN);
    const { data, error } = await supabase
      .from('interpelli')
      .select('hash_id, source_url')
      .in(campo, lotto);
    if (error) {
      errori += 1;
      console.warn(`⚠ Deduplica (${campo}): lettura in lotti fallita — ${error.message}`);
      continue;
    }
    for (const r of (data ?? []) as RigaEsistente[]) righe.push(r);
  }
  return { righe, errori };
}

/**
 * Avvisi degli ULTIMI `GIORNI_IMPRONTA` giorni: base del confronto per IMPRONTA
 * (stessa opportunità ripubblicata con titolo/data diversi → hash nuovo).
 */
async function leggiRecentiPerImpronta(supabase: SupabaseClient): Promise<RigaEsistente[]> {
  const dal = new Date(Date.now() - GIORNI_IMPRONTA * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from('interpelli')
    .select('hash_id, source_url, title, school_name, province, class_codes')
    .gte('created_at', dal)
    .limit(2000);
  if (error) {
    console.warn(`⚠ Deduplica per impronta: lettura degli avvisi recenti fallita — ${error.message}`);
    return [];
  }
  return (data ?? []) as RigaEsistente[];
}

/**
 * Guard del DISPATCH: se sono stati importati NUOVI avvisi ma NESSUN canale li ha
 * pubblicati (0 invii riusciti sulle attese), il ciclo di distribuzione è rotto →
 * avvisa subito gli admin sul bot Telegram `ScuoleRadar Admin`.
 *
 * NOTA: le notifiche PERSONALI non sono più in tempo reale (arrivano con il digest
 * delle 18:00), quindi il guard non può basarsi su di esse: controlla la
 * pubblicazione sui canali, che dà un feedback immediato e affidabile.
 */
async function avvisaSeDispatchFermo(
  esito: EsitoCanaliTelegram,
  nuovi: number,
  province: string[],
): Promise<void> {
  if (nuovi <= 0) return;
  if (esito.attesi === 0) return; // nessun canale attivo: non è una rottura
  if (esito.riusciti > 0) return;
  await inviaAlertaAdmin({
    severity: 'critical',
    category: 'notifiche',
    title: 'Dispatch Radar fermo: nuovi interpelli non pubblicati su alcun canale',
    message:
      `Importati ${nuovi} nuovi interpelli ma 0 pubblicazioni riuscite su ${esito.attesi} attese ` +
      `(errori: ${esito.falliti}). Possibile rottura dei canali Telegram o del ledger anti-duplicato.`,
    meta: { nuovi, province, esito },
  });
}

/**
 * Chiude una run dello scraper: registra le statistiche in `scraper_runs`
 * (diagnostica remota `/status`) e invia un ALERT ad ADMIN_TELEGRAM_ID se
 * rileva un fallimento critico o un'anomalia di routing Telegram.
 */
async function concludiRun(run: RunScraperLog): Promise<void> {
  // LEDGER LOCALE: salva su disco notifiche e pubblicazioni di questo run.
  // È la rete di sicurezza che blocca i duplicati anche quando le tabelle
  // `notifications_log` / `channel_posts_log` non sono ancora state create.
  ledgerLocaleSalva();

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
  // Alert PRO in TEMPO REALE su Telegram (disattivabili con
  // SCRAPER_TELEGRAM_REALTIME=0, es. durante i test della pipeline).
  const alertTempoReale = (env.SCRAPER_TELEGRAM_REALTIME ?? '1') !== '0';
  const inizio = Date.now();

  const url = env.SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY ?? env.SUPABASE_ANON_KEY;
  const supabase = url && key ? clientSupabase(url, key) : null;

  const province = await ottieniProvinceAttive(env, supabase);

  console.log('━━ ScuoleRadar Scraper (Fase 1 · BLOCCO 1) ━━');
  console.log(`• Province attive: ${province.join(', ')}`);
  console.log(`• Modalità: fonti reali (web) · inserimento: ${isDryRun ? 'DISATTIVATO (dry-run)' : 'Supabase'} · email: ${noEmail ? 'DISATTIVATE' : 'attive (Resend)'}`);

  // SOLO fonti reali (nessun fixture/seed): la pipeline non usa dati di test.
  const { avvisi, fonti, stats } = await raccogliAvvisiReali(
    province,
    Number(env.SCRAPER_FONTI_MAX ?? MAX_FONTI_PER_RUN),
    env.SCRAPER_ARCHIVI === '1',
  );
  let trovati: AvvisoRilevato[] = avvisi;
  console.log(`• Fonti interrogate: ${fonti}`);
  console.log(`• ${sintesiCopertura()}`);
  if (stats.editoriali > 0) {
    console.log(
      `• Contenuti editoriali scartati a monte (dominio Notizie, mai in bacheca): ${stats.editoriali}`,
    );
  }
  if (stats.fuoriTarget > 0) console.log(`• Voci fuori target scartate: ${stats.fuoriTarget}`);
  if (stats.navigazione > 0) {
    console.log(`• Voci di navigazione scartate (menu/archivi/ricerca, mai avvisi): ${stats.navigazione}`);
  }
  if (stats.senzaProvincia > 0) {
    console.log(`• Righe senza provincia rilevabile scartate (mai province inventate): ${stats.senzaProvincia}`);
  }

  // ELENCHI: ogni voce di una pagina indice (es. elenchi USR) diventa un avviso
  // indipendente con il proprio link (mai il link alla lista master).
  const elenchi = await espandiElenchi(trovati, Number(env.SCRAPER_ELENCHI_MAX ?? 25));
  if (elenchi.indiciEspansi > 0 || elenchi.indiciScartati.length > 0) {
    console.log(
      `• Elenchi: ${elenchi.indiciEspansi} indice/i espanso/i in ${elenchi.vociCreate} avvisi individuali` +
        (elenchi.indiciScartati.length > 0
          ? ` · ${elenchi.indiciScartati.length} indice/i senza voci (scartati)`
          : ''),
    );
  }
  trovati = elenchi.avvisi;

  // Scadenze mancanti: prova a estrarle dalla pagina ufficiale (best-effort).
  await arricchisciScadenze(trovati, Number(env.SCRAPER_SCADENZA_MAX ?? 20));

  // Email mancanti/deboli: arricchimento multi-fonte (pagina di dettaglio,
  // allegati, altri link) + ultima ratio dal codice meccanografico (MIM).
  await arricchisciContatti(
    trovati,
    Number(env.SCRAPER_CONTATTI_MAX ?? 60),
    env.SCRAPER_EMAIL_DA_CODICE !== '0',
  );

  // GATE 2 — SOLO BANDI ATTIVI: dopo l'arricchimento delle scadenze, un bando già
  // scaduto non entra in bacheca (né in notifica). Una scadenza ASSENTE non è una
  // prova di scadenza: senza data il record resta attivo finché una fonte non lo
  // dichiara chiuso.
  const attivi: AvvisoRilevato[] = [];
  let scartatiScaduti = 0;
  for (const a of trovati) {
    const motivo = motivoScartoOpportunita({
      title: a.title,
      expirationDate: a.expirationDate,
    });
    if (motivo && motivo.includes('scaduto')) {
      scartatiScaduti += 1;
      continue;
    }
    attivi.push(a);
  }
  if (scartatiScaduti > 0) console.log(`• Bandi già scaduti scartati: ${scartatiScaduti}`);
  trovati = attivi;

  // GATE 3 — LINK (ping FALLACE ≠ record scartato).
  // ⛔ Nessun fallback alla home dell'ente (USR/USP): il link deve restare quello
  // specifico dell'avviso ("👉 Apri l'avviso ufficiale"). Ma un server regionale
  // che risponde 403/timeout al client automatico NON è un bando inesistente:
  // se il record è STRUTTURATO (classe/materia + email di candidatura) si accetta
  // senza verifica del link; per gli altri il ping resta decisivo. I record
  // strutturati non vengono nemmeno pingati (risparmio di richieste).
  console.log('• Gate del link (ping non bloccante per i bandi strutturati)…');
  const strutturatoDi = (a: AvvisoRilevato) =>
    eRecordStrutturato({ classCodes: a.classCodes, materia: a.materia, contactEmail: a.contactEmail });
  // Si pingano SOLO i record non strutturati (i strutturati sono già accettati).
  const raggiungibilita = await mappaRaggiungibilita(
    trovati.filter((a) => !strutturatoDi(a)).map((a) => a.link ?? ''),
    Number(env.SCRAPER_PING_CONCORRENZA ?? 8),
  );
  const ammessiLink: AvvisoRilevato[] = [];
  let linkVerificati = 0;
  let accettatiStrutturati = 0;
  let scartatiLink = 0;
  for (const a of trovati) {
    const strutturato = strutturatoDi(a);
    const esito = valutaGateLink(a, strutturato ? null : (raggiungibilita.get(a.link ?? '') ?? false));
    if (!esito.accetta) {
      scartatiLink += 1;
      if (scartatiLink <= 10) console.warn(`  ✗ scartato (${esito.motivo}): ${a.title.slice(0, 60)}`);
      continue;
    }
    if (esito.verificato) linkVerificati += 1;
    else accettatiStrutturati += 1;
    ammessiLink.push(a);
  }
  console.log(
    `• Link: ${linkVerificati} verificati · ${accettatiStrutturati} accettati perché strutturati ` +
      `(classe/materia + email, ping non attendibile) · ${scartatiLink} scartati`,
  );
  trovati = ammessiLink;

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
  // TRE livelli di identità, dal più preciso al più tollerante:
  //   1. `hash_id` (provincia|titolo|data) → stesso avviso, stessi metadati;
  //   2. URL di fonte SPECIFICO → stesso documento pubblicato (l'hash può variare
  //      se la pagina sorgente riscrive titolo/data);
  //   3. IMPRONTA dell'opportunità (scuola + provincia + classi + titolo
  //      normalizzato SENZA date/numeri) → la stessa opportunità ripubblicata con
  //      titolo/date diversi, che con i soli hash tornava a essere notificata ogni
  //      giorno (bug "notifiche ripetute", es. gli avvisi del Liceo Monti).
  // La deduplica per URL vale solo per gli URL SPECIFICI: i fallback alla radice
  // dell'ente (condivisi da più avvisi) no.
  const hashCandidati = unici.map((u) => u.hashId);
  const linkSpecifici = unici.map((u) => u.link).filter(eUrlSpecifico);
  const { righe: righePerHash, errori: erroriHash } = await leggiEsistentiInLotti(
    supabase,
    'hash_id',
    hashCandidati,
  );
  const { righe: righePerUrl, errori: erroriUrl } = await leggiEsistentiInLotti(
    supabase,
    'source_url',
    linkSpecifici,
  );
  const hashEsistenti = new Set(righePerHash.map((r) => r.hash_id));
  const urlEsistenti = new Set(righePerUrl.map((r) => r.source_url ?? '').filter(Boolean));

  const recenti = await leggiRecentiPerImpronta(supabase);
  const impronteEsistenti = new Set(
    recenti
      .map((r) =>
        improntaAvviso({
          titolo: r.title,
          scuola: r.school_name,
          provincia: r.province,
          classi: r.class_codes,
        }),
      )
      .filter((i): i is string => Boolean(i)),
  );
  // Impronte accettate in QUESTO run: due voci con la stessa impronta sono la
  // stessa opportunità (evita il doppio alert nello stesso giro).
  const impronteDelRun = new Set<string>();

  const nuovi = unici.filter((u) => {
    if (hashEsistenti.has(u.hashId)) return false;
    if (eUrlSpecifico(u.link) && urlEsistenti.has(u.link)) return false;
    const impronta = improntaAvviso({
      titolo: u.title,
      scuola: u.schoolName,
      provincia: u.province,
      classi: u.classCodes,
    });
    if (!impronta) return true;
    if (impronteEsistenti.has(impronta) || impronteDelRun.has(impronta)) return false;
    impronteDelRun.add(impronta);
    return true;
  });
  if (erroriHash + erroriUrl > 0) {
    console.warn(
      `⚠ Deduplica parziale: ${erroriHash + erroriUrl} letture in errore su interpelli — ` +
        'il ledger per utente/canale resta la protezione finale (nessun doppio invio).',
    );
  }
  console.log(
    `• Interpelli NUOVI nel DB: ${nuovi.length} (candidati alle notifiche; ` +
      `${unici.length - nuovi.length} già presenti per hash/fonte/impronta)` +
      `${impronteEsistenti.size > 0 ? ` · impronte di riferimento: ${impronteEsistenti.size}` : ''}`,
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
  // ANAGRAFICA NAZIONALE: quante righe sono state completate (nome/codice/email/PEC).
  // Dichiararlo rende visibile l'effetto dell'arricchimento sul run, senza silenzi.
  const anagrafica = riepilogoAnagrafica();
  if (anagrafica.disponibile) {
    console.log(
      `• Anagrafica scuole: ${anagrafica.arricchiti} avvisi arricchiti su ${unici.length} ` +
        `(${anagrafica.codici} codici meccanografici da ${anagrafica.file} file SCUANAGRAFE).`,
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

    // FASE 4 — alert in TEMPO REALE per il piano PRO (Telegram); i BASE ricevono
    // il solo batch delle 17:00.
    if (alertTempoReale) {
      await inviaAlertTelegramTempoReale(supabase, nuovi);
    }

    // FASE 5 — canali Telegram regionali + ATA nazionale (solo avvisi NUOVI e fonti reali).
    const tgFallback = await pubblicaNuoviSuCanali(nuovi);
    // Guard immediato: se NESSUN canale ha pubblicato, il dispatch è rotto.
    await avvisaSeDispatchFermo(tgFallback, nuovi.length, province);

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

  // FASE 4 — ALERT IN TEMPO REALE (solo piano PRO) su TELEGRAM: l'avviso parte
  // appena viene scrapato. I BASE non ricevono nulla adesso: un solo batch alle
  // 17:00 (`npm run notifiche:digest`).
  if (alertTempoReale) {
    await inviaAlertTelegramTempoReale(supabase, nuovi);
  }

  // FASE 5 — canali Telegram regionali + ATA nazionale (solo avvisi NUOVI e fonti reali).
  const tg = await pubblicaNuoviSuCanali(nuovi);
  // Guard immediato: se NESSUN canale ha pubblicato, il dispatch è rotto.
  await avvisaSeDispatchFermo(tg, nuovi.length, province);

  if (!noEmail) {
    console.log(
      `• Notifiche: ${nuovi.length} opportunità — alert PRO in tempo reale (se abilitati); ` +
        'per il piano BASE un solo riepilogo alle 17:00.',
    );
  }

  // Diagnostica + alert: registra la run (`scraper_runs`) e avvisa l'admin se ci
  // sono stati invii Telegram falliti, avvisi senza canale (anomalie di routing)
  // o avvisi scartati dal gate di link safety (senza link diretto).
  await concludiRun({
    modalita: 'reali',
    province,
    trovati: unici.length,
    nuovi: nuovi.length,
    upsertOk: true,
    telegramAttesi: tg.attesi,
    telegramRiusciti: tg.riusciti,
    errori: tg.falliti,
    esito: tg.falliti > 0 || tg.senzaCanale > 0 || tg.senzaFonte > 0 ? 'warn' : 'ok',
    messaggio:
      tg.senzaCanale > 0
        ? `${tg.senzaCanale} avvisi senza canale regionale attivo` +
          (tg.senzaFonte > 0 ? ` · ${tg.senzaFonte} senza link diretto (non pubblicati)` : '')
        : tg.senzaFonte > 0
          ? `${tg.senzaFonte} avvisi senza link diretto all'avviso: non pubblicati sui canali`
          : undefined,
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
  // RETE DI SICUREZZA: qualunque uscita (crash, timeout del runner, kill del
  // processo, eccezione non gestita) deve PRIMA salvare il ledger anti-duplicato.
  // `ledgerLocaleSalva()` è sincrona e best-effort: senza questo hook le marcature
  // di deduplica del run andavano perse e gli stessi avvisi ripartivano il giorno
  // successivo (bug "notifiche ripetute").
  process.on('exit', () => ledgerLocaleSalva());

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

