import { Header } from '@/components/Header';
import { DepartmentErrorBoundary } from '@/components/DepartmentErrorBoundary';
import { Footer } from '@/components/Footer';
import { NotizieDettaglio } from '@/departments/notizie';

/**
 * Pagina Dettaglio Notizia — thin wrapper sul dipartimento isolato
 * `src/departments/notizie/`. La rotta `/notizie/:id` viene risolta
 * internamente dal componente `NotizieDettaglio` via `useParams`.
 *
 * Il boundary confina al corpo dell'articolo qualsiasi errore del feed
 * ingestito: Header, navigazione e Footer restano sempre disponibili.
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
            <DepartmentErrorBoundary
              dipartimento="Notizie"
              titolo="Questo articolo non è disponibile"
              messaggio="Non riusciamo a mostrare il contenuto della notizia in questo momento. Puoi tornare all'elenco delle notizie oppure continuare a usare gli altri servizi di ScuoleRadar."
            >
              <NotizieDettaglio />
            </DepartmentErrorBoundary>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
