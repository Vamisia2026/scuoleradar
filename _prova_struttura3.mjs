import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import * as cheerio from 'cheerio';

const $ = cheerio.load(readFileSync(join(process.env.TEMP, 'elenchi', 'atavellino.it_avvisi_.html'), 'utf8'));
const box = $('.elementor-widget-theme-post-content');
console.log('testo:', box.text().replace(/\s+/g, ' ').trim().slice(0, 1200));
console.log('\nlink nel contenuto:');
box.find('a[href]').each((_, a) => console.log(` - "${$(a).text().replace(/\s+/g, ' ').trim().slice(0, 70)}" -> ${($(a).attr('href') ?? '').slice(0, 110)}`));
console.log('\niframe/script con elenchi:', $('iframe').length, $('script[src*="api"], script[src*="json"]').length);
console.log('titolo pagina:', $('title').text().trim());
console.log('elementor loop/archive:', $('[class*="elementor-loop"], [class*="elementor-posts"], [class*="e-loop"]').length);
