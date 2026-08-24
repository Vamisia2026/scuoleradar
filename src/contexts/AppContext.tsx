import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { supabase } from '@/lib/supabase';
import { interpelli, type Interpello } from '@/data/interpelli';
import { getModuliScaricati } from '@/data/moduli';
import { getFeedInterpelli } from '@/lib/matchingEngine';
import type { OrdineScuola } from '@/data/ordiniMaterie';
import { classiConcorso, classeByCodice } from '@/data/classiConcorso';
import { province } from '@/data/province';

export interface User {
  nome: string;
  cognome: string;
  email: string;
  // password stored only for demo; never do this in production
  password: string;
}

export interface Preferenze {
  ordini: OrdineScuola[];
  classiCodici: string[];
  materieId: string[];
  materieCustom: string[];
  provinceCodici: string[];
  telegramUsername: string;
  /** Chat ID Telegram dell'utente per le notifiche del bot (FASE 5) */
  telegramChatId: string;
  emailNotifica: string;
  onboarded: boolean;
  /** Whitelist scuole: notifiche prioritarie / badge "Scuola Preferita" */
  favoriteSchools: string[];
  /** Blacklist scuole: nascondi gli avvisi */
  ignoredSchools: string[];
}

export interface Esame {
  id: string;
  materia: string;
  cfu: number;
  settore: string;
}

/** Ruoli simulabili dalla DevToolbar (solo ambiente di sviluppo) */
export type RuoloSimulato = 'guest' | 'base' | 'pro';

interface AppState {
  user: User | null;
  preferenze: Preferenze;
  notificheUsate: number;
  abbonato: boolean;
  esami: Esame[];
  interpelliNotificati: string[]; // ids
}

interface AppContextValue extends AppState {
  register: (u: User) => void;
  login: (email: string, password: string) => boolean;
  logout: () => void;
  setPreferenze: (p: Partial<Preferenze>) => void;
  completaOnboarding: (p: Partial<Preferenze>) => void;
  incrementaNotifica: (interpelloId: string) => void;
  abbonati: () => void;
  setEsami: (e: Esame[]) => void;
  interpelliFiltrati: Interpello[];
  origineDati: 'mock' | 'supabase';
  loading: boolean;
  authModalOpen: boolean;
  authModalMode: 'login' | 'registrazione';
  openAuthModal: (mode?: 'login' | 'registrazione') => void;
  closeAuthModal: () => void;
  simulaStato: (ruolo: RuoloSimulato) => void;
  resettaTutto: () => void;
  salvaProfilo: (p?: Preferenze) => Promise<void>;
  loginConGoogle: () => Promise<void>;
}

const defaultPreferenze: Preferenze = {
  ordini: [],
  classiCodici: [],
  materieId: [],
  materieCustom: [],
  provinceCodici: [],
  telegramUsername: '',
  telegramChatId: '',
  emailNotifica: '',
  onboarded: false,
  favoriteSchools: [],
  ignoredSchools: [],
};

/** Converte una riga della tabella `notices` nel tipo `Interpello` usato dalla dashboard. */
function mapNoticiaToInterpello(r: {
  id: string;
  title: string | null;
  source_url: string | null;
  province: string | null;
  class_codes: string[] | null;
  expiration_date: string | null;
}): Interpello {
  const codici = (r.class_codes ?? []).filter(Boolean);
  const primaClasse = codici[0] ?? '';
  const classe = classeByCodice(primaClasse);
  const provinciaCodice = (r.province ?? '').toUpperCase();
  return {
    id: r.id,
    titolo: r.title ?? 'Avviso non classificato',
    istituto: '', // `notices` non ha un campo scuola dedicato: il match filtri scuole avviene sul titolo
    provinciaCodice,
    provinciaNome: province.find((p) => p.codice === provinciaCodice)?.nome ?? provinciaCodice,
    classeCodice: primaClasse,
    classiCodes: codici,
    ordine: classe?.ordine ?? 'secondaria2',
    dataScadenza: r.expiration_date ?? '',
    descrizione: r.title ?? '',
    linkFonte: r.source_url ?? '',
    compatibilita: 100,
  };
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useLocalStorage<User | null>('sr_user', null);
  const [preferenze, setPref] = useLocalStorage<Preferenze>('sr_preferenze', defaultPreferenze);
  const [notificheUsate, setNotificheUsate] = useLocalStorage<number>('sr_notifiche', 0);
  const [abbonato, setAbbonato] = useLocalStorage<boolean>('sr_abbonato', false);
  const [esami, setEsamiState] = useLocalStorage<Esame[]>('sr_esami', []);
  const [interpelliNotificati, setNotificati] = useLocalStorage<string[]>('sr_notificati', []);

  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authModalMode, setAuthModalMode] = useState<'login' | 'registrazione'>('login');

  const openAuthModal = useCallback((mode: 'login' | 'registrazione' = 'login') => {
    setAuthModalMode(mode);
    setAuthModalOpen(true);
  }, []);

  const closeAuthModal = useCallback(() => setAuthModalOpen(false), []);

  const register = useCallback(
    (u: User) => {
      setUser(u);
      // PASSO 3: crea anche l'utente reale su Supabase Auth (non bloccante per la demo).
      if (supabase) {
        // Password demo generata se assente (es. login Google simulato).
        const password = u.password || `Demo!${crypto.randomUUID()}`;
        void supabase.auth.signUp({ email: u.email, password }).then(({ error }) => {
          if (error && !/already registered/i.test(error.message)) {
            console.warn('Supabase signUp:', error.message);
          }
        });
      }
    },
    [setUser],
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

  const logout = useCallback(() => {
    void supabase?.auth.signOut();
    setUser(null);
    setPref(defaultPreferenze);
    setNotificheUsate(0);
    setAbbonato(false);
    setEsamiState([]);
    setNotificati([]);
  }, [setUser, setPref, setNotificheUsate, setAbbonato, setEsamiState, setNotificati]);

  const setPreferenze = useCallback(
    (p: Partial<Preferenze>) => setPref((prev) => ({ ...prev, ...p })),
    [setPref],
  );

  const completaOnboarding = useCallback(
    (p: Partial<Preferenze>) => setPref((prev) => ({ ...prev, ...p, onboarded: true })),
    [setPref],
  );

  const incrementaNotifica = useCallback(
    (interpelloId: string) => {
      setNotificati((prev) => (prev.includes(interpelloId) ? prev : [...prev, interpelloId]));
      if (!abbonato) {
        setNotificheUsate((n) => Math.min(n + 1, 3));
      }
    },
    [abbonato, setNotificati, setNotificheUsate],
  );

  const abbonati = useCallback(() => {
    setAbbonato(true);
    setNotificheUsate(0);
  }, [setAbbonato, setNotificheUsate]);

  // Stato simulato per la DevToolbar (solo sviluppo). Aggiorna all'istante context + UI.
  const simulaStato = useCallback(
    (ruolo: RuoloSimulato) => {
      if (ruolo === 'guest') {
        setUser(null);
        setPref(defaultPreferenze);
        setNotificheUsate(0);
        setAbbonato(false);
        return;
      }
      const utenteDemo: User = {
        nome: 'Mario',
        cognome: 'Rossi',
        email: 'mario.rossi@gmail.com',
        password: '',
      };
      setUser(utenteDemo);
      setAbbonato(ruolo === 'pro');
      setNotificheUsate(0);
      setPref((prev) => ({
        ...prev,
        ordini: prev.ordini.length > 0 ? prev.ordini : ['secondaria1', 'secondaria2'],
        provinceCodici:
          prev.provinceCodici.length > 0 ? prev.provinceCodici : ['RM', 'TO', 'MI', 'NA'],
        onboarded: true,
      }));
    },
    [setUser, setPref, setNotificheUsate, setAbbonato],
  );

  const resettaTutto = useCallback(() => {
    ['sr_user', 'sr_preferenze', 'sr_notifiche', 'sr_abbonato', 'sr_esami', 'sr_notificati'].forEach(
      (k) => localStorage.removeItem(k),
    );
    setUser(null);
    setPref(defaultPreferenze);
    setNotificheUsate(0);
    setAbbonato(false);
    setEsamiState([]);
    setNotificati([]);
  }, [setUser, setPref, setNotificheUsate, setAbbonato, setEsamiState, setNotificati]);

  /**
   * PASSO 3 — Persiste le preferenze utente (province di interesse e classi di concorso)
   * direttamente nella tabella `profiles` di Supabase.
   * Richiede una sessione Supabase Auth attiva; altrimenti logga un avviso.
   */
  const salvaProfilo = useCallback(
    async (p?: Preferenze) => {
      if (!supabase) {
        console.warn('Supabase non configurato: profilo non salvato sul database.');
        return;
      }
      const {
        data: { user: authUser },
        error: errUser,
      } = await supabase.auth.getUser();
      if (errUser || !authUser) {
        console.warn('Nessuna sessione Supabase Auth: profilo non salvato (serve un login reale).');
        return;
      }
      const dati = p ?? preferenze;
      const { error } = await supabase
        .from('profiles')
        .upsert(
          {
            id: authUser.id,
            email: authUser.email ?? dati.emailNotifica,
            province_attive: dati.provinceCodici,
            province_interesse: dati.provinceCodici,
            classi_concorso: dati.classiCodici,
            ordini_scuola: dati.ordini,
            moduli_scaricati: getModuliScaricati().map((m) => m.id),
            telegram_chat_id: dati.telegramChatId || null,
            favorite_schools: dati.favoriteSchools,
            ignored_schools: dati.ignoredSchools,
          },
          { onConflict: 'id' },
        );
      if (error) {
        console.error('Errore salvataggio profilo su Supabase:', error.message);
      } else {
        console.log('✓ Profilo salvato su Supabase (tabella profiles).');
      }
    },
    [preferenze],
  );

  /** Avvia Google OAuth con redirect diretto all'URL generato da Supabase (niente One Tap). */
  const loginConGoogle = useCallback(async () => {
    if (!supabase) return;

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
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
  }, []);

  // All'avvio, se esiste una sessione Supabase, carica le preferenze salvate nel DB.
  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }
    let attivo = true;
    (async () => {
      try {
        const {
          data: { user: au },
        } = await supabase.auth.getUser();
        if (!attivo) return;
        setLoading(false);
        if (!au) return;
        const { data, error } = await supabase
          .from('profiles')
          .select('province_attive, province_interesse, classi_concorso, ordini_scuola, telegram_chat_id, favorite_schools, ignored_schools')
          .eq('id', au.id)
          .maybeSingle();
        if (!error && data) {
          setPref((prev) => ({
            ...prev,
            ordini:
              data.ordini_scuola && data.ordini_scuola.length > 0 ? data.ordini_scuola : prev.ordini,
            provinceCodici:
              data.province_interesse && data.province_interesse.length > 0
                ? data.province_interesse
                : data.province_attive && data.province_attive.length > 0
                  ? data.province_attive
                  : prev.provinceCodici,
            classiCodici:
              data.classi_concorso && data.classi_concorso.length > 0
                ? data.classi_concorso
                : prev.classiCodici,
            telegramChatId: data.telegram_chat_id ? String(data.telegram_chat_id) : prev.telegramChatId,
            favoriteSchools:
              data.favorite_schools && data.favorite_schools.length > 0
                ? data.favorite_schools
                : prev.favoriteSchools,
            ignoredSchools:
              data.ignored_schools && data.ignored_schools.length > 0
                ? data.ignored_schools
                : prev.ignoredSchools,
          }));
        }
      } catch (err) {
        if (attivo) setLoading(false);
        console.warn('Caricamento profilo da Supabase non riuscito:', (err as Error).message);
      }
    })();
    return () => {
      attivo = false;
    };
  }, [setPref]);

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
        const meta = (session.user.user_metadata ?? {}) as Record<string, unknown>;
        const fullName = String(meta.full_name ?? meta.name ?? '').trim();
        if (fullName) {
          const [nome, ...resto] = fullName.split(' ');
          setUser({
            nome: nome || 'Docente',
            cognome: resto.join(' '),
            email: session.user.email ?? '',
            password: '',
          });
        }
        // Alla prima autenticazione crea/aggiorna la riga profilo (province/classi sincronizzate).
        if (event === 'SIGNED_IN') {
          void client
            .from('profiles')
            .upsert({ id: session.user.id, email: session.user.email ?? '' }, { onConflict: 'id' })
            .then(({ error }) => {
              if (error) console.warn('Sincronizzazione profilo (profiles):', error.message);
            });
        }
      }
      if (event === 'SIGNED_OUT') {
        setUser(null);
      }
    });
    return () => subscription.subscription.unsubscribe();
  }, [setUser]);

  const setEsami = useCallback((e: Esame[]) => setEsamiState(e), [setEsamiState]);

  // Fonte degli interpelli (FASE 3 — Matching Engine):
  // 1. tabella `interpelli` filtrata per province/classi del profilo,
  // 2. fallback sulla tabella legacy `notices`,
  // 3. fallback sui dati di esempio.
  const [fontiInterpelli, setFontiInterpelli] = useState<Interpello[]>(interpelli);
  const [origineDati, setOrigineDati] = useState<'mock' | 'supabase'>('mock');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!supabase) return;
    let attivo = true;
    (async () => {
      try {
        // Matching Engine: query `interpelli` per le province e le classi del profilo
        const feed = await getFeedInterpelli(supabase, {
          province: preferenze.provinceCodici,
          classi: preferenze.classiCodici,
        });
        if (!attivo) return;
        if (feed && feed.length > 0) {
          setFontiInterpelli(feed);
          setOrigineDati('supabase');
          console.log(
            `✓ Dashboard: ${feed.length} interpelli reali dal Matching Engine (tabella interpelli).`,
          );
          return;
        }

        // Fallback: tabella legacy `notices` (popolata dallo scraper)
        const { data, error } = await supabase
          .from('notices')
          .select('*')
          .order('expiration_date', { ascending: true })
          .limit(100);
        if (!attivo) return;
        if (!error && data && data.length > 0) {
          setFontiInterpelli(data.map(mapNoticiaToInterpello));
          setOrigineDati('supabase');
          console.log(`✓ Dashboard: ${data.length} interpelli reali caricati da Supabase (notices).`);
        } else {
          console.warn(
            error
              ? `Errore lettura notices: ${error.message}`
              : 'Nessun interpello nel DB: uso i dati di esempio.',
          );
          setFontiInterpelli(interpelli);
          setOrigineDati('mock');
        }
      } catch (err) {
        if (!attivo) return;
        console.warn('Fetch interpelli non riuscito, uso i dati di esempio:', (err as Error).message);
        setFontiInterpelli(interpelli);
        setOrigineDati('mock');
      }
    })();
    return () => {
      attivo = false;
    };
  }, [preferenze.provinceCodici, preferenze.classiCodici]);

  const interpelliFiltrati = useMemo<Interpello[]>(() => {
    if (!preferenze.onboarded) return [];
    const classiSelezionate = preferenze.classiCodici
      .map((cod) => classiConcorso.find((c) => c.codice === cod))
      .filter(Boolean);
    const materieDelleClassi = new Set(classiSelezionate.flatMap((c) => c!.materie));
    const tutteLeMaterie = new Set([
      ...preferenze.materieId,
      ...preferenze.materieCustom.map((m) => m.toLowerCase()),
    ]);
    return fontiInterpelli.filter((i) => {
      const matchProvincia =
        preferenze.provinceCodici.length === 0 || preferenze.provinceCodici.includes(i.provinciaCodice);
      const matchOrdine =
        preferenze.ordini.length === 0 || preferenze.ordini.includes(i.ordine);
      const classe = classiConcorso.find((c) => c.codice === i.classeCodice);
      // Match per tutte le classi rilevate (i dati reali di notices hanno class_codes[])
      const matchClasse =
        preferenze.classiCodici.length === 0 ||
        preferenze.classiCodici.some(
          (c) => (i.classiCodes?.includes(c) ?? false) || i.classeCodice === c,
        );
      const matchMateria =
        tutteLeMaterie.size === 0 ||
        (classe ? classe.materie.some((m) => tutteLeMaterie.has(m)) : false);
      const matchMaterieDelleClassi =
        materieDelleClassi.size === 0 ||
        (classe ? classe.materie.some((m) => materieDelleClassi.has(m)) : false);
      // Filtri Avanzati Scuole: nascondi gli avvisi delle scuole in ignoredSchools.
      // Il match considera istituto + titolo (i dati reali di notices non hanno un campo scuola).
      const scuolaTesto = `${i.istituto} ${i.titolo}`.toLowerCase();
      const matchScuolaNonEsclusa =
        preferenze.ignoredSchools.length === 0 ||
        !preferenze.ignoredSchools.some((s) => s && scuolaTesto.includes(s.toLowerCase()));
      return (
        matchProvincia &&
        matchOrdine &&
        (matchClasse || matchMateria || matchMaterieDelleClassi) &&
        matchScuolaNonEsclusa
      );
    });
  }, [preferenze, fontiInterpelli]);

  const value: AppContextValue = {
    user,
    preferenze,
    notificheUsate,
    abbonato,
    esami,
    interpelliNotificati,
    register,
    login,
    logout,
    setPreferenze,
    completaOnboarding,
    incrementaNotifica,
    abbonati,
    setEsami,
    interpelliFiltrati,
    origineDati,
    loading,
    authModalOpen,
    authModalMode,
    openAuthModal,
    closeAuthModal,
    simulaStato,
    resettaTutto,
    salvaProfilo,
    loginConGoogle,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
