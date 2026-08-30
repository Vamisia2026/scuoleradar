/**
 * ScuoleRadar.it — Modulo di scraping on-demand (Fase 1 · BLOCCO 1: INTERPELLI & PNRR)
 *
 * Pipeline:
 *   1. Carica le variabili d'ambiente da `.env` (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY).
 *   2. Legge le province di interesse attive (per ora: valore di test da env, default MI,TO).
 *   3. Scarica le fonti reali per provincia (pagina regione → post del giorno → interpelli
 *      ufficiali), oppure usa una fixture offline per il test (`--fixture`).
 *   4. Passa ogni avviso al parser (src/scraper/parser.ts) che estrae:
 *      classi di concorso/sostegno (via Regex), data di scadenza e hash_id SHA-256 univoco.
 *   5. Effettua l'UPSERT nella tabella `interpelli` di Supabase usando `hash_id`
 *      (onConflict) per ignorare i duplicati; fallback sulla tabella legacy `notices`.
 *   6. Invia le notifiche email (Resend) agli utenti qualificati per i soli
 *      interpelli NUOVI (hash_id non già presenti nel DB) — vedi src/lib/resend.ts.
 *
 * Uso:
 *   npm run scrape                       # pipeline completa (serve .env valido)
 *   npm run scrape -- --dry-run          # solo estrazione + hash, nessun inserimento
 *   npm run scrape -- --fixture          # fixture HTML offline (test senza rete)
 *   npm run scrape -- --no-email         # disattiva le notifiche email
 *   npm run scrape -- --fixture --dry-run
 */

import process from 'node:process';
import axios from 'axios';
import * as cheerio from 'cheerio';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import {
  parseInterpello,
  estraiDataScadenza,
  rilevaCategoriaAvviso,
  sembraOpportunita,
  type InterpelloParsato,
} from './parser.ts';
import { notificaNuoviInterpelli } from '../lib/notifier.ts';

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

    // Data di scadenza: cerca nel link e nel contenitore (li / article / entry)
    const contenitore = $el.closest('li, article, .entry, .post, .avviso').text().replace(/\s+/g, ' ');
    const data = estraiDataScadenza(`${testo} ${contenitore}`);

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
        dataNota: data,
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

/** Fonti reali di interpelli, una per provincia di interesse (Fase 1: MI, TO). */
const FONTI_REALI: FonteProvincia[] = [
  { provincia: 'MI', url: 'https://www.scuolainterpelli.it/interpelli-lombardia/' },
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

/** Estrae i singoli interpelli (link esterni ufficiali) dal contenuto di un post giornaliero. */
export function parsePostInterpelli(
  postHtml: string,
  provincia: string,
  source: string,
): AvvisoRilevato[] {
  const $ = cheerio.load(postHtml);
  const contenuto = $('.entry-content, article, .post-content, main').first();
  const titoloPost = $('h1.entry-title, article h1, .entry-title').first().text();
  const risultato: AvvisoRilevato[] = [];

  contenuto.find('a').each((_, el) => {
    const $el = $(el);
    const href = $el.attr('href') ?? '';
    const testo = $el.text().replace(/\s+/g, ' ').trim();

    if (!href.startsWith('http')) return;
    if (/scuolainterpelli\.it/.test(href)) return; // link interni / navigazione
    if (testo.length < 8 || testo.length > 300) return;
    if (/^VISUALIZZA/i.test(testo) || /^Redazione/i.test(testo)) return; // etichette generiche
    if (/facebook|linkedin|t\.me|altervista|iubenda|freepik|pinterest|instagram|twitter/.test(href)) return;

    const contesto = $el.closest('li, p, td, div').text().replace(/\s+/g, ' ');
    const data = estraiDataScadenza(`${testo} ${contesto}`) ?? estraiDataScadenza(titoloPost);
    // Ripulisce il titolo da annotazioni tipo "[478 KB]"
    const titolo = testo.replace(/\s*\[\d+(?:[.,]\d+)?\s*(?:KB|MB)\]\s*$/i, '').trim() || testo;

    risultato.push(
      parseInterpello({
        title: titolo,
        link: href,
        provincia,
        source,
        corpo: contesto,
        dataNota: data,
      }),
    );
  });

  return risultato;
}

// Conversione delle date testuali italiane ("22 agosto 2026") e numeriche:
// gestita dal parser in src/scraper/parser.ts (estraiDataScadenza).

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
    let fonte = FONTI_REALI.find((f) => f.provincia === provincia);
    if (!fonte && env.FONTE_TEST_URL) {
      fonte = { provincia, url: env.FONTE_TEST_URL };
    }
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

/* ------------------------- Fixture offline (test) ------------------------- */

/**
 * HTML di esempio per testare la pipeline senza rete/Supabase.
 * Contiene avvisi con titolo, link, data di scadenza e classi di concorso.
 */
const FIXTURE_HTML = `
<html><body>
<ul class="lista-avvisi">
  <li>
    <a href="https://www.istruzione.lombardia.it/interpello-supplenza-matematica/">
      Interpello supplenza A-026 Matematica e fisica — Liceo scientifico, Milano
    </a>
    <time datetime="2026-09-15">Scadenza: 15/09/2026</time>
  </li>
  <li>
    <a href="https://www.istruzione.toscana.it/avviso-b-02-lingue/">
      Avviso B-02 Lingue straniere — Istituto comprensivo, Firenze
    </a>
    <span>Termine presentazione domande: 22/09/2026</span>
  </li>
  <li>
    <a href="https://www.istruzione.lombardia.it/interpello-sostegno-adee/">
      Interpello supplenza sostegno ADEE — Scuola primaria, Brescia
    </a>
    <span>Scadenza 05/10/2026 ore 12:00</span>
  </li>
  <li>
    <a href="https://www.istruzione.lombardia.it/interpello-adss-superiori/">
      Interpello ADSS sostegno secondaria di II grado — Bergamo
    </a>
    <span>Scadenza: 01/10/2026</span>
  </li>
  <li>
    <a href="https://www.istruzione.lombardia.it/progetto-pnrro-biologia/">
      Bando per esperto esterno PNRR — Biologia e chimica A-050, Pavia
    </a>
    <span>Domande entro il 12/09/2026</span>
  </li>
</ul>
</body></html>
`;

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
    expiration_date: a.expirationDate,
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

/* ------------------------------ Notifiche email (FASE 4) ------------------------------ */

// L'invio delle notifiche email è gestito dal modulo condiviso src/lib/notifier.ts:
// riceve i nuovi interpelli, interroga il Matching Engine (findUtentiCompatibili)
// per trovare gli utenti con preferenze compatibili e invia le mail via Resend.

/* -------------------------------- main -------------------------------- */

async function main() {
  const env = caricaEnv();
  const isDryRun = process.argv.includes('--dry-run');
  const useFixture = process.argv.includes('--fixture');
  const noEmail = process.argv.includes('--no-email');

  const url = env.SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY ?? env.SUPABASE_ANON_KEY;
  const supabase = url && key ? clientSupabase(url, key) : null;

  const province = await ottieniProvinceAttive(env, supabase);

  console.log('━━ ScuoleRadar Scraper (Fase 1 · BLOCCO 1) ━━');
  console.log(`• Province attive: ${province.join(', ')}`);
  console.log(`• Modalità: ${useFixture ? 'fixture offline' : 'fonti reali (web)'} · inserimento: ${isDryRun ? 'DISATTIVATO (dry-run)' : 'Supabase'} · email: ${noEmail ? 'DISATTIVATE' : 'attive (Resend)'}`);

  let trovati: AvvisoRilevato[] = [];
  if (useFixture) {
    console.log('• Fonte: fixture HTML di test (offline)');
    trovati = province.flatMap((p) => parseAvvisi(FIXTURE_HTML, p, 'fixture'));
  } else {
    const { avvisi, fonti } = await raccogliAvvisiReali(env, province);
    trovati = avvisi;
    console.log(`• Fonti reali: ${fonti}`);
    console.log('• Verifica raggiungibilità dei link…');
    const verificati: AvvisoRilevato[] = [];
    let raggiungibili = 0;
    for (const a of trovati) {
      const ok = await verificaLink(a.link ?? '');
      if (ok) {
        raggiungibili++;
        verificati.push(a);
      } else {
        console.warn(`  ✗ scartato (link non raggiungibile): ${a.link}`);
      }
    }
    console.log(`• Link raggiungibili: ${raggiungibili}/${trovati.length}`);
    trovati = verificati;
  }

  const unici = [...new Map(trovati.map((t) => [t.hashId, t])).values()];
  console.log(`• Interpelli estratti: ${trovati.length} · unici per hash_id: ${unici.length}`);

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

  const { error } = (await supabase
    .from('interpelli')
    .upsert(righeInterpelli, { onConflict: 'hash_id', ignoreDuplicates: true })) as {
    data: unknown[] | null;
    error: { message: string } | null;
  };

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
      return;
    }
    console.log(`✓ Upsert completato su notices (fallback · righe inviate: ${righeNotices.length}).`);

    // FASE 4 — notifiche email per i soli interpelli nuovi
    if (!noEmail) {
      await notificaNuoviInterpelli(supabase, nuovi);
    }
    return;
  }

  console.log(`✓ Upsert completato su interpelli (righe inviate: ${righeInterpelli.length}).`);

  // FASE 4 — notifiche email per i soli interpelli nuovi
  if (!noEmail) {
    await notificaNuoviInterpelli(supabase, nuovi);
  }
}

main().catch((err) => {
  console.error('✗ Errore imprevisto nello scraper:', err);
  process.exitCode = 1;
});

