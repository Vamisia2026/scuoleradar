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
    const { data: subscription } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('[AUTH EVENT]', event, session);

      if (event === 'SIGNED_IN') {
        // Naviga UNA SOLA VOLTA per sessione: il flag evita loop di reindirizzamento OAuth.
        if (sessionStorage.getItem('oauth_done') === 'true') return;
        sessionStorage.setItem('oauth_done', 'true');
        navigate(preferenze.onboarded ? '/dashboard/radar' : '/onboarding');
      }

      if (event === 'SIGNED_OUT') {
        // Ripristina il flag così il prossimo login può navigare di nuovo.
        sessionStorage.removeItem('oauth_done');
      }
    });
    return () => subscription.subscription.unsubscribe();
  }, [navigate, preferenze.onboarded]);

  return null;
}
