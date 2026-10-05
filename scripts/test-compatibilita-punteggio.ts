/**
 * TEST — PUNTEGGIO di compatibilità + banda cromatica (Radar / bacheca).
 * --------------------------------------------------------------------------
 * Verifica tre requisiti di prodotto:
 *
 *   1. SOGLIE cromatiche, una sola fonte di verità (`src/lib/compatibilita.ts`):
 *      🔴 rosso ≥ 60 · 🟠 arancio ≥ 70 · 🟢 verde ≥ 80 — e sotto 60 nessun badge.
 *
 *   2. PUNTEGGIO del motore (`punteggioCompatibilita`, `src/lib/matchingEngine.ts`):
 *      · 100 provincia + classe in comune;
 *      ·  80 avviso senza codice classe, ma materia coperta dalle proprie classi;
 *      ·  70 profilo configurato solo su competenze/parole chiave;
 *      ·  60 AREA SOSTEGNO senza una classe AD… propria → SUGGERIMENTO EXTRA
 *           (banda rossa: resta in bacheca ma va in coda, mai tra le priorità);
 *      ·   0 non compatibile.
 *
 *   3. CABLAGGIO: card e modale colorano con la banda condivisa, il feed della
 *      dashboard applica il punteggio, la bacheca ordina per compatibilità, le
 *      preferenze Admin sono complete (blocco condiviso scheda + card).
 *
 * Esecuzione: npm run test:compatibilita (incluso in `npm test`)
 */
import { readFileSync } from 'node:fs';
import {
  SOGLIA_COMPATIBILITA_ARANCIO,
  SOGLIA_COMPATIBILITA_ROSSO,
  SOGLIA_COMPATIBILITA_VERDE,
  bandaCompatibilita,
  etichettaCompatibilita,
  livelloCompatibilita,
} from '../src/lib/compatibilita.ts';
import {
  PUNTEGGIO_EXTRA_SOSTEGNO,
  PUNTEGGIO_MATCH_ESATTO,
  PUNTEGGIO_MATCH_NESSUNO,
  PUNTEGGIO_MATCH_POSSIBILE,
  PUNTEGGIO_MATCH_PROBABILE,
  etichetteMaterieClasse,
  profiloAderisceSostegno,
  punteggioCompatibilita,
} from '../src/lib/matchingEngine.ts';

let errori = 0;
function check(nome: string, atteso: unknown, ottenuto: unknown): void {
  const ok = JSON.stringify(atteso) === JSON.stringify(ottenuto);
  if (!ok) errori += 1;
  console.log(`${ok ? '✓' : '✗'} ${nome}: atteso=${JSON.stringify(atteso)} ottenuto=${JSON.stringify(ottenuto)}`);
}
const leggi = (p: string): string => readFileSync(p, 'utf8');

/* ----------------------------- 1) SOGLIE ----------------------------------- */

console.log('— Soglie cromatiche: 60 rosso · 70 arancio · 80 verde —');
check('soglia rossa = 60', 60, SOGLIA_COMPATIBILITA_ROSSO);
check('soglia arancio = 70', 70, SOGLIA_COMPATIBILITA_ARANCIO);
check('soglia verde = 80', 80, SOGLIA_COMPATIBILITA_VERDE);
check('59 → sotto soglia (nessun badge)', 'sotto-soglia', livelloCompatibilita(59));
check('60 → rosso', 'rosso', livelloCompatibilita(60));
check('69 → rosso', 'rosso', livelloCompatibilita(69));
check('70 → arancio', 'arancio', livelloCompatibilita(70));
check('79 → arancio', 'arancio', livelloCompatibilita(79));
check('80 → verde', 'verde', livelloCompatibilita(80));
check('100 → verde', 'verde', livelloCompatibilita(100));
check('input corrotto (NaN) → sotto soglia', 'sotto-soglia', livelloCompatibilita(Number.NaN));

console.log('\n— Banda completa: etichetta, visibilità e classi Tailwind —');
check(
  '100: visibile + «100% Compatibile»',
  true,
  bandaCompatibilita(100).visibile && etichettaCompatibilita(100) === '100% Compatibile',
);
check('100: palette verde (accent)', true, /accent/.test(bandaCompatibilita(100).className));
check('70: palette arancio (warning)', true, /warning/.test(bandaCompatibilita(70).className));
check('60: «60% · extra»', '60% · extra', bandaCompatibilita(60).etichetta);
check('60: palette rossa (error)', true, /error/.test(bandaCompatibilita(60).className));
check('60: descrizione «suggerimento extra»', true, /[Ee]xtra/.test(bandaCompatibilita(60).descrizione));
check('59: badge NON visibile', false, bandaCompatibilita(59).visibile);
check('0: badge NON visibile', false, bandaCompatibilita(0).visibile);
check('punteggio fuori scala (140) → 100', 100, bandaCompatibilita(140).punteggio);

/* --------------------------- 2) PUNTEGGIO ---------------------------------- */

console.log('\n— Motore: 100 / 80 / 70 / 60 / 0 —');
const tedesco = { province: ['TO'], classi: ['A-22'] };
check(
  'provincia + classe in comune → 100',
  PUNTEGGIO_MATCH_ESATTO,
  punteggioCompatibilita(tedesco, { province: 'TO', classi: ['A-022'] }),
);

const etichetteA22 = etichetteMaterieClasse('A-22');
check('A-22 copre almeno una materia (fixture del caso 80)', true, etichetteA22.length > 0);
check(
  'avviso senza codice classe ma materia coperta → 80',
  PUNTEGGIO_MATCH_PROBABILE,
  punteggioCompatibilita(tedesco, { province: 'TO', classi: [], materia: etichetteA22[0] }),
);
check(
  'profilo solo competenze × materia dell’avviso → 70',
  PUNTEGGIO_MATCH_POSSIBILE,
  punteggioCompatibilita(
    { province: ['TO'], classi: [], materieCustom: ['Lingua inglese'] },
    { province: 'TO', classi: [], materia: 'Inglese' },
  ),
);
check('provincia diversa → 0', PUNTEGGIO_MATCH_NESSUNO, punteggioCompatibilita(tedesco, { province: 'PO', classi: ['A-022'] }));
check(
  'riservato ai profili notificabili (ignoraFiltri) → 100',
  PUNTEGGIO_MATCH_ESATTO,
  punteggioCompatibilita({ classi: [] }, { province: 'PO' }, { ignoraFiltri: true }),
);

console.log('\n— AREA SOSTEGNO: inclusa sempre, ma EXTRA senza una classe AD… propria —');
const avvisoSostegno = { province: 'TO', classi: ['ADEE', 'A-022'], titolo: 'Interpello sostegno scuola primaria' };
check(
  'docente A-22 (nessuna classe di sostegno) → 60',
  PUNTEGGIO_EXTRA_SOSTEGNO,
  punteggioCompatibilita(tedesco, avvisoSostegno),
);
check('60 è nella banda ROSSA', 'rosso', livelloCompatibilita(punteggioCompatibilita(tedesco, avvisoSostegno)));
check(
  'docente con classe ADEE → 100',
  PUNTEGGIO_MATCH_ESATTO,
  punteggioCompatibilita({ province: ['TO'], classi: ['ADEE'] }, avvisoSostegno),
);
check('profiloAderisceSostegno: A-22 → false', false, profiloAderisceSostegno({ classi: ['A-22'] }));
check('profiloAderisceSostegno: « adee » (forma delle fonti) → true', true, profiloAderisceSostegno({ classi: [' adee '] }));
check(
  'profiloAderisceSostegno: la colonna legacy `sostegno` NON è una scelta',
  false,
  profiloAderisceSostegno({ classi: ['A-22'], sostegno: true }),
);
check(
  'avviso DISCIPLINARE dello stesso docente resta 100 (nessuna regressione)',
  PUNTEGGIO_MATCH_ESATTO,
  punteggioCompatibilita(tedesco, { province: 'TO', classi: ['A-022'], titolo: 'Interpello di tedesco' }),
);

/* --------------------------- 3) CABLAGGIO ---------------------------------- */

console.log('\n— Cablaggio: card/modale, feed, ordine della bacheca —');
const card = leggi('src/components/InterpelloCard.tsx');
const modale = leggi('src/components/InterpelloDettaglioModal.tsx');
const feed = leggi('src/contexts/app/useInterpelliFeed.ts');
const bacheca = leggi('src/lib/bachecaInterpelli.ts');
const dashboard = leggi('src/pages/DashboardPage.tsx');
const motore = leggi('src/lib/matchingEngine.ts');
check('card: usa la banda condivisa', true, /bandaCompatibilita\(/.test(card) && /banda\.visibile/.test(card));
check('modale: usa la stessa banda', true, /bandaCompatibilita\(/.test(modale) && /banda\.visibile/.test(modale));
check(
  'badge non più cablato al solo 100%',
  false,
  /compatibilita === 100/.test(card) || /compatibilita === 100/.test(modale),
);
check('feed: delega alla bacheca pura', true, /bachecaInterpelli\(/.test(feed));
check('bacheca: applica il punteggio delle modali', true, /valutaCompatibilita\(/.test(bacheca));
check('bacheca: prima la compatibilità, poi la scadenza', true, /const ca = a\.compatibilita \?\? 100;/.test(dashboard));
check('il punteggio vive nel motore', true, /export function punteggioCompatibilita\(/.test(motore));
check('le soglie vivono solo nel modulo condiviso', true, /SOGLIA_COMPATIBILITA_ROSSO = 60/.test(leggi('src/lib/compatibilita.ts')));

console.log('\n— Admin: preferenze complete (blocco condiviso scheda + card) —');
const blocco = leggi('src/departments/admin/components/PreferenzeUtente.tsx');
const pure = leggi('src/departments/admin/components/derivaPreferenzeUtente.ts');
const dettaglio = leggi('src/departments/admin/tabs/utenti/DettaglioUtente.tsx');
const tabRadar = leggi('src/departments/admin/tabs/TabRadar.tsx');
check('scheda: monta il blocco condiviso', true, /<PreferenzeUtente\b/.test(dettaglio));
check(
  'card «Radar»: monta lo stesso blocco (variante compatta)',
  true,
  /<PreferenzeUtente\b/.test(tabRadar) && /variante="compatto"/.test(tabRadar),
);
check('blocco: ordini di scuola', true, /Ordini di scuola/.test(blocco));
check('blocco: classi di concorso', true, /Classi di concorso/.test(blocco));
check('blocco: materie e competenze extra', true, /Materie e competenze extra/.test(blocco));
check('blocco: tag personalizzati', true, /Tag personalizzati/.test(blocco));
check('blocco: scuole preferite ed escluse', true, /Scuole preferite/.test(blocco) && /Scuole escluse/.test(blocco));
check('derivazione: ordini risolti nel nome leggibile', true, /ordiniScuola/.test(pure));
check('derivazione: competenze di catalogo risolte nel nome', true, /etichetteCompetenzeProfilo/.test(pure));

console.log('\n— La guardia è nella catena di `npm test` —');
const catena = JSON.parse(leggi('package.json')) as { scripts: Record<string, string> };
check('script dedicato', true, 'test:compatibilita' in catena.scripts);
check('guardia nella catena', true, (catena.scripts.test ?? '').includes('scripts/test-compatibilita-punteggio.ts'));

console.log(
  errori === 0
    ? '\n✅ COMPATIBILITÀ: soglie 60/70/80, sostegno extra a 60, preferenze Admin complete.'
    : `\n❌ COMPATIBILITÀ: ${errori} errore/i`,
);
process.exitCode = errori === 0 ? 0 : 1;
