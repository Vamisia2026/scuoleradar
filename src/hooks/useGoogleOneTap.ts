import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useApp } from '@/contexts/AppContext';

/**
 * Google One Tap — Sign-In con un clic per gli utenti non autenticati.
 *
 * Comportamento:
 *  - carica dinamicamente la libreria GSI (https://accounts.google.com/gsi/client)
 *    SOLO su pagine di ingresso e solo se l'utente non è già autenticato;
 *  - inizializza `google.accounts.id.initialize` con la client ID del provider
 *    Google configurato in Supabase Auth e mostra il prompt di One Tap;
 *  - al ricevimento dell'ID token chiama `supabase.auth.signInWithIdToken`.
 *
 * La creazione automatica del profilo (piano Base di default) e l'invio della
 * notifica Step 1 (welcome) sono gestiti lato database dal trigger
 * `trg_auth_users_step1_welcome` su `auth.users`, quindi valgono anche per i
 * nuovi utenti arrivati da One Tap.
 */

/** Stessa client ID del provider Google in Supabase Auth (config dal Dashboard). */
const GOOGLE_CLIENT_ID =
  (import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined) ??
  '1048863944948-cucj8ei0a73o20vtq1vg29gscpchkr80.apps.googleusercontent.com';

const GSI_SRC = 'https://accounts.google.com/gsi/client';

/** Pagine di ingresso "chiave" dove il prompt One Tap ha senso mostrarlo. */
function isEntryPage(pathname: string): boolean {
  return (
    pathname === '/' ||
    pathname === '/prezzi' ||
    pathname === '/chi-siamo' ||
    pathname === '/faq' ||
    pathname === '/servizi' ||
    pathname === '/contatti' ||
    pathname.startsWith('/notizie') ||
    pathname.startsWith('/dashboard')
  );
}

/** Carica lo script GSI una sola volta (idempotente). */
let gsiPromise: Promise<void> | null = null;
function loadGsiScript(): Promise<void> {
  if (window.google?.accounts?.id) return Promise.resolve();
  if (gsiPromise) return gsiPromise;
  gsiPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = GSI_SRC;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Impossibile caricare il client Google Identity Services'));
    document.head.appendChild(script);
  });
  return gsiPromise;
}

/** Ritorna `true` quando il prompt One Tap è stato inizializzato e mostrato. */
export function useGoogleOneTap(): boolean {
  const { supabaseUserId, user, loading, authModalOpen } = useApp();
  const { pathname } = useLocation();
  const [mostrato, setMostrato] = useState(false);

  const autenticato = Boolean(supabaseUserId) || Boolean(user);
  const attivo =
    !autenticato && !loading && !authModalOpen && isEntryPage(pathname) && Boolean(GOOGLE_CLIENT_ID);

  useEffect(() => {
    if (!attivo) return;
    if (!GOOGLE_CLIENT_ID) return;
    let cancellato = false;

    void (async () => {
      try {
        await loadGsiScript();
        if (cancellato) return;
        const g = window.google;
        if (!g?.accounts?.id) return;

        g.accounts.id.initialize({
          client_id: GOOGLE_CLIENT_ID,
          // callback: il token ID di Google viene scambiato con la sessione Supabase.
          callback: (resp) => {
            const token = resp.credential;
            if (!token) return;
            if (!supabase) {
              console.warn('[one-tap] Supabase non configurato: salta sign-in Google.');
              return;
            }
            void supabase.auth.signInWithIdToken({ provider: 'google', token }).then(({ data, error }) => {
              if (error) {
                console.warn('[one-tap] signInWithIdToken:', error.message);
                return;
              }
              // Il profilo (piano Base) e la welcome Step 1 sono gestiti dai trigger DB.
              console.log('[one-tap] accesso Google completato:', data.user?.email ?? '');
            });
          },
          cancel_on_tap_outside: false,
          auto_select: false,
          itp_support: true,
        });

        setMostrato(true);
        // Mostra il prompt One Tap (in alto a destra). Se Google non lo ritiene
        // idoneo (origin non autorizzata, cookie disabilitati, ecc.) non lo mostra.
        g.accounts.id.prompt(() => {
          /* Nessuna azione: la gestione della UI del prompt è di Google. */
        });
      } catch (err) {
        console.warn('[one-tap]', (err as Error).message);
      }
    })();

    return () => {
      cancellato = true;
    };
  }, [attivo]);

  return mostrato;
}