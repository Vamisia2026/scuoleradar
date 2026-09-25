/**
 * Contesto App · azioni di account e ciclo di vita della sessione.
 *
 * Estratto da `AppContext.tsx`: registrazione, login demo e Supabase, accesso
 * locale admin, logout (azzera stato, piano e preferenze), login Google OAuth e
 * l'effetto che in modalità demo marca subito il piano come pronto.
 *
 * Riceve solo gli stati e i setter che usa: nessuna dipendenza dalle funzioni di
 * profilo definite più avanti nel provider, ordine degli hook invariato.
 */
import { useCallback, useEffect, type Dispatch, type MutableRefObject, type SetStateAction } from 'react';
import { track } from '@/lib/analytics';
import { traduciErroreAuthSupabase } from '@/lib/authErrors';
import { svuotaBozzaRegistrazione } from '@/lib/bozzaRegistrazione';
import { supabase } from '@/lib/supabase';
import { defaultPreferenze } from './costanti';
import { tracciaSignupCompletato } from './helpers';
import type { Esame, Preferenze, User } from './types';

/** Stato e setter del provider usati dalle azioni di account. */
export interface OpzioniAzioniAccount {
  user: User | null;
  setUser: Dispatch<SetStateAction<User | null>>;
  setPianoStato: Dispatch<SetStateAction<'loading' | 'pronto'>>;
  setPref: Dispatch<SetStateAction<Preferenze>>;
  setNotificheUsate: Dispatch<SetStateAction<number>>;
  setAbbonato: Dispatch<SetStateAction<boolean>>;
  setPiano: Dispatch<SetStateAction<'base' | 'pro' | 'free_forever'>>;
  setRadarAttivo: Dispatch<SetStateAction<boolean>>;
  setCrediti: Dispatch<SetStateAction<number>>;
  setSupabaseUserId: Dispatch<SetStateAction<string | null>>;
  setEsamiState: Dispatch<SetStateAction<Esame[]>>;
  setNotificati: Dispatch<SetStateAction<string[]>>;
  pianoSessionUserIdRef: MutableRefObject<string | null>;
}

/** Azioni di account esposte dal contesto. */
export interface AzioniAccount {
  register: (u: User) => Promise<{ ok: boolean; errore?: string }>;
  login: (email: string, password: string) => boolean;
  loginSupabase: (email: string, password: string) => Promise<{ ok: boolean; errore?: string; code?: string }>;
  accediDemo: (email: string) => void;
  logout: () => void;
  loginConGoogle: () => Promise<void>;
}

export function useAzioniAccount({
  user,
  setUser,
  setPianoStato,
  setPref,
  setNotificheUsate,
  setAbbonato,
  setPiano,
  setRadarAttivo,
  setCrediti,
  setSupabaseUserId,
  setEsamiState,
  setNotificati,
  pianoSessionUserIdRef,
}: OpzioniAzioniAccount): AzioniAccount {
  const register = useCallback(
    async (u: User): Promise<{ ok: boolean; errore?: string }> => {
      // Analytics: tentativo di registrazione email.
      track('signup_attempted', { method: 'email' });

      // Modalità demo (Supabase non configurato): registrazione locale e immediata.
      if (!supabase) {
        setUser(u);
        setPianoStato('pronto');
        track('signup_success', { method: 'email', demo: true });
        tracciaSignupCompletato('email', true);
        return { ok: true };
      }

      // Password demo generata se assente (es. utente creato da un provider social).
      const password = u.password || `Demo!${crypto.randomUUID()}`;
      // Il genere/età/provincia viaggiano in user_metadata: alimentano la
      // concordanza delle email (Benvenuto/Benvenuta) e finiscono in `profiles`
      // al primo salvataggio del profilo.
      const { error } = await supabase.auth.signUp({
        email: u.email,
        password,
        options: {
          data: {
            genere: u.genere ?? '',
            eta: u.eta ?? null,
            provincia: u.provincia ?? '',
            nome: u.nome.trim(),
            cognome: u.cognome.trim(),
          },
        },
      });
      if (error) {
        // L'errore NON viene più inghiottito: il form lo mostra e resta aperto
        // (prima la registrazione sembrava riuscita e l'utente restava senza account).
        console.warn('Supabase signUp:', error.message, '| code:', error.code ?? '');
        return { ok: false, errore: traduciErroreAuthSupabase(error) };
      }

      // Account creato: stato locale coerente SUBITO (anche se Supabase richiede la
      // conferma via email) così il wizard Radar "in attesa" si riapre al termine.
      setUser(u);
      setPianoStato('pronto');
      track('signup_success', { method: 'email' });
      tracciaSignupCompletato('email');
      return { ok: true };
    },
    [setUser, setPianoStato],
  );

  const login = useCallback(
    (email: string, password: string): boolean => {
      const ok = Boolean(
        user && user.email.toLowerCase() === email.toLowerCase() && user.password === password,
      );
      // PASSO 3: autenticazione reale su Supabase Auth (non bloccante per la demo).
      if (ok && supabase) {
        void supabase.auth.signInWithPassword({ email, password }).then(({ error }) => {
          if (error) console.warn('Supabase signIn:', error.message);
        });
      }
      return ok;
    },
    [user],
  );

  /**
   * Login email REALE su Supabase Auth (usato dal AuthModal).
   *
   * Per gli utenti creati da Admin / beta tester (es. pre-approvati con password
   * provvisoria "Scuoleradar2026") NON esiste una riga in localStorage: il vecchio
   * flusso demo falliva quindi sempre. Qui `signInWithPassword` è il percorso
   * principale: se va a buon fine allinea subito lo stato locale `user` con la
   * sessione (necessario perché ForcePasswordModal/RequireAuth funzionino), mentre
   * ogni errore Supabase viene tradotto in un messaggio chiaro per il toast.
   */
  const loginSupabase = useCallback(
    async (emailRaw: string, password: string): Promise<{ ok: boolean; errore?: string; code?: string }> => {
      const email = emailRaw.trim().toLowerCase();

      // Modalità demo (Supabase non configurato): autenticazione locale.
      if (!supabase) {
        const ok = Boolean(
          user && user.email.toLowerCase() === email && user.password === password,
        );
        return ok
          ? { ok: true }
          : {
              ok: false,
              errore: 'Credenziali non valide. Controlla email e password oppure crea un account.',
              code: 'demo',
            };
      }

      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        console.warn('Supabase signInWithPassword:', error.message, '| code:', error.code ?? '');
        return { ok: false, errore: traduciErroreAuthSupabase(error), code: error.code ?? undefined };
      }

      // Sessione ottenuta: allinea subito lo stato locale `user` così la navigazione
      // post-login (RequireAuth) e il ForcePasswordModal vedono l'utente autenticato.
      const au = data.user;
      if (au?.email) {
        const meta = (au.user_metadata ?? {}) as Record<string, unknown>;
        const nomeCompleto = String(meta.full_name ?? meta.name ?? meta.nome ?? '').trim();
        const [primoNome, ...resto] = nomeCompleto.split(' ');
        const eta = meta.eta === null || meta.eta === undefined || Number.isNaN(Number(meta.eta))
          ? null
          : Number(meta.eta);
        const genere = meta.genere === 'M' || meta.genere === 'F' ? (meta.genere as 'M' | 'F') : undefined;
        setUser({
          nome: primoNome || 'Docente',
          cognome: String(meta.cognome ?? '').trim() || resto.join(' ').trim(),
          email: au.email,
          password: '',
          genere,
          eta,
        });
      }
      return { ok: true };
    },
    [user, setUser],
  );

  /**
   * Accesso locale immediato senza sessione Supabase (fallback pannello admin).
   * A differenza di `register` non scatena alcun `signUp` remoto: imposta solo
   * lo "user" locale così le guardie di navigazione e l'header vedono l'utente.
   */
  const accediDemo = useCallback(
    (emailRaw: string): void => {
      const email = emailRaw.trim().toLowerCase();
      if (!email) return;
      setUser((prev) =>
        prev && prev.email.toLowerCase() === email
          ? prev
          : { nome: 'Admin', cognome: 'ScuoleRadar', email, password: '' },
      );
      // Accesso locale (fallback admin): nessuna sessione Supabase → piano demo pronto.
      setPianoStato('pronto');
    },
    [setUser, setPianoStato],
  );

  // Modalità demo (Supabase non configurato): non c'è un DB da cui leggere il
  // piano → il piano "pronto" è quello locale (Base/PRO simulati). In produzione
  // il badge resta in 'loading' finché il DB non conferma il piano reale.
  useEffect(() => {
    if (!supabase) setPianoStato('pronto');
  }, []);

  /**
   * Azzera TUTTO lo stato locale legato all'utente autenticato in precedenza:
   * identità, preferenze (incluse genere/età/provincia), contatori, piano, esami,
   * bozza del wizard e ripresa del wizard. Usata dal logout E dal cambio account
   * Google, così nessun dato dell'utente precedente sopravvive.
   */
  const azzeraStatoUtente = useCallback(() => {
    setUser(null);
    setPref(defaultPreferenze);
    // Pulizia della ripresa del wizard Radar (bozza di un altro account/browser).
    try {
      localStorage.removeItem('sr_radar_wizard_step');
      localStorage.removeItem('sr_user');
    } catch {
      // localStorage non disponibile
    }
    // Privacy: la bozza di registrazione (nome/cognome/età/provincia) NON deve
    // sopravvivere al logout/cambio account su un dispositivo condiviso.
    svuotaBozzaRegistrazione();
    setNotificheUsate(0);
    setAbbonato(false);
    setPiano('base');
    setPianoStato('pronto'); // nessun utente visibile: badge non mostrato
    pianoSessionUserIdRef.current = null;
    setRadarAttivo(false);
    setCrediti(0);
    setSupabaseUserId(null);
    setEsamiState([]);
    setNotificati([]);
  }, [setUser, setPref, setNotificheUsate, setAbbonato, setPiano, setPianoStato, setRadarAttivo, setCrediti, setSupabaseUserId, setEsamiState, setNotificati, pianoSessionUserIdRef]);

  const logout = useCallback(() => {
    void supabase?.auth.signOut();
    azzeraStatoUtente();
  }, [azzeraStatoUtente]);

  /**
   * LOGIN/REGISTRAZIONE GOOGLE — sempre con una sessione PULITA.
   *
   * Se un utente è già autenticato (caso tipico: passaggio da un account Google a un
   * altro, es. Bartolo → Pralino) la sessione esistente viene chiusa **prima** di
   * avviare l'OAuth: senza questo passaggio il client può riproporre la sessione
   * precedente e servono DUE click (il primo sembra non fare nulla, e genere/età/
   * provincia restano quelli dell'account di prima). `scope: 'local'` non tocca le
   * sessioni sugli altri dispositivi; lo stato locale dell'utente precedente viene
   * azzerato subito, così il ritorno da Google è già il nuovo account.
   */
  const loginConGoogle = useCallback(async () => {
    if (!supabase) return;

    // Analytics: avvio del flusso Google OAuth (login o registrazione).
    track('signin_google_started');

    // Sessione precedente presente (cambio account): si chiude in locale e si azzera
    // lo stato utente, così il primo click è già quello giusto.
    try {
      const { data } = await supabase.auth.getSession();
      if (data.session) {
        console.log('[auth] cambio account Google: chiudo la sessione locale precedente.');
        await supabase.auth.signOut({ scope: 'local' });
        azzeraStatoUtente();
      }
    } catch (err) {
      console.warn('Chiusura sessione precedente non riuscita (proseguo con OAuth).', err);
    }

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/dashboard`,
        skipBrowserRedirect: true, // Non far gestire il redirect al client JS
        queryParams: {
          prompt: 'select_account', // Forza il flusso OAuth classico (niente One Tap)
        },
      },
    });

    if (error) throw error;

    if (data?.url) {
      window.location.href = data.url; // Forza il browser ad andare direttamente su Google
    }
  }, [azzeraStatoUtente]);

  return { register, login, loginSupabase, accediDemo, logout, loginConGoogle };
}
