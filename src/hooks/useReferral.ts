import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

export interface ReferralStats {
  totaleUsi: number;
  completati: number;
  ricompenseTotali: number;
}

export interface ReferralEntry {
  id: string;
  discount_applied: number;
  reward_amount: number;
  status: 'pending' | 'completed';
  created_at: string;
}

/**
 * Hook del programma "Invita un Collega" & Affiliazione.
 * Legge il codice promo dell'utente, le statistiche anonime dei referral
 * e permette di modificare il codice con validazione di unicità in tempo reale.
 * (Isolato: non tocca la logica esistente del profilo.)
 */
export function useReferral() {
  const [codice, setCodice] = useState('');
  const [stats, setStats] = useState<ReferralStats>({ totaleUsi: 0, completati: 0, ricompenseTotali: 0 });
  const [storico, setStorico] = useState<ReferralEntry[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [caricamento, setCaricamento] = useState(true);

  useEffect(() => {
    if (!supabase) {
      setCaricamento(false);
      return;
    }
    let attivo = true;
    (async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!attivo || !user) return;
        setUserId(user.id);

        const { data: profilo } = await supabase
          .from('profiles')
          .select('referral_code')
          .eq('id', user.id)
          .maybeSingle();
        if (attivo && profilo?.referral_code) setCodice(String(profilo.referral_code));

        const { data: righe } = await supabase
          .from('referrals')
          .select('id, discount_applied, reward_amount, status, created_at')
          .eq('referrer_id', user.id)
          .order('created_at', { ascending: false })
          .limit(20);
        if (attivo && righe) {
          const entrate = righe as ReferralEntry[];
          setStorico(entrate);
          setStats({
            totaleUsi: entrate.length,
            completati: entrate.filter((r) => r.status === 'completed').length,
            ricompenseTotali: entrate
              .filter((r) => r.status === 'completed')
              .reduce((s, r) => s + Number(r.reward_amount), 0),
          });
        }
      } catch (err) {
        console.warn('useReferral:', (err as Error).message);
      } finally {
        if (attivo) setCaricamento(false);
      }
    })();
    return () => {
      attivo = false;
    };
  }, []);

  /**
   * Controlla se un codice è disponibile per l'utente corrente:
   * - non deve appartenere a nessun ALTRO profilo.
   */
  const validaDisponibilita = useCallback(
    async (codiceDaVerificare: string): Promise<boolean> => {
      if (!supabase || !userId) return false;
      const upp = codiceDaVerificare.toUpperCase().trim();
      if (!upp) return false;
      const { data, error } = await supabase.rpc('valida_codice_promo', { p_codice: upp });
      if (error) return true; // errore RPC: non blocchiamo il salvataggio
      const riga = Array.isArray(data) && data.length > 0 ? (data[0] as { referrer_id?: string }) : null;
      // occupato da un altro utente → non disponibile
      return !(riga?.referrer_id && riga.referrer_id !== userId);
    },
    [userId],
  );

  const salvaCodice = useCallback(
    async (nuovoCodice: string): Promise<{ ok: boolean; errore?: string }> => {
      if (!supabase || !userId) return { ok: false, errore: 'Non autenticato' };
      const upp = nuovoCodice.toUpperCase().replace(/[^A-Z0-9]/g, '');
      if (upp.length < 3) return { ok: false, errore: 'Il codice deve avere almeno 3 caratteri' };
      if (!(await validaDisponibilita(upp))) {
        return { ok: false, errore: 'Codice già in uso da un altro utente' };
      }
      const { error } = await supabase.from('profiles').update({ referral_code: upp }).eq('id', userId);
      if (error) return { ok: false, errore: error.message };
      setCodice(upp);
      return { ok: true };
    },
    [userId, validaDisponibilita],
  );

  return { codice, stats, storico, userId, caricamento, validaDisponibilita, salvaCodice };
}
