/**
 * Contesto App · tipi e costanti pubblici del contesto.
 *
 * Estratti da `AppContext.tsx`, che li ri-esporta: i consumatori continuano a
 * importarli da `@/contexts/AppContext` senza cambiare una riga.
 */
import type { Interpello } from '@/data/interpelli';
import type { OrdineScuola } from '@/data/ordiniMaterie';
import type { PianoId } from '@/lib/pricing';

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
  /** Provincia di RESIDENZA (codice, es. 'RM') — facoltativa: persiste su `profiles.provincia`. */
  provincia?: string | null;
  email: string;
  // password stored only for demo; never do this in production
  password: string;
}

export interface Preferenze {
  /** Genere dichiarato (Uomo/Donna → M/F): persiste su profiles.genere. */
  genere?: 'M' | 'F' | null;
  /** Età in anni (opzionale): persiste su profiles.eta. */
  eta?: number | null;
  /** Provincia di residenza (codice, es. 'RM'): persiste su profiles.provincia. */
  provincia?: string | null;
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
  /**
   * SOSTEGNO (special education): true = includi anche le opportunità di sostegno
   * (ADAA/ADEE/ADMM/ADSS) nel Radar. Default FALSE: senza adesione gli avvisi di
   * sostegno non vengono notificati, così non arrivano più a chi non è abilitato
   * (falso positivo storico: docente di tedesco → interpelli ADEE).
   * Persiste su `profiles.sostegno`. Una classe di sostegno già selezionata tra le
   * preferenze vale come adesione implicita (nessuno perde copertura).
   */
  sostegno?: boolean;
}

export interface Esame {
  id: string;
  materia: string;
  cfu: number;
  settore: string;
}

/** Ruoli simulabili dalla DevToolbar (solo ambiente di sviluppo) */
export type RuoloSimulato = 'guest' | 'base' | 'pro';

export interface AppState {
  user: User | null;
  preferenze: Preferenze;
  notificheUsate: number;
  abbonato: boolean;
  /** Crediti A la Carte disponibili (FASE 6) */
  crediti: number;
  esami: Esame[];
  interpelliNotificati: string[]; // ids
}

export interface AppContextValue extends AppState {
  /**
   * Registrazione account: crea l'utente su Supabase Auth (quando configurato) e
   * riporta l'esito — gli errori (email già registrata, password debole, rate
   * limit) vanno mostrati nel form, non ignorati. In modalità demo è locale e
   * immediata ({ ok: true }).
   */
  register: (u: User) => Promise<{ ok: boolean; errore?: string }>;
  login: (email: string, password: string) => boolean;
  /**
   * Login email REALE via Supabase Auth (signInWithPassword).
   * Usato dal modal di login: restituisce un errore IT "actionabile" invece di
   * fallire in silenzio (es. "Credenziali non valide", "Account non ancora attivato").
   * In modalità demo (supabase === null) ricade sul confronto localStorage.
   */
  loginSupabase: (
    email: string,
    password: string,
  ) => Promise<{ ok: boolean; errore?: string; code?: string }>;
  /**
   * Accesso LOCALE immediato (senza sessione Supabase): usato dal pannello admin
   * quando un indirizzo autorizzato supera il check password di ambiente
   * (VITE_ADMIN_PASSWORD) o la demo DEV. NON crea né attiva account su Supabase
   * (a differenza di `register`): allinea solo lo stato locale per la UI.
   */
  accediDemo: (email: string) => void;
  logout: () => void;
  setPreferenze: (p: Partial<Preferenze>) => void;
  completaOnboarding: (p: Partial<Preferenze>) => void;
  incrementaNotifica: (interpelloId: string) => void;
  avviaCheckout: (plan: PianoId, promo?: string, quantita?: number) => Promise<{ ok: boolean; errore?: string }>;
  setEsami: (e: Esame[]) => void;
  interpelliFiltrati: Interpello[];
  origineDati: 'vuoto' | 'supabase';
  loading: boolean;
  /** id dell'utente Supabase Auth con sessione attiva (null = non autenticato). */
  supabaseUserId: string | null;
  /** Avatar (URL) dell'utente autenticato da user_metadata (es. Google OAuth). */
  avatarUrl: string | null;
  /** true se il profilo (tabella profiles) manca di nome o cognome: i dati anagrafici vanno completati. */
  profiloIncompleto: boolean;
  /** Piano utente corrente letto da `profiles.piano`: 'base' | 'pro' | 'free_forever'. */
  piano: 'base' | 'pro' | 'free_forever';
  /**
   * Stato di caricamento del piano: 'loading' finché non c'è conferma dal DB
   * (o dalla modalità demo). UI: il badge deve mostrare un indicatore di
   * caricamento, MAI degradare a 'Base' per un valore non ancora letto.
   */
  pianoStato: 'loading' | 'pronto';
  /** true = accesso completo PRO: piano 'pro' oppure 'free_forever' (accesso a vita). */
  hasProAccess: boolean;
  /** true = il piano PRO in corso è la prova gratuita di 30 giorni (stato 'trialing'). */
  trialAttivo: boolean;
  /** Fine della prova PRO (ISO) se trialAttivo, altrimenti null. */
  trialScadenza: string | null;
  /** Ricarica piano/abbonamento dal DB (modifiche admin senza logout; su focus/timer). */
  refreshProfilo: () => Promise<void>;
  /** Radar attivo: true = invia notifiche; false = "in pausa" (preferenze conservate). */
  radarAttivo: boolean;
  /** Imposta radar_attivo su profiles (senza perdere province/classi/preferenze). */
  aggiornaRadarAttivo: (attivo: boolean) => Promise<void>;
  /** Concede la prova PRO gratuita di 30 giorni (trial sponsorizzato PureFocus) se il piano è ancora Base. */
  attivaTrialPro: () => Promise<void>;
  /** Salva/aggiorna i dati anagrafici mancanti (nome/cognome/genere/età/provincia) su profiles e nello stato. */
  aggiornaAnagrafica: (d: {
    nome: string;
    cognome: string;
    genere?: 'M' | 'F' | null;
    eta?: number | null;
    provincia?: string | null;
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
  /** PRO-Gift "Sorpresa" (SoftOnboarding): MAI automatico, si apre solo da CTA esplicita. */
  softOnboardingOpen: boolean;
  openSoftOnboarding: () => void;
  closeSoftOnboarding: () => void;
  /**
   * Entry point UNICO delle CTA "Attiva il tuo Radar" / tentativi di setup Radar:
   * per gli utenti Base senza regole apre prima il PRO-Gift (poi il wizard),
   * in ogni altro caso apre direttamente il wizard RadarWizardModal.
   */
  openRadarSetup: () => void;
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