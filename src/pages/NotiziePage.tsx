import { Newspaper } from 'lucide-react';
import { Header } from '@/components/Header';
import { Footer } from './LandingPage';
import { NotizieGrid } from '@/departments/notizie';

/**
 * Pagina Notizie — thin wrapper sul dipartimento isolato `src/departments/notizie/`.
 * Tutta la logica (servizi, dati, componenti) vive nel dipartimento;
 * qui solo il chrome di pagina (Header/Footer) e la vista a schede pubblica.
 */
export function NotiziePage() {
  return (
    <div className="min-h-screen bg-slate-50">
      <Header />
      <section className="bg-gradient-to-b from-primary-50 to-white">
        <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-14">
          <div className="flex items-center gap-2">
            <Newspaper className="h-6 w-6 text-primary-600" />
            <h1 className="text-3xl font-bold text-primary-900">Notizie</h1>
          </div>
          <p className="mt-3 max-w-2xl text-lg text-primary-600">
            Tu non devi controllare 100 siti: controlliamo noi per non farti perdere tempo. Solo
            notizie ufficiali e scadenze reali, dalle fonti del MIM e della Gazzetta Ufficiale.
          </p>
          <div className="mt-8">
            <NotizieGrid />
          </div>
        </div>
      </section>
      <Footer />
    </div>
  );
}