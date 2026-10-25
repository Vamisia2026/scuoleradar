/** PROVA DIAGNOSTICA 2 (temporanea): dettagli su Ferrara, Liguria, Piemonte. */
import axios from 'axios';
import * as cheerio from 'cheerio';
import { eTitoloNavigazione } from './src/scraper/hub.ts';
import { eUrlPost } from './src/scraper/postElenco.ts';

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
console.log('━━ FERRARA · h1-h4 con link');
$fe('h1 a[href], h2 a[href], h3 a[href], h4 a[href]').each((i, el) => {
  if (i > 8) return;
  const t = $fe(el).text().replace(/\s+/g, ' ').trim();
  const h = $fe(el).attr('href') ?? '';
  console.log(
    `  "${t.slice(0, 60)}" len=${t.length} nav=${eTitoloNavigazione(t)} post=${eUrlPost(new URL(h, FE).href, FE)} → ${h.slice(0, 90)}`,
  );
});
console.log('  .article / .entry-title presenti:', $fe('article').length, $fe('.entry-title').length, $fe('.entry-title a').length);

const PIE = 'https://servizi.istruzionepiemonte.it/interpello2025/ric_interpello_ambito_to.php';
const pie = await scarica(PIE);
const $pie = cheerio.load(pie);
console.log('\n━━ PIEMONTE · prima riga di dati');
const righe = $pie('tr').filter((_, el) => $pie(el).find('td').length > 4);
console.log('  righe con >4 td:', righe.length);
console.log('  riga[1] html:', $pie(righe[1]).html()?.replace(/\s+/g, ' ').slice(0, 900));

const LIG = 'https://www.istruzioneliguria.gov.it/pagine/interpelli-e-comunicati';
const lig = await scarica(LIG);
const $lig = cheerio.load(lig);
console.log('\n━━ LIGURIA · script/API e link nel body');
console.log('  script src:', $lig('script[src]').map((_, el) => $lig(el).attr('src')).get().slice(0, 6).join(' | '));
console.log('  iframe:', $lig('iframe').map((_, el) => $lig(el).attr('src')).get().slice(0, 4).join(' | '));
console.log('  link a file:', $lig('a[href$=".pdf"], a[href*="download"]').length);
console.log('  link totali (non social):', $lig('a[href]').length);

for (const alt of ['https://www.usrliguria.gov.it/provincia.php', 'https://www.usrliguria.gov.it/']) {
  try {
    const html = await scarica(alt);
    const $$ = cheerio.load(html);
    const interessanti = $$('a[href]').filter((_, el) => /interpell|supplenz|avvis/i.test($$(el).attr('href') ?? '')).length;
    console.log(`\n── ${alt}: ${html.length}b · a=${$$('a[href]').length} · link reclutamento=${interessanti}`);
    console.log(`   titolo: ${$$('title').text().slice(0, 70)}`);
    console.log(`   testo: ${$$('body').text().replace(/\s+/g, ' ').trim().slice(0, 200)}`);
  } catch (err) {
    console.log(`\n── ${alt}: ✗ ${(err as Error).message.slice(0, 60)}`);
  }
}
