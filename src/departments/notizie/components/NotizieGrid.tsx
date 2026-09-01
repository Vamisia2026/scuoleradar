import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  CalendarDays,
  ChevronRight,
  FileText,
  Radar,
  SlidersHorizontal,
  Sparkles,
  UserPlus,
} from 'lucide-react';
import { useApp } from '@/contexts/AppContext';
import { newsArticles, categorieNotizie, formatDataNotizia } from '../services/newsService';
import { èLinkPdf } from '../services/relevanceEngine';
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

  // PDF ufficiale (allegato o fonte .pdf): badge con apertura in nuova scheda.
  const pdfUrl =
    articolo.official_pdf_url ??
    (èLinkPdf(articolo.official_source_url) ? articolo.official_source_url : null);

  return (
    <article className="flex flex-col rounded-2xl border border-primary-100 bg-white p-5 shadow-card transition hover:border-primary-300 hover:shadow-soft">
      <div className="flex items-center gap-2">
        <span className="rounded-md bg-primary-100 px-2 py-0.5 text-xs font-bold text-primary-700">
          {articolo.category}
        </span>
        <time
          dateTime={articolo.published_at || undefined}
          className="inline-flex items-center gap-1 text-xs text-primary-400"
        >
          <CalendarDays className="h-3.5 w-3.5" />
          {formatDataNotizia(articolo.published_at)}
        </time>
      </div>

      <h3 className="mt-3 text-base font-bold leading-snug text-primary-900">
        <Link
          to={`/notizie/${articolo.id}`}
          target="_blank"
          rel="noopener noreferrer"
          className="transition hover:text-primary-600"
        >
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
        <div className="flex shrink-0 items-center gap-2">
          {pdfUrl && (
            <a
              href={pdfUrl}
              target="_blank"
              rel="noopener noreferrer"
              title="Visualizza il PDF ufficiale"
              className="inline-flex items-center gap-1 rounded-lg border border-primary-200 bg-white px-3 py-1.5 text-xs font-semibold text-primary-600 transition hover:border-primary-300 hover:bg-primary-50"
            >
              <FileText className="h-3.5 w-3.5" />
              PDF
            </a>
          )}
          <Link
            to={`/notizie/${articolo.id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 rounded-lg bg-primary-500 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-primary-600"
          >
            Leggi
            <ChevronRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>
    </article>
  );
}

/**
 * CTA dinamica a fondo griglia (stile della card di chiusura del dettaglio):
 *  - Ospite      → invito alla registrazione gratuita
 *  - Piano Base  → invito all'upgrade PRO
 *  - Piano PRO   → invito alla configurazione del Radar
 */
function NotizieCtaChiusura() {
  const { user, abbonato, openAuthModal } = useApp();
  const navigate = useNavigate();

  const config = !user
    ? {
        etichetta: 'ScuoleRadar',
        titolo: 'La scuola senza perdere tempo.',
        testoBottone: 'Registrati gratis',
        iconaTestata: <Sparkles className="h-5 w-5 text-secondary-300" />,
        iconaBottone: <UserPlus className="h-4 w-4" />,
        onClick: () => openAuthModal('registrazione'),
      }
    : abbonato
      ? {
          etichetta: 'Radar ScuoleRadar',
          titolo:
            'Fai lavorare il Radar per te. Configura i filtri e ricevi in tempo reale le migliori opportunità retribuite della tua zona.',
          testoBottone: 'Configura il Radar',
          iconaTestata: <Radar className="h-5 w-5 text-secondary-300" />,
          iconaBottone: <SlidersHorizontal className="h-4 w-4" />,
          onClick: () => navigate('/dashboard/radar'),
        }
      : {
          etichetta: 'ScuoleRadar PRO',
          titolo:
            'Non perderti i soldi extra. Attiva il tuo Radar per intercettare al volo interpelli, progetti PNRR e bandi retribuiti.',
          testoBottone: 'Passa a PRO',
          iconaTestata: <Sparkles className="h-5 w-5 text-secondary-300" />,
          iconaBottone: <Sparkles className="h-4 w-4" />,
          onClick: () => navigate('/prezzi'),
        };

  return (
    <div className="mt-10 overflow-hidden rounded-2xl bg-gradient-to-br from-primary-900 via-primary-800 to-primary-600 p-6 text-white shadow-card sm:p-8">
      <div className="flex items-center gap-2">
        {config.iconaTestata}
        <h2 className="text-sm font-bold tracking-wide text-primary-200">{config.etichetta}</h2>
      </div>
      <p className="mt-2 text-2xl font-extrabold leading-snug">{config.titolo}</p>
      <button
        type="button"
        onClick={config.onClick}
        className="mt-5 inline-flex items-center gap-2 rounded-xl bg-secondary-500 px-6 py-3 text-sm font-bold text-white shadow-soft transition hover:bg-secondary-600"
      >
        {config.iconaBottone}
        {config.testoBottone}
      </button>
    </div>
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
  const conteggi = useMemo(() => {
    const mappa = new Map<string, number>();
    for (const a of articoli) mappa.set(a.category, (mappa.get(a.category) ?? 0) + 1);
    return mappa;
  }, [articoli]);

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
      {/* Toolbar editoriale per categoria ("Sezioni") */}
      <div
        role="toolbar"
        aria-label="Filtra le notizie per sezione"
        className="mt-5 flex flex-wrap items-center gap-1 overflow-x-auto rounded-xl border border-primary-100 bg-white px-2 py-2 shadow-card"
      >
        <span className="mr-1 px-2 text-[11px] font-bold uppercase tracking-[0.18em] text-primary-400">
          Sezioni
        </span>
        {categorie.map((c) => {
          const attiva = categoria === c;
          const conteggio = c === 'Tutte' ? articoli.length : (conteggi.get(c) ?? 0);
          return (
            <button
              key={c}
              type="button"
              onClick={() => setCategoria(c)}
              aria-pressed={attiva}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold uppercase tracking-wide transition ${
                attiva
                  ? 'bg-primary-800 text-white shadow-soft'
                  : 'text-primary-600 hover:bg-primary-50'
              }`}
            >
              {c}
              <span
                className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold tabular-nums ${
                  attiva ? 'bg-white/20 text-white' : 'bg-primary-50 text-primary-500'
                }`}
              >
                {conteggio}
              </span>
            </button>
          );
        })}
      </div>

      {/* Griglia delle notizie */}
      {filtrate.length === 0 ? (
        <p className="mt-8 rounded-2xl border border-dashed border-primary-100 p-10 text-left text-sm text-primary-400">
          Nessuna notizia in questa categoria per il momento.
        </p>
      ) : (
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtrate.map((n) => (
            <NotizieCard key={n.id} articolo={n} />
          ))}
        </div>
      )}

      {/* CTA dinamica di chiusura (ospite / Base / PRO) */}
      <NotizieCtaChiusura />
    </div>
  );
}
