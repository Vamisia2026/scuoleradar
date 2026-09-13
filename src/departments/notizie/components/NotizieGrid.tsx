import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  FileText,
  Radar,
  SlidersHorizontal,
  Sparkles,
  UserPlus,
} from 'lucide-react';
import { useApp } from '@/contexts/AppContext';
import { newsArticles, formatDataNotizia, ordinaNotizie } from '../services/newsService';
import { èLinkPdf } from '../services/relevanceEngine';
import type { NewsArticle } from '../types';

interface NotizieGridProps {
  /** Articoli da mostrare (di default tutti quelli del servizio). */
  articoli?: NewsArticle[];
  /** Categoria selezionata nel menu Categorie dell'Hero (default 'Tutte'). */
  categoria?: string;
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
    <article className="flex min-w-0 flex-col rounded-2xl border border-primary-100 bg-white p-4 shadow-card transition hover:border-primary-300 hover:shadow-soft sm:p-5">
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

      <h3 className="mt-3 min-w-0 text-base font-bold leading-snug text-primary-900">
        <Link
          to={`/notizie/${articolo.id}`}
          className="break-words transition hover:text-primary-600"
        >
          {articolo.title}
        </Link>
      </h3>

      <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-primary-600">{riepilogo}</p>

      <div className="mt-auto flex w-full min-w-0 flex-wrap items-center justify-between gap-x-2 gap-y-2 pt-4">
        {articolo.deadline_date ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-warning-50 px-3 py-1 text-xs font-semibold text-warning-700 ring-1 ring-warning-500/30">
            <FileText className="h-3.5 w-3.5" />
            Scadenza {formatDataNotizia(articolo.deadline_date)}
          </span>
        ) : (
          <span className="text-xs text-primary-300">Fonte ufficiale MIM / G.U.</span>
        )}
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
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
            'Fai lavorare il nostro Radar per te. Configura i filtri e ricevi in tempo reale le migliori opportunità lavorative a Scuola nella tua zona.',
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
/** Numero massimo di articoli visualizzati per pagina nella griglia. */
const PER_PAGINA_NOTIZIE = 9;

export function NotizieGrid({ articoli = newsArticles, categoria = 'Tutte' }: NotizieGridProps) {
  const [pagina, setPagina] = useState(1);
  const inizioGrigliaRef = useRef<HTMLDivElement | null>(null);

  const filtrate = useMemo(() => {
    // ORDINE STRETTO: data di pubblicazione DECRESCENTE (la più recente nella
    // prima card in alto a sinistra). Vedi `ordinaNotizie` per il perché il
    // punteggio di rilevanza NON deve decidere la posizione.
    const ordinate = ordinaNotizie(articoli);
    return categoria === 'Tutte'
      ? ordinate
      : ordinate.filter((n) => n.category === categoria);
  }, [articoli, categoria]);

  // Cambio categoria → si riparte sempre dalla prima pagina.
  useEffect(() => {
    setPagina(1);
  }, [categoria]);

  const totalePagine = Math.max(1, Math.ceil(filtrate.length / PER_PAGINA_NOTIZIE));
  // Clamp difensivo: se la lista si riduce, la pagina corrente resta sempre valida.
  const paginaCorrente = Math.min(pagina, totalePagine);
  const inizio = (paginaCorrente - 1) * PER_PAGINA_NOTIZIE;
  const visibili = filtrate.slice(inizio, inizio + PER_PAGINA_NOTIZIE);

  const vaiAPagina = (p: number): void => {
    setPagina(Math.min(Math.max(1, p), totalePagine));
    inizioGrigliaRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div ref={inizioGrigliaRef}>
      {/* Griglia delle notizie: parte subito sotto la linea di allineamento
          creata dal menu Categorie (Hero) e dal fondo del box Scadenze. */}
      {filtrate.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-primary-100 p-10 text-left text-sm text-primary-400">
          Nessuna notizia in questa categoria per il momento.
        </p>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {visibili.map((n) => (
              <NotizieCard key={n.id} articolo={n} />
            ))}
          </div>

          {/* Paginazione (max 9 articoli per pagina) */}
          {totalePagine > 1 && (
            <nav
              aria-label="Paginazione notizie"
              className="mt-8 flex flex-col items-center gap-3"
            >
              <div className="flex flex-wrap items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={() => vaiAPagina(paginaCorrente - 1)}
                  disabled={paginaCorrente === 1}
                  className="inline-flex items-center gap-1 rounded-lg border border-primary-200 bg-white px-3 py-2 text-sm font-semibold text-primary-700 transition hover:bg-primary-50 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                  Precedente
                </button>

                {Array.from({ length: totalePagine }, (_, i) => i + 1).map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => vaiAPagina(p)}
                    aria-label={`Vai alla pagina ${p}`}
                    aria-current={p === paginaCorrente ? 'page' : undefined}
                    className={`inline-flex h-9 min-w-[2.25rem] items-center justify-center rounded-lg px-3 text-sm font-bold tabular-nums transition ${
                      p === paginaCorrente
                        ? 'bg-primary-500 text-white shadow-soft'
                        : 'border border-primary-200 bg-white text-primary-700 hover:bg-primary-50'
                    }`}
                  >
                    {p}
                  </button>
                ))}

                <button
                  type="button"
                  onClick={() => vaiAPagina(paginaCorrente + 1)}
                  disabled={paginaCorrente === totalePagine}
                  className="inline-flex items-center gap-1 rounded-lg border border-primary-200 bg-white px-3 py-2 text-sm font-semibold text-primary-700 transition hover:bg-primary-50 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Successiva
                  <ChevronRight className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
              <p className="text-xs text-primary-400" aria-live="polite">
                Pagina {paginaCorrente} di {totalePagine} · {filtrate.length} notizie
              </p>
            </nav>
          )}
        </>
      )}

      {/* CTA dinamica di chiusura (ospite / Base / PRO) */}
      <NotizieCtaChiusura />
    </div>
  );
}
