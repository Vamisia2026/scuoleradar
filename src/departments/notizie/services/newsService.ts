/**
 * ScuoleRadar.it — Servizio Notizie.
 *
 * Livello dati del dipartimento Notizie: legge le notizie REALI già
 * ingestite dal servizio `newsFetcher` + `ingestNotizie` (cron/scraper) e
 * esposte dal file `data/notizieIngestite.ts`.
 *
 * Quando l'ingestione non ha ancora prodotto dati viene mostrato UN SOLO
 * articolo di fallback realistico (senza date o link inventati).
 */
import { notizieIngestite } from '../data/notizieIngestite';
import { notizieSeed } from '../data/notizieSeed';
import type { NewsArticle } from '../types';

/**
 * Fallback realistico singolo (usato solo se l'archivio ingestito è vuoto).
 * Nessuna data o link inventati: rinvia alla pagina notizie ufficiale del MIM.
 */
export const newsFallback: NewsArticle = {
  id: 'notizie-mim-ufficiali',
  title: 'Notizie ufficiali MIM: il prossimo aggiornamento è in arrivo',
  category: 'Scuole',
  deadline_date: null,
  summary_points: [
    'Qui troverai i provvedimenti ufficiali del Ministero dell’Istruzione e del Merito.',
    'Decreti, note normative e scadenze operative per docenti e personale scolastico.',
    'La sezione si aggiorna automaticamente tramite il servizio di ingestione.',
  ],
  content_html: `
    <h2>Aggiornamenti in arrivo</h2>
    <p>Questa sezione raccoglie le notizie ufficiali pubblicate dal Ministero dell’Istruzione
    e del Merito e dalla Gazzetta Ufficiale.</p>
    <p>Quando il servizio di ingestione sarà attivo, qui compariranno automaticamente decreti,
    note e scadenze operative per GPS, mobilità, concorsi, pensioni e sostegno.</p>
  `,
  official_source_url: 'https://www.mim.gov.it/web/guest/notizie',
  official_pdf_url: null,
  relevance_score: 0,
  published_at: '',
};

/** Notizie pubblicate: seed editoriali + dati reali ingestiti (dedup per id);
 *  se entrambi vuoti resta il fallback singolo realistico. */
function unisciNotizie(): NewsArticle[] {
  const tutte = [...notizieSeed, ...notizieIngestite];
  const uniche = [...new Map(tutte.map((n) => [n.id, n])).values()];
  return uniche.length > 0 ? uniche : [newsFallback];
}

/**
 * ORDINAMENTO STRETTO del feed: **PUBBLICAZIONE DECRESCENTE** (la più recente
 * prima). Il punteggio di rilevanza NON decide la posizione: è solo il
 * tie-break a parità di data (poi l'id, per stabilità). Un articolo senza data
 * scivola in fondo: non deve mai stare in cima al feed.
 *
 * Nota di regressione: ordinando prima per `relevance_score` un articolo seed
 * datato 26 agosto (score 95) scavalcava gli aggiornamenti nazionali freschi
 * (score 70): la prima card restava ancorata ad agosto. La data vince sempre.
 */
export function ordinaNotizie(articoli: NewsArticle[]): NewsArticle[] {
  const tempo = (iso: string | null | undefined): number => {
    if (!iso) return Number.NEGATIVE_INFINITY;
    const t = new Date(iso).getTime();
    return Number.isNaN(t) ? Number.NEGATIVE_INFINITY : t;
  };
  return [...articoli].sort((a, b) => {
    const ta = tempo(a.published_at);
    const tb = tempo(b.published_at);
    if (tb !== ta) return tb - ta; // 1) data di pubblicazione DESC (newest first)
    if (b.relevance_score !== a.relevance_score) {
      return b.relevance_score - a.relevance_score; // 2) punteggio (tie-break)
    }
    return a.id.localeCompare(b.id); // 3) id, per ordine deterministico
  });
}

/** Elenco dei feed GIÀ ordinato (data di pubblicazione decrescente). */
export const newsArticles: NewsArticle[] = ordinaNotizie(unisciNotizie());

/** Elenco delle categorie presenti, ordinate per frequenza. */
export function categorieNotizie(): string[] {
  const conteggi = new Map<string, number>();
  for (const n of newsArticles) {
    conteggi.set(n.category, (conteggi.get(n.category) ?? 0) + 1);
  }
  return [...conteggi.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([c]) => c);
}

/** Recupera un articolo per id. */
export function getNotiziaById(id: string): NewsArticle | null {
  return newsArticles.find((n) => n.id === id) ?? null;
}

/** Formatta una data ISO in formato italiano breve (es. "28 ago 2026"). */
export function formatDataNotizia(iso: string | null): string {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleDateString('it-IT', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return '';
  }
}
