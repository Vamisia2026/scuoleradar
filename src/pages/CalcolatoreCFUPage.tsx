import { useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '@/contexts/AppContext';
import { Header } from '@/components/Header';
import { DepartmentErrorBoundary } from '@/components/DepartmentErrorBoundary';
import { Footer } from '@/components/Footer';
import { CalcolatoreCfuLanding } from '@/departments/cfu';

/**
 * Pagina pubblica SEO "/calcolatore-cfu" — Landing del Dipartimento CFU.
 * La pagina resta un wrapper sottile: contenuto, SEO e funnel vivono nel
 * dipartimento isolato (`src/departments/cfu/`).
 *
 * Utenti AUTENTICATI: accesso immediato senza digitare nulla → al termine
 * della verifica della sessione vengono portati direttamente allo strumento
 * "/dashboard/calcolatore-cfu" del Dipartimento CFU.
 */
export function CalcolatoreCFUPage() {
  const navigate = useNavigate();
  const { user, loading } = useApp();

  useEffect(() => {
    if (loading) return;
    if (user) navigate('/dashboard/calcolatore-cfu', { replace: true });
  }, [user, loading, navigate]);

  if (loading || user) {
    return (
      <div className="flex min-h-screen flex-col bg-white">
        <Header />
        <main className="flex flex-1 items-center justify-center px-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-primary-500">
            <Loader2 className="h-5 w-5 animate-spin" />
            {loading ? 'Verifica della sessione…' : 'Apro il Calcolatore CFU…'}
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <Header />
      <main className="flex-1">
        <DepartmentErrorBoundary
          dipartimento="Calcolatore CFU"
          titolo="Il Calcolatore CFU non è disponibile"
          messaggio="La pagina non può essere mostrata in questo momento. Puoi ricaricarla oppure esplorare gli altri servizi di ScuoleRadar dal menu qui sopra."
          etichettaRiprova="Ricarica il Calcolatore CFU"
          className="mx-auto max-w-7xl px-4 sm:px-6"
        >
          <CalcolatoreCfuLanding />
        </DepartmentErrorBoundary>
      </main>
      <Footer />
    </div>
  );
}
