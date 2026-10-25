const lists = [
  'https://fe.istruzioneer.gov.it/category/interpelli_docenti/',
  'https://fe.istruzioneer.gov.it/category/interpelli-personale-ata/',
  'https://fc.istruzioneer.gov.it/category/interpelli-a-s-2026-27/',
  'https://mo.istruzioneer.gov.it/category/interpelli-personale-docente-2026-27/',
  'https://pr.istruzioneer.gov.it/interpelli-docenti/',
  'https://pc.istruzioneer.gov.it/interpelli/',
  'https://ra.istruzioneer.gov.it/conferimento-supplenze-per-esaurimento-graduatorie-di-istituto/',
  'https://re.istruzioneer.gov.it/category/docenti/interpello/',
  'https://padova.istruzioneveneto.gov.it/category/interpelli-personale-docente/',
  'https://lnx.csalaquila.it/wp/category/interpelli-nazionali/',
  'https://www.istruzionechietipescara.it/category/interpelli-provinciali/',
  'https://www.istruzionematera.it/category/interpelli/',
  'https://www.usp-rieti.it/interpelli/',
  'https://www.atpromaistruzione.it/atp/category/reclutamento/interpelli-personale-docente/',
  'https://www.usr.sicilia.it/category/personale-scuola/docenti/interpelli-nazionali-contratti-a-tempo-determinato-docenti/',
  'https://www.istruzionepotenza.it/interpelli-nazionali-docenti/',
  'https://www.uat-caserta.it/interpelli/',
  'https://www.csateramo.it/wpusp/',
  'https://atavellino.it/?s=interpello&feed=rss2',
];
for (const base of lists) {
  const u = /[?&]feed=/.test(base) ? base : `${base.replace(/\/$/, '')}/feed/`;
  try {
    const r = await fetch(u, { headers: { 'User-Agent': 'Mozilla/5.0 Chrome/126' } });
    const t = await r.text();
    const items = (t.match(/<item>/g) ?? []).length;
    const ct = r.headers.get('content-type') ?? '';
    console.log(`${r.status} items:${String(items).padStart(2)} ${ct.split(';')[0]} ${u}`);
  } catch (e) {
    console.log(`ERR ${u} ${e.message}`);
  }
}
