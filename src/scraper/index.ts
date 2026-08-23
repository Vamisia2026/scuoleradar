/**
 * ScuoleRadar.it — Modulo di scraping on-demand (Fase 1 · BLOCCO 1: INTERPELLI & PNRR)
 *
 * Pipeline:
 *   1. Carica le variabili d'ambiente da `.env` (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY).
 *   2. Legge le province di interesse attive (per ora: valore di test da env, default MI,TO).
 *   3. Scarica le fonti reali per provincia (pagina regione → post del giorno → interpelli
 *      ufficiali), oppure usa una fixture offline per il test (`--fixture`).
 *   4. Estrae: titolo, link, provincia, data di scadenza e classi di concorso (via Regex).
 *   5. Calcola un hash_id SHA256 univoco (provincia + titolo + data) per evitare duplicati.
 *   6. Salva i nuovi interpelli nella tabella `notices` di Supabase (upsert su hash_id).
 *
 * Uso:
 *   npm run scrape                # esegue la pipeline completa (serve .env valido)
 *   npm run scrape -- --dry-run   # solo estrazione + hash, nessun inserimento
 *   npm run scrape -- --fixture   # usa la fixture HTML offline (test senza rete)
 *   npm run scrape -- --fixture --dry-run
 */

import { createHash } from 'node:crypto';
import process from 'node:process';
import axios from 'axios';
import * as cheerio from 'cheerio';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/* ------------------------------- Tipi ------------------------------- */

export interface AvvisoRilevato {
  title: string;
  link: string | null;
  province: string;
  /** Data di scadenza normalizzata YYYY-MM-DD, se presente */
  expiresAt: string | null;
  classCodes: string[];
  source: string;
  /** SHA256 di `provincia|titolo|data` — chiave anti-duplicato */
  hashId: string;
}

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

/* -------------------- Regex per classi di concorso -------------------- */
/**
 * Rileva i codici di classe di concorso nei testi:
 *  - formato classico: A-12, A-026, B-02, B-001
 *  - speciali (sostegno): ADEE, ADSS, ADMM, AD24, ...
 */
const RE_CLASSI = /\b(?:[A-Z]{1,2}-\d{2,3}|AD[A-Z]{2,3})\b/g;

function rilevaClassi(testo: string): string[] {
  const trovate = testo.match(RE_CLASSI) ?? [];
  return [...new Set(trovate.map((c) => c.toUpperCase()))];
}

/* ------------------------------ Hashing ------------------------------ */

export function generaHash(province: string, title: string, data: string | null): string {
  const payload = `${province}|${title.trim()}|${data ?? ''}`;
  return createHash('sha256').update(payload).digest('hex');
}

/* --------------------------- Date e normalizzazione --------------------------- */

/** Estrae una data italiana (gg/mm/aaaa o gg-mm-aaaa) e la normalizza in YYYY-MM-DD. */
function estraiData(testo: string): string | null {
  const match = testo.match(/\b(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})\b/);
  if (!match) return null;
  const [, gg, mm, aa] = match;
  const anno = aa.length === 2 ? `20${aa}` : aa;
  const giorno = gg.padStart(2, '0');
  const mese = mm.padStart(2, '0');
  if (Number(mese) < 1 || Number(mese) > 12) return null;
  if (Number(giorno) < 1 || Number(giorno) > 31) return null;
  return `${anno}-${mese}-${giorno}`;
}

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
    const sembraAvviso = /interpell|avviso|supplenz|bando|pubblicazione/i.test(contesto);
    if (!sembraAvviso) return;
    if (testo.length < 10) return;

    // Data di scadenza: cerca nel link e nel contenitore (li / article / entry)
    const contenitore = $el.closest('li, article, .entry, .post, .avviso').text().replace(/\s+/g, ' ');
    const data = estraiData(`${testo} ${contenitore}`);

    let link = href;
    if (href && !href.startsWith('http')) {
      try {
        link = new URL(href, source).href;
      } catch {
        link = href;
      }
    }

    risultati.push({
      title: testo,
      link: link || null,
      province: provincia,
      expiresAt: data,
      classCodes: rilevaClassi(`${testo} ${contenitore}`),
      source,
      hashId: generaHash(provincia, testo, data),
    });
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
    const data = estraiDataTesto(`${testo} ${contesto}`) ?? estraiDataTesto(titoloPost);
    // Ripulisce il titolo da annotazioni tipo "[478 KB]"
    const titolo = testo.replace(/\s*\[\d+(?:[.,]\d+)?\s*(?:KB|MB)\]\s*$/i, '').trim() || testo;

    risultato.push({
      title: titolo,
      link: href,
      province: provincia,
      expiresAt: data,
      classCodes: rilevaClassi(`${titolo} ${contesto}`),
      source,
      hashId: generaHash(provincia, titolo, data),
    });
  });

  return risultato;
}

/** Mesi italiani per la conversione delle date testuali. */
const MESI_IT: Record<string, string> = {
  gennaio: '01', febbraio: '02', marzo: '03', aprile: '04', maggio: '05', giugno: '06',
  luglio: '07', agosto: '08', settembre: '09', ottobre: '10', novembre: '11', dicembre: '12',
};

/** Data in formato italiano ("22 agosto 2026") o numerico (gg/mm/aaaa) → YYYY-MM-DD. */
function estraiDataTesto(testo: string): string | null {
  const m = testo
    .toLowerCase()
    .match(
      /\b(\d{1,2})\s+(gennaio|febbraio|marzo|aprile|maggio|giugno|luglio|agosto|settembre|ottobre|novembre|dicembre)\s+(\d{4})\b/,
    );
  if (m) return `${m[3]}-${MESI_IT[m[2]]}-${m[1].padStart(2, '0')}`;
  return estraiData(testo);
}

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

/** Mappa un avviso sulle colonne della tabella `notices` (schema verificato sul progetto). */
function mappaRiga(a: AvvisoRilevato) {
  return {
    hash_id: a.hashId,
    title: a.title,
    source_url: a.link,
    province: a.province,
    class_codes: a.classCodes,
    expiration_date: a.expiresAt,
  };
}

/* -------------------------------- main -------------------------------- */

async function main() {
  const env = caricaEnv();
  const isDryRun = process.argv.includes('--dry-run');
  const useFixture = process.argv.includes('--fixture');

  const url = env.SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY ?? env.SUPABASE_ANON_KEY;
  const supabase = url && key ? clientSupabase(url, key) : null;

  const province = await ottieniProvinceAttive(env, supabase);

  console.log('━━ ScuoleRadar Scraper (Fase 1 · BLOCCO 1) ━━');
  console.log(`• Province attive: ${province.join(', ')}`);
  console.log(`• Modalità: ${useFixture ? 'fixture offline' : 'fonti reali (web)'} · inserimento: ${isDryRun ? 'DISATTIVATO (dry-run)' : 'Supabase'}`);

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
      `  [${n.province}] ${n.title.slice(0, 70)} | scad: ${n.expiresAt ?? 'n/d'} | classi: ${
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

  const righe = unici.map(mappaRiga);

  const { error } = (await supabase
    .from('notices')
    .upsert(righe, { onConflict: 'hash_id', ignoreDuplicates: true })) as {
    data: unknown[] | null;
    error: { message: string } | null;
  };

  if (error) {
    console.error(`✗ Errore Supabase: ${error.message}`);
    process.exitCode = 1;
    return;
  }

  console.log(`✓ Upsert completato su notices (righe inviate: ${righe.length}).`);
}

main().catch((err) => {
  console.error('✗ Errore imprevisto nello scraper:', err);
  process.exitCode = 1;
});

