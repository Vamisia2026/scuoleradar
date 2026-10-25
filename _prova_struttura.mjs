import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import * as cheerio from 'cheerio';

const dir = join(process.env.TEMP, 'elenchi');
const files = [
  'atavellino.it_avvisi_.html',
  'www.istruzionechietipescara.it_category_interpelli-provinciali_.html',
  'www.istruzionematera.it_category_interpelli_.html',
  'www.usp-rieti.it_interpelli_.html',
];
for (const f of files) {
  const $ = cheerio.load(readFileSync(join(dir, f), 'utf8'));
  console.log(`\n##### ${f}`);
  console.log('  article:', $('article').length, '| .post:', $('.post').length, '| entry-title:', $('.entry-title').length, '| h1:', $('h1').length, '| h2:', $('h2').length, '| h3:', $('h3').length);
  const seen = new Set();
  $('a[href]').each((_, a) => {
    const href = $(a).attr('href') ?? '';
    if (!/^https?:/i.test(href) && !href.startsWith('/')) return;
    if (seen.has(href)) return;
    const txt = $(a).text().replace(/\s+/g, ' ').trim();
    if (txt.length < 25) return;
    seen.add(href);
    const pad = $(a).parents().slice(0, 3).map((_, p) => `${p.tagName}${p.attribs?.class ? '.' + p.attribs.class.split(/\s+/).slice(0, 2).join('.') : ''}`).get().reverse().join('>');
    console.log(`   [${txt.length}] ${txt.slice(0, 70)} :: ${href.slice(0, 95)}\n        ^ ${pad}`);
    if (seen.size >= 8) return false;
  });
}
