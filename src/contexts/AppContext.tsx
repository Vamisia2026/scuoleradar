import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { supabase } from '@/lib/supabase';
import { interpelli, type Interpello } from '@/data/interpelli';
import { getModuliScaricati } from '@/data/moduli';
import { getFeedInterpelli } from '@/lib/matchingEngine';
import type { OrdineScuola } from '@/data/ordiniMaterie';
import { classiConcorso, classeByCodice } from '@/data/classiConcorso';
import { province } from '@/data/province';
import { STORAGE_KEY_INTENDED_PLAN, STORAGE_KEY_INTENDED_PLAN_DATA, type PianoId } from '@/lib/pricing';
import { identify, track } from '@/lib/analytics';

/** Limite notifiche per gli utenti BASE: 3 per ANNO solare (reset annuale via RPC incrementa_notifiche_utente). */
export const LIMITE_NOTIFICHE_PROVA = 3;

/** Chiave localStorage: "radar wizard in attesa" — un anonimo ha cliccato ATTIVA IL TUO RADAR. */
export const STORAGE_KEY_RADAR_WIZARD_PENDING = 'sr_wizard_pending';

export interface User {
  nome: string;
  cognome: string;
  /** Genere dichiarato ('M' | 'F'), opzionale: declina le email automatiche (Cara/Caro, stata/stato). */
  genere?: 'M' | 'F' | null;
  /** Età in anni (opzionale): dato anagrafico mostrato nel pannello admin. */
  eta?: number | null;
  email: string;
  // password stored only for demo; never do this in production
  password: string;
}

export interface Preferenze {
  /** Genere dichiarato (Uomo/Donna → M/F): persiste su profiles.genere. */
  genere?: 'M' | 'F' | null;
  /** Età in anni (opzionale): persiste su profiles.eta. */
  eta?: number | null;
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
  /** Crediti A la Carte disponibili (FASE 6) */
  crediti: number;
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
  avviaCheckout: (plan: PianoId, promo?: string, quantita?: number) => Promise<{ ok: boolean; errore?: string }>;
  setEsami: (e: Esame[]) => void;
  interpelliFiltrati: Interpello[];
  origineDati: 'mock' | 'supabase';
  loading: boolean;
  /** id dell'utente Supabase Auth con sessione attiva (null = non autenticato). */
  supabaseUserId: string | null;
  /** Avatar (URL) dell'utente autenticato da user_metadata (es. Google OAuth). */
  avatarUrl: string | null;
  /** true se il profilo (tabella profiles) manca di nome o cognome: i dati anagrafici vanno completati. */
  profiloIncompleto: boolean;
  /** Piano utente corrente letto da `profiles.piano`: 'base' | 'pro' | 'free_forever'. */
  piano: 'base' | 'pro' | 'free_forever';
  /** true = accesso completo PRO: piano 'pro' oppure 'free_forever' (accesso a vita). */
  hasProAccess: boolean;
  /** Ricarica piano/abbonamento dal DB (modifiche admin senza logout; su focus/timer). */
  refreshProfilo: () => Promise<void>;
  /** Salva/aggiorna i dati anagrafici mancanti (nome/cognome/genere/età) su profiles e nello stato. */
  aggiornaAnagrafica: (d: {
    nome: string;
    cognome: string;
    genere?: 'M' | 'F' | null;
    eta?: number | null;
  }) => Promise<void>;
  authModalOpen: boolean;
  authModalMode: 'login' | 'registrazione';
  /** Contesto della modale Auth: 'pro' = l'utente stava scegliendo un piano a pagamento. */
  authModalCtx: 'default' | 'pro';
  openAuthModal: (mode?: 'login' | 'registrazione', ctx?: 'default' | 'pro') => void;
  closeAuthModal: () => void;
  /** Modal di recupero mostrato dopo un bounce OAuth Google (es. dominio .edu.it bloccato). */
  oauthBounceOpen: boolean;
  openOAuthBounce: () => void;
  closeOAuthBounce: () => void;
  /** Wizard Radar (onboarding a 4 passi): stato + apertura/chiusura. */
  radarWizardOpen: boolean;
  openRadarWizard: () => void;
  closeRadarWizard: () => void;
  /** Vetrina Freemium: modal di conversione per gli utenti non autenticati. */
  vetrinaAperta: boolean;
  vetrinaSezione: string | null;
  openVetrina: (sezione: string) => void;
  closeVetrina: () => void;
  simulaStato: (ruolo: RuoloSimulato) => void;
  resettaTutto: () => void;
  salvaProfilo: (p?: Preferenze) => Promise<void>;
  loginConGoogle: () => Promise<void>;
  /** Consuma 1 credito a consumo (RPC atomica) e aggiorna il saldo nel context. */
  consumaCredito: () => Promise<{ ok: boolean; crediti: number }>;
}

const defaultPreferenze: Preferenze = {
  genere: null,
  eta: null,
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
  const [esami, setEsamiState] = useLocalStorage<Esame[]>('sr_esami', []);
  const [interpelliNotificati, setNotificati] = useLocalStorage<string[]>('sr_notificati', []);

  // FASE 6 — piano e contatori letti da Supabase (non più localStorage)
  const [abbonato, setAbbonato] = useState(false);
  /** Piano letto da profiles.piano: 'base' | 'pro' | 'free_forever'. */
  const [piano, setPiano] = useState<'base' | 'pro' | 'free_forever'>('base');
  const [notificheUsate, setNotificheUsate] = useState(0);
  const [crediti, setCrediti] = useState(0);
  const [supabaseUserId, setSupabaseUserId] = useState<string | null>(null);
  /** Avatar dell'utente (user_metadata.avatar_url / picture, es. login Google). */
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  /** Profilo autenticato senza nome/cognome → serve il mini-onboarding anagrafico. */
  const [profiloIncompleto, setProfiloIncompleto] = useState(false);

  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authModalMode, setAuthModalMode] = useState<'login' | 'registrazione'>('login');
  const [authModalCtx, setAuthModalCtx] = useState<'default' | 'pro'>('default');

  // Wizard Radar (onboarding a 4 passi) — aperto da "ATTIVA IL TUO RADAR".
  const [radarWizardOpen, setRadarWizardOpen] = useState(false);
  const openRadarWizard = useCallback(() => setRadarWizardOpen(true), []);
  const closeRadarWizard = useCallback(() => setRadarWizardOpen(false), []);

  const openAuthModal = useCallback(
    (mode: 'login' | 'registrazione' = 'login', ctx: 'default' | 'pro' = 'default') => {
      setAuthModalMode(mode);
      setAuthModalCtx(ctx);
      setAuthModalOpen(true);
    },
    [],
  );

  const closeAuthModal = useCallback(() => {
    setAuthModalOpen(false);
    setAuthModalCtx('default');
  }, []);

  // Bounce OAuth (dominio scolastico / Google bloccato): modal di recupero.
  const [oauthBounceOpen, setOauthBounceOpen] = useState(false);
  const openOAuthBounce = useCallback(() => setOauthBounceOpen(true), []);
  const closeOAuthBounce = useCallback(() => setOauthBounceOpen(false), []);

  // Vetrina Freemium: modal di conversione per gli utenti non autenticati.
  const [vetrinaAperta, setVetrinaAperta] = useState(false);
  const [vetrinaSezione, setVetrinaSezione] = useState<string | null>(null);
  const openVetrina = useCallback((sezione: string) => {
    setVetrinaSezione(sezione);
    setVetrinaAperta(true);
  }, []);
  const closeVetrina = useCallback(() => setVetrinaAperta(false), []);

  const register = useCallback(
    (u: User) => {
      // Analytics: tentativo di registrazione email.
      track('signup_attempted', { method: 'email' });
      setUser(u);
      // PASSO 3: crea anche l'utente reale su Supabase Auth (non bloccante per la demo).
      if (supabase) {
        // Password demo generata se assente (es. login Google simulato).
        const password = u.password || `Demo!${crypto.randomUUID()}`;
        // Il genere viaggia in user_metadata per la concordanza della email di
        // benvenuto (Benvenuto/Benvenuta) gestita dal trigger auth.users → send-notification.
        void supabase.auth
          .signUp({
            email: u.email,
            password,
            options: {
              data: {
                genere: u.genere ?? '',
                eta: u.eta ?? null,
                nome: u.nome.trim(),
                cognome: u.cognome.trim(),
              },
            },
          })
          .then(({ error }) => {
          if (error && !/already registered/i.test(error.message)) {
            console.warn('Supabase signUp:', error.message);
          } else {
            // Account creato (o già registrato, in tal caso si riallaccia alla sessione).
            track('signup_success', { method: 'email' });
          }
        });
      } else {
        // Modalità demo (Supabase non configurato): la registrazione è locale e immediata.
        track('signup_success', { method: 'email', demo: true });
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
    setPiano('base');
    setCrediti(0);
    setSupabaseUserId(null);
    setEsamiState([]);
    setNotificati([]);
  }, [setUser, setPref, setNotificheUsate, setAbbonato, setPiano, setCrediti, setSupabaseUserId, setEsamiState, setNotificati]);

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
      // FASE 6 — contatore server-side via RPC (se l'utente è autenticato su Supabase)
      if (supabaseUserId) {
        void supabase?.rpc('incrementa_notifiche_utente', { p_user_id: supabaseUserId }).then(
          ({ data, error }) => {
            if (!error && Array.isArray(data) && data[0]) {
              setNotificheUsate(Number(data[0].notifiche_usate));
            }
          },
        );
      } else if (!abbonato) {
        // modalità demo (Supabase non configurato): comportamento locale di backup
        setNotificheUsate((n) => Math.min(n + 1, 3));
      }
    },
    [supabaseUserId, abbonato, setNotificati],
  );

  /** Salva il piano scelto da un utente non autenticato (ripresa checkout dopo il login). */
  const salvaIntendedPlan = useCallback((piano: PianoId, promo?: string, quantita?: number) => {
    try {
      localStorage.setItem(STORAGE_KEY_INTENDED_PLAN, piano);
      if (promo || quantita !== undefined) {
        localStorage.setItem(
          STORAGE_KEY_INTENDED_PLAN_DATA,
          JSON.stringify({ promo: promo ?? '', quantita: quantita ?? 1 }),
        );
      } else {
        localStorage.removeItem(STORAGE_KEY_INTENDED_PLAN_DATA);
      }
    } catch {
      // localStorage non disponibile: si ripiega sul flusso standard (modal di Auth)
    }
  }, []);

  /** Lock anti-concorrenza per avviaCheckout: evita doppie sessioni / doppie schede Stripe. */
  const checkoutInCorsoRef = useRef(false);

  /** FASE 6 — avvia il checkout Stripe per il piano richiesto e redirige l'utente. */
  const avviaCheckout = useCallback(
    async (plan: PianoId, promo?: string, quantita?: number): Promise<{ ok: boolean; errore?: string }> => {
      // Guardia ANTI-DOPPIO-OPEN: se un checkout è già in volo (doppio click rapido,
      // doppio trigger, oppure ripresa post-login sovrapposta a un click manuale),
      // ignora la seconda chiamata → UNA sola scheda Stripe per azione utente.
      if (checkoutInCorsoRef.current) {
        console.warn('avviaCheckout — chiamata ignorata: checkout già in corso.');
        return { ok: false, errore: 'Un pagamento è già in corso. Controlla le schede aperte.' };
      }
      checkoutInCorsoRef.current = true;
      try {
      // Analytics: inizializzazione checkout (click "Diventa PRO" / ripresa piano).
      track('checkout_started', { plan, promo: promo || '', quantita: quantita ?? 1 });
      if (!supabase) {
        return {
          ok: false,
          errore:
            'Pagamenti non disponibili: mancano VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY nel file .env. Riavvia il dev server dopo averle aggiunte.',
        };
      }
      // Il checkout richiede un utente autenticato su Supabase Auth (JWT nella richiesta).
      const { data: sessione } = await supabase.auth.getSession();
      if (!sessione.session) {
        // Utente non autenticato: salva il piano come "intended plan" così al termine del
        // login/registrazione il checkout ripartirà da solo (niente loop sul modal di Auth).
        salvaIntendedPlan(plan, promo, quantita);
        openAuthModal('login');
        return { ok: false, errore: 'Accedi al tuo account per procedere al pagamento.' };
      }
      // Normalizza il codice promo (es. BETA1ANNO) prima di inviarlo alla Edge Function:
      // la mappatura al Coupon ID è server-side (STRIPE_COUPON_BETA1ANNO).
      const promoNorm = promo ? promo.toUpperCase().replace(/[^A-Z0-9]/g, '') : undefined;
      const { data, error } = await supabase.functions.invoke('checkout', {
        body: {
          plan,
          promo: promoNorm,
          quantita,
          // URL di ritorno dinamici: la Edge Function usa questa origin
          // (mai un fallback rigido su localhost).
          origin: window.location.origin,
        },
      });
      if (error) {
        // Log COMPLETO: errore SDK e payload ricevuto dalla Edge Function
        console.error('Checkout SDK error (oggetto intero):', error);
        console.error('Checkout — data ricevuti dalla Edge Function:', JSON.stringify(data));
        // Estrai il messaggio esatto restituito dalla Edge Function/Stripe (per il toast).
        let msgServer: string | undefined;
        const corpo = data as { error?: string | { message?: string } } | null;
        if (typeof corpo?.error === 'string') {
          msgServer = corpo.error;
        } else if (corpo?.error && typeof corpo.error === 'object') {
          msgServer = (corpo.error as { message?: string }).message;
        }
        // Se `data` è null, prova a leggere il body della Response HTTP esposta dall'SDK.
        if (!msgServer) {
          const ctx = (error as { context?: Response }).context;
          if (ctx) {
            try {
              const parsed = (await ctx.clone().json()) as {
                error?: string | { message?: string };
              } | null;
              msgServer =
                typeof parsed?.error === 'string' ? parsed.error : parsed?.error?.message;
            } catch {
              // corpo non JSON: ignorato
            }
          }
        }
        return {
          ok: false,
          errore:
            msgServer ??
            `Impossibile avviare il pagamento (${(error as Error).message}). Controlla la connessione e riprova.`,
        };
      }
      const payload = data as { success?: boolean; url?: string; error?: string } | null;
      if (!payload?.url || payload.success === false) {
        console.error(
          'Checkout senza URL — payload ricevuto dalla Edge Function:',
          JSON.stringify(data),
        );
        return {
          ok: false,
          errore: payload?.error ?? 'La sessione di pagamento non è stata creata. Riprova.',
        };
      }
      // STRICT redirect: il checkout Stripe si apre SEMPRE in una NUOVA scheda (_blank),
      // mantenendo l'app ScuoleRadar aperta e attiva nel tab principale.
      // `window.location.href` NON è mai un fallback "diretto": scatta solo nel caso
      // specifico di popup bloccato dal browser (window.open → null) oppure dentro un
      // vero catch block (ambienti restrittivi che lanciano un'eccezione su window.open).
      // NB: NON passare 'noopener,noreferrer' come features string: il token `noopener`
      // fa restituire null a window.open ANCHE a scheda aperta correttamente (il fallback
      // scatterebbe sempre). Apriamo senza features e azzeriamo opener a mano.
      // Questo blocco è il funnel UNICO di tutti i trigger checkout: "Passa a PRO Annuale"
      // (PrezziPage), VetrinaModal, ServiziPaywall/AbbonamentoModal e ripresa post-login.
      try {
        const stripeTab = window.open(payload.url, '_blank');
        if (stripeTab) {
          // Security best practice: la nuova scheda non ha handle sulla finestra chiamante.
          stripeTab.opener = null;
        } else {
          // Popup bloccato dal browser: SOLO in questo caso specifico naviga il tab corrente.
          window.location.href = payload.url;
        }
      } catch {
        // Vero catch block: mai lasciare l'utente a metà, apriamo nel tab corrente.
        window.location.href = payload.url;
      }
      return { ok: true };
      } catch (err) {
        // Mai lasciare una Promise rifiutata: errori di rete/CORS/SDK vengono gestiti e
        // mostrati al chiamante (toast in PrezziPage) invece di restare silenziosi.
        console.error('avviaCheckout — errore non gestito:', err);
        return {
          ok: false,
          errore: (err as Error)?.message ?? 'Errore imprevisto durante il checkout. Riprova.',
        };
      } finally {
        // Rilascia il lock: la scheda Stripe è già stata aperta (window.open è sincrono)
        // oppure l'operazione è terminata — un nuovo click può ripartire in modo pulito.
        checkoutInCorsoRef.current = false;
      }
    },
    [openAuthModal, salvaIntendedPlan],
  );

  // Stato simulato per la DevToolbar (solo sviluppo). Aggiorna all'istante context + UI.
  const simulaStato = useCallback(
    (ruolo: RuoloSimulato) => {
      if (ruolo === 'guest') {
        setUser(null);
        setPref(defaultPreferenze);
        setNotificheUsate(0);
        setAbbonato(false);
        setPiano('base');
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
      setPiano(ruolo === 'pro' ? 'pro' : 'base');
      setNotificheUsate(0);
      setPref((prev) => ({
        ...prev,
        ordini: prev.ordini.length > 0 ? prev.ordini : ['secondaria1', 'secondaria2'],
        provinceCodici:
          prev.provinceCodici.length > 0 ? prev.provinceCodici : ['RM', 'TO', 'MI', 'NA'],
        onboarded: true,
      }));
    },
    [setUser, setPref, setNotificheUsate, setAbbonato, setPiano],
  );

  const resettaTutto = useCallback(() => {
    ['sr_user', 'sr_preferenze', 'sr_esami', 'sr_notificati'].forEach((k) =>
      localStorage.removeItem(k),
    );
    setUser(null);
    setPref(defaultPreferenze);
    setNotificheUsate(0);
    setAbbonato(false);
    setPiano('base');
    setCrediti(0);
    setSupabaseUserId(null);
    setEsamiState([]);
    setNotificati([]);
  }, [setUser, setPref, setNotificheUsate, setAbbonato, setPiano, setCrediti, setSupabaseUserId, setEsamiState, setNotificati]);

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
      const genereFinale = (p?.genere ?? preferenze.genere ?? user?.genere) ?? null;
      const etaFinale = (p?.eta ?? preferenze.eta ?? user?.eta) ?? null;
      const { error } = await supabase
        .from('profiles')
        .upsert(
          {
            id: authUser.id,
            email: authUser.email ?? dati.emailNotifica,
            genere: genereFinale,
            eta: etaFinale,
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
    [preferenze, user],
  );

  /**
   * Avvia Google OAuth con redirect diretto all'URL generato da Supabase (niente One Tap).
   * Il redirect di ritorno usa SEMPRE window.location.origin (mai un fallback rigido su
   * localhost): deve però essere incluso nei Site URL / Redirect URLs configurati nel
   * Supabase Dashboard (Auth → URL Configuration) per l'ambiente in uso.
   */
  const loginConGoogle = useCallback(async () => {
    if (!supabase) return;

    // Analytics: avvio del flusso Google OAuth (login o registrazione).
    track('signin_google_started');

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
  }, []);

  /** Consuma 1 credito a consumo (RPC atomica server-side) e aggiorna il saldo. */
  const consumaCredito = useCallback(async () => {
    if (!supabase || !supabaseUserId) return { ok: false, crediti: crediti };
    const { data, error } = await supabase.rpc('consuma_credito_utente', {
      p_user_id: supabaseUserId,
    });
    if (error) {
      console.error('consumaCredito:', error.message);
      return { ok: false, crediti: crediti };
    }
    const riga =
      Array.isArray(data) && data.length > 0
        ? (data[0] as { ok?: boolean; crediti?: number })
        : null;
    if (riga?.ok) setCrediti(Number(riga.crediti));
    return { ok: Boolean(riga?.ok), crediti: Number(riga?.crediti ?? crediti) };
  }, [supabaseUserId, crediti]);

  /**
   * Verifica su profiles se nome/cognome sono compilati: alimenta il flag
   * `profiloIncompleto` che fa scattare il mini-onboarding anagrafico.
   */
  const valutaProfiloIncompleto = useCallback(async (userId: string): Promise<void> => {
    if (!supabase) {
      setProfiloIncompleto(false);
      return;
    }
    const { data, error } = await supabase
      .from('profiles')
      .select('nome, cognome')
      .eq('id', userId)
      .maybeSingle();
    if (error) {
      console.warn('Verifica anagrafica profilo non riuscita:', error.message);
      setProfiloIncompleto(false);
      return;
    }
    const nome = String((data as { nome?: string | null } | null)?.nome ?? '').trim();
    const cognome = String((data as { cognome?: string | null } | null)?.cognome ?? '').trim();
    setProfiloIncompleto(!nome || !cognome);
  }, []);

  /** Salva i dati anagrafici sul profilo (profiles) e aggiorna lo stato locale. */
  const aggiornaAnagrafica = useCallback(
    async (d: { nome: string; cognome: string; genere?: 'M' | 'F' | null; eta?: number | null }): Promise<void> => {
      if (!supabase) throw new Error('Supabase non configurato (modalità demo).');
      const { data: sess, error: errSess } = await supabase.auth.getUser();
      if (errSess || !sess.user) throw new Error('Sessione non attiva: effettua il login.');
      const nome = d.nome.trim();
      const cognome = d.cognome.trim();
      const { error } = await supabase.from('profiles').upsert(
        {
          id: sess.user.id,
          email: sess.user.email ?? '',
          nome,
          cognome,
          genere: d.genere ?? null,
          eta: d.eta ?? null,
        },
        { onConflict: 'id' },
      );
      if (error) throw error;
      setUser((prev) =>
        prev
          ? { ...prev, nome, cognome, genere: d.genere ?? null, eta: d.eta ?? null }
          : { nome, cognome, genere: d.genere ?? null, eta: d.eta ?? null, email: sess.user.email ?? '', password: '' },
      );
      setPref((prev) => ({ ...prev, genere: d.genere ?? null, eta: d.eta ?? null }));
      setProfiloIncompleto(false);
    },
    [setUser, setPref],
  );

  /**
   * Ricarica piano/abbonamento e contatori direttamente da `profiles`.
   * Usata per riflettere subito le modifiche fatte dal Pannello Admin sul piano
   * (es. passaggio a 'free_forever') senza richiedere logout/login.
   */
  const refreshProfilo = useCallback(async (): Promise<void> => {
    if (!supabase) return;
    const { data: sess } = await supabase.auth.getUser();
    if (!sess.user) {
      console.warn('[refreshProfilo] nessun utente autenticato nella sessione attiva.');
      return;
    }
    console.log('[refreshProfilo] utente attivo →', { id: sess.user.id, email: sess.user.email ?? '' });
    const { data, error } = await supabase
      .from('profiles')
      .select('piano, abbonamento_scade_il, crediti, notifiche_usate')
      .eq('id', sess.user.id)
      .maybeSingle();
    if (error || !data) {
      console.warn('[refreshProfilo] query profiles (per id) fallita:', {
        userId: sess.user.id,
        email: sess.user.email ?? '',
        error: error?.message ?? 'nessuna riga profilo trovata',
      });
      return;
    }
    // Diagnostica: mostra la riga grezza restituita dal DB.
    console.log('[refreshProfilo] riga profiles (per id) →', data);
    const periodoOk = !data.abbonamento_scade_il || new Date(data.abbonamento_scade_il) > new Date();
    const pianoGratuitoVita = data.piano === 'free_forever';
    // Normalizzazione: qualsiasi valore non riconosciuto cade su 'base'.
    const pianoCorrente: 'base' | 'pro' | 'free_forever' =
      data.piano === 'pro' || data.piano === 'free_forever' ? data.piano : 'base';
    setPiano(pianoCorrente);
    setAbbonato(pianoCorrente !== 'base' && (pianoGratuitoVita || periodoOk));
    setCrediti(Number(data.crediti ?? 0));
    setNotificheUsate(Number(data.notifiche_usate ?? 0));
  }, [setAbbonato, setCrediti, setNotificheUsate, setPiano]);

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
        const metaAu = (au.user_metadata ?? {}) as Record<string, unknown>;
        setAvatarUrl(String(metaAu.avatar_url ?? metaAu.picture ?? '').trim() || null);
        const { data, error } = await supabase
          .from('profiles')
          .select('province_attive, province_interesse, classi_concorso, ordini_scuola, telegram_chat_id, piano, abbonamento_scade_il, crediti, notifiche_usate, favorite_schools, ignored_schools')
          .eq('id', au.id)
          .maybeSingle();
        // Diagnostica caricamento profilo: id/email sessione + riga grezza restituita dal DB.
        console.log('[profilo] auth →', { id: au.id, email: au.email ?? '' });
        if (error) console.warn('[profilo] query profiles (per id) fallita:', error.message);
        if (data) console.log('[profilo] riga profiles →', data);
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
          // FASE 6 — piano e scadenza letti dalle colonne REALI di profiles.
          // NB: NON si selezionano più subscription_status / current_period_end
          // (assenti nello schema): prima quell'errore invalidava l'intero
          // caricamento del profilo e il piano restava su 'base'.
          const pianoCorrente: 'base' | 'pro' | 'free_forever' =
            data.piano === 'pro' || data.piano === 'free_forever' ? data.piano : 'base';
          const periodoOk =
            !data.abbonamento_scade_il || new Date(data.abbonamento_scade_il) > new Date();
          // Piano Free Forever: accesso PRO permanente — mai soggetto a scadenza
          // di pagamento; per gli altri piani casca automaticamente su base.
          const pianoGratuitoVita = data.piano === 'free_forever';
          setPiano(pianoCorrente);
          setAbbonato(pianoCorrente !== 'base' && (pianoGratuitoVita || periodoOk));
          setCrediti(Number(data.crediti ?? 0));
          setNotificheUsate(Number(data.notifiche_usate ?? 0));
        }
        // Mini-onboarding anagrafico: profilo senza nome/cognome?
        void valutaProfiloIncompleto(au.id);
      } catch (err) {
        if (attivo) setLoading(false);
        console.warn('Caricamento profilo da Supabase non riuscito:', (err as Error).message);
      }
    })();
    return () => {
      attivo = false;
    };
  }, [setPref, valutaProfiloIncompleto]);

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
        const meta = (session.user.user_metadata ?? {}) as Record<string, unknown>;
        // Avatar Google OAuth: avatar_url (o picture come fallback) in user_metadata.
        setAvatarUrl(String(meta.avatar_url ?? meta.picture ?? '').trim() || null);
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
            .then(() => {
              void valutaProfiloIncompleto(session.user.id);
              void refreshProfilo();
            });
        } else {
          // INITIAL_SESSION: la riga profilo esiste già (trigger auth.users) → verifica anagrafica.
          void valutaProfiloIncompleto(session.user.id);
        }
      }
      if (event === 'SIGNED_OUT') {
        setUser(null);
        setSupabaseUserId(null);
        setAvatarUrl(null);
        setProfiloIncompleto(false);
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

  // Wizard Radar in attesa: se un utente NON autenticato ha cliccato "ATTIVA IL TUO RADAR",
  // al termine di login/registrazione si apre automaticamente il wizard di onboarding.
  useEffect(() => {
    const pending = localStorage.getItem(STORAGE_KEY_RADAR_WIZARD_PENDING);
    if (pending !== '1') return;
    if (!user && !supabaseUserId) return;
    try {
      localStorage.removeItem(STORAGE_KEY_RADAR_WIZARD_PENDING);
    } catch {
      // localStorage non disponibile
    }
    openRadarWizard();
  }, [user, supabaseUserId, openRadarWizard]);

  // FASE 7 — Ripresa automatica del checkout ("intended plan").
  // Se un utente anonimo aveva scelto un piano prima del login, appena la sessione
  // Supabase è disponibile si riprende il checkout per quel piano (localStorage).
  useEffect(() => {
    if (!supabaseUserId) return;
    let piano = '';
    try {
      piano = localStorage.getItem(STORAGE_KEY_INTENDED_PLAN) ?? '';
    } catch {
      return;
    }
    if (!piano) return;

    try {
      localStorage.removeItem(STORAGE_KEY_INTENDED_PLAN);
    } catch {
      // ignore
    }
    let promo: string | undefined;
    let quantita = 1;
    try {
      const raw = localStorage.getItem(STORAGE_KEY_INTENDED_PLAN_DATA);
      localStorage.removeItem(STORAGE_KEY_INTENDED_PLAN_DATA);
      if (raw) {
        const dati = JSON.parse(raw) as { promo?: string; quantita?: number };
        if (dati.promo) promo = dati.promo;
        if (typeof dati.quantita === 'number') quantita = dati.quantita;
      }
    } catch {
      // payload non valido: si procede con quantità 1 e senza promo
    }

    void avviaCheckout(piano as PianoId, promo, quantita);
  }, [supabaseUserId, avviaCheckout]);

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

  /** Entitlement globale: accesso PRO completo con piano 'pro' oppure 'free_forever'. */
  const hasProAccess = piano === 'pro' || piano === 'free_forever';

  const value: AppContextValue = {
    user,
    preferenze,
    notificheUsate,
    abbonato,
    piano,
    hasProAccess,
    crediti,
    esami,
    interpelliNotificati,
    register,
    login,
    logout,
    setPreferenze,
    completaOnboarding,
    incrementaNotifica,
    avviaCheckout,
    setEsami,
    interpelliFiltrati,
    origineDati,
    loading,
    supabaseUserId,
    avatarUrl,
    profiloIncompleto,
    aggiornaAnagrafica,
    refreshProfilo,
    authModalOpen,
    authModalMode,
    authModalCtx,
    openAuthModal,
    closeAuthModal,
    oauthBounceOpen,
    openOAuthBounce,
    closeOAuthBounce,
    radarWizardOpen,
    openRadarWizard,
    closeRadarWizard,
    vetrinaAperta,
    vetrinaSezione,
    openVetrina,
    closeVetrina,
    simulaStato,
    resettaTutto,
    salvaProfilo,
    loginConGoogle,
    consumaCredito,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
