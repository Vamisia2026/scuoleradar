/**
 * Monitor di CADENZA della sezione Notizie.
 *
 * Target editoriale: ALMENO 1 notizia a settimana. Questo script legge
 * l'archivio ingestito + i seed curati e verifica quanti articoli risultano
 * pubblicati negli ultimi 7 giorni.
 *
 * Uso:
 *   npm run test:notizie-rate            # fallisce (exit 1) se la bacheca è ferma
 *   npm run test:notizie-rate -- --warn  # solo report, exit 0
 *
 * NB: gli articoli senza data di fonte ricevono la data di rilevazione
 * (vedi `ingestNotizie.ts`), quindi l'archivio è sempre datato.
 */
import { notizieIngestite } from '../src/departments/notizie/data/notizieIngestite.ts';
import { notizieSeed } from '../src/departments/notizie/data/notizieSeed.ts';
import type { NewsArticle } from '../src/departments/notizie/types.ts';

const SOLO_WARN = process.argv.includes('--warn');
const tutti: NewsArticle[] = [...notizieSeed, ...notizieIngestite];

const conData = tutti
  .map((a) => ({ a, t: a.published_at ? new Date(a.published_at).getTime() : Number.NaN }))
  .filter((x) => !Number.isNaN(x.t))
  .sort((x, y) => y.t - x.t);

const soglia7 = Date.now() - 7 * 24 * 60 * 60 * 1000;
const ultimi7 = conData.filter((x) => x.t >= soglia7);

console.log('━━ Cadenza Notizie (target ≥ 1 a settimana) ━━');
console.log(`• Articoli totali (seed + ingestiti): ${tutti.length}`);
console.log(`• Con data valida: ${conData.length}`);
console.log(`• Pubblicati negli ultimi 7 giorni: ${ultimi7.length}`);
if (conData.length > 0) {
  const recente = conData[0];
  const giorni = Math.floor((Date.now() - recente.t) / (24 * 60 * 60 * 1000));
  console.log(`• Articolo più recente: "${recente.a.title.slice(0, 70)}" (${giorni} giorno/i fa)`);
}

if (ultimi7.length === 0) {
  console.warn('⚠ RATE: nessun articolo negli ultimi 7 giorni — la sezione Notizie è FERMA.');
  if (!SOLO_WARN) process.exitCode = 1;
} else {
  console.log('✅ RATE: cadenza settimanale rispettata.');
}
