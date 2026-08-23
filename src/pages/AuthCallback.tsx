import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useApp } from '@/contexts/AppContext';

/**
 * Rotta di ritorno da Google OAuth.
 * Lascia che AppContext sincronizzi la sessione (getSession + onAuthStateChange) e,
 * a caricamento terminato, reindirizza in base allo stato di autenticazione.
 * È l'UNICO punto che gestisce la navigazione di ritorno dal login.
 */
export function AuthCallback() {
  const { user, loading } = useApp();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && user) {
      navigate('/dashboard', { replace: true });
    } else if (!loading && !user) {
      navigate('/', { replace: true });
    }
  }, [user, loading, navigate]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-gradient-to-b from-primary-50 to-white px-4">
      <span className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-500 text-white shadow-soft">
        <Loader2 className="h-7 w-7 animate-spin" />
      </span>
      <p className="text-lg font-semibold text-primary-800">Autenticazione in corso...</p>
      <p className="text-sm text-primary-500">Attendi un momento, stiamo verificando la tua sessione.</p>
    </div>
  );
}
