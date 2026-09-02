import { useMemo, useState } from 'react';
import { Header } from '@/components/Header';
import { Footer } from './LandingPage';
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
        <NotizieHero
          categorie={categorie}
          conteggi={conteggi}
          categoria={categoria}
          onCategoriaChange={setCategoria}
        />
        <section
          aria-label="Articoli pubblicati"
          className="mx-auto w-full max-w-7xl overflow-x-hidden px-4 pb-16 sm:px-6"
        >
          <NotizieGrid articoli={newsArticles} categoria={categoria} />
        </section>
      </main>
      <Footer />
    </div>
  );
}