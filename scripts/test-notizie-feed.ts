/**
 * Verifica ORDINAMENTO e CADENZA del feed Notizie:
 *  · ordinamento STRETTO per data di pubblicazione DECRESCENTE (la prima card
 *    in alto a sinistra è sempre la più recente — regressione: un seed datato
 *    26 agosto con punteggio alto scavalcava gli aggiornamenti freschi);
 *  · cadenza settimanale BLOCCATA a 1–3 articoli datati negli ultimi 7 giorni;
 *  · il feed reale (`newsArticles`) parte dall'aggiornamento nazionale più fresco.
 *
 * Uso: npm run test:notizie-feed
 */
import {
  newsArticles,
  ordinaNotizie,
} from '../src/departments/notizie/services/newsService.ts';
import {
  MAX_ARTICOLI_SETTIMANA,
  limitaCadenzaSettimanale,
} from '../src/departments/notizie/services/relevanceEngine.ts';
import type { NewsArticle } from '../src/departments/notizie/types.ts';

let errori = 0;
function check(nome: string, atteso: unknown, ottenuto: unknown): void {
  const ok = JSON.stringify(atteso) === JSON.stringify(ottenuto);
  if (!ok) errori += 1;
  console.log(`${ok ? '✓' : '✗'} ${nome}: atteso=${JSON.stringify(atteso)} ottenuto=${JSON.stringify(ottenuto)}`);
}

function articolo(id: string, data: string, score: number): NewsArticle {
  return {
    id,
    title: `Articolo ${id}`,
    category: 'Scuole',
    deadline_date: null,
    summary_points: ['sintesi'],
    content_html: '<p>contenuto</p>',
    official_source_url: 'https://www.mim.gov.it/web/guest/-/esempio',
    official_pdf_url: null,
    relevance_score: score,
    published_at: data,
  };
}

console.log('— Ordinamento STRETTO (data decrescente, il punteggio NON conta) —');
const vecchioAltoPunteggio = articolo('vecchio-95', '2026-08-26T00:00:00.000Z', 95);
const frescoBassoPunteggio = articolo('fresco-70', '2026-09-11T00:00:00.000Z', 70);
const senzaData = articolo('senza-data', '', 99);
const ordinati = ordinaNotizie([vecchioAltoPunteggio, senzaData, frescoBassoPunteggio]);
check(
  'ordine: fresco → vecchio → senza data',
  ['fresco-70', 'vecchio-95', 'senza-data'],
  ordinati.map((a) => a.id),
);
check('la prima card è la PIÙ RECENTE', 'fresco-70', ordinati[0].id);
check('mai un articolo senza data in cima', false, ordinati[0].id === 'senza-data');

console.log('\n— Feed reale (`newsArticles`) —');
const date = newsArticles.map((a) => (a.published_at ? new Date(a.published_at).getTime() : 0));
const descrescente = date.every((t, i) => i === 0 || date[i - 1] >= t);
check('date non crescenti (newest first)', true, descrescente);
check('feed non vuoto', true, newsArticles.length > 0);
const prima = newsArticles[0];
console.log(`   prima card: [${prima.published_at}] ${prima.title.slice(0, 60)}`);
const piuRecente = [...newsArticles]
  .filter((a) => a.published_at)
  .sort((a, b) => (b.published_at || '').localeCompare(a.published_at || ''))[0];
check('prima card = articolo più recente', piuRecente.id, prima.id);
check(
  'la prima card NON è il seed di agosto',
  false,
  prima.id.includes('seed') && (prima.published_at || '').includes('2026-08'),
);

console.log('\n— Cadenza settimanale BLOCCATA (1–3 / settimana) —');
check('soglia settimanale = 3', 3, MAX_ARTICOLI_SETTIMANA);
const oggi = new Date('2026-09-13T12:00:00.000Z');
const recenti = [
  articolo('r1', '2026-09-12T00:00:00.000Z', 70),
  articolo('r2', '2026-09-11T00:00:00.000Z', 70),
  articolo('r3', '2026-09-10T00:00:00.000Z', 70),
  articolo('r4', '2026-09-09T00:00:00.000Z', 70),
  articolo('r5', '2026-09-08T00:00:00.000Z', 70),
];
const storico = articolo('storico', '2026-06-23T00:00:00.000Z', 90);
const esito = limitaCadenzaSettimanale([...recenti, storico], oggi);
check('restano 3 articoli recenti', 3, esito.mantenuti.filter((a) => a.id.startsWith('r')).length);
check('lo storico non viene toccato', true, esito.mantenuti.some((a) => a.id === 'storico'));
check('vengono scartati i 2 più vecchi', ['r4', 'r5'], esito.rimossi.map((a) => a.id));
check(
  'restano i PIÙ RECENTI',
  ['r1', 'r2', 'r3'],
  esito.mantenuti
    .filter((a) => a.id.startsWith('r'))
    .sort((a, b) => (b.published_at || '').localeCompare(a.published_at || ''))
    .map((a) => a.id),
);

console.log('\n— Invariante sul feed pubblicato —');
const soglia7 = Date.now() - 7 * 24 * 60 * 60 * 1000;
const recentiNelFeed = newsArticles.filter(
  (a) => a.published_at && new Date(a.published_at).getTime() >= soglia7,
);
check(
  `articoli datati negli ultimi 7 giorni ≤ ${MAX_ARTICOLI_SETTIMANA}`,
  true,
  recentiNelFeed.length <= MAX_ARTICOLI_SETTIMANA,
);
console.log(`   articoli negli ultimi 7 giorni: ${recentiNelFeed.length}`);

console.log('\n— GARANZIA SETTIMANALE (≥ 1 articolo datato negli ultimi 7 giorni) —');
check('almeno 1 articolo datato negli ultimi 7 giorni', true, recentiNelFeed.length >= 1);
if (recentiNelFeed.length === 0) {
  console.log(
    '   ⚠ sezione Notizie FERMA: verificare fonti/parser/motore di rilevanza (vedi èRiservaSettimanale in relevanceEngine).',
  );
}
const piuRecenteDated = newsArticles.find((a) => a.published_at);
console.log(
  `   articolo più recente: [${piuRecenteDated?.published_at ?? 'n/d'}] ${(piuRecenteDated?.title ?? 'n/d').slice(0, 60)}`,
);

console.log(errori === 0 ? '\n✅ NOTIZIE FEED: nessun problema' : `\n❌ NOTIZIE FEED: ${errori} errore/i`);
process.exitCode = errori === 0 ? 0 : 1;
