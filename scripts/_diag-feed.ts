/**
 * DIAGNOSTICA TEMPORANEA — perché la dashboard mostra 0 "Opportunità mappate".
 * Legge .env a mano (in Node `import.meta.env` è vuoto), interroga il DB reale e
 * riproduce ESATTAMENTE i filtri del feed (RPC + fallback) per il profilo attivo.
 * Da cancellare dopo l'uso.
 */
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const env = Object.fromEntries(
  readFileSync(new URL('../.env', import.meta.url), 'utf8')
    .split(/\r?\n/)
    .filter((l) => l && !l.startsWith('#') && l.includes('='))
    .map((l) => {
      const i = l.indexOf('=');
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    }),
) as Record<string, string>;

const url = env.VITE_SUPABASE_URL;
const anon = createClient(url, env.VITE_SUPABASE_ANON_KEY);
const svc = createClient(url, env.SUPABASE_SERVICE_ROLE_KEY);

const today = new Date().toISOString().slice(0, 10);

console.log('════ DEFINITIVO: feed dashboard ════');
console.log('URL:', url);

// 1) Contenuto reale della tabella (service role: nessuna RLS).
const { data: rows, error: errAll } = await svc
  .from('interpelli')
  .select('id,province,class_codes,expiration_date,created_at,title')
  .limit(2000);
console.log('\n[1] interpelli totali (service):', errAll?.message ?? 'ok', '→', rows?.length ?? 0);

if (rows) {
  const perProvincia = new Map<string, number>();
  const perClasse = new Map<string, number>();
  let attivi = 0;
  for (const r of rows) {
    const p = String(r.province ?? '(null)');
    perProvincia.set(p, (perProvincia.get(p) ?? 0) + 1);
    for (const c of r.class_codes ?? []) perClasse.set(String(c), (perClasse.get(String(c)) ?? 0) + 1);
    const vivo = r.expiration_date == null || r.expiration_date >= today;
    if (vivo) attivi += 1;
  }
  console.log('  attivi (non scaduti):', attivi);
  console.log('  province:', [...perProvincia.entries()].sort((a, b) => b[1] - a[1]).slice(0, 30));
  console.log('  classi:', [...perClasse.entries()].sort((a, b) => b[1] - a[1]).slice(0, 40));
}

// 2) Stessa lettura con la chiave ANON (ciò che vede l'app): RLS.
const { data: rowsAnon, error: errAnon } = await anon
  .from('interpelli')
  .select('id,province,class_codes,expiration_date')
  .limit(2000);
console.log('\n[2] interpelli totali (anon/RLS):', errAnon?.message ?? 'ok', '→', rowsAnon?.length ?? 0);

// 3) La RPC esiste nel DB live?
const rpc = await anon.rpc('match_interpelli', {
  p_province: ['AT', 'AL', 'CN', 'TO'],
  p_classi: ['A-22', 'A022', 'A24', 'A-24', 'A-18', 'A018', 'ESP-ESTERNI'],
  p_sostegno: true,
  p_limit: 100,
});
console.log('\n[3] RPC match_interpelli (anon):', rpc.error?.message ?? 'ok', '→', rpc.data?.length ?? 0);
if (rpc.error) console.log('     errore completo:', JSON.stringify(rpc.error));

// 4) Riproduzione del feed REALE usato da useInterpelliFeed → getFeedInterpelli.
process.env.VITE_SUPABASE_URL = url;
process.env.VITE_SUPABASE_ANON_KEY = env.VITE_SUPABASE_ANON_KEY;
const { searchInterpelli } = await import('../src/lib/matchingEngine.ts');
const feed = await searchInterpelli(anon, {
  province: ['AT', 'AL', 'CN', 'TO'],
  classi: ['A-22', 'A-24', 'A-18', 'ESP-ESTERNI'],
});
console.log('\n[4] searchInterpelli(profilo):', feed === null ? 'NULL' : `${feed.length} righe`);

// 5) RIPRODUZIONE COMPLETA della dashboard: fetch espanso al raggio + bacheca + gate UI.
const { getFeedInterpelli } = await import('../src/lib/matchingEngine.ts');
const { bachecaInterpelli } = await import('../src/lib/bachecaInterpelli.ts');
const { provinceDiRicerca } = await import('../src/lib/prossimitaGeografica.ts');
const { avvisoCompatibileConProfilo } = await import('../src/lib/matchingEngine.ts');
const { classeVicina } = await import('../src/lib/punteggioClasse.ts');
const { valutaCompatibilita } = await import('../src/lib/compatibilitaGraduata.ts');
const { costruisciAvviso } = await import('../src/lib/alertInterpello.ts');
const { motivoRigaNonOpportunitaAvviso } = await import('../src/lib/qualitaAvviso.ts');

const PROFILO = {
  province: ['AT', 'AL', 'CN', 'TO'],
  classi: ['A-22', 'A-24', 'A-18', 'ESP-ESTERNI'],
};
const ordini: string[] = ['secondaria2'];
const provinceRicerca = provinceDiRicerca(PROFILO.province);
console.log('\n[5] provinceDiRicerca(profilo):', provinceRicerca);

const feedProfilo = (await getFeedInterpelli(anon, {
  province: provinceRicerca,
  classi: PROFILO.classi,
})) ?? [];
console.log('[5] feed (getFeedInterpelli):', feedProfilo.length, 'righe');

for (const i of feedProfilo) {
  const avviso = {
    province: i.provinciaCodice,
    classi: i.classiCodes,
    materia: i.materia,
    titolo: i.titolo,
    ordine: i.ordine,
  };
  const conf = avvisoCompatibileConProfilo(PROFILO, avviso, { provinceLimitrofe: true });
  const val = valutaCompatibilita({ ...PROFILO, ordini }, avviso, { provinceLimitrofe: true });
  const motivoNonOpp = motivoRigaNonOpportunitaAvviso({
    titolo: i.titolo,
    materia: i.materia,
    classiCodes: i.classiCodes,
    istituto: i.istituto,
  });
  console.log(
    `   • [${i.provinciaCodice}] ${i.classeCodice} | classi=${JSON.stringify(i.classiCodes)} | materia=${JSON.stringify(i.materia)} | ` +
      `titolo="${(i.titolo ?? '').slice(0, 45)}" → confermato=${conf.ok}${conf.motivo ? '(' + conf.motivo + ')' : ''} ` +
      `classeVicina=${classeVicina(PROFILO, avviso)} escluso=${val.escluso} punteggio=${val.punteggio} ` +
      `| motivoNonOpportunita=${motivoNonOpp ?? 'NESSUNO (riga TENUTA)'}`,
  );
}

const esito = bachecaInterpelli(feedProfilo, {
  ordini,
  classi: PROFILO.classi,
  materieId: [],
  materieCustom: [],
  province: PROFILO.province,
});
console.log('[6] bachecaInterpelli → lista:', esito.lista.length, '| nonOpportunita:', esito.righeNonOpportunita, '| blacklist:', esito.esclusiBlacklist, '| riempitiviEsclusi:', esito.riempitiviEsclusi, '| nascosti:', esito.riempitiviNascosti);

// 7) GATE UI (DashboardPage): richiede Provincia + Ordine + Classe/Materia.
const oggi = Date.now();
const dopoScadenza = esito.lista.filter((i) => !i.dataScadenza || new Date(i.dataScadenza).getTime() > oggi);
const dopoGate = dopoScadenza.filter((i) => {
  const m = costruisciAvviso({
    provincia: i.provinciaNome || i.provinciaCodice,
    ordine: i.ordine,
    classCode: i.classeCodice,
    classCodes: i.classiCodes,
    materia: i.materia,
    scadenza: i.dataScadenza,
    schoolName: i.istituto,
  }).mancanti;
  if (m.length > 0) console.log('   ✗ scartato dal gate:', i.classeCodice, i.provinciaCodice, 'mancanti=', m);
  return !m.includes('Provincia') && !m.includes('Ordine di scuola') && !m.includes('Classe / Materia');
});
console.log('[7] dopo gate UI:', dopoGate.length, '| dopo scadenza:', dopoScadenza.length);

// 8) Cosa esiste DAVVERO nel DB per le province e le classi del profilo?
if (rows) {
  const prov = new Set(['AT', 'AL', 'CN', 'TO', 'VC', 'PV', 'NO']);
  const norm = (c: string) => String(c).toUpperCase().replace(/[^A-Z0-9]/g, '').replace(/^([A-Z]{1,2})0+/, '$1');
  const target = new Set(['A22', 'A24', 'A18', 'ESPESTERNI']);
  console.log('\n[8a] righe nelle PROVINCE del profilo (incl. raggio):');
  for (const r of rows) {
    if (!prov.has(String(r.province))) continue;
    console.log(`   [${r.province}] class_codes=${JSON.stringify(r.class_codes)} titolo="${String(r.title ?? '').slice(0, 60)}"`);
  }
  console.log('\n[8b] righe con una CLASSE del profilo (qualunque provincia):');
  for (const r of rows) {
    const hit = (r.class_codes ?? []).filter((c) => target.has(norm(String(c))));
    if (hit.length === 0) continue;
    console.log(`   [${r.province}] match=${JSON.stringify(hit)} class_codes=${JSON.stringify(r.class_codes)} titolo="${String(r.title ?? '').slice(0, 60)}"`);
  }
}

console.log('\n════ fine ════');
