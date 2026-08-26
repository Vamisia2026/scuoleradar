import { Newspaper } from 'lucide-react';
import { Header } from '@/components/Header';
import { Footer } from './LandingPage';

/** Pagina Notizie: novità per i docenti (placeholder, contenuti in arrivo). */
export function NotiziePage() {
  return (
    <div className="min-h-screen bg-slate-50">
      <Header />
      <section className="bg-gradient-to-b from-primary-50 to-white">
        <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 sm:py-14">
          <div className="flex items-center gap-2">
            <Newspaper className="h-6 w-6 text-primary-600" />
            <h1 className="text-3xl font-bold text-primary-900">Notizie</h1>
          </div>
          <p className="mt-3 text-lg text-primary-600">
            Novità, aggiornamenti normativi e consigli pratici per i docenti.
          </p>
          <div className="mt-8 rounded-2xl border border-dashed border-primary-200 bg-white p-12 text-center text-sm text-primary-400 shadow-card">
            La sezione Notizie sarà disponibile a breve: qui troverai aggiornamenti su interpelli,
            bandi e nuovi strumenti di ScuoleRadar.
          </div>
        </div>
      </section>
      <Footer />
    </div>
  );
}