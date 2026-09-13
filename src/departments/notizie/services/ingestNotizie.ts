/**
 * ScuoleRadar.it — Ingestione Notizie (entry point CLI / cron).
 *
 * Pipeline (vedi docs/BLOG_EDITORIAL_GUIDELINES.md):
 *   1. raccoglie le voci reali dalle fonti ufficiali (MIM, Gazzetta Ufficiale)
 *      con log HTTP esplicito per ogni fonte (nessun silent-fail);
 *   2. applica il motore di rilevanza (ZERO rumore: rifiuta contenuti non
 *      vincolanti, accetta solo decreti/note/ordinanze/scadenze operative);
 *   3. valida l'integrità degli URL della fonte (STRICT URL INTEGRITY: niente
 *      root-domain generici né mockup) e verifica che il link risponda
 *      HTTP 200/3xx;
 *   4. estrae la data di scadenza ufficiale e genera l'articolo editoriale
 *      (date esatte, acronimi spiegati, link di approfondimento reali);
 *   5. applica il LOOKBACK di 15 giorni (avvio anno scolastico: presa di
 *      servizio, interpelli, supplenze…) e il tetto articoli (max 6 ad alto
 *      valore nella finestra, ≈3/settimana);
 *   6. AGGIUNGE le nuove notizie all'archivio esistente (accumulo con dedupe
 *      per id: la bacheca non si svuota mai) e scrive il risultato in
 *      `src/departments/notizie/data/notizieIngestite.ts`.
 *
 * Esiti e log:
 *   - fonti OK, nessuna notizia nuova → "✓ HTTP 200 - 0 new posts criteria matched"
 *     (esecuzione riuscita, file invariato, nessun commit necessario);
 *   - fonti OK, N notizie nuove → "✓ HTTP 200 - N new posts criteria matched";
 *   - tutte le fonti non raggiungibili → "✗ HTTP FAIL" + exit code 1
 *     (il workflow GitHub lo segnala con un warning, mai un fallimento silenzioso).
 *
 * Uso:
 *   npm run scrape:notizie            # pipeline completa (scrive il file dati)
 *   npm run scrape:notizie -- --dry-run   # solo estrazione + filtro, nessuna scrittura
 */
import process from 'node:process';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { raccogliNotizieRaw, verificaUrlUfficiale, type VoceFonte } from './newsFetcher.ts';
import { notizieIngestite } from '../data/notizieIngestite.ts';
import {
  valutaRilevanza,
  punteggioRilevanza,
  articoloValido,
  generaArticoloEditoriale,
  validaUrlDeepLink,
  èFonteCanonica,
  limitaArticoliSettimanali,
  FINESTRA_LOOKBACK_GIORNI,
  MAX_ARTICOLI_FINESTRA,
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

/**
 * Data di RILEVAZIONE (fallback): se la fonte ufficiale non dichiara una data di
 * pubblicazione (es. pagine operative USR sempre aggiornate), l'articolo assume
 * la data di ingestione. Così la bacheca mostra correttamente l'aggiornamento
 * (non resta "ferma" su agosto) e la cadenza settimanale è misurabile.
 */
function dataRilevazione(): string {
  return new Date().toISOString();
}

/**
 * Report di CADENZA: quanti articoli risultano pubblicati negli ultimi 7 giorni.
 * Target editoriale: almeno 1 notizia a settimana. Se zero, emette un warning
 * esplicito (visibile nei log del cron) senza far fallire la pipeline.
 */
function reportCadenza(articoli: NewsArticle[]): void {
  const soglia = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const recenti = articoli.filter((a) => {
    const t = a.published_at ? new Date(a.published_at).getTime() : Number.NaN;
    return !Number.isNaN(t) && t >= soglia;
  }).length;
  console.log(`📈 Cadenza settimanale: ${recenti} articolo/i negli ultimi 7 giorni (target ≥ 1).`);
  if (recenti === 0) {
    console.warn('⚠ RATE: nessun articolo negli ultimi 7 giorni — verificare fonti/cron di ingestione.');
  }
}

/** Estrae un eventuale link PDF dal sommario HTML della fonte (assolutizzato). */
function cercaPdf(descrizione: string, baseUrl: string): string | null {
  const m = descrizione.match(/href="([^"]+\.pdf[^"]*)"|src="([^"]+\.pdf[^"]*)"/i);
  const rel = m ? (m[1] ?? m[2] ?? null) : null;
  const url =
    rel ??
    descrizione.match(/https?:\/\/[^\s"']+\.pdf[^\s"']*/i)?.[0] ??
    null;
  if (!url) return null;
  try {
    return new URL(url, baseUrl).toString();
  } catch {
    return null;
  }
}

/**
 * Trasforma una voce grezza in un NewsArticle (se supera il filtro editoriale,
 * la validazione STRICT URL INTEGRITY e il controllo HTTP 200/3xx della fonte).
 */
async function costruisciArticolo(v: VoceFonte): Promise<NewsArticle | null> {
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

  // STRICT URL INTEGRITY: niente mockup né root-domain generici.
  const motivoUrl = validaUrlDeepLink(v.link);
  if (motivoUrl) {
    console.log(`  ✗ RIFIUTATA (URL): ${v.title.slice(0, 70)} — ${motivoUrl}`);
    return null;
  }

  // La fonte ufficiale deve essere l'ARTICOLO CANONICO: "Leggi la fonte
  // ufficiale" non deve mai puntare a homepage o liste (es. /web/guest/home).
  if (!èFonteCanonica(v.link)) {
    console.log(
      `  ✗ RIFIUTATA (fonte non canonica): ${v.title.slice(0, 70)} — ${v.link}`,
    );
    return null;
  }

  // Verifica reale del link della fonte: deve rispondere HTTP 200/3xx.
  const linkFonte = await verificaUrlUfficiale(v.link);
  if (!linkFonte.ok) {
    console.log(
      `  ✗ RIFIUTATA (link non risponde 2xx/3xx): ${v.title.slice(0, 70)} — ${v.link}`,
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
    official_pdf_url: cercaPdf(v.description ?? '', v.link),
    relevance_score: punteggioRilevanza(valutazione.categoria, Boolean(valutazione.deadline)),
    // Data della fonte se dichiarata, altrimenti data di rilevazione (fallback).
    published_at: dataPubblicazione(v.pubDate) || dataRilevazione(),
  };
  if (!articoloValido(articolo)) {
    console.log(`  ✗ RIFIUTATA (articolo non valido): ${v.title.slice(0, 70)}`);
    return null;
  }

  // PDF ufficiale allegato: se non è raggiungibile, lo si rimuove dal box PDF
  // (l'articolo resta pubblicabile se la fonte web è valida).
  if (articolo.official_pdf_url) {
    const pdfOk = await verificaUrlUfficiale(articolo.official_pdf_url);
    if (!pdfOk.ok) {
      console.log(
        `  ⚠ PDF ufficiale non raggiungibile (rimosso dal box PDF): ${articolo.official_pdf_url}`,
      );
      articolo.official_pdf_url = null;
    }
  }

  return articolo;
}

/**
 * Scrive l'archivio notizie (accumulo) su `notizieIngestite.ts`.
 * Il file è GENERATO: non modificarlo a mano.
 */
function scriviArchivio(articoli: NewsArticle[]): void {
  const contenuto = `/**
 * ScuoleRadar.it — Notizie ingestite (dati reali).
 *
 * File GENERATO automaticamente dal servizio di ingestione:
 *   npm run scrape:notizie
 * Non modificarlo a mano: il contenuto viene rigenerato ad ogni ingestione
 * (accumulo incrementale con dedupe per id, validazione URL HTTP 200 e tetto
 * di 6 articoli nella finestra di 15 giorni: le notizie già presenti restano,
 * le nuove si aggiungono; le voci non più valide vengono rimosse).
 */
import type { NewsArticle } from '../types';

/** Notizie reali ingressate dalle fonti ufficiali (MIM, Gazzetta Ufficiale). */
export const notizieIngestite: NewsArticle[] = ${JSON.stringify(articoli, null, 2)};
`;

  mkdirSync(dirname(FILE_USCITA), { recursive: true });
  writeFileSync(FILE_USCITA, contenuto, 'utf8');
}

async function main(): Promise<void> {
  const isDryRun = process.argv.includes('--dry-run');
  console.log('=== Ingestione Notizie ScuoleRadar ===');

  const { voci, fontiRaggiunte } = await raccogliNotizieRaw();
  console.log(`• Voci raccolte: ${voci.length} | fonti raggiunte: ${fontiRaggiunte}`);

  // Nessuna fonte ufficiale raggiunta (HTTP 2xx/3xx): niente silent-fail.
  // Il workflow GitHub trasforma l'exit code in warning visibile nei log.
  if (fontiRaggiunte === 0) {
    console.error(
      '✗ HTTP FAIL - fonti ufficiali non raggiungibili (MIM / Gazzetta Ufficiale). Nessuna ingestione eseguita.',
    );
    process.exitCode = 1;
    return;
  }

  // De-duplica per link.
  const unici = [...new Map(voci.map((v) => [v.link, v])).values()];
  console.log(`• Voci uniche: ${unici.length}`);

  // LOOKBACK 15 giorni (avvio anno scolastico): si considerano solo le notizie
  // pubblicate nella finestra; una data assente non è dimostrabile come
  // "vecchia" → la voce resta (il gate operativo la filtra comunque).
  const sogliaLookback = Date.now() - FINESTRA_LOOKBACK_GIORNI * 24 * 60 * 60 * 1000;
  const inFinestra = unici.filter((v) => {
    if (!v.pubDate) return true;
    const t = new Date(v.pubDate).getTime();
    return Number.isNaN(t) || t >= sogliaLookback;
  });
  console.log(
    `• Voci nella finestra di ${FINESTRA_LOOKBACK_GIORNI} giorni: ${inFinestra.length}/${unici.length}`,
  );

  // Filtro editoriale + STRICT URL INTEGRITY (validazione locale e HTTP 200/3xx).
  const articoli = (
    await Promise.all(inFinestra.map(costruisciArticolo))
  ).filter((a): a is NewsArticle => a !== null);
  console.log(`• Articoli che soddisfano i criteri editoriali: ${articoli.length}`);

  // Archiviazione ACCUMULATIVA + IGIENE: le nuove notizie si aggiungono a
  // quelle già presenti (dedupe per id), ma i record preesistenti che non
  // superano più le regole STRICT (URL canonico, niente login/area riservata)
  // o che non passano più il gate di rilevanza (avvisi tecnici generali)
  // vengono rimossi, così l'archivio resta sempre pertinente e valido.
  // NOTA: gli articoli preesistenti SENZA data di fonte (pagine operative USR
  // "evergreen") NON vengono datati: restano nella loro sottocartella storica e
  // NON consumano il tetto settimanale (vedi `limitaArticoliSettimanali`),
  // altrimenti occuperebbero tutti gli slot e bloccherebbero ogni nuovo articolo.
  const esistentiValidi = notizieIngestite.filter(
    (a) => articoloValido(a) && valutaRilevanza({ title: a.title }).rilevante,
  );
  const purgate = notizieIngestite.length - esistentiValidi.length;
  if (purgate > 0) {
    console.log(`⚠ Igiene archivio: ${purgate} notizia/e preesistente/i non più valida/e rimossa/e.`);
  }
  const esistenti = esistentiValidi;
  const nuovi = articoli.filter((a) => !esistenti.some((e) => e.id === a.id));

  if (nuovi.length === 0) {
    console.log('✓ HTTP 200 - 0 new posts criteria matched');
    if (!isDryRun && purgate > 0) {
      // Persistisci la sola pulizia dell'archivio (nessuna nuova notizia).
      scriviArchivio(esistenti);
      console.log(`✓ Scritti ${esistenti.length} articoli in ${FILE_USCITA} (igiene archivio)`);
    } else if (esistenti.length === 0) {
      console.log('L\u2019archivio notizie è vuoto: resta attivo il fallback editoriale.');
    } else {
      console.log('L\u2019archivio notizie resta invariato (nessun commit necessario).');
    }
    reportCadenza(esistenti);
    if (isDryRun) console.log('=== DRY-RUN (nessuna scrittura) ===');
    return;
  }

  const combinati = [...esistenti, ...nuovi].sort((a, b) =>
    (b.published_at || '').localeCompare(a.published_at || ''),
  );

  // Tetto articoli: massimo MAX_ARTICOLI_FINESTRA ad alto valore nella finestra
  // di lookback (15 giorni ≈ 3/settimana); gli esuberi recenti decadono.
  const { mantenuti, rimossi } = limitaArticoliSettimanali(combinati);
  if (rimossi.length > 0) {
    console.log(
      `⚠ Tetto attivo (max ${MAX_ARTICOLI_FINESTRA} articoli per ${FINESTRA_LOOKBACK_GIORNI} giorni): ${rimossi.length} articolo/i in esubero scartato/i.`,
    );
    rimossi.forEach((r) => console.log(`  ✗ RIMOSSO (cap finestra): ${r.title.slice(0, 70)}`));
  }
  const aggiunti = nuovi.filter((n) => mantenuti.some((m) => m.id === n.id));

  if (aggiunti.length === 0) {
    console.log('✓ HTTP 200 - 0 new posts criteria matched (esuberi scartati dal tetto settimanale)');
    reportCadenza(mantenuti);
    if (isDryRun) console.log('=== DRY-RUN (nessuna scrittura) ===');
    return;
  }

  if (isDryRun) {
    console.log('=== DRY-RUN (nessuna scrittura) ===');
    mantenuti.forEach((a) => {
      console.log(
        `  ✓ [${a.category}] ${a.title.slice(0, 70)} | scad: ${a.deadline_date ?? 'n/d'}`,
      );
    });
    console.log(`✓ HTTP 200 - ${aggiunti.length} new posts criteria matched`);
    reportCadenza(mantenuti);
    return;
  }

  scriviArchivio(mantenuti);
  console.log(`✓ HTTP 200 - ${aggiunti.length} new posts criteria matched`);
  console.log(`✓ Scritti ${mantenuti.length} articoli in ${FILE_USCITA}`);
  reportCadenza(mantenuti);
}

main().catch((err) => {
  console.error('✗ Errore imprevisto nell\'ingestione Notizie:', err);
  process.exitCode = 1;
});

