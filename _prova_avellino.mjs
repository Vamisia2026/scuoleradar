const cand = [
  'https://atavellino.it/',
  'https://atavellino.it/interpelli/',
  'https://atavellino.it/category/interpelli/',
  'https://atavellino.it/avvisi-interpelli/',
  'https://atavellino.it/?s=interpello',
  'https://atavellino.it/wp-sitemap.xml',
];
for (const u of cand) {
  try {
    const r = await fetch(u, { headers: { 'User-Agent': 'Mozilla/5.0 Chrome/126' }, redirect: 'follow' });
    const t = await r.text();
    console.log(`${r.status} ${u} (${t.length} byte) -> ${r.url}`);
    if (r.status === 200) {
      const links = [...t.matchAll(/href="(https:\/\/atavellino\.it\/[^"#?]+)"/g)].map((m) => m[1]);
      const slugs = [...new Set(links)].filter((h) => /interpell|avvis|supplen/i.test(h));
      console.log('   link pertinenti:', slugs.slice(0, 10));
    }
  } catch (e) {
    console.log(`ERR ${u} ${e.message}`);
  }
}
