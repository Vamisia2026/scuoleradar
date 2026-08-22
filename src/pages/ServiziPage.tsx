import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { Header } from '@/components/Header';
import { Footer } from './LandingPage';
import { servizi } from '@/data/servizi';

export function ServiziPage() {
  return (
    <div className="min-h-screen">
      <Header />

      <section className="bg-gradient-to-b from-primary-50 to-white">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
          <h1 className="text-3xl font-bold text-primary-900 sm:text-4xl">I nostri strumenti</h1>
          <p className="mt-3 max-w-2xl text-lg text-primary-600">
            Tutto ciò che serve a un docente per non perdere tempo: dal monitoraggio delle
            opportunità agli strumenti per la carriera.
          </p>

          <div className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {servizi.map((s) => (
              <Link
                key={s.slug}
                to={`/servizi/${s.slug}`}
                className="group flex flex-col rounded-2xl border border-primary-100 bg-white p-6 shadow-card transition hover:-translate-y-0.5 hover:shadow-soft"
              >
                <div className="flex items-start justify-between">
                  <span className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-primary-50 text-2xl">
                    {s.emoji}
                  </span>
                  {s.sperimentazione && (
                    <span className="rounded-full bg-secondary-50 px-2.5 py-1 text-xs font-medium text-secondary-700">
                      🧪 Sperimentazione
                    </span>
                  )}
                </div>
                <h2 className="mt-4 text-lg font-bold text-primary-800">{s.titolo}</h2>
                <p className="mt-1 text-sm text-primary-600">{s.sottotitolo}</p>
                <p className="mt-3 line-clamp-3 flex-1 text-sm leading-relaxed text-primary-500">
                  {s.descrizione}
                </p>
                <span className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-primary-700 transition group-hover:gap-2.5 group-hover:text-primary-800">
                  Scopri di più
                  <ArrowRight className="h-4 w-4" />
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
