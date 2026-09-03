/** Tipi condivisi del Pannello Admin (refactor). */

export interface AdminUtente {
  id: string;
  email: string;
  nome: string | null;
  cognome: string | null;
  genere?: string | null;
  /** Età in anni (colonna opzionale profiles.eta). */
  eta?: number | null;
  piano?: string | null;
  /** Dettaglio piano PRO: 'mensile' | 'annuale' (colonna opzionale pro_tipo). */
  pro_tipo?: string | null;
  abbonamento_scade_il?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  onboarded?: boolean | null;
  is_beta_tester?: boolean | null;
  referral_code?: string | null;
  telegram_chat_id?: string | null;
  telegram_username?: string | null;
  telegram?: string | null;
  province_interesse?: string[] | null;
  province_attive?: string[] | null;
  classi_concorso?: string[] | null;
  materie_id?: string[] | null;
  ordini_scuola?: string[] | null;
  favorite_schools?: string[] | null;
  ignored_schools?: string[] | null;
  crediti?: number | null;
  notifiche_usate?: number | null;
  // Campi "opzionali/estesi" che potrebbero non esistere nel DB attuale.
  telefono?: string | null;
  login_type?: string | null;
  radar_attivo?: boolean | null;
  coupon_codice?: string | null;
  coupon_tipo?: string | null;
  coupon_usato_il?: string | null;
  referrer_id?: string | null;
  referrer_email?: string | null;
  referral_status?: string | null;
  [campo: string]: unknown;
}

export interface AdminOpportunita {
  id: string;
  title: string;
  province: string | null;
  class_codes?: string[] | null;
  school_name?: string | null;
  source_url?: string | null;
  expiration_date?: string | null;
  hash_id?: string | null;
  created_at?: string | null;
}

export type TabAdmin = 'utenti' | 'radar' | 'account';

/**
 * Chiave sessionStorage usata dal flusso "Accedi con Google" del pannello admin:
 * dopo il ritorno dall'OAuth l'app reindirizza automaticamente su /admin.
 */
export const STORAGE_KEY_ADMIN_REDIRECT = 'sr_admin_redirect';

/** Lista di base: email consentite per l'accesso admin. */
export const ADMIN_EMAILS = ['bartoloansaldi@gmail.com', 'myvamisia@gmail.com'];

export function etichettaPiano(piano?: string | null): string {
  if (piano === 'free_forever') return 'Free Forever';
  if (piano === 'pro') return 'PRO';
  return 'Base';
}

export function dataItaliana(data?: string | null): string {
  if (!data) return '—';
  const d = new Date(data);
  if (Number.isNaN(d.getTime())) return data;
  return d.toLocaleDateString('it-IT');
}

/** Colore badge del piano (Base / PRO / Free Forever). */
export function classePiano(piano?: string | null): string {
  if (piano === 'pro') return 'bg-accent-100 text-accent-700';
  if (piano === 'free_forever') return 'bg-secondary-100 text-secondary-700';
  return 'bg-primary-100 text-primary-600';
}
