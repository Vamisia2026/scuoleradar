import { readFileSync } from 'node:fs';
import * as cheerio from 'cheerio';

const DIR = process.env.TEMP + '\\elenchi';
const norm = (s) => (s ?? '').replace(/\s+/g, ' ').trim();
const files = [
  'atavellino.it_avvisi_.html',
  'www.istruzionechietipescara.it_category_interpelli-provinciali_.html',
  'www.istruzionematera.it_category_interpelli_.html',
  'www.usp-rieti.it_interpelli_.html',
];
for (const f of files) {
  const html = readFileSync(DIR + '\\' + f, 'utf8');
  const $ = cheerio.load(html);
  const host = 'x';
  console.log(`\n### ${f}`);
  let n = 0;
  $('h1 a[href], h2 a[href], h3 a[href], h4 a[href]').each((_, a) => {
    const $a = $(a);
    if ($a.closest('nav, header, footer').length > 0) return;
    if (n >= 8) return;
    n += 1;
    console.log(`  [${norm($a.text()).slice(0, 80)}] -> ${($a.attr('href') ?? '').slice(0, 120)} (h=${$a.parent()[0].tagName})`);
  });
  // contenuto principale: link lunghi non-heading
  console.log('  -- link lunghi fuori da heading --');
  let m = 0;
  $('a[href]').each((_, a) => {
    const $a = $(a);
    if ($a.closest('nav, header, footer').length > 0) return;
    if ($a.parents('h1,h2,h3,h4').length > 0) return;
    const t = norm($a.text());
    if (t.length < 35 || t.length > 200) return;
    if (m >= 8) return;
    m += 1;
    console.log(`  [${t.slice(0, 90)}] -> ${($a.attr('href') ?? '').slice(0, 120)}`);
  });
}
