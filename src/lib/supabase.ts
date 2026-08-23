import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/**
 * Client Supabase per il frontend (chiave ANON pubblica).
 * Richiede VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY nel file `.env`.
 * Se non configurato (valori vuoti/placeholder), `supabase` è `null`
 * e l'app resta in modalità demo (localStorage).
 */
export const supabase: SupabaseClient | null =
  url && anonKey && !url.includes('xxxx') && !anonKey.includes('xxxx')
    ? createClient(url, anonKey)
    : null;

export const isSupabaseConfigurato = supabase !== null;
