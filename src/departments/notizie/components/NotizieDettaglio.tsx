import { useMemo } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  CalendarDays,
  ExternalLink,
  FileText,
  FileText as FilePdf,
  Info,
  Sparkles,
  UserPlus,
} from 'lucide-react';
import { useApp } from '@/contexts/AppContext';
import { getNotiziaById, formatDataNotizia } from '../services/newsService';

/** Icona WhatsApp (i brand non sono più inclusi in lucide-react). */
function IconaWhatsApp({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  );
}

/**
 * Detail View del dipartimento Notizie.
 * Il blog NON vende moduli o template: è un filtro sulle fonti ufficiali.
 * Layout: header e badge, box "In Sintesi", corpo dell'articolo con link
 * contestuali ai portali, Fonti Ufficiali, condivisione WhatsApp e un unico
 * CTA di registrazione ScuoleRadar in fondo.
 */
export function NotizieDettaglio() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, openAuthModal } = useApp();

  const notizia = useMemo(() => (id ? getNotiziaById(id) : null), [id]);

  if (!notizia) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center sm:px-6">
        <FileText className="mx-auto h-10 w-10 text-primary-300" />
        <h1 className="mt-4 text-2xl font-bold text-primary-900">Notizia non trovata</h1>
        <p className="mt-2 text-sm text-primary-500">
          L&apos;articolo che stai cercando non esiste oppure è stato rimosso.
        </p>
        <Link
          to="/notizie"
          className="mt-6 inline-flex items-center gap-1.5 rounded-xl bg-primary-500 px-5 py-2.5 text-sm font-semibold text-white shadow-soft transition hover:bg-primary-600"
        >
          <ArrowLeft className="h-4 w-4" />
          Torna alle notizie
        </Link>
      </div>
    );
  }

  const condividiWhatsApp = () => {
    const testo = encodeURIComponent(
      `${notizia.title} — ScuoleRadar: ${window.location.href}`,
    );
    window.open(
      `https://api.whatsapp.com/send?text=${testo}`,
      '_blank',
      'noopener,noreferrer',
    );
  };

  const apriRegistrazione = () => {
    if (user) {
      navigate('/dashboard/radar');
      return;
    }
    openAuthModal('registrazione');
  };

  return (
    <article className="mx-auto max-w-3xl">
      {/* Torna alla lista */}
      <Link
        to="/notizie"
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary-600 transition hover:text-primary-800"
      >
        <ArrowLeft className="h-4 w-4" />
        Tutte le notizie
      </Link>

      {/* Meta articolo */}
      <div className="mt-5 flex flex-wrap items-center gap-2">
        <span className="rounded-md bg-primary-100 px-2 py-0.5 text-xs font-bold text-primary-700">
          {notizia.category}
        </span>
        <span className="inline-flex items-center gap-1 text-xs text-primary-400">
          <CalendarDays className="h-3.5 w-3.5" />
          Pubblicato il {formatDataNotizia(notizia.published_at)}
        </span>
        {notizia.deadline_date && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-warning-50 px-3 py-1 text-xs font-semibold text-warning-700 ring-1 ring-warning-500/30">
            <FileText className="h-3.5 w-3.5" />
            Scadenza {formatDataNotizia(notizia.deadline_date)}
          </span>
        )}
      </div>

      <h1 className="mt-3 text-3xl font-extrabold leading-tight text-primary-900 sm:text-4xl">
        {notizia.title}
      </h1>

      {/* In Sintesi */}
      <div className="mt-6 rounded-2xl border border-primary-100 bg-primary-50/60 p-5">
        <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-primary-700">
          <Info className="h-4 w-4" />
          In Sintesi
        </h2>
        <ul className="mt-3 space-y-2">
          {notizia.summary_points.map((punto) => (
            <li key={punto} className="flex items-start gap-2 text-sm leading-relaxed text-primary-800">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary-500" />
              {punto}
            </li>
          ))}
        </ul>
      </div>

      {/* Corpo dell'articolo */}
      <div
        className="mt-8 max-w-none text-base leading-relaxed text-primary-800 [&_h2]:mt-6 [&_h2]:mb-2 [&_h2]:text-xl [&_h2]:font-bold [&_h2]:text-primary-900 [&_p]:mb-3 [&_ul]:mb-3 [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:mb-3 [&_ol]:list-decimal [&_ol]:pl-6 [&_li]:mb-1 [&_a]:font-medium [&_a]:text-blue-600 [&_a]:underline [&_a]:underline-offset-2 [&_a]:transition-colors [&_a:hover]:text-blue-700"
        dangerouslySetInnerHTML={{ __html: notizia.content_html }}
      />

      {/* Fonti Ufficiali — subito dopo il corpo dell'articolo */}
      <section className="mt-10 rounded-2xl border border-primary-100 bg-slate-50 p-5">
        <h2 className="text-sm font-bold uppercase tracking-wide text-primary-700">
          Fonti Ufficiali
        </h2>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            <a
              href={notizia.official_source_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-xl border border-primary-200 bg-white px-4 py-2.5 text-sm font-semibold text-primary-700 transition hover:bg-primary-50"
            >
              <ExternalLink className="h-4 w-4" />
              Leggi la fonte ufficiale
            </a>
            {notizia.official_pdf_url && (
              <a
                href={notizia.official_pdf_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-xl border border-primary-200 bg-white px-4 py-2.5 text-sm font-semibold text-primary-700 transition hover:bg-primary-50"
              >
                <FilePdf className="h-4 w-4" />
                Scarica il PDF ufficiale
              </a>
            )}
          </div>
          <button
            type="button"
            onClick={condividiWhatsApp}
            className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-[#25D366]/40 bg-white px-4 py-2.5 text-sm font-semibold text-[#128C7E] transition hover:border-[#25D366]/70 hover:bg-[#25D366]/10"
          >
            <IconaWhatsApp className="h-4 w-4" />
            Condividi su WhatsApp
          </button>
        </div>
        <p className="mt-3 text-xs leading-relaxed text-primary-400">
          I riferimenti rinviano ai siti istituzionali (MIM, Gazzetta Ufficiale): i contenuti
          originali restano di proprietà dei rispettivi enti.
        </p>
      </section>

      {/* CTA finale ScuoleRadar — il blog è un filtro, non una vetrina moduli */}
      <div className="mt-10 overflow-hidden rounded-2xl bg-gradient-to-br from-primary-900 via-primary-800 to-primary-600 p-6 text-white shadow-card sm:p-8">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-secondary-300" />
          <h2 className="text-sm font-bold tracking-wide text-primary-200">
            ScuoleRadar
          </h2>
        </div>
        <p className="mt-2 text-2xl font-extrabold leading-snug">La scuola senza perdere tempo.</p>
        <button
          onClick={apriRegistrazione}
          className="mt-5 inline-flex items-center gap-2 rounded-xl bg-secondary-500 px-6 py-3 text-sm font-bold text-white shadow-soft transition hover:bg-secondary-600"
        >
          <UserPlus className="h-4 w-4" />
          Registrati qui
        </button>
      </div>
    </article>
  );
}

