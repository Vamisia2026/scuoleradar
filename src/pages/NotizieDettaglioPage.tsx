import { Header } from '@/components/Header';
import { Footer } from './LandingPage';
import { NotizieDettaglio } from '@/departments/notizie';

/**
 * Pagina Dettaglio Notizia — thin wrapper sul dipartimento isolato
 * `src/departments/notizie/`. La rotta `/notizie/:id` viene risolta
 * internamente dal componente `NotizieDettaglio` via `useParams`.
 */
export function NotizieDettaglioPage() {
  return (
    <div className="min-h-screen w-full max-w-full overflow-x-hidden bg-slate-50">
      <Header />
      <main>
        <section
          aria-label="Dettaglio notizia"
          className="bg-gradient-to-b from-primary-50 to-white"
        >
          <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-14">
            <NotizieDettaglio />
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
