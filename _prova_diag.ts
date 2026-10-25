/** PROVA DIAGNOSTICA (temporanea): perché queste pagine non producono avvisi? */
import axios from 'axios';
import * as cheerio from 'cheerio';
import { estraiContenutoArticolo } from './src/scraper/articoloPost.ts';
import { ePaginaPostElenco, estraiPostElenco } from './src/scraper/postElenco.ts';
import { parseAvvisi } from './src/scraper/index.ts';

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';

async function scarica(url: string): Promise<string> {
  const res = await axios.get<string>(url, {
    timeout: 25_000,
    maxRedirects: 5,
    responseType: 'text',
    headers: { 'User-Agent': UA, Accept: 'text/html,application/xhtml+xml', 'Accept-Language': 'it-IT,it;q=0.9' },
  });
  return String(res.data ?? '');
}

const URLS = [
  'https://fe.istruzioneer.gov.it/category/interpelli_docenti/',
  'https://www.istruzioneliguria.gov.it/pagine/interpelli-e-comunicati',
  'https://servizi.istruzionepiemonte.it/interpello2025/ric_interpello_ambito_to.php',
  'https://www.mim.gov.it/web/milano',
];

for (const url of URLS) {
  console.log(`\n━━ ${url}`);
  let html: string;
  try {
    html = await scarica(url);
  } catch (err) {
    console.log(`   ✗ ${(err as Error).message.slice(0, 70)}`);
    continue;
  }
  const $ = cheerio.load(html);
  const post = estraiPostElenco(html, url, { max: 10 });
  console.log(
    `   html=${html.length}b · a=${$('a[href]').length} · h2/h3/h4 con link=${$('h2 a[href], h3 a[href], h4 a[href]').length} · article=${$('article').length} · tr=${$('tr').length} · ePaginaPostElenco=${ePaginaPostElenco(html, url)}`,
  );
  console.log(`   titolo pagina: ${$('title').text().slice(0, 80)}`);
  post.slice(0, 5).forEach((p) => console.log(`   POST "${p.titolo.slice(0, 60)}" → ${p.url}`));
  console.log(`   righe parseAvvisi: ${parseAvvisi(html, 'TO', url).length}`);
  const link = $('a[href]')
    .slice(0, 0)
    .map((_, el) => $(el).attr('href'))
    .get();
  void link;
  // Link interni "interessanti" (percorso con interpell/supplenz/avvis): primo campione.
  const campione = new Set<string>();
  $('a[href]').each((_, el) => {
    const h = ($(el).attr('href') ?? '').trim();
    if (!h || h.startsWith('#')) return;
    if (!/interpell|supplenz|avvis|bando|graduator/i.test(h)) return;
    campione.add(h);
  });
  console.log(`   link di reclutamento in pagina: ${campione.size}`);
  [...campione].slice(0, 6).forEach((h) => console.log(`     · ${h}`));
  // Testo visibile (per capire il tipo di pagina: form di ricerca? elenco JS?).
  const testoPagina = $('body').text().replace(/\s+/g, ' ').trim();
  console.log(`   testo: ${testoPagina.slice(0, 240)}`);
  if (/ric_interpello|servizi\.istruzionepiemonte/.test(url)) {
    $('form').each((i, f) => {
      console.log(`   form#${i} action=${$(f).attr('action')} metodi=${$(f).attr('method')} campi=${$(f).find('input,select').length}`);
    });
  }
}

// Articolo MIM: cosa estrae `estraiContenutoArticolo`?
const articolo = 'https://www.mim.gov.it/web/milano/-/nomine-a-tempo-determinato-da-gps-a-s-2026-27-bollettino-n-9-1';
try {
  const html = await scarica(articolo);
  const c = estraiContenutoArticolo(html, articolo);
  console.log(`\n━━ ARTICOLO ${articolo}`);
  console.log(`   titolo: "${c.titolo.slice(0, 90)}" · data=${c.dataPubblicazione} · allegati=${c.allegati.length}`);
  console.log(`   corpo(${c.corpo.length}): ${c.corpo.slice(0, 200)}`);
  const $$ = cheerio.load(html);
  console.log(`   h1: ${$$('h1').map((_, el) => $$(el).text().trim()).get().slice(0, 4).join(' | ').slice(0, 160)}`);
} catch (err) {
  console.log(`   ✗ articolo: ${(err as Error).message.slice(0, 70)}`);
}
