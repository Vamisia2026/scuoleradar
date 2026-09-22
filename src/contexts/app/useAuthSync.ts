/**
 * Contesto App · sincronizzazione della sessione Supabase Auth.
 *
 * Estratto da `useBootstrapProfilo.ts` (a sua volta da `AppContext.tsx`):
 * listener `onAuthStateChange` (identità, avatar, piano, anagrafica) e refresh
 * attivo di piano/abbonamento su focus e ogni 60 secondi.
 */
import { useEffect, type Dispatch, type MutableRefObject, type SetStateAction } from 'react';
import { identify } from '@/lib/analytics';
import { supabase } from '@/lib/supabase';
import { tracciaSignupCompletato } from './helpers';
import type { User } from './types';

/** Dipendenze esterne: azioni di profilo + setter del provider. */
export interface OpzioniAuthSync {
  /** Verifica nome/cognome su `profiles` → mini-onboarding anagrafico. */
  valutaProfiloIncompleto: (userId: string) => Promise<void>;
  /** Ricarica piano/abbonamento e contatori dal DB. */
  refreshProfilo: () => Promise<void>;
  /** Id della sessione Supabase: sottoscrizione Realtime della riga profilo. */
  supabaseUserId: string | null;
  /** Id dell'ultima sessione per cui il piano è stato caricato dal DB. */
  pianoSessionUserIdRef: MutableRefObject<string | null>;
  setUser: Dispatch<SetStateAction<User | null>>;
  setLoading: Dispatch<SetStateAction<boolean>>;
  setAvatarUrl: Dispatch<SetStateAction<string | null>>;
  setSupabaseUserId: Dispatch<SetStateAction<string | null>>;
  setPiano: Dispatch<SetStateAction<'base' | 'pro' | 'free_forever'>>;
  setAbbonato: Dispatch<SetStateAction<boolean>>;
  setPianoStato: Dispatch<SetStateAction<'loading' | 'pronto'>>;
  setProfiloIncompleto: Dispatch<SetStateAction<boolean>>;
}

/** Effetti di sincronizzazione sessione: nessun valore di ritorno. */
export function useAuthSync({
  valutaProfiloIncompleto,
  refreshProfilo,
  supabaseUserId,
  pianoSessionUserIdRef,
  setUser,
  setLoading,
  setAvatarUrl,
  setSupabaseUserId,
  setPiano,
  setAbbonato,
  setPianoStato,
  setProfiloIncompleto,
}: OpzioniAuthSync): void {
  // Sincronizza la sessione Supabase Auth (es. redirect di ritorno da Google OAuth).
  // Qui NON forziamo cambi di rotta: la navigazione di ritorno è gestita unicamente
  // dalla rotta dedicata <AuthCallback />, evitando loop di reindirizzamento OAuth.
  useEffect(() => {
    if (!supabase) return;
    const client = supabase;

    const { data: subscription } = client.auth.onAuthStateChange((event, session) => {
      console.log('[AUTH EVENT]', event, session);
      if (event === 'INITIAL_SESSION' || event === 'SIGNED_IN' || event === 'SIGNED_OUT') {
        setLoading(false);
      }
      if ((event === 'SIGNED_IN' || event === 'INITIAL_SESSION') && session?.user) {
        setSupabaseUserId(session.user.id);
        // Analytics: collega l'ID anonimo all'ID utente (nessun dato personale inviato).
        identify(session.user.id);
        // Funnel: segnala l'iscrizione completata quando il primo accesso coincide con la
        // creazione dell'account (provider da app_metadata, MAI email o dati anagrafici).
        const appMeta = (session.user.app_metadata ?? {}) as Record<string, unknown>;
        const provider =
          String(appMeta.provider ?? (Array.isArray(appMeta.providers) ? appMeta.providers[0] : '') ?? '') ||
          'email';
        const creato = session.user.created_at ? new Date(session.user.created_at).getTime() : 0;
        const ultimoAccesso = session.user.last_sign_in_at
          ? new Date(session.user.last_sign_in_at).getTime()
          : creato;
        if (creato > 0 && Math.abs(ultimoAccesso - creato) < 60_000) {
          tracciaSignupCompletato(provider);
        }
        const meta = (session.user.user_metadata ?? {}) as Record<string, unknown>;
        // Avatar Google OAuth: avatar_url (o picture come fallback) in user_metadata.
        setAvatarUrl(String(meta.avatar_url ?? meta.picture ?? '').trim() || null);
        // Sincronizza lo "user" locale (usato da RequireAuth / navigazione / header)
        // con la sessione Supabase REALE. Copre sia gli account Google (full_name)
        // sia gli account email creati da Admin / beta tester (nome/cognome/genere/eta
        // in user_metadata, senza full_name) che NON hanno riga in localStorage.
        // NOME/COGNOME: si preferiscono SEMPRE i campi espliciti (`nome`/`cognome`,
        // scritti dal form di registrazione/wizard) e i valori già presenti in locale.
        // Solo in loro assenza si ricava dal `full_name` del provider — e senza mai
        // spezzare stringhe composte («Bison Productions» resta intero).
        const nomeEsplicito = String(meta.nome ?? '').trim();
        const cognomeEsplicito = String(meta.cognome ?? '').trim();
        const nomeCompleto = String(meta.full_name ?? meta.name ?? '').trim();
        let nomeDaProvider = nomeEsplicito;
        let cognomeDaProvider = cognomeEsplicito;
        if (!nomeDaProvider && nomeCompleto) {
          const spazio = nomeCompleto.indexOf(' ');
          if (spazio > 0 && !cognomeDaProvider) {
            nomeDaProvider = nomeCompleto.slice(0, spazio);
            cognomeDaProvider = nomeCompleto.slice(spazio + 1).trim();
          } else {
            nomeDaProvider = nomeCompleto;
          }
        }
        const emailSess = session.user.email ?? '';
        const etaSess = meta.eta === null || meta.eta === undefined || Number.isNaN(Number(meta.eta))
          ? null
          : Number(meta.eta);
        const genereSess = meta.genere === 'M' || meta.genere === 'F' ? (meta.genere as 'M' | 'F') : undefined;
        /** Provincia in user_metadata (dal form di registrazione), se dichiarata. */
        const provinciaSess = typeof meta.provincia === 'string' && meta.provincia ? meta.provincia : null;
        setUser((prev) => {
          // Stesso utente: si COMPLETANO solo i campi vuoti — mai sovrascrivere un
          // dato inserito dall'utente (era la causa dei nomi «persi o spezzati»).
          if (prev && prev.email.toLowerCase() === emailSess.toLowerCase()) {
            return {
              ...prev,
              nome: prev.nome?.trim() || nomeDaProvider || prev.nome,
              cognome: prev.cognome?.trim() || cognomeDaProvider || prev.cognome,
              genere: prev.genere ?? genereSess ?? null,
              eta: prev.eta ?? etaSess,
              provincia: prev.provincia ?? provinciaSess,
            };
          }
          return {
            nome: nomeDaProvider || 'Docente',
            cognome: cognomeDaProvider,
            email: emailSess,
            password: '',
            genere: genereSess,
            eta: etaSess,
            provincia: provinciaSess,
          };
        });
        // Alla prima autenticazione crea/aggiorna la riga profilo (province/classi sincronizzate).
        const idSessione = session.user.id;
        if (event === 'SIGNED_IN') {
          void client
            .from('profiles')
            .upsert({ id: idSessione, email: session.user.email ?? '' }, { onConflict: 'id' })
            .then(() => {
              void valutaProfiloIncompleto(idSessione);
            });
        } else {
          // INITIAL_SESSION: la riga profilo esiste già (trigger auth.users) → verifica anagrafica.
          void valutaProfiloIncompleto(idSessione);
        }
        // PULIZIA ANTI-STALE: se cambia l'utente azzeriamo piano/abbonato e
        // ripartiamo dallo stato 'loading' — mai mostrare il piano del vecchio
        // utente o un 'Base' non confermato dal DB.
        if (pianoSessionUserIdRef.current !== idSessione) {
          setPiano('base');
          setAbbonato(false);
          setPianoStato('loading');
        }
        // SINGLE SOURCE OF TRUTH: il piano/ruolo viene (ri)letto dal DB profiles
        // a OGNI cambio di stato auth (SIGNED_IN e INITIAL_SESSION).
        void refreshProfilo();
      }
      if (event === 'SIGNED_OUT') {
        setUser(null);
        setSupabaseUserId(null);
        setAvatarUrl(null);
        setProfiloIncompleto(false);
        // Il piano del vecchio utente NON deve sopravvivere al logout.
        setPiano('base');
        setAbbonato(false);
        setPianoStato('loading');
        pianoSessionUserIdRef.current = null;
      }
    });
    return () => subscription.subscription.unsubscribe();
  }, [setUser, setSupabaseUserId, valutaProfiloIncompleto, refreshProfilo]);

  // Sincronizzazione attiva del piano/abbonamento (senza logout/login):
  // un cambio piano fatto dal Pannello Admin viene rilevato tornando sulla
  // scheda del browser (focus) oppure al massimo entro ~60 secondi.
  useEffect(() => {
    if (!supabase) return;
    const refresh = (): void => void refreshProfilo();
    const id = window.setInterval(refresh, 60_000);
    const suVisibilita = (): void => {
      if (document.visibilityState === 'visible') refresh();
    };
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', suVisibilita);
    return () => {
      window.clearInterval(id);
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', suVisibilita);
    };
  }, [refreshProfilo]);

  /**
   * REALTIME — il piano (promo/omaggio/beta/upgrade) deve cambiare in UI SENZA
   * attendere il polling: si sottoscrive la riga `profiles` dell'utente e a ogni
   * cambiamento si ricarica il piano. Se Realtime non è abilitato sulla tabella il
   * canale resta semplicemente inattivo (nessun errore): restano focus + 60 s.
   */
  useEffect(() => {
    if (!supabase || !supabaseUserId) return;
    const client = supabase;
    const canale = client
      .channel(`profilo-piano-${supabaseUserId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'profiles',
          filter: `id=eq.${supabaseUserId}`,
        },
        () => {
          console.log('[realtime] riga profiles aggiornata → ricarico piano/crediti');
          void refreshProfilo();
        },
      )
      .subscribe((stato) => {
        if (stato === 'CHANNEL_ERROR' || stato === 'TIMED_OUT') {
          console.warn('[realtime] canale profiles non disponibile (resta il refresh su focus/60s).');
        }
      });
    return () => {
      void client.removeChannel(canale);
    };
  }, [supabaseUserId, refreshProfilo]);
}
