import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarDays, ChevronRight, FileText } from 'lucide-react';
import { newsArticles, categorieNotizie, formatDataNotizia } from '../services/newsService';
import type { NewsArticle } from '../types';

interface NotizieGridProps {
  /** Articoli da mostrare (di default tutti quelli del servizio). */
  articoli?: NewsArticle[];
}

/** Card singola della griglia: niente immagini, solo contenuto essenziale. */
function NotizieCard({ articolo }: { articolo: NewsArticle }) {
  const riepilogo =
    articolo.summary_points[0] ??
    articolo.content_html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

  return (
    <article className="flex flex-col rounded-2xl border border-primary-100 bg-white p-5 shadow-card transition hover:border-primary-300 hover:shadow-soft">
      <div className="flex items-center gap-2">
        <span className="rounded-md bg-primary-100 px-2 py-0.5 text-xs font-bold text-primary-700">
          {articolo.category}
        </span>
        <span className="inline-flex items-center gap-1 text-xs text-primary-400">
          <CalendarDays className="h-3.5 w-3.5" />
          {formatDataNotizia(articolo.published_at)}
        </span>
      </div>

      <h3 className="mt-3 text-base font-bold leading-snug text-primary-900">
        <Link to={`/notizie/${articolo.id}`} className="transition hover:text-primary-600">
          {articolo.title}
        </Link>
      </h3>

      <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-primary-600">{riepilogo}</p>

      <div className="mt-auto flex items-center justify-between gap-2 pt-4">
        {articolo.deadline_date ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-warning-50 px-3 py-1 text-xs font-semibold text-warning-700 ring-1 ring-warning-500/30">
            <FileText className="h-3.5 w-3.5" />
            Scadenza {formatDataNotizia(articolo.deadline_date)}
          </span>
        ) : (
          <span className="text-xs text-primary-300">Fonte ufficiale MIM / G.U.</span>
        )}
        <Link
          to={`/notizie/${articolo.id}`}
          className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-primary-500 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-primary-600"
        >
          Leggi
          <ChevronRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </article>
  );
}

/**
 * Grid View del dipartimento Notizie.
 * Layout pulito a schede (senza immagini), filtro per categoria e
 * badge di scadenza quando presente. Accessibile pubblicamente, senza login.
 */
export function NotizieGrid({ articoli = newsArticles }: NotizieGridProps) {
  const [categoria, setCategoria] = useState('Tutte');
  const categorie = useMemo(() => ['Tutte', ...categorieNotizie()], []);

  const filtrate = useMemo(() => {
    const ordinate = [...articoli].sort(
      (a, b) =>
        b.relevance_score - a.relevance_score ||
        (b.published_at || '').localeCompare(a.published_at || ''),
    );
    return categoria === 'Tutte'
      ? ordinate
      : ordinate.filter((n) => n.category === categoria);
  }, [articoli, categoria]);

  return (
    <div>
      {/* Filtro per categoria */}
      <div className="flex flex-wrap gap-2">
        {categorie.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setCategoria(c)}
            className={`rounded-full px-4 py-1.5 text-sm font-semibold transition ${
              categoria === c
                ? 'bg-primary-500 text-white shadow-soft'
                : 'border border-primary-200 bg-white text-primary-600 hover:bg-primary-50'
            }`}
          >
            {c}
          </button>
        ))}
      </div>

      {/* Griglia delle notizie */}
      {filtrate.length === 0 ? (
        <p className="mt-8 rounded-2xl border border-dashed border-primary-100 p-10 text-center text-sm text-primary-400">
          Nessuna notizia in questa categoria per il momento.
        </p>
      ) : (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtrate.map((n) => (
            <NotizieCard key={n.id} articolo={n} />
          ))}
        </div>
      )}
    </div>
  );
}
