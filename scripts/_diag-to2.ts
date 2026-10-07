/* TEMP — diagnostica decodifica righe tabella Piemonte (ric_interpello_ambito_to.php). Da cancellare. */
import { readFileSync } from 'node:fs';
import * as cheerio from 'cheerio';
import { parseAvvisi } from '../src/scraper/index.ts';
import { espandiElencoInAvvisi, estraiVociElenco, ePaginaElenco } from '../src/scraper/elenchi.ts';

const html = readFileSync(new URL('./_to_live.html', import.meta.url), 'utf8');
const base = 'https://servizi.istruzionepiemonte.it/interpello2026/ric_interpello_ambito_to.php';
console.log('len html =', html.length);

console.log('\n--- parseAvvisi ---');
const pa = parseAvvisi(html, 'TO', base);
console.log('n =', pa.length);
for (const a of pa.slice(0, 10)) {
  console.log('  title=', JSON.stringify(a.title.slice(0, 140)), '| link=', a.link, '| school=', a.schoolName, '| classi=', a.classCodes);
}

console.log('\n--- estraiVociElenco ---');
const voci = estraiVociElenco(html, base);
console.log('n =', voci.length);
for (const v of voci.slice(0, 5)) console.log('  ', v.titolo.slice(0, 100), '=>', v.url);

console.log('\n--- espandiElencoInAvvisi ---');
const ea = espandiElencoInAvvisi(html, { baseUrl: base, provincia: 'TO', source: base });
console.log('n =', ea.length);

console.log('\n--- ePaginaElenco ---', ePaginaElenco(html, base, base));

const $ = cheerio.load(html);
console.log('title/h1:', $('h1,title').first().text().replace(/\s+/g, ' ').slice(0, 160));

console.log('\n--- prime 6 <tr> ---');
$('tr').slice(0, 6).each((i, el) => {
  const th = $(el).find('th').length;
  const td = $(el).find('td').length;
  const a = $(el).find('a').length;
  console.log(`[tr ${i}] th=${th} td=${td} a=${a}`);
  console.log('   text=', $(el).text().replace(/\s+/g, ' ').trim().slice(0, 260));
  console.log('   html=', $.html(el).replace(/\s+/g, ' ').slice(0, 500));
});

console.log('\n--- righe con codice meccanografico (prime 5) ---');
let n = 0;
$('tr').each((_, el) => {
  if (n >= 5) return;
  const t = $(el).text().replace(/\s+/g, ' ').trim();
  if (/\b[A-Z]{2}[A-Z0-9]{4}\d{3}[A-Z0-9]\b/i.test(t)) {
    n += 1;
    console.log(`[cod ${n}] td=${$(el).find('td').length} a=${$(el).find('a').length} text=`, t.slice(0, 300));
  }
});
