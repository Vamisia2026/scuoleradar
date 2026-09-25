/**
 * Rotta di ritorno da Google OAuth.
 *
 * Al ritorno il client Supabase deve ancora completare lo SCAMBIO del codice PKCE:
 * per questo la pagina ATTENDE ATTIVAMENTE la sessione (polling leggero su
 * `getSession`) invece di rimbalzare subito alla home. Solo quando l'attesa è
 * scaduta senza sessione si torna al sito — mai un rimbalzo che costringa l'utente
 * a un secondo click su «Accedi».
 *
 * Identità e piano sono di AppContext (bootstrap + listener): qui c'è solo la
 * navigazione di ritorno.
 */
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useApp } from '@/contexts/AppContext';
import { supabase } from '@/lib/supabase';
import { getPostLoginRedirect } from '@/lib/showroomRedirect';

/** Attesa massima della sessione dopo il ritorno OAuth (lo scambio PKCE è async). */
const ATTESA_SESSIONE_MS = 8000;
/** Intervallo del controllo di sessione. */
const PASSO_ATTESA_MS = 250;

export function AuthCallback() {
  const { user, loading } = useApp();
  const navigate = useNavigate();
  /** true quando l'attesa è terminata SENZA sessione: si torna al sito. */
  const [senzaSessione, setSenzaSessione] = useState(false);

  // Attesa ATTIVA: `user` può arrivare qualche centinaio di ms dopo il primo render.
  useEffect(() => {
    if (!supabase || user) return;
    const client = supabase;
    let attivo = true;
    const inizio = Date.now();
    const timer = window.setInterval(() => {
      void client.auth.getSession().then(({ data }) => {
        if (!attivo) return;
        // Sessione trovata: identità e piano arrivano dal contesto.
        if (data.session) return;
        if (Date.now() - inizio >= ATTESA_SESSIONE_MS) {
          window.clearInterval(timer);
          setSenzaSessione(true);
        }
      });
    }, PASSO_ATTESA_MS);
    return () => {
      attivo = false;
      window.clearInterval(timer);
    };
  }, [user]);

  useEffect(() => {
    if (loading) return;
    if (user) {
      const redirect = getPostLoginRedirect();
      navigate(redirect ?? '/dashboard', { replace: true });
      return;
    }
    // Attesa conclusa senza sessione: torna alla home (nessun loop di redirect).
    if (senzaSessione) navigate('/', { replace: true });
  }, [user, loading, senzaSessione, navigate]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-gradient-to-b from-primary-50 to-white px-4">
      <span className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-500 text-white shadow-soft">
        <Loader2 className="h-7 w-7 animate-spin" />
      </span>
      <p className="text-lg font-semibold text-primary-800">
        {senzaSessione ? 'Nessuna sessione attiva' : 'Autenticazione in corso...'}
      </p>
      <p className="text-sm text-primary-500">
        {senzaSessione
          ? 'Il collegamento non è andato a buon fine: riprova dalla home.'
          : 'Attendi un momento, stiamo verificando la tua sessione.'}
      </p>
    </div>
  );
}
