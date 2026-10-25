import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import * as cheerio from 'cheerio';

const DIR = process.env.TEMP + '\\elenchi';
const norm = (s) => (s ?? '').replace(/\s+/g, ' ').trim();
const RUMORE =
  /(privacy|cookie|facebook|twitter|instagram|linkedin|youtube|tiktok|whatsapp|telegram|t\.me|mailto:|tel:|javascript:|wp-login|wp-admin|\/feed\/?$|\/page\/\d|\/pagina\/\d|paginazione|accessibilit|\/contatti?\/?$|\/chi-siamo|\/category\/[^/]+\/$|\/tag\/|#)/i;

function estraiPostElenco(html, baseUrl, max = 15) {
  const $ = cheerio.load(html);
  const host = new URL(baseUrl).hostname.replace(/^www\./i, '');
  const out = [];
  const visti = new Set();
  $('article, .list-posts > *, .card, .avviso').each((_, blocco) => {
    const $b = $(blocco);
    const $a = $b.find('h1 a[href], h2 a[href], h3 a[href], h4 a[href], a.entry-title[href]').first();
    if (!$a.length) return;
    let url;
    try {
      url = new URL($a.attr('href'), baseUrl).href.split('#')[0];
    } catch {
      return;
    }
    if (!/^https?:/i.test(url)) return;
    if (new URL(url).hostname.replace(/^www\./i, '') !== host) return;
    if (RUMORE.test(url)) return;
    if (visti.has(url)) return;
    const titolo = norm($a.text());
    if (titolo.length < 12) return;
    visti.add(url);
    out.push({ url, titolo });
  });
  return out.slice(0, max);
}

function contenutoArticolo(html, url) {
  const $ = cheerio.load(html);
  $('script, style, nav, header, footer, aside, form').remove();
  const titolo = norm(
    $('h1.entry-title').first().text() ||
      $('h1').first().text() ||
      $('meta[property="og:title"]').attr('content') ||
      $('title').first().text(),
  );
  const corpo = norm(
    ($('.entry-content, article .content, main article, .article_wrapper, main, #content').first().text() || $('body').text()).slice(0, 8000),
  );
  const data =
    $('time[datetime]').first().attr('datetime') ||
    $('meta[property="article:published_time"]').attr('content') ||
    null;
  return { titolo, data, corpo: corpo.slice(0, 700) };
}

for (const f of readdirSync(DIR)) {
  const html = readFileSync(join(DIR, f), 'utf8');
  const base = 'https://' + f.split('_')[0] + '/';
  try {
    const post = estraiPostElenco(html, base);
    console.log(`\n### ${f}\n  post trovati: ${post.length}`);
    for (const p of post.slice(0, 4)) console.log(`   - ${p.titolo.slice(0, 70)} -> ${p.url.slice(0, 110)}`);
  } catch (e) {
    console.log(`\n### ${f}\n  ERRORE ${e.message}`);
  }
}

const esempi = [
  'https://fe.istruzioneer.gov.it/2026/10/23/interpello-per-supplenza-su-classe-di-concorso-aaaa-infanzia-posto-comune-46/',
  'https://www.mim.gov.it/web/bergamo/-/interpelli-per-il-conferimento-di-supplenza-personale-docente-n-65-1',
];
for (const u of esempi) {
  try {
    const res = await fetch(u, { headers: { 'User-Agent': 'Mozilla/5.0 Chrome/126' } });
    const html = await res.text();
    const a = contenutoArticolo(html, u);
    console.log(`\n=== ARTICOLO ${u} [${res.status}]\n  titolo: ${a.titolo}\n  data: ${a.data}\n  corpo: ${a.corpo.slice(0, 600)}`);
  } catch (e) {
    console.log(`\n=== ARTICOLO ${u} ERRORE ${e.message}`);
  }
}
