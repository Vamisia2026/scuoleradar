import { useMemo, useState } from 'react';
import { Header } from '@/components/Header';
import { DepartmentErrorBoundary } from '@/components/DepartmentErrorBoundary';
import { Footer } from '@/components/Footer';
import {
  NotizieGrid,
  NotizieHero,
  newsArticles,
  categorieNotizie,
} from '@/departments/notizie';

/**
 * Pagina Notizie — thin wrapper sul dipartimento isolato `src/departments/notizie/`.
 * Lo stato della categoria è sollevato qui perché il menu Categorie vive
 * nell'Hero (colonna sinistra) e filtra la griglia degli articoli sottostante.
 *
 * Isolamento a runtime: hero e griglia hanno boundary separati, quindi se il
 * feed ingestito (o il widget Scadenze che vive nell'hero) dovesse rompersi,
 * il resto del blog e l'intero sito — Header, navigazione, Footer — restano
 * utilizzabili.
 */
export function NotiziePage() {
  const [categoria, setCategoria] = useState('Tutte');

  const { categorie, conteggi } = useMemo(() => {
    const mappa = new Map<string, number>();
    for (const a of newsArticles) mappa.set(a.category, (mappa.get(a.category) ?? 0) + 1);
    return {
      categorie: ['Tutte', ...categorieNotizie()],
      conteggi: Object.fromEntries(mappa),
    };
  }, []);

  return (
    <div className="min-h-screen w-full max-w-full overflow-x-hidden bg-slate-50">
      <Header />
      <main className="w-full max-w-full overflow-x-hidden">
        <DepartmentErrorBoundary
          dipartimento="Notizie"
          titolo="La testata di Notizie non è disponibile"
          messaggio="Il feed e le scadenze non possono essere mostrati in questo momento. Gli articoli pubblicati restano qui sotto e il resto del sito continua a funzionare."
        >
          <NotizieHero
            categorie={categorie}
            conteggi={conteggi}
            categoria={categoria}
            onCategoriaChange={setCategoria}
          />
        </DepartmentErrorBoundary>
        <DepartmentErrorBoundary
          dipartimento="Notizie"
          titolo="L'elenco degli articoli non è disponibile"
          messaggio="Non riusciamo a mostrare l'elenco delle notizie in questo momento. Riprova tra poco: il resto di ScuoleRadar continua a funzionare."
          className="mx-auto w-full max-w-7xl px-4 sm:px-6"
        >
          <section
            aria-label="Articoli pubblicati"
            className="mx-auto w-full max-w-7xl overflow-x-hidden px-4 pb-16 sm:px-6"
          >
            <NotizieGrid articoli={newsArticles} categoria={categoria} />
          </section>
        </DepartmentErrorBoundary>
      </main>
      <Footer />
    </div>
  );
}