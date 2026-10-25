import * as cheerio from 'cheerio';

const urls = [
  'https://www.mim.gov.it/web/bergamo/-/interpelli-per-il-conferimento-di-supplenza-personale-docente-n-65-1',
  'https://www.istruzionematera.it/interpello-per-individuazione-reclutamento-personale-docente-scuola-infanzia-hn-metodo-montessori/',
  'https://www.usp-rieti.it/2026/10/23/i-i-s-carlo-jucci-interpello-as01-disegno-e-storia-dellarte/',
  'https://www.istruzionechietipescara.it/2026/10/21/interpello-nazionale-per-supplenza-scuola-primaria-sostegno-classe-di-concorso-adee/',
];
for (const u of urls) {
  try {
    const res = await fetch(u, { headers: { 'User-Agent': 'Mozilla/5.0 Chrome/126' } });
    const html = await res.text();
    const $ = cheerio.load(html);
    console.log(`\n=== ${u} [${res.status}]`);
    for (const sel of ['.entry-content', 'article .entry-content', 'main', '.article_wrapper', '.portlet-body', '#content', '[role="main"]']) {
      const n = $(sel).length;
      if (n) console.log(`  sel ${sel}: ${n} (${$(sel).first().text().replace(/\s+/g, ' ').trim().length} car)`);
    }
    console.log('  h1:', $('h1').first().text().replace(/\s+/g, ' ').trim().slice(0, 90));
    console.log('  time:', $('time[datetime]').first().attr('datetime') ?? '-', '| og:', $('meta[property="article:published_time"]').attr('content') ?? '-');
    const pdfs = [];
    $('a[href]').each((_, a) => {
      const h = $(a).attr('href') ?? '';
      if (/\.(pdf|docx?|odt)(\?|$)/i.test(h)) pdfs.push(`${$(a).text().replace(/\s+/g, ' ').trim().slice(0, 50)} -> ${h.slice(0, 100)}`);
    });
    console.log('  allegati:', pdfs.slice(0, 4));
  } catch (e) {
    console.log(`\n=== ${u} ERRORE ${e.message}`);
  }
}
