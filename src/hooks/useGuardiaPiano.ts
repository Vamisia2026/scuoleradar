/**
 * ScuoleRadar.it — guardia del PIANO lato UI (tetti + anti-blocco del caricamento).
 *
 * Nasce da due disallineamenti reali tra BACKEND e frontend:
 *  1. un PRO "regalato" (promo, omaggio, Beta Tester, pannello admin) veniva trattato
 *     come Base — con i tetti Radar applicati alle preferenze (1 provincia / 2 classi)
 *     che TRONCAVANO la selezione dell'utente. Finché il piano non è confermato dal
 *     DB (`pianoStato !== 'pronto'`) qui si restituisce `tetti: null` = NESSUN
 *     troncamento;
 *  2. il piano poteva restare in `'loading'` per sempre (rete lenta/offline, lettura
 *     profilo fallita): dopo 10 s si esce dal caricamento con il piano noto. Lo stato
 *     incerto non punisce nessuno, perché i percorsi di NEGAZIONE (paywall, blocchi)
 *     pretendono `pianoStato === 'pronto'`.
 */
import { useEffect, useMemo, type Dispatch, type SetStateAction } from 'react';
import { pianoLimits } from '@/lib/planLimits';

/** Tetti Radar da applicare alle preferenze (province/classi). */
export interface TettiPiano {
  province: number;
  classi: number;
}

interface OpzioniGuardiaPiano {
  /** Piano corrente letto dal profilo (`base` | `pro` | `free_forever`). */
  piano: 'base' | 'pro' | 'free_forever';
  /** true con accesso PRO completo (piano 'pro' o 'free_forever'). */
  hasProAccess: boolean;
  /** `'pronto'` = piano confermato dal DB; `'loading'` = lettura in corso. */
  pianoStato: 'loading' | 'pronto';
  /** Setter dello stato del piano (per la guardia anti-blocco). */
  setPianoStato: Dispatch<SetStateAction<'loading' | 'pronto'>>;
  /** Millisecondi oltre i quali non si resta in caricamento (default 10 s). */
  timeoutMs?: number;
}

export function useGuardiaPiano({
  piano,
  hasProAccess,
  pianoStato,
  setPianoStato,
  timeoutMs = 10_000,
}: OpzioniGuardiaPiano): { tetti: TettiPiano | null } {
  const limiti = pianoLimits(piano, hasProAccess);
  const tetti = useMemo<TettiPiano | null>(
    () =>
      pianoStato === 'pronto'
        ? { province: limiti.maxProvince, classi: limiti.maxClassiConcorso }
        : null,
    [pianoStato, limiti.maxProvince, limiti.maxClassiConcorso],
  );

  useEffect(() => {
    if (pianoStato !== 'loading') return;
    const timer = window.setTimeout(() => {
      console.warn('[piano] lettura dal DB lenta o assente: esco dal caricamento con il piano noto.');
      setPianoStato('pronto');
    }, timeoutMs);
    return () => window.clearTimeout(timer);
  }, [pianoStato, setPianoStato, timeoutMs]);

  return { tetti };
}
