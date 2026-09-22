import { useApp } from '@/contexts/AppContext';
import { DepartmentErrorBoundary } from '@/components/DepartmentErrorBoundary';
import { CalcolatoreCfuApp } from '@/departments/cfu';

/**
 * Pagina privata "/dashboard/calcolatore-cfu" — Calcolatore CFU in dashboard.
 * La rotta è protetta da `RequireAuth` in App.tsx: qui vive solo il montaggio
 * del tool isolato del Dipartimento CFU.
 *
 * Doppia protezione: il dipartimento ha già il proprio `CfuErrorBoundary`
 * interno; questo boundary esterno copre quanto accade PRIMA del suo montaggio
 * (import, stato iniziale) e mantiene la fallback centrata sulla dashboard.
 *
 * Canale commerciale: la pagina risolve l'accesso PRO e apre la vetrina piani
 * esistente (`openVetrina('cfu')`), passando al dipartimento solo valori e
 * un'azione: il calcolo resta gratuito e mai bloccato.
 */
export function CalcolatoreCFUDashboardPage() {
  const { user, hasProAccess, openVetrina } = useApp();
  if (!user) return null; // RequireAuth (App.tsx) mostra già la card "Area riservata"
  return (
    <DepartmentErrorBoundary
      dipartimento="Calcolatore CFU"
      etichettaRiprova="Riapri il Calcolatore CFU"
      className="mt-0"
    >
      <CalcolatoreCfuApp
        commerciale={{ haPro: hasProAccess, apriUpgrade: () => openVetrina('cfu') }}
      />
    </DepartmentErrorBoundary>
  );
}
