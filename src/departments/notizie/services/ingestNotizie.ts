/**
 * ScuoleRadar.it — Ingestione Notizie (entry point CLI / cron).
 *
 * Pipeline:
 *   1. raccoglie le voci reali dalle fonti ufficiali (MIM, Gazzetta Ufficiale);
 *   2. applica il motore di rilevanza (rifiuta contenuti non vincolanti,
 *      accetta solo decreti/note/scadenze per il personale scolastico);
 *   3. estrae la data di scadenza ufficiale e genera l'articolo editoriale
 *      (date esatte, acronimi spiegati, link ai portali ufficiali);
 *   4. scrive il risultato in `src/departments/notizie/data/notizieIngestite.ts`
 *      (file letto dall'app) oppure lo stampa in dry-run.
 *
 * Uso:
 *   npm run scrape:notizie            # pipeline completa (scrive il file dati)
 *   npm run scrape:notizie -- --dry-run   # solo estrazione + filtro, nessuna scrittura
 */
import process from 'node:process';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { raccogliNotizieRaw, type VoceFonte } from './newsFetcher.ts';
import {
  valutaRilevanza,
  punteggioRilevanza,
  articoloValido,
  generaArticoloEditoriale,
  type ValutazioneNotizia,
} from './relevanceEngine.ts';
import type { NewsArticle } from '../types.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FILE_USCITA = join(__dirname, '..', 'data', 'notizieIngestite.ts');

function slug(testo: string): string {
  return testo
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

function dataPubblicazione(pubDate: string | null): string {
  if (!pubDate) return '';
  const d = new Date(pubDate);
  return Number.isNaN(d.getTime()) ? '' : d.toISOString();
}

/** Estrae un eventuale link PDF dal sommario HTML della fonte. */
function cercaPdf(descrizione: string): string | null {
  const m = descrizione.match(/href="([^"]+\.pdf[^"]*)"|src="([^"]+\.pdf[^"]*)"/i);
  if (m) return m[1] ?? m[2] ?? null;
  const url = descrizione.match(/https?:\/\/[^\s"']+\.pdf[^\s"']*/i);
  return url ? url[0] : null;
}

/** Trasforma una voce grezza in un NewsArticle (se supera il filtro di rilevanza). */
function costruisciArticolo(v: VoceFonte): NewsArticle | null {
  const valutazione: ValutazioneNotizia = valutaRilevanza({
    title: v.title,
    description: v.description,
  });
  if (!valutazione.rilevante) {
    console.log(
      `  ✗ RIFIUTATA: ${v.title.slice(0, 70)} — ${valutazione.motivo ?? 'non rilevante'}`,
    );
    return null;
  }
  const { content_html, summary_points } = generaArticoloEditoriale({
    title: v.title,
    categoria: valutazione.categoria,
    deadline: valutazione.deadline,
    fonte: v.fonte,
    descrizione: v.description,
    official_url: v.link,
  });
  const articolo: NewsArticle = {
    id: `notizia-${slug(v.title)}-${slug(v.fonte)}`,
    title: v.title,
    category: valutazione.categoria ?? 'Scuole',
    deadline_date: valutazione.deadline,
    summary_points,
    content_html,
    official_source_url: v.link,
    official_pdf_url: cercaPdf(v.description ?? ''),
    relevance_score: punteggioRilevanza(valutazione.categoria, Boolean(valutazione.deadline)),
    published_at: dataPubblicazione(v.pubDate),
  };
  return articoloValido(articolo) ? articolo : null;
}

async function main(): Promise<void> {
  const isDryRun = process.argv.includes('--dry-run');
  console.log('=== Ingestione Notizie ScuoleRadar ===');

  const voci = await raccogliNotizieRaw();
  console.log(`• Voci raccolte: ${voci.length}`);

  // De-duplica per link.
  const unici = [...new Map(voci.map((v) => [v.link, v])).values()];
  console.log(`• Voci uniche: ${unici.length}`);

  const articoli = unici
    .map(costruisciArticolo)
    .filter((a): a is NewsArticle => a !== null);
  console.log(`• Articoli accettati dal filtro di rilevanza: ${articoli.length}`);

  if (articoli.length === 0) {
    console.log('Nessuna notizia rilevante da pubblicare.');
    if (!isDryRun) console.log('Il file dati resta invariato (fallback in uso).');
    return;
  }

  if (isDryRun) {
    console.log('=== DRY-RUN (nessuna scrittura) ===');
    articoli.forEach((a) => {
      console.log(
        `  ✓ [${a.category}] ${a.title.slice(0, 70)} | scad: ${a.deadline_date ?? 'n/d'}`,
      );
    });
    return;
  }

  const contenuto = `/**
 * ScuoleRadar.it — Notizie ingestite (dati reali).
 *
 * File GENERATO automaticamente dal servizio di ingestione:
 *   npm run scrape:notizie
 * Non modificarlo a mano: il contenuto viene sovrascritto ad ogni ingestione.
 */
import type { NewsArticle } from '../types';

/** Notizie reali ingressate dalle fonti ufficiali (MIM, Gazzetta Ufficiale). */
export const notizieIngestite: NewsArticle[] = ${JSON.stringify(articoli, null, 2)};
`;

  mkdirSync(dirname(FILE_USCITA), { recursive: true });
  writeFileSync(FILE_USCITA, contenuto, 'utf8');
  console.log(`✓ Scritti ${articoli.length} articoli in ${FILE_USCITA}`);
}

main().catch((err) => {
  console.error('✗ Errore imprevisto nell\'ingestione Notizie:', err);
  process.exitCode = 1;
});

