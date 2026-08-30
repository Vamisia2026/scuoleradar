import { useGoogleOneTap } from '@/hooks/useGoogleOneTap';

/**
 * Componente renderless: attiva Google One Tap per i visitatori non autenticati
 * sulle pagine di ingresso. Il prompt viene gestito da Google (in alto a destra);
 * il token risultante viene scambiato con una sessione Supabase.
 */
export function GoogleOneTap() {
  useGoogleOneTap();
  return null;
}