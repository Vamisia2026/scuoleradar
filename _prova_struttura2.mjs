import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import * as cheerio from 'cheerio';

const dir = join(process.env.TEMP, 'elenchi');
function dump(file, re, max = 14) {
  const $ = cheerio.load(readFileSync(join(dir, file), 'utf8'));
  console.log(`\n##### ${file}  (${re})`);
  let n = 0;
  $('a[href]').each((_, a) => {
    const href = $(a).attr('href') ?? '';
    if (!re.test(href)) return;
    const pad = $(a).parents().slice(0, 4).map((_, p) => `${p.tagName}${p.attribs?.class ? '.' + p.attribs.class.split(/\s+/).slice(0, 2).join('.') : ''}`).get().reverse().join('>');
    console.log(`   "${$(a).text().replace(/\s+/g, ' ').trim().slice(0, 80)}"\n     ${href.slice(0, 110)}\n     ^ ${pad}`);
    if (++n >= max) return false;
  });
  if (n === 0) console.log('   (nessun link)');
  // anche i contenitori candidati
  for (const sel of ['article', '.entry-content', 'main', '#main', '#content', '.site-main', '.posts', '.elementor-widget-theme-post-content', 'table tbody']) {
    if ($(sel).length) console.log(`   sel ${sel}: ${$(sel).length}`);
  }
  console.log('   testo body (prime 300):', $('body').text().replace(/\s+/g, ' ').trim().slice(0, 300));
}
dump('www.istruzionechietipescara.it_category_interpelli-provinciali_.html', /\/2026\//);
dump('atavellino.it_avvisi_.html', /interpello|avvis|supplen|incarico/i);
dump('www.istruzionematera.it_category_interpelli_.html', /\/20\d\d\/|interpello/i);
