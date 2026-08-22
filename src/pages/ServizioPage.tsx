import { Link, Navigate, useParams } from 'react-router-dom';
import { ArrowRight, CheckCircle2 } from 'lucide-react';
import { useApp } from '@/contexts/AppContext';
import { Header } from '@/components/Header';
import { Footer } from './LandingPage';
import { ExperimentalBanner } from '@/components/ExperimentalBanner';
import { servizioDaSlug } from '@/data/servizi';

export function ServizioPage() {
  const { slug } = useParams<{ slug: string }>();
  const servizio = servizioDaSlug(slug);
  const { user, openAuthModal } = useApp();

  if (!servizio) return <Navigate to="/servizi" replace />;

  const cta = user ? (
    <Link
      to={servizio.dashboard}
      className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary-500 px-7 py-3.5 text-base font-semibold text-white shadow-soft transition hover:bg-primary-600"
    >
      Vai alla dashboard
      <ArrowRight className="h-4 w-4" />
    </Link>
  ) : (
    <button
      onClick={() => openAuthModal('registrazione')}
      className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary-500 px-7 py-3.5 text-base font-semibold text-white shadow-soft transition hover:bg-primary-600"
    >
      Prova il servizio
      <ArrowRight className="h-4 w-4" />
    </button>
  );

  return (
    <div className="min-h-screen">
      <Header />

      <section className="bg-gradient-to-b from-primary-50 to-white">
        <div className="mx-auto max-w-4xl px-4 py-14 sm:px-6">
          <Link to="/servizi" className="text-sm font-medium text-primary-600 transition hover:text-primary-800">
            ← Tutti i servizi
          </Link>

          <div className="mt-4 flex items-center gap-3">
            <span className="text-4xl">{servizio.emoji}</span>
            <h1 className="text-3xl font-bold text-primary-900 sm:text-4xl">{servizio.titolo}</h1>
          </div>
          <p className="mt-3 text-lg text-primary-600">{servizio.sottotitolo}</p>

          {servizio.sperimentazione && (
            <div className="mt-6">
              <ExperimentalBanner />
            </div>
          )}

          <p className="mt-6 leading-relaxed text-primary-700">{servizio.descrizione}</p>

          <ul className="mt-6 space-y-2.5">
            {servizio.caratteristiche.map((c) => (
              <li key={c} className="flex items-start gap-2 text-primary-700">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-accent-500" />
                {c}
              </li>
            ))}
          </ul>

          <div className="mt-6 rounded-xl bg-primary-50 px-4 py-3 text-sm text-primary-700">
            <strong>A chi è utile:</strong> {servizio.destinatari}
          </div>

          <div className="mt-8">{cta}</div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
