import { Header } from '@/components/Header';
import { Footer } from './LandingPage';
import { ModuliShowroom } from '@/modules/modulistica';

/**
 * Pagina pubblica SEO "/moduli" — Showroom della Modulistica.
 * Accessibile anche senza autenticazione: anteprima del catalogo + CTA verso
 * il tool completo (/dashboard/moduli).
 */
export function ModuliShowroomPage() {
  return (
    <div className="flex min-h-screen flex-col bg-white">
      <Header />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6">
        <ModuliShowroom />
      </main>
      <Footer />
    </div>
  );
}
