import { Header } from '@/components/Header';
import { Footer } from './LandingPage';
import { NotizieGrid, NotizieHero } from '@/departments/notizie';

/**
 * Pagina Notizie — thin wrapper sul dipartimento isolato `src/departments/notizie/`.
 * Tutta la logica (servizi, dati, componenti) vive nel dipartimento;
 * qui solo il chrome di pagina (Header/Footer), il contenitore semantico
 * `<main>` e la vista a schede pubblica.
 */
export function NotiziePage() {
  return (
    <div className="min-h-screen bg-slate-50">
      <Header />
      <main>
        <NotizieHero />
        <section
          aria-label="Articoli pubblicati"
          className="mx-auto max-w-7xl px-4 pb-16 sm:px-6"
        >
          <NotizieGrid />
        </section>
      </main>
      <Footer />
    </div>
  );
}