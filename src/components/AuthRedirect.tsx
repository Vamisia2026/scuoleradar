import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useApp } from '@/contexts/AppContext';

/**
 * Reindirizzamento interno (React Router) SOLO dopo un SIGNED_IN reale.
 * Non interviene mai durante INITIAL_SESSION o durante l'elaborazione di
 * "#access_token" nell'URL (il token viene processato da supabase.auth.getSession),
 * evitando così loop di reindirizzamento OAuth.
 */
export function AuthRedirect() {
  const navigate = useNavigate();
  const { preferenze } = useApp();

  useEffect(() => {
    if (!supabase) return;
    const { data: subscription } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN') {
        navigate(preferenze.onboarded ? '/dashboard/radar' : '/onboarding');
      }
    });
    return () => subscription.subscription.unsubscribe();
  }, [navigate, preferenze.onboarded]);

  return null;
}
