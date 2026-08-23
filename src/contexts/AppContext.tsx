import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { interpelli, type Interpello } from '@/data/interpelli';
import type { OrdineScuola } from '@/data/ordiniMaterie';
import { classiConcorso } from '@/data/classiConcorso';

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
  emailNotifica: string;
  onboarded: boolean;
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
  authModalOpen: boolean;
  authModalMode: 'login' | 'registrazione';
  openAuthModal: (mode?: 'login' | 'registrazione') => void;
  closeAuthModal: () => void;
  simulaStato: (ruolo: RuoloSimulato) => void;
  resettaTutto: () => void;
}

const defaultPreferenze: Preferenze = {
  ordini: [],
  classiCodici: [],
  materieId: [],
  materieCustom: [],
  provinceCodici: [],
  telegramUsername: '',
  emailNotifica: '',
  onboarded: false,
};

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

  const register = useCallback((u: User) => setUser(u), [setUser]);

  const login = useCallback(
    (email: string, password: string): boolean => {
      if (user && user.email.toLowerCase() === email.toLowerCase() && user.password === password) {
        return true;
      }
      return false;
    },
    [user],
  );

  const logout = useCallback(() => {
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

  const setEsami = useCallback((e: Esame[]) => setEsamiState(e), [setEsamiState]);

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
    return interpelli.filter((i) => {
      const matchProvincia =
        preferenze.provinceCodici.length === 0 || preferenze.provinceCodici.includes(i.provinciaCodice);
      const matchOrdine =
        preferenze.ordini.length === 0 || preferenze.ordini.includes(i.ordine);
      const classe = classiConcorso.find((c) => c.codice === i.classeCodice);
      const matchClasse =
        preferenze.classiCodici.length === 0 || preferenze.classiCodici.includes(i.classeCodice);
      const matchMateria =
        tutteLeMaterie.size === 0 ||
        (classe ? classe.materie.some((m) => tutteLeMaterie.has(m)) : false);
      const matchMaterieDelleClassi =
        materieDelleClassi.size === 0 ||
        (classe ? classe.materie.some((m) => materieDelleClassi.has(m)) : false);
      return matchProvincia && matchOrdine && (matchClasse || matchMateria || matchMaterieDelleClassi);
    });
  }, [preferenze]);

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
    authModalOpen,
    authModalMode,
    openAuthModal,
    closeAuthModal,
    simulaStato,
    resettaTutto,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
