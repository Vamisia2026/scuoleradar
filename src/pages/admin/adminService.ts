/** Livello dati del Pannello Admin: chiamate all'Edge `admin` + fallback demo locale. */
import { supabase } from '@/lib/supabase';
import type { AdminOpportunita, AdminUtente } from './types';

export const DEV = import.meta.env.DEV === true;

/** Errore applicativo tipizzato lanciato verso la UI. */
export class AdminApiError extends Error {
  constructor(message: string, readonly raw?: unknown) {
    super(message);
  }
}

/** Token di sessione se l'admin è autenticato via Supabase (null = demo/ospite). */
export async function tokenAdmin(): Promise<string | null> {
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

async function chiamaAdmin<T>(action: string, payload?: Record<string, unknown>): Promise<T> {
  if (!supabase) throw new AdminApiError('Supabase non configurato (modalità demo).');
  const { data, error } = await supabase.functions.invoke('admin', {
    body: { action, payload: payload ?? {} },
  });
  if (error) {
    const messaggio =
      (error as { message?: string }).message ??
      "Errore admin — verifica che la edge function 'admin' sia deployata.";
    throw new AdminApiError(messaggio);
  }
  const res = data as { ok?: boolean; error?: string } | null;
  if (!res?.ok) throw new AdminApiError(res?.error ?? 'Errore admin.');
  return data as T;
}

export async function caricaUtenti(): Promise<AdminUtente[]> {
  const token = await tokenAdmin();
  if (!token) return caricaDemo();
  const ris = await chiamaAdmin<{ utenti: AdminUtente[] }>('list_users_full');
  return ris.utenti ?? [];
}

export async function caricaOpportunita(): Promise<AdminOpportunita[]> {
  const token = await tokenAdmin();
  if (!token) return [];
  const ris = await chiamaAdmin<{ opportunita?: AdminOpportunita[] }>('list_opportunities');
  return (ris as { data?: AdminOpportunita[] }).data ?? ris.opportunita ?? [];
}

export async function aggiornaUtente(id: string, updates: Record<string, unknown>): Promise<void> {
  const token = await tokenAdmin();
  if (!token) {
    console.warn('Demo admin: modifica non persistita.', { id, updates });
    return;
  }
  await chiamaAdmin<{ ok: boolean }>('update_user', { id, updates });
}

export async function inviaResetPassword(email: string): Promise<void> {
  const token = await tokenAdmin();
  if (!token) {
    throw new AdminApiError('Richiede sessione Supabase attiva (azioni reali).');
  }
  await chiamaAdmin<{ ok: boolean }>('reset_password', { email });
}

export interface NuovoUtenteInput {
  email: string;
  password: string;
  nome?: string;
  cognome?: string;
  telefono?: string;
  piano?: string;
  /** 'mensile' | 'annuale' quando il piano scelto è PRO. */
  proTipo?: 'mensile' | 'annuale' | null;
  /** true = profilo contrassegnato come Beta Tester. */
  isBetaTester?: boolean;
}

/** Crea un nuovo account (auth + profilo) tramite l'Edge admin. */
export async function creaUtente(input: NuovoUtenteInput): Promise<string> {
  const token = await tokenAdmin();
  if (!token) throw new AdminApiError('Richiede sessione Supabase attiva (creazione reale).');
  const ris = await chiamaAdmin<{ id?: string }>('create_user', { ...input });
  return ris.id ?? '';
}

/** Eliminazione DEFINITIVA dell'utente (auth.users + profilo in cascata). */
export async function eliminaUtente(id: string): Promise<void> {
  const token = await tokenAdmin();
  if (!token) throw new AdminApiError('Richiede sessione Supabase attiva (eliminazione reale).');
  await chiamaAdmin<{ ok: boolean }>('delete_user', { id });
}

export async function aggiornaOpportunita(
  id: string,
  updates: Record<string, unknown>,
): Promise<void> {
  const token = await tokenAdmin();
  if (!token) throw new AdminApiError('Sessione Supabase non attiva.');
  await chiamaAdmin<{ ok: boolean }>('update_opportunity', { id, updates });
}

export async function eliminaOpportunita(id: string): Promise<void> {
  const token = await tokenAdmin();
  if (!token) throw new AdminApiError('Sessione Supabase non attiva.');
  await chiamaAdmin<{ ok: boolean }>('delete_opportunity', { id });
}

export async function inviaNotificaOpportunita(id: string): Promise<{ inviati: number }> {
  const token = await tokenAdmin();
  if (!token) throw new AdminApiError('Sessione Supabase non attiva.');
  const ris = await chiamaAdmin<{ inviati: number }>('dispatch_opportunity', { id });
  return { inviati: ris.inviati ?? 0 };
}

/* ------------------------- Demo locale (Sviluppo) ------------------------- */

/** Utenti fittizi per il Pannello Admin in sviluppo senza sessione Supabase. */
function caricaDemo(): AdminUtente[] {
  const ora = new Date().toISOString();
  return [
    {
      id: '97ca850c-2237-431c-a75c-25cc2e3499c0',
      email: 'bartoloansaldi@gmail.com',
      nome: 'Bartolo',
      cognome: 'Ansaldi',
      piano: 'base',
      created_at: '2026-08-31T00:17:19Z',
      onboarded: true,
      referral_code: 'BARTOLOANSALDI',
      province_interesse: ['AT', 'TO'],
      classi_concorso: ['A-22', 'ADEE'],
      materie_id: ['MATEMATICA'],
      telegram_chat_id: '123456789',
      telegram_username: '@bartoloansaldi',
      favorite_schools: [],
      ignored_schools: [],
      radar_attivo: true,
      login_type: 'google',
    },
    {
      id: '7e78094c-ef48-49f0-a877-deaf920dc886',
      email: 'bisonproductions@gmail.com',
      nome: 'Bison',
      cognome: 'Productions',
      piano: 'base',
      created_at: '2026-09-01T10:00:00Z',
      onboarded: false,
      referral_code: 'BISONPRODUCTIONS',
      province_interesse: ['RM'],
      classi_concorso: [],
      materie_id: [],
      telegram_chat_id: null,
      telegram_username: '',
      telefono: '',
      favorite_schools: [],
      ignored_schools: [],
      radar_attivo: false,
      login_type: 'google',
    },
  ].map((u) => ({ ...u, _demo: true, creato_demo: ora }));
}
