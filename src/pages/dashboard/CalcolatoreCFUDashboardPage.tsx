import { useApp } from '@/contexts/AppContext';
import { CalcolatoreCfuApp } from '@/departments/cfu';

/**
 * Pagina privata "/dashboard/calcolatore-cfu" — Calcolatore CFU in dashboard.
 * La rotta è protetta da `RequireAuth` in App.tsx: qui vive solo il montaggio
 * del tool isolato del Dipartimento CFU.
 */
export function CalcolatoreCFUDashboardPage() {
  const { user } = useApp();
  if (!user) return null; // RequireAuth (App.tsx) mostra già la card "Area riservata"
  return <CalcolatoreCfuApp />;
}
