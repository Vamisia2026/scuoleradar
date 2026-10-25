/** PROVA DIAGNOSTICA 3 (temporanea): rumore Ferrara, portale servizi Liguria, Piemonte avvisi. */
import axios from 'axios';
import * as cheerio from 'cheerio';
import { estraiPostElenco } from './src/scraper/postElenco.ts';

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

const FE = 'https://fe.istruzioneer.gov.it/category/interpelli_docenti/';
const fe = await scarica(FE);
const $fe = cheerio.load(fe);
const primo = $fe('h2 a[href], h3 a[href]').first();
console.log('━━ FERRARA · perché il titolo viene scartato');
console.log('  catena genitori:', primo.parents().map((_, el) => el.tagName + (el.attribs?.class ? '.' + String(el.attribs.class).split(' ').join('.') : '')).get().slice(0, 12).join(' > '));
console.log('  in nav/header/footer/aside?', primo.closest('nav, header, footer, aside, .widget, .sidebar').length);
console.log('  in .site-header/.widget/[role=navigation]?', primo.closest('.site-header, .widget, [role="navigation"]').length);
console.log('  posts estratti (nessun filtro rumore simulato) — len/href:');
console.log('  estraiPostElenco:', estraiPostElenco(fe, FE, { max: 10 }).length);

for (const url of [
  'https://servizi.istruzioneliguria.gov.it/',
  'https://www.istruzionepiemonte.it/avvisi-pubblici-3/',
  'https://www.mim.gov.it/web/milano/interpelli-ricerca-supplenti',
  'https://www.mim.gov.it/web/bergamo/interpelli-ricerca-supplenti',
]) {
  try {
    const html = await scarica(url);
    const $ = cheerio.load(html);
    const post = estraiPostElenco(html, url, { max: 6 });
    console.log(`\n━━ ${url}\n   ${html.length}b · a=${$('a[href]').length} · tr=${$('tr').length} · post=${post.length}`);
    post.slice(0, 3).forEach((p) => console.log(`   POST "${p.titolo.slice(0, 55)}" → ${p.url.slice(0, 90)}`));
    if (post.length === 0) console.log(`   testo: ${$('body').text().replace(/\s+/g, ' ').trim().slice(0, 200)}`);
    if (/interpelli-ricerca-supplenti/.test(url)) {
      const href = $('a[href]').map((_, el) => $(el).attr('href') ?? '').get();
      console.log(`   link campione: ${href.filter((h) => /-\//.test(h)).slice(0, 3).join(' | ').slice(0, 300)}`);
    }
  } catch (err) {
    console.log(`\n━━ ${url}: ✗ ${(err as Error).message.slice(0, 60)}`);
  }
}
